# VYORA — SQLite → PostgreSQL Migration Path (Stage 4)

## Why migrate

| SQLite (current demo) | PostgreSQL (production target) |
|-----------------------|--------------------------------|
| Single-writer, single disk | Concurrent writers, managed HA |
| File-based; risk of corruption on ephemeral FS | Managed backups, PITR, replicas |
| Limited JSON query power | Native JSONB + indexes |
| No built-in UUID / CITEXT / arrays | Full type system |
| Fine for single-instance demo | Required for multi-instance + durable queues |

The PRD explicitly requires **managed PostgreSQL** for production.

---

## Current state (Stage 4)

- Runtime still uses **SQLite** via `better-sqlite3` (`database/vyora.sqlite`).
- `database/schema.sql` is the live SQLite schema (now includes Stage 4 PRD-aligned tables).
- `database/postgres_schema.sql` is the **target** production schema — not yet applied.
- `database/migrations/` holds documented additive changes for future tooling.

---

## Mapping: SQLite tables → Postgres tables

| SQLite (demo) | Postgres (target) | Notes |
|---------------|-------------------|-------|
| `users` | `users` | UUID PK, CITEXT email, boolean flags, locale/timezone |
| `profiles` (JSON blob) | `fitness_profiles` + `diet_preferences` + `health_profiles` | Split for access control |
| `plans` | `plans` | JSONB content, version, model/prompt version |
| `workout_logs` | `workout_sessions` | Clearer naming, plan link |
| `progress_entries` | `progress_entries` | Same concept |
| `ovula_entries` | `cycle_entries` | Structured columns instead of pure JSON |
| `reminders` | `reminders` | `time_local TIME`, proper dates |
| `reminder_deliveries` | `reminder_occurrences` | Same idempotency key pattern |
| `vitals` | fold into `progress_entries` or keep separate | Decision open |
| `community_*` | `community_*` | media_refs JSONB, moderation_status |
| `partners` / `campaigns` | same | Cleaner ownership |
| `trainers` / `bookings` | same | |
| `challenges` / `saved_places` | keep or move under training/explore | |
| `verification_tokens` | same | |
| `revoked_tokens` | same | |
| **new** `consent_records` | same | |
| **new** `audit_events` | same | |
| **new** `integration_connections` | same | token_ref only — never raw tokens |
| **new** `imported_metrics` | same | |
| **new** `community_reports` | same | |

---

## Recommended migration steps (when ready)

1. **Provision managed Postgres** (Render, Neon, Supabase, RDS, etc.) in the target region.
2. **Apply** `database/postgres_schema.sql` (or generate via a migration tool).
3. **Add a dual-write or one-shot ETL** script:
   - Export SQLite rows → transform IDs/types → insert into Postgres.
   - Map TEXT ids → UUIDs (generate new UUIDs and keep a mapping table for FK rewrites).
4. **Switch connection**:
   - Introduce `DATABASE_URL` (Postgres) and a thin repository layer.
   - Feature-flag or env-toggle between SQLite and Postgres during cut-over.
5. **Retire SQLite** for production traffic.
6. **Backups & restore drills** before public launch.
7. **Wire a real job queue** (BullMQ + Redis) that also talks to Postgres for occurrence state.

---

## Application code changes required later

- Replace `better-sqlite3` with `pg` / `postgres.js` / Prisma / Drizzle / Knex.
- All `db.prepare(...).run/get/all` calls become async queries.
- Use parameterized queries / query builder everywhere.
- Connection pooling (e.g. 10–20 connections per instance).
- Transactions for reminder claim + delivery status updates.
- Never store raw OAuth/provider tokens in the DB; use a secret manager and store only a reference (`token_ref`).

---

## What Stage 4 does *not* change

- Runtime remains SQLite so the existing demo keeps working with zero new infrastructure.
- No forced rewrite of every route to async Postgres queries yet.
- Health-platform adapters, payments, and full media object storage remain later phases.

---

## Open decisions (from PRD)

- Final managed Postgres provider and region.
- Whether to keep a separate `vitals` table or fold into `progress_entries`.
- Migration tool choice (node-pg-migrate, Drizzle Kit, Prisma Migrate, Knex, raw SQL).
- Whether guest users stay as rows in `users` or move to a lighter anonymous session store.
