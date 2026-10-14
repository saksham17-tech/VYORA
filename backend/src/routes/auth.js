/**
 * Stage 10 — Identity, Guest Session, Registration, Login, Logout, Link-Guest, OTP & Password Reset Routes
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, isoNow } from '../db.js';
import { id, str, validEmail } from '../utils/helpers.js';
import { authOnly, secret } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { issueVerificationOtp, verifyOtpCode, validPhone } from '../services/otpService.js';

const SALT_ROUNDS = 10;

export function issueToken(user) {
  const jti = id();
  const token = jwt.sign(
    { sub: user.id, guest: !!user.is_guest, jti, email: user.email || null },
    secret,
    { expiresIn: '30d' }
  );
  return { token, jti, expiresIn: '30d' };
}

export function registerAuthRoutes(app) {
  app.post('/api/session/guest', (req, res) => {
    const userId = id(), now = isoNow();
    db.prepare('INSERT INTO users(id,display_name,created_at,updated_at,is_guest) VALUES(?,?,?,?,1)')
      .run(userId, str(req.body?.displayName, 80) || 'VYORA Guest', now, now);
    db.prepare('INSERT INTO profiles(user_id,profile_json,updated_at) VALUES(?,?,?)')
      .run(userId, '{}', now);
    const jti = id();
    const token = jwt.sign({ sub: userId, guest: true, jti }, secret, { expiresIn: '30d' });
    res.status(201).json({
      token,
      user: { id: userId, displayName: 'VYORA Guest', isGuest: true },
      expiresIn: '30d'
    });
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const email = str(req.body?.email, 254).toLowerCase();
      const password = String(req.body?.password || '');
      const displayName = str(req.body?.displayName, 80) || 'VYORA User';
      const phone = str(req.body?.phone, 24) || null;
      if (!validEmail(email)) return res.status(400).json({ error: 'Valid email is required.' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      if (phone && !validPhone(phone)) return res.status(400).json({ error: 'Phone must be in international E.164 format (e.g. +919876543210).' });
      const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email);
      if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      const userId = id(), now = isoNow();
      db.prepare(
        'INSERT INTO users(id,email,password_hash,display_name,phone,created_at,updated_at,is_guest,email_verified,phone_verified) VALUES(?,?,?,?,?,?,?,0,0,0)'
      ).run(userId, email, hash, displayName, phone, now, now);
      db.prepare('INSERT INTO profiles(user_id,profile_json,updated_at) VALUES(?,?,?)').run(userId, '{}', now);

      const user = { id: userId, email, display_name: displayName, is_guest: 0 };
      const { token, expiresIn } = issueToken(user);
      logAudit({ actorId: userId, action: 'auth.register', targetType: 'user', targetId: userId, metadata: { email } });

      res.status(201).json({
        token,
        user: { id: userId, email, phone, displayName, isGuest: false, emailVerified: false, phoneVerified: false },
        expiresIn,
        message: 'Account created. Verify your email or phone before scheduling outbound reminders.'
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = str(req.body?.email, 254).toLowerCase();
      const password = String(req.body?.password || '');
      if (!validEmail(email) || !password) return res.status(400).json({ error: 'Email and password are required.' });
      const u = db.prepare('SELECT id,email,password_hash,display_name,phone,is_guest,email_verified,phone_verified FROM users WHERE email=?').get(email);
      if (!u || !u.password_hash) return res.status(401).json({ error: 'Invalid email or password.' });
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) {
        logAudit({ actorId: u.id, action: 'auth.login_failed', targetType: 'user', targetId: u.id, outcome: 'invalid_password' });
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      const { token, expiresIn } = issueToken(u);
      logAudit({ actorId: u.id, action: 'auth.login', targetType: 'user', targetId: u.id });
      res.json({
        token,
        user: {
          id: u.id,
          email: u.email,
          phone: u.phone || null,
          displayName: u.display_name,
          isGuest: !!u.is_guest,
          emailVerified: !!u.email_verified,
          phoneVerified: !!u.phone_verified
        },
        expiresIn
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  app.post('/api/auth/logout', authOnly, (req, res) => {
    const now = isoNow();
    if (req.user.jti) {
      db.prepare('INSERT OR IGNORE INTO revoked_tokens(jti,user_id,revoked_at,reason) VALUES(?,?,?,?)')
        .run(req.user.jti, req.user.sub, now, 'logout');
    }
    logAudit({ actorId: req.user.sub, action: 'auth.logout', targetType: 'session', targetId: req.user.jti || null });
    res.json({ ok: true, message: 'Logged out. Session revoked.' });
  });

  app.post('/api/auth/link-guest', authOnly, async (req, res) => {
    try {
      if (!req.user.guest) return res.status(400).json({ error: 'Only guest sessions can be linked.' });
      const email = str(req.body?.email, 254).toLowerCase();
      const password = String(req.body?.password || '');
      const displayName = str(req.body?.displayName, 80);
      if (!validEmail(email)) return res.status(400).json({ error: 'Valid email is required.' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email);
      if (existing) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      const now = isoNow();
      db.prepare('UPDATE users SET email=?,password_hash=?,display_name=COALESCE(?,display_name),is_guest=0,email_verified=0,updated_at=? WHERE id=?')
        .run(email, hash, displayName || null, now, req.user.sub);
      const u = db.prepare('SELECT id,email,display_name,is_guest,email_verified,phone,phone_verified FROM users WHERE id=?').get(req.user.sub);
      const { token, expiresIn } = issueToken(u);
      logAudit({ actorId: u.id, action: 'auth.link_guest', targetType: 'user', targetId: u.id, metadata: { email } });

      res.json({
        token,
        user: {
          id: u.id,
          email: u.email,
          phone: u.phone || null,
          displayName: u.display_name,
          isGuest: false,
          emailVerified: false,
          phoneVerified: !!u.phone_verified
        },
        expiresIn,
        message: 'Guest data retained and linked to your new account.'
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Link failed.' });
    }
  });

  app.post('/api/auth/verify/request', authOnly, async (req, res) => {
    try {
      const channel = req.body?.channel === 'sms' || req.body?.channel === 'phone' ? 'sms' : 'email';
      const u = db.prepare('SELECT id, email, phone FROM users WHERE id = ?').get(req.user.sub);
      if (!u) return res.status(404).json({ error: 'User not found.' });
      const destination = str(req.body?.destination, 254) || (channel === 'email' ? u.email : u.phone);
      if (!destination) {
        return res.status(400).json({ error: `Provide a ${channel === 'email' ? 'valid email' : 'phone number'} to verify.` });
      }
      const result = await issueVerificationOtp({
        userId: u.id,
        channel,
        destination,
        purpose: 'verify_contact'
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Could not request verification code.' });
    }
  });

  app.post('/api/auth/verify/confirm', authOnly, (req, res) => {
    try {
      const channel = req.body?.channel === 'sms' || req.body?.channel === 'phone' ? 'sms' : 'email';
      const u = db.prepare('SELECT id, email, phone FROM users WHERE id = ?').get(req.user.sub);
      if (!u) return res.status(404).json({ error: 'User not found.' });
      const destination = str(req.body?.destination, 254) || (channel === 'email' ? u.email : u.phone);
      const code = str(req.body?.code, 12);
      const result = verifyOtpCode({
        userId: u.id,
        channel,
        destination,
        code,
        purpose: 'verify_contact'
      });
      const updated = db.prepare('SELECT id,email,display_name,is_guest,email_verified,phone,phone_verified FROM users WHERE id=?').get(u.id);
      res.json({
        ...result,
        user: {
          id: updated.id,
          email: updated.email,
          displayName: updated.display_name,
          isGuest: !!updated.is_guest,
          emailVerified: !!updated.email_verified,
          phone: updated.phone || null,
          phoneVerified: !!updated.phone_verified
        }
      });
    } catch (e) {
      res.status(400).json({ error: e.message || 'Verification failed.' });
    }
  });

  app.post('/api/auth/password-reset/request', async (req, res) => {
    try {
      const email = str(req.body?.email, 254).toLowerCase();
      if (!validEmail(email)) return res.status(400).json({ error: 'Valid email is required.' });
      const u = db.prepare('SELECT id, email FROM users WHERE email = ? AND is_guest = 0').get(email);
      if (!u) {
        return res.json({ ok: true, message: 'If an account exists for that email, a password reset code has been issued.' });
      }
      const otp = await issueVerificationOtp({
        userId: u.id,
        channel: 'email',
        destination: u.email,
        purpose: 'password_reset'
      });
      res.json({
        ok: true,
        message: 'If an account exists for that email, a password reset code has been issued.',
        ...(otp.devCode ? { devCode: otp.devCode } : {})
      });
    } catch (e) {
      res.status(400).json({ error: e.message || 'Password reset request failed.' });
    }
  });

  app.post('/api/auth/password-reset/confirm', async (req, res) => {
    try {
      const email = str(req.body?.email, 254).toLowerCase();
      const code = str(req.body?.code, 12);
      const newPassword = String(req.body?.newPassword || '');
      if (!validEmail(email) || !code) return res.status(400).json({ error: 'Email and reset code are required.' });
      if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      const u = db.prepare('SELECT id, email FROM users WHERE email = ? AND is_guest = 0').get(email);
      if (!u) return res.status(400).json({ error: 'Invalid email or reset code.' });

      verifyOtpCode({
        userId: u.id,
        channel: 'email',
        destination: u.email,
        code,
        purpose: 'password_reset'
      });

      const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      const now = isoNow();
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now, u.id);
      logAudit({ actorId: u.id, action: 'auth.password_reset', targetType: 'user', targetId: u.id });
      res.json({ ok: true, message: 'Password has been reset. You can now log in with your new password.' });
    } catch (e) {
      res.status(400).json({ error: e.message || 'Password reset failed.' });
    }
  });
}
