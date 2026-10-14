/**
 * Stage 10 — AI Copilot Chat, Bounded Memory & Safety Incident Reporting Routes
 */
import { db, isoNow } from '../db.js';
import { id, str, json } from '../utils/helpers.js';
import { authOnly } from '../middleware/auth.js';
import {
  selectPolicy,
  redFlagResponse,
  unsupportedMedicalResponse,
  recognizeIntent,
  postCheckAnswer
} from '../services/aiSafety.js';
import { logAudit } from '../services/auditService.js';

export function getUserMemory(userId) {
  const row = db.prepare('SELECT memory_json, updated_at FROM copilot_memory WHERE user_id = ?').get(userId);
  const items = json(row?.memory_json, []);
  return {
    items: Array.isArray(items) ? items.slice(-12) : [],
    updatedAt: row?.updated_at || null
  };
}

export function saveUserMemory(userId, items) {
  const bounded = (Array.isArray(items) ? items : [])
    .map(x => str(typeof x === 'string' ? x : x?.note || x?.text || '', 240))
    .filter(Boolean)
    .slice(-12);
  const now = isoNow();
  db.prepare(
    `INSERT INTO copilot_memory (user_id, memory_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET memory_json = excluded.memory_json, updated_at = excluded.updated_at`
  ).run(userId, JSON.stringify(bounded), now);
  return { items: bounded, updatedAt: now };
}

export function registerChatRoutes(app) {
  app.get('/api/chat/memory', authOnly, (req, res) => {
    res.json(getUserMemory(req.user.sub));
  });

  app.put('/api/chat/memory', authOnly, (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const saved = saveUserMemory(req.user.sub, items);
    logAudit({ actorId: req.user.sub, action: 'copilot.memory_updated', targetType: 'copilot_memory', targetId: req.user.sub, metadata: { count: saved.items.length } });
    res.json(saved);
  });

  app.delete('/api/chat/memory', authOnly, (req, res) => {
    db.prepare('DELETE FROM copilot_memory WHERE user_id = ?').run(req.user.sub);
    logAudit({ actorId: req.user.sub, action: 'copilot.memory_cleared', targetType: 'copilot_memory', targetId: req.user.sub });
    res.json({ ok: true, items: [], message: 'Conversation memory cleared.' });
  });

  app.post('/api/ai/report', authOnly, (req, res) => {
    const reason = str(req.body?.reason, 300);
    if (!reason) return res.status(400).json({ error: 'A reason is required to report an AI response.' });
    const reportId = id(), now = isoNow();
    const mode = req.body?.mode === 'ovula' ? 'ovula' : 'vyora';
    db.prepare(
      `INSERT INTO ai_safety_reports (id, user_id, mode, user_message, ai_response, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      reportId,
      req.user.sub,
      mode,
      str(req.body?.userMessage, 1000) || null,
      str(req.body?.aiResponse, 2000) || null,
      reason,
      now
    );
    logAudit({ actorId: req.user.sub, action: 'ai.safety_reported', targetType: 'ai_safety_report', targetId: reportId, metadata: { mode, reason } });
    res.status(201).json({ id: reportId, status: 'open', createdAt: now, message: 'Thank you. Your report has been logged for safety review.' });
  });

  async function handleChatRequest(req, res) {
    const message = str(req.body?.message, 5000);
    const mode = req.body?.mode === 'ovula' ? 'ovula' : 'vyora';
    const context = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
    if (!message) return res.status(400).json({ error: 'Message is required.' });

    const intentInfo = recognizeIntent(message);
    const policyInfo = selectPolicy(mode, message);

    if (policyInfo.escalate) {
      logAudit({ actorId: req.user.sub, action: 'ai.red_flag_escalation', targetType: 'chat', metadata: { mode } });
      return res.json({ ...redFlagResponse(), intent: intentInfo });
    }
    if (policyInfo.refuseUnsupported) {
      logAudit({ actorId: req.user.sub, action: 'ai.unsupported_medical_refusal', targetType: 'chat', metadata: { mode } });
      return res.json({ ...unsupportedMedicalResponse(), intent: intentInfo });
    }

    if (req.body?.rememberPreference === true || /\b(no eggs|vegetarian|vegan|knee hurts|knee pain|prefer outdoor)\b/i.test(message)) {
      const currentMem = getUserMemory(req.user.sub).items;
      const snippet = str(message, 140);
      if (!currentMem.includes(snippet)) {
        saveUserMemory(req.user.sub, [...currentMem, snippet]);
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'Gemini is not configured. Set GEMINI_API_KEY in the server environment.',
        intent: intentInfo
      });
    }

    const memItems = getUserMemory(req.user.sub).items;
    const memoryContext = memItems.length
      ? `\nUser-controlled memory notes (user can edit/clear these): ${memItems.join(' | ')}`
      : '';

    const contents = [
      ...context.filter(x => x && ['user', 'model'].includes(x.role) && typeof x.text === 'string').map(x => ({ role: x.role, parts: [{ text: x.text.slice(0, 2000) }] })),
      { role: 'user', parts: [{ text: message }] }
    ];

    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: policyInfo.policy + memoryContext }] },
          contents,
          generationConfig: { temperature: 0.55, maxOutputTokens: 1400 }
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status === 429 ? 429 : 502).json({ error: data?.error?.message || 'Gemini request failed.' });
      const answer = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim();
      if (!answer) return res.status(502).json({ error: 'AI returned an empty answer.' });

      const check = postCheckAnswer(answer);
      res.json({
        answer,
        model,
        intent: intentInfo,
        safety: { mode: policyInfo.mode, redFlag: false, postCheck: check }
      });
    } catch {
      res.status(502).json({ error: 'Could not reach Gemini. Check backend network and API key.' });
    }
  }

  app.post('/api/chat', authOnly, handleChatRequest);
  app.post('/api/ai/chat', authOnly, handleChatRequest);
}
