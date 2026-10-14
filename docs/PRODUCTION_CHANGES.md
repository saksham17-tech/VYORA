# VYORA Full-Stack v2 — Production Changes, Modifications & Corrections

**Document purpose:** Single source of truth for everything required to take this codebase from a credible demo/prototype to a public production deployment.

**Current state summary:**  
Solid demo. Server starts cleanly, tests pass, core APIs work, secrets stay on the backend, per-user isolation via JWT, careful reminder consent language, and honest README about gaps.  
**Not production-ready.** Guest-only identity, SMS/email abuse surface, disabled CSP + innerHTML usage, monolithic server, thin tests, and no durable job system.

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0**   | Must fix before any public traffic (security / data-loss / abuse) |
| **P1**   | Required for real users and reliable operation |
| **P2**   | Strongly recommended for maintainability & scale |
| **P3**   | Nice-to-have / polish |

---

## 1. Security & Privacy (P0)

### 1.1 Unverified email / SMS destinations (Critical abuse risk)
**Problem**  
`POST /api/reminders` and `POST /api/reminders/test` accept any email or phone the client supplies. Only a client-side checkbox is required for “consent”. Rate limit is 120 req/min. This enables spam and SMS cost abuse.

**Required changes**
- Add verified contact channels to the user record (email + phone).
- Only allow a reminder channel after the user has verified ownership of that address/number (OTP / magic link).
- Restrict `/api/reminders/test` to the user’s own verified contacts (or remove the endpoint in production).
- Enforce stricter rate limits on reminder creation and test endpoints (e.g. 5/hour per user).
- Add SMS STOP / opt-out handling (Twilio inbound webhook) and store opt-out status.
- Never send to an address that has not completed verification.

### 1.2 Account deletion does not invalidate JWT
**Problem**  
`DELETE /api/account` removes the user row but the 30-day JWT remains valid. Subsequent requests fail with foreign-key / 500 instead of a clean 401.

**Required changes**
- Maintain a token blacklist / revoked-token table (or short-lived access tokens + refresh tokens).
- On account deletion, revoke all tokens for that `user_id`.
- Auth middleware must reject revoked tokens with 401.
- Optionally shorten guest token lifetime (e.g. 7 days) until real accounts exist.

### 1.3 Guest-only identity for sensitive data
**Problem**  
Menstrual (OVULA), vitals, medication reminders and health plans live behind a JWT stored in `localStorage`. Clearing browser data or switching devices permanently loses access. Schema already has `email` / `password_hash` columns that are never used.

**Required changes**
- Implement real registration / login (email + password or passkeys / magic link).
- Use `bcryptjs` (already installed) or Argon2 for password hashing.
- Add email verification, password reset, and optional MFA.
- Migrate guest data to a real account on first login/register (account linking).
- Keep guest mode only for anonymous browsing; require account for health data, reminders, and OVULA.

### 1.4 Content-Security-Policy disabled + innerHTML usage
**Problem**  
`helmet({ contentSecurityPolicy: false })`. Multiple frontend files use `innerHTML` (planner.js ×5, interactions.js, workout.js, ovula.js, locator.js). If AI output or user-generated content ever reaches those spots, XSS is possible.

**Required changes**
- Enable a strict CSP via Helmet (default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' only if needed; connect-src restricted; etc.).
- Replace all `innerHTML` with `textContent` / `createElement` / safe DOM APIs, or a trusted sanitizer (DOMPurify) when HTML is intentionally required.
- Audit every place that renders AI responses or community post bodies.
- Add `X-Content-Type-Options`, `Referrer-Policy`, and frame-ancestors restrictions.

### 1.5 Additional security hardening
- Add CSRF protection once real session cookies or stateful auth appear (currently pure Bearer JWT is less CSRF-prone, but still review).
- Enforce HTTPS-only in production (HSTS).
- Validate and sanitize all media URLs more strictly (already requires HTTPS; add domain allow-list if possible).
- Add request-size limits and body validation library (zod / joi) instead of ad-hoc `str()` helpers.
- Log security events (failed auth, rate-limit hits, reminder creation) without logging PII.

---

## 2. Correctness & Robustness (P0 / P1)

### 2.1 Missed reminders are never recovered
**Problem**  
Cron runs every minute and matches exact `HH:MM`. If the process is down or restarting at that minute, the occurrence is silently skipped.

**Required changes**
- Move to a durable job queue (BullMQ + Redis, or SQLite-backed queue with claim/lease).
- On each tick, select all active reminders whose next due time is ≤ now and whose occurrence key has not been delivered.
- Support bounded automatic retries + dead-letter table.
- Persist delivery status with provider message IDs and webhooks (Twilio / SMTP).
- Add quiet hours and user-configurable “do not disturb”.

### 2.2 Duplicate comments fail hard
**Problem**  
`UNIQUE(post_id, user_id, kind, body)` causes a unique-constraint error that surfaces as 500.

**Required changes**
- Catch the unique violation and return 409 Conflict with a clear message, or treat identical body as idempotent success.
- Consider removing the unique constraint on body if intentional re-posts of the same text are allowed.

### 2.3 Browser reminder channel is dead code
**Problem**  
API accepts `channel: "browser"` then always returns 400. Frontend may still offer the option.

**Required changes**
- Either implement Web Push (service worker + VAPID) or remove the channel completely from API and UI.
- Prefer native browser Notification API for local-only reminders (no server round-trip).

### 2.4 Account deletion error handling
- After user row is deleted, any in-flight requests should receive 401, not 500.
- Cascade is already correct via `ON DELETE CASCADE`; ensure middleware order is correct.

---

## 3. Architecture & Maintainability (P1 / P2)

### 3.1 Monolithic server.js (~32 KB one-liners)
**Problem**  
All routes, auth, Gemini, cron, email/SMS live in a single dense file. Empty `backend/src/routes/` folder indicates the intended split was never finished.

**Required production structure**
```
backend/src/
├── server.js              # bootstrap only
├── config.js              # env validation
├── db.js / db-init.js
├── middleware/
│   ├── auth.js
│   ├── rateLimit.js
│   └── errorHandler.js
├── routes/
│   ├── session.js
│   ├── profile.js
│   ├── chat.js
│   ├── plans.js
│   ├── workouts.js
│   ├── reminders.js
│   ├── vitals.js
│   ├── ovula.js
│   ├── community.js
│   ├── partners.js
│   ├── pro.js
│   ├── training.js
│   └── data.js            # export + account delete
├── services/
│   ├── gemini.js
│   ├── mailer.js
│   ├── sms.js
│   └── reminderScheduler.js
└── utils/
    ├── id.js
    ├── validators.js
    └── time.js
```

### 3.2 Unused / leftover pieces
- Remove or implement `bcryptjs` usage.
- Populate or drop unused `email` / `password_hash` columns until real auth is added.
- Delete empty routes folder or populate it as above.
- Remove dead “browser” channel code paths.

### 3.3 Tests are thin
**Current:** three tests that only grep source files for strings.

**Required**
- API integration tests (supertest) for every major route.
- Auth middleware tests (valid / expired / revoked tokens).
- Reminder scheduler unit + integration tests (timezones, DST, missed recovery).
- Input validation tests.
- Security regression tests (unverified destination rejected, CSP headers present).

### 3.4 Database
- SQLite + single Render disk is acceptable for a low-traffic demo.
- For production: migrate to managed PostgreSQL (or keep SQLite only if single-instance + durable volume + regular encrypted backups).
- Add migration tooling (node-pg-migrate / Knex / Drizzle) instead of raw `schema.sql` on every start.
- Add automated backups + restore drills.

---

## 4. Feature Completeness Gaps (already listed in README — confirmed)

| Gap | Status | Production action |
|-----|--------|-------------------|
| Real login / accounts | Missing | Implement (P0) |
| Live maps / places | Missing | Integrate licensed provider or keep “saved places only” |
| Apple Health / Health Connect | Missing | Native bridge required; do not claim until live |
| Media upload / moderation | Links only | Object storage + moderation before public community |
| Community report / moderation | Comment says “reports-ready” but no endpoint | Add report endpoint + admin queue |
| Durable reminder worker | In-process cron | Move to queue (P0) |
| Delivery webhooks | Missing | Twilio + SMTP receipt handling |
| Indian DPDP / health data compliance | Not reviewed | Legal review required |

---

## 5. Deployment & Operations (P1)

### 5.1 Current good points
- Dockerfile present.
- `render.yaml` with persistent disk.
- Production check that `JWT_SECRET` is long and non-default.
- Health endpoint exists (`/api/health`).

### 5.2 Required additions
- Environment validation on boot (fail fast if critical vars missing).
- Structured logging (pino / winston) with request IDs; never log secrets or full health payloads.
- Metrics / alerting (failed deliveries, 5xx rate, queue depth).
- Graceful shutdown (drain cron, close DB).
- Separate staging environment.
- Secrets management (Render secrets / Doppler / Vault); never commit `.env`.
- Backup job for SQLite (or switch to Postgres managed backups).
- Rate-limit and WAF rules at the edge.

### 5.3 Recommended env for production
```
NODE_ENV=production
JWT_SECRET=<32+ char random>
DATABASE_PATH=... or DATABASE_URL=postgres://...
CORS_ORIGIN=https://your-domain.com
GEMINI_API_KEY=...
SMTP_* / TWILIO_* fully configured
APP_URL=https://your-domain.com
```

---

## 6. Frontend Production Polish (P2)

- Replace remaining `innerHTML` (see 1.4).
- Ensure all AI-rendered content is escaped.
- Add offline / error states for network failures.
- Accessibility audit (keyboard, ARIA, reduced-motion already partially handled).
- Service worker only if Web Push is implemented.
- Bundle / minify JS for production (currently plain files; consider Vite or esbuild if size grows).

---

## 7. Recommended Implementation Order

1. **P0 Security**  
   - Destination verification for reminders  
   - Token revocation on account delete  
   - Enable CSP + sanitize / remove innerHTML  
   - Real account system (or at least block sensitive data behind verified identity)

2. **P0 Reliability**  
   - Durable reminder queue + missed-occurrence recovery  
   - Fix duplicate-comment 500  
   - Remove or implement browser channel

3. **P1 Structure**  
   - Split `server.js` into routes + services  
   - Real API tests  
   - Environment validation & structured logging

4. **P1 Data / Compliance**  
   - PostgreSQL migration path  
   - Backups + retention policy  
   - Privacy policy, consent records, data export/delete already present — extend for verified accounts

5. **P2 / P3**  
   - Moderation, maps, health-platform bridges, media uploads, performance, accessibility refinements

---

## 8. What stays good (do not regress)

- Backend-only Gemini key.
- Per-user query scoping by `user_id` from JWT.
- Explicit consent checkbox language for reminders.
- AI system prompts that refuse diagnosis / prescribing and redirect urgent symptoms.
- Honest README that does not claim non-existent integrations.
- HTTPS-only media URL check.
- Rate limiting present (tighten further).
- Export + account-delete endpoints already exist.

---

## 9. Quick checklist before first public launch

- [ ] Real accounts + verified email/phone
- [ ] Reminder destinations only use verified contacts
- [ ] Token revocation on logout / account delete
- [ ] CSP enabled, no unsafe innerHTML of untrusted content
- [ ] Durable reminder worker with retry & monitoring
- [ ] PostgreSQL (or proven durable SQLite + backups)
- [ ] Automated API + scheduler tests
- [ ] Legal review of health / menstrual data handling (India DPDP + any other jurisdictions)
- [ ] Penetration test / security review
- [ ] Staging environment + rollback plan

---

*Generated from full review of VYORA_fullstack_v2 (README, schema, server.js, all frontend modules, tests, Docker, Render config).*  
*This document is the authoritative list of required production changes.*
