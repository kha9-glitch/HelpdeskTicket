import { Router } from "express";
import { requireAuth } from "../middleware/require-auth";
import prisma from "../db";
import { requireAdmin } from "../middleware/require-admin";
import { z } from "zod";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { stopImapListener, startImapListener } from "../lib/imap-listener";

const router = Router();

const emailConfigSchema = z.object({
  imapHost: z.string().catch(""),
  imapPort: z.number().int().catch(993),
  imapUser: z.string().catch(""),
  imapPassword: z.string().catch(""),
  imapTls: z.boolean().catch(true),
  smtpHost: z.string().catch(""),
  smtpPort: z.number().int().catch(465),
  smtpUser: z.string().catch(""),
  smtpPassword: z.string().catch(""),
  smtpSecure: z.boolean().catch(true),
  fromAddress: z.string().catch(""),
  isActive: z.boolean().catch(true)
});

router.get("/email", requireAuth, requireAdmin, async (req, res) => {
  const config = await prisma.emailConfig.findFirst();
  if (!config) {
    res.json(null);
    return;
  }
  // Mask passwords
  res.json({
    ...config,
    imapPassword: config.imapPassword ? "********" : "",
    smtpPassword: config.smtpPassword ? "********" : ""
  });
});

router.post("/email", requireAuth, requireAdmin, async (req, res) => {
  const data = emailConfigSchema.safeParse(req.body);
  if (!data.success) {
    res.status(400).json({ error: "Invalid data", details: data.error });
    return;
  }

  const existing = await prisma.emailConfig.findFirst();
  
  // If passwords are masked, use the old ones
  const imapPassword = data.data.imapPassword === "********" && existing 
    ? existing.imapPassword 
    : data.data.imapPassword;
    
  const smtpPassword = data.data.smtpPassword === "********" && existing 
    ? existing.smtpPassword 
    : data.data.smtpPassword;

  const updateData = {
    ...data.data,
    imapTls: data.data.imapPort === 993,
    smtpSecure: data.data.smtpPort === 465,
    imapPassword,
    smtpPassword
  };

  let config;
  if (existing) {
    config = await prisma.emailConfig.update({
      where: { id: existing.id },
      data: updateData
    });
  } else {
    config = await prisma.emailConfig.create({
      data: updateData
    });
  }

  // Restart IMAP listener seamlessly to pick up new config
  if (config.isActive) {
    stopImapListener().catch(console.error);
    setTimeout(() => {
      startImapListener().catch(console.error);
    }, 1000);
  }

  res.json(config);
});

router.post("/test-imap", requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = emailConfigSchema.parse(req.body);
    const existing = await prisma.emailConfig.findFirst();
    const pass = data.imapPassword === "********" && existing ? existing.imapPassword : data.imapPassword;

    const client = new ImapFlow({
      host: data.imapHost,
      port: data.imapPort,
      secure: data.imapPort === 993,
      auth: { user: data.imapUser, pass },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
      res.json({ success: true, message: "IMAP connection successful!" });
    } catch (e: any) {
      client.close();
      throw e;
    }
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to connect" });
  }
});

router.post("/test-smtp", requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = emailConfigSchema.parse(req.body);
    const existing = await prisma.emailConfig.findFirst();
    const pass = data.smtpPassword === "********" && existing ? existing.smtpPassword : data.smtpPassword;

    const transporter = nodemailer.createTransport({
      host: data.smtpHost,
      port: data.smtpPort,
      secure: data.smtpPort === 465,
      auth: { user: data.smtpUser, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.verify();
    res.json({ success: true, message: "SMTP connection successful!" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to connect" });
  }
});

router.get("/logs", requireAuth, requireAdmin, async (req, res) => {
  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json(logs);
});

export default router;
