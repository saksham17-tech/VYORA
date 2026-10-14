// VYORA Copilot branch — Stage 8: chat, voice routing, stop-speech control, visible/clearable memory & report-answer safety control
(function(){
const {addMsg,wireChat,wireMic,triggerWave,navigate,speakWithOrb}=window.VyoraCore;
let persona = "calm";
let lastUserMsg = "";
let lastBotReply = "";

document.querySelectorAll("#personaRow button").forEach(b=>{
  b.addEventListener("click",()=>{
    document.querySelectorAll("#personaRow button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); persona=b.dataset.p;
    addMsg("vyoraLog","system","Personality set to "+b.textContent+".");
  });
});

// Add visible Copilot Memory & Safety Controls bar below chat
(function attachCopilotControls(){
  const log = document.getElementById("vyoraLog");
  const chatWrap = log?.closest(".chat");
  if (!chatWrap || document.getElementById("copilotSafetyBar")) return;

  const bar = document.createElement("div");
  bar.id = "copilotSafetyBar";
  bar.className = "chat-row";
  bar.style.marginTop = "8px";
  bar.style.flexWrap = "wrap";

  const stopAudioBtn = document.createElement("button");
  stopAudioBtn.type = "button";
  stopAudioBtn.className = "btn ghost";
  stopAudioBtn.textContent = "Stop Audio ⏹";
  stopAudioBtn.addEventListener("click", () => {
    try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch {}
    const status = document.getElementById("orbChatStatus");
    if (status) status.textContent = "Stopped";
  });

  const viewMemBtn = document.createElement("button");
  viewMemBtn.type = "button";
  viewMemBtn.className = "btn ghost";
  viewMemBtn.textContent = "Memory Notes";
  viewMemBtn.addEventListener("click", async () => {
    if (!window.VyoraAPI?.getChatMemory) return;
    try {
      const mem = await window.VyoraAPI.getChatMemory();
      const text = mem.items?.length ? "Saved Copilot preferences: " + mem.items.join(" · ") : "No saved Copilot memory notes.";
      addMsg("vyoraLog", "system", text);
    } catch (e) {
      addMsg("vyoraLog", "system", "Could not load memory: " + e.message);
    }
  });

  const clearMemBtn = document.createElement("button");
  clearMemBtn.type = "button";
  clearMemBtn.className = "btn ghost";
  clearMemBtn.textContent = "Clear Memory";
  clearMemBtn.addEventListener("click", async () => {
    if (!window.VyoraAPI?.clearChatMemory) return;
    try {
      await window.VyoraAPI.clearChatMemory();
      addMsg("vyoraLog", "system", "Cleared Copilot conversation memory.");
    } catch (e) {
      addMsg("vyoraLog", "system", "Could not clear memory: " + e.message);
    }
  });

  const reportBtn = document.createElement("button");
  reportBtn.type = "button";
  reportBtn.className = "btn ghost";
  reportBtn.textContent = "Report AI Answer ⚑";
  reportBtn.addEventListener("click", async () => {
    const reason = prompt("Why are you reporting the last AI response? (e.g. unsafe advice, inaccurate estimate)");
    if (!reason?.trim() || !window.VyoraAPI?.reportAiAnswer) return;
    try {
      const res = await window.VyoraAPI.reportAiAnswer({
        mode: "vyora",
        userMessage: lastUserMsg,
        aiResponse: lastBotReply,
        reason: reason.trim()
      });
      addMsg("vyoraLog", "system", res.message || "Safety report submitted.");
    } catch (e) {
      addMsg("vyoraLog", "system", "Could not submit report: " + e.message);
    }
  });

  bar.append(stopAudioBtn, viewMemBtn, clearMemBtn, reportBtn);
  chatWrap.appendChild(bar);
})();

const tones = {
  calm:{pre:"",post:" Take it one step at a time."},
  drill:{pre:"Alright. ",post:" Stay consistent today."},
  bro:{pre:"Yo. ",post:" Let's keep moving safely."},
  nerd:{pre:"Estimate check: ",post:" Note: all macro and load figures carry ±15% uncertainty."}
};

async function vyoraReply(msg){
  lastUserMsg = msg;
  try {
    if(window.VyoraAPI) {
      const reply = await window.VyoraAPI.chat(msg, "vyora");
      lastBotReply = reply;
      return reply;
    }
  } catch(e) {
    console.warn("Gemini unavailable; using local guidance:", e.message);
  }
  const m = msg.toLowerCase();
  let body;
  if(m.includes("no egg")||m.includes("egg-free")) body="Updated: I can swap egg meals for high-protein Moong Dal & Paneer Chilla or Tofu Bhurji while keeping the rest of your plan unchanged.";
  else if(m.includes("tired")||m.includes("sore")||m.includes("knee")||m.includes("pain")) body="I hear you. Stop any movement that causes sharp or worsening pain. I'll switch lower-body impact to conservative glute bridges and mobility, and recommend checking with a qualified clinician if pain persists.";
  else if(m.includes("performance")||m.includes("predict")||m.includes("5k")||m.includes("10k")) body="Opening Performance Predictions in Special Training. Estimates require sufficient logged sessions and carry uncertainty.";
  else if(m.includes("compare")||m.includes("progress")) body="Opening Progress Comparison to compare your recent workload against your baseline.";
  else if(m.includes("intelligence")||m.includes("insight")||m.includes("athlete")) body="Opening Athlete Intelligence for advisory consistency and recovery trends.";
  else if(m.includes("route")||m.includes("map")) body="Opening route planning. Live turn-by-turn routing requires a licensed maps provider.";
  else if(m.includes("layer")||m.includes("elevation")||m.includes("terrain")) body="Opening route layers.";
  else if(m.includes("destination")||m.includes("stop")||m.includes("cafe stop")||m.includes("café")) body="Opening destination mode to save a café, hydration stop, or viewpoint.";
  else if(m.includes("leaderboard")||m.includes("ranking")) body="Opening the opt-in leaderboard.";
  else if(m.includes("challenge")||m.includes("friends")) body="Opening Group Challenge.";
  else if(m.includes("local legend")||m.includes("segment")) body="Opening Local Legend.";
  else if(m.includes("workout")||m.includes("exercise")||m.includes("training")) body="I can help you plan or adapt a workout (e.g. indoor/outdoor, 20-min express, quiet apartment, or knee-friendly).";
  else if(m.includes("diet")||m.includes("eat")||m.includes("food")||m.includes("meal")) body="I can generate Indian or international meal suggestions with approximate macros (±15% uncertainty) and quick exclusions like 'no eggs today'.";
  else if(m.includes("gym")||m.includes("cafe")||m.includes("nearby")||m.includes("near me")) body="Opening Gyms & Cafés.";
  else if(m.includes("community")||m.includes("blog")||m.includes("vlog")||m.includes("reel")) body="Opening Community Hub.";
  else if(m.includes("ovula")||m.includes("cycle")||m.includes("cramp")) body="Opening OVULA, your private menstrual wellness and comfort companion.";
  else if(m.includes("business")||m.includes("campaign")||m.includes("partner")) body="Opening Business for gym partners and aggregate campaign analytics.";
  else if(m.includes("medication")||m.includes("medicine")||m.includes("reminder")) body="Before I schedule a medication reminder, please confirm the exact medication label, time, timezone, verified email/phone destination, and channel in Health Journey. VYORA never changes prescribed dosages.";
  else if(m.includes("health")||m.includes("condition")||m.includes("diabetes")||m.includes("blood pressure")||m.includes("thyroid")) body="Opening Health Journey. Track conditions, reminders, and vitals alongside your doctor's care.";
  else if(m.includes("vital")||m.includes("blood sugar")||m.includes("bp")) body="Opening Health Journey vitals tracking.";
  else if(m.includes("pro")||m.includes("trainer")||m.includes("book trainer")) body="Opening VYORA Pro for verified human trainer sessions.";
  else if(m.includes("plan")||m.includes("build my plan")) body="Use the Plan Builder above to generate a schema-validated diet and workout plan, then use the quick swap buttons to regenerate individual meals or sessions.";
  else body="Got it. Ask me to adapt your meal or workout plan (e.g., 'no eggs today', 'shorter workout', 'knee hurts'), check your progress, or navigate any VYORA module.";
  const t=tones[persona] || tones.calm;
  lastBotReply = t.pre+body+t.post;
  return lastBotReply;
}

function commandAction(msg){
  const m=msg.toLowerCase();
  if(m.includes('performance')||m.includes('predict')||m.includes('5k')||m.includes('10k')){navigate('training'); window.VyoraTraining?.showTab('train'); window.VyoraTraining?.runAction('predict'); return 'Opening Performance Predictions.';}
  if(m.includes('compare')||m.includes('progress')){navigate('training'); window.VyoraTraining?.showTab('train'); window.VyoraTraining?.runAction('compare'); return 'Opening Progress Comparison.';}
  if(m.includes('intelligence')||m.includes('insight')){navigate('training'); window.VyoraTraining?.showTab('train'); window.VyoraTraining?.runAction('intelligence'); return 'Opening Athlete Intelligence.';}
  if(m.includes('route')||m.includes('map')){navigate('training'); window.VyoraTraining?.showTab('explore'); window.VyoraTraining?.runAction('routes'); return 'Opening personalized route planning.';}
  if(m.includes('layer')||m.includes('elevation')||m.includes('terrain')){navigate('training'); window.VyoraTraining?.showTab('explore'); window.VyoraTraining?.runAction('layers'); return 'Opening route layers.';}
  if(m.includes('destination')||m.includes('stop')||m.includes('café')||m.includes('cafe')){navigate('training'); window.VyoraTraining?.showTab('explore'); window.VyoraTraining?.runAction('destination'); return 'Opening destination and stop planning.';}
  if(m.includes('leaderboard')||m.includes('ranking')){navigate('training'); window.VyoraTraining?.showTab('compete'); window.VyoraTraining?.runAction('leaderboard'); return 'Opening the leaderboard.';}
  if(m.includes('challenge')||m.includes('friends')){navigate('training'); window.VyoraTraining?.showTab('compete'); window.VyoraTraining?.runAction('challenge'); return 'Opening Group Challenge.';}
  if(m.includes('local legend')||m.includes('segment')){navigate('training'); window.VyoraTraining?.showTab('compete'); window.VyoraTraining?.runAction('legend'); return 'Opening Local Legend.';}
  const sections=[
    ['workout',['workout','exercise']],['training',['special training','training intelligence','special workout']],['diet',['diet','nutrition','meal']],['locator',['gym','gyms','cafe','nearby','near me']],
    ['community',['community','blog','vlog','reel']],['ovula',['ovula','cycle','cramp']],['business',['business','partner','campaign']],
    ['health',['health','condition','diabetes','thyroid','blood pressure','medication','medicine','vital','blood sugar']],['pro',['pro','trainer','book trainer']],['home',['home','dashboard','copilot','plan']]
  ];
  for(const [id,words] of sections){if(words.some(w=>m.includes(w))){navigate(id); return 'Opening '+id.replace('locator','Gyms and Cafés').replace('pro','VYORA Pro')+'.';}}
  return null;
}

wireChat("vyoraInput","vyoraSend","vyoraLog","orbChat",vyoraReply);
wireMic("vyoraMic","vyoraInput","orbChat",async (transcript)=>{
  const action=commandAction(transcript);
  addMsg("vyoraLog","user",transcript);
  const reply=action || await vyoraReply(transcript);
  addMsg("vyoraLog","bot",reply);
  speakWithOrb(reply,document.getElementById('orbChat'),document.getElementById('orbChatStatus'));
  document.getElementById('vyoraInput').value='';
});
setTimeout(()=>triggerWave("orbWave"),700);
let ovulaWaved=false;
document.querySelectorAll('[data-target="ovula"]').forEach(b=>b.addEventListener("click",()=>{
  if(!ovulaWaved){ ovulaWaved=true; setTimeout(()=>triggerWave("orbOWave"),400); }
}));
})();
