/**
 * Stage 10 — Server-Validated Adaptive Plan Generation, Partial Regeneration & Plan CRUD Routes
 */
import { db, isoNow } from '../db.js';
import { id, str, json } from '../utils/helpers.js';
import { authOnly, optionalAuth } from '../middleware/auth.js';
import { selectPolicy, redFlagResponse } from '../services/aiSafety.js';
import { logAudit } from '../services/auditService.js';
import {
  validatePlanContract,
  buildAdaptivePlan,
  applyPartialPlanEdit
} from '../services/planEngine.js';

const GENERATOR_WARNING_PATTERN = /fallback|tolerance|library|diagnostic/i;

function userFacingPlan(plan) {
  if (!plan || typeof plan !== 'object') return plan;
  const safetyFlags = Array.isArray(plan.safetyFlags) ? plan.safetyFlags : [];
  const leakedFlags = safetyFlags.filter(flag => typeof flag === 'string' && GENERATOR_WARNING_PATTERN.test(flag));
  return {
    ...plan,
    safetyFlags: safetyFlags.filter(flag => typeof flag === 'string' && !GENERATOR_WARNING_PATTERN.test(flag)),
    generationDiagnostics: [
      ...(Array.isArray(plan.generationDiagnostics) ? plan.generationDiagnostics : []),
      ...leakedFlags
    ]
  };
}

export function registerPlanRoutes(app) {
  app.post('/api/plans/generate', optionalAuth, (req, res) => {
    const isGuest = !req.user || req.user.guest === true;
    let storedProfile = {};
    if (req.user?.sub) {
      const profileRow = db.prepare('SELECT profile_json FROM profiles WHERE user_id = ?').get(req.user.sub);
      storedProfile = json(profileRow?.profile_json, {});
    }
    const mergedInput = { ...storedProfile, ...(req.body || {}) };

    const notesText = [
      mergedInput.notes,
      ...(Array.isArray(mergedInput.limitations) ? mergedInput.limitations : [mergedInput.limitation])
    ].filter(Boolean).join(' ');
    if (notesText && selectPolicy('vyora', notesText).escalate) {
      logAudit({
        actorId: req.user?.sub || null,
        action: 'plan.red_flag_blocked',
        targetType: 'plan',
        outcome: 'escalated'
      });
      return res.status(422).json({
        code: 'SAFETY_RED_FLAG',
        error: 'Cannot generate a workout or diet plan for emergency or severe symptoms. Please seek urgent medical care.',
        escalation: redFlagResponse()
      });
    }

    const generatedPlan = buildAdaptivePlan(mergedInput);
    const publicPlan = userFacingPlan(generatedPlan);
    const validation = validatePlanContract(generatedPlan);
    if (!validation.valid) {
      return res.status(500).json({ error: 'Generated plan failed server schema validation.', details: validation.errors });
    }

    const kind = publicPlan.planType;
    const title = str(req.body?.title, 120) || `${publicPlan.goal} adaptive plan (v${publicPlan.version})`;
    const now = isoNow();

    // Authenticated non-guest users: persist. Guests / unauthenticated: return only.
    if (!isGuest && req.user?.sub) {
      const planId = id();
      db.prepare(
        'INSERT INTO plans(id,user_id,kind,title,plan_json,model,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)'
      ).run(planId, req.user.sub, kind, title, JSON.stringify(generatedPlan), 'vyora-plan-engine-v2', now, now);

      logAudit({
        actorId: req.user.sub,
        action: 'plan.generated',
        targetType: 'plan',
        targetId: planId,
        metadata: { kind, goal: publicPlan.goal, version: publicPlan.version, guest: false }
      });

      return res.status(201).json({
        id: planId,
        kind,
        title,
        version: publicPlan.version,
        plan: publicPlan,
        validation,
        createdAt: now,
        guest: false,
        persisted: true
      });
    }

    return res.status(200).json({
      id: null,
      kind,
      title,
      version: publicPlan.version,
      plan: publicPlan,
      validation,
      createdAt: now,
      guest: true,
      persisted: false
    });
  });

  app.patch('/api/plans/:id', authOnly, (req, res) => {
    const row = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
    if (!row) return res.status(404).json({ error: 'Plan not found' });

    const instruction = str(req.body?.instruction || req.body?.prompt || '', 500);
    if (instruction && selectPolicy('vyora', instruction).escalate) {
      logAudit({ actorId: req.user.sub, action: 'plan.edit_red_flag_blocked', targetType: 'plan', targetId: row.id, outcome: 'escalated' });
      return res.status(422).json({
        code: 'SAFETY_RED_FLAG',
        error: 'Severe or emergency symptoms detected. Please pause activity and seek urgent medical assessment.',
        escalation: redFlagResponse()
      });
    }

    const currentPlan = json(row.plan_json, {});
    const editResult = applyPartialPlanEdit(currentPlan, req.body || {});
    const validation = validatePlanContract(editResult.plan);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Edited plan failed schema validation.', details: validation.errors });
    }

    const now = isoNow();
    db.prepare('UPDATE plans SET plan_json = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(editResult.plan), now, row.id, req.user.sub);

    logAudit({
      actorId: req.user.sub,
      action: 'plan.partial_edit',
      targetType: 'plan',
      targetId: row.id,
      metadata: { version: editResult.version, whatChanged: editResult.whatChanged }
    });

    res.json({
      id: row.id,
      kind: row.kind,
      title: row.title,
      version: editResult.version,
      whatChanged: editResult.whatChanged,
      why: editResult.why,
      explanation: editResult.explanation,
      plan: editResult.plan,
      updatedAt: now
    });
  });

  app.post('/api/plans', authOnly, (req, res) => {
    const kind = ['diet', 'workout', 'combined'].includes(req.body?.kind) ? req.body.kind : 'combined';
    const title = str(req.body?.title, 120) || `${kind === 'combined' ? 'Fitness' : kind} plan`;
    const plan = req.body?.plan;
    if (!plan || typeof plan !== 'object') return res.status(400).json({ error: 'plan object is required' });
    const planId = id(), now = isoNow();
    db.prepare('INSERT INTO plans(id,user_id,kind,title,plan_json,model,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(planId, req.user.sub, kind, title, JSON.stringify(plan), str(req.body?.model, 80), now, now);
    res.status(201).json({ id: planId, kind, title, plan, createdAt: now });
  });

  app.get('/api/plans', authOnly, (req, res) => res.json(
    db.prepare('SELECT id,kind,title,plan_json,model,created_at,updated_at FROM plans WHERE user_id=? ORDER BY created_at DESC LIMIT 100')
      .all(req.user.sub)
      .map(p => ({ ...p, plan: userFacingPlan(json(p.plan_json)), createdAt: p.created_at, updatedAt: p.updated_at, plan_json: undefined, created_at: undefined, updated_at: undefined }))
  ));

  app.get('/api/plans/:id', authOnly, (req, res) => {
    const p = db.prepare('SELECT * FROM plans WHERE id=? AND user_id=?').get(req.params.id, req.user.sub);
    if (!p) return res.status(404).json({ error: 'Plan not found' });
    res.json({ ...p, plan: userFacingPlan(json(p.plan_json)) });
  });

  app.delete('/api/plans/:id', authOnly, (req, res) => {
    const r = db.prepare('DELETE FROM plans WHERE id=? AND user_id=?').run(req.params.id, req.user.sub);
    if (!r.changes) return res.status(404).json({ error: 'Plan not found' });
    res.json({ ok: true });
  });
}
