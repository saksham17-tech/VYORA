# VYORA Stage 4 — Data Model Alignment & PostgreSQL Path

**Built on:** Stage 3  
**Goal:** Align the schema with the PRD entities and provide a clear, non-breaking path to managed PostgreSQL for production.

---

## What was added

### 1. SQLite schema extensions (live)
New tables (all additive, demo continues to work):

| Table | Purpose |
|-------|---------|
| `consent_records` | Purpose-specific consent with grant/revoke + policy version |
| `audit_events` | Privileged action audit trail |
| `integration_connections` | Health-platform / external provider link status (token_ref only) |
| `imported_metrics` | Metrics imported from wearables / health platforms |
| `community_reports` | Report/block foundation for moderation |

**File:** `database/schema.sql`

### 2. Target PostgreSQL schema
Full production-oriented schema with:
- UUID primary keys
- JSONB for flexible structured data
- Proper `TIMESTAMPTZ`, `DATE`, `TIME`, boolean types
- Split profile tables (`fitness_profiles`, `diet_preferences`, `health_profiles`) for access control
- Structured `cycle_entries` instead of opaque JSON
- `reminder_occurrences` (renamed from deliveries for clarity)
- Arrays / CITEXT where useful

**File:** `database/postgres_schema.sql`  
**Not applied at runtime** — this is the target for the real migration.

### 3. Migration documentation
- Table-by-table mapping SQLite → Postgres
- Recommended cut-over steps
- Application code implications
- Open decisions still pending

**File:** `docs/architecture/POSTGRES_MIGRATION.md`

### 4. Migrations folder
- `database/migrations/001_prd_alignment.sql` — documents the additive Stage 4 changes for future tooling.

---

## Design principles followed

- **Additive only** on the live SQLite schema → zero downtime for the current demo.
- Sensitive health / cycle / medication data remains isolatable (separate tables, ready for stricter grants).
- Secrets never stored as raw tokens — only `token_ref` placeholders.
- Audit and consent tables ready for compliance workstreams.

---

## What is still SQLite

The running application continues to use `better-sqlite3` and `database/vyora.sqlite`.  
Switching the live connection to Postgres is intentionally left for a dedicated infrastructure stage so that:

1. You can deploy Stage 4 without provisioning a database service today.
2. The migration can be tested, backed up, and cut over deliberately.

---

## How to inspect

```bash
# After npm start, the new tables exist in the SQLite file
sqlite3 database/vyora.sqlite ".tables"
sqlite3 database/vyora.sqlite ".schema consent_records"
```

Review the target schema:
```bash
less database/postgres_schema.sql
less docs/architecture/POSTGRES_MIGRATION.md
```

---

## Next stage options

- **Stage 5** — AI safety layer hardening (gold test harness, stricter system prompts, red-flag evaluation)
- **Stage 5b** — Community report endpoint + basic moderation queue
- **Stage 6** — Full route split of `server.js` into the service boundaries from the PRD

Reply with the next stage you want.
