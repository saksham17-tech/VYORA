/**
 * Stage 10 — Health-Platform Integrations & Imported Metrics Routes
 */
import { db, isoNow } from '../db.js';
import { id, str, json } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import { getMailer, getTwilio } from '../services/providers.js';
import { logAudit, grantConsent } from '../services/auditService.js';

const ALLOWED_PROVIDERS = ['android_health_connect', 'apple_healthkit', 'garmin', 'fitbit'];

export function registerIntegrationRoutes(app) {
  app.get('/api/integrations', authOnly, (req, res) => {
    const connections = db.prepare(
      `SELECT id, provider, scopes, status, last_sync_at AS lastSyncAt, created_at AS createdAt, updated_at AS updatedAt
       FROM integration_connections WHERE user_id = ?`
    ).all(req.user.sub);

    res.json({
      gemini: !!process.env.GEMINI_API_KEY,
      email: !!getMailer(),
      sms: !!getTwilio(),
      android: {
        available: false,
        detail: 'Native Health Connect connector requires an Android companion bridge; manual/consented import is supported.'
      },
      apple: {
        available: false,
        detail: 'HealthKit requires a native iOS app with HealthKit entitlement or authorized export bridge.'
      },
      connections
    });
  });

  app.post('/api/integrations/:provider/connect', authOnly, (req, res) => {
    const provider = str(req.params.provider, 60).toLowerCase();
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: `Unsupported integration provider. Allowed: ${ALLOWED_PROVIDERS.join(', ')}` });
    }
    if (req.body?.consent !== true) {
      return res.status(400).json({ error: 'Explicit user consent is required before connecting a health data source.' });
    }
    const scopes = Array.isArray(req.body?.scopes)
      ? req.body.scopes.map(s => str(s, 40)).join(',')
      : str(req.body?.scopes || 'steps,sleep,workouts', 200);
    const now = isoNow();
    const connId = id();
    const status = req.body?.bridgeHandshakeVerified === true ? 'connected_bridge' : 'consented_manual_bridge';
    const tokenRef = `vault_ref_${id().slice(0, 8)}`;

    db.prepare(
      `INSERT INTO integration_connections (id, user_id, provider, scopes, status, token_ref, last_sync_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
       ON CONFLICT(user_id, provider) DO UPDATE SET
         scopes = excluded.scopes,
         status = excluded.status,
         token_ref = excluded.token_ref,
         updated_at = excluded.updated_at`
    ).run(connId, req.user.sub, provider, scopes, status, tokenRef, now, now);

    grantConsent({ userId: req.user.sub, purpose: 'wearable_sync', scope: `${provider}:${scopes}` });
    logAudit({ actorId: req.user.sub, action: 'integration.connected', targetType: 'integration', targetId: provider, metadata: { scopes, status } });

    res.status(201).json({
      provider,
      scopes: scopes.split(',').filter(Boolean),
      status,
      lastSyncAt: null,
      updatedAt: now,
      notice: status === 'connected_bridge'
        ? 'Authorized native bridge handshake verified.'
        : 'Consent recorded for manual/bridge metric import. Direct browser access to HealthKit/Health Connect is not claimed without a native app.'
    });
  });

  app.post('/api/integrations/:provider/disconnect', authOnly, (req, res) => {
    const provider = str(req.params.provider, 60).toLowerCase();
    const now = isoNow();
    const r = db.prepare(
      `UPDATE integration_connections
       SET status = 'disconnected', token_ref = NULL, updated_at = ?
       WHERE user_id = ? AND provider = ?`
    ).run(now, req.user.sub, provider);

    let deletedMetrics = 0;
    if (req.body?.deleteImportedMetrics !== false) {
      deletedMetrics = db.prepare('DELETE FROM imported_metrics WHERE user_id = ? AND provider = ?').run(req.user.sub, provider).changes;
    }

    logAudit({
      actorId: req.user.sub,
      action: 'integration.disconnected',
      targetType: 'integration',
      targetId: provider,
      metadata: { updated: r.changes, deletedMetrics }
    });

    res.json({
      ok: true,
      provider,
      status: 'disconnected',
      deletedMetrics,
      updatedAt: now
    });
  });

  app.get('/api/integrations/metrics', authOnly, (req, res) => {
    const rows = db.prepare(
      `SELECT id, provider, metric_type AS metricType, value, unit, recorded_at AS recordedAt, source_meta AS sourceMeta, created_at AS createdAt
       FROM imported_metrics WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 100`
    ).all(req.user.sub);
    res.json(rows.map(r => ({ ...r, sourceMeta: r.sourceMeta ? json(r.sourceMeta, null) : null })));
  });

  app.post('/api/integrations/metrics', authOnly, (req, res) => {
    const provider = str(req.body?.provider, 60).toLowerCase();
    const metricType = str(req.body?.metricType, 60);
    const value = Number(req.body?.value);
    const unit = str(req.body?.unit, 20);
    if (!ALLOWED_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Valid integration provider is required.' });
    if (!metricType || !Number.isFinite(value) || !unit) return res.status(400).json({ error: 'metricType, numeric value, and unit are required.' });

    const conn = db.prepare('SELECT status FROM integration_connections WHERE user_id = ? AND provider = ?').get(req.user.sub, provider);
    if (!conn || conn.status === 'disconnected') {
      return res.status(403).json({ error: `Connect and consent to ${provider} before importing metrics.` });
    }

    const mid = id(), now = isoNow();
    const recordedAt = str(req.body?.recordedAt, 40) || now;
    db.prepare(
      `INSERT INTO imported_metrics (id, user_id, provider, metric_type, value, unit, recorded_at, source_meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(mid, req.user.sub, provider, metricType, value, unit, recordedAt, JSON.stringify({ importedVia: 'consented_bridge' }), now);

    db.prepare('UPDATE integration_connections SET last_sync_at = ?, updated_at = ? WHERE user_id = ? AND provider = ?')
      .run(now, now, req.user.sub, provider);

    res.status(201).json({ id: mid, provider, metricType, value, unit, recordedAt, createdAt: now });
  });
}
