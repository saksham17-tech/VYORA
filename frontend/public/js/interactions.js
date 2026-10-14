/* VYORA interaction layer — Stage 10: XSS-free DOM construction, WCAG keyboard/focus controls & command palette. */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  function makeBtn(action, title, label, text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.vyoraAction = action;
    b.title = title;
    b.setAttribute('aria-label', label);
    b.textContent = text;
    return b;
  }

  const progress = document.createElement('div');
  progress.className = 'vyora-progress'; progress.setAttribute('aria-hidden', 'true');
  const cursor = document.createElement('div'); cursor.className = 'vyora-cursor'; cursor.setAttribute('aria-hidden', 'true');
  const spotlight = document.createElement('div'); spotlight.className = 'vyora-spotlight'; spotlight.setAttribute('aria-hidden', 'true');
  const topButton = document.createElement('button'); topButton.className = 'vyora-top'; topButton.type = 'button'; topButton.setAttribute('aria-label', 'Back to top'); topButton.title = 'Back to top'; topButton.textContent = '↑';
  const quickbar = document.createElement('div'); quickbar.className = 'vyora-quickbar';
  quickbar.append(
    makeBtn('palette', 'Command palette (Ctrl/⌘ K)', 'Open command palette', '⌘K'),
    makeBtn('focus', 'Toggle focus mode (F)', 'Toggle focus mode', '◎'),
    makeBtn('theme', 'Toggle dark mode (D)', 'Toggle dark mode', '◐')
  );
  document.body.append(progress, cursor, spotlight, topButton, quickbar);

  let cursorX = innerWidth / 2, cursorY = innerHeight / 2, raf = 0;
  if (finePointer && !reducedMotion) {
    document.documentElement.classList.add('has-fancy-cursor');
    window.addEventListener('pointermove', e => {
      cursorX = e.clientX; cursorY = e.clientY;
      spotlight.style.setProperty('--spot-x', `${cursorX}px`);
      spotlight.style.setProperty('--spot-y', `${cursorY}px`);
      if (!raf) raf = requestAnimationFrame(() => {
        cursor.style.transform = `translate3d(${cursorX}px,${cursorY}px,0) translate(-50%,-50%)`;
        raf = 0;
      });
      const target = e.target.closest('button,a,input,select,textarea,[role="button"],.node,.card');
      cursor.classList.toggle('is-hovering', !!target);
    }, { passive: true });
    document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  }

  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); revealObserver.unobserve(entry.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -35px 0px' });
    const attachReveal = root => $$('.card, .stat, .section-banner, .training-card, .post-card, .place-card, .editorial-divider', root)
      .forEach(el => { if (!el.classList.contains('reveal-ready')) { el.classList.add('reveal-ready'); revealObserver.observe(el); } });
    attachReveal();
    const mutationObserver = new MutationObserver(() => attachReveal());
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (finePointer && !reducedMotion) {
    document.addEventListener('pointermove', e => {
      const card = e.target.closest('.card, .stat, .feature-visual, .training-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
      if (card.classList.contains('card') || card.classList.contains('stat')) {
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -2.1;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 2.1;
        if (r.width > 280 && r.height > 110) card.style.setProperty('--tilt', `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`);
      }
    }, { passive: true });
    document.addEventListener('pointerout', e => {
      const card = e.target.closest('.card, .stat, .feature-visual, .training-card');
      if (card && !card.contains(e.relatedTarget)) card.style.removeProperty('--tilt');
    });
  }

  if (finePointer && !reducedMotion) {
    document.addEventListener('pointermove', e => {
      const b = e.target.closest('button.btn, .hero-cta, .quickbar button');
      if (!b || b.disabled) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mag-x', `${(e.clientX - r.left - r.width / 2) * 0.045}px`);
      b.style.setProperty('--mag-y', `${(e.clientY - r.top - r.height / 2) * 0.08}px`);
    }, { passive: true });
    document.addEventListener('pointerout', e => {
      const b = e.target.closest('button.btn, .hero-cta, .quickbar button');
      if (b && !b.contains(e.relatedTarget)) { b.style.removeProperty('--mag-x'); b.style.removeProperty('--mag-y'); }
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('button, .node, .navbtn, .mobile-bar button');
    if (!b || reducedMotion || b.disabled) return;
    const r = b.getBoundingClientRect();
    const ripple = document.createElement('span'); ripple.className = 'vyora-ripple';
    ripple.style.left = `${e.clientX ? e.clientX - r.left : r.width / 2}px`;
    ripple.style.top = `${e.clientY ? e.clientY - r.top : r.height / 2}px`;
    b.classList.add('ripple-host'); b.appendChild(ripple); setTimeout(() => ripple.remove(), 650);
  });

  let scrollTick = false;
  const updateScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    progress.style.transform = `scaleX(${Math.min(1, scrollY / max)})`;
    topButton.classList.toggle('visible', scrollY > 450);
    scrollTick = false;
  };
  addEventListener('scroll', () => { if (!scrollTick) { requestAnimationFrame(updateScroll); scrollTick = true; } }, { passive: true });
  addEventListener('resize', updateScroll); updateScroll();
  topButton.addEventListener('click', () => scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }));

  const toggleFocus = () => {
    document.body.classList.toggle('vyora-focus-mode');
    announce(document.body.classList.contains('vyora-focus-mode') ? 'Focus mode on. Press F to exit.' : 'Focus mode off.');
  };
  const toggleTheme = () => {
    const enabled = document.documentElement.classList.toggle('vyora-dark');
    try { localStorage.setItem('vyora-ui-theme', enabled ? 'dark' : 'light'); } catch {}
    announce(enabled ? 'Dark theme enabled.' : 'Light theme enabled.');
  };
  try { if (localStorage.getItem('vyora-ui-theme') === 'dark') document.documentElement.classList.add('vyora-dark'); } catch {}

  // Build command palette using safe DOM methods (zero innerHTML)
  const palette = document.createElement('div');
  palette.className = 'vyora-palette';
  palette.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'vyora-palette-backdrop';
  backdrop.setAttribute('data-close-palette', '');

  const dialog = document.createElement('div');
  dialog.className = 'vyora-palette-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'VYORA command palette');

  const head = document.createElement('div');
  head.className = 'vyora-palette-head';
  const headSpan = document.createElement('span');
  headSpan.textContent = 'VYORA COMMAND';
  const headKbd = document.createElement('kbd');
  headKbd.textContent = 'ESC';
  head.append(headSpan, headKbd);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'vyora-palette-input';
  search.placeholder = 'Jump to a section or action…';
  search.setAttribute('aria-label', 'Search commands');
  search.autocomplete = 'off';

  const list = document.createElement('div');
  list.className = 'vyora-command-list';
  list.setAttribute('role', 'listbox');

  const foot = document.createElement('div');
  foot.className = 'vyora-palette-foot';
  foot.textContent = '↑ ↓ to navigate · Enter to open · Ctrl/⌘ K to toggle';

  dialog.append(head, search, list, foot);
  palette.append(backdrop, dialog);
  document.body.appendChild(palette);

  const commands = [
    ['Home', 'home', 'Navigate'], ['Workout', 'workout', 'Navigate'], ['Special Training', 'training', 'Navigate'], ['Diet Planner', 'diet', 'Navigate'],
    ['Gyms & Cafés', 'locator', 'Navigate'], ['Community', 'community', 'Navigate'], ['OVULA', 'ovula', 'Navigate'], ['For Business', 'business', 'Navigate'],
    ['Health Journey', 'health', 'Navigate'], ['VYORA Pro', 'pro', 'Navigate'], ['Toggle focus mode', 'focus', 'Action'], ['Toggle dark theme', 'theme', 'Action'], ['Back to top', 'top', 'Action']
  ];
  let selected = 0;

  function filteredCommands() {
    const q = search.value.trim().toLowerCase();
    return commands.filter(c => c[0].toLowerCase().includes(q) || c[2].toLowerCase().includes(q));
  }

  function renderCommands() {
    const items = filteredCommands();
    selected = Math.max(0, Math.min(selected, items.length - 1));
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'vyora-no-command';
      empty.textContent = 'No matching command';
      list.appendChild(empty);
      return;
    }
    items.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `vyora-command${i === selected ? ' selected' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(i === selected));
      btn.dataset.command = c[1];
      const sp = document.createElement('span');
      sp.textContent = c[0];
      const sm = document.createElement('small');
      sm.textContent = c[2];
      btn.append(sp, sm);
      list.appendChild(btn);
    });
  }

  function openPalette() { palette.hidden = false; search.value = ''; selected = 0; renderCommands(); document.body.classList.add('palette-open'); requestAnimationFrame(() => search.focus()); }
  function closePalette() { palette.hidden = true; document.body.classList.remove('palette-open'); }
  function runCommand(action) {
    closePalette();
    if (['home','workout','training','diet','locator','community','ovula','business','health','pro'].includes(action) && window.VyoraNavigation) window.VyoraNavigation.go(action);
    else if (action === 'focus') toggleFocus(); else if (action === 'theme') toggleTheme(); else if (action === 'top') scrollTo({top:0,behavior:reducedMotion?'auto':'smooth'});
  }
  search.addEventListener('input', () => { selected = 0; renderCommands(); });
  list.addEventListener('click', e => { const item = e.target.closest('[data-command]'); if (item) runCommand(item.dataset.command); });
  palette.addEventListener('click', e => { if (e.target.hasAttribute('data-close-palette')) closePalette(); });
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-vyora-action]')?.dataset.vyoraAction;
    if (action === 'palette') openPalette(); else if (action === 'focus') toggleFocus(); else if (action === 'theme') toggleTheme();
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.hidden ? openPalette() : closePalette(); return; }
    if (!palette.hidden) {
      const items = $$('.vyora-command', list);
      if (e.key === 'Escape') { closePalette(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(items.length - 1, selected + 1); renderCommands(); $('.vyora-command.selected', list)?.scrollIntoView({block:'nearest'}); }
      if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(0, selected - 1); renderCommands(); $('.vyora-command.selected', list)?.scrollIntoView({block:'nearest'}); }
      if (e.key === 'Enter') { e.preventDefault(); $('.vyora-command.selected', list)?.click(); }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable) return;
    if (e.key.toLowerCase() === 'f') toggleFocus();
    if (e.key.toLowerCase() === 'd') toggleTheme();
    if (e.key === '?') openPalette();
  });

  let touchStart = null;
  const stage = $('.stage');
  stage?.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || e.target.closest('input,textarea,select,button,a,[contenteditable="true"],.training-tabs,.mobile-bar')) { touchStart = null; return; }
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  stage?.addEventListener('touchend', e => {
    if (!touchStart || !window.VyoraNavigation) return;
    const dx = e.changedTouches[0].clientX - touchStart.x, dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 90 && Math.abs(dy) < 60 && Date.now() - touchStart.t < 900) {
      const active = $('.view.active')?.id; const idx = window.VyoraNavigation.targets.indexOf(active);
      const next = window.VyoraNavigation.targets[idx + (dx < 0 ? 1 : -1)];
      if (next) window.VyoraNavigation.go(next);
    }
    touchStart = null;
  }, { passive: true });

  function announce(message) {
    let toast = $('.vyora-toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'vyora-toast'; toast.setAttribute('role','status'); toast.setAttribute('aria-live','polite'); document.body.appendChild(toast); }
    toast.textContent = message; toast.classList.add('show'); clearTimeout(toast._hideTimer); toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
  window.VyoraInteractions = { openPalette, toggleFocus, toggleTheme, announce };
})();
