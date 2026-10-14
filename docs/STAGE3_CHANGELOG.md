# VYORA Stage 3 — Reminder Reliability

**Built on:** Stage 2  
**Goal:** Recover missed reminder occurrences, strengthen idempotency, enforce verified destinations for registered users, and move the scheduler into a dedicated service (queue-ready).

---

## Problems fixed

| Problem | Stage 3 solution |
|---------|------------------|
| Exact-minute matching only → silent miss if server was down | **Lookback window (2 hours)**. Any due occurrence whose clock time has passed (within lookback) is claimed and delivered. |
| No clear separation of scheduler logic | Extracted to `backend/src/services/reminderScheduler.js` |
| Weak destination checks for registered users | Registered accounts may only schedule / test to their **verified** email or phone |
| Retry logic mixed into route file | Bounded retries (max 3 attempts) live inside the scheduler service |

---

## Technical details

### New service: `backend/src/services/reminderScheduler.js`
- Runs every minute via `node-cron`.
- For each active email/SMS reminder:
  1. Computes whether the scheduled time (in the reminder’s timezone) has already passed **and** is still within the 2-hour lookback.
  2. Claims the occurrence with `INSERT OR IGNORE` into `reminder_deliveries` using the unique `(reminder_id, occurrence_key)` key → **idempotent**.
  3. Attempts delivery; on success marks `sent` and updates `last_occurrence_key`.
  4. On failure marks `failed` (or `failed_permanent` after max attempts).
- Separate bounded retry pass for recent transient failures.
- Handles midnight wrap-around for late recovery.

### Verified-destination enforcement
- **Reminder creation** (`POST /api/reminders`): non-guest users can only target their verified email / phone.
- **Test endpoint** (from Stage 2): already restricted; remains in force.
- Guests retain previous demo behaviour (still require consent + rate limits).

### Still in-process
The scheduler still runs inside the web process. This is acceptable for a single-instance demo with a durable disk.  
**Production next step** (documented in PRODUCTION_CHANGES.md): move to a real job queue (BullMQ/Redis or equivalent) so delivery survives process restarts and horizontal scaling.

---

## How to verify

```bash
npm install
npm start
```

1. Create a reminder for 1–2 minutes from now (use your local timezone).
2. Stop the server for a couple of minutes past the scheduled time, then restart.
3. Within the 2-hour lookback the occurrence should still be claimed and (if SMTP/Twilio configured) delivered. Check `reminder_deliveries` table or the delivery history endpoint.
4. Registered user trying to schedule a reminder to a different email than their verified one → 403.

---

## Files touched
- `backend/src/services/reminderScheduler.js` — **new**
- `backend/src/server.js` — imports service, removes old inline cron, tighter reminder creation
- `docs/STAGE3_CHANGELOG.md` — this file
- `README.md` — stage banner

---

## Next stage preview (Stage 4)
- Schema evolution notes + PostgreSQL migration path
- Stronger data-model alignment with the PRD entities
- Migration tooling skeleton
