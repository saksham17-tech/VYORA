// Stage 10 — Local Discovery / Saved Places UI (XSS-free safe DOM construction)
(function(){
const section=document.getElementById('locator'),placeList=document.getElementById('placeList');if(!placeList||!section)return;
const intro=section.querySelector('.sub');
if(intro) intro.textContent='Save gyms, cafés, hydration stops and destinations. Live nearby search and turn-by-turn routes require a configured maps provider; sample listings are not shown as real businesses.';
const filter=document.getElementById('placeFilter');
if(filter) filter.style.display='none';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

const form = el('div', 'card');
form.style.marginBottom = '14px';
const h3 = el('h3', '', 'Save a place or route stop');
h3.style.marginTop = '0';

const nameField = el('div', 'field');
const nameLabel = el('label', '', 'Place name');
nameLabel.setAttribute('for', 'savedPlaceName');
const nameInput = el('input');
nameInput.id = 'savedPlaceName';
nameInput.placeholder = 'Gym, café, water refill or viewpoint';
nameField.append(nameLabel, nameInput);

const grid = el('div', 'grid cols-2');
const typeField = el('div', 'field');
const typeLabel = el('label', '', 'Category');
typeLabel.setAttribute('for', 'savedPlaceType');
const typeSelect = el('select');
typeSelect.id = 'savedPlaceType';
[
  ['gym', 'Gym'],
  ['cafe', 'Café / food'],
  ['hydration', 'Hydration stop'],
  ['viewpoint', 'Viewpoint'],
  ['route', 'Route destination'],
  ['other', 'Other']
].forEach(([val, text]) => {
  const opt = el('option', '', text);
  opt.value = val;
  typeSelect.appendChild(opt);
});
typeField.append(typeLabel, typeSelect);

const addrField = el('div', 'field');
const addrLabel = el('label', '', 'Address or notes');
addrLabel.setAttribute('for', 'savedPlaceAddress');
const addrInput = el('input');
addrInput.id = 'savedPlaceAddress';
addrInput.placeholder = 'Area, address or route note';
addrField.append(addrLabel, addrInput);
grid.append(typeField, addrField);

const saveBtn = el('button', 'btn', 'Save place');
saveBtn.id = 'savePlaceButton';
saveBtn.type = 'button';
const placeStatus = el('p', 'bottom-note', '');
placeStatus.id = 'placeStatus';
placeStatus.setAttribute('aria-live', 'polite');

form.append(h3, nameField, grid, saveBtn, placeStatus);
section.insertBefore(form, placeList);

function card(p){
  const c=el('article','card place-card show');
  c.dataset.type=p.category;
  const h=el('h3','',p.name);
  const meta=el('p','',`${p.category}${p.address?' · '+p.address:''}`);
  const del=el('button','btn ghost','Remove');
  del.type='button';
  del.addEventListener('click',async()=>{
    try{await VyoraAPI.deletePlace(p.id);await load();}
    catch(e){placeStatus.textContent=e.message;}
  });
  c.append(h,meta,del);
  return c;
}
async function load(){
  placeList.replaceChildren();
  try{
    const places=await VyoraAPI.listPlaces();
    if(!places.length){
      placeList.append(el('p','bottom-note','No saved places yet. Add one above.'));
      return;
    }
    places.forEach(p=>placeList.append(card(p)));
  }catch(e){
    placeStatus.textContent=e.message;
  }
}
saveBtn.addEventListener('click',async()=>{
  const name=nameInput.value.trim(),category=typeSelect.value,address=addrInput.value.trim();
  if(!name){placeStatus.textContent='Enter a place name.';return;}
  try{
    await VyoraAPI.savePlace({name,category,address});
    nameInput.value='';addrInput.value='';
    placeStatus.textContent='Place saved to your account.';
    await load();
  }catch(e){placeStatus.textContent=e.message;}
});
load();
})();
