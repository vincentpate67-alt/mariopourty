const marioPourtyKey = 'marioPourty';

function getMarioPourty() {
  return localStorage.getItem(marioPourtyKey) === 'true';
}

function setMarioPourty(enabled) {
  localStorage.setItem(marioPourtyKey, enabled ? 'true' : 'false');
}

function loadMarioPourtyToggle() {
  const toggle = document.getElementById('mario-pourty-toggle');
  if (!toggle) return;
  const applyState = () => { toggle.checked = getMarioPourty(); };
  applyState();
  toggle.addEventListener('change', () => setMarioPourty(toggle.checked));
  // ensure state is correct when navigating back/forward (bfcache/pageshow)
  window.addEventListener('pageshow', () => applyState());
}

const mainContainer = document.querySelector('.container');
const listOverlay = document.getElementById('list-overlay');
const randomOverlay = document.getElementById('random-overlay');
const gamesCardGrid = document.getElementById('games-card-grid');
const randomResult = document.getElementById('random-result');
const spinWheelBtn = document.getElementById('spin-wheel');
const wheelCanvas = document.getElementById('wheel-canvas');
let isSpinning = false;
let currentAnimation = null;
let originalGames = (typeof games !== 'undefined') ? games.slice() : [];
let availableGames = [];
let winnerTimeout = null;
let rerollBtn = null;let phoneWheelRound=0;

function resetRandomState() {
  if (winnerTimeout) { clearTimeout(winnerTimeout); winnerTimeout = null; }
  if (currentAnimation) { cancelAnimationFrame(currentAnimation); currentAnimation = null; }
  isSpinning = false;
  availableGames = originalGames.slice();
  if (randomResult) randomResult.textContent = '';
  if (rerollBtn) rerollBtn.classList.add('hidden');
}

function createRerollButton() {
  if (rerollBtn) return rerollBtn;
  const existing = document.getElementById('reroll-btn');
  const randomContent = document.getElementById('random-content');
  if (existing) {
    rerollBtn = existing;
    if (!rerollBtn._copilotBound) {
      rerollBtn.addEventListener('click', () => {
        if (isSpinning) return;
        if (winnerTimeout) { clearTimeout(winnerTimeout); winnerTimeout = null; }
        const winner = document.getElementById('winner-overlay');
        const randomContentEl = document.getElementById('random-content');
        if (winner) winner.classList.add('hidden');
        if (randomContentEl) randomContentEl.style.visibility = 'visible';
        spinWheel(3);
      });
      rerollBtn._copilotBound = true;
    }
    return rerollBtn;
  }
  if (!randomContent) return null;
  rerollBtn = document.createElement('button');
  rerollBtn.id = 'reroll-btn';
  rerollBtn.className = 'reroll-btn hidden';
  rerollBtn.textContent = "J'en veux un autre";
  rerollBtn.addEventListener('click', () => {
    if (isSpinning) return;
    if (winnerTimeout) { clearTimeout(winnerTimeout); winnerTimeout = null; }
    const winner = document.getElementById('winner-overlay');
    const randomContentEl = document.getElementById('random-content');
    if (winner) winner.classList.add('hidden');
    if (randomContentEl) randomContentEl.style.visibility = 'visible';
    spinWheel(3);
  });
  randomContent.appendChild(rerollBtn);
  rerollBtn._copilotBound = true;
  return rerollBtn;
}

function updateRerollVisibility() {
  createRerollButton();
  if (!rerollBtn) return;
  if (availableGames.length > 0) rerollBtn.classList.remove('hidden');
  else rerollBtn.classList.add('hidden');
}

let menuClosing=false;
function animateMenu(root){root.animate([{opacity:0,transform:'translateY(22px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:440,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});const overlay=root.closest('.overlay');if(overlay)overlay.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-out'});}
function showOverlay(overlay) {
  if(menuClosing)return;
  mainContainer.classList.add('hidden');
  listOverlay.classList.add('hidden');
  randomOverlay.classList.add('hidden');
  overlay.classList.remove('hidden');animateMenu(overlay.querySelector('.overlay-inner'));
}

async function closeOverlay() {
  if(menuClosing)return;const active=[listOverlay,randomOverlay].find(e=>!e.classList.contains('hidden'));if(!active)return;
  menuClosing=true;resetRandomState();const panel=active.querySelector('.overlay-inner');const exit=panel.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(18px) scale(.97)'}],{duration:280,easing:'ease-in',fill:'forwards'});active.animate([{opacity:1},{opacity:0}],{duration:280,fill:'forwards'});await exit.finished;active.classList.add('hidden');active.getAnimations().forEach(a=>a.cancel());exit.cancel();menuClosing=false;
  mainContainer.classList.remove('hidden');animateMenu(mainContainer);
  listOverlay.classList.add('hidden');
  randomOverlay.classList.add('hidden');
  // reset wheel state when closing overlay
  resetRandomState();

  const winner = document.getElementById('winner-overlay');
  const randomContent = document.getElementById('random-content');
  if (winner) winner.classList.add('hidden');
  if (randomContent) randomContent.style.visibility = 'visible';
}

const gameColors = [
  '#ff5f72',
  '#6a82fb',
  '#48c6ef',
  '#7bffb1',
  '#ffbd55',
  '#e96dff',
  '#ff8fab',
  '#74c0fc',
  '#6ee7a8',
  '#ffd43b',
  '#b197fc',
  '#ff8787',
  '#4dabf7',
  '#69db7c',
  '#ffa94d',
  '#c77dff',
  '#38d9a9',
  '#f06595',
  '#9775fa',
  '#ffe066'
];

function showGameListOverlay() {
  mainContainer.classList.add('hidden');
  randomOverlay.classList.add('hidden');
  listOverlay.classList.remove('hidden');
}

function showRandomOverlay() {
  if(menuClosing)return;
  mainContainer.classList.add('hidden');
  listOverlay.classList.add('hidden');
  randomOverlay.classList.remove('hidden');animateMenu(randomOverlay.querySelector('.overlay-inner'));
  // initialize available games and hide reroll button
  originalGames = (typeof games !== 'undefined') ? games.slice() : [];
  availableGames = originalGames.slice();
  if (rerollBtn) rerollBtn.classList.add('hidden');
}

let activeGameCatalog=games;
let specialListOpen=false;
function openGameCatalog(special=false){
  if(menuClosing)return;
  specialListOpen=special;activeGameCatalog=special?specialGames:games;
  document.getElementById('game-list-title').textContent=special?'Spéciaux':'Tous les mini-jeux';
  document.getElementById('game-search').value='';
  renderGameCards();showOverlay(listOverlay);
}
function renderGameCards() {
  gamesCardGrid.replaceChildren();gamesCardGrid.className='games-card-grid';
  const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const query=normalize(document.getElementById('game-search').value.trim());const filtered=activeGameCatalog.filter(game=>normalize(game.title+' '+game.description).includes(query));
  document.getElementById('game-list-count').textContent=filtered.length+' / '+activeGameCatalog.length;
  document.getElementById('game-list-empty').hidden=filtered.length>0;document.getElementById('game-list-empty').textContent=specialListOpen&&!activeGameCatalog.length?'Aucun mini-jeu spécial pour le moment.':'Aucun mini-jeu trouvé.';
  filtered.forEach((game,index)=>{
    const card=document.createElement('button');card.type='button';card.className='game-card';card.style.setProperty('--game-color',gameColors[activeGameCatalog.indexOf(game)%gameColors.length]);
    const head=document.createElement('div');head.className='game-card-top';const icon=document.createElement('img');icon.src=game.icon||(specialListOpen?'assets/index/speciaux.svg':'assets/minigames/'+game.id+'.svg');icon.alt='';const number=document.createElement('span');number.textContent=String(activeGameCatalog.indexOf(game)+1).padStart(2,'0');head.append(icon,number);
    const title=document.createElement('h3');title.textContent=game.title;if(game.id==='aboubaphoto'){const badge=document.createElement('span');badge.className='photo-qr-badge';badge.title='Tous les joueurs doivent être connectés';badge.innerHTML='<svg viewBox="0 0 24 24" aria-label="QR code"><path fill="currentColor" d="M2 2h8v8H2zm2 2v4h4V4zm10-2h8v8h-8zm2 2v4h4V4zM2 14h8v8H2zm2 2v4h4v-4zm10-2h4v4h-4zm6 0h2v6h-2zm-6 6h4v2h-4zm6 2v-2h2v2z"/></svg>';title.append(badge);card.dataset.photoOnly='true';card.disabled=!window.PourtyGamePhones?.active?.allOnline();}const desc=document.createElement('p');desc.textContent=game.description;const play=document.createElement('span');play.className='game-card-play';play.textContent='Jouer →';card.append(head,title,desc,play);
    card.addEventListener('click',()=>{if(game.id==='aboubaphoto'&&!window.PourtyGamePhones?.active?.allOnline())return;window.location.href=game.file;});gamesCardGrid.append(card);
    card.animate([{opacity:0,translate:'0 10px'},{opacity:1,translate:'0 0'}],{duration:300,delay:Math.min(index*22,180),easing:'ease-out',fill:'backwards'});
  });
}

function drawWheel(angle, gameList = games) {
  const ctx = wheelCanvas.getContext('2d');
  const radius = wheelCanvas.width / 2 - 10;
  const center = wheelCanvas.width / 2;
  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  if (!gameList || gameList.length === 0) gameList = games;
  const sliceAngle = (Math.PI * 2) / gameList.length;

  gameList.forEach((game, index) => {
    const startA = angle + index * sliceAngle;
    const endA = startA + sliceAngle;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, startA, endA);
    ctx.closePath();

  const fillPalette = [
    '#ff8fab',
    '#ffb26b',
    '#ffe66d',
    '#6ee7a8',
    '#74c0fc',
    '#b197fc',
    '#ff6fae',
    '#8ce99a',
    '#4dabf7',
    '#c77dff',
    '#ffd43b',
    '#69db7c',
    '#ff8787',
    '#ffa94d',
    '#ffd93d',
    '#38d9a9',
    '#339af0',
    '#9775fa',
    '#f06595',
    '#51cf66'
  ];
    ctx.fillStyle = fillPalette[index % fillPalette.length];
    ctx.fill();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(startA + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Segoe UI';
    ctx.fillText(game.title, radius - 12, 6);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,.3)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function renderRandomWheel() {
  if (!availableGames || availableGames.length === 0) availableGames = (typeof games !== 'undefined' ? games.slice() : []);
  drawWheel(0, availableGames);
}

function startParticleBurst() {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.clientWidth / 2,
      y: canvas.clientHeight / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.5) * 16,
      size: 1 + Math.random() * 2,
      life: 1
    });
  }

  const duration = 700;
  const start = performance.now();

  function animate(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    particles.forEach(p => {
      if (p.life > 0) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life -= 0.02;
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0,p.life)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
      }
    });

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    }
  }

  requestAnimationFrame(animate);
}

function showWinnerOverlay(game) {phoneWheelRound++;
  const winner = document.getElementById('winner-overlay');
  const title = document.getElementById('winner-title');
  const desc = document.getElementById('winner-desc');
  const randomContent = document.getElementById('random-content');

  title.textContent = game.title;
  desc.textContent = game.description;
  if (randomContent) randomContent.style.visibility = 'hidden';
  winner.classList.remove('hidden');

  if (winnerTimeout) clearTimeout(winnerTimeout);
  winnerTimeout = setTimeout(() => {
    window.location.href = game.file;
  }, 5000);

  // show reroll button if there are still games left
  updateRerollVisibility();
}

function spinWheel(speedMultiplier = 1) {
  if (isSpinning) return;
  isSpinning = true;
  randomResult.textContent = 'Tourne...';
  startParticleBurst();

  if (!availableGames || availableGames.length === 0) availableGames = (typeof games !== 'undefined' ? games.slice() : []);

  const targetIndex = Math.floor(Math.random() * availableGames.length);
  const sliceAngle = (Math.PI * 2) / availableGames.length;
  const fullSpins = 6;
  const targetAngle = fullSpins * 2 * Math.PI + (Math.PI * 1.5) - (targetIndex + 0.5) * sliceAngle;

  const duration = Math.max(200, Math.floor(6000 / speedMultiplier));
  const start = performance.now();
  const initAngle = 0;

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOut(progress);
    const currentAngle = initAngle + (targetAngle - initAngle) * eased;
    drawWheel(currentAngle, availableGames);

    if (progress < 1) {
      currentAnimation = requestAnimationFrame(frame);
    } else {
      isSpinning = false;
      const selected = availableGames[targetIndex];
      // remove the selected from availableGames so future rerolls won't include it
      availableGames.splice(targetIndex, 1);
      randomResult.textContent = `Jeu choisi : ${selected.title}`;
      showWinnerOverlay(selected);
    }
  }

  currentAnimation = requestAnimationFrame(frame);
}


function initGameControls() {
  document.getElementById('game-search').addEventListener('input',renderGameCards);
  document.getElementById('list-game').addEventListener('click',()=>openGameCatalog(false));
  document.getElementById('special-game').addEventListener('click',()=>openGameCatalog(true));

  document.getElementById('random-game').addEventListener('click', () => {
    showRandomOverlay();
    renderRandomWheel();
    createRerollButton();
  });

  document.querySelectorAll('.close-overlay').forEach(btn => {
    btn.addEventListener('click', closeOverlay);
  });

  spinWheelBtn.addEventListener('click', () => spinWheel(1));
}

function initCollapsibles() {
  document.querySelectorAll('.panel.collapsible').forEach(panel=>{
    const btn=panel.querySelector('.toggle-btn'),content=panel.querySelector('.panel-content');let animation=null;
    const sync=()=>{const open=panel.dataset.open==='true';btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'⌃':'⌄';content.inert=!open;};sync();
    btn.addEventListener('click',()=>{
      const from=content.getBoundingClientRect().height,opacity=Number(getComputedStyle(content).opacity),opening=panel.dataset.open!=='true';
      animation?.cancel();panel.dataset.open='true';const fullHeight=content.scrollHeight;
      panel.dataset.open=String(opening);sync();
      const current=content.animate([{height:from+'px',opacity},{height:(opening?fullHeight:0)+'px',opacity:opening?1:0}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});animation=current;
      current.finished.then(()=>{if(animation!==current)return;current.cancel();animation=null;}).catch(()=>{});
    });
  });
}

window.addEventListener('load', () => {
  initCollapsibles();
  initGameControls();
  loadMarioPourtyToggle();
});

// Reset random state if user navigates away or page is hidden
window.addEventListener('pagehide', () => {
  resetRandomState();
  if (rerollBtn) rerollBtn.classList.add('hidden');
});
window.addEventListener('beforeunload', () => {
  resetRandomState();
});

window.addEventListener('keydown', event => { if (event.key === 'Escape') closeOverlay(); });

window.addEventListener('load',()=>{
  const phoneRoster=JSON.parse(localStorage.getItem('mini-Jeux-host-players')||'[]');
  window.PourtyGamePhones?.register({id:'menu',roster:()=>phoneRoster,view:(i,h)=>{
    if(!isSpinning&&h.visible(rerollBtn)&&h.visible(document.getElementById('winner-overlay')))return h.vote('reroll:'+phoneWheelRound,i,[{id:'reroll',label:'J’en veux un autre'}],()=>rerollBtn.click(),{strict:true,title:document.getElementById('winner-title').textContent});
    return {key:'menu:'+phoneWheelRound,title:isSpinning?'La roue tourne…':'',actions:[]};
  }});
  const watcher=setInterval(()=>{document.querySelectorAll('[data-photo-only]').forEach(card=>{card.disabled=!window.PourtyGamePhones?.active?.allOnline();card.title=card.disabled?'Connecte tous les joueurs dans le menu Téléphones.':'';});},400);
  window.addEventListener('pagehide',()=>clearInterval(watcher),{once:true});
  if(new URLSearchParams(location.search).has('phoneRandom')){document.getElementById('random-game').click();spinWheel(1);history.replaceState(null,'',location.pathname);}
});
