// Stage 11 — Special Training: TRAIN / EXPLORE / COMPETE + Gamification Toggle UI (XSS-free DOM construction)
(function(){
  const panels=document.querySelectorAll('[data-training-panel]'),tabs=document.querySelectorAll('[data-training-tab]');
  function showTab(name){
    tabs.forEach(t=>t.classList.toggle('active',t.dataset.trainingTab===name));
    panels.forEach(p=>p.classList.toggle('active',p.dataset.trainingPanel===name));
  }
  tabs.forEach(t=>t.addEventListener('click',()=>showTab(t.dataset.trainingTab)));

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // Create live output workspace card inside Special Training section
  const trainingSection = document.getElementById('training');
  let outputCard = document.getElementById('trainingLiveOutput');
  if (trainingSection && !outputCard) {
    outputCard = el('div', 'card');
    outputCard.id = 'trainingLiveOutput';
    outputCard.style.margin = '14px 0';
    const h = el('h3', '', 'Special Training Live Console');
    h.style.marginTop = '0';
    const body = el('div', '', 'Select any TRAIN, EXPLORE, or COMPETE action above to inspect live predictions, progress comparisons, custom routes, or opt-in leaderboards.');
    body.id = 'trainingLiveBody';
    const gamRow = el('div', 'chat-row');
    gamRow.style.marginTop = '12px';
    const gamBtn = el('button', 'btn ghost', 'Toggle Streaks & Gamification');
    gamBtn.type = 'button';
    let gamEnabled = true;
    gamBtn.addEventListener('click', async () => {
      gamEnabled = !gamEnabled;
      try {
        const res = await window.VyoraAPI.setGamification(gamEnabled);
        body.textContent = `Gamification (streaks, milestones, personal-best badges) is now ${res.gamificationEnabled ? 'ENABLED' : 'DISABLED'}.`;
      } catch (e) {
        body.textContent = e.message;
      }
    });
    gamRow.appendChild(gamBtn);
    outputCard.append(h, body, gamRow);
    const challengeCard = document.getElementById('challengeTitle')?.closest('.card');
    if (challengeCard) trainingSection.insertBefore(outputCard, challengeCard);
    else trainingSection.appendChild(outputCard);
  }

  async function runAction(action){
    const tab=['predict','compare','intelligence'].includes(action)?'train':['routes','layers','destination'].includes(action)?'explore':'compete';
    showTab(tab);
    const out = document.getElementById('trainingLiveBody');
    if (!out || !window.VyoraAPI) return;
    out.replaceChildren(el('p', 'bottom-note', `Loading ${action}…`));

    try {
      if (action === 'predict') {
        const data = await window.VyoraAPI.getPredictions();
        out.replaceChildren();
        if (!data.sufficientData) {
          out.append(
            el('b', '', 'Insufficient Training History for Predictions'),
            el('p', '', `${data.notice || data.disclaimer} (${data.loggedDataPoints}/${data.minimumRequired} sessions logged).`)
          );
        } else {
          out.append(
            el('b', '', `Advisory Race Projections (${data.confidenceLabel})`),
            el('p', '', `5K: ${data.predictions.fiveKm.estimate} (range ${data.predictions.fiveKm.range}) · 10K: ${data.predictions.tenKm.estimate} (range ${data.predictions.tenKm.range}) · Half Marathon: ${data.predictions.halfMarathon.estimate}`),
            el('p', 'bottom-note', data.disclaimer)
          );
        }
      } else if (action === 'compare') {
        const data = await window.VyoraAPI.getComparison();
        out.replaceChildren(
          el('b', '', 'Progress & Workload Comparison (Last 7d vs Prior 7d)'),
          el('p', '', `Current 7d sessions: ${data.periodComparison.current7DaysSessions} · Previous 7d sessions: ${data.periodComparison.previous7DaysSessions} (Delta: ${data.periodComparison.deltaSessions >= 0 ? '+' : ''}${data.periodComparison.deltaSessions})`),
          el('p', '', `Provenance: ${data.dataProvenance.manualEntriesCount} manual logs · ${data.dataProvenance.importedDeviceEntriesCount} imported wearable metrics`),
          el('p', 'bottom-note', data.notice)
        );
      } else if (action === 'intelligence') {
        const data = await window.VyoraAPI.getIntelligence();
        out.replaceChildren(
          el('b', '', `Athlete Intelligence · Recovery Status: ${data.recoveryStatus.toUpperCase()}`),
          el('p', '', data.advisorySummary),
          el('p', 'bottom-note', `${data.disclaimer} ${data.gamification.enabled ? 'Active milestones: ' + (data.gamification.milestones.join(', ') || 'None yet') : '(Gamification disabled by user preference)'}`)
        );
      } else if (['routes', 'layers', 'destination'].includes(action)) {
        const routes = await window.VyoraAPI.listRoutes();
        out.replaceChildren(
          el('b', '', 'Personalized Routes, Terrain Layers & Verified Waypoints'),
          el('p', 'bottom-note', 'Saved routes use your privacy zone (default 0.5 km). Elevation figures are approximate estimates.')
        );
        const createBtn = el('button', 'btn ghost', '+ Save Sample 5 km Morning Route with Hydration Stop');
        createBtn.type = 'button';
        createBtn.addEventListener('click', async () => {
          await window.VyoraAPI.createRoute({
            name: 'Morning Park Loop',
            distanceKm: 5.2,
            terrain: 'mixed',
            elevationGainM: 42,
            visibility: 'private',
            privacyZoneKm: 0.5,
            waypoints: [{ name: 'Park Gate Filtered Water Station', type: 'hydration', verified: true }]
          });
          await runAction('routes');
        });
        out.appendChild(createBtn);
        routes.forEach(r => {
          const item = el('div', 'camp-item');
          item.style.marginTop = '8px';
          item.append(
            el('span', '', `${r.name} · ${r.distanceKm} km · ${r.terrain} · Elev ~${r.elevationGainM || 0}m · ${r.visibility} (Privacy zone: ${r.privacyZoneKm} km) · Stops: ${(r.waypoints || []).map(w => w.name).join(', ') || 'none'}`)
          );
          out.appendChild(item);
        });
      } else if (['leaderboard', 'legend', 'challenge'].includes(action)) {
        const lb = await window.VyoraAPI.getLeaderboard();
        out.replaceChildren(
          el('b', '', 'Opt-In Community Leaderboard (Weekly km)'),
          el('p', 'bottom-note', `Your status: ${lb.myStatus?.optIn ? 'Opted In (' + lb.myStatus.score + ' km)' : 'Hidden / Opted Out'}. Fair-play anti-abuse bounds enforced.`)
        );
        const btnRow = el('div', 'chat-row');
        const joinBtn = el('button', 'btn ghost', 'Opt In / Update Score');
        joinBtn.type = 'button';
        joinBtn.addEventListener('click', async () => {
          const km = Number(prompt('Enter your verified weekly distance (km, 0–400):', '18.5'));
          if (!Number.isFinite(km)) return;
          await window.VyoraAPI.optInLeaderboard({ metricType: 'weekly_km', score: km });
          await runAction('leaderboard');
        });
        const leaveBtn = el('button', 'btn ghost', 'Hide / Leave Leaderboard');
        leaveBtn.type = 'button';
        leaveBtn.addEventListener('click', async () => {
          await window.VyoraAPI.leaveLeaderboard();
          await runAction('leaderboard');
        });
        btnRow.append(joinBtn, leaveBtn);
        out.appendChild(btnRow);
        (lb.rankings || []).forEach(r => {
          const row = el('div', 'camp-item');
          row.style.marginTop = '6px';
          row.append(el('span', '', `#${r.rank} ${r.displayName} — ${r.score} km${r.isCurrentUser ? ' (You)' : ''}`));
          out.appendChild(row);
        });
      }
    } catch (e) {
      out.replaceChildren(el('p', 'bottom-note', 'Special Training action failed: ' + e.message));
    }
  }

  document.querySelectorAll('.training-action').forEach(b=>b.addEventListener('click',()=>runAction(b.dataset.action)));

  const title=document.getElementById('challengeTitle');
  if(title){
    const status=document.getElementById('challengeStatus'),list=document.getElementById('challengeList');
    const today=new Date().toISOString().slice(0,10);
    document.getElementById('challengeStart').value=today;
    document.getElementById('challengeEnd').value=new Date(Date.now()+6*86400000).toISOString().slice(0,10);
    async function loadChallenges(){
      list.replaceChildren();
      try{
        const items=await VyoraAPI.listChallenges();
        if(!items.length){list.textContent='No challenges yet.';return;}
        items.forEach(c=>{
          const row=document.createElement('div');row.className='camp-item';
          const info=document.createElement('div'),b=document.createElement('b'),p=document.createElement('span');
          b.textContent=c.title;
          p.textContent=`${c.goal} · ${c.progress}/${c.target} ${c.unit} · ${c.startDate} to ${c.endDate}`;
          info.append(b,document.createElement('br'),p);
          row.append(info);
          const add=document.createElement('button');add.className='btn ghost';add.textContent='+ Progress';
          add.addEventListener('click',async()=>{
            const raw=prompt(`New total progress in ${c.unit}`,String(c.progress));
            if(raw===null)return;
            try{await VyoraAPI.updateChallenge(c.id,Number(raw));await loadChallenges();}catch(e){status.textContent=e.message;}
          });
          row.append(add);list.append(row);
        });
      }catch(e){status.textContent=e.message;}
    }
    document.getElementById('challengeCreate').addEventListener('click',async()=>{
      const data={
        title:title.value.trim(),
        goal:document.getElementById('challengeGoal').value.trim(),
        target:Number(document.getElementById('challengeTarget').value),
        unit:document.getElementById('challengeUnit').value,
        startDate:document.getElementById('challengeStart').value,
        endDate:document.getElementById('challengeEnd').value
      };
      try{
        await VyoraAPI.createChallenge(data);
        title.value='';document.getElementById('challengeGoal').value='';document.getElementById('challengeTarget').value='';
        status.textContent='Challenge created.';
        await loadChallenges();
      }catch(e){status.textContent=e.message;}
    });
    loadChallenges();
  }
  window.VyoraTraining={showTab,runAction};
})();
