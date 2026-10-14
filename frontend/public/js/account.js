/**
 * Stage 7 — Account, OTP Verification & Privacy/Consent Center UI
 * Provides accessible UI controls for Guest-to-Account linking, Login/Register,
 * Email/Phone OTP verification, Purpose-specific Consent toggles ("Why we ask"),
 * Data Export, and Account Deletion with confirmation.
 */
(function () {
  'use strict';

  const CONSENT_DESCRIPTIONS = {
    health_profile: 'Optional self-reported health conditions & vitals to adapt workout/diet caution safely.',
    ovula_cycle: 'Optional menstrual cycle & symptom check-ins for private comfort & activity guidance.',
    medication_reminders: 'Outbound email/SMS delivery of user-entered medication & habit schedules.',
    wearable_sync: 'Optional import of activity or recovery metrics from authorized health platforms.',
    community_publishing: 'Public display of community posts, comments, and creator profile name.',
    location_discovery: 'Area or location usage to save nearby gyms, cafés, and route waypoints.'
  };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildAccountPanel() {
    const healthSection = document.getElementById('health');
    if (!healthSection || document.getElementById('accountPrivacyCard')) return;

    const card = el('div', 'card');
    card.id = 'accountPrivacyCard';
    card.style.marginTop = '14px';

    const title = el('h3', '', 'Account, Verification & Privacy Controls');
    title.style.marginTop = '0';
    const sub = el('p', 'bottom-note', 'Guest sessions are temporary. Link or sign in to a verified account before scheduling outbound email/SMS reminders, and manage your data consents or export/delete your account at any time.');
    const stateBadge = el('p', '', 'Checking account status…');
    stateBadge.id = 'accountStateSummary';
    stateBadge.style.fontWeight = '600';

    // Auth form row
    const authGrid = el('div', 'grid cols-3');
    authGrid.style.marginTop = '10px';

    const emailField = el('div', 'field');
    const emailLabel = el('label', '', 'Email address');
    emailLabel.setAttribute('for', 'authEmail');
    const emailInput = el('input');
    emailInput.id = 'authEmail';
    emailInput.type = 'email';
    emailInput.placeholder = 'you@example.com';
    emailField.append(emailLabel, emailInput);

    const passField = el('div', 'field');
    const passLabel = el('label', '', 'Password (min 8 chars)');
    passLabel.setAttribute('for', 'authPassword');
    const passInput = el('input');
    passInput.id = 'authPassword';
    passInput.type = 'password';
    passInput.placeholder = '••••••••';
    passField.append(passLabel, passInput);

    const nameField = el('div', 'field');
    const nameLabel = el('label', '', 'Display name');
    nameLabel.setAttribute('for', 'authDisplayName');
    const nameInput = el('input');
    nameInput.id = 'authDisplayName';
    nameInput.placeholder = 'Your name';
    nameField.append(nameLabel, nameInput);

    authGrid.append(emailField, passField, nameField);

    const btnRow = el('div', 'chat-row');
    btnRow.style.marginTop = '10px';
    btnRow.style.flexWrap = 'wrap';
    const linkBtn = el('button', 'btn', 'Link Guest → Account');
    const loginBtn = el('button', 'btn ghost', 'Log In');
    const registerBtn = el('button', 'btn ghost', 'Register New');
    const logoutBtn = el('button', 'btn ghost', 'Log Out');
    btnRow.append(linkBtn, loginBtn, registerBtn, logoutBtn);

    // OTP Verification Row
    const otpBox = el('div', '');
    otpBox.style.marginTop = '14px';
    const otpTitle = el('h4', '', 'Verify Contact Destination (OTP)');
    otpTitle.style.margin = '0 0 6px';
    const otpRow = el('div', 'chat-row');
    otpRow.style.flexWrap = 'wrap';
    const otpChannel = el('select');
    otpChannel.id = 'otpChannel';
    const optEmail = el('option', '', 'Email');
    optEmail.value = 'email';
    const optSms = el('option', '', 'SMS / Phone');
    optSms.value = 'sms';
    otpChannel.append(optEmail, optSms);

    const otpDest = el('input');
    otpDest.id = 'otpDestination';
    otpDest.placeholder = 'you@example.com or +919876543210';
    const reqOtpBtn = el('button', 'btn ghost', 'Send OTP');
    const otpCodeInput = el('input');
    otpCodeInput.id = 'otpCode';
    otpCodeInput.placeholder = '6-digit code';
    otpCodeInput.style.maxWidth = '140px';
    const confirmOtpBtn = el('button', 'btn ghost', 'Confirm OTP');
    otpRow.append(otpChannel, otpDest, reqOtpBtn, otpCodeInput, confirmOtpBtn);
    otpBox.append(otpTitle, otpRow);

    // Consents section ("Why we ask")
    const consentBox = el('div', '');
    consentBox.style.marginTop = '16px';
    const consentHeader = el('h4', '', 'Purpose-Specific Privacy Consents ("Why We Ask")');
    consentHeader.style.margin = '0 0 6px';
    const consentList = el('div', '');
    consentList.id = 'consentListContainer';
    consentBox.append(consentHeader, consentList);

    // Data Export & Account Delete
    const dataRow = el('div', 'chat-row');
    dataRow.style.marginTop = '16px';
    const exportBtn = el('button', 'btn ghost', 'Export My Data (JSON)');
    const deleteBtn = el('button', 'btn ghost', 'Delete Account & Revoke Token');
    dataRow.append(exportBtn, deleteBtn);

    const statusMsg = el('p', 'bottom-note', '');
    statusMsg.id = 'accountActionStatus';
    statusMsg.setAttribute('aria-live', 'polite');

    card.append(title, sub, stateBadge, authGrid, btnRow, otpBox, consentBox, dataRow, statusMsg);
    healthSection.appendChild(card);

    async function refreshAccountState() {
      if (!window.VyoraAPI) return;
      try {
        const [me, consentData] = await Promise.all([
          window.VyoraAPI.me(),
          window.VyoraAPI.listConsents()
        ]);
        const modeLabel = me.isGuest ? 'Guest Demo Session (unauthenticated across devices)' : `Registered Account (${me.email || 'no email'})`;
        const verifyLabel = me.isGuest
          ? 'Verify after linking account'
          : `Email: ${me.emailVerified ? 'Verified ✓' : 'Unverified'} · Phone: ${me.phoneVerified ? 'Verified ✓' : 'Unverified'}`;
        stateBadge.textContent = `${modeLabel} — ${verifyLabel}`;
        if (me.email && !otpDest.value) otpDest.value = me.email;

        consentList.replaceChildren();
        const activeSet = new Set((consentData.consents || []).filter(c => c.active).map(c => c.purpose));
        for (const purpose of (consentData.allowedPurposes || Object.keys(CONSENT_DESCRIPTIONS))) {
          const row = el('div', 'camp-item');
          const info = el('div');
          const b = el('b', '', purpose.replace(/_/g, ' ').toUpperCase());
          const desc = el('span', '', ` — ${CONSENT_DESCRIPTIONS[purpose] || 'Purpose-specific consent'}`);
          info.append(b, desc);
          const toggle = el('button', 'btn ghost', activeSet.has(purpose) ? 'Granted ✓ (Revoke)' : 'Grant Consent');
          toggle.addEventListener('click', async () => {
            try {
              if (activeSet.has(purpose)) {
                await window.VyoraAPI.revokeConsent(purpose);
                statusMsg.textContent = `Revoked consent for ${purpose}.`;
              } else {
                await window.VyoraAPI.grantConsent(purpose, 'user_ui');
                statusMsg.textContent = `Granted consent for ${purpose}.`;
              }
              await refreshAccountState();
            } catch (err) {
              statusMsg.textContent = err.message;
            }
          });
          row.append(info, toggle);
          consentList.appendChild(row);
        }
      } catch (e) {
        stateBadge.textContent = 'Account status unavailable: ' + e.message;
      }
    }

    linkBtn.addEventListener('click', async () => {
      try {
        const res = await window.VyoraAPI.linkGuest(emailInput.value.trim(), passInput.value, nameInput.value.trim());
        statusMsg.textContent = res.message || 'Guest session linked to account.';
        await refreshAccountState();
      } catch (e) {
        statusMsg.textContent = e.message;
      }
    });

    registerBtn.addEventListener('click', async () => {
      try {
        const res = await window.VyoraAPI.register(emailInput.value.trim(), passInput.value, nameInput.value.trim());
        statusMsg.textContent = res.message || 'Registered and signed in.';
        await refreshAccountState();
      } catch (e) {
        statusMsg.textContent = e.message;
      }
    });

    loginBtn.addEventListener('click', async () => {
      try {
        await window.VyoraAPI.login(emailInput.value.trim(), passInput.value);
        statusMsg.textContent = 'Signed in.';
        await refreshAccountState();
      } catch (e) {
        statusMsg.textContent = e.message;
      }
    });

    logoutBtn.addEventListener('click', async () => {
      try {
        await window.VyoraAPI.logout();
        statusMsg.textContent = 'Logged out and session token revoked. A fresh guest session was started.';
        await refreshAccountState();
      } catch (e) {
        statusMsg.textContent = e.message;
      }
    });

    reqOtpBtn.addEventListener('click', async () => {
      try {
        const res = await window.VyoraAPI.requestOtp(otpChannel.value, otpDest.value.trim());
        statusMsg.textContent = res.devCode
          ? `${res.message} [Local Dev OTP: ${res.devCode}]`
          : res.message;
        if (res.devCode) otpCodeInput.value = res.devCode;
      } catch (e) {
        statusMsg.textContent = e.message;
      }
    });

    confirmOtpBtn.addEventListener('click', async () => {
      try {
        const res = await window.VyoraAPI.confirmOtp(otpChannel.value, otpDest.value.trim(), otpCodeInput.value.trim());
        statusMsg.textContent = `Verified ${res.destination} (${res.channel}).`;
        otpCodeInput.value = '';
        await refreshAccountState();
      } catch (e) {
        statusMsg.textContent = e.message;
      }
    });

    exportBtn.addEventListener('click', async () => {
      try {
        await window.VyoraAPI.exportData();
        statusMsg.textContent = 'Exported account data as JSON.';
      } catch (e) {
        statusMsg.textContent = e.message;
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Permanently delete your account, health logs, plans, and reminders? This cannot be undone.')) return;
      try {
        const res = await window.VyoraAPI.deleteAccount();
        statusMsg.textContent = res.message || 'Account deleted.';
        await refreshAccountState();
      } catch (e) {
        statusMsg.textContent = e.message;
      }
    });

    refreshAccountState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildAccountPanel);
  } else {
    buildAccountPanel();
  }
})();
