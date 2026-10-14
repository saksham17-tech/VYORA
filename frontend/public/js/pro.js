// Stage 12 — VYORA Pro: Human Trainers, Consent-Based Client Sharing/Revocation, Rescheduling & Reviews
(function(){
  const list=document.getElementById('trainerList');if(!list)return;
  const status=document.createElement('p');status.className='bottom-note';list.after(status);

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  async function load(){
    list.replaceChildren();
    try{
      const [trainers, bookings, shares] = await Promise.all([
        VyoraAPI.listTrainers(),
        VyoraAPI.listBookings(),
        VyoraAPI.listTrainerShares ? VyoraAPI.listTrainerShares() : Promise.resolve([])
      ]);
      const activeShareMap = new Map((shares || []).filter(s => s.active).map(s => [s.trainerId, s]));

      trainers.forEach(t=>{
        const card=el('div','card');
        const h=el('h3','',t.name);
        h.style.marginTop='0';h.style.fontSize='15px';
        const ratingText = t.avgRating ? ` · ★ ${t.avgRating} (${t.reviewCount})` : '';
        const p=el('p','',`${t.specialty} · ₹${t.price}/session${t.verified?' · Verified ✓':''}${ratingText}`);
        const bio=el('p','',t.bio);

        const actions=el('div','chat-row');
        actions.style.flexWrap='wrap';

        const btn=el('button','btn ghost','Request booking');
        btn.type='button';
        btn.addEventListener('click',async()=>{
          const when=prompt('Preferred date and time (e.g. 2026-10-20T18:00:00+05:30)','2026-10-20T18:00:00+05:30');
          if(!when)return;
          try{
            await VyoraAPI.bookTrainer({trainerId:t.id,requestedAt:when});
            status.textContent='Booking request submitted. It is not confirmed until the trainer accepts.';
            await load();
          }catch(e){status.textContent=e.message;}
        });

        const currentShare = activeShareMap.get(t.id);
        const shareBtn = el('button', 'btn ghost', currentShare ? 'Revoke Shared Logs' : 'Share Goals/Logs');
        shareBtn.type = 'button';
        shareBtn.addEventListener('click', async () => {
          try {
            if (currentShare) {
              const res = await VyoraAPI.revokeTrainerShare(t.id);
              status.textContent = res.message;
            } else {
              const res = await VyoraAPI.shareWithTrainer(t.id, ['goals', 'workouts', 'progress']);
              status.textContent = res.message;
            }
            await load();
          } catch (e) {
            status.textContent = e.message;
          }
        });

        const revBtn = el('button', 'btn ghost', 'Rate ★');
        revBtn.type = 'button';
        revBtn.addEventListener('click', async () => {
          const rating = Number(prompt('Rate trainer (1–5 stars):', '5'));
          if (!rating) return;
          const comment = prompt('Short review comment (optional):', 'Helpful form cues and realistic plan adjustments.');
          try {
            await VyoraAPI.reviewTrainer(t.id, { rating, comment });
            status.textContent = 'Review saved.';
            await load();
          } catch (e) {
            status.textContent = e.message;
          }
        });

        actions.append(btn, shareBtn, revBtn);
        card.append(h, p, bio, actions);
        list.append(card);
      });

      if(bookings.length){
        const heading=el('h3','','Your booking requests');
        heading.style.gridColumn='1/-1';
        list.append(heading);
        bookings.forEach(b=>{
          const row=el('div','camp-item');
          const text=el('span','',`${b.trainerName} · ${new Date(b.requestedAt).toLocaleString()} · ${b.status}`);
          row.append(text);
          if(b.status==='requested'){
            const actWrap = el('div', 'chat-row');
            const resched = el('button', 'btn ghost', 'Reschedule');
            resched.type = 'button';
            resched.addEventListener('click', async () => {
              const nextTime = prompt('New date/time (ISO):', b.requestedAt);
              if (!nextTime) return;
              try {
                await VyoraAPI.rescheduleBooking(b.id, { requestedAt: nextTime });
                status.textContent = 'Booking rescheduled.';
                await load();
              } catch (e) {
                status.textContent = e.message;
              }
            });
            const cancel=el('button','btn ghost','Cancel');
            cancel.type='button';
            cancel.addEventListener('click',async()=>{await VyoraAPI.cancelBooking(b.id);await load();});
            actWrap.append(resched, cancel);
            row.append(actWrap);
          }
          list.append(row);
        });
      }
    }catch(e){status.textContent='Trainer service unavailable: '+e.message;}
  }
  load();
})();
