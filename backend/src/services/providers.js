/**
 * Stage 9 — Outbound Email & SMS Provider Adapter
 * Supports minimal lock-screen preview by default (PRD Prompt 9) so sensitive medication/condition
 * names are not exposed on shared lock screens unless the user explicitly sets `minimal_preview = 0`.
 */
import nodemailer from 'nodemailer';
import twilio from 'twilio';

export function getMailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

export function getTwilio() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) return null;
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export function formatReminderMessage(r) {
  const minimal = r.minimal_preview === undefined ? true : Boolean(r.minimal_preview);
  if (minimal) {
    return `VYORA reminder (${r.time || 'now'}): You have a scheduled health/habit check-in. Open VYORA for details and follow your clinician's instructions. Reply STOP to opt out.`;
  }
  return `VYORA reminder: It is time for ${r.label || r.name}. Follow the instructions provided by your healthcare professional. VYORA does not provide dosing advice. Reply STOP to opt out.`;
}

export async function deliver(r) {
  const body = formatReminderMessage(r);
  if (r.channel === 'email') {
    const mailer = getMailer();
    if (!mailer) throw new Error('Email provider is not configured.');
    if (!r.email) throw new Error('Verified email destination is required.');
    const result = await mailer.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: r.email,
      subject: 'Your VYORA reminder',
      text: body
    });
    return { providerId: result.messageId || null };
  }
  if (r.channel === 'sms') {
    const client = getTwilio();
    if (!client) throw new Error('SMS provider is not configured.');
    if (!/^\+[1-9]\d{7,14}$/.test(r.phone || '')) throw new Error('Valid international phone destination is required.');
    const result = await client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER,
      to: r.phone,
      body
    });
    return { providerId: result.sid || null };
  }
  throw new Error('Unsupported channel');
}
