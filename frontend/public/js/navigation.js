// Navigation branch: all VYORA sections, including Special Training.
(function(){
const targets = ["home","workout","training","diet","locator","community","ovula","business","health","pro"];
const railBtns = document.querySelectorAll(".navbtn");
const mobileBar = document.getElementById("mobileBar");

targets.forEach(t=>{
  const b=document.createElement("button");
  const labels={
    locator:"Gyms",
    training:"Special Training"
  };
  b.textContent = labels[t] || t.charAt(0).toUpperCase()+t.slice(1);
  b.dataset.target=t;
  if(t==="home") b.classList.add("active");
  mobileBar.appendChild(b);
});

function go(target){
  if(!targets.includes(target)) return;
  targets.forEach(t=>{
    const section=document.getElementById(t);
    if(section) section.classList.toggle("active", t===target);
  });
  document.querySelectorAll("[data-target]").forEach(b=>b.classList.toggle("active", b.dataset.target===target));
  document.body.dataset.section = target;
  window.scrollTo({top:0,behavior:"instant"});
}

// Event delegation keeps dynamically-created mobile navigation buttons working.
document.addEventListener("click", e=>{
  const b=e.target.closest("[data-target]");
  if(!b) return;
  const target=b.dataset.target;
  if(targets.includes(target)) go(target);
});

window.VyoraNavigation={go,targets};
})();
