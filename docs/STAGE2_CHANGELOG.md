# VYORA Stage 2 — Real Auth Foundation

**Built on:** Stage 1  
**Goal:** Introduce real email/password accounts while keeping the existing guest demo fully working.

---

## What was added

### 1. Schema enhancements
- `users` table now has:
  - `email_verified` (0/1)
  - `phone`
  - `phone_verified` (0/1)
- New table `verification_tokens` (ready for email/SMS OTP flows in a later stage)
- Existing `revoked_tokens` retained from Stage 1

**File:** `database/schema.sql`

### 2. Auth API endpoints
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/register` | Create account (email + password ≥ 8 chars). Issues JWT with `jti`. |
| POST | `/api/auth/login` | Login with email/password. |
| POST | `/api/auth/logout` | Revokes current token (`jti` → `revoked_tokens`). |
| POST | `/api/auth/link-guest` | Convert current guest session into a real account while **keeping all existing data**. |

- Passwords hashed with `bcryptjs` (already in `package.json`, previously unused).
- Tokens continue to use `jti` + revocation check from Stage 1.
- Guest session endpoint still works exactly as before.

**File:** `backend/src/server.js`

### 3. `/api/me` enriched
Returns `emailVerified`, `phone`, `phoneVerified` in addition to previous fields.

### 4. Reminder test endpoint tightened
For **registered** (non-guest) accounts:
- Test email can only go to the user’s own email once verified.
- Test SMS can only go to the user’s own phone once verified.
- Guests retain the previous demo behaviour (still rate-limited).

Full “only verified destinations” enforcement for production reminders will land when the verification OTP flow is completed.

### 5. Frontend API client
New methods on `window.VyoraAPI`:
- `register(email, password, displayName)`
- `login(email, password)`
- `logout()`
- `linkGuest(email, password, displayName)`

Existing guest auto-session behaviour is unchanged. No UI screens were added in this stage (API-ready only).

**File:** `frontend/public/js/api.js`

---

## How to try Stage 2

```bash
npm install
npm start
```

**Register**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"secret123","displayName":"Test User"}'
```

**Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"secret123"}'
```

**Link existing guest data**
1. Open the app (guest session is created).
2. Call `VyoraAPI.linkGuest('you@example.com', 'secret123', 'My Name')` from the browser console.
3. All previous vitals/plans/reminders stay under the same user id.

**Logout**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <token>"
```
Subsequent use of the same token returns 401 “Session has been revoked.”

---

## Still open (next stages)

| Item | Planned stage |
|------|---------------|
| Email verification OTP flow | Stage 2.1 / 3 |
| Phone verification + Twilio OTP | Stage 3 |
| Full “verified destination only” for all reminders | After verification |
| Auth UI screens (login/register forms) | Later UI stage |
| Durable reminder queue | Stage 3 |
| PostgreSQL migration | Stage 4 |
| Password reset / MFA | Later |

---

## Safety notes
- Passwords never leave the server in clear text.
- JWT still required for every user-data route.
- Account deletion continues to revoke the current token.
- Guest mode remains available for demo; real accounts are optional for now.
