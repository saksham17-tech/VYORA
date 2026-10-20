// Workout tab — renders active plan from localStorage (guest or saved)
(function () {
  const ACTIVE_PLAN_KEY = 'vyora_active_plan';
  const dayTabs = document.getElementById('dayTabs');
  const exList = document.getElementById('exList');
  const statusEl = document.getElementById('workoutPlanStatus');
  const progressionEl = document.getElementById('workoutProgression');
  if (!dayTabs || !exList) return;

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

  const reviewEl = document.getElementById('workoutGeminiReview');

  function setReview(text) {
    if (!reviewEl) return;
    if (!text) {
      reviewEl.style.display = 'none';
      reviewEl.replaceChildren();
      return;
    }
    reviewEl.style.display = '';
    reviewEl.replaceChildren();
    const title = document.createElement('h3');
    title.style.marginTop = '0';
    title.textContent = 'Gemini AI Plan Review';
    const body = document.createElement('p');
    body.style.margin = '0';
    body.style.whiteSpace = 'pre-wrap';
    body.textContent = text;
    reviewEl.append(title, body);
  }

  function placeholder() {
    dayTabs.replaceChildren();
    exList.replaceChildren();
    if (progressionEl) progressionEl.textContent = '';
    if (statusEl) {
      statusEl.textContent = 'No active plan found. Head to the Home page to build your custom plan.';
    }
    setReview('');
  }

  function renderDay(day, plan) {
    exList.replaceChildren();
    const session = (plan.days || []).find(d => d.day === day);
    if (!session) {
      exList.appendChild(el('p', 'bottom-note', 'No session scheduled for this day.'));
      return;
    }
    const header = el('div', 'exrow');
    header.appendChild(el('div', 'exname', `${session.day} · ${session.focus || ''} (${session.durationMin || 30}m · ${session.environment || 'flexible'})`));
    if (session.warmUp) header.appendChild(el('div', 'exmeta', `Warm-up: ${session.warmUp}`));
    exList.appendChild(header);

    (session.exercises || []).forEach(exercise => {
      const row = el('div', 'exrow');
      const name = el('div', 'exname', exercise.name || 'Exercise');
      const metaParts = [exercise.prescription, exercise.rest ? `Rest ${exercise.rest}` : null, exercise.intensityRpe]
        .filter(Boolean)
        .join(' · ');
      const meta = el('div', 'exmeta', metaParts);
      if (exercise.formCue) {
        meta.appendChild(document.createTextNode(` · ${exercise.formCue}`));
      }
      const demo = document.createElement('a');
      demo.textContent = 'Watch demo ↗';
      demo.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.videoQuery || exercise.name || 'exercise form')}`;
      demo.target = '_blank';
      demo.rel = 'noopener noreferrer';
      demo.style.marginLeft = '8px';
      demo.style.fontSize = '12px';
      meta.appendChild(demo);
      row.append(name, meta);
      exList.appendChild(row);
    });

    if (session.coolDown) {
      const cool = el('div', 'exrow');
      cool.appendChild(el('div', 'exmeta', `Cool-down: ${session.coolDown}`));
      exList.appendChild(cool);
    }
  }

  function renderPlan(plan) {
    if (!plan || !Array.isArray(plan.days) || !plan.days.length) {
      placeholder();
      return;
    }
    if (statusEl) statusEl.textContent = '';
    if (progressionEl) progressionEl.textContent = plan.weeklyProgressionNote || '';
    setReview(plan.geminiReviewText || '');

    const days = plan.days.map(d => d.day);
    dayTabs.replaceChildren();
    let selected = days[0];

    days.forEach((day, index) => {
      const button = el('button', index === 0 ? 'active' : '', day);
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => {
        selected = day;
        dayTabs.querySelectorAll('button').forEach(node => node.classList.remove('active'));
        button.classList.add('active');
        renderDay(day, plan);
      });
      dayTabs.appendChild(button);
    });
    renderDay(selected, plan);
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
