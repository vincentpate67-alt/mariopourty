(() => {
  'use strict';
  const store = window.PourtySession;
  const maps = window.PourtyMaps.filter(map=>map.board);
  const state = store.getDraft();
  const miscDefaultsKey='mario-pourty-map-defaults';
  const miscFields=['hiddenBlocks','hiddenBlockCount','doubleCoinsMinigames','bonusStars','bonusCategories','bonusCount','shopSelling','shopMultiplier','movementDieMax','inventorySlots','startingAC','startingStars','starPrice'];
  function readSavedDefaults(){try{const value=JSON.parse(localStorage.getItem(miscDefaultsKey));const saved=value&&typeof value==='object'&&!Array.isArray(value)?value:{};const migration='mario-pourty-defaults-two-bonus-v1';if(!localStorage.getItem(migration)){for(const config of Object.values(saved))if(config&&typeof config==='object'&&!Array.isArray(config))config.bonusCount=2;localStorage.setItem(miscDefaultsKey,JSON.stringify(saved));localStorage.setItem(migration,'1');}return saved;}catch{return {};}}
  function mapDefaults(){const config=window.PourtyMiscDefaults;return store.normalize({...config.fallback,...config.maps[state.mapId],...readSavedDefaults()[state.mapId],mapId:state.mapId});}

  if(!maps.some(map=>map.id===state.mapId))state.mapId=null;
  const $ = id => document.getElementById(id);
  const steps = [...document.querySelectorAll('[data-step]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  let step = 0, miscCustom = false, miscMapId = null;
  let launching = false,transitioning=false,teamDistribution=false;
  const teamSetup=window.PourtyTeamSetup({root:$('team-setup'),state,players:store.getPlayers(),save:()=>{persist();refreshNext();}});
  const animateSetup=()=>typeof panels[0]?.animate==='function';
  const error = text => { $('setup-error').textContent = text; };
  const mapButtons = [];
  const checkboxes = [];
  function persist() { try { store.saveDraft(state); error(''); return true; } catch (e) { error(e.message); return false; } }
  function validTurns() { const value = Number($('turns').value); return Number.isInteger(value) && value >= 5 && value <= 30; }
  function refreshNext() {
    const hideNext=step===4&&!miscCustom;
    $('next').classList.toggle('next-concealed',hideNext);$('next').inert=hideNext;$('next').setAttribute('aria-hidden',String(hideNext));
    $('misc-save-defaults').disabled=transitioning||launching||(miscCustom&&!validMisc());
    $('misc-default-yes').disabled=transitioning||launching;
    $('misc-default-no').disabled=transitioning||launching;
    $('next').disabled = launching || transitioning || (step === 0 && !state.mapId) || (step === 2 && !validTurns()) || (step===1&&teamDistribution&&!teamSetup.valid()) || (step === 3 && !state.minigameIds.length) || (step===4&&!validMisc());
  }
  let previewNumber=0;
  function mapArtwork(map){
    if(!map.board){const image=document.createElement('img');image.src=map.image;image.alt='Aperçu de '+map.name;return image;}
    const model=window.PourtyBoardModel,board=map.board,b=model.bounds(board),ns='http://www.w3.org/2000/svg';
    const make=(tag,attrs)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
    const svg=make('svg',{viewBox:[b.x,b.y,b.width,b.height].join(' '),preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':'Aperçu de '+map.name,class:'board-map-artwork'}),nodes=new Map(board.nodes.map(n=>[n.id,n])),arrow='preview-arrow-'+(++previewNumber);
    const defs=make('defs',{}),marker=make('marker',{id:arrow,viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});marker.append(make('path',{d:'M0 0L10 5L0 10z',fill:'#667aab'}));defs.append(marker);svg.append(defs);model.applyBackground(svg,board);
    window.PourtyRaster.preview(svg,board,b);
    const routes=new Set(board.edges.map(e=>e.from+'>'+e.to));
    for(const edge of board.edges){const a=nodes.get(edge.from),z=nodes.get(edge.to),dx=z.x-a.x,dy=z.y-a.y,len=Math.hypot(dx,dy)||1,x1=a.x+dx/len*29,y1=a.y+dy/len*29,x2=z.x-dx/len*32,y2=z.y-dy/len*32,offset=routes.has(edge.to+'>'+edge.from)?8:0;svg.append(make('path',{d:'M'+x1+' '+y1+' Q'+((x1+x2)/2-dy/len*offset)+' '+((y1+y2)/2+dx/len*offset)+' '+x2+' '+y2,stroke:'#667aab','stroke-width':3,fill:'none','marker-end':'url(#'+arrow+')'}));}
    for(const node of board.nodes){const group=make('g',{transform:'translate('+node.x+' '+node.y+')'});group.append(model.spaceArtwork(node.type));svg.append(group);}return svg;
  }
  function pickMap(id, save = true) {
    state.mapId = id;
    renderBonus();
    const map = maps.find(item => item.id === id);
    $('map-preview').hidden = false;
    const artwork=mapArtwork(map);artwork.id='map-image';$('map-image').replaceWith(artwork);
    $('map-kind').textContent = map.board ? 'Plateau personnalisé' : 'Map provisoire';
    $('map-name').textContent = map.name;$('map-difficulty').replaceChildren(window.PourtyBoardModel.difficultyArtwork(map.board||map)); $('map-description').textContent = map.description;
    mapButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.map === id)));
    if (save) {persist();window.PourtyMenuMotion?.reveal($('map-preview'),id);} refreshNext();
  }
  maps.forEach(map => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'map-choice'; button.dataset.map = map.id; button.setAttribute('aria-pressed', 'false');
    const image = mapArtwork(map);
    const title = document.createElement('span');title.className='map-choice-caption';const name=document.createElement('span');name.className='map-choice-name';name.textContent=map.name;title.append(name,window.PourtyBoardModel.difficultyArtwork(map.board||map));
    button.append(image, title); button.addEventListener('click', () => pickMap(map.id)); $('map-grid').append(button); mapButtons.push(button);
  });
  function updateGames(save = true) {
    state.minigameIds = checkboxes.filter(input => input.checked).map(input => input.value);
    $('games-count').textContent = `${state.minigameIds.length} / ${games.length}`;
    if (save) persist();
    if (!state.minigameIds.length) error('Sélectionne au moins un mini-jeu.');
    refreshNext();
  }
  games.forEach(game => {
    const label = document.createElement('label'); label.className = 'game-check';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = game.id; input.checked = state.minigameIds.includes(game.id);
    const title = document.createElement('span'); title.textContent = game.title;
    label.append(input, title); $('game-checklist').append(label); checkboxes.push(input); input.addEventListener('change', () => updateGames());
  });
  $('select-all').addEventListener('click', () => { checkboxes.forEach(input => { input.checked = true; }); updateGames(); });
  $('select-none').addEventListener('click', () => { checkboxes.forEach(input => { input.checked = false; }); updateGames(); });
  function updateTurns(value) {
    $('turns').value = value;
    if (!validTurns()) { error('Choisis un nombre entier entre 5 et 30.'); $('duration').textContent = '—'; refreshNext(); return; }
    state.turns = Number(value); $('turns-range').value = value; $('duration').textContent = store.estimateMinutes(state.turns);
    $('turns-less').disabled = state.turns === 5; $('turns-more').disabled = state.turns === 30;
    persist(); refreshNext();
  }
  $('turns').value = state.turns; $('turns-range').value = state.turns; $('duration').textContent = store.estimateMinutes(state.turns);
  $('turns-less').disabled = state.turns === 5; $('turns-more').disabled = state.turns === 30;
  $('turns').addEventListener('input', event => updateTurns(event.target.value));
  $('turns-range').addEventListener('input', event => updateTurns(event.target.value));
  $('turns-less').addEventListener('click', () => updateTurns(Math.max(5, state.turns - 1)));
  $('turns-more').addEventListener('click', () => updateTurns(Math.min(30, state.turns + 1)));
  $('mode-teams').disabled=store.getPlayers().length<2;$('mode-teams').title=store.getPlayers().length<2?'Ajoute au moins deux joueurs pour jouer en équipes':'';
  function renderMode(){for(const mode of ['normal','inverted','teams'])$('mode-'+mode).setAttribute('aria-pressed',String(state.gameMode===mode));}
  for(const mode of ['normal','inverted','teams'])$('mode-'+mode).addEventListener('click',()=>{state.gameMode=mode;renderMode();if(step===1)$('next').textContent=mode==='teams'?'Répartition →':'Continuer →';const image=$('mode-'+mode).querySelector('img');image.animate([{transform:'scale(.95)',opacity:.65},{transform:'scale(1)',opacity:1}],{duration:280,easing:'ease-out'});persist();});renderMode();
  $('bonus-stars').checked = state.bonusStars;
  function validMisc(){if(state.hiddenBlocks&&(!Number.isSafeInteger(Number($('hidden-block-count').value))||Number($('hidden-block-count').value)<1||Number($('hidden-block-count').value)>999))return false;const multiplier=Number($('shop-multiplier').value);if($('shop-multiplier').value.trim()===''||!Number.isFinite(multiplier)||multiplier<0)return false;const die=Number($('movement-die-max').value);if(!Number.isInteger(die)||die<5||die>20)return false;const slots=Number($('inventory-slots').value);return Number.isInteger(slots)&&slots>=1&&slots<=4&&['starting-ac','starting-stars','star-price'].every(id=>$(id).value.trim()!==''&&Number.isSafeInteger(Number($(id).value))&&Number($(id).value)>=0)&&(!state.bonusStars||(state.bonusCategories.length>0&&$('bonus-count').value.trim()!==''&&Number.isSafeInteger(Number($('bonus-count').value))&&Number($('bonus-count').value)>=1&&Number($('bonus-count').value)<=state.bonusCategories.length));}
  let bonusAnimation=null;
  function renderBonus(animated=false){
    const hasEvent=maps.find(m=>m.id===state.mapId)?.board?.nodes.some(n=>n.type==='event');
    if(!hasEvent)state.bonusCategories=state.bonusCategories.filter(id=>id!=='event-stops');
    [...$('bonus-categories').children].forEach((label,index)=>{const category=store.bonusCategories[index];label.hidden=category.id==='event-stops'&&!hasEvent;const check=label.querySelector('input');check.checked=state.bonusCategories.includes(category.id);check.disabled=label.hidden;});
    const box=$('bonus-settings'),opening=state.bonusStars,height=box.hidden?0:box.getBoundingClientRect().height,opacity=box.hidden?0:Number(getComputedStyle(box).opacity),margin=box.hidden?0:parseFloat(getComputedStyle(box).marginTop);
    bonusAnimation?.cancel();bonusAnimation=null;
    if(animated&&animateSetup()){
      box.hidden=false;box.inert=!opening;const targetHeight=box.scrollHeight;
      const animation=box.animate([{height:height+'px',opacity,marginTop:margin+'px'},{height:(opening?targetHeight:0)+'px',opacity:opening?1:0,marginTop:opening?'24px':'0px'}],{duration:400,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});bonusAnimation=animation;box.classList.add('bonus-transition');
      animation.finished.then(()=>{if(bonusAnimation!==animation)return;box.hidden=!opening;animation.cancel();bonusAnimation=null;box.classList.remove('bonus-transition');}).catch(()=>{});
    }else{box.hidden=!opening;box.inert=!opening;box.classList.remove('bonus-transition');}
$('bonus-count').max=Math.max(1,state.bonusCategories.length);state.bonusCount=Math.max(1,Math.min(Number.isSafeInteger(state.bonusCount)?state.bonusCount:1,state.bonusCategories.length||1));$('bonus-count').value=state.bonusCount; }
  for(const category of store.bonusCategories){const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.checked=state.bonusCategories.includes(category.id);text.textContent=category.label;check.addEventListener('change',()=>{state.bonusCategories=check.checked?[...state.bonusCategories,category.id]:state.bonusCategories.filter(id=>id!==category.id);renderBonus();persist();refreshNext();});label.append(check,text);$('bonus-categories').append(label);}
  $('double-coins-minigames').checked=state.doubleCoinsMinigames;$('double-coins-minigames').addEventListener('change',()=>{state.doubleCoinsMinigames=$('double-coins-minigames').checked;persist();});
  let hiddenBlockAnimation;
  function renderHiddenBlocks(animated=false){const box=$('hidden-block-settings'),opening=state.hiddenBlocks,height=box.hidden?0:box.getBoundingClientRect().height;hiddenBlockAnimation?.cancel();$('hidden-blocks').checked=opening;if(!animated){box.hidden=!opening;box.inert=!opening;return;}box.hidden=false;box.inert=!opening;const animation=box.animate([{height:height+'px',opacity:opening?0:1},{height:(opening?box.scrollHeight:0)+'px',opacity:opening?1:0}],{duration:350,easing:'ease-in-out',fill:'both'});hiddenBlockAnimation=animation;box.style.overflow='hidden';animation.finished.then(()=>{if(hiddenBlockAnimation!==animation)return;box.hidden=!opening;animation.cancel();box.style.overflow='';}).catch(()=>{});}
  $('hidden-blocks').addEventListener('change',()=>{state.hiddenBlocks=$('hidden-blocks').checked;renderHiddenBlocks(true);persist();refreshNext();});renderHiddenBlocks();
  $('shop-selling').checked=state.shopSelling;$('shop-selling').addEventListener('change',()=>{state.shopSelling=$('shop-selling').checked;persist();});
  for(const [id,field] of [['hidden-block-count','hiddenBlockCount'],['shop-multiplier','shopMultiplier'],['movement-die-max','movementDieMax'],['inventory-slots','inventorySlots'],['starting-ac','startingAC'],['starting-stars','startingStars'],['star-price','starPrice'],['bonus-count','bonusCount']]){$(id).value=state[field];$(id).addEventListener('input',()=>{state[field]=$(id).value.trim()===''?NaN:Number($(id).value);if(validMisc())persist();refreshNext();});}
  function settingIcon(name){const icon=document.createElement('img');icon.className='setting-icon';icon.alt='';icon.src='../assets/setup/'+name+'.svg';return icon;}
  const optionIcons={'double-coins-minigames':'coin','bonus-stars':'bonus','shop-selling':'trade','bonus-count':'star','movement-die-max':'dice','shop-multiplier':'shop','inventory-slots':'bag','starting-ac':'coin','starting-stars':'star','star-price':'price'};
  for(const [id,name] of Object.entries(optionIcons))$(id).closest('label').querySelector('span').prepend(settingIcon(name));
  const categoryIcons=['trophy','coin','bag','forward','back','boubakar','event'];[...$('bonus-categories').children].forEach((label,index)=>{const icon=settingIcon(categoryIcons[index]);if(categoryIcons[index]==='event')icon.src='../assets/plateaux/evenement.png';if(categoryIcons[index]==='boubakar')icon.src='../assets/plateaux/boubakar.png';label.querySelector('span').prepend(icon);});
  renderBonus();
  $('bonus-stars').addEventListener('change',()=>{state.bonusStars=$('bonus-stars').checked;renderBonus(true);persist();refreshNext();});
  function resetMiscChoice(){miscCustom=false;$('misc-default-choice').hidden=false;$('misc-custom').hidden=true;$('misc-save-status').textContent='';renderDefaultSummary();}
  function renderDefaultSummary(){
    const d=mapDefaults(),root=$('misc-default-summary');root.replaceChildren();
    const entries=[['coin',d.startingAC+' AC au départ'],['star',d.startingStars+' étoile'+(d.startingStars>1?'s':'')+' au départ'],['price','Étoile : '+d.starPrice+' AC'],['dice','Dé 1–'+d.movementDieMax],['bag',d.inventorySlots+' places'],['shop','Shop ×'+d.shopMultiplier],['trade','Vente '+(d.shopSelling?'autorisée':'désactivée')],['bonus',d.bonusStars?d.bonusCount+' étoiles bonus':'Sans étoile bonus']];
    for(const [icon,text] of entries){const chip=document.createElement('span');chip.append(settingIcon(icon),document.createTextNode(text));root.append(chip);}
  }
  $('misc-save-defaults').addEventListener('click',()=>{
    if(transitioning||launching||!validMisc()||!state.mapId)return;
    try{
      const values=Object.fromEntries(miscFields.map(field=>[field,Array.isArray(state[field])?[...state[field]]:state[field]]));
      const saved={...readSavedDefaults(),[state.mapId]:values};
      localStorage.setItem(miscDefaultsKey,JSON.stringify(saved));
      const config=window.PourtyMiscDefaults,exported={fallback:config.fallback,maps:{...config.maps,...saved}};
      const blob=new Blob(['// Paramètres de base par map.\nwindow.PourtyMiscDefaults = '+JSON.stringify(exported,null,2)+';\n'],{type:'text/javascript;charset=utf-8'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='board-defaults.js';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      renderDefaultSummary();$('misc-save-status').textContent='Sauvegardé ici. Remplace board-defaults.js dans le dossier board avec le fichier téléchargé.';
      $('misc-save-status').animate?.([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'ease-out'});
    }catch(e){error('Sauvegarde impossible : '+e.message);}
  });
  function applyMapDefaults(){
    const fields=miscFields,defaults=mapDefaults();
    for(const field of fields)state[field]=Array.isArray(defaults[field])?[...defaults[field]]:defaults[field];
    $('double-coins-minigames').checked=state.doubleCoinsMinigames;$('bonus-stars').checked=state.bonusStars;$('shop-selling').checked=state.shopSelling;
    for(const [id,field] of [['hidden-block-count','hiddenBlockCount'],['shop-multiplier','shopMultiplier'],['movement-die-max','movementDieMax'],['inventory-slots','inventorySlots'],['starting-ac','startingAC'],['starting-stars','startingStars'],['star-price','starPrice'],['bonus-count','bonusCount']])$(id).value=state[field];
    [...$('bonus-categories').querySelectorAll('input')].forEach((check,index)=>{check.checked=state.bonusCategories.includes(store.bonusCategories[index].id);});
    renderBonus();renderHiddenBlocks();
  }
  $('misc-default-yes').addEventListener('click',()=>{
    if(transitioning||launching)return;
    applyMapDefaults();if(persist())show(5);
  });
  $('misc-default-no').addEventListener('click',async()=>{
    if(transitioning||launching||miscCustom)return;
    transitioning=true;refreshNext();$('previous').disabled=true;steps.forEach(b=>b.disabled=true);
    try{
      const choice=$('misc-default-choice'),custom=$('misc-custom');
      if(animateSetup()){const a=choice.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-8px)'}],{duration:180,easing:'ease-in',fill:'both'});await a.finished;a.cancel();}
      choice.hidden=true;custom.hidden=false;miscCustom=true;
      if(animateSetup()){const a=custom.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:330,easing:'ease-out'});await a.finished;}
    }finally{transitioning=false;$('previous').disabled=false;steps.forEach((b,index)=>b.disabled=index>step);refreshNext();}
  });
  function recap() {
    const map=maps.find(item=>item.id===state.mapId),root=$('recap');root.replaceChildren();
    const hero=document.createElement('div');hero.className='recap-map';const title=document.createElement('h3');title.textContent=map.name;const image=mapArtwork(map);image.classList.add('recap-image');hero.append(image,title);
    const summary=document.createElement('div');summary.className='recap-summary';const chips=document.createElement('div');chips.className='recap-chips';
    for(const value of [state.gameMode==='teams'?'Équipes':state.gameMode==='inverted'?'Inversé':'Normal',state.turns+' tours',state.minigameIds.length+' mini-jeux']){const chip=document.createElement('span');chip.textContent=value;chips.append(chip);}
    const players=document.createElement('div');players.className='recap-players';for(const player of store.getPlayers()){const badge=document.createElement('span');badge.textContent=player.name;badge.style.setProperty('--player-color',player.color);players.append(badge);}if(state.gameMode==='teams'){players.replaceChildren();for(const team of state.teams){const badge=document.createElement('span');badge.textContent=team.name+' · '+team.members.map(id=>store.getPlayers()[id]?.name).join(', ');badge.style.setProperty('--player-color',team.color);players.append(badge);}}
    const list=document.createElement('dl');list.className='recap-details';for(const [label,value] of [['Blocks cachés',state.hiddenBlocks?state.hiddenBlockCount:'Désactivés'],['Pièces ×2',state.doubleCoinsMinigames?'Activé':'Désactivé'],['Déplacement','Dé 1–'+state.movementDieMax],['Départ',state.startingAC+' AC · '+state.startingStars+' ★'],['Inventaire',state.inventorySlots+' places'],['Shop','×'+state.shopMultiplier+' · Vente '+(state.shopSelling?'oui':'non')],['Étoile',state.starPrice+' AC'],['Bonus',state.bonusStars?state.bonusCount+' ★ · '+state.bonusCategories.length+' catégories':'Désactivés']]){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);list.append(row);}
    summary.append(chips,players,list);root.append(hero,summary);
  }
  function showDistribution(open){teamDistribution=open;$('team-setup').hidden=!open;panels[1].querySelector('.game-mode-grid').hidden=open;$('mode-heading').textContent=open?'Répartition des équipes':'Mode de jeu';if(open)teamSetup.render();$('next').textContent=open?'Continuer →':state.gameMode==='teams'?'Répartition →':'Continuer →';const target=open?$('team-setup'):panels[1].querySelector('.game-mode-grid');target.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:330,easing:'ease-out'});refreshNext();}
  async function show(nextStep, focus = true) {
    if(transitioning)return;
    const direction=nextStep>step?1:-1,oldPanel=panels[step],useMotion=focus&&nextStep!==step&&animateSetup(),oldHeight=oldPanel.getBoundingClientRect().height;
    transitioning=true;refreshNext();$('previous').disabled=true;steps.forEach(b=>b.disabled=true);
    if(useMotion){const out=oldPanel.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX('+(-direction*14)+'px)'}],{duration:180,easing:'ease-in',fill:'forwards'});await out.finished;oldPanel.hidden=true;out.cancel();}

    step = nextStep;if(step===4){resetMiscChoice();if(miscMapId!==state.mapId){applyMapDefaults();miscMapId=state.mapId;}} document.body.classList.toggle('recap-open',step===5);error('');
    panels.forEach((panel, index) => { panel.hidden = index !== step; });
    steps.forEach((button, index) => { button.disabled = index > step; if (index === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
    $('previous').hidden = step === 0; $('step-count').textContent = `${step + 1} / 6`;
    $('next').textContent = step === 5 ? 'Lancer la partie' : step === 0 ? 'Confirmer la map →' : 'Continuer →';
    if(step===1){teamDistribution=false;$('team-setup').hidden=true;panels[1].querySelector('.game-mode-grid').hidden=false;$('mode-heading').textContent='Mode de jeu';if(state.gameMode==='teams')$('next').textContent='Répartition →';}
    if (step === 5) recap();
    if(useMotion){const current=panels[step],height=current.getBoundingClientRect().height;current.classList.add('step-transition');const enter=current.animate([{opacity:0,transform:'translateX('+(direction*18)+'px)',height:oldHeight+'px'},{opacity:1,transform:'translateX(0)',height:height+'px'}],{duration:340,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});await enter.finished;enter.cancel();current.classList.remove('step-transition');}
    transitioning=false;$('previous').disabled=false;steps.forEach((b,index)=>b.disabled=index>step);refreshNext();
    if (focus) panels[step].querySelector('h2').focus({preventScroll:true});
  }
  function canLeave() {
    if (step === 0 && !state.mapId) { error('Choisis une map.'); return false; }
    if (step === 2 && !validTurns()) { error('Choisis un nombre entier entre 5 et 30.'); return false; }
    if (step === 3 && !state.minigameIds.length) { error('Sélectionne au moins un mini-jeu.'); return false; }
    if(step===4&&!validMisc()){error('Vérifie les montants, les catégories et le nombre d’étoiles bonus.');return false;}
    return persist();
  }
  steps.forEach((button, index) => button.addEventListener('click', () => { if (index < step) show(index); }));
  $('previous').addEventListener('click', () => { if(step===1&&teamDistribution){showDistribution(false);return;}if (step > 0) show(step - 1); });
  $('next').addEventListener('click', () => {
    if (launching || transitioning || !canLeave()) return;
    if(step===1&&state.gameMode==='teams'){if(!teamDistribution){showDistribution(true);return;}try{teamSetup.validate();}catch(e){error(e.message);return;}}
    if (step < 5) { show(step + 1); return; }
    try { const session = store.launch(state); launching = true; refreshNext(); location.href = session.map.file; }
    catch (e) { error(e.message); }
  });
  window.addEventListener('pageshow', () => { launching = false; refreshNext(); if (step === 5) recap(); });
  window.addEventListener('storage', event => { if (event.key === store.keys.players || event.key === null) { if (step === 5) recap(); } });
  if (state.mapId) pickMap(state.mapId, false);
  updateGames(false); show(0, false);
})();

// Refresh the catalog when returning from the editor or updating another tab.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
window.addEventListener('storage', event => { if (event.key === window.PourtyBoardLibrary.keys.library || event.key === null) location.reload(); });
