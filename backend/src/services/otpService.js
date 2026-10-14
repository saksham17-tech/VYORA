/**
 * Stage 7 — Contact Verification (OTP) & Password Reset Service
 * Uses the `verification_tokens` table introduced in Stage 2.
 * Hashes OTP codes with SHA-256 before persistence; never stores raw OTPs in SQLite.
 */
import crypto from 'node:crypto';
import { db, isoNow } from '../db.js';
import { id, str, validEmail } from '../utils/helpers.js';
import { getMailer, getTwilio } from './providers.js';
import { logAudit } from './auditService.js';

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

function generateSixDigitCode() {
  return String(crypto.randomInt(100000, 999999));
}

export function validPhone(phone) {
  return /^\+[1-9]\d{7,14}$/.test(String(phone || '').trim());
}

export async function issueVerificationOtp({
  userId,
  channel,
  destination,
  purpose = 'verify_contact'
}) {
  const ch = channel === 'sms' || channel === 'phone' ? 'sms' : 'email';
  const dest = ch === 'email' ? str(destination, 254).toLowerCase() : str(destination, 24);

  if (ch === 'email' && !validEmail(dest)) {
    throw new Error('A valid email address is required.');
  }
  if (ch === 'sms' && !validPhone(dest)) {
    throw new Error('Phone number must be in international E.164 format (e.g. +919876543210).');
  }

  const code = generateSixDigitCode();
  const tokenHash = hashOtp(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  const tokenId = id();

  db.prepare(
    `INSERT INTO verification_tokens (id, user_id, channel, destination, token_hash, purpose, expires_at, used_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(tokenId, userId, ch, dest, tokenHash, str(purpose, 40), expiresAt, now.toISOString());

  let deliveredViaProvider = false;
  const textBody = `Your VYORA verification code is ${code}. It expires in 15 minutes. If you did not request this, ignore this message.`;

  if (ch === 'email' && getMailer()) {
    await getMailer().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: dest,
      subject: 'Your VYORA verification code',
      text: textBody
    });
    deliveredViaProvider = true;
  } else if (ch === 'sms' && getTwilio()) {
    await getTwilio().messages.create({
      from: process.env.TWILIO_FROM_NUMBER,
      to: dest,
      body: textBody
    });
    deliveredViaProvider = true;
  }

  logAudit({
    actorId: userId,
    action: 'auth.otp_requested',
    targetType: ch,
    targetId: dest,
    metadata: { purpose, deliveredViaProvider }
  });

  const response = {
    ok: true,
    channel: ch,
    destination: dest,
    purpose,
    expiresAt,
    deliveredViaProvider,
    message: deliveredViaProvider
      ? `Verification code sent to ${dest}.`
      : 'Verification code generated (provider not configured; using local development preview code).'
  };

  if (process.env.NODE_ENV !== 'production' && !deliveredViaProvider) {
    response.devCode = code;
  }
  return response;
}

export function verifyOtpCode({
  userId,
  channel,
  destination,
  code,
  purpose = 'verify_contact'
}) {
  const ch = channel === 'sms' || channel === 'phone' ? 'sms' : 'email';
  const dest = ch === 'email' ? str(destination, 254).toLowerCase() : str(destination, 24);
  const cleanCode = str(code, 12);

  if (!cleanCode) {
    throw new Error('Verification code is required.');
  }

  const row = db.prepare(
    `SELECT * FROM verification_tokens
     WHERE user_id = ? AND channel = ? AND destination = ? AND purpose = ? AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`
  ).get(userId, ch, dest, str(purpose, 40));

  if (!row) {
    throw new Error('No pending verification code found for this destination.');
  }

  const nowIso = isoNow();
  if (row.expires_at < nowIso) {
    throw new Error('Verification code has expired. Please request a new code.');
  }

  const expectedBuf = Buffer.from(row.token_hash, 'hex');
  const actualBuf = Buffer.from(hashOtp(cleanCode), 'hex');
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    logAudit({
      actorId: userId,
      action: 'auth.otp_failed',
      targetType: ch,
      targetId: dest,
      outcome: 'invalid_code',
      metadata: { purpose }
    });
    throw new Error('Invalid verification code.');
  }

  db.prepare(`UPDATE verification_tokens SET used_at = ? WHERE id = ?`).run(nowIso, row.id);

  if (purpose === 'verify_contact') {
    if (ch === 'email') {
      db.prepare(`UPDATE users SET email = ?, email_verified = 1, updated_at = ? WHERE id = ?`).run(dest, nowIso, userId);
    } else {
      db.prepare(`UPDATE users SET phone = ?, phone_verified = 1, updated_at = ? WHERE id = ?`).run(dest, nowIso, userId);
    }
  }

  logAudit({
    actorId: userId,
    action: 'auth.otp_verified',
    targetType: ch,
    targetId: dest,
    metadata: { purpose }
  });

  return { ok: true, channel: ch, destination: dest, verifiedAt: nowIso };
}
