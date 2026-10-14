# VYORA Stage 1 — Foundation & Critical Security Fixes

**Date:** 2026-10-14  
**Status:** Applied on top of original `VYORA_fullstack_v2`  
**Goal:** Close the highest-risk gaps identified in the PRD and production review without breaking the working demo.

---

## Changes in this stage

### 1. Content-Security-Policy enabled (P0)
- **Before:** `helmet({ contentSecurityPolicy: false })` — CSP completely disabled.
- **After:** Strict CSP with `useDefaults: true` plus explicit directives:
  - `default-src 'self'`
  - `script-src 'self'`
  - `style-src 'self' 'unsafe-inline'` (required by current inline styles)
  - `img-src 'self' data: https:`
  - `connect-src 'self'`
  - `object-src 'none'`, `frame-ancestors 'none'`, etc.
- **Location:** `backend/src/server.js` (helmet configuration)

### 2. Token revocation on account deletion (P0)
- **Before:** `DELETE /api/account` removed the user row but the 30-day JWT remained valid → subsequent requests could produce 500s or unexpected behaviour.
- **After:**
  - New table `revoked_tokens (jti, user_id, revoked_at, reason)`.
  - Guest tokens now carry a unique `jti`.
  - Auth middleware checks `revoked_tokens` before accepting a token.
  - Account deletion inserts the current `jti` into the revocation table, then deletes the user.
- **Locations:**
  - `database/schema.sql` — new table + index
  - `backend/src/server.js` — auth middleware, guest session issuance, account-delete handler

### 3. Production folder skeleton
- Created the structure recommended in the PRD / production doc:
  ```
  backend/src/
  ├── middleware/
  ├── routes/
  ├── services/
  └── utils/
  ```
- Full route split is deferred to a later stage so the demo continues to run from the existing monolithic `server.js`.

### 4. Documentation
- This changelog.
- Original `docs/PRODUCTION_CHANGES.md` remains the full prioritised backlog.

---

## Still open (intentionally not changed in Stage 1)

| Item | Why deferred |
|------|--------------|
| Real email/password accounts | Requires full auth flow + UI changes (Stage 2) |
| Verified email/phone for reminders | Depends on account system |
| Durable reminder queue | Needs Redis/BullMQ or equivalent (Stage 3) |
| Full server.js → routes split | Large mechanical change; done after auth stabilises |
| innerHTML → safe DOM | Frontend audit; can be done incrementally |
| PostgreSQL migration | Stage 4 |
| AI safety gold-test suite | Later stage |

---

## How to verify Stage 1

```bash
npm install
npm test
npm start
```

1. Open the app → guest session is created (token now contains `jti`).
2. Call `DELETE /api/account` with the token → subsequent requests with the same token return 401 “Session has been revoked.”
3. Response headers include Content-Security-Policy.
4. Existing core flows (vitals, plans, trainers, community) continue to work.

---

## Next stage preview (Stage 2)

- Real registration / login endpoints (email + password using already-installed `bcryptjs`)
- Verified contact channels
- Migrate guest data on first login
- Stricter reminder destination checks
