/**
 * Stage 8 — Adaptive Plan Builder & Partial Regeneration UI
 * Calls `POST /api/plans/generate` and `PATCH /api/plans/:id` for conversational/quick swaps
 * ("No eggs today", "Make this an outdoor workout", "Shorter 20m session", "My knee hurts").
 * Renders all content using safe DOM nodes (no untrusted innerHTML).
 */
(function () {
  const videoBank = {
    fatloss: [
      ['Beginner Fat-Loss Workout (No Equipment)', 'fat loss workout no equipment'],
      ['HIIT Cardio for Beginners', 'beginner HIIT cardio'],
      ['How to Read Food Labels', 'how to read nutrition labels']
    ],
    musclegain: [
      ['Perfect Push-Pull-Legs Split', 'push pull legs split for beginners'],
      ['Bench Press Form Tutorial', 'bench press proper form'],
      ['High Protein Meal Prep', 'high protein meal prep for muscle gain']
    ],
    recomp: [
      ['Beginner Full Body Strength Routine', 'beginner full body strength workout'],
      ['Body Recomposition Explained', 'body recomposition explained'],
      ['Simple Meal Prep for Recomp', 'simple healthy meal prep']
    ],
    endurance: [
      ['Zone 2 Cardio Explained', 'zone 2 cardio training explained'],
      ['Beginner Interval Running Guide', 'beginner interval running workout'],
      ['Fueling for Endurance Training', 'nutrition for endurance athletes']
    ]
  };

  const suppBank = {
    fatloss: ['Whey/plant protein', 'Multivitamin', 'Omega-3'],
    musclegain: ['Whey protein', 'Creatine monohydrate', 'Multivitamin'],
    recomp: ['Whey/plant protein', 'Creatine monohydrate', 'Omega-3'],
    endurance: ['Electrolyte mix', 'Multivitamin', 'Omega-3']
  };

  let currentPlanId = null;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderStructuredPlan(planWrapper) {
    const plan = planWrapper.plan || planWrapper;
    currentPlanId = planWrapper.id || currentPlanId;

    const dietSummary = document.getElementById('rDietSummary');
    const mealsBox = document.getElementById('rMeals');
    const workoutSummary = document.getElementById('rWorkoutSummary');
    const workoutDaysBox = document.getElementById('rWorkoutDays');

    const kcalRange = plan.estimateMetadata?.dailyKcalRange || `~${plan.estimateMetadata?.estimatedDailyKcal || 1800} kcal/day`;
    const disclaimer = plan.estimateMetadata?.disclaimer || 'Approximate estimates (±15%).';
    dietSummary.textContent = `${plan.explanation || ''} Target range: ${kcalRange}. ${disclaimer}`;

    mealsBox.replaceChildren();
    (plan.meals || []).forEach((m, idx) => {
      const mealDiv = el('div', 'meal');
      if (idx === plan.meals.length - 1) mealDiv.style.border = 'none';
      const title = el('b', '', `${m.slot}: ${m.title || ''}`);
      const itemsP = el('p', '', Array.isArray(m.items) ? m.items.join(' · ') : String(m));
      itemsP.style.margin = '2px 0';
      const metaSmall = el('small', '', `${m.portionGuidance ? m.portionGuidance + ' · ' : ''}~${m.approxKcal || 450} kcal, ~${m.approxProteinG || 22}g protein (${m.uncertaintyLabel || 'approx.'})`);
      metaSmall.style.opacity = '0.8';
      mealDiv.append(title, itemsP, metaSmall);
      mealsBox.appendChild(mealDiv);
    });

    workoutSummary.textContent = (plan.safetyFlags || []).join(' ');
    workoutDaysBox.replaceChildren();
    (plan.days || []).forEach((d, idx) => {
      const row = el('div', 'exrow');
      if (idx === plan.days.length - 1) row.style.border = 'none';
      const dayLabel = el('div', 'exname', `${d.day} (${d.durationMin || 30}m · ${d.environment || 'flexible'})`);
      const exSummary = Array.isArray(d.exercises)
        ? d.exercises.map(e => `${e.name} [${e.prescription}]`).join(' · ')
        : String(d.focus || d);
      const dayMeta = el('div', 'exmeta', `${d.focus}: ${exSummary}`);
      row.append(dayLabel, dayMeta);
      workoutDaysBox.appendChild(row);
    });

    ensurePartialAdaptationBar();
  }

  function ensurePartialAdaptationBar() {
    const resultsBox = document.getElementById('planResults');
    if (!resultsBox || document.getElementById('partialSwapCard')) return;

    const card = el('div', 'card');
    card.id = 'partialSwapCard';
    card.style.marginTop = '14px';

    const h = el('h3', '', 'Quick Conversational Plan Adaptations (Partial Regeneration)');
    h.style.marginTop = '0';
    const desc = el('p', 'bottom-note', 'Modify only the affected meal or workout segment while preserving the rest of your plan:');

    const btnRow = el('div', 'chat-row');
    btnRow.style.flexWrap = 'wrap';

    const swaps = [
      ['No eggs today', { instruction: 'No eggs today', mealSlot: 'Breakfast' }],
      ['No dairy snack', { instruction: 'No dairy today', mealSlot: 'Snack' }],
      ['Make Mon outdoor', { instruction: 'Make this an outdoor workout', day: 'Mon' }],
      ['Shorter 20m session', { instruction: 'Shorter 20 min workout today', day: 'Mon' }],
      ['My knee hurts', { instruction: 'My knee hurts today, give low-impact alternatives', day: 'Mon' }]
    ];

    const status = el('p', 'bottom-note', '');
    status.id = 'partialSwapStatus';
    status.setAttribute('aria-live', 'polite');

    swaps.forEach(([label, payload]) => {
      const b = el('button', 'btn ghost', label);
      b.addEventListener('click', async () => {
        if (!currentPlanId || !window.VyoraAPI?.patchPlan) {
          status.textContent = 'Generate a plan first before applying partial adaptations.';
          return;
        }
        try {
          status.textContent = `Applying "${label}"…`;
          const updated = await window.VyoraAPI.patchPlan(currentPlanId, payload);
          renderStructuredPlan(updated);
          status.textContent = `v${updated.version}: ${updated.whatChanged} (${updated.why})`;
        } catch (err) {
          status.textContent = 'Could not apply adaptation: ' + err.message;
        }
      });
      btnRow.appendChild(b);
    });

    card.append(h, desc, btnRow, status);
    resultsBox.prepend(card);
  }

  document.getElementById('pGenerate')?.addEventListener('click', async () => {
    const h = parseFloat(document.getElementById('pHeight').value);
    const w = parseFloat(document.getElementById('pWeight').value);
    const gender = document.getElementById('pGender').value;
    const age = Math.max(18, Math.min(100, Number(document.getElementById('pAge')?.value) || 25));
    const diet = document.getElementById('pDiet').value;
    const goal = document.getElementById('pGoal').value;
    if (!h || !w) {
      alert('Please add your height and weight first.');
      return;
    }

    // Render supplements & demo videos using safe DOM APIs
    const suppsBox = document.getElementById('rSupps');
    suppsBox.replaceChildren();
    (suppBank[goal] || suppBank.recomp).forEach((s) => {
      suppsBox.appendChild(el('span', 'tag', s));
    });

    const videosBox = document.getElementById('rVideos');
    videosBox.replaceChildren();
    (videoBank[goal] || videoBank.recomp).forEach(([title, q]) => {
      const vc = el('div', 'vid-card', title + ' ');
      const a = el('a', '', 'Watch demo ↗');
      a.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      vc.appendChild(a);
      videosBox.appendChild(vc);
    });

    const gymBox = document.getElementById('rGyms');
    gymBox.replaceChildren();
    gymBox.appendChild(el('p', 'bottom-note', 'Use Gyms & Cafés to save verified local training destinations. Live listings require a configured maps provider.'));

    document.getElementById('planResults').style.display = 'block';

    if (window.VyoraAPI?.generatePlan) {
      try {
        const generated = await window.VyoraAPI.generatePlan({
          heightCm: h,
          weightKg: w,
          age,
          gender,
          diet,
          goal,
          planType: 'combined'
        });
        renderStructuredPlan(generated);
      } catch (e) {
        console.warn('Could not generate server plan:', e.message);
      }
    }

    document.getElementById('planResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const aiStatus = document.getElementById('aiPlanStatus');
    const aiText = document.getElementById('aiPlanText');
    aiStatus.textContent = 'Asking Gemini to review your plan…';
    aiText.textContent = '';
    if (window.VyoraAPI) {
      const prompt = `Create a practical, safe starter fitness plan review. Profile: height ${h} cm, weight ${w} kg, age ${age}, gender ${gender}, goal ${goal}, diet preference ${diet}. Mention uncertainty on calorie estimates and advise clinician consultation for health conditions.`;
      window.VyoraAPI.chat(prompt, 'vyora')
        .then((answer) => {
          aiStatus.textContent = 'Gemini plan review (AI-generated general wellness guidance)';
          aiText.textContent = answer;
        })
        .catch((err) => {
          aiStatus.textContent = 'Gemini review unavailable: ' + err.message + '. Your server-validated adaptive plan above is ready and editable.';
        });
    }
  });
})();
