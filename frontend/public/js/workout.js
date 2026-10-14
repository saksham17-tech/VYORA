// Stage 10 — Workout Engine UI (XSS-free safe DOM rendering + painful/skipped/completed feedback)
(function(){
const week = {
  Mon:[["Bench Press","4x8 · RPE 7 · Warm-up: 5m shoulder mobility"],["Incline DB Press","3x10 · Rest 60s"],["Cable Fly","3x12 · Controlled tempo"],["Overhead Press","3x8 · Core braced"]],
  Tue:[["Deadlift","4x6 · RPE 7 · Neutral spine"],["Lat Pulldown","3x10 · Full stretch"],["Barbell Row","3x10 · Pull to hip"],["Face Pull","3x15 · Posture focus"]],
  Wed:[["Rest / Mobility","20 min · Low-impact recovery"],["Stretch Flow","15 min · Nasal breathing"]],
  Thu:[["Back Squat","4x8 · Knee-friendly sub: Glute Bridge"],["Leg Press","3x12 · Controlled descent"],["Walking Lunge","3x12 · Soft landing"],["Calf Raise","4x15 · Pause at top"]],
  Fri:[["Push Press","4x6 · RPE 7"],["Dips / Incline Push-Up","3x10 · Shoulder-safe range"],["Lateral Raise","3x15"],["Tricep Pushdown","3x12"]],
  Sat:[["Pull-ups / Assisted Pull","4x8"],["Seated Row","3x10"],["Hammer Curl","3x12"],["Plank","3x45s"]],
  Sun:[["Rest","Full recovery day"]]
};
const dayTabs=document.getElementById("dayTabs"), exList=document.getElementById("exList");
if (!dayTabs || !exList) return;

Object.keys(week).forEach((d,i)=>{
  const b=document.createElement("button");
  b.type="button";
  b.textContent=d;
  if(i===0) b.classList.add("active");
  b.addEventListener("click",()=>{
    document.querySelectorAll("#dayTabs button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    renderDay(d);
  });
  dayTabs.appendChild(b);
});

function renderDay(d){
  exList.replaceChildren();
  week[d].forEach(([name,meta])=>{
    const row=document.createElement("div");
    row.className="exrow";

    const info=document.createElement("div");
    const exName=document.createElement("div");
    exName.className="exname";
    exName.textContent=name;
    const exMeta=document.createElement("div");
    exMeta.className="exmeta";
    exMeta.textContent=meta;
    info.append(exName, exMeta);

    const actions=document.createElement("div");
    actions.className="chat-row";

    const painBtn=document.createElement("button");
    painBtn.type="button";
    painBtn.className="btn ghost";
    painBtn.style.fontSize="11.5px";
    painBtn.style.padding="4px 8px";
    painBtn.textContent="Pain / Swap";
    painBtn.addEventListener("click", async ()=>{
      exMeta.textContent = "Stopped aggravating movement → Switched to conservative pain-free mobility/glute bridge. Consult a clinician if pain persists.";
      try {
        await window.VyoraAPI.logWorkout({day:d,exercise:name,volume:meta,painFlag:true,status:"modified_pain",completedAt:new Date().toISOString()});
      } catch {}
    });

    const btn=document.createElement("button");
    btn.type="button";
    btn.className="check";
    btn.setAttribute("aria-label",`Mark ${name} done`);
    btn.addEventListener("click",async()=>{
      const done=!row.classList.contains("done");
      row.classList.toggle("done",done);
      if(done){
        try{
          await window.VyoraAPI.logWorkout({day:d,exercise:name,volume:meta,completedAt:new Date().toISOString(),status:"completed"});
          btn.textContent="✓";
        }catch(e){
          btn.textContent="!";
          btn.title="Could not save workout: "+e.message;
        }
      } else {
        btn.textContent="";
      }
    });

    actions.append(painBtn, btn);
    row.append(info, actions);
    exList.appendChild(row);
  });
}
renderDay("Mon");
})();
