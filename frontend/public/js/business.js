// Stage 12 — Offline Gym & Fitness Partner Network with Aggregated Campaign Analytics (Zero Health PII Shared)
(function(){
  const campList=document.getElementById('campList');if(!campList)return;
  const status=document.createElement('p');status.className='bottom-note';campList.after(status);

  function addRow(c){
    const row=document.createElement('div');row.className='camp-item';
    const info=document.createElement('div'),b=document.createElement('b'),meta=document.createElement('span');
    b.textContent=`${c.name} [Sponsored]`;
    const a = c.analytics || { impressions: 0, clicks: 0, optIns: 0, redemptions: 0 };
    meta.textContent=`${c.offer||''}${c.date?' · until '+c.date:''} · ${c.status} · Aggregate: ${a.impressions} views, ${a.clicks} clicks, ${a.optIns} opt-ins, ${a.redemptions} redemptions`;
    info.append(b,document.createElement('br'),meta);
    row.append(info);
    if(c.status!=='completed'){
      const toggle=document.createElement('button');
      toggle.className='btn ghost';
      toggle.textContent=c.status==='active'?'Pause':'Activate';
      toggle.addEventListener('click',async()=>{
        try{await VyoraAPI.updateCampaign(c.id,{status:c.status==='active'?'paused':'active'});await load();}
        catch(e){status.textContent=e.message;}
      });
      row.append(toggle);
    }
    campList.append(row);
  }

  async function load(){
    campList.replaceChildren();
    try{
      const list=await VyoraAPI.listCampaigns();
      if(!list.length){campList.textContent='No campaigns yet — create your first campaign.';return;}
      list.forEach(addRow);
    }catch(e){campList.textContent='Campaigns unavailable: '+e.message;}
  }

  document.getElementById('cAdd').addEventListener('click',async()=>{
    const name=document.getElementById('cName').value.trim(),
          offer=document.getElementById('cOffer').value.trim(),
          date=document.getElementById('cDate').value;
    if(!name||!offer){status.textContent='Add a business/campaign name and offer.';return;}
    try{
      await VyoraAPI.createCampaign({name,offer,date});
      document.getElementById('cName').value='';
      document.getElementById('cOffer').value='';
      document.getElementById('cDate').value='';
      status.textContent='Campaign saved as draft (Aggregate analytics only; personal health records are never shared with partners).';
      await load();
    }catch(e){status.textContent=e.message;}
  });
  load();
})();
