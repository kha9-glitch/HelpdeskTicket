import { Router } from "express";
import { requireAuth } from "../middleware/require-auth";
import prisma from "../db";
import { requireAdmin } from "../middleware/require-admin";
import { z } from "zod";

const router = Router();

const emailConfigSchema = z.object({
  imapHost: z.string().min(1),
  imapPort: z.number().int(),
  imapUser: z.string().min(1),
  imapPassword: z.string().min(1),
  imapTls: z.boolean(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int(),
  smtpUser: z.string().min(1),
  smtpPassword: z.string().min(1),
  smtpSecure: z.boolean(),
  fromAddress: z.string().email(),
  isActive: z.boolean()
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
    imapPassword,
    smtpPassword
  };

  if (existing) {
    const updated = await prisma.emailConfig.update({
      where: { id: existing.id },
      data: updateData
    });
    res.json(updated);
  } else {
    const created = await prisma.emailConfig.create({
      data: updateData
    });
    res.json(created);
  }
});

router.get("/logs", requireAuth, requireAdmin, async (req, res) => {
  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json(logs);
});

export default router;
