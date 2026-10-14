/**
 * Stage 10 — Workouts, Progress Entries & Vitals Routes
 */
import { db, isoNow } from '../db.js';
import { id, str, json } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';

const ALLOWED_PROGRESS_UNITS = ['kg', 'lb', 'cm', 'in', 'kcal', 'steps', 'km', 'mi', 'min', 'hours', 'bpm', 'mmHg', 'mg/dL', 'score', '%'];

export function registerWorkoutAndProgressRoutes(app) {
  app.get('/api/workouts', authOnly, (req, res) => res.json(
    db.prepare('SELECT id,log_json,created_at FROM workout_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 100')
      .all(req.user.sub)
      .map(x => ({ id: x.id, log: json(x.log_json), createdAt: x.created_at }))
  ));

  app.post('/api/workouts', authOnly, (req, res) => {
    const log = req.body?.log;
    if (!log || typeof log !== 'object') return res.status(400).json({ error: 'log object is required' });
    const workoutId = id(), now = isoNow();
    db.prepare('INSERT INTO workout_logs(id,user_id,log_json,created_at) VALUES(?,?,?,?)')
      .run(workoutId, req.user.sub, JSON.stringify(log), now);
    res.status(201).json({ id: workoutId, log, createdAt: now });
  });

  app.delete('/api/workouts/:id', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM workout_logs WHERE id=? AND user_id=?').run(req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Workout not found' });
    res.json({ ok: true });
  });

  app.get('/api/progress', authOnly, (req, res) => {
    const rows = db.prepare(
      'SELECT id, type, value, unit, note, source, recorded_at AS recordedAt FROM progress_entries WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 100'
    ).all(req.user.sub);
    res.json(rows);
  });

  app.post('/api/progress', authOnly, (req, res) => {
    const type = str(req.body?.type, 60);
    const value = Number(req.body?.value);
    const unit = str(req.body?.unit, 20);
    const source = req.body?.source === 'imported' ? 'imported' : 'manual';
    if (!type || !Number.isFinite(value)) {
      return res.status(400).json({ error: 'Progress type and numeric value are required.' });
    }
    if (!unit || !ALLOWED_PROGRESS_UNITS.includes(unit)) {
      return res.status(400).json({ error: `Valid unit is required (${ALLOWED_PROGRESS_UNITS.join(', ')}).` });
    }
    const pid = id(), now = isoNow();
    db.prepare(
      'INSERT INTO progress_entries (id, user_id, type, value, unit, note, source, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(pid, req.user.sub, type, value, unit, str(req.body?.note, 300) || null, source, str(req.body?.recordedAt, 40) || now);
    res.status(201).json({
      id: pid,
      type,
      value,
      unit,
      note: str(req.body?.note, 300) || null,
      source,
      recordedAt: str(req.body?.recordedAt, 40) || now
    });
  });

  app.delete('/api/progress/:id', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM progress_entries WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Progress entry not found' });
    res.json({ ok: true });
  });

  app.get('/api/vitals', authOnly, (req, res) => res.json(
    db.prepare('SELECT id,bp,sugar,heart_rate AS heartRate,weight,note,created_at AS createdAt FROM vitals WHERE user_id=? ORDER BY created_at DESC LIMIT 100')
      .all(req.user.sub)
  ));

  app.post('/api/vitals', authOnly, (req, res) => {
    const bp = str(req.body?.bp, 20);
    const sugar = req.body?.sugar === '' || req.body?.sugar == null ? null : Number(req.body.sugar);
    const heart = req.body?.heartRate === '' || req.body?.heartRate == null ? null : Number(req.body.heartRate);
    const weight = req.body?.weight === '' || req.body?.weight == null ? null : Number(req.body.weight);
    if (!bp && sugar === null && heart === null && weight === null) {
      return res.status(400).json({ error: 'Provide at least one reading.' });
    }
    for (const n of [sugar, heart, weight]) {
      if (n !== null && !Number.isFinite(n)) return res.status(400).json({ error: 'Readings must be numeric.' });
    }
    const vid = id(), now = isoNow();
    db.prepare('INSERT INTO vitals(id,user_id,bp,sugar,heart_rate,weight,note,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(vid, req.user.sub, bp || null, sugar, heart, weight, str(req.body?.note, 300) || null, now);
    res.status(201).json({ id: vid, bp: bp || null, sugar, heartRate: heart, weight, note: str(req.body?.note, 300) || null, createdAt: now });
  });

  app.delete('/api/vitals/:id', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM vitals WHERE id=? AND user_id=?').run(req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Reading not found' });
    res.json({ ok: true });
  });
}
