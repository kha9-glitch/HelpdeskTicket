import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import prisma from "../db";
import { inboundEmailSchema } from "core/schemas/tickets.ts";
import { validate } from "./validate";
import { sendClassifyJob } from "./classify-ticket";
import { sendAutoResolveJob } from "./auto-resolve-ticket";
import { AI_AGENT_ID } from "core/constants/ai-agent.ts";
import Sentry from "./sentry";

let client: ImapFlow | null = null;
let isShuttingDown = false;

function stripSubjectPrefixes(subject: string): string {
  return subject.replace(/^(Re:\s*|Fwd:\s*)+/i, "").trim();
}

async function processEmailMessage(source: Buffer, configId: number) {
  try {
    const parsed = await simpleParser(source);
    
    // Parse From address
    let fromEmail = "";
    let fromName = "";
    if (parsed.from && parsed.from.value.length > 0) {
      fromEmail = parsed.from.value[0].address || "";
      fromName = parsed.from.value[0].name || fromEmail;
    }

    if (!fromEmail) return;

    // We do manual validation against the schema similar to webhook
    const rawData = {
      from: fromEmail,
      fromName: fromName,
      subject: parsed.subject || "(No Subject)",
      body: parsed.text || "No content",
      bodyHtml: parsed.html || undefined,
    };
    
    // Quick validation bypassing Express response
    const resMock: any = {
      status: () => ({ json: () => {} })
    };
    const data = validate(inboundEmailSchema, rawData, resMock);
    if (!data) {
      throw new Error("Email failed schema validation");
    }

    const normalizedSubject = stripSubjectPrefixes(data.subject);

    // Check for existing open ticket from same sender with matching subject
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        senderEmail: data.from,
        status: { notIn: ["resolved", "closed"] },
        subject: { equals: normalizedSubject, mode: "insensitive" },
      },
    });

    if (existingTicket) {
      await prisma.reply.create({
        data: {
          body: data.body,
          bodyHtml: data.bodyHtml ?? null,
          senderType: "customer",
          ticketId: existingTicket.id,
          userId: null,
        },
      });
      await prisma.systemLog.create({
        data: {
          level: "info",
          component: "IMAP",
          message: `Received reply for ticket #${existingTicket.id} from ${data.from}`,
        }
      });
      console.log(`IMAP: Added reply to ticket #${existingTicket.id}`);
      return;
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject: normalizedSubject,
        body: data.body,
        bodyHtml: data.bodyHtml ?? null,
        senderName: data.fromName,
        senderEmail: data.from,
        assignedToId: AI_AGENT_ID,
      },
    });

    await prisma.systemLog.create({
      data: {
        level: "info",
        component: "IMAP",
        message: `Created new ticket #${ticket.id} from ${data.from}`,
      }
    });

    console.log(`IMAP: Created new ticket #${ticket.id}`);

    sendClassifyJob(ticket).catch((error) =>
      console.error(`Failed to enqueue classify job for ticket ${ticket.id}:`, error)
    );

    sendAutoResolveJob(ticket).catch((error) =>
      console.error(`Failed to enqueue auto-resolve job for ticket ${ticket.id}:`, error)
    );

  } catch (error: any) {
    console.error("IMAP Error processing email:", error);
    await prisma.systemLog.create({
      data: {
        level: "error",
        component: "IMAP",
        message: "Failed to process incoming email",
        details: error.message
      }
    });
  }
}

export async function startImapListener() {
  if (client) return;

  const config = await prisma.emailConfig.findFirst();
  if (!config || !config.isActive) {
    console.log("IMAP Listener not starting: Configuration missing or disabled.");
    return;
  }

  client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapTls,
    auth: {
      user: config.imapUser,
      pass: config.imapPassword,
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log("IMAP Connected securely");
    await prisma.systemLog.create({
      data: {
        level: "info",
        component: "IMAP",
        message: "Successfully connected to IMAP server"
      }
    });

    // Select mailbox
    let lock = await client.getMailboxLock('INBOX');
    try {
      // Process initial unread emails
      for await (let msg of client.fetch({ seen: false }, { source: true, uid: true })) {
        if (msg.source) {
          await processEmailMessage(msg.source, config.id);
          await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
        }
      }
    } finally {
      lock.release();
    }

    // Listen for new messages
    client.on('exists', async (data) => {
      if (isShuttingDown) return;
      try {
        let lock = await client!.getMailboxLock('INBOX');
        try {
          for await (let msg of client!.fetch({ seen: false }, { source: true, uid: true })) {
            if (msg.source) {
              await processEmailMessage(msg.source, config.id);
              await client!.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
            }
          }
        } finally {
          lock.release();
        }
      } catch (err: any) {
        console.error("Error fetching new messages:", err);
      }
    });

  } catch (error: any) {
    console.error("IMAP Connection failed:", error);
    await prisma.systemLog.create({
      data: {
        level: "error",
        component: "IMAP",
        message: "Failed to connect to IMAP server",
        details: error.message
      }
    });
    client = null;
    
    // Retry in 5 minutes
    setTimeout(startImapListener, 5 * 60 * 1000);
  }
}

export async function stopImapListener() {
  isShuttingDown = true;
  if (client) {
    await client.logout();
    client = null;
    console.log("IMAP Disconnected");
  }
}
