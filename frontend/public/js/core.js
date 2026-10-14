// Shared runtime branch: chat + speech utilities
(function(){
function addMsg(logId, cls, text){
  const log=document.getElementById(logId); if(!log) return;
  const d=document.createElement("div"); d.className="msg "+cls; d.textContent=text;
  log.appendChild(d); log.scrollTop=log.scrollHeight;
}
function speakWithOrb(text, orb, status){
  if(!orb) return;
  orb.classList.remove("think"); orb.classList.add("talk"); if(status) status.textContent="Speaking…";
  const done=()=>{ orb.classList.remove("talk"); if(status) status.textContent="Ready"; };
  try{
    if("speechSynthesis" in window){
      const u=new SpeechSynthesisUtterance(text);
      u.onend=done; u.onerror=done;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } else { setTimeout(done, Math.min(4500, 1200+text.length*35)); }
  }catch(e){ setTimeout(done,1500); }
}
function wireChat(inputId, sendId, logId, orbId, replyFn){
  const input=document.getElementById(inputId), orb=document.getElementById(orbId);
  const status=document.getElementById(orbId+"Status");
  function send(){
    const val=input.value.trim(); if(!val) return;
    addMsg(logId,"user",val); input.value="";
    orb.classList.add("think"); if(status) status.textContent="Thinking…";
    setTimeout(async ()=>{
      try {
        const reply=await replyFn(val);
        addMsg(logId,"bot",reply);
        speakWithOrb(reply, orb, status);
      } catch(e) {
        const reply="I couldn't connect to the AI service right now. Check the backend configuration or try again shortly.";
        addMsg(logId,"bot",reply); speakWithOrb(reply, orb, status);
      }
    },120);
  }
  document.getElementById(sendId).addEventListener("click",send);
  input.addEventListener("keydown",e=>{if(e.key==="Enter")send();});
  return {send};
}
function wireMic(btnId, inputId, orbId, onVoice){
  const btn=document.getElementById(btnId), input=document.getElementById(inputId);
  const orb=document.getElementById(orbId), status=document.getElementById(orbId+"Status");
  const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ btn.addEventListener("click",()=>alert("Voice input isn't supported in this browser — please type instead.")); return; }
  const rec=new SR(); rec.lang="en-US"; rec.interimResults=false; rec.continuous=false;
  let on=false;
  btn.addEventListener("click",()=>{
    if(on){ rec.stop(); return; }
    try{ rec.start(); on=true; btn.classList.add("on"); orb.classList.add("listen"); if(status) status.textContent="Listening…"; }catch(e){}
  });
  rec.onresult=(e)=>{
    const transcript=e.results[0][0].transcript.trim();
    input.value=transcript;
    if(typeof onVoice==='function') onVoice(transcript);
  };
  rec.onend=()=>{ on=false; btn.classList.remove("on"); orb.classList.remove("listen"); if(status) status.textContent="Ready"; };
  rec.onerror=()=>{ on=false; btn.classList.remove("on"); orb.classList.remove("listen"); if(status) status.textContent="Ready"; };
}
function triggerWave(id){
  const el=document.getElementById(id); if(!el) return;
  el.classList.add("show");
  el.addEventListener("animationend",()=>el.classList.remove("show"),{once:true});
}
function navigate(target){
  const b=document.querySelector('[data-target="'+target+'"]');
  if(b) b.click();
  else { const v=document.getElementById(target); if(v) v.classList.add('active'); }
}
window.VyoraCore={addMsg,speakWithOrb,wireChat,wireMic,triggerWave,navigate};
})();
