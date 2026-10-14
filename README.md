# VYORA — Voice-First AI Fitness, Nutrition & OVULA Women's Wellness Platform

> **Version 2.0.0** · Aligned to **VYORA Product Requirements Document (PRD v2.0 — Prompts 1–20 & Appendices A–C)**  
> **Architecture:** Node.js 20+ · Express · SQLite (`better-sqlite3`) / PostgreSQL dual-adapter · Vanilla JS Command-Deck Frontend

VYORA is a personalized, voice-first fitness and transformation platform designed India-first with internationalization in mind. It pairs an AI fitness copilot, adaptive meal and workout planning, medication/habit reminders, progress tracking, community publishing, offline partner discovery, and human trainer coaching with **OVULA**, a dedicated, cycle-aware women's menstrual wellness companion.

---

## Quick Start: Running the App (No Testing Required)

To run the application immediately on your local machine:

### 1. Prerequisites
- **Node.js 20+** installed (`node -v`)
- **npm** installed (`npm -v`)

### 2. Setup Environment
```bash
# 1. Clone or unzip the repository and enter the directory
cd VYORA_stage14

# 2. Copy the environment template
cp .env.example .env
```

Open `.env` in any text editor and make sure `JWT_SECRET` is set to any random string of 32+ characters:
```env
JWT_SECRET=super-secret-random-key-with-at-least-32-chars-for-dev
PORT=3000
DATABASE_PATH=./database/vyora.sqlite
DEFAULT_TIMEZONE=Asia/Kolkata
```
*(Setting `GEMINI_API_KEY`, SMTP, and Twilio credentials is completely optional. When omitted, VYORA provides deterministic, schema-valid fallbacks and local development preview OTP codes out of the box).*

### 3. Install Dependencies & Start the Server
```bash
# Install packages
npm install

# Start the application server
npm start
```

### 4. Open in Your Browser
Open your browser and navigate to:
```
http://localhost:3000
```
- A guest session will be created automatically.
- Explore the **Build my plan** generator, **Talk to VYORA** voice/text copilot, **OVULA** menstrual companion, **Special Training** console, and **Health Journey** medication reminders right away.

---

## Pushing to GitHub: Files to NOT Add

Before running `git add .` and committing, ensure you **never commit secrets, credentials, or local databases containing personal health records**.

### Files That Must Be Excluded:
1. **`.env` and `.env.*`** (Contains API keys, JWT secrets, SMTP credentials, Twilio tokens. Only commit `.env.example`).
2. **`node_modules/`** (Bulky downloaded dependencies; collaborators should install via `npm install`).
3. **`database/*.sqlite`, `database/*.sqlite-wal`, `database/*.sqlite-shm`** (Local SQLite database files; schema is created automatically via `database/schema.sql` on startup).
4. **`.DS_Store` / `Thumbs.db`** (Operating system thumbnail cache files).
5. **`*.log` / `npm-debug.log*`** (Server execution logs).
6. **`.vscode/` / `.idea/`** (Local editor settings).

### Recommended `.gitignore`
This repository already includes this `.gitignore`:
```gitignore
# Secrets and environment
.env
.env.*
!.env.example

# Node dependencies
node_modules/

# Local databases and WAL logs (never commit SQLite DBs with user health data)
database/*.sqlite
database/*.sqlite-shm
database/*.sqlite-wal
*.sqlite
*.db

# Logs and runtime files
logs/
*.log
npm-debug.log*

# Operating system files
.DS_Store
Thumbs.db

# IDE and editor directories
.idea/
.vscode/
*.swp
*.swo

# Test coverage & build artifacts
coverage/
dist/
build/
```

### Safe Git Push Workflow
```bash
# 1. Verify what git sees before adding
git status

# 2. Stage tracked project files (respecting .gitignore)
git add .

# 3. Double-check that .env and .sqlite are NOT staged:
git status

# 4. Commit and push to GitHub
git commit -m "feat: complete VYORA full-stack platform v2.0 aligned to PRD prompts 1-20"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

---

## Core Product Capabilities (PRD Prompts 1–20)

### 1. VYORA AI Copilot (Voice & Text)
- Persistent entry point with microphone control, spoken output via browser Web Speech synthesis, and text fallback.
- **Stop Audio**: Dedicated `speechSynthesis.cancel()` control to interrupt playback.
- **User-Controlled Memory**: Visible preferences stored per user (`GET/PUT/DELETE /api/chat/memory`) that users can inspect, edit, or wipe anytime.
- **Safety Pre/Post-Check Layer**: Emergency red-flag symptoms (cardiac pain, breathing distress, severe bleeding, fainting) escalate immediately to emergency care advice (Dial 112 in India) without triaging or generating workout plans.
- **Prompt Injection & Medication Guard**: Refuses prompt injection attacks and requests to alter prescribed medication dosages.
- **Report AI Answer**: User controls to flag inaccurate or unsafe AI responses (`POST /api/ai/report`).

### 2. Adaptive Diet & Workout Planning
- **Server-Side Appendix C Contract Validation**: `POST /api/plans/generate` produces structured meal templates, portion guidance, and 7-day workout schedules with safe calorie deficit bounds (`≥1,350 kcal/day`) and explicit uncertainty labels (`±15%` / `±150 kcal`).
- **Indian Regional Nutrition**: Moong dal chilla, paneer tikka, dal palak, jowar/bajra millet rotis, roasted chana/makhana, and tandoori chicken.
- **Conversational Partial Plan Regeneration**: `PATCH /api/plans/:id` allows changing single constraints (e.g. *"no eggs today"*, *"no dairy"*, *"make this an outdoor workout"*, *"shorter 20m session"*, *"my knee hurts"*) by regenerating **only** the affected meal slot or workout day while preserving Lunch, Dinner, and all other days untouched.

### 3. Medication & Habit Reminders (Reliable Lifecycle)
- **Verified Contact Channels**: Registered accounts must verify their email or phone before scheduling outbound reminders (`403 UNVERIFIED_DESTINATION`).
- **Minimal Lock-Screen Previews**: Sends privacy-preserving notices by default so sensitive drug names aren't exposed on shared lock screens.
- **Quiet Hours**: Respects user-defined quiet windows (default 22:00 to 07:00), deferring non-urgent reminders until quiet hours end.
- **2-Hour Lookback Recovery & Idempotency**: Scheduler ticks recover missed reminders after restarts without duplicate sends via `UNIQUE(reminder_id, occurrence_key)`.
- **Opt-Out / STOP**: Users can unsubscribe from SMS/email reminders at any time (`POST /api/reminders/opt-out`).

### 4. OVULA Menstrual Wellness
- **Cycle-Aware General Support**: Phase-based activity tips, cramp-comfort guidance (heat, gentle movement, hydration), and self-care tracking.
- **Medical Safety Boundaries**: Clear disclaimers that cycle estimates are approximate and never a substitute for clinical diagnosis or contraception.
- **Red-Flag Escalation**: Automatically alerts users when unusually heavy bleeding, sudden severe pain, or fainting is logged.
- **Privacy Controls**: Private by default, with purpose-specific consent, dedicated export (`GET /api/ovula/export`), and complete history deletion (`DELETE /api/ovula/data`).

### 5. Special Training (TRAIN / EXPLORE / COMPETE)
- **TRAIN — Performance Predictions**: Enforces a minimum 2-session logging threshold before projecting 5K, 10K, and Half-Marathon times with `±6%–10%` confidence bands. Never fabricates race estimates from sparse data.
- **TRAIN — Progress Comparison & Provenance**: Compares 7-day vs. prior 7-day workload, distinguishes manual logs from imported device metrics, and flags missing periods.
- **TRAIN — Athlete Intelligence**: Summarizes training consistency, rest days, pain-flagged movements, and includes a user toggle to disable gamification (`PATCH /api/profile/gamification`).
- **EXPLORE — Personalized Routes**: Builds routes with distance, terrain, approximate elevation estimates, verified waypoints (water refill, café, viewpoint), and privacy zones (`privacy_zone_km`).
- **COMPETE — Opt-in Leaderboards**: Public display name, anti-abuse caps (`0–400 km/week`), and one-click leave/hide controls.

### 6. VYORA Pro & Partner Network
- **Consent-Based Trainer Sharing**: Users can share selected goals, workouts, and progress with a verified human trainer and revoke access immediately (`POST / DELETE /api/trainers/:id/share`).
- **Trainer Rescheduling & Reviews**: Reschedule pending sessions (`PATCH /api/bookings/:id`) and submit 1–5 star reviews.
- **Partner Aggregated Campaign Analytics**: Offline gyms and studios can track aggregate views, clicks, opt-ins, and redemptions. Sensitive medical or menstrual targeting is strictly blocked (`SENSITIVE_TARGETING_PROHIBITED`), and individual health records are never exposed to partners.
- **Local Discovery Inaccuracy Reporting**: Report outdated hours or addresses on saved places (`POST /api/places/:id/report`) and wipe saved location history.

### 7. Operational Governance & Feature Flags
- **Least-Privilege Admin Console**: Support and moderation overviews (`GET /api/admin/overview`) review community reports, AI safety reports, partner verification, and delivery failures without accessing raw user health records (`healthDataExposedToSupport: false`).
- **Feature Flags Registry**: Toggle `voice_copilot`, `sms_reminders`, `wearable_bridges`, `community_publishing`, and `gamification_default` on the fly (`/api/feature-flags`).
- **Automated Gold-Set Evaluation**: Built-in 10-case evaluation harness (`GET /api/admin/eval/run`) scoring all 9 PRD Prompt 18 categories with a 100% pass rate.

---

## Codebase Architecture

```text
VYORA/
├── backend/
│   ├── src/
│   │   ├── server.js                   # Application bootstrap, CSP, CORS, request context & error handler
│   │   ├── db.js                       # SQLite connection & schema initializer
│   │   ├── db-postgres.js              # PostgreSQL pool & placeholder translation adapter
│   │   ├── middleware/
│   │   │   ├── auth.js                 # JWT verification & revoked_tokens check
│   │   │   └── requestContext.js       # X-Request-Id tracing & safe error middleware
│   │   ├── routes/
│   │   │   ├── api.js                  # Modular route orchestrator
│   │   │   ├── auth.js                 # Guest session, register, login, logout, OTP verify, password reset
│   │   │   ├── profile.js              # /api/me, profile, consents, audit trail, data export, account delete
│   │   │   ├── chat.js                 # AI Copilot chat, bounded memory, AI safety incident reporting
│   │   │   ├── plans.js                # Schema-validated plan generation & partial plan regeneration
│   │   │   ├── workouts.js             # Workout logging, vitals, unit-validated progress entries
│   │   │   ├── reminders.js            # Reminders CRUD, quiet hours, opt-out/STOP, delivery logs
│   │   │   ├── ovula.js                # OVULA cycle entries, red-flag screening, cycle export/delete
│   │   │   ├── community.js            # Community posts, likes, duplicate-safe comments, content reporting
│   │   │   ├── ecosystem.js            # Partners, campaigns, trainers, bookings, challenges, saved places
│   │   │   ├── integrations.js         # Wearable provider connect/disconnect & imported metrics
│   │   │   ├── training.js             # Performance predictions, comparisons, routes, leaderboards
│   │   │   ├── admin.js                # Least-privilege operations, AI reports, feature flags, gold evaluation
│   │   │   └── health.js               # /api/health and /api/health/ready readiness checks
│   │   ├── services/
│   │   │   ├── aiSafety.js             # System policies, red-flag detector, prompt injection guard, intents
│   │   │   ├── auditService.js         # Purpose-specific consents & PII-redacted audit events
│   │   │   ├── evaluationHarness.js    # Automated 10-case Gold-Set AI evaluation scorer
│   │   │   ├── otpService.js           # SHA-256 hashed 6-digit OTP generation & verification
│   │   │   ├── planEngine.js           # Appendix C plan contract validator, Indian meal sets, partial editor
│   │   │   ├── providers.js            # Nodemailer SMTP & Twilio SMS adapters with minimal previews
│   │   │   └── reminderScheduler.js    # Lookback recovery, quiet hours, idempotency, cancel pending
│   │   └── utils/
│   │       └── helpers.js              # id, str, validEmail, validTime, json helpers
│   └── test/                           # 34 automated unit, behavioural & isolation tests
├── database/
│   ├── schema.sql                      # 27-table relational SQLite schema with foreign keys and indexes
│   ├── postgres_schema.sql             # Production PostgreSQL schema (UUIDs, JSONB, TIMESTAMPTZ)
│   └── migrations/                     # Schema alignment scripts
├── docs/
│   ├── PRODUCTION_CHANGES.md           # Prioritized P0–P3 production checklist
│   ├── PRD_20_PROMPTS_TRACEABILITY.md  # Complete Prompt 1–20 traceability matrix
│   ├── STAGE1_CHANGELOG.md ... STAGE14 # Detailed change logs for every engineering stage
│   └── architecture/                   # PostgreSQL migration & cut-over guide
├── frontend/
│   └── public/
│       ├── index.html                  # Accessible command-deck interface
│       ├── styles.css                  # Editorial red/black/white visual system
│       └── js/                         # 15 modular browser JavaScript modules (zero innerHTML)
├── .env.example                        # Template environment variables
├── .gitignore                          # Comprehensive security and build exclusions
├── Dockerfile                          # Container deployment specification
├── render.yaml                         # Production cloud configuration with persistent volume
└── package.json                        # Node.js dependencies and scripts
```

---

## Automated Test Suite

When you want to run the automated tests:
```bash
npm test
```
Executes all **34 tests** offline (no external API keys required):
- AI Safety & Red-Flag escalation checks
- Cross-tenant / cross-user authorization isolation
- Appendix C schema validation & partial plan regeneration
- Reminder scheduler lookback recovery & idempotency across restarts
- Purpose-specific consent grant/revoke and PII-redacted audit trail
- Zero `innerHTML` regression audit across all frontend modules
- 10-case Gold-Set Evaluation Harness across all 9 PRD Prompt 18 categories (`100%` pass rate)

---

## Deployment & Database Cut-Over

### Local & Demo Mode (Zero Configuration)
By default, the server runs on SQLite (`database/vyora.sqlite`). All migrations and tables are applied automatically on startup.

### Production Deployment (Managed PostgreSQL)
To connect to managed PostgreSQL:
1. Provision a PostgreSQL instance (e.g. AWS RDS, Supabase, Neon, Render Postgres).
2. Set `DATABASE_URL=postgres://user:password@host:5432/vyora` in your production environment.
3. Apply `database/postgres_schema.sql`.
4. The application includes `backend/src/db-postgres.js` with parameter translation and connection pooling hooks.

---

## License & Compliance
This software is provided for wellness and routine management. It does not provide medical diagnoses, clinical treatment, or prescription adjustments. Always consult a qualified medical professional for health conditions.
