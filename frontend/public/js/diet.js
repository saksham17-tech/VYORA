// Diet tab — renders active plan meals from localStorage
(function () {
  const ACTIVE_PLAN_KEY = 'vyora_active_plan';
  const statusEl = document.getElementById('dietPlanStatus');
  const macrosEl = document.getElementById('dietMacros');
  const summaryEl = document.getElementById('dietSummary');
  const tabsEl = document.getElementById('dietDayTabs');
  const mealsEl = document.getElementById('dietMeals');
  const totalEl = document.getElementById('dietDayTotal');
  if (!macrosEl || !mealsEl) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function readActivePlan() {
    try {
      const raw = localStorage.getItem(ACTIVE_PLAN_KEY);
      if (!raw) return null;
      const wrapper = JSON.parse(raw);
      return wrapper.plan || wrapper;
    } catch {
      return null;
    }
  }

  function placeholder() {
    if (statusEl) statusEl.textContent = 'No active plan found. Head to the Home page to build your custom plan.';
    macrosEl.replaceChildren();
    if (summaryEl) summaryEl.replaceChildren();
    if (tabsEl) tabsEl.replaceChildren();
    mealsEl.replaceChildren();
    if (totalEl) totalEl.textContent = '';
  }

  function renderDay(day, plan) {
    mealsEl.replaceChildren();
    const dailyMeals = (plan.meals || []).filter(meal => meal.day === day);
    if (!dailyMeals.length) {
      mealsEl.appendChild(el('p', 'bottom-note', 'No meals scheduled for this day.'));
      if (totalEl) totalEl.textContent = '';
      return;
    }
    dailyMeals.forEach((meal, index) => {
      const row = el('div', 'meal');
      if (index === dailyMeals.length - 1) row.style.border = 'none';
      row.appendChild(el('b', '', `${meal.slot}: ${meal.title || ''}`));
      const items = el('p', '', Array.isArray(meal.items) ? meal.items.join(' · ') : '');
      items.style.margin = '2px 0';
      row.appendChild(items);
      const meta = el('small', '', `${meal.approxKcal || 0} kcal · ${meal.approxProteinG || 0} g protein`);
      meta.style.opacity = '0.8';
      row.appendChild(meta);
      mealsEl.appendChild(row);
    });
    const total = (plan.dailyTotals || []).find(entry => entry.day === day);
    if (totalEl) {
      totalEl.textContent = total
        ? `Total: ${total.kcal} kcal | ${total.proteinG} g protein | ${total.carbsG} g carbs | ${total.fatG} g fat`
        : '';
    }
  }

  function renderPlan(plan) {
    if (!plan || !Array.isArray(plan.meals) || !plan.meals.length) {
      placeholder();
      return;
    }
    if (statusEl) statusEl.textContent = '';

    const meta = plan.estimateMetadata || {};
    macrosEl.replaceChildren();
    [
      ['Daily target', meta.estimatedDailyKcal ? `${meta.estimatedDailyKcal} kcal` : null],
      ['Protein', meta.estimatedProteinG ? `${meta.estimatedProteinG} g` : null],
      ['Carbs', meta.estimatedCarbsG ? `${meta.estimatedCarbsG} g` : null],
      ['Fat', meta.estimatedFatG ? `${meta.estimatedFatG} g` : null]
    ].forEach(([label, value]) => {
      if (!value) return;
      const line = el('div', 'macro');
      line.appendChild(el('span', '', `${label} · ${value}`));
      macrosEl.appendChild(line);
    });

    if (summaryEl) {
      summaryEl.replaceChildren();
      if (plan.explanation) summaryEl.appendChild(el('p', 'bottom-note', plan.explanation));
      const disclaimer = meta.disclaimer || 'Calorie and macro estimates are approximate.';
      summaryEl.appendChild(el('p', 'bottom-note', disclaimer));
    }

    const days = [...new Set((plan.meals || []).map(meal => meal.day).filter(Boolean))];
    if (tabsEl) {
      tabsEl.replaceChildren();
      let selected = days[0];
      days.forEach((day, index) => {
        const button = el('button', index === 0 ? 'day-tab active' : 'day-tab', day);
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.addEventListener('click', () => {
          selected = day;
          tabsEl.querySelectorAll('button').forEach(node => node.classList.remove('active'));
          button.classList.add('active');
          renderDay(day, plan);
        });
        tabsEl.appendChild(button);
      });
      if (selected) renderDay(selected, plan);
    } else if (days[0]) {
      renderDay(days[0], plan);
    }
  }

  function refresh() {
    renderPlan(readActivePlan());
  }

  refresh();
  window.addEventListener('vyora:plan-updated', refresh);
  window.addEventListener('storage', (event) => {
    if (event.key === ACTIVE_PLAN_KEY) refresh();
  });
})();
