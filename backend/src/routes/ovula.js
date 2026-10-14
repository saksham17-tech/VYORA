/**
 * Stage 10 — OVULA Menstrual Wellness, Consent Gating, Red-Flag Checks & Privacy Export/Delete Routes
 */
import { db, isoNow } from '../db.js';
import { id, json } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import { detectRedFlags, redFlagResponse } from '../services/aiSafety.js';
import {
  logAudit,
  listConsents,
  hasConsent,
  grantConsent,
  revokeConsent
} from '../services/auditService.js';

const OVULA_DISCLAIMER = 'Cycle estimates are approximate and must not be used as contraception or medical diagnosis. OVULA does not diagnose PCOS, endometriosis, or fertility conditions.';

export function registerOvulaRoutes(app) {
  function handleGetOvula(req, res) {
    const entries = db.prepare('SELECT id,entry_json,created_at FROM ovula_entries WHERE user_id=? ORDER BY created_at DESC LIMIT 100')
      .all(req.user.sub)
      .map(x => ({ id: x.id, entry: json(x.entry_json), createdAt: x.created_at }));
    res.json(entries);
  }

  function handlePostOvula(req, res) {
    const entry = req.body?.entry || req.body;
    if (!entry || typeof entry !== 'object') return res.status(400).json({ error: 'entry object is required' });

    const allConsents = listConsents(req.user.sub);
    const hasRevokedOvula = allConsents.some(c => c.purpose === 'ovula_cycle' && !c.active) && !hasConsent(req.user.sub, 'ovula_cycle');
    if (hasRevokedOvula && req.body?.consent !== true) {
      return res.status(403).json({
        code: 'CONSENT_REQUIRED',
        error: 'Explicit OVULA cycle consent is required before saving cycle or symptom records.'
      });
    }
    if (!hasConsent(req.user.sub, 'ovula_cycle')) {
      grantConsent({ userId: req.user.sub, purpose: 'ovula_cycle', scope: 'private_cycle_log' });
    }

    const symptomText = [
      entry.symptoms,
      entry.notes,
      entry.flow,
      Array.isArray(entry.symptoms) ? entry.symptoms.join(' ') : ''
    ].filter(Boolean).join(' ');
    const redFlagCheck = detectRedFlags(symptomText);

    const enrichedEntry = {
      ...entry,
      privateByDefault: true,
      disclaimer: OVULA_DISCLAIMER,
      optionalActivityGuidance: entry.phase === 'menstrual'
        ? 'Optional suggestion: gentle walking, mobility, or rest — easy to override based on how you feel.'
        : 'Optional suggestion: listen to your energy levels today; all cycle-based intensity suggestions are optional.'
    };

    const eid = id(), now = isoNow();
    db.prepare('INSERT INTO ovula_entries(id,user_id,entry_json,created_at) VALUES(?,?,?,?)')
      .run(eid, req.user.sub, JSON.stringify(enrichedEntry), now);
    logAudit({ actorId: req.user.sub, action: 'ovula.entry_logged', targetType: 'ovula_entry', targetId: eid });

    res.status(201).json({
      id: eid,
      entry: enrichedEntry,
      disclaimer: OVULA_DISCLAIMER,
      redFlagAlert: redFlagCheck.isRedFlag ? redFlagResponse().answer : null,
      createdAt: now
    });
  }

  app.get('/api/ovula/entries', authOnly, handleGetOvula);
  app.post('/api/ovula/entries', authOnly, handlePostOvula);
  app.get('/api/ovula/cycle', authOnly, handleGetOvula);
  app.post('/api/ovula/cycle', authOnly, handlePostOvula);

  app.delete('/api/ovula/entries/:id', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM ovula_entries WHERE id=? AND user_id=?').run(req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Entry not found' });
    logAudit({ actorId: req.user.sub, action: 'ovula.entry_deleted', targetType: 'ovula_entry', targetId: req.params.id });
    res.json({ ok: true });
  });

  app.get('/api/ovula/export', authOnly, (req, res) => {
    const rows = db.prepare('SELECT id,entry_json,created_at FROM ovula_entries WHERE user_id=? ORDER BY created_at DESC')
      .all(req.user.sub)
      .map(x => ({ id: x.id, entry: json(x.entry_json), createdAt: x.created_at }));
    logAudit({ actorId: req.user.sub, action: 'ovula.data_exported', targetType: 'ovula', targetId: req.user.sub });
    res.json({ exportedAt: isoNow(), disclaimer: OVULA_DISCLAIMER, entries: rows });
  });

  app.delete('/api/ovula/data', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM ovula_entries WHERE user_id = ?').run(req.user.sub);
    revokeConsent({ userId: req.user.sub, purpose: 'ovula_cycle' });
    logAudit({ actorId: req.user.sub, action: 'ovula.data_deleted', targetType: 'ovula', targetId: req.user.sub, metadata: { deletedCount: r.changes } });
    res.json({ ok: true, deletedEntries: r.changes, message: 'All OVULA cycle entries deleted and consent revoked.' });
  });
}
