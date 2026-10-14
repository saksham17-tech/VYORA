# VYORA Stage 6 — Modular Architecture Split

**Built on:** Stage 5  
**Goal:** Split the monolithic `server.js` into PRD-aligned modules (middleware, routes, services, utils) while keeping all behaviour intact.

---

## New structure

```
backend/src/
├── server.js                 # Bootstrap only (~60 lines)
├── db.js / db-init.js
├── middleware/
│   └── auth.js               # JWT verify + revocation check
├── routes/
│   ├── health.js             # GET /api/health
│   └── api.js                # All other API routes + scheduler start
├── services/
│   ├── aiSafety.js           # Stage 5
│   ├── reminderScheduler.js  # Stage 3
│   └── providers.js          # Email / SMS / deliver
└── utils/
    └── helpers.js            # id, str, validEmail, validTime, json
```

---

## What moved where

| Concern | Module |
|---------|--------|
| JWT secret + auth middleware | `middleware/auth.js` |
| Guest session, register, login, logout, link-guest | `routes/api.js` |
| Chat + AI safety wiring | `routes/api.js` (uses `services/aiSafety.js`) |
| Plans, workouts, vitals, OVULA, community, partners, trainers, places, export, account | `routes/api.js` |
| Reminder CRUD + test | `routes/api.js` |
| Reminder scheduler start | end of `registerApiRoutes` → `services/reminderScheduler.js` |
| SMTP / Twilio / deliver | `services/providers.js` |
| Shared helpers | `utils/helpers.js` |
| Helmet, CORS, rate limit, static files, listen | `server.js` |

---

## Behaviour
- No intentional API behaviour changes in Stage 6.
- All Stage 1–5 security and safety features remain active.
- AI safety tests still pass (12/12).

---

## Future splits (optional)
`routes/api.js` can be further divided into:
- `routes/session.js` / `auth.js`
- `routes/chat.js`
- `routes/reminders.js`
- `routes/community.js`
- `routes/partners.js`
- `routes/pro.js`
- `routes/training.js`
- `routes/data.js`

The current extraction already matches the PRD “suggested service boundaries” at the module level.

---

## How to run

```bash
npm install
npm test
npm start
```

Same as previous stages — guest session, real auth, reminders, AI chat all work through the new bootstrap.
