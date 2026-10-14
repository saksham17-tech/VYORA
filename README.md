# VYORA — Voice-First AI Fitness, Nutrition & OVULA Women's Wellness Platform

> **Version 2.0.0** · Aligned to **VYORA Product Requirements Document (PRD v2.0 — Prompts 1–20 & Appendices A–C)**  
> **Architecture:** Node.js 20+ · Express · SQLite (`better-sqlite3`) / PostgreSQL Dual-Driver · Modular Frontend

VYORA is a personalized, voice-first fitness and transformation platform designed India-first with internationalization in mind. It pairs an AI fitness copilot, adaptive meal and workout planning, medication and habit reminders, progress tracking, community publishing, offline partner discovery, and human coaching with **OVULA**, a dedicated, cycle-aware women's menstrual wellness companion.

---

## Getting Started

### 1. Prerequisites
- **Node.js 20+** (`node -v`)
- **npm** (`npm -v`)

### 2. Setup & Configuration
```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd aVYORA_fullstack_v2

# 2. Create your local environment file
cp .env.example .env
```

Open `.env` and set your `JWT_SECRET` (minimum 32 characters):
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret-key-of-at-least-32-chars
DATABASE_PATH=./database/vyora.sqlite
DEFAULT_TIMEZONE=Asia/Kolkata

# Optional Provider Credentials:
GEMINI_API_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```
*(When external provider keys are omitted, VYORA operates with deterministic, schema-valid fallbacks and local preview OTP codes for testing).*

### 3. Run Locally
```bash
# Install dependencies
npm install

# Start the application server
npm start
```
Open **`http://localhost:3000`** in your browser. A guest session will be created automatically.

### 4. Running the Test Suite (Optional)
```bash
npm test
```
Executes all **34 automated tests** offline (no external API keys required), covering:
- AI Safety, red-flag triage, and prompt-injection defense
- Appendix C schema validation & partial single-segment plan edits
- Cross-tenant / cross-user authorization isolation
- Reminder scheduler recovery, quiet hours, and idempotency
- 10-case Gold-Set Evaluation Harness across all 9 PRD Prompt 18 categories (`100%` pass rate)

---

## Key Features

### 1. VYORA AI Copilot (Voice & Text)
- Hands-free Web Speech API input/output with immediate text fallback.
- **Stop Audio**: Dedicated `speechSynthesis.cancel()` control to interrupt audio responses.
- **User-Controlled Memory**: Visible, editable, and clearable preferences (`GET/PUT/DELETE /api/chat/memory`).
- **Safety Pre/Post-Check Layer**: Emergency red-flag symptoms escalate immediately to urgent care guidance (Dial 112 in India) without triaging or generating workout plans.
- **Prompt Injection & Medication Guard**: Refuses prompt injection attacks and requests to alter prescribed medication dosages.
- **Report AI Answer**: User controls to flag inaccurate or unsafe AI responses (`POST /api/ai/report`).

### 2. Adaptive Diet & Workout Planning
- **Server-Side Appendix C Contract Validation**: `POST /api/plans/generate` produces structured meal templates, portion guidance, and 7-day workout splits with safe calorie deficit bounds (`≥1,350 kcal/day`) and explicit uncertainty labels (`±15%` / `±150 kcal`).
- **Indian Regional Nutrition**: Moong dal chilla, paneer tikka, dal palak, jowar/bajra millet rotis, roasted chana/makhana, and tandoori chicken.
- **Conversational Partial Plan Regeneration**: `PATCH /api/plans/:id` allows changing single constraints (e.g., *"no eggs today"*, *"make this an outdoor workout"*, *"shorter 20m session"*, *"my knee hurts"*) by regenerating **only** the affected meal slot or workout day while preserving Lunch, Dinner, and all other days untouched.

### 3. Medication & Habit Reminders (Reliable Lifecycle)
- **Verified Destinations Only**: Registered accounts must verify email or phone before scheduling outbound reminders (`403 UNVERIFIED_DESTINATION`).
- **Privacy-Preserving Previews**: Minimal lock-screen messages by default to prevent exposing sensitive medication names on shared screens.
- **Quiet Hours**: Respects user-configured quiet hours (default 22:00 to 07:00), deferring non-urgent reminders until quiet hours end.
- **2-Hour Lookback Recovery & Idempotency**: Scheduler ticks recover missed reminders after process restarts without duplicate sends via `UNIQUE(reminder_id, occurrence_key)`.
- **Opt-Out / STOP**: Users can unsubscribe from SMS/email reminders at any time (`POST /api/reminders/opt-out`).

### 4. OVULA Menstrual Wellness
- **Cycle-Aware Support**: Phase-based activity tips, cramp-comfort strategies (heat, gentle movement, hydration), and self-care tracking.
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

## Architecture & Codebase Map

```text
VYORA/
├── backend/
│   ├── src/
│   │   ├── server.js                   # Express bootstrap, CSP, CORS, request context & error handler
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

## Production Deployment (PostgreSQL)

By default, the server runs with zero configuration on SQLite (`database/vyora.sqlite`). 

For multi-instance cloud deployments (AWS RDS, Supabase, Neon, Render Postgres):
1. Set `DATABASE_URL=postgres://user:password@host:5432/vyora` in your hosting dashboard.
2. Apply `database/postgres_schema.sql` to your PostgreSQL database.
3. The server automatically uses `backend/src/db-postgres.js` with parameterized query translation and connection pooling.

---

## Disclaimer & Compliance
This software is provided for general wellness, fitness, and habit-tracking purposes. It does not provide medical diagnoses, clinical treatment, or prescription adjustments. Always consult a qualified medical professional for personal health concerns or severe menstrual symptoms.
