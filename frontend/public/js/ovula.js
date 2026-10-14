// Stage 9 — OVULA Menstrual Wellness UI with safe DOM rendering and dedicated OVULA Export/Delete privacy controls
(function(){
const {wireChat,wireMic}=window.VyoraCore;
const phaseTips = {
  menstrual:"Optional intensity note: lower-intensity movement works well now — walking, gentle yoga, or light mobility. Rest is productive, not lazy. Easy to override anytime.",
  follicular:"Optional intensity note: energy is often climbing — a good window to push strength training or try something new if you feel ready.",
  ovulatory:"Optional intensity note: often a higher-energy window — great for strength or interval sessions if you're feeling it.",
  luteal:"Optional intensity note: energy may dip. Moderate strength work or steady cardio tends to feel better than maximal pushes."
};
const phaseSelect=document.getElementById("phaseSelect"), phaseTip=document.getElementById("phaseTip");
function setPhase(){ phaseTip.textContent = phaseTips[phaseSelect.value] + " (Cycle estimates are approximate — never use as contraception or diagnosis.)"; }
phaseSelect.addEventListener("change",async()=>{
  setPhase();
  try{
    await window.VyoraAPI.saveOvula({type:"cycle-phase-checkin",phase:phaseSelect.value,recordedAt:new Date().toISOString()}, true);
  }catch(e){
    console.warn("Cycle check-in was not saved",e.message);
  }
});
setPhase();

const redFlags=["severe","fainting","faint","heavy bleeding","unbearable","emergency","can't stand","passed out","fever"];
async function ovulaReply(msg){
  try { if(window.VyoraAPI) return await window.VyoraAPI.chat(msg, "ovula"); } catch(e) { console.warn("Gemini unavailable; using local OVULA guidance:", e.message); }
  const m=msg.toLowerCase();
  if(redFlags.some(k=>m.includes(k))) return "I'm concerned about the symptoms you described. Please seek urgent medical assessment from a doctor or gynecologist now rather than waiting this out.";
  if(m.includes("cramp")) return "For cramps: a heating pad on the lower belly (15–20 min), gentle child's pose or cat-cow stretching, warm hydration, and rest often help. Individual suitability varies, and if pain is severe or new, please consult a doctor.";
  if(m.includes("tired")||m.includes("fatigue")||m.includes("low energy")) return "Fatigue is common in this phase — lighter movement, extra rest, and iron-rich foods can help. All workout adjustments are optional.";
  if(m.includes("mood")||m.includes("irritable")||m.includes("sad")) return "Mood shifts around your cycle are common. Gentle movement, sleep, and pacing yourself go a long way.";
  if(m.includes("hygiene")||m.includes("product")||m.includes("pad")||m.includes("cup")) return "Pads, tampons, and menstrual cups are all valid choices — change regularly and wash hands before and after.";
  return "Thanks for sharing that. Remember: OVULA offers general comfort and self-care ideas only, never medical diagnosis or fertility prediction.";
}
wireChat("ovulaInput","ovulaSend","ovulaLog","orbO",ovulaReply);
wireMic("ovulaMic","ovulaInput","orbO",async(transcript)=>{
  const input=document.getElementById("ovulaInput");input.value=transcript;
  const send=document.getElementById("ovulaSend");send?.click();
});

const careItems=[
  "Changed pad / cup / tampon in the last 4–6 hrs",
  "Drank enough water today",
  "Logged today's flow & symptoms",
  "Did some gentle movement or stretching",
  "Got comfortable rest"
];
const ovulaChecklist=document.getElementById("ovulaChecklist");
if (ovulaChecklist) {
  ovulaChecklist.replaceChildren();
  careItems.forEach(txt=>{
    const row=document.createElement("div"); row.className="exrow";
    const nameDiv=document.createElement("div"); nameDiv.className="exname"; nameDiv.textContent=txt;
    const btn=document.createElement("button"); btn.className="check"; btn.type="button"; btn.setAttribute("aria-label","Mark done");
    btn.addEventListener("click",()=>row.classList.toggle("done"));
    row.append(nameDiv, btn);
    ovulaChecklist.appendChild(row);
  });

  // Add OVULA Privacy Export & Delete controls (PRD Prompt 10)
  const privRow = document.createElement("div");
  privRow.className = "chat-row";
  privRow.style.marginTop = "12px";
  privRow.style.flexWrap = "wrap";
  const expBtn = document.createElement("button");
  expBtn.className = "btn ghost";
  expBtn.type = "button";
  expBtn.textContent = "Export OVULA Data";
  const delBtn = document.createElement("button");
  delBtn.className = "btn ghost";
  delBtn.type = "button";
  delBtn.textContent = "Delete OVULA History";
  const privStatus = document.createElement("span");
  privStatus.className = "bottom-note";

  expBtn.addEventListener("click", async () => {
    try {
      const data = await window.VyoraAPI.exportOvula();
      privStatus.textContent = `Exported ${data.entries?.length || 0} OVULA cycle entries.`;
    } catch (e) {
      privStatus.textContent = e.message;
    }
  });
  delBtn.addEventListener("click", async () => {
    if (!confirm("Delete all OVULA cycle entries and revoke cycle consent?")) return;
    try {
      const res = await window.VyoraAPI.deleteAllOvula();
      privStatus.textContent = res.message || "Deleted OVULA records.";
    } catch (e) {
      privStatus.textContent = e.message;
    }
  });
  privRow.append(expBtn, delBtn, privStatus);
  ovulaChecklist.after(privRow);
}
})();
