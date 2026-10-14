PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT UNIQUE,
 password_hash TEXT,
 display_name TEXT NOT NULL DEFAULT 'VYORA User',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 is_guest INTEGER NOT NULL DEFAULT 1,
 email_verified INTEGER NOT NULL DEFAULT 0,
 phone TEXT,
 phone_verified INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, profile_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, plan_json TEXT NOT NULL, model TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workout_logs (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, log_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS progress_entries (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, value REAL, unit TEXT, note TEXT, source TEXT NOT NULL DEFAULT 'manual', recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminders (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 label TEXT NOT NULL,
 reminder_type TEXT NOT NULL DEFAULT 'medication',
 time TEXT NOT NULL,
 timezone TEXT NOT NULL,
 channel TEXT NOT NULL,
 email TEXT,
 phone TEXT,
 start_date TEXT,
 end_date TEXT,
 notes TEXT,
 quiet_start TEXT DEFAULT '22:00',
 quiet_end TEXT DEFAULT '07:00',
 minimal_preview INTEGER NOT NULL DEFAULT 1,
 opted_out INTEGER NOT NULL DEFAULT 0,
 consent_at TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 last_occurrence_key TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminder_deliveries (
 id TEXT PRIMARY KEY, reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE, occurrence_key TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, provider_id TEXT, error TEXT, scheduled_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(reminder_id, occurrence_key)
);
CREATE TABLE IF NOT EXISTS vitals (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, bp TEXT, sugar REAL, heart_rate REAL, weight REAL, note TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ovula_entries (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, entry_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS community_posts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, author_name TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, media_url TEXT, visibility TEXT NOT NULL DEFAULT 'public', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS community_interactions (
 id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, body TEXT, created_at TEXT NOT NULL, UNIQUE(post_id,user_id,kind,body)
);
CREATE TABLE IF NOT EXISTS partners (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, category TEXT NOT NULL, location TEXT NOT NULL, offer TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, date TEXT, offer TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trainers (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, specialty TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, trainer_id TEXT NOT NULL REFERENCES trainers(id), requested_at TEXT NOT NULL, notes TEXT, status TEXT NOT NULL DEFAULT 'requested', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS challenges (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, goal TEXT NOT NULL, target REAL NOT NULL, unit TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS challenge_progress (
 id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, value REAL NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, UNIQUE(challenge_id,user_id)
);
CREATE TABLE IF NOT EXISTS saved_places (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, category TEXT NOT NULL, address TEXT, lat REAL, lng REAL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  revoked_at TEXT NOT NULL,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user ON revoked_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(active,time);
CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress_entries(user_id,recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON community_posts(created_at DESC);

-- ===== Stage 4: PRD-aligned additions (SQLite-compatible) =====

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  policy_version TEXT NOT NULL DEFAULT '1.0'
);
CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'ok',
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id);

CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  scopes TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  token_ref TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS imported_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value REAL,
  unit TEXT,
  recorded_at TEXT NOT NULL,
  source_meta TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_imported_user ON imported_metrics(user_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS community_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT REFERENCES community_posts(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON community_reports(status, created_at DESC);

-- ===== Stage 8: Copilot Memory & AI Safety Incident Reporting =====

CREATE TABLE IF NOT EXISTS copilot_memory (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  memory_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_safety_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'vyora',
  user_message TEXT,
  ai_response TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_safety_reports_status ON ai_safety_reports(status, created_at DESC);

-- ===== Stage 11: Special Training Routes & Opt-in Leaderboards =====
CREATE TABLE IF NOT EXISTS training_routes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  distance_km REAL NOT NULL,
  terrain TEXT NOT NULL DEFAULT 'road',
  elevation_gain_m REAL,
  waypoints_json TEXT NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'private',
  privacy_zone_km REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_training_routes_user ON training_routes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'weekly_km',
  score REAL NOT NULL DEFAULT 0,
  opt_in INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- ===== Stage 12: VYORA Pro Trainer Shares/Reviews, Campaign Analytics & Place Reports =====
CREATE TABLE IF NOT EXISTS trainer_shares (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  scopes TEXT NOT NULL DEFAULT 'goals,workouts',
  active INTEGER NOT NULL DEFAULT 1,
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(user_id, trainer_id)
);

CREATE TABLE IF NOT EXISTS trainer_reviews (
  id TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(trainer_id, user_id)
);

CREATE TABLE IF NOT EXISTS campaign_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaign_events_camp ON campaign_events(campaign_id, event_type);

CREATE TABLE IF NOT EXISTS place_reports (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES saved_places(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issue TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ===== Stage 13: Feature Flags Registry =====
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
