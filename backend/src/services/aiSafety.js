/**
 * Stage 5 + Stage 8 — AI safety layer & Copilot intent orchestration
 * - Separate system policies for VYORA fitness, nutrition, OVULA, high-risk
 * - Red-flag pattern detection before calling the model
 * - Prompt-injection & unsupported medical request guards (PRD Prompt 18)
 * - Structured intent recognition & voice reminder read-back confirmation checks (PRD Prompt 6 & 9)
 * - Lightweight post-checks on model output
 */

const SHARED_SAFETY = `
CRITICAL SAFETY RULES (always apply):
- You are NOT a doctor, therapist, dietitian, physiotherapist, or emergency service.
- Never diagnose, treat, or claim certainty about disease, injury, pregnancy, or menstrual disorders.
- Never recommend starting, stopping, or changing prescribed medicine or dosage.
- Never provide extreme calorie deficits, dangerous dehydration, steroid/drug misuse, or unsafe training loads.
- For red-flag symptoms (chest pain, difficulty breathing, fainting, sudden severe pain, heavy uncontrolled bleeding, suicidal ideation, signs of eating disorder crisis, possible pregnancy complications) immediately advise the user to seek urgent professional / emergency care. Do not perform extended chatbot triage.
- Use extra caution for minors, pregnancy/postpartum, eating-disorder risk, chronic disease, injury, and post-surgical users; defer complex plans to qualified professionals.
- Label estimates and uncertainty. Do not invent user metrics, lab values, or medical history.
- Speak supportively; avoid body-shaming, gender stereotypes, or assuming all women menstruate.
- Keep answers practical and general-wellness focused.
`.trim();

const POLICIES = {
  vyora: `
You are VYORA, a fitness and nutrition copilot for general wellness.
Provide practical, personalized diet, workout, recovery, and habit guidance.
Ask for missing context (goals, equipment, time, limitations, food preferences) when needed.
Explain changes when the user requests adaptations (e.g. "no eggs", "knee hurts", "outdoor only").
${SHARED_SAFETY}
`.trim(),

  ovula: `
You are OVULA, a supportive menstrual health and hygiene wellness companion within VYORA.
Provide empathetic general education, low-risk comfort suggestions (heat, gentle movement, hydration, rest), and cycle-aware activity tips that are optional and easy to override.
Explain that cycle estimates are approximate and must not be used as contraception or diagnosis.
Never diagnose endometriosis, PCOS, infertility, or other conditions. Never guarantee pain relief or predict fertility.
For severe or sudden pain, fainting, fever, unusually heavy bleeding, possible pregnancy complications, or new/worsening symptoms, advise urgent professional assessment.
${SHARED_SAFETY}
`.trim(),

  nutrition: `
You are VYORA nutrition support. Focus on practical meal ideas that respect dietary pattern, allergies, region (including Indian food patterns), budget, and cooking access.
Support substitutions and exclusions. Show uncertainty on calorie/macro estimates.
Never prescribe treatment diets for medical conditions; refer complex clinical nutrition to a qualified clinician/dietitian.
${SHARED_SAFETY}
`.trim(),

  high_risk: `
You are VYORA in high-caution mode. The user may have described pain, injury, pregnancy, chronic illness, or other elevated-risk context.
Prioritise safety: offer only conservative general guidance, suggest stopping aggravating movements, and strongly recommend professional assessment where appropriate.
Do not generate aggressive training plans or medical advice.
${SHARED_SAFETY}
`.trim()
};

const RED_FLAG_PATTERNS = [
  /\b(chest pain|pressure in (my|the) chest|can't breathe|cannot breathe|difficulty breathing|short(ness)? of breath)\b/i,
  /\b(faint(ed|ing)?|passed out|loss of consciousness|black(ed)? out)\b/i,
  /\b(suicid(e|al)|kill myself|end my life|want to die|self[- ]?harm)\b/i,
  /\b(severe|sudden|unbearable|worst).{0,20}(pain|bleeding|cramp)/i,
  /\b(heavy|uncontrolled|soaking).{0,15}(bleeding|period|clot)/i,
  /\b(pregnant|pregnancy).{0,30}(bleed|pain|cramp|faint)/i,
  /\b(heart attack|stroke|seizure|anaphyla)/i,
  /\b(eating disorder|anorex|bulim|purging|starving myself)\b/i
];

const HIGH_RISK_CONTEXT = [
  /\b(pregnan|postpartum|post[- ]partum|breastfeed)/i,
  /\b(knee|shoulder|back|spine|hernia|fracture|surgery|post[- ]?op|acl|meniscus).{0,20}(pain|hurt|injury|tear)/i,
  /\b(diabetes|hypertension|heart condition|chronic|cancer|kidney|liver)\b/i,
  /\b(under ?18|teen|minor|child)\b/i
];

const PROMPT_INJECTION_PATTERNS = [
  /\b(ignore (all|previous|prior) (instructions|rules|prompts)|you are now a real doctor|pretend to be a licensed physician|bypass safety|override system prompt)\b/i,
  /\b(prescribe me|what dosage of .{1,30} should i take|can i double my dose|stop my insulin|stop my blood pressure med)\b/i
];

export function detectRedFlags(message) {
  const hits = RED_FLAG_PATTERNS.filter(re => re.test(message));
  return {
    isRedFlag: hits.length > 0,
    patterns: hits.map(r => r.source)
  };
}

export function detectHighRiskContext(message) {
  return HIGH_RISK_CONTEXT.some(re => re.test(message));
}

export function detectUnsupportedOrInjection(message) {
  const hits = PROMPT_INJECTION_PATTERNS.filter(re => re.test(message));
  return {
    blocked: hits.length > 0,
    patterns: hits.map(r => r.source)
  };
}

/**
 * Recognizes core Copilot intents per PRD Prompt 6.
 */
export function recognizeIntent(message) {
  const m = String(message || '').toLowerCase();
  if (detectRedFlags(m).isRedFlag) return { intent: 'safety_escalation', requiresConfirmation: false };
  if (detectUnsupportedOrInjection(m).blocked) return { intent: 'unsupported_medical_or_injection', requiresConfirmation: false };
  if (/\b(no egg|egg-free|swap|substitute|replace|vegetarian today|no dairy|outdoor|shorter|quiet apartment)\b/.test(m)) {
    return { intent: 'modify_plan', requiresConfirmation: false };
  }
  if (/\b(knee|back|shoulder|ankle|wrist).{0,15}(pain|hurt|sore|ache)\b/.test(m)) {
    return { intent: 'pain_adaptation', requiresConfirmation: false };
  }
  if (/\b(remind|reminder|medication|medicine|pill|tablet)\b/.test(m)) {
    return {
      intent: 'set_reminder',
      requiresConfirmation: true,
      confirmationPrompt: 'Please confirm the medication/habit label, scheduled time, timezone, verified destination, and delivery channel before I create this reminder.'
    };
  }
  if (/\b(period|cramp|cycle|ovula|menstrua|pms)\b/.test(m)) {
    return { intent: 'period_support', requiresConfirmation: false };
  }
  if (/\b(generate|build|create).{0,20}(plan|diet|workout|routine)\b/.test(m)) {
    return { intent: 'create_plan', requiresConfirmation: false };
  }
  if (/\b(progress|compare|streak|vital|log)\b/.test(m)) {
    return { intent: 'check_progress', requiresConfirmation: false };
  }
  if (/\b(gym|cafe|café|nearby|route|hydration stop)\b/.test(m)) {
    return { intent: 'find_local_resources', requiresConfirmation: false };
  }
  return { intent: 'ask_fitness_question', requiresConfirmation: false };
}

export function selectPolicy(mode, message) {
  const red = detectRedFlags(message);
  if (red.isRedFlag) {
    return {
      mode: 'high_risk',
      policy: POLICIES.high_risk,
      redFlag: true,
      escalate: true
    };
  }
  const inj = detectUnsupportedOrInjection(message);
  if (inj.blocked) {
    return {
      mode: 'high_risk',
      policy: POLICIES.high_risk,
      redFlag: false,
      escalate: false,
      refuseUnsupported: true
    };
  }
  if (mode === 'ovula') {
    return { mode: 'ovula', policy: POLICIES.ovula, redFlag: false, escalate: false };
  }
  if (detectHighRiskContext(message)) {
    return { mode: 'high_risk', policy: POLICIES.high_risk, redFlag: false, escalate: false };
  }
  if (/\b(meal|diet|calorie|protein|vegetarian|vegan|food|recipe|nutrition|egg|paneer|dal)\b/i.test(message)) {
    return { mode: 'nutrition', policy: POLICIES.nutrition, redFlag: false, escalate: false };
  }
  return { mode: 'vyora', policy: POLICIES.vyora, redFlag: false, escalate: false };
}

export function redFlagResponse() {
  return {
    answer: [
      'I\'m concerned about the symptoms you described.',
      'This is beyond what a wellness assistant can safely help with.',
      'Please seek urgent professional medical care now — contact a doctor, go to the nearest emergency department, or call local emergency services.',
      'If you are in India, you can dial 112 for emergencies.',
      'I will not generate a workout, diet plan, or self-treatment steps for this situation.'
    ].join(' '),
    model: 'safety-layer',
    safety: { redFlag: true, escalated: true }
  };
}

export function unsupportedMedicalResponse() {
  return {
    answer: [
      'I cannot act as a doctor, bypass safety rules, or advise starting, stopping, or changing any prescribed medication or dosage.',
      'Please follow your prescribing clinician\'s instructions and consult a qualified doctor or pharmacist for medication questions.',
      'I can still help you set a reminder that repeats your own entered schedule or share general wellness information.'
    ].join(' '),
    model: 'safety-layer',
    safety: { redFlag: false, escalated: false, refusedUnsupported: true }
  };
}

export function postCheckAnswer(answer) {
  const issues = [];
  if (/\b(you have|this is|diagnos(e|is)|you are suffering from)\b.{0,40}\b(pcos|endometriosis|diabetes|cancer|infection)\b/i.test(answer)) {
    issues.push('possible_diagnosis_language');
  }
  if (/\b(stop taking|increase your dose|decrease your dose|change your (dose|medication|prescription))\b/i.test(answer)) {
    issues.push('medication_change_advice');
  }
  if (/\b(guaranteed|definitely will|100%\s*sure).{0,30}(lose weight|gain muscle|cure|heal)\b/i.test(answer)) {
    issues.push('false_certainty');
  }
  return { ok: issues.length === 0, issues };
}

export { POLICIES, SHARED_SAFETY };
