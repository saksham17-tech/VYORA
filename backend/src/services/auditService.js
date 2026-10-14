/**
 * Stage 7 — Audit & Purpose-Specific Consent Service
 * Implements PRD Section 9 (ConsentRecord, AuditEvent) & Section 11 (Privacy & Consent).
 * Never logs raw passwords, tokens, OTP codes, or sensitive clinical payloads.
 */
import { db, isoNow } from '../db.js';
import { id, str, json } from '../utils/helpers.js';

export const ALLOWED_CONSENT_PURPOSES = [
  'health_profile',
  'ovula_cycle',
  'medication_reminders',
  'wearable_sync',
  'community_publishing',
  'location_discovery'
];

const SENSITIVE_META_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'token_hash',
  'otp',
  'code',
  'secret',
  'authorization'
]);

function sanitizeMetadata(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const clean = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_META_KEYS.has(k.toLowerCase())) continue;
    clean[k] = typeof v === 'string' ? v.slice(0, 200) : v;
  }
  return JSON.stringify(clean);
}

export function logAudit({
  actorId = null,
  action,
  targetType = null,
  targetId = null,
  outcome = 'ok',
  metadata = null
}) {
  if (!action) return null;
  const eventId = id();
  const now = isoNow();
  db.prepare(
    `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, outcome, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    actorId ? str(actorId, 80) : null,
    str(action, 100),
    targetType ? str(targetType, 60) : null,
    targetId ? str(targetId, 80) : null,
    str(outcome, 40),
    sanitizeMetadata(metadata),
    now
  );
  return { id: eventId, createdAt: now };
}

export function listConsents(userId) {
  const rows = db.prepare(
    `SELECT id, purpose, scope, granted_at AS grantedAt, revoked_at AS revokedAt, policy_version AS policyVersion
     FROM consent_records
     WHERE user_id = ?
     ORDER BY granted_at DESC`
  ).all(userId);
  return rows.map((r) => ({
    ...r,
    active: !r.revokedAt
  }));
}

export function hasConsent(userId, purpose) {
  const row = db.prepare(
    `SELECT id FROM consent_records
     WHERE user_id = ? AND purpose = ? AND revoked_at IS NULL
     ORDER BY granted_at DESC LIMIT 1`
  ).get(userId, purpose);
  return !!row;
}

export function grantConsent({
  userId,
  purpose,
  scope = 'standard',
  policyVersion = '2.0'
}) {
  if (!ALLOWED_CONSENT_PURPOSES.includes(purpose)) {
    throw new Error(`Unsupported consent purpose: ${purpose}`);
  }
  const now = isoNow();
  // Close any prior active record for the same purpose so active state is unambiguous
  db.prepare(
    `UPDATE consent_records SET revoked_at = ?
     WHERE user_id = ? AND purpose = ? AND revoked_at IS NULL`
  ).run(now, userId, purpose);

  const cid = id();
  db.prepare(
    `INSERT INTO consent_records (id, user_id, purpose, scope, granted_at, revoked_at, policy_version)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`
  ).run(cid, userId, purpose, str(scope, 120), now, str(policyVersion, 20));

  logAudit({
    actorId: userId,
    action: 'consent.granted',
    targetType: 'consent',
    targetId: cid,
    metadata: { purpose, scope, policyVersion }
  });

  return {
    id: cid,
    purpose,
    scope: str(scope, 120),
    grantedAt: now,
    revokedAt: null,
    policyVersion: str(policyVersion, 20),
    active: true
  };
}

export function revokeConsent({ userId, purpose }) {
  if (!ALLOWED_CONSENT_PURPOSES.includes(purpose)) {
    throw new Error(`Unsupported consent purpose: ${purpose}`);
  }
  const now = isoNow();
  const res = db.prepare(
    `UPDATE consent_records SET revoked_at = ?
     WHERE user_id = ? AND purpose = ? AND revoked_at IS NULL`
  ).run(now, userId, purpose);

  logAudit({
    actorId: userId,
    action: 'consent.revoked',
    targetType: 'consent',
    targetId: purpose,
    metadata: { purpose, updatedRecords: res.changes }
  });

  return { ok: true, purpose, revokedAt: now, updated: res.changes };
}

export function listUserAuditEvents(userId, limit = 50) {
  const rows = db.prepare(
    `SELECT id, action, target_type AS targetType, target_id AS targetId, outcome, metadata, created_at AS createdAt
     FROM audit_events
     WHERE actor_id = ?
     ORDER BY created_at DESC
     LIMIT ?`
  ).all(userId, Math.min(200, Math.max(1, Number(limit) || 50)));
  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? json(r.metadata, null) : null
  }));
}
