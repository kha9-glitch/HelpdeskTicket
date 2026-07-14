import nodemailer from "nodemailer";
import type { PgBoss } from "pg-boss";
import Sentry from "./sentry";
import prisma from "../db";

const QUEUE_NAME = "send-email";

interface SendEmailJobData {
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
}

export async function registerSendEmailWorker(boss: PgBoss): Promise<void> {
  await boss.createQueue(QUEUE_NAME, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
  });

  await boss.work<SendEmailJobData>(QUEUE_NAME, async (jobs) => {
    const { to, subject, body, bodyHtml } = jobs[0]!.data;

    try {
      const config = await prisma.emailConfig.findFirst();
      if (!config || !config.isActive) {
        console.log("Skipping email send: EmailConfig not found or not active.");
        return;
      }

      if (config.sendgridApiKey) {
        // Use SendGrid HTTP API to bypass Railway SMTP blocks
        const sgMail = (await import("@sendgrid/mail")).default;
        sgMail.setApiKey(config.sendgridApiKey);
        
        await sgMail.send({
          from: config.fromAddress,
          to,
          subject,
          text: body,
          ...(bodyHtml && { html: bodyHtml }),
        });
      } else {
        // Fallback to SMTP
        const transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPassword,
          },
        });

        await transporter.sendMail({
          from: config.fromAddress,
          to,
          subject,
          text: body,
          ...(bodyHtml && { html: bodyHtml }),
        });
      }

      console.log(`Email sent to ${to} — subject: "${subject}"`);
      
      await prisma.systemLog.create({
        data: {
          level: "info",
          component: "SMTP",
          message: `Email sent to ${to}`,
        }
      });
    } catch (error: any) {
      Sentry.captureException(error, {
        tags: { queue: QUEUE_NAME },
      });
      let errorMessage = error.message;
      if (error.response && error.response.body && error.response.body.errors) {
        errorMessage = error.response.body.errors.map((e: any) => e.message).join(", ");
      }

      await prisma.systemLog.create({
        data: {
          level: "error",
          component: "SMTP",
          message: `Failed to send email to ${to}`,
          details: errorMessage
        }
      });
      throw error;
    }
  });
}

export async function sendEmailJob(data: SendEmailJobData): Promise<void> {
  const { boss } = await import("./queue");
  await boss.send(QUEUE_NAME, data);
}
