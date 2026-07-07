/* ============================================================
   SMOOTH ANCHOR NAV (no history API — safe everywhere)
============================================================ */
const navLinks = document.querySelectorAll('[data-nav]');
navLinks.forEach(link=>{
  link.addEventListener('click', (e)=>{
    const href = link.getAttribute('href') || '';
    if(href.startsWith('#')){
      const target = document.getElementById(href.slice(1));
      if(target){
        e.preventDefault();
        target.scrollIntoView({behavior:'smooth', block:'start'});
      }
    }
    closeDrawer();
  });
});

/* scrollspy: highlight nav items for section currently in view */
const sections = document.querySelectorAll('main section[id], section#home');
const spy = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      const id = entry.target.id;
      navLinks.forEach(l => l.classList.toggle('active', l.dataset.nav === id));
    }
  });
}, {rootMargin:'-45% 0px -50% 0px', threshold:0});
sections.forEach(s=>spy.observe(s));

/* ============================================================
   HEADER SHRINK
============================================================ */
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', ()=>{
  header.classList.toggle('shrink', window.scrollY > 40);
}, {passive:true});

/* ============================================================
   MOBILE DRAWER
============================================================ */
const drawer = document.getElementById('mobileDrawer');
const overlay = document.getElementById('drawerOverlay');
function openDrawer(){ drawer.classList.add('open'); overlay.classList.add('open'); }
function closeDrawer(){ drawer.classList.remove('open'); overlay.classList.remove('open'); }
document.getElementById('burgerBtn').addEventListener('click', openDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);

/* ============================================================
   REVEAL ON SCROLL
============================================================ */
const revealTargets = document.querySelectorAll('.reveal, .reveal-stagger');
const revealObserver = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){ entry.target.classList.add('in'); revealObserver.unobserve(entry.target); }
  });
}, {threshold:.05, rootMargin:'0px 0px -5% 0px'});
revealTargets.forEach(t=>revealObserver.observe(t));

/* ============================================================
   PAGE FADE-IN
============================================================ */
document.addEventListener('DOMContentLoaded', ()=>{
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ document.body.classList.add('loaded'); }); });
});

/* ============================================================
   GALLERY FILTER
============================================================ */
const filterBtns = document.querySelectorAll('.filter-tabs button');
const galleryTiles = document.querySelectorAll('.gallery-tile');
filterBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    filterBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    galleryTiles.forEach(tile=>{
      const tags = (tile.dataset.tags || '').split(' ');
      const show = f === 'all' || tags.includes(f);
      tile.style.display = show ? '' : 'none';
    });
  });
});

/* ============================================================
   GALLERY LIGHTBOX (every tile — photo or empty placeholder — opens on click)
============================================================ */
const lightbox = document.getElementById('lightbox');
const lightboxMedia = document.getElementById('lightboxMedia');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxSubtitle = document.getElementById('lightboxSubtitle');
const lightboxClose = document.getElementById('lightboxClose');

function openLightbox(tile){
  const img = tile.querySelector('img');
  const label = tile.querySelector('.g-label');
  const styleName = label?.querySelector('b')?.textContent || '';
  const stylistName = label ? label.textContent.replace(styleName, '').trim() : '';

  if (img){
    lightboxMedia.innerHTML = `<img src="${img.src}" alt="${img.alt || styleName}">`;
  } else {
    lightboxMedia.innerHTML = `<div class="lightbox-placeholder"><i class="fa-solid fa-image"></i><span>Снимката предстои да бъде добавена.</span></div>`;
  }
  lightboxTitle.textContent = styleName;
  lightboxSubtitle.textContent = stylistName;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(){
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

galleryTiles.forEach(tile=>{
  tile.setAttribute('tabindex', '0');
  tile.setAttribute('role', 'button');
  tile.addEventListener('click', ()=> openLightbox(tile));
  tile.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openLightbox(tile); }
  });
});

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e)=>{ if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox(); });

/* ============================================================
   FACE SHAPE FINDER (upload + draggable overlay + recommendations)
============================================================ */
const fsfData = {
  men:{
    long:{styles:['Класически бизнес крой','Кроп с бретон','Текстура отгоре без височина'], tip:'Избягвай прекалена височина отгоре — добави плътност отстрани.'},
    oval:{styles:['Skin Fade','Помпадур','Класически бизнес крой'], tip:'Овалното лице пасва на почти всеки стил — можеш спокойно да експериментираш.'},
    rhombus:{styles:['Текстуриран Quiff','Кроп с брада','Fade с плавен преход'], tip:'Брада по линията на челюстта балансира по-острите скули.'},
    square:{styles:['Buzz Cut','Кроп с брада','Класически страничен път'], tip:'По-меки, заоблени линии омекотяват силната челюст.'},
    rectangular:{styles:['Кроп с бретон','Fade с текстура отстрани','Класически страничен път с обем'], tip:'Лек бретон и лек обем отстрани скъсяват визуално издълженото лице.'},
    heart:{styles:['Помпадур','Curly Crop','Странично разделяне'], tip:'Малко повече обем отстрани балансира по-широкото чело.'},
    triangular:{styles:['Обемен Quiff','Текстуриран Crop с обем отгоре','Помпадур'], tip:'Обем в горната част на прическата балансира по-широката челюст.'}
  },
  women:{
    long:{styles:['Blowout с вълни','Пълен бретон','Layers на нивото на брадичката'], tip:'Хоризонтален обем визуално скъсява лицето.'},
    oval:{styles:['Long Layers','Curtain Bangs','Balayage Waves'], tip:'Овалната форма е универсална — почти всичко ти отива.'},
    rhombus:{styles:['Long Bob (Lob)','Side Part Waves','Layers около скулите'], tip:'Меки слоеве около скулите омекотяват формата на лицето.'},
    square:{styles:['Boho Curls','Мек Layered Cut','Странично разделен бретон'], tip:'Меки вълни омекотяват ъглите на челюстта.'},
    rectangular:{styles:['Long Layers със странично разделяне','Curtain Bangs','Меки вълни на краищата'], tip:'Бретон и вълни на краищата добавят ширина и скъсяват визуално издълженото лице.'},
    heart:{styles:['French Bob','Curtain Bangs','Balayage с обем в долната част'], tip:'Обем към краищата на косата балансира по-широкото чело.'},
    triangular:{styles:['Bob с обем на темето','Layers около челото','Странично сресан бретон'], tip:'Обем в горната част и около слепоочията балансира по-широката челюст.'}
  }
};
const shapeNames = {
  long:'Продълговато лице',
  oval:'Овално лице',
  rhombus:'Ромбовидно лице',
  square:'Квадратно лице',
  rectangular:'Правоъгълно лице',
  heart:'Сърцевидно лице',
  triangular:'Триъгълно лице'
};
/* exact face-shape templates supplied by the salon, embedded as data URIs
   so the tool works from a single HTML file with no external image files */
const shapeAssets = {
  long: 'images/shape-long.webp',
  oval: 'images/shape-oval.webp',
  rhombus: 'images/shape-rhombus.webp',
  square: 'images/shape-square.webp',
  rectangular: 'images/shape-rectangular.webp',
  heart: 'images/shape-heart.webp',
  triangular: 'images/shape-triangular.webp',
};
document.querySelectorAll('.fsf-shape-thumb').forEach(img=>{
  img.src = shapeAssets[img.dataset.shapeIcon];
});

let currentGender = 'men';
let currentShape = null;
let hasPhoto = false;

document.getElementById('genderToggle').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  document.querySelectorAll('#genderToggle button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentGender = btn.dataset.gender;
  if(currentShape) renderRecommendation();
});

document.querySelectorAll('.fsf-card').forEach(card=>{
  card.addEventListener('click', ()=>{
    document.querySelectorAll('.fsf-card').forEach(c=>c.classList.remove('active'));
    card.classList.add('active');
    currentShape = card.dataset.shape;
    renderRecommendation();
    if(hasPhoto) showOverlay(currentShape);
  });
});

function renderRecommendation(){
  const data = fsfData[currentGender][currentShape];
  document.getElementById('fsfHint').style.display = 'none';
  const result = document.getElementById('fsfResult');
  document.getElementById('fsfTagLabel').textContent = (currentGender==='men' ? 'Мъжка препоръка' : 'Дамска препоръка');
  document.getElementById('fsfTitle').textContent = shapeNames[currentShape] + ' — препоръчани стилове';
  const list = document.getElementById('fsfList');
  list.innerHTML = '';
  data.styles.forEach(s=>{
    const li = document.createElement('li');
    li.innerHTML = '<i class="fa-solid fa-scissors"></i> ' + s;
    list.appendChild(li);
  });
  document.getElementById('fsfTip').textContent = data.tip;
  result.classList.add('show');
  result.scrollIntoView({behavior:'smooth', block:'nearest'});
}

/* --- photo upload (gallery + camera) --- */
const fsfFileInput = document.getElementById('fsfFileInput');
const fsfCameraInput = document.getElementById('fsfCameraInput');
const fsfPhoto = document.getElementById('fsfPhoto');
const fsfPlaceholder = document.getElementById('fsfPlaceholder');
const fsfOverlay = document.getElementById('fsfOverlay');
const fsfOverlaySvg = document.getElementById('fsfOverlaySvg');
const fsfStageControls = document.getElementById('fsfStageControls');
const fsfDragHint = document.getElementById('fsfDragHint');
const fsfScale = document.getElementById('fsfScale');

function handlePhotoFile(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    fsfPhoto.src = ev.target.result;
    fsfPhoto.style.display = 'block';
    fsfPlaceholder.style.display = 'none';
    fsfStageControls.classList.add('show');
    hasPhoto = true;
    if(currentShape) showOverlay(currentShape);
  };
  reader.readAsDataURL(file);
}
fsfFileInput.addEventListener('change', handlePhotoFile);
fsfCameraInput.addEventListener('change', handlePhotoFile);

document.getElementById('fsfChangePhoto').addEventListener('click', ()=>{
  fsfPhoto.style.display = 'none';
  fsfPhoto.src = '';
  fsfPlaceholder.style.display = 'block';
  fsfOverlay.style.display = 'none';
  fsfStageControls.classList.remove('show');
  fsfDragHint.classList.remove('show');
  hasPhoto = false;
  fsfFileInput.value = '';
  fsfCameraInput.value = '';
});

/* overlay position/scale state — composed into a single transform so drag + slider never conflict */
let ovX = 0, ovY = 0, ovScale = 1;
function applyOverlayTransform(){
  fsfOverlaySvg.style.transform = `translate(${ovX}px, ${ovY}px) scale(${ovScale})`;
}

function showOverlay(shape){
  fsfOverlaySvg.src = shapeAssets[shape];
  ovX = 0; ovY = 0; ovScale = 1;
  fsfScale.value = 100;
  applyOverlayTransform();
  fsfOverlay.style.display = 'flex';
  fsfDragHint.classList.add('show');
}

fsfScale.addEventListener('input', ()=>{
  ovScale = fsfScale.value / 100;
  applyOverlayTransform();
});

/* drag to reposition overlay */
let dragging = false, startX = 0, startY = 0;
fsfOverlaySvg.addEventListener('pointerdown', (e)=>{
  dragging = true;
  startX = e.clientX - ovX;
  startY = e.clientY - ovY;
  fsfOverlaySvg.setPointerCapture(e.pointerId);
});
fsfOverlaySvg.addEventListener('pointermove', (e)=>{
  if(!dragging) return;
  ovX = e.clientX - startX;
  ovY = e.clientY - startY;
  applyOverlayTransform();
});
['pointerup','pointercancel'].forEach(ev=>{
  fsfOverlaySvg.addEventListener(ev, ()=>{ dragging = false; });
});

/* ============================================================
   CALCULATOR
============================================================ */
const calcInputs = document.querySelectorAll('#calcList input[type="checkbox"]');
const calcTotalEl = document.getElementById('calcTotal');
let calcCurrent = 0;

function updateCalc(){
  let total = 0;
  calcInputs.forEach(inp=>{
    const row = inp.closest('.calc-item');
    row.classList.toggle('checked', inp.checked);
    if(inp.checked) total += parseFloat(inp.dataset.price);
  });
  animateCount(calcCurrent, total);
  calcCurrent = total;
}
function animateCount(from, to){
  const dur = 400; const start = performance.now();
  function tick(now){
    const p = Math.min(1, (now-start)/dur);
    const val = Math.round(from + (to-from) * p);
    calcTotalEl.textContent = val;
    if(p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
calcInputs.forEach(inp => inp.addEventListener('change', updateCalc));

/* ============================================================
   MISC
============================================================ */
document.getElementById('year').textContent = new Date().getFullYear();
