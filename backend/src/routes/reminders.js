/**
 * Stage 10 — Medication & Habit Reminders, Quiet Hours, Opt-Out & Delivery Status Routes
 */
import { db, isoNow } from '../db.js';
import { id, str, validTime, validEmail } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import { deliver } from '../services/providers.js';
import {
  computeNextOccurrenceIso,
  cancelPendingDeliveries
} from '../services/reminderScheduler.js';
import { logAudit, hasConsent, grantConsent } from '../services/auditService.js';
import { validPhone } from '../services/otpService.js';

export function registerReminderRoutes(app) {
  app.get('/api/reminders', authOnly, (req, res) => res.json(
    db.prepare(
      'SELECT id,label,reminder_type,time,timezone,channel,email,phone,start_date,end_date,notes,quiet_start,quiet_end,minimal_preview,opted_out,active,created_at FROM reminders WHERE user_id=? ORDER BY time'
    )
      .all(req.user.sub)
      .map(x => ({
        ...x,
        label: x.label || x.name,
        active: !!x.active,
        minimalPreview: !!x.minimal_preview,
        optedOut: !!x.opted_out,
        quietStart: x.quiet_start || '22:00',
        quietEnd: x.quiet_end || '07:00',
        nextOccurrence: x.active && !x.opted_out
          ? computeNextOccurrenceIso(x.time, x.timezone, x.start_date, x.end_date)
          : null,
        createdAt: x.created_at
      }))
  ));

  app.post('/api/reminders', authOnly, (req, res) => {
    const label = str(req.body?.label || req.body?.name, 120);
    const time = str(req.body?.time, 5);
    const channel = ['email', 'sms', 'browser'].includes(req.body?.channel) ? req.body.channel : 'email';
    const email = str(req.body?.email, 254);
    const phone = str(req.body?.phone, 24);
    const timezone = str(req.body?.timezone, 80) || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata';
    const type = ['medication', 'water', 'movement', 'sleep', 'appointment', 'other'].includes(req.body?.reminderType)
      ? req.body.reminderType
      : 'medication';
    const quietStart = req.body?.quietStart !== undefined ? str(req.body.quietStart, 5) : '22:00';
    const quietEnd = req.body?.quietEnd !== undefined ? str(req.body.quietEnd, 5) : '07:00';
    const minimalPreview = req.body?.minimalPreview === false ? 0 : 1;

    if (!label || !validTime(time)) {
      return res.status(400).json({ error: 'A reminder label and valid time (HH:MM) are required.' });
    }
    if ((quietStart && !validTime(quietStart)) || (quietEnd && !validTime(quietEnd))) {
      return res.status(400).json({ error: 'Quiet hours must use valid HH:MM format.' });
    }
    if (req.body?.source === 'voice' && req.body?.voiceConfirmed !== true) {
      return res.status(400).json({
        code: 'VOICE_CONFIRMATION_REQUIRED',
        error: `Please confirm your voice reminder details before saving: "${label}" at ${time} (${timezone}) via ${channel}.`,
        readBack: { label, time, timezone, channel, destination: channel === 'email' ? email : phone }
      });
    }
    if (channel !== 'browser' && req.body?.consent !== true) {
      return res.status(400).json({ error: 'Explicit consent is required before scheduling email/SMS reminders.' });
    }
    if (channel === 'email' && !validEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (channel === 'sms' && !validPhone(phone)) {
      return res.status(400).json({ error: 'Enter phone in international format, e.g. +919876543210.' });
    }

    const account = db.prepare('SELECT is_guest,email,email_verified,phone,phone_verified FROM users WHERE id=?').get(req.user.sub);
    if (account && !account.is_guest && channel !== 'browser') {
      if (channel === 'email') {
        if (!account.email_verified || !account.email || email.toLowerCase() !== account.email.toLowerCase()) {
          return res.status(403).json({
            code: 'UNVERIFIED_DESTINATION',
            error: 'Registered accounts must verify their email address before scheduling email reminders, and may only send to their verified email.'
          });
        }
      }
      if (channel === 'sms') {
        if (!account.phone_verified || !account.phone || phone !== account.phone) {
          return res.status(403).json({
            code: 'UNVERIFIED_DESTINATION',
            error: 'Registered accounts must verify their phone number before scheduling SMS reminders, and may only send to their verified phone.'
          });
        }
      }
    }

    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); } catch {
      return res.status(400).json({ error: 'Invalid timezone. Example: Asia/Kolkata.' });
    }
    if (channel === 'browser') {
      return res.status(400).json({ error: 'Browser notifications are device-local; use the browser reminder option in the UI instead.' });
    }

    const rid = id(), now = isoNow();
    const startDate = str(req.body?.startDate, 10) || null;
    const endDate = str(req.body?.endDate, 10) || null;
    db.prepare(
      `INSERT INTO reminders(
         id,user_id,label,reminder_type,time,timezone,channel,email,phone,
         start_date,end_date,notes,quiet_start,quiet_end,minimal_preview,opted_out,consent_at,active,created_at,updated_at
       ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,1,?,?)`
    ).run(
      rid,
      req.user.sub,
      label,
      type,
      time,
      timezone,
      channel,
      channel === 'email' ? email : null,
      channel === 'sms' ? phone : null,
      startDate,
      endDate,
      str(req.body?.notes, 500) || null,
      quietStart || null,
      quietEnd || null,
      minimalPreview,
      now,
      now,
      now
    );

    if (!hasConsent(req.user.sub, 'medication_reminders')) {
      grantConsent({ userId: req.user.sub, purpose: 'medication_reminders', scope: channel });
    }
    logAudit({ actorId: req.user.sub, action: 'reminder.created', targetType: 'reminder', targetId: rid, metadata: { channel, type, timezone } });

    res.status(201).json({
      id: rid,
      label,
      reminderType: type,
      time,
      timezone,
      channel,
      email: channel === 'email' ? email : null,
      phone: channel === 'sms' ? phone : null,
      quietStart,
      quietEnd,
      minimalPreview: !!minimalPreview,
      optedOut: false,
      active: true,
      nextOccurrence: computeNextOccurrenceIso(time, timezone, startDate, endDate),
      createdAt: now
    });
  });

  app.patch('/api/reminders/:id', authOnly, (req, res) => {
    const old = db.prepare('SELECT * FROM reminders WHERE id=? AND user_id=?').get(req.params.id, req.user.sub);
    if (!old) return res.status(404).json({ error: 'Reminder not found' });
    const active = req.body?.active === undefined ? old.active : (req.body.active ? 1 : 0);
    const time = req.body?.time === undefined ? old.time : str(req.body.time, 5);
    const quietStart = req.body?.quietStart === undefined ? old.quiet_start : str(req.body.quietStart, 5);
    const quietEnd = req.body?.quietEnd === undefined ? old.quiet_end : str(req.body.quietEnd, 5);
    if (!validTime(time)) return res.status(400).json({ error: 'Invalid time.' });
    if ((quietStart && !validTime(quietStart)) || (quietEnd && !validTime(quietEnd))) {
      return res.status(400).json({ error: 'Invalid quiet hours format.' });
    }

    db.prepare('UPDATE reminders SET active=?,time=?,quiet_start=?,quiet_end=?,updated_at=? WHERE id=? AND user_id=?')
      .run(active, time, quietStart, quietEnd, isoNow(), old.id, req.user.sub);

    let cancelledJobs = 0;
    if (!active) {
      cancelledJobs = cancelPendingDeliveries(old.id);
    }
    logAudit({ actorId: req.user.sub, action: 'reminder.updated', targetType: 'reminder', targetId: old.id, metadata: { active: !!active, time, cancelledJobs } });
    res.json({
      ok: true,
      id: old.id,
      active: !!active,
      time,
      quietStart,
      quietEnd,
      cancelledPendingOccurrences: cancelledJobs,
      nextOccurrence: active ? computeNextOccurrenceIso(time, old.timezone, old.start_date, old.end_date) : null
    });
  });

  app.delete('/api/reminders/:id', authOnly, (req, res) => {
    const existing = db.prepare('SELECT id FROM reminders WHERE id=? AND user_id=?').get(req.params.id, req.user.sub);
    if (!existing) return res.status(404).json({ error: 'Reminder not found' });
    cancelPendingDeliveries(existing.id);
    db.prepare('DELETE FROM reminders WHERE id=? AND user_id=?').run(req.params.id, req.user.sub);
    logAudit({ actorId: req.user.sub, action: 'reminder.deleted', targetType: 'reminder', targetId: req.params.id });
    res.json({ ok: true });
  });

  app.post('/api/reminders/opt-out', authOnly, (req, res) => {
    const channel = ['email', 'sms', 'all'].includes(req.body?.channel) ? req.body.channel : 'all';
    const now = isoNow();
    const rows = channel === 'all'
      ? db.prepare('SELECT id FROM reminders WHERE user_id = ?').all(req.user.sub)
      : db.prepare('SELECT id FROM reminders WHERE user_id = ? AND channel = ?').all(req.user.sub, channel);
    for (const r of rows) {
      cancelPendingDeliveries(r.id);
    }
    const result = channel === 'all'
      ? db.prepare('UPDATE reminders SET opted_out = 1, active = 0, updated_at = ? WHERE user_id = ?').run(now, req.user.sub)
      : db.prepare('UPDATE reminders SET opted_out = 1, active = 0, updated_at = ? WHERE user_id = ? AND channel = ?').run(now, req.user.sub, channel);
    logAudit({ actorId: req.user.sub, action: 'reminder.opted_out', targetType: 'reminder', metadata: { channel, count: result.changes } });
    res.json({ ok: true, channel, pausedReminders: result.changes, message: `Opted out of ${channel} reminders and cancelled pending occurrences.` });
  });

  app.post('/api/reminders/opt-in', authOnly, (req, res) => {
    const channel = ['email', 'sms', 'all'].includes(req.body?.channel) ? req.body.channel : 'all';
    const now = isoNow();
    const result = channel === 'all'
      ? db.prepare('UPDATE reminders SET opted_out = 0, active = 1, updated_at = ? WHERE user_id = ?').run(now, req.user.sub)
      : db.prepare('UPDATE reminders SET opted_out = 0, active = 1, updated_at = ? WHERE user_id = ? AND channel = ?').run(now, req.user.sub, channel);
    logAudit({ actorId: req.user.sub, action: 'reminder.opted_in', targetType: 'reminder', metadata: { channel, count: result.changes } });
    res.json({ ok: true, channel, resumedReminders: result.changes });
  });

  app.get('/api/reminders/:id/deliveries', authOnly, (req, res) => {
    const owned = db.prepare('SELECT id FROM reminders WHERE id=? AND user_id=?').get(req.params.id, req.user.sub);
    if (!owned) return res.status(404).json({ error: 'Reminder not found' });
    res.json(
      db.prepare('SELECT id,occurrence_key,status,attempts,provider_id,error,scheduled_at,updated_at FROM reminder_deliveries WHERE reminder_id=? ORDER BY scheduled_at DESC LIMIT 50')
        .all(owned.id)
    );
  });

  app.post('/api/reminders/test', authOnly, async (req, res) => {
    const channel = req.body?.channel === 'sms' ? 'sms' : 'email';
    const email = str(req.body?.email, 254);
    const phone = str(req.body?.phone, 24);
    const u = db.prepare('SELECT email,email_verified,phone,phone_verified,is_guest FROM users WHERE id=?').get(req.user.sub);

    if (u && !u.is_guest) {
      if (channel === 'email' && (!u.email_verified || !u.email || email.toLowerCase() !== u.email.toLowerCase())) {
        return res.status(403).json({
          code: 'UNVERIFIED_DESTINATION',
          error: 'For registered accounts, test emails may only be sent to your verified email. Verify your email first.'
        });
      }
      if (channel === 'sms' && (!u.phone_verified || !u.phone || phone !== u.phone)) {
        return res.status(403).json({
          code: 'UNVERIFIED_DESTINATION',
          error: 'For registered accounts, test SMS may only be sent to your verified phone. Verify your phone first.'
        });
      }
    }

    try {
      await deliver({ label: 'VYORA test reminder', time: 'now', channel, email, phone, minimal_preview: 1 });
      res.json({
        ok: true,
        message: 'Provider accepted the test message. Delivery may depend on recipient/provider filtering.'
      });
    } catch (e) {
      res.status(503).json({ error: e.message || 'Test delivery failed.' });
    }
  });
}
