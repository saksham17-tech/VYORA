/**
 * Stage 13 — Admin, Support, Moderation & Feature Flags Console UI
 * Renders least-privilege operational controls inside the Business / Operations view.
 */
(function () {
  'use strict';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function mountAdminConsole() {
    const businessSection = document.getElementById('business');
    if (!businessSection || document.getElementById('adminModerationCard')) return;

    const card = el('div', 'card');
    card.id = 'adminModerationCard';
    card.style.marginTop = '16px';

    const h = el('h3', '', 'Admin, Moderation & Feature Flags Console (Least-Privilege)');
    h.style.marginTop = '0';
    const sub = el('p', 'bottom-note', 'Manage feature flags, partner verification, community reports, AI safety incidents, and reminder delivery failures. Personal health and OVULA cycle records are strictly excluded from support/moderation views.');
    const summaryLine = el('p', '', 'Loading operational status…');
    summaryLine.style.fontWeight = '600';

    const flagsBox = el('div', '');
    flagsBox.style.marginTop = '10px';
    const statusNote = el('p', 'bottom-note', '');
    statusNote.setAttribute('aria-live', 'polite');

    card.append(h, sub, summaryLine, flagsBox, statusNote);
    businessSection.appendChild(card);

    async function refreshAdmin() {
      if (!window.VyoraAPI?.getAdminOverview) return;
      try {
        const data = await window.VyoraAPI.getAdminOverview();
        const c = data.counts || {};
        summaryLine.textContent = `Open Community Reports: ${c.openCommunityReports || 0} · Open AI Safety Reports: ${c.openAiSafetyReports || 0} · Pending Partners: ${c.pendingPartners || 0} · Failed Deliveries: ${c.failedDeliveriesCount || 0}`;

        flagsBox.replaceChildren();
        (data.featureFlags || []).forEach(f => {
          const row = el('div', 'camp-item');
          const info = el('div');
          info.append(el('b', '', f.key), el('span', '', ` — ${f.description}`));
          const btn = el('button', 'btn ghost', f.enabled ? 'Enabled ✓ (Disable)' : 'Disabled (Enable)');
          btn.type = 'button';
          btn.addEventListener('click', async () => {
            try {
              await window.VyoraAPI.setFeatureFlag(f.key, !f.enabled);
              statusNote.textContent = `Updated feature flag "${f.key}" → ${!f.enabled ? 'ENABLED' : 'DISABLED'}.`;
              await refreshAdmin();
            } catch (e) {
              statusNote.textContent = e.message;
            }
          });
          row.append(info, btn);
          flagsBox.appendChild(row);
        });
      } catch (e) {
        summaryLine.textContent = 'Admin console unavailable: ' + e.message;
      }
    }

    refreshAdmin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAdminConsole);
  } else {
    mountAdminConsole();
  }
})();
