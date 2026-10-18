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
    ],
    general: [
      ['Full Body Strength for Beginners', 'beginner full body strength workout'],
      ['Daily Mobility Routine', 'daily mobility routine'],
      ['Balanced Meal Planning Basics', 'balanced healthy meal planning']
    ]
  };

  const suppBank = {
    fatloss: ['Whey/plant protein', 'Multivitamin', 'Omega-3'],
    musclegain: ['Whey protein', 'Creatine monohydrate', 'Multivitamin'],
    recomp: ['Whey/plant protein', 'Creatine monohydrate', 'Omega-3'],
    endurance: ['Electrolyte mix', 'Multivitamin', 'Omega-3'],
    general: ['Multivitamin', 'Omega-3', 'Electrolyte mix']
  };

  let currentPlanId = null;
  let selectedDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clearPlanResults() {
    ['rDietSummary', 'rMeals', 'rWorkoutSummary', 'rWorkoutDays', 'rSupps', 'rVideos', 'rGyms', 'aiPlanText']
      .forEach(id => document.getElementById(id)?.replaceChildren());
  }

  function renderStructuredPlan(planWrapper) {
    const plan = planWrapper.plan || planWrapper;
    currentPlanId = planWrapper.id || currentPlanId;

    const dietSummary = document.getElementById('rDietSummary');
    const mealsBox = document.getElementById('rMeals');
    const workoutSummary = document.getElementById('rWorkoutSummary');
    const workoutDaysBox = document.getElementById('rWorkoutDays');

    mealsBox.replaceChildren();
    const metadata = plan.estimateMetadata || {};
    if (Array.isArray(plan.generationDiagnostics) && plan.generationDiagnostics.length) {
      console.debug('Plan generation diagnostics:', plan.generationDiagnostics);
    }
    const summary = el('div', 'plan-summary');
    [
      ['BMI', metadata.bmi],
      ['BMR', metadata.bmr ? `${metadata.bmr} kcal` : undefined],
      ['TDEE', metadata.tdee ? `${metadata.tdee} kcal` : undefined],
      ['Daily target', metadata.estimatedDailyKcal ? `${metadata.estimatedDailyKcal} kcal` : undefined],
      ['Protein', metadata.estimatedProteinG ? `${metadata.estimatedProteinG} g` : undefined],
      ['Carbs', metadata.estimatedCarbsG ? `${metadata.estimatedCarbsG} g` : undefined],
      ['Fat', metadata.estimatedFatG ? `${metadata.estimatedFatG} g` : undefined]
    ].forEach(([label, value]) => {
      if (value !== undefined) {
        const stat = el('div', 'plan-summary-stat');
        stat.append(el('small', '', label), el('strong', '', String(value)));
        summary.appendChild(stat);
      }
    });
    dietSummary.replaceChildren(summary);
    if (plan.explanation) dietSummary.appendChild(el('p', 'bottom-note', plan.explanation));
    const targetKcal = Number(metadata.estimatedDailyKcal);
    const targetProtein = Number(metadata.estimatedProteinG);
    const maxDeviation = (plan.dailyTotals || []).reduce((maximum, total) => {
      const kcalDeviation = targetKcal ? Math.abs(Number(total.kcal) - targetKcal) / targetKcal * 100 : 0;
      const proteinDeviation = targetProtein ? Math.abs(Number(total.proteinG) - targetProtein) / targetProtein * 100 : 0;
      return Math.max(
        maximum,
        kcalDeviation > 5 ? kcalDeviation : 0,
        proteinDeviation > 10 ? proteinDeviation : 0
      );
    }, 0);
    if (maxDeviation > 5) {
      dietSummary.appendChild(el('p', 'bottom-note', `Daily totals may differ from your target by up to ${Math.ceil(maxDeviation)}%.`));
    }

    const tabs = el('div', 'day-tabs');
    const dayMealsBox = el('div', 'day-meals');
    const dayTotal = el('p', 'day-total');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const renderDay = day => {
      selectedDay = days.includes(day) ? day : days[0];
      tabs.querySelectorAll('button').forEach(button => {
        button.classList.toggle('active', button.dataset.day === selectedDay);
        button.setAttribute('aria-selected', String(button.dataset.day === selectedDay));
      });
      dayMealsBox.replaceChildren();
      const dailyMeals = (plan.meals || []).filter(meal => meal.day === selectedDay);
      dailyMeals.forEach((m, idx) => {
        const mealDiv = el('div', 'meal');
        if (idx === dailyMeals.length - 1) mealDiv.style.border = 'none';
        const title = el('b', '', `${m.slot}: ${m.title || ''}`);
        const itemsP = el('p', '', Array.isArray(m.items) ? m.items.join(' · ') : String(m));
        itemsP.style.margin = '2px 0';
        const metaSmall = el('small', '', `${m.approxKcal || 0} kcal · ${m.approxProteinG || 0} g protein`);
        metaSmall.style.opacity = '0.8';
        mealDiv.append(title, itemsP, metaSmall);
        dayMealsBox.appendChild(mealDiv);
      });
      const total = (plan.dailyTotals || []).find(entry => entry.day === selectedDay);
      dayTotal.textContent = total
        ? `Total: ${total.kcal} kcal | ${total.proteinG} g protein | ${total.carbsG} g carbs | ${total.fatG} g fat`
        : 'Total unavailable';
    };
    days.forEach(day => {
      const button = el('button', 'day-tab', day);
      button.type = 'button';
      button.dataset.day = day;
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => renderDay(day));
      tabs.appendChild(button);
    });
    mealsBox.append(tabs, dayMealsBox, dayTotal);
    renderDay(selectedDay);
    const flags = (Array.isArray(plan.safetyFlags) ? plan.safetyFlags : [])
      .filter(flag => typeof flag === 'string' && !/fallback|tolerance|library|diagnostic/i.test(flag));
    if (flags.length) mealsBox.appendChild(el('p', 'plan-safety', `Safety notes: ${flags.join(' ')}`));
    mealsBox.appendChild(el('p', 'bottom-note', plan.estimateMetadata?.disclaimer || 'Calorie and macro estimates are approximate.'));

    workoutSummary.textContent = flags.join(' ');
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
          const updated = await window.VyoraAPI.patchPlan(currentPlanId, { ...payload, day: selectedDay });
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
    const age = Number(document.getElementById('pAge')?.value);
    const diet = document.getElementById('pDiet').value;
    const goal = document.getElementById('pGoal').value;
    const formError = document.getElementById('pFormError');
    const validationError = !Number.isFinite(h) || h < 120 || h > 230
      ? 'Height must be between 120 and 230 cm.'
      : !Number.isFinite(w) || w < 35 || w > 220
        ? 'Weight must be between 35 and 220 kg.'
        : !Number.isInteger(age) || age < 16 || age > 90
          ? 'Age must be between 16 and 90.'
          : '';
    formError.textContent = validationError;
    if (validationError) {
      clearPlanResults();
      document.getElementById('planResults').style.display = 'block';
      document.getElementById('rDietSummary').textContent = validationError;
      return;
    }
    formError.textContent = '';
    const activityLevel = document.getElementById('pActivity').value;
    const cuisine = document.getElementById('pCuisine').value;
    const allergies = [...document.querySelectorAll('#pAllergies input:checked')].map(input => input.value);
    const generateButton = document.getElementById('pGenerate');
    const planResults = document.getElementById('planResults');
    clearPlanResults();
    planResults.style.display = 'block';
    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';

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

    if (window.VyoraAPI?.generatePlan) {
      try {
        const generated = await window.VyoraAPI.generatePlan({
          heightCm: h,
          weightKg: w,
          age,
          gender,
          diet,
          goal,
          activityLevel,
          allergies,
          cuisine,
          planType: 'combined'
        });
        renderStructuredPlan(generated);
      } catch (e) {
        clearPlanResults();
        const message = e.message || 'Please try again.';
        const prefix = /401|unauthorized|login/i.test(message)
          ? 'Please sign in before generating a plan.'
          : /422|safety/i.test(message)
            ? `This profile needs a safety review before a plan can be generated: ${message}`
            : `Could not generate your plan: ${message}`;
        document.getElementById('rDietSummary').textContent = prefix;
      } finally {
        generateButton.disabled = false;
        generateButton.textContent = 'Generate my plan';
      }
    } else {
      clearPlanResults();
      document.getElementById('rDietSummary').textContent = 'The plan service is unavailable. Please try again later.';
      generateButton.disabled = false;
      generateButton.textContent = 'Generate my plan';
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
