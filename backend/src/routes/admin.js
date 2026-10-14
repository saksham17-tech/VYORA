/**
 * Stage 13 — Admin, Support, Moderation & Feature Flags Routes
 * Implements PRD Prompt 17:
 * - Least-privilege operational overview (never exposes raw user health/OVULA records to support/moderation)
 * - Feature flags registry (`GET /api/feature-flags`, `PATCH /api/admin/feature-flags/:key`)
 * - AI safety incident review (`GET /api/admin/ai-reports`, `PATCH /api/admin/ai-reports/:id`)
 * - Partner listing verification & suspension (`PATCH /api/admin/partners/:id/verify`)
 * - Reminder delivery failure monitoring (`GET /api/admin/delivery-failures`)
 * - Full administrative audit trail (`admin.*` in `audit_events`)
 */
import { db, isoNow } from '../db.js';
import { str } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { runGoldEvaluationSuite } from '../services/evaluationHarness.js';

const DEFAULT_FLAGS = [
  ['voice_copilot', 1, 'Enable browser voice recognition and speech synthesis in VYORA Copilot'],
  ['sms_reminders', 1, 'Allow verified SMS channel for medication and habit reminders'],
  ['wearable_bridges', 0, 'Gate live Android Health Connect / Apple HealthKit native sync behind feature flag until platform approval'],
  ['community_publishing', 1, 'Allow members to publish posts and comments in Community Hub'],
  ['gamification_default', 1, 'Enable streaks and consistency milestones by default on new profiles']
];

function ensureDefaultFlags() {
  const now = isoNow();
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO feature_flags (key, enabled, description, updated_at) VALUES (?, ?, ?, ?)'
  );
  for (const [key, enabled, desc] of DEFAULT_FLAGS) {
    stmt.run(key, enabled, desc, now);
  }
}

export function registerAdminRoutes(app) {
  ensureDefaultFlags();

  app.get('/api/admin/eval/run', authOnly, (req, res) => {
    const report = runGoldEvaluationSuite();
    logAudit({
      actorId: req.user.sub,
      action: 'admin.gold_eval_executed',
      targetType: 'evaluation_suite',
      metadata: { totalCases: report.totalCases, passRate: report.passRate }
    });
    res.json(report);
  });

  app.get('/api/feature-flags', authOnly, (_req, res) => {
    ensureDefaultFlags();
    const rows = db.prepare('SELECT key, enabled, description, updated_at AS updatedAt FROM feature_flags ORDER BY key').all();
    res.json(rows.map(r => ({ ...r, enabled: !!r.enabled })));
  });

  app.patch('/api/admin/feature-flags/:key', authOnly, (req, res) => {
    ensureDefaultFlags();
    const key = str(req.params.key, 60);
    const existing = db.prepare('SELECT * FROM feature_flags WHERE key = ?').get(key);
    if (!existing) return res.status(404).json({ error: 'Feature flag not found.' });
    const enabled = req.body?.enabled ? 1 : 0;
    const now = isoNow();
    db.prepare('UPDATE feature_flags SET enabled = ?, updated_at = ? WHERE key = ?').run(enabled, now, key);
    logAudit({
      actorId: req.user.sub,
      action: 'admin.feature_flag_updated',
      targetType: 'feature_flag',
      targetId: key,
      metadata: { enabled: !!enabled }
    });
    res.json({ ok: true, key, enabled: !!enabled, updatedAt: now });
  });

  app.get('/api/admin/overview', authOnly, (req, res) => {
    ensureDefaultFlags();
    const openCommunityReports = db.prepare("SELECT COUNT(*) AS c FROM community_reports WHERE status = 'open'").get()?.c || 0;
    const openAiSafetyReports = db.prepare("SELECT COUNT(*) AS c FROM ai_safety_reports WHERE status = 'open'").get()?.c || 0;
    const pendingPartners = db.prepare("SELECT COUNT(*) AS c FROM partners WHERE status = 'pending'").get()?.c || 0;
    const failedDeliveriesCount = db.prepare("SELECT COUNT(*) AS c FROM reminder_deliveries WHERE status IN ('failed', 'failed_permanent')").get()?.c || 0;
    const flags = db.prepare('SELECT key, enabled, description, updated_at AS updatedAt FROM feature_flags ORDER BY key')
      .all()
      .map(r => ({ ...r, enabled: !!r.enabled }));

    logAudit({ actorId: req.user.sub, action: 'admin.overview_viewed', targetType: 'admin_console' });

    res.json({
      counts: {
        openCommunityReports,
        openAiSafetyReports,
        pendingPartners,
        failedDeliveriesCount
      },
      featureFlags: flags,
      leastPrivilegePolicy: {
        healthDataExposedToSupport: false,
        ovulaCycleDataExposedToSupport: false,
        notice: 'Support and moderation consoles strictly exclude personal health, vitals, and OVULA menstrual records.'
      }
    });
  });

  app.get('/api/admin/ai-reports', authOnly, (req, res) => {
    const rows = db.prepare(
      `SELECT id, mode, reason, status, created_at AS createdAt
       FROM ai_safety_reports ORDER BY created_at DESC LIMIT 100`
    ).all();
    logAudit({ actorId: req.user.sub, action: 'admin.ai_reports_viewed', targetType: 'ai_safety_report' });
    res.json(rows);
  });

  app.patch('/api/admin/ai-reports/:id', authOnly, (req, res) => {
    const status = ['open', 'reviewed', 'resolved', 'dismissed'].includes(String(req.body?.status || '').toLowerCase())
      ? String(req.body.status).toLowerCase()
      : null;
    if (!status) return res.status(400).json({ error: 'Valid status required (open, reviewed, resolved, dismissed).' });
    const row = db.prepare('SELECT id FROM ai_safety_reports WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'AI safety report not found.' });
    db.prepare('UPDATE ai_safety_reports SET status = ? WHERE id = ?').run(status, row.id);
    logAudit({
      actorId: req.user.sub,
      action: 'admin.ai_report_reviewed',
      targetType: 'ai_safety_report',
      targetId: row.id,
      metadata: { status }
    });
    res.json({ ok: true, id: row.id, status });
  });

  app.patch('/api/admin/partners/:id/verify', authOnly, (req, res) => {
    const status = ['approved', 'suspended', 'pending', 'rejected'].includes(String(req.body?.status || '').toLowerCase())
      ? String(req.body.status).toLowerCase()
      : null;
    if (!status) return res.status(400).json({ error: 'Valid partner status required (approved, suspended, pending, rejected).' });
    const row = db.prepare('SELECT id, name FROM partners WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Partner listing not found.' });
    db.prepare('UPDATE partners SET status = ? WHERE id = ?').run(status, row.id);
    logAudit({
      actorId: req.user.sub,
      action: 'admin.partner_status_updated',
      targetType: 'partner',
      targetId: row.id,
      metadata: { status }
    });
    res.json({ ok: true, id: row.id, name: row.name, status });
  });

  app.get('/api/admin/delivery-failures', authOnly, (req, res) => {
    // Redacted operational view: shows reminder ID, channel, attempts, and error code without exposing medication names
    const rows = db.prepare(
      `SELECT d.id, d.reminder_id AS reminderId, r.channel, r.timezone, d.occurrence_key AS occurrenceKey,
              d.status, d.attempts, d.error, d.scheduled_at AS scheduledAt, d.updated_at AS updatedAt
       FROM reminder_deliveries d
       JOIN reminders r ON r.id = d.reminder_id
       WHERE d.status IN ('failed', 'failed_permanent')
       ORDER BY d.updated_at DESC LIMIT 50`
    ).all();
    logAudit({ actorId: req.user.sub, action: 'admin.delivery_failures_viewed', targetType: 'reminder_delivery' });
    res.json(rows);
  });
}
