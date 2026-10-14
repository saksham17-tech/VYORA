/**
 * Stage 3 + Stage 9 — Durable-style reminder scheduler
 * - Recovers missed occurrences within a lookback window (default 2h)
 * - Uses occurrence_key + UNIQUE constraint for idempotency
 * - Respects user quiet hours (`quiet_start`, `quiet_end`) and opt-out (`opted_out = 1`)
 * - Computes next scheduled occurrence timestamp (`computeNextOccurrenceIso`)
 * - Cancels pending occurrences when a reminder is paused or deleted
 */
import cron from 'node-cron';
import { db, isoNow } from '../db.js';
import crypto from 'node:crypto';

const id = () => crypto.randomUUID();
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);

const MAX_ATTEMPTS = 3;
const LOOKBACK_MINUTES = 120;

export function localParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === '24' ? '00' : parts.hour,
    minute: parts.minute
  };
}

export function isWithinQuietHours(clockHHMM, quietStart, quietEnd) {
  if (!quietStart || !quietEnd || quietStart === quietEnd) return false;
  const toMin = (s) => {
    const [h, m] = String(s).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const cur = toMin(clockHHMM);
  const start = toMin(quietStart);
  const end = toMin(quietEnd);
  if (start < end) {
    return cur >= start && cur < end;
  }
  // Wraps across midnight (e.g. 22:00 to 07:00)
  return cur >= start || cur < end;
}

export function computeNextOccurrenceIso(time, timezone = 'Asia/Kolkata', startDate = null, endDate = null, now = new Date()) {
  try {
    const p = localParts(now, timezone);
    const todayStr = `${p.year}-${p.month}-${p.day}`;
    const [sh, sm] = String(time || '08:00').split(':').map(Number);
    const curMin = Number(p.hour) * 60 + Number(p.minute);
    const schedMin = (sh || 0) * 60 + (sm || 0);

    let targetDay = todayStr;
    if (curMin >= schedMin) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tp = localParts(tomorrow, timezone);
      targetDay = `${tp.year}-${tp.month}-${tp.day}`;
    }
    if (startDate && targetDay < startDate) targetDay = startDate;
    if (endDate && targetDay > endDate) return null;
    return `${targetDay}T${String(time).padStart(5, '0')}:00 (${timezone})`;
  } catch {
    return null;
  }
}

export function cancelPendingDeliveries(reminderId) {
  const res = db.prepare(
    `UPDATE reminder_deliveries
     SET status = 'cancelled', updated_at = ?
     WHERE reminder_id = ? AND status IN ('pending', 'failed')`
  ).run(isoNow(), reminderId);
  return res.changes;
}

export function isDue(now, reminder) {
  if (reminder.opted_out) return null;
  let p;
  try {
    p = localParts(now, reminder.timezone);
  } catch {
    return null;
  }
  const day = `${p.year}-${p.month}-${p.day}`;
  const clock = `${p.hour}:${p.minute}`;
  const key = `${day}:${reminder.time}`;

  if (reminder.start_date && day < reminder.start_date) return null;
  if (reminder.end_date && day > reminder.end_date) return null;

  // Suppress outbound sends during configured quiet hours
  if (reminder.quiet_start && reminder.quiet_end && isWithinQuietHours(clock, reminder.quiet_start, reminder.quiet_end)) {
    return null;
  }

  const [sh, sm] = reminder.time.split(':').map(Number);
  const scheduledMin = sh * 60 + sm;
  const currentMin = Number(p.hour) * 60 + Number(p.minute);

  if (currentMin >= scheduledMin && (currentMin - scheduledMin) <= LOOKBACK_MINUTES) {
    return { key, day, clock };
  }
  if (currentMin < scheduledMin) {
    const minutesPastMidnight = currentMin;
    const minutesFromScheduleToMidnight = 24 * 60 - scheduledMin;
    if (minutesPastMidnight + minutesFromScheduleToMidnight <= LOOKBACK_MINUTES) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      let yp;
      try { yp = localParts(yesterday, reminder.timezone); } catch { return null; }
      const yday = `${yp.year}-${yp.month}-${yp.day}`;
      return { key: `${yday}:${reminder.time}`, day: yday, clock };
    }
  }
  return null;
}

export function startReminderScheduler({ deliver }) {
  let running = false;

  async function tick(customNow = null) {
    if (running) return;
    running = true;
    const now = customNow instanceof Date ? customNow : new Date();
    try {
      const reminders = db.prepare(
        `SELECT * FROM reminders WHERE active = 1 AND COALESCE(opted_out, 0) = 0 AND channel IN ('email', 'sms')`
      ).all();

      for (const r of reminders) {
        const due = isDue(now, r);
        if (!due) continue;

        const { key } = due;

        const deliveryId = id();
        try {
          db.prepare(
            `INSERT OR IGNORE INTO reminder_deliveries
             (id, reminder_id, occurrence_key, status, attempts, scheduled_at, updated_at)
             VALUES (?, ?, ?, 'pending', 0, ?, ?)`
          ).run(deliveryId, r.id, key, now.toISOString(), isoNow());
        } catch {
          continue;
        }

        const existing = db.prepare(
          `SELECT * FROM reminder_deliveries WHERE reminder_id = ? AND occurrence_key = ?`
        ).get(r.id, key);

        if (!existing) continue;
        if (['sent', 'cancelled'].includes(existing.status)) continue;
        if (existing.attempts >= MAX_ATTEMPTS) continue;

        db.prepare(
          `UPDATE reminder_deliveries SET status = 'processing', attempts = attempts + 1, updated_at = ? WHERE id = ?`
        ).run(isoNow(), existing.id);

        try {
          const result = await deliver(r);
          db.prepare(
            `UPDATE reminder_deliveries SET status = 'sent', provider_id = ?, error = NULL, updated_at = ? WHERE id = ?`
          ).run(result.providerId || null, isoNow(), existing.id);
          db.prepare(
            `UPDATE reminders SET last_occurrence_key = ?, updated_at = ? WHERE id = ?`
          ).run(key, isoNow(), r.id);
        } catch (err) {
          const status = existing.attempts + 1 >= MAX_ATTEMPTS ? 'failed_permanent' : 'failed';
          db.prepare(
            `UPDATE reminder_deliveries SET status = ?, error = ?, updated_at = ? WHERE id = ?`
          ).run(status, str(err.message, 500), isoNow(), existing.id);
        }
      }

      // Bounded retry of recent transient failures
      const retryCutoff = new Date(now.getTime() - LOOKBACK_MINUTES * 60 * 1000).toISOString();
      const retries = db.prepare(
        `SELECT d.id AS delivery_id, d.attempts, d.occurrence_key, r.*
         FROM reminder_deliveries d
         JOIN reminders r ON r.id = d.reminder_id
         WHERE d.status = 'failed' AND d.attempts < ? AND r.active = 1 AND COALESCE(r.opted_out, 0) = 0 AND d.scheduled_at >= ?`
      ).all(MAX_ATTEMPTS, retryCutoff);

      for (const row of retries) {
        db.prepare(
          `UPDATE reminder_deliveries SET status = 'processing', attempts = attempts + 1, updated_at = ? WHERE id = ?`
        ).run(isoNow(), row.delivery_id);
        try {
          const result = await deliver(row);
          db.prepare(
            `UPDATE reminder_deliveries SET status = 'sent', provider_id = ?, error = NULL, updated_at = ? WHERE id = ?`
          ).run(result.providerId || null, isoNow(), row.delivery_id);
          db.prepare(
            `UPDATE reminders SET last_occurrence_key = ?, updated_at = ? WHERE id = ?`
          ).run(row.occurrence_key, isoNow(), row.id);
        } catch (err) {
          const status = row.attempts + 1 >= MAX_ATTEMPTS ? 'failed_permanent' : 'failed';
          db.prepare(
            `UPDATE reminder_deliveries SET status = ?, error = ?, updated_at = ? WHERE id = ?`
          ).run(status, str(err.message, 500), isoNow(), row.delivery_id);
        }
      }
    } catch (e) {
      console.error('[reminder] scheduler tick error', e.message);
    } finally {
      running = false;
    }
  }

  const task = cron.schedule('* * * * *', () => tick(), { timezone: 'UTC' });
  console.log('[reminder] scheduler started (lookback=%dm, maxAttempts=%d)', LOOKBACK_MINUTES, MAX_ATTEMPTS);

  return { tick, stop: () => task.stop() };
}
