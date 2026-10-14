/**
 * Stage 10 — Profile, Consents, Audit Trail, Data Export & Account Deletion Routes
 */
import { db, isoNow } from '../db.js';
import { str, json } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import {
  ALLOWED_CONSENT_PURPOSES,
  logAudit,
  listConsents,
  grantConsent,
  revokeConsent,
  listUserAuditEvents
} from '../services/auditService.js';

export function registerProfileRoutes(app) {
  app.get('/api/me', authOnly, (req, res) => {
    const u = db.prepare('SELECT id,email,display_name,is_guest,email_verified,phone,phone_verified,created_at FROM users WHERE id=?').get(req.user.sub);
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      isGuest: !!u.is_guest,
      emailVerified: !!u.email_verified,
      phone: u.phone || null,
      phoneVerified: !!u.phone_verified,
      createdAt: u.created_at,
      consents: listConsents(u.id).filter(c => c.active)
    });
  });

  app.get('/api/profile', authOnly, (req, res) => {
    const row = db.prepare('SELECT profile_json,updated_at FROM profiles WHERE user_id=?').get(req.user.sub);
    res.json({ profile: json(row?.profile_json), updatedAt: row?.updated_at || null });
  });

  app.put('/api/profile', authOnly, (req, res) => {
    const profile = req.body?.profile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return res.status(400).json({ error: 'profile object is required' });
    }
    const now = isoNow();
    db.prepare('INSERT INTO profiles(user_id,profile_json,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET profile_json=excluded.profile_json,updated_at=excluded.updated_at')
      .run(req.user.sub, JSON.stringify(profile), now);
    logAudit({ actorId: req.user.sub, action: 'profile.updated', targetType: 'profile', targetId: req.user.sub });
    res.json({ profile, updatedAt: now });
  });

  app.get('/api/consents', authOnly, (req, res) => {
    res.json({
      allowedPurposes: ALLOWED_CONSENT_PURPOSES,
      consents: listConsents(req.user.sub)
    });
  });

  app.post('/api/consents', authOnly, (req, res) => {
    try {
      const purpose = str(req.body?.purpose, 60);
      const scope = str(req.body?.scope, 120) || 'standard';
      const policyVersion = str(req.body?.policyVersion, 20) || '2.0';
      const record = grantConsent({ userId: req.user.sub, purpose, scope, policyVersion });
      res.status(201).json(record);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/consents/:purpose', authOnly, (req, res) => {
    try {
      const result = revokeConsent({ userId: req.user.sub, purpose: str(req.params.purpose, 60) });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/audit', authOnly, (req, res) => {
    res.json(listUserAuditEvents(req.user.sub, req.query?.limit));
  });

  app.get('/api/export', authOnly, (req, res) => {
    const uid = req.user.sub;
    logAudit({ actorId: uid, action: 'account.data_exported', targetType: 'user', targetId: uid });
    const memRow = db.prepare('SELECT memory_json, updated_at FROM copilot_memory WHERE user_id = ?').get(uid);
    const data = {
      exportedAt: isoNow(),
      profile: json(db.prepare('SELECT profile_json FROM profiles WHERE user_id=?').get(uid)?.profile_json),
      consents: listConsents(uid),
      copilotMemory: { items: json(memRow?.memory_json, []), updatedAt: memRow?.updated_at || null },
      plans: db.prepare('SELECT kind,title,plan_json,created_at FROM plans WHERE user_id=?').all(uid).map(x => ({ ...x, plan: json(x.plan_json), plan_json: undefined })),
      workouts: db.prepare('SELECT log_json,created_at FROM workout_logs WHERE user_id=?').all(uid).map(x => ({ log: json(x.log_json), createdAt: x.created_at })),
      progress: db.prepare('SELECT type,value,unit,note,source,recorded_at FROM progress_entries WHERE user_id=?').all(uid),
      vitals: db.prepare('SELECT bp,sugar,heart_rate,weight,note,created_at FROM vitals WHERE user_id=?').all(uid),
      ovula: db.prepare('SELECT entry_json,created_at FROM ovula_entries WHERE user_id=?').all(uid).map(x => ({ entry: json(x.entry_json), createdAt: x.created_at })),
      reminders: db.prepare('SELECT label,reminder_type,time,timezone,channel,quiet_start,quiet_end,active,created_at FROM reminders WHERE user_id=?').all(uid),
      integrations: db.prepare('SELECT provider,scopes,status,last_sync_at FROM integration_connections WHERE user_id=?').all(uid),
      importedMetrics: db.prepare('SELECT provider,metric_type,value,unit,recorded_at FROM imported_metrics WHERE user_id=?').all(uid),
      auditTrail: listUserAuditEvents(uid, 100)
    };
    res.setHeader('Content-Disposition', 'attachment; filename="vyora-data-export.json"');
    res.json(data);
  });

  app.delete('/api/account', authOnly, (req, res) => {
    const now = isoNow();
    if (req.user.jti) {
      db.prepare('INSERT OR IGNORE INTO revoked_tokens(jti,user_id,revoked_at,reason) VALUES(?,?,?,?)')
        .run(req.user.jti, req.user.sub, now, 'account_deleted');
    }
    logAudit({ actorId: req.user.sub, action: 'account.deleted', targetType: 'user', targetId: req.user.sub });
    db.prepare('DELETE FROM users WHERE id=?').run(req.user.sub);
    res.json({ ok: true, message: 'Account and associated records deleted. Session revoked.' });
  });
}
