(() => {
  'use strict';
  const $ = id => document.getElementById(id), model = window.PourtyBoardModel, engine = window.PourtyBoardEngine;
  const testMode=new URLSearchParams(location.search).get('test')==='1',test=window.PourtyBoardTest;
  const session = testMode?test.read():window.PourtySession.getSession(), mapId = new URLSearchParams(location.search).get('map');
  if (!session?.board || session.map.id !== mapId) {
    $('intro-title').textContent = 'Configure une partie'; $('intro-name').textContent = ''; $('intro-hint').textContent = 'Choisis un plateau et ses joueurs avant de commencer.'; $('intro-die').hidden = true; $('intro-back').hidden = false; return;
  }
  const board = model.normalize(session.board), players = session.players, nodes = new Map(board.nodes.map(node => [node.id, node]));
  const key = testMode?test.keys.progress:'mario-pourty-progress-' + session.id;
  let stored; try { stored = JSON.parse(localStorage.getItem(key)); } catch {}
  let state = engine.restore(stored, session) || (testMode?test.initial(engine,session):engine.create(session));
  if(state.simulatedTurns)session.turns=state.simulatedTurns;
  let busy = false, driving = false, mapMode = false, itemsOpen = false, sceneDrawn = false, lastFocus = null, timer = null, alive = true;
  let dismissStandings=null;
  let mapShopBubble=null,mapShopNode=null;
  let autoPhase = null, miniSelecting = false, choiceData = [];
  let itemsTimer = null, itemsClosing = false;
  let devEnabled=testMode,openTestTools=null,testRestarting=false;
  let dieAnimation=null, miniAnimation=null, starAnswerBusy=false, rankingWallets=null, effectWallets=null, eventUI=null,shopUI=null,itemsUI=null,finaleUI=null,fateUI=null,casinoUI=null,slotsUI=null,bankUI=null,tropicalUI=null,fairUI=null,streetUI=null;let previewPositions=null;const hiddenPawns=new Set();let chosenDieValue=5;
  let boatSpeed = 1;
  let speed = 1, speedTurn = null, playerZoom = null, previewId = null, movingPoint = null;
  let cameraFrame = null, miniFrame = null, miniToken = null, drag = null, hovered = null;
  const svg = $('board-canvas'), canvas = new window.PourtyBoardCanvas(svg, () => {layoutChoices();positionMapShop();}), hudCards = new Map();
  canvas.zoomEnabled = false; canvas.showNodeNumbers = false; canvas.showNodeText = false;
  const status = text => { $('game-status').textContent = text; };
  function persist() { if(testRestarting)return; try { localStorage.setItem(key, JSON.stringify(state)); } catch { status('La progression ne peut pas être sauvegardée dans ce navigateur.'); } }
  const motion = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function ink(color) { const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16), luminance = .2126*r + .7152*g + .0722*b; return luminance > 145 ? '#11213a' : '#ffffff'; }
  function playerIndex() { return engine.active(state); }
  function playerNode() { return nodes.get(state.positions[playerIndex()]); }
  function pawnList(moving, positions = previewPositions||state.positions) {
    const groups = new Map(); positions.forEach((id, i) => { if (!groups.has(id)) groups.set(id, []); groups.get(id).push(i); });
    const result = players.map((player, i) => {
      const node = nodes.get(positions[i]), shared = groups.get(node.id), active = i === playerIndex(), slot = shared.indexOf(i), angle = slot * Math.PI * 2 / shared.length - (shared.length === 2 ? Math.PI : Math.PI / 2);
      const offset = shared.length > 1 ? 19 / Math.sin(Math.PI / shared.length) : 0;
      return { playerId:i, x: moving && active ? moving.x : node.x + Math.cos(angle) * offset, y: moving && active ? moving.y : node.y + Math.sin(angle) * offset, color: player.color, border: '#'+player.color.slice(1).match(/../g).map(channel=>Math.round(parseInt(channel,16)*.65).toString(16).padStart(2,'0')).join(''), ink: ink(player.color), initial: player.name.slice(0,1).toUpperCase(), active };
    });
    return result.sort((a,b) => Number(a.active) - Number(b.active));
  }
  function paintPawns(moving) {
    canvas.setPawns(pawnList(moving).filter(p=>!hiddenPawns.has(p.playerId)));
    const visible = !mapMode && ['moving','choice','pass','land'].includes(state.phase);
    $('movement-counter').hidden = !visible;
    if (visible) {
      const node = playerNode(), point = moving || pawnList().find(pawn=>pawn.active) || node;
      $('movement-counter').style.left = (point.x*canvas.view.scale+canvas.view.x)+'px';
      $('movement-counter').style.top = (point.y*canvas.view.scale+canvas.view.y-72)+'px';
      if ($('movement-number').textContent !== String(state.remaining)) {
        $('movement-number').textContent = String(state.remaining);
        $('movement-number').classList.remove('tick');void $('movement-number').offsetWidth;$('movement-number').classList.add('tick');
      }
      $('steps-label').textContent = state.remaining+' case'+(state.remaining>1?'s':'')+' restante'+(state.remaining>1?'s':'');
    }
  }
  function focusedView(node) { const rect=svg.getBoundingClientRect(),small=rect.width<620,scale=playerZoom ?? (small?1.7:2.15),centered=state.phase!=='turn';return {scale,x:rect.width*(centered?.5:(small?.48:.47))-node.x*scale,y:rect.height*(centered?.48:.48)-node.y*scale}; }
  function slideView(to,duration=650,allowMap=false){
    cancelAnimationFrame(cameraFrame);const from={...canvas.view},start=performance.now();
    const frame=now=>{if(!alive||mapMode!==allowMap)return;const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);for(const k of ['x','y','scale'])canvas.view[k]=from[k]+(to[k]-from[k])*e;canvas.apply();paintPawns(movingPoint);if(t<1)cameraFrame=requestAnimationFrame(frame);};cameraFrame=requestAnimationFrame(frame);
  }
  function previewChoice(id,boat=false){
    if(!['choice','tropical-port'].includes(state.phase)||mapMode||previewId===id+':'+boat)return;
    previewId=id+':'+boat;const route=engine.previewTravel(state,board,playerNode().id,id,state.remaining,boat),points=route.nodes.map(id=>nodes.get(id)),rect=svg.getBoundingClientRect();
    markDestinations(route.landings);
    canvas.world.querySelectorAll('[data-edge]').forEach(group=>{const edge=board.edges[Number(group.dataset.edge)];group.classList.toggle('preview-route',route.edges.includes(edge.from+'>'+edge.to));});
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs)-70,maxX=Math.max(...xs)+70,minY=Math.min(...ys)-90,maxY=Math.max(...ys)+90;
    const availableHeight=Math.max(100,rect.height-420),scale=Math.max(.02,Math.min(canvas.view.scale,(rect.width-100)/(maxX-minX),availableHeight/(maxY-minY)));
    slideView({scale,x:rect.width/2-(minX+maxX)/2*scale,y:110+availableHeight/2-(minY+maxY)/2*scale});
  }
  function focusPlayer(animate = true) {
    const node = playerNode(); if (!node) return; cancelAnimationFrame(cameraFrame);
    const from = { ...canvas.view }, to = focusedView(node), start = performance.now(), duration = animate ? 1050 : 0;
    const step = now => { if (!alive || mapMode) return; const t = duration ? Math.min(1,(now-start)/duration) : 1, eased = 1 - Math.pow(1-t,3); for (const k of ['x','y','scale']) canvas.view[k] = from[k] + (to[k]-from[k])*eased; canvas.apply();paintPawns(); if (t < 1) cameraFrame = requestAnimationFrame(step); };
    cameraFrame = requestAnimationFrame(step);
  }
  function playerRanks(wallets) {
    return window.PourtyTeams.ranks(state,wallets,session.gameMode);
  }
  function renderHud() {
    if (!state.order.length) return;
    const wallets=effectWallets||(state.phase==='ranking'?(rankingWallets||state.rankingBefore||state.wallets):state.wallets);
    const ranks = playerRanks(wallets);
    const cycle = testMode?[...state.order]:[...state.order, 'mini', ...(state.round===session.turns?['end']:[])], ordered = [...cycle.slice(state.turn), ...cycle.slice(0,state.turn)];
    const old = new Map([...hudCards].map(([id,card]) => [id,card.getBoundingClientRect().left]));
    const previousFirst = $('hud').firstElementChild;
    ordered.forEach((id,index) => {
      let card = hudCards.get(id);
      if (!card) {
        card = document.createElement(id === 'mini' ? 'button' : 'div'); card.className = 'hud-card' + (id === 'mini' ? ' hud-mini' : ''); card.setAttribute('role','listitem');
        if (id === 'mini') { card.type = 'button'; card.addEventListener('click', () => { if (state.phase === 'minigame' || state.phase === 'minigame-playing') openMini(); }); }
        const color = id === 'mini' ? '#e5c46a' : id==='end'?'#ca6472':players[id].color;if(id==='end')card.classList.add('hud-end'); card.style.setProperty('--player-color',color); card.style.setProperty('--player-ink',ink(color));
        const avatar = document.createElement('span'); avatar.className = 'hud-avatar'; avatar.textContent = id === 'mini' ? '★' : id==='end'?'⚑':players[id].name.slice(0,1).toUpperCase(); avatar.setAttribute('aria-hidden','true');
        const text = document.createElement('div'); text.className = 'hud-text'; const name = document.createElement('strong'); name.textContent = id === 'mini' ? 'Mini-jeu' : id==='end'?'FIN':players[id].name; const sub = document.createElement('small'); text.append(name,sub);if(typeof id==='number'){const details=document.createElement('div');details.className='hud-details';const wallet=document.createElement('span');wallet.className='hud-wallet';const bag=document.createElement('div');bag.className='hud-items';details.append(wallet,bag);text.append(details);} card.append(avatar,text);if(typeof id==='number'){const rank=document.createElement('span');rank.className='hud-rank';card.append(rank);} hudCards.set(id,card);
      }
      card.classList.toggle('cursed',typeof id==='number'&&state.diceMods?.[id]==='curse-dice');card.classList.toggle('current',index === 0); card.setAttribute('aria-current', index === 0 ? 'step' : 'false');
      card.querySelector('small').textContent = index === 0 ? (id === 'mini' ? 'Fin de manche' : 'À toi de jouer') : (id === 'mini' ? 'Après les joueurs' : 'À suivre');
      if(typeof id==='number'){const team=window.PourtyTeams.team(state,id);card.classList.toggle('team-member',!!team);if(team){card.style.setProperty('--team-color',team.color);card.title=team.name;}const wallet=card.querySelector('.hud-wallet');wallet.replaceChildren();const stars=document.createElement('span'),coins=document.createElement('span');stars.className='hud-stars';coins.className='hud-ac';stars.textContent='★ '+wallets[id].stars;coins.textContent=wallets[id].ac+' AC';wallet.append(stars,coins);const bag=card.querySelector('.hud-items');bag.replaceChildren();bag.classList.toggle('four-items',engine.inventory(state,id).length===4);engine.inventory(state,id).forEach(itemId=>{const item=model.items[itemId],icon=document.createElement('img');model.itemImage(icon,itemId);icon.alt=item.name;icon.title=item.name+' — '+item.description;bag.append(icon);});const rank=card.querySelector('.hud-rank');rank.textContent='#'+ranks[id];rank.setAttribute('aria-label','Classement : '+ranks[id]);}
      if(id==='end')card.querySelector('small').textContent='';
      if (id === 'mini') card.disabled = !['minigame','minigame-playing'].includes(state.phase);
      $('hud').append(card);
    });
    for(let id=0;id<players.length;id++){let cloud=$('curse-cloud-'+id);if(state.diceMods?.[id]!=='curse-dice'||state.phase==='finished'){cloud?.remove();continue;}if(!cloud){cloud=document.createElement('div');cloud.id='curse-cloud-'+id;cloud.className='curse-cloud';document.body.append(cloud);}const rect=hudCards.get(id).getBoundingClientRect();Object.assign(cloud.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});}
    if (motion() && previousFirst && previousFirst !== $('hud').firstElementChild) {
      $('hud').scrollLeft = 0;
      for (const [id,card] of hudCards) { const before = old.get(id); if (before === undefined || !card.animate) continue; const delta = before-card.getBoundingClientRect().left; card.animate(card === previousFirst ? [{opacity:0,transform:'translateX(25px)'},{opacity:1,transform:'translateX(0)'}] : [{transform:`translateX(${delta}px)`},{transform:'translateX(0)'}],{duration:450,easing:'cubic-bezier(.2,.8,.2,1)'}); }
    }
  }
  function intro() {
    const ready = state.phase === 'order-ready', current = state.introQueue[state.introCursor];
    $('intro').hidden = false; $('intro-die').hidden = ready; $('intro-start').hidden = !ready;
    $('intro-title').textContent = ready ? 'L’ordre est fixé' : state.introRound > 1 ? 'On départage !' : 'Qui commence ?';
    $('intro-kicker').textContent = ready ? 'ORDRE DE PASSAGE' : 'DÉ DE 1 À 10';
    $('intro-name').textContent = ready ? '' : players[current].name;
    if (!ready) $('intro-name').style.setProperty('--rolling-color',players[current].color);
    $('intro').style.setProperty('--intro-color',ready ? '#283a5f' : players[current].color);
    $('intro-hint').textContent = ready ? 'Du plus grand lancer au plus petit.' : state.introRound > 1 ? 'Les joueurs à égalité relancent.' : 'Clique sur le dé';
    $('intro-die').disabled = false; $('intro-die').querySelector('[data-die-value]').textContent = '?';
    $('intro-results').replaceChildren();
    const sequence = ready ? state.order : state.introQueue;
    sequence.forEach((id,index) => { const li = document.createElement('li'); li.className = 'intro-result' + (!ready && id === current ? ' active' : ''); li.style.setProperty('--result-color',players[id].color); const name = document.createElement('span'); name.textContent = (ready ? `${index+1}. ` : '') + players[id].name; const score = document.createElement('span'); score.className = 'rolls'; score.textContent = state.rolls[id].length ? state.rolls[id].join(' · ') : '—'; li.append(name,score); $('intro-results').append(li); });
  }
  async function animateDie(button,value,allowed=Array.from({length:10},(_,i)=>i+1),secondValue=null,extraButtons=[],presentation=null,rollSpeed=1,allowedPerDie=null){
    rollSpeed=Math.max(1,Math.min(8,Number(rollSpeed)||1));
    const drawFace=presentation?.face||((face,value)=>{face.textContent=value;});
    const signal={skip:false};dieAnimation=signal;let pairResult=null;
    const values=[value,...(Array.isArray(secondValue)?secondValue:secondValue===null?[]:[secondValue])];const dice=values.map((v,i)=>({button:i===0?button:extraButtons[i-1]||$('event-die-second'),value:v,duration:2400+i*640}));
    if(dice.length>1){pairResult=document.createElement('div');pairResult.className='dual-result';dice.forEach((die,i)=>{const number=document.createElement('span');number.className='dual-number '+(i?'second':'first');number.textContent=die.value;number.style.setProperty('--offset',(i-(dice.length-1)/2)*160+'px');number.hidden=true;pairResult.append(number);die.number=number;});document.body.append(pairResult);}
    dice.forEach((die,dieIndex)=>{die.cube=die.button.querySelector('.die-cube');die.faces=[...die.button.querySelectorAll('.die-face')];die.button.disabled=true;die.button.classList.add('script-roll');die.button.classList.add('rolling');
      // Assign the six visible faces once. The outcome is already sampled by
      // the game rules; rotation brings its face forward without repainting it.
      const alternatives=[...new Set(allowedPerDie?.[dieIndex]||allowed)].filter(face=>face!==die.value);
      for(let i=alternatives.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[alternatives[i],alternatives[j]]=[alternatives[j],alternatives[i]];}
      const front=die.button.querySelector('[data-die-value]');let index=0;
      die.faces.forEach(face=>drawFace(face,face===front?die.value:alternatives.length?alternatives[index++%alternatives.length]:die.value));});
    try{
      await new Promise(resolve=>{const start=performance.now();let shortened=false;
        function tick(now){
          if(!alive){resolve();return;}const elapsed=(now-start)*rollSpeed;
          dice.forEach(die=>{
            if(die.done)return;
            const t=Math.min(1,elapsed/die.duration),ease=1-Math.pow(1-t,3),turns=[1800,2520];
            let angles=turns.map(total=>total*ease);
            if(signal.skip&&!shortened&&t<1&&die.duration-elapsed>(die===dice[0]?600:950)){
              const duration=die===dice[0]?600:950;
              die.tail={start:elapsed,duration,angles,velocities:turns.map(total=>3*total*Math.pow(1-t,2)/die.duration)};
              die.tail.targets=angles.map((angle,i)=>Math.min(turns[i],Math.ceil((angle+die.tail.velocities[i]*duration/3)/360)*360));
              die.tail.durations=angles.map((angle,i)=>3*(die.tail.targets[i]-angle)/die.tail.velocities[i]);
            }
            let complete=t===1;
            if(die.tail){const tail=die.tail;angles=tail.angles.map((angle,i)=>{const u=Math.min(1,(elapsed-tail.start)/tail.durations[i]);return angle+(tail.targets[i]-angle)*(1-Math.pow(1-u,3));});complete=tail.durations.every(duration=>elapsed-tail.start>=duration);}
            die.cube.style.transform='rotateX('+angles[0]+'deg) rotateY('+angles[1]+'deg)';
            if(complete){die.done=true;die.button.classList.remove('rolling');if(die.number)die.number.hidden=false;}
          });
          if(signal.skip)shortened=true;
          if(dice.every(die=>die.done))resolve();else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
      if(!alive)return;
      if(pairResult){await pause(500/rollSpeed);if(!alive)return;pairResult.classList.add('merge');await pause(450/rollSpeed);if(!alive)return;pairResult.remove();pairResult=null;}
      else await pause((signal.skip?120:250)/rollSpeed);
      $('roll-pop').classList.remove('sum');$('roll-pop').classList.toggle('item-result',!!presentation);$('roll-pop').textContent=presentation?.label??values.reduce((a,b)=>a+b,0);presentation?.result?.($('roll-pop'));$('roll-pop').style.setProperty('animation-duration',(1250/rollSpeed)+'ms','important');$('roll-pop').hidden=false;$('roll-pop').classList.remove('play');void $('roll-pop').offsetWidth;$('roll-pop').classList.add('play');await pause(1250/rollSpeed);
    }finally{pairResult?.remove();dice.forEach(die=>{die.button.classList.remove('rolling');die.button.classList.remove('script-roll');die.cube.style.transform='';});$('roll-pop').hidden=true;$('roll-pop').style.removeProperty('animation-duration');$('roll-pop').classList.remove('item-result');dieAnimation=null;}
  }
  $('intro-die').addEventListener('click', async () => {
    if (busy || state.phase !== 'intro') return; busy = true; const value = engine.die();
    state = engine.rollOrder(state,value); persist();
    await animateDie($('intro-die'),value); busy = false; if (alive) render();
  });
  $('intro-start').addEventListener('click', () => { if (busy || state.phase !== 'order-ready') return; state = engine.start(state,board); persist(); render(); });
  function markDestinations(ids=[]){canvas.world.querySelectorAll('[data-node]').forEach(group=>group.classList.toggle('preview-target',ids.includes(group.dataset.node)));}
  function clearChoices(){previewId=null;markDestinations();canvas.world.querySelectorAll('[data-edge]').forEach(group=>group.classList.remove('preview-route'));choiceData=[];$('choice-layer').replaceChildren();$('choice-layer').hidden=true;canvas.world.querySelectorAll('[data-edge]').forEach(group=>group.classList.remove('route-choice'));}
  function chooseDirection(id,boat=false){if(!['choice','tropical-port'].includes(state.phase)||mapMode)return;cancelAnimationFrame(cameraFrame);const port=state.phase==='tropical-port';clearChoices();if(port){state=engine.answerPort(state,boat);if(!boat)state=engine.choose({...state,phase:'choice'},board,id);}else state=engine.choose(state,board,id);persist();render();}
  function layoutChoices(){
    if(!choiceData.length)return;
    choiceData.forEach(({element,from,to})=>element.style.setProperty('--direction',Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI+'deg'));
  }
  function showChoices(){
    clearChoices();const from=playerNode(),port=state.phase==='tropical-port',starRoutes=engine.starRoutes(state,board),routes=engine.exits(board,from.id).map(id=>({id,boat:false}));if(port)routes.push({id:state.tropical.to,boat:true});$('choice-layer').classList.toggle('port-choices',port);$('choice-layer').hidden=false;
    routes.forEach(({id,boat},index)=>{
      const group=document.createElement('div');group.className='direction-choice';
      const button=document.createElement('button');button.type='button';button.className='direction-arrow';button.textContent='➜';button.setAttribute('aria-label','Aller vers '+(nodes.get(id).label||model.types[nodes.get(id).type].name));button.addEventListener('click',()=>chooseDirection(id,boat));button.addEventListener('pointerenter',()=>previewChoice(id,boat));button.addEventListener('focus',()=>previewChoice(id,boat));group.append(button);
      const preview=document.createElement('button');preview.type='button';preview.className='landing-preview';preview.addEventListener('click',()=>chooseDirection(id,boat));const destinations=engine.previewTravel(state,board,from.id,id,state.remaining,boat).landings;
      preview.addEventListener('pointerenter',()=>previewChoice(id,boat));preview.addEventListener('focus',()=>previewChoice(id,boat));
      const heading=document.createElement('strong');heading.className='landing-heading';heading.textContent=port&&boat?'Bateau':'Chemin '+(index+1);preview.append(heading);
      const caption=document.createElement('span');caption.className='landing-caption';caption.textContent=destinations.some(id=>nodes.get(id).type==='port')?'Sur ce chemin':destinations.length>1?'Arrivées possibles':'Tu arrives ici';preview.append(caption);
      destinations.filter((id,index,all)=>nodes.get(id).type!=='port'||all.findIndex(other=>nodes.get(other).type==='port')===index).forEach(destination=>{const node=nodes.get(destination),type=model.types[node.type],chip=document.createElement('span');chip.className='landing-chip';chip.style.setProperty('--case-color',type.color);const symbol=document.createElement('b');symbol.append(model.spaceIcon(node.type));const label=document.createElement('span');label.textContent=node.type==='port'?'Port':node.label||type.name;chip.append(symbol,label);preview.append(chip);});
      const starRoute=starRoutes.find(route=>route.id===id&&!!route.boat===boat);
      if(starRoute){preview.classList.add('star-route');const hint=document.createElement('span');hint.className='landing-star-distance';hint.textContent='Ce chemin est à '+starRoute.distance+' case'+(starRoute.distance>1?'s':'')+' de l’étoile';preview.append(hint);}
      if(port&&boat){group.classList.add('boat-choice');group.addEventListener('pointerenter',()=>canvas.world.querySelector('.port-preview')?.classList.add('hovered'));group.addEventListener('pointerleave',()=>canvas.world.querySelector('.port-preview')?.classList.remove('hovered'));}group.append(preview);if(port&&boat){const fare=document.createElement('span');fare.className='port-fare';fare.textContent=(state.tropical.cost??3)+' AC';preview.append(fare);}group.animate?.([{opacity:0,transform:'translateY(12px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:300,easing:'ease-out'});$('choice-layer').append(group);choiceData.push({element:group,from,to:nodes.get(id),index});
      canvas.world.querySelectorAll('[data-edge]').forEach(edge=>{const route=board.edges[Number(edge.dataset.edge)];if(route.from===from.id&&route.to===id)edge.classList.add('route-choice');});
    });layoutChoices();
  }
  async function autoCase(){
    if(autoPhase)return;const phase=state.phase,id=playerNode().id;autoPhase=phase;
    $('case-toast').hidden=true;
    const node=playerNode(),titleKey=[state.round,state.turn,node.id,state.landingSerial||0].join(':');
    if(phase==='land'&&node.type==='event'&&state.eventTitleShown!==titleKey){state.eventTitleShown=titleKey;persist();const title=document.createElement('div');title.className='fair-announcement';title.textContent=model.events[node.event]?.name||'Événement';document.body.append(title);title.animate?.([{opacity:0,transform:'scale(.65)'},{opacity:1,transform:'scale(1.04)',offset:.25},{opacity:1,transform:'scale(1)',offset:.7},{opacity:0,transform:'scale(.7)'}],{duration:1400,easing:'ease-in-out',fill:'both'});await pause(1400);title.remove();if(!alive){autoPhase=null;return;}}
    autoPhase=null;
    if(state.phase!==phase||playerNode().id!==id)return;
    state=phase==='pass'?(['boo','shop','slots','port','lucky-box','zipline','street-investment','street-bull','street-bear','street-black'].includes(playerNode().type)?engine.startEffect(state,board,session):engine.continuePass(state)):engine.startEffect(state,board,session);persist();render();
  }
  function overview(){const b=model.bounds(board),rect=svg.getBoundingClientRect(),scale=Math.max(.001,Math.min(1.3,(rect.width-100)/b.width,(rect.height-230)/b.height));return {scale,x:rect.width/2-(b.x+b.width/2)*scale,y:(rect.height-70)/2-(b.y+b.height/2)*scale};}
  async function announceStandings(){
    if(autoPhase)return;autoPhase='ranking';let skipped=false;const skipSignal=new Promise(resolve=>{dismissStandings=()=>{skipped=true;resolve();};});const wait=ms=>Promise.race([pause(ms),skipSignal]);cancelAnimationFrame(cameraFrame);Object.assign(canvas.view,overview());canvas.apply();paintPawns();lastFocus='overview';
    const before=state.rankingBefore||state.wallets,after=state.wallets,ranks=playerRanks(before),nextRanks=playerRanks(after),list=$('standings-list'),rows=new Map();list.replaceChildren();
    const initial=window.PourtyTeams.reps(state).sort((a,b)=>ranks[a]-ranks[b]||a-b);
    const color=rank=>rank===1?'#f2cf68':rank===2?'#c4cddd':rank===3?'#c9956c':'#af88e6';
    const scoreText=w=>'★ '+w.stars+'  ·  '+w.ac+' AC';
    initial.forEach((id,index)=>{
      const row=document.createElement('li');row.className='standing-row';row.dataset.player=String(id);row.style.setProperty('--rank-color',color(ranks[id]));row.style.setProperty('--row-delay',index*90+'ms');
      const rank=document.createElement('strong');rank.className='standing-rank';rank.textContent='#'+ranks[id];
      const dot=document.createElement('span');dot.className='standing-dot';dot.style.background=(window.PourtyTeams.team(state,id)||players[id]).color;
      const name=document.createElement('span');name.className='standing-name';name.textContent=(window.PourtyTeams.team(state,id)||players[id]).name;
      const score=document.createElement('span');score.className='standing-score';score.textContent=scoreText(before[id]);row.append(rank,dot,name,score);list.append(row);rows.set(id,row);
    });
    const panel=$('standings-overlay');panel.classList.remove('leaving');panel.classList.remove('settled');panel.hidden=false;
    await wait(1300+players.length*90);if(!alive)return;panel.classList.add('settled');
    await new Promise(resolve=>{const start=performance.now();const tick=now=>{if(!alive){resolve();return;}const t=skipped?1:Math.min(1,(now-start)/950),ease=1-Math.pow(1-t,3);
      rankingWallets=before.map((w,id)=>({stars:Math.round(w.stars+(after[id].stars-w.stars)*ease),ac:Math.round(w.ac+(after[id].ac-w.ac)*ease)}));
      rows.forEach((row,id)=>{row.querySelector('.standing-score').textContent=scoreText(rankingWallets[id]);row.classList.toggle('gaining',t<1&&(before[id].ac!==after[id].ac||before[id].stars!==after[id].stars));});
      if(t<1)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});if(!alive)return;
    rankingWallets=after;renderHud();await wait(250);if(!alive)return;
    const positions=new Map([...rows].map(([id,row])=>[id,row.getBoundingClientRect().top]));
    const ordered=[...initial].sort((a,b)=>nextRanks[a]-nextRanks[b]);
    ordered.forEach(id=>{const row=rows.get(id);list.append(row);row.querySelector('.standing-rank').textContent='#'+nextRanks[id];row.style.setProperty('--rank-color',color(nextRanks[id]));});
    rows.forEach((row,id)=>{const delta=positions.get(id)-row.getBoundingClientRect().top;if(!skipped&&delta&&row.animate)row.animate([{transform:'translateY('+delta+'px)'},{transform:'translateY(0)'}],{duration:900,easing:'cubic-bezier(.22,.75,.2,1)'});});
    await wait(2200);if(!alive)return;dismissStandings=null;if(skipped)panel.getAnimations?.({subtree:true}).forEach(animation=>animation.cancel());panel.classList.add('leaving');await pause(450);if(!alive)return;panel.hidden=true;autoPhase=null;rankingWallets=null;
    state.phase=state.afterRanking;delete state.afterRanking;delete state.rankingBefore;persist();render();
  }
  async function announceStarWon(){
    if(autoPhase)return;autoPhase='star-won';const owner=playerIndex(),before=state.rankingBefore,cost=before?Math.max(0,before[owner].ac-state.wallets[owner].ac):0;if(cost){await eventUI.animateLoss(owner,cost,before);if(!alive)return;}await shopUI.dropItem('star',owner,!cost);if(!alive)return;const title=$('star-announcement');title.textContent='Étoile gagnée !';title.hidden=false;title.classList.remove('play');void title.offsetWidth;title.classList.add('play');
    await pause(1450);if(!alive)return;title.hidden=true;autoPhase=null;state=engine.finishStarWon(state);persist();render();
  }
  async function announceStar(){
    if(autoPhase)return;autoPhase='star';const title=$('star-announcement');title.textContent='Apparition de l’étoile';title.hidden=false;title.classList.remove('play');void title.offsetWidth;title.classList.add('play');
    await pause(1450);if(!alive)return;title.hidden=true;
    const node=nodes.get(state.starNode),rect=svg.getBoundingClientRect(),scale=Math.min(1.8,rect.width/200);
    slideView({scale,x:rect.width/2-node.x*scale,y:rect.height*.46-node.y*scale},1000);await pause(1050);if(!alive)return;
    state=engine.revealStar(state);persist();canvas.setStar(state.starNode,true);await pause(1100);if(!alive)return;
    state=engine.finishStarReveal(state);autoPhase=null;lastFocus='star-reveal';persist();render();
  }
  function showStarOffer(){
    if(session.gameMode==='inverted'&&state.wallets[playerIndex()].ac>=engine.starCost(state)){answerStar(true);return;}
    const panel=$('star-offer');panel.classList.remove('leaving');panel.hidden=false;
    $('star-buy').textContent='Oui — '+(engine.starCost(state))+' AC';$('star-buy').disabled=state.wallets[playerIndex()].ac<engine.starCost(state);starAnswerBusy=false;
  }
  async function answerStar(buy){
    if(starAnswerBusy||state.phase!=='star-offer')return;
    let next;try{next=engine.answerStar(state,board,buy);}catch(error){status(error.message);return;}
    starAnswerBusy=true;$('star-buy').disabled=true;$('star-decline').disabled=true;
    state=next;if(buy)effectWallets=state.rankingBefore;persist();renderHud();$('star-offer').classList.add('leaving');await pause(240);if(!alive)return;
    $('star-offer').hidden=true;$('star-decline').disabled=false;starAnswerBusy=false;render();
  }
  $('star-buy').addEventListener('click',()=>answerStar(true));$('star-decline').addEventListener('click',()=>answerStar(false));
  async function announceRound(){
    if(autoPhase)return;cancelAnimationFrame(cameraFrame);Object.assign(canvas.view,overview());canvas.apply();lastFocus='overview';autoPhase='round';$('round-pop').classList.toggle('late-game',engine.isLateGame(state,session)&&!!state.lateGameAnnounced);$('round-pop').hidden=false;$('round-pop').classList.remove('play');void $('round-pop').offsetWidth;$('round-pop').classList.add('play');$('round-pop-number').textContent=state.round-1;
    await pause(450);$('round-pop-number').textContent=state.round;$('round-pop').classList.toggle('late-game',engine.isLateGame(state,session));$('round-pop-number').classList.remove('bump');void $('round-pop-number').offsetWidth;$('round-pop-number').classList.add('bump');
    await pause(1550);if(!alive)return;$('round-pop').hidden=true;autoPhase=null;state=engine.finishRoundIntro(state,session);persist();render();
  }
  let dismissLateIntro=null;
  async function announceLateGame(){if(autoPhase)return;autoPhase='late-intro';const panel=$('late-game-announcement'),hasGift=session.turns!==5&&!state.lateIntro.skipGift;$('late-game-gift').hidden=!hasGift;$('late-game-recipient').hidden=!hasGift;$('late-game-recipient').textContent=(window.PourtyTeams.team(state,state.lateIntro.owner)||players[state.lateIntro.owner]).name+' reçoit un objet';$('late-game-ally').hidden=session.gameMode!=='teams';$('late-game-duel').textContent=session.gameMode==='teams'?'Atterrir sur la case d’un adversaire déclenche un duel':'Atterrir sur la même case qu’un autre joueur déclenche un duel';$('late-game-gift').textContent=session.gameMode==='teams'?'Don d’un item à la dernière équipe':'Don d’un item au dernier joueur';panel.classList.remove('leaving');panel.classList.remove('playing');panel.hidden=false;void panel.offsetWidth;panel.classList.add('playing');await new Promise(resolve=>{const timer=setTimeout(finish,10000);function finish(){clearTimeout(timer);dismissLateIntro=null;resolve();}dismissLateIntro=finish;});if(!alive)return;panel.classList.add('leaving');await pause(600);if(!alive)return;panel.hidden=true;panel.classList.remove('leaving');autoPhase=null;state=engine.finishLateIntro(state,session);persist();render();}
  function drawHiddenBlocks(){canvas.world.querySelectorAll('.hidden-block-debug').forEach(e=>e.remove());if(!devEnabled)return;for(const id of state.hiddenBlockNodes||[]){const node=nodes.get(id);if(!node)continue;const make=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;},group=make('g',{class:'hidden-block-debug','pointer-events':'none',transform:'translate('+node.x+' '+node.y+')'});group.append(make('circle',{r:37,fill:'#ffe48a22',stroke:'#ffe48a','stroke-width':3,'stroke-dasharray':'5 4'}),make('image',{href:'../assets/plateaux/hidden-block.svg',x:17,y:-48,width:30,height:30}));canvas.world.append(group);}}
  function render() {
    if(!alive)return;
    if(testMode)state=test.skipBuddies(engine,state,session);
    if(testMode&&state.phase==='minigame'){state=test.skipMinigame(engine,state,session);persist();}
    if(state.phase==='turn'){state=engine.enterTurn(state);persist();}
    document.body.classList.toggle('choosing',['choice','tropical-port'].includes(state.phase)&&!mapMode);
    document.body.classList.toggle('selecting-mini',state.phase==='minigame');
    document.body.classList.toggle('choosing-stake',['duel-stake','stolen-choice','boo-menu','boo-target','boo-random','late-intro','gift-replace','inventory-discard','shop-menu','shop-sale-menu','shop-replace','shop-purchase','shop-sale'].includes(state.phase)||state.phase.startsWith('fate-')||state.phase.startsWith('casino-')||state.phase.startsWith('slots-')||state.phase.startsWith('street-')||state.phase.startsWith('bank-')||state.phase.startsWith('tropical-')||!!state.stolenChoice);
    const turnKey=state.round+':'+state.turn;if(speedTurn!==turnKey){speedTurn=turnKey;speed=1;}

    for(const id of ['intro','end-panel','player-actions','turn-info'])$(id).hidden=true;$('open-market').hidden=!state.street||state.phase!=='turn';
    if(!['choice','tropical-port'].includes(state.phase)||mapMode)clearChoices();
    if(state.phase!=='star-offer')$('star-offer').hidden=true;
    if(['intro','order-ready'].includes(state.phase)){$('game-stage').hidden=true;$('hud').hidden=true;intro();return;}
    $('game-stage').hidden=false;$('hud').hidden=state.phase==='finished';
    if(!sceneDrawn){canvas.render(board);sceneDrawn=true;}canvas.setStar(state.starVisible?state.starNode:null);bankUI?.updateDecorations(state.bankAC??0);tropicalUI?.drawTreasure();drawHiddenBlocks();streetUI?.draw();
    paintPawns();renderHud();$('round-label').textContent='Tour '+state.round+' / '+session.turns;$('steps-label').textContent=['moving','choice','pass','land'].includes(state.phase)?state.remaining+' case'+(state.remaining>1?'s':'')+' restante'+(state.remaining>1?'s':''):'';
    $('turn-info').hidden=mapMode||state.phase==='finished';
    if(state.phase==='finished'){finaleUI.render();return;}
    if(state.phase==='tropical-port'){$('player-actions').hidden=mapMode;$('open-dice').hidden=true;$('open-items').hidden=true;}
    if(streetUI?.render())return;
    if(fairUI?.render())return;
    if(tropicalUI?.render())return;
    if(itemsUI?.render())return;
    if(shopUI?.render())return;
    if(eventUI?.render())return;
    if(fateUI?.render())return;
    if(casinoUI?.render())return;
    if(slotsUI?.render())return;
    if(bankUI?.render())return;
    if(state.turn<players.length&&!['ranking','round-intro','late-intro','star-reveal','star-won'].includes(state.phase)){
      const focusKey=state.round+':'+state.turn;if(lastFocus!==focusKey&&!mapMode){focusPlayer(lastFocus!==null);lastFocus=focusKey;}
    }
    if(!['moving','pass'].includes(state.phase))speed=1;
    if(state.phase!=='turn')setItems(false);
    $('open-dice').hidden=state.phase==='choice';$('open-items').hidden=state.phase==='choice';
    if(state.phase==='choice')$('player-actions').hidden=mapMode;
    if(state.phase==='turn'){$('player-actions').hidden=mapMode||!$('dice-panel').hidden;if(mapMode)setItems(false);}
    else if(state.phase==='moving')requestAnimationFrame(()=>runMovement());
    else if(state.phase==='choice'&&!mapMode)showChoices();
    else if(state.phase==='pass'||state.phase==='land')autoCase();
    else if(state.phase==='star-won')announceStarWon();
    else if(state.phase==='star-reveal')announceStar();
    else if(state.phase==='star-offer')showStarOffer();
    else if(state.phase==='ranking')announceStandings();
    else if(state.phase==='round-intro')announceRound();
    else if(state.phase==='late-intro')announceLateGame();
    else if(state.phase==='minigame')selectMini();
    else if(state.phase==='minigame-playing'){$('mini-intro').hidden=false;$('mini-list-window').hidden=true;$('mini-title').textContent=games.find(g=>g.id===state.minigameId).title;$('mini-start').hidden=false;}
  }

  let riggedBeamTimer=null,riggedBeamLayer=null;
  function stopRiggedBeams(){clearTimeout(riggedBeamTimer);riggedBeamTimer=null;riggedBeamLayer?.remove();riggedBeamLayer=null;}
  function startRiggedBeams(die){
    stopRiggedBeams();if(!die.classList.contains('rigged'))return;
    const layer=document.createElement('span');layer.className='rigged-beams';layer.setAttribute('aria-hidden','true');die.append(layer);riggedBeamLayer=layer;
    function emit(){
      if(!alive||$('dice-panel').hidden||!die.classList.contains('rigged')){stopRiggedBeams();return;}
      if(!document.hidden){
        const beam=document.createElement('span'),angle=Math.random()*Math.PI*2,radius=78+Math.random()*24,travel=24+Math.random()*36;
        beam.className='rigged-beam';beam.style.width=(34+Math.random()*42)+'px';beam.style.height=(2+Math.random()*2)+'px';layer.append(beam);
        const pose=(distance,scale)=>'translate(-50%,-50%) translate('+Math.cos(angle)*distance+'px,'+Math.sin(angle)*distance+'px) rotate('+angle+'rad) scaleX('+scale+')';
        const animation=beam.animate([{opacity:0,transform:pose(radius,.15)},{opacity:.85,transform:pose(radius+travel*.3,1),offset:.35},{opacity:0,transform:pose(radius+travel,.25)}],{duration:650+Math.random()*450,easing:'ease-in-out',fill:'both'});
        animation.onfinish=()=>beam.remove();
      }
      riggedBeamTimer=setTimeout(emit,55);
    }
    emit();
  }
  function prepareMovementDice(){const spec=engine.diceSpec(state),first=$('turn-die');document.querySelectorAll('.extra-turn-die').forEach(e=>e.remove());chosenDieValue=5;first.dataset.kind=spec.kind;first.classList.toggle('rigged',spec.rigged);first.querySelectorAll('.die-face').forEach(f=>f.textContent=spec.rigged?chosenDieValue:'?');for(let i=1;i<spec.count;i++){const die=first.cloneNode(true);die.id='turn-die-'+i;die.classList.add('extra-turn-die');die.classList.toggle('mini-turn-die',spec.kind==='mini-double-dice');die.addEventListener('click',rollMovementDice);first.parentNode.insertBefore(die,$('dice-hint'));}first.parentNode.classList.toggle('multiple-dice',spec.count>1);startRiggedBeams(first);}
  $('open-dice').addEventListener('click',()=>{if(state.phase!=='turn'||busy)return;setItems(false);$('player-actions').hidden=true;$('dice-panel').hidden=false;$('dice-player').textContent=players[playerIndex()].name;$('turn-die').disabled=false;prepareMovementDice();$('dice-hint').textContent=engine.diceSpec(state).rigged?'Molette : choisis entre 1 et '+engine.diceSpec(state).max+' · Clique pour lancer':'Clique sur le dé';$('cancel-dice').hidden=false;});
  $('cancel-dice').addEventListener('click',()=>{if(busy)return;$('dice-panel').hidden=true;render();});
  $('turn-die').addEventListener('wheel',e=>{if(busy||state.phase!=='turn'||!engine.diceSpec(state).rigged)return;e.preventDefault();chosenDieValue=Math.max(1,Math.min(engine.diceSpec(state).max,chosenDieValue+(e.deltaY<0?1:-1)));$('turn-die').querySelectorAll('.die-face').forEach(f=>f.textContent=chosenDieValue);},{passive:false});
  async function rollMovementDice(){if(busy||state.phase!=='turn')return;busy=true;const spec=engine.diceSpec(state),values=Array.from({length:spec.count},(_,i)=>spec.rigged?chosenDieValue:1+Math.floor(Math.random()*(spec.kind==='mini-double-dice'&&i===1?3:spec.max))),allowed=spec.rigged?[chosenDieValue]:Array.from({length:spec.max},(_,i)=>i+1);state=engine.rollTurn(state,values);persist();renderHud();$('cancel-dice').hidden=true;await animateDie($('turn-die'),values[0],allowed,values.slice(1),[...document.querySelectorAll('.extra-turn-die')],null,1,spec.kind==='mini-double-dice'?[allowed,[1,2,3]]:null);if(!alive)return;busy=false;$('dice-panel').hidden=true;render();}
  $('turn-die').addEventListener('click',rollMovementDice);
  const movementSpeed=()=>speed*(state.turboMovement?1.5:1);
  function travel(from,to) {
    cancelAnimationFrame(cameraFrame);
    let startView={...canvas.view},endView=focusedView(to),zoomVersion=playerZoom;
    const fromPawn=pawnList().find(p=>p.active),endPositions=[...state.positions];endPositions[playerIndex()]=to.id;const toPawn=pawnList(null,endPositions).find(p=>p.active);
    return new Promise(resolve=>{let previous=performance.now(),elapsed=0;const duration=Math.min(1800,Math.max(1150,Math.hypot(to.x-from.x,to.y-from.y)*4));
      const frame=now=>{if(!alive){resolve(false);return;}elapsed+=(now-previous)*movementSpeed();previous=now;const t=Math.min(1,elapsed/duration),e=t*t*(3-2*t),point={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e};
        if(playerZoom!==zoomVersion){zoomVersion=playerZoom;startView=focusedView(from);endView=focusedView(to);}
        for(const key of ['x','y','scale'])canvas.view[key]=startView[key]+(endView[key]-startView[key])*e;
        movingPoint={x:fromPawn.x+(toPawn.x-fromPawn.x)*e,y:fromPawn.y+(toPawn.y-fromPawn.y)*e};canvas.apply();paintPawns(movingPoint);
        if(t<1)requestAnimationFrame(frame);else {movingPoint=null;resolve(true);}
      };requestAnimationFrame(frame);
    });
  }
  async function runMovement() {
    if(driving||busy||state.phase!=='moving')return;driving=true;
    try {
      const centered=focusedView(playerNode());
      if(Math.abs(centered.x-canvas.view.x)>2||Math.abs(centered.y-canvas.view.y)>2||Math.abs(centered.scale-canvas.view.scale)>.01){slideView(centered,450/movementSpeed());await pause(450/movementSpeed());}
      while(alive&&state.phase==='moving') {
        if(!state.target){const exits=engine.exits(board,playerNode().id);if(!exits.length){status('Cette case n’a aucune sortie. Corrige le plateau dans l’éditeur.');break;}if(exits.length>1){state.phase='choice';persist();render();break;}state=engine.choose(state,board,exits[0]);persist();}
        if(!await travel(playerNode(),nodes.get(state.target)))break;
        state=engine.arrive(state,board);persist();paintPawns();$('steps-label').textContent=state.remaining?`${state.remaining} case${state.remaining>1?'s':''}`:'';
        if(state.phase!=='moving'){render();if(state.phase!=='moving')break;}
        if(!['star','boo','shop','slots','port'].includes(playerNode().type))await pause(150/movementSpeed());
      }
    } catch(error){status(error.message);} finally {driving=false;}
  }
  window.addEventListener('keydown',event=>{if(event.code!=='Space')return;if(state.phase==='ranking'&&dismissStandings){event.preventDefault();if(!event.repeat)dismissStandings();return;}if(fairUI?.handleSpace(event)){event.preventDefault();return;}if(slotsUI?.handleSpace()){event.preventDefault();return;}if(fateUI?.handleSpace()){event.preventDefault();return;}if(finaleUI?.handleSpace()){event.preventDefault();return;}if(state.phase==='late-intro'){event.preventDefault();if(!event.repeat)dismissLateIntro?.();return;}if(itemsUI?.handleSpace()){event.preventDefault();return;}if(shopUI?.handleSpace()){event.preventDefault();return;}if(state.phase==='tropical-voyage')boatSpeed=3;if(eventUI?.handleSpace(event)){event.preventDefault();return;}if(miniAnimation){event.preventDefault();miniAnimation.skip=true;miniAnimation.wake?.();return;}if(dieAnimation){event.preventDefault();dieAnimation.skip=true;dieAnimation.wake?.();return;}if(state.phase==='tropical-voyage'){event.preventDefault();return;}if(!['moving','pass'].includes(state.phase)||busy||mapMode)return;event.preventDefault();speed=3;});
  window.addEventListener('keyup',event=>{if(event.code==='Space'){speed=1;boatSpeed=1;}});
  window.addEventListener('blur',()=>{speed=1;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)speed=1;});
  svg.addEventListener('wheel',event=>{
    if(mapMode){cancelAnimationFrame(cameraFrame);return;}if(!['turn','moving','choice','pass','land'].includes(state.phase))return;
    event.preventDefault();cancelAnimationFrame(cameraFrame);
    playerZoom=Math.max(.15,Math.min(2.5,canvas.view.scale*Math.exp(-event.deltaY*.0015)));
    const point=movingPoint||playerNode();const to=focusedView(point);Object.assign(canvas.view,to);canvas.apply();paintPawns(movingPoint);
  },{passive:false});
  function positionItems(){
    if(!itemsOpen&&!itemsClosing)return;const nav=$('player-actions'),panel=$('items-panel'),viewport=svg.getBoundingClientRect();
    nav.style.left='';nav.style.right='';const rect=nav.getBoundingClientRect(),width=Math.min(250,Math.max(120,viewport.width-rect.width-44));
    const left=Math.max(12,Math.min(rect.left,viewport.width-rect.width-width-28));
    nav.style.left=left+'px';nav.style.right='auto';panel.style.left=(left+rect.width+12)+'px';panel.style.right='auto';panel.style.width=width+'px';panel.style.top=(rect.top+rect.height/2)+'px';
  }
  function setItems(open){
    const panel=$('items-panel');if(open)shopUI?.inventory();
    if(open===itemsOpen&&(open||itemsClosing||panel.hidden))return;
    clearTimeout(itemsTimer);itemsOpen=open;itemsClosing=!open;panel.hidden=false;if(open)positionItems();
    panel.classList.remove('items-enter');panel.classList.remove('items-leave');void panel.offsetWidth;
    panel.classList.add(open?'items-enter':'items-leave');
    $('open-items').setAttribute('aria-expanded',open?'true':'false');
    if(!open)itemsTimer=setTimeout(()=>{if(!itemsOpen){panel.hidden=true;itemsClosing=false;panel.classList.remove('items-leave');$('player-actions').style.left='';$('player-actions').style.right='';}},220);
  }
  $('open-items').addEventListener('click',()=>{if(state.phase==='turn'&&!engine.usedItem(state))setItems(!itemsOpen);});
  $('close-items').addEventListener('click',()=>setItems(false));

  function hideMapShop(){
    const bubble=mapShopBubble;mapShopNode=null;mapShopBubble=null;if(!bubble)return;
    const current=getComputedStyle(bubble),from={opacity:current.opacity,transform:current.transform};
    bubble.shopMotion?.cancel();bubble.setAttribute('aria-hidden','true');
    bubble.shopMotion=bubble.animate([from,{opacity:0,transform:'translateY(7px) scale(.82)'}],{duration:260,easing:'cubic-bezier(.4,0,.6,1)',fill:'both'});
    bubble.shopMotion.finished.then(()=>bubble.remove(),()=>bubble.remove());
  }
  function positionMapShop(){
    if(!mapMode||!mapShopNode||!mapShopBubble)return;
    const r=svg.getBoundingClientRect(),x=r.left+mapShopNode.x*canvas.view.scale+canvas.view.x,y=r.top+mapShopNode.y*canvas.view.scale+canvas.view.y;
    if(x<r.left||x>r.right||y<r.top||y>r.bottom){hideMapShop();return;}
    const width=mapShopBubble.offsetWidth,height=mapShopBubble.offsetHeight,margin=10;
    const left=Math.max(margin,Math.min(window.innerWidth-width-margin,x-width/2));
    const above=y-30*canvas.view.scale-height-12,top=above>=margin?above:y+30*canvas.view.scale+12;
    mapShopBubble.style.left=left+'px';mapShopBubble.style.top=Math.max(margin,Math.min(window.innerHeight-height-margin,top))+'px';
  }
  function showMapShop(id){
    const node=nodes.get(id);if(!mapMode||node?.type!=='shop'){hideMapShop();return;}
    if(mapShopNode?.id===id)return;
    if(mapShopBubble)hideMapShop();
    if(!mapShopBubble){mapShopBubble=document.createElement('div');mapShopBubble.className='map-shop-preview';mapShopBubble.setAttribute('role','tooltip');document.body.append(mapShopBubble);}
    mapShopNode=node;mapShopBubble.replaceChildren();
    const offers=engine.shopOffers(state,session,id).slice().sort((a,b)=>a.price-b.price);
    if(!offers.length){const empty=document.createElement('span');empty.className='map-shop-empty';empty.textContent='Aucun objet en vente';mapShopBubble.append(empty);}
    else {const list=document.createElement('div');list.className='map-shop-stock';list.style.setProperty('--shop-columns',Math.min(8,offers.length));for(const offer of offers){const entry=document.createElement('div'),image=document.createElement('img'),price=document.createElement('small'),item=model.items[offer.itemId];entry.className='map-shop-product';model.itemImage(image,offer.itemId);image.alt=item.name;image.draggable=false;price.textContent=offer.price+' AC';entry.setAttribute('aria-label',item.name+' : '+offer.price+' AC');entry.append(image,price);list.append(entry);}mapShopBubble.append(list);}
    mapShopBubble.setAttribute('aria-hidden','false');positionMapShop();if(mapShopNode){const bubble=mapShopBubble;bubble.classList.add('visible');bubble.shopMotion=bubble.animate([{opacity:0,transform:'translateY(9px) scale(.82)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:340,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'});}
  }
  svg.addEventListener('pointerover',event=>{const node=event.target.closest('[data-node]');if(mapMode&&!drag)showMapShop(node?.dataset.node);});
  svg.addEventListener('pointerout',event=>{if(!mapShopNode)return;const next=event.relatedTarget?.closest?.('[data-node]');if(next?.dataset.node!==mapShopNode.id)hideMapShop();});
  svg.addEventListener('pointerleave',hideMapShop);
  svg.addEventListener('pointerdown',hideMapShop);
  svg.addEventListener('focusin',event=>{if(mapMode)showMapShop(event.target.closest('[data-node]')?.dataset.node);});
  svg.addEventListener('focusout',hideMapShop);

  function fitMap() {const b=model.bounds(board),rect=svg.getBoundingClientRect(),scale=Math.max(.02,Math.min(1.3,(rect.width-60)/b.width,(rect.height-215)/b.height));slideView({scale,x:rect.width/2-(b.x+b.width/2)*scale,y:rect.height/2-30-(b.y+b.height/2)*scale},850,true);}
  function closeMap(){if(!mapMode)return;hideMapShop();mapMode=false;hovered=null;canvas.world.querySelector('.map-boat-routes')?.remove();canvas.zoomEnabled=false;document.body.classList.remove('map-mode');$('map-controls').hidden=true;$('map-distance').hidden=true;canvas.highlightRoute();focusPlayer();render();}
  function openMap(){if(mapMode||!['turn','choice','tropical-port','shop-menu','shop-sale-menu','street-build'].includes(state.phase))return;$('close-map').textContent=state.phase==='street-build'?'Retour à Construire ↩':state.phase.startsWith('shop-')?'Retour au shop ↩':'Revenir au joueur ↩';mapMode=true;setItems(false);cancelAnimationFrame(cameraFrame);canvas.zoomEnabled=true;document.body.classList.add('map-mode');$('map-controls').hidden=false;$('map-distance').hidden=false;$('map-distance').textContent='Survole une case pour afficher le chemin.';fitMap();render();}
  $('open-map').addEventListener('click',openMap);$('open-market').addEventListener('click',()=>{if(state.phase!=='turn'||!state.street||busy||mapMode)return;setItems(false);streetUI.openBook();});
  $('close-map').addEventListener('click',closeMap);$('map-fit').addEventListener('click',fitMap);$('map-zoom-in').addEventListener('click',()=>{cancelAnimationFrame(cameraFrame);canvas.zoom(1.25);});$('map-zoom-out').addEventListener('click',()=>{cancelAnimationFrame(cameraFrame);canvas.zoom(.8);});

  function drawMapBoats(links){
    canvas.world.querySelector('.map-boat-routes')?.remove();
    const ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g');group.setAttribute('class','map-boat-routes');group.setAttribute('pointer-events','none');
    for(const [from,to]of links){const a=nodes.get(from),b=nodes.get(to),path=document.createElementNS(ns,'path');for(const [k,v]of Object.entries({d:'M '+a.x+' '+a.y+' Q '+(a.x+b.x)/2+' '+((a.y+b.y)/2-36)+' '+b.x+' '+b.y,fill:'none',stroke:'#ffe18a','stroke-width':4,'stroke-dasharray':'9 6'}))path.setAttribute(k,v);group.append(path);}
    canvas.world.insertBefore(group,canvas.pawnLayer);
  }
  function highlight(id) {
    if(!mapMode||hovered===id)return;hovered=id;const route=engine.travelShortest(board,playerNode().id,id),node=nodes.get(id);
    const distance=route?route.distance+(id===playerNode().id||node.countsAsStep?0:1):0;canvas.highlightRoute(route?.path||[]);drawMapBoats(route?.boatEdges||[]);$('map-distance').textContent=route?`${node.label||model.types[node.type].name} · ${distance} case${distance>1?'s':''}${(board.id==='board-b04d4dce-1d23-4e36-81c5-3d23e3944403'||board.name.toLowerCase().replace(/[^a-z]/g,'')==='aboubaislands')?' · '+route.cost+' AC de ports':''}`:'Case inaccessible depuis ce joueur';
  }
  svg.addEventListener('click',event=>{if(!['choice','tropical-port'].includes(state.phase))return;const edge=event.target.closest('[data-edge]');if(!edge)return;const route=board.edges[Number(edge.dataset.edge)];if(route.from===playerNode().id)chooseDirection(route.to);});
  svg.addEventListener('keydown',event=>{if(['choice','tropical-port'].includes(state.phase)&&(event.key==='Enter'||event.key===' ')){event.preventDefault();const edge=event.target.closest('[data-edge]');if(edge){const route=board.edges[Number(edge.dataset.edge)];if(route.from===playerNode().id)chooseDirection(route.to);}}});
  svg.addEventListener('pointerover',event=>{if(state.phase==='choice'&&!mapMode){const group=event.target.closest('[data-edge]');if(group){const edge=board.edges[Number(group.dataset.edge)];if(edge.from===playerNode().id)previewChoice(edge.to);}}const node=event.target.closest('[data-node]');if(node&&mapMode&&!drag)highlight(node.dataset.node);});
  svg.addEventListener('focusin',event=>{const node=event.target.closest('[data-node]');if(node)highlight(node.dataset.node);});
  svg.addEventListener('pointerdown',event=>{if(!mapMode||event.button!==0)return;cancelAnimationFrame(cameraFrame);const node=event.target.closest('[data-node]');if(node)highlight(node.dataset.node);drag={id:event.pointerId,x:event.clientX,y:event.clientY,view:{...canvas.view}};svg.setPointerCapture(event.pointerId);});
  svg.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;canvas.view.x=drag.view.x+event.clientX-drag.x;canvas.view.y=drag.view.y+event.clientY-drag.y;canvas.apply();});
  const endDrag=event=>{if(drag?.id!==event.pointerId)return;drag=null;if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);};svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);svg.addEventListener('lostpointercapture',endDrag);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'){if(streetUI?.isBookOpen()){streetUI.closeBook();return;}if(mapMode)closeMap();else if(itemsOpen){setItems(false);}else if(!busy&&!$('dice-panel').hidden){$('dice-panel').hidden=true;render();}}});
  window.addEventListener('resize',()=>{positionItems();if(!mapMode&&['turn','choice'].includes(state.phase))focusPlayer(false);});
  function prepareMiniBonus(){
    state=engine.prepareMinigameBonus(state);persist();
    const badge=$('mini-double-coins');badge.hidden=engine.minigameMultiplier(state)!==2;
    if(!badge.hidden)badge.animate([{opacity:0,transform:'translateY(10px) scale(.85)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:550,easing:'cubic-bezier(.22,.75,.25,1)'});
  }
  async function selectMini(){
    if(miniSelecting||miniFrame)return;miniSelecting=true;prepareMiniBonus();const signal={skip:false,wake:null};miniAnimation=signal;const wait=ms=>signal.skip?Promise.resolve():new Promise(resolve=>{const task=setTimeout(()=>{signal.wake=null;resolve();},ms);signal.wake=()=>{clearTimeout(task);signal.wake=null;resolve();};});$('mini-intro').hidden=false;$('mini-start').hidden=true;$('mini-title').textContent='';$('mini-list-window').hidden=true;
    $('mini-banner').classList.remove('arrive');void $('mini-banner').offsetWidth;$('mini-banner').classList.add('arrive');await wait(1100);if(!alive)return;
    const eligible=games.filter(game=>session.minigameIds.includes(game.id));
    if(!state.miniSpin){const selectedId=engine.pickMinigame(state,session);state.miniSpin={steps:eligible.length*Math.max(3,Math.ceil(18/eligible.length))+eligible.findIndex(game=>game.id===selectedId)};}persist();
    $('mini-list').replaceChildren();const rows=eligible.map((game,index)=>{const row=document.createElement('li');row.textContent=game.title;row.tabIndex=0;const pick=()=>{if(devEnabled){signal.forced=index;signal.skip=true;signal.wake?.();}};row.addEventListener('click',pick);row.addEventListener('keydown',e=>{if(e.key==='Enter')pick();});$('mini-list').append(row);return row;});$('mini-list-window').hidden=false;
    const total=state.miniSpin.steps,weightSum=Array.from({length:total+1},(_,i)=>.4+3.6*Math.pow(i/total,5)).reduce((a,b)=>a+b,0);let stop=total,braking=null,lastDelay=3200*.4/weightSum;
    for(let i=0;i<=stop;i++){
      if(!alive)return;if(signal.forced!==undefined)break;if(signal.skip&&!braking){braking=window.PourtySelectionMotion.brake(i,total,rows.length,lastDelay,5);stop=braking.stop;}const index=i%rows.length;rows.forEach((row,j)=>row.classList.toggle('selected',j===index));$('mini-list-window').scrollTop=rows[index].offsetTop-($('mini-list-window').clientHeight-rows[index].offsetHeight)/2;
      lastDelay=braking?window.PourtySelectionMotion.delay(braking,i):3200*(.4+3.6*Math.pow(i/total,5))/weightSum;await pause(lastDelay);
      // A press during the last interval still gets a complete braking tail.
      if(signal.skip&&!braking&&signal.forced===undefined){braking=window.PourtySelectionMotion.brake(i+1,total,rows.length,lastDelay,5);stop=braking.stop;}
    }
    const selected=signal.forced??total%eligible.length;rows.forEach((row,index)=>row.classList.toggle('selected',index===selected));state.minigameId=eligible[selected].id;persist();$('mini-title').textContent=eligible[selected].title;window.PourtySelectionMotion.confirm(rows[selected]);await pause(750);miniAnimation=null;miniSelecting=false;if(alive)openMini();
  }
  function openMini(){
    if(miniSelecting||miniFrame||!['minigame','minigame-playing'].includes(state.phase))return;
    const game=games.find(game=>game.id===state.minigameId);if(!game)return;prepareMiniBonus();
    for(const [field,key]of [['rosterBackup','mini-Jeux-host-players'],['modeBackup','marioPourty']])if(!Object.hasOwn(state,field)){try{state[field]=localStorage.getItem(key);}catch{state[field]=null;}}
    state.phase='minigame-playing';document.body.classList.remove('selecting-mini');persist();miniToken=globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random();
    const roster=state.duel?state.duel.participants:players.map((_,id)=>id);const bets=(state.bets||[]).map(b=>({owner:roster.indexOf(b.owner),target:roster.indexOf(b.target)})).filter(b=>b.owner>=0&&b.target>=0);miniFrame=document.createElement('iframe');miniFrame.title=game.title;miniFrame.name=JSON.stringify({kind:'pourty-minigame',token:miniToken,rewardMultiplier:engine.minigameMultiplier(state),bets,players:state.duel?state.duel.participants.map(id=>players[id]):session.players,duel:state.duel?{total:state.duel.stake*2,resource:state.duel.resource}:undefined,wager:state.wager?{total:state.wager.total}:undefined});miniFrame.allow='autoplay; fullscreen';miniFrame.src="../"+game.file;
    $('mini-frame-container').replaceChildren(miniFrame);$('mini-intro').hidden=true;$('mini-stage').hidden=false;
  }
  function finishMini(rewards=[]){
    if(state.phase!=='minigame-playing')return;
    let completed;try{completed=engine.finishMinigame(state,session,rewards);completed=engine.recordMinigame(completed,session,state.minigameId);}catch(error){status(error.message);return;}
    if(miniFrame){miniFrame.remove();miniFrame=null;}miniToken=null;$('mini-frame-container').replaceChildren();$('mini-stage').hidden=true;$('mini-intro').hidden=true;
    try{for(const[field,key,expected]of [['rosterBackup','mini-Jeux-host-players',JSON.stringify(state.duel?state.duel.participants.map(id=>players[id]):session.players)],['modeBackup','marioPourty','true']])if(localStorage.getItem(key)===expected&&Object.hasOwn(state,field)){if(state[field]===null)localStorage.removeItem(key);else localStorage.setItem(key,state[field]);}}catch{}
    state=completed;delete state.rosterBackup;delete state.modeBackup;delete state.miniSpin;persist();render();
  }
  $('mini-start').addEventListener('click',openMini);
  window.addEventListener('message',event=>{if(!miniFrame||event.source!==miniFrame.contentWindow)return;if(event.data?.token!==miniToken)return;if(event.data?.type==='pourty-minigame-finished')finishMini(event.data.rewards||[]);else if(event.data?.type==='pourty-minigame-storage-error')status('Le mini-jeu n’a pas pu récupérer les joueurs. Autorise le stockage du navigateur.');});

  window.addEventListener('pagehide',()=>{alive=false;stopRiggedBeams();clearTimeout(timer);cancelAnimationFrame(cameraFrame);persist();});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  eventUI=window.PourtyBoardEvents({$,engine,board,session,players,canvas,svg,pause,animateDie,
    chooseTarget:(...args)=>shopUI.chooseTarget(...args),devEnabled:()=>devEnabled,getState:()=>state,setState:next=>{state=next;persist();},render,alive:()=>alive,
    displayWallets:value=>{effectWallets=value;renderHud();},hudCard:id=>hudCards.get(id),
    playerScreen:id=>{const p=nodes.get(state.positions[id]);return {x:p.x*canvas.view.scale+canvas.view.x,y:p.y*canvas.view.scale+canvas.view.y};},
    focusPlayer:id=>{const node=nodes.get(state.positions[id]),rect=svg.getBoundingClientRect(),scale=playerZoom??1.8;slideView({scale,x:rect.width*.5-node.x*scale,y:rect.height*.48-node.y*scale},700);lastFocus='effect';}
  });
  shopUI=window.PourtyShopUI({$,engine,model,players,session,pause,getState:()=>state,setState:next=>{state=next;persist();},render,alive:()=>alive,openMap,isMapOpen:()=>mapMode,devEnabled:()=>devEnabled,closeItems:()=>setItems(false),roulette:(...args)=>eventUI.roulette(...args),skipRoulette:()=>eventUI.skipRoulette(),animateLoss:(...args)=>eventUI.animateLoss(...args),animateChanges:(...args)=>eventUI.animateChanges(...args),displayWallets:wallets=>{effectWallets=wallets;renderHud();},playerScreen:id=>{const p=nodes.get(state.positions[id]);return {x:p.x*canvas.view.scale+canvas.view.x,y:p.y*canvas.view.scale+canvas.view.y};},focusPlayer:id=>{const node=nodes.get(state.positions[id]),rect=svg.getBoundingClientRect(),scale=playerZoom??1.8;slideView({scale,x:rect.width*.5-node.x*scale,y:rect.height*.48-node.y*scale},700);lastFocus='item';}});
  itemsUI=window.PourtyItemsUI({chooseTarget:(...args)=>shopUI.chooseTarget(...args),$,engine,model,session,players,pause,canvas,svg,frameNodes:ids=>{const points=ids.map(id=>nodes.get(id)),rect=svg.getBoundingClientRect(),xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs)-90,maxX=Math.max(...xs)+90,minY=Math.min(...ys)-90,maxY=Math.max(...ys)+90,scale=Math.min(1.8,(rect.width-100)/(maxX-minX),(rect.height-240)/(maxY-minY));slideView({scale,x:rect.width/2-(minX+maxX)/2*scale,y:(rect.height-100)/2-(minY+maxY)/2*scale},700);},getState:()=>state,setState:s=>{state=s;persist();},render,alive:()=>alive,stopCamera:()=>cancelAnimationFrame(cameraFrame),paint:()=>paintPawns(),previewPositions:p=>{previewPositions=p;paintPawns();},hidePawn:(id,hidden)=>{hidden?hiddenPawns.add(id):hiddenPawns.delete(id);paintPawns();},screen:id=>{const p=nodes.get((previewPositions||state.positions)[id]);return {x:p.x*canvas.view.scale+canvas.view.x,y:p.y*canvas.view.scale+canvas.view.y};},focusNode:async id=>{const node=nodes.get(id),rect=svg.getBoundingClientRect(),scale=playerZoom??1.8;slideView({scale,x:rect.width*.5-node.x*scale,y:rect.height*.48-node.y*scale},750);lastFocus='object';await pause(800);},dropItem:(...args)=>shopUI.dropItem(...args),animateChanges:(...args)=>eventUI.animateChanges(...args),roulette:(...args)=>eventUI.roulette(...args),skipRoulette:()=>eventUI.skipRoulette()});
  fateUI=window.PourtyFateUI({engine,model,players,pause,animateDie,getState:()=>state,setState:s=>{state=s;persist();},render,alive:()=>alive,animateChanges:(...args)=>eventUI.animateChanges(...args),dropItem:(...args)=>shopUI.dropItem(...args),screen:id=>{const p=nodes.get(state.positions[id]);return {x:p.x*canvas.view.scale+canvas.view.x,y:p.y*canvas.view.scale+canvas.view.y};},focus:async id=>{const p=nodes.get(state.positions[id]),rect=svg.getBoundingClientRect(),scale=playerZoom??1.8;slideView({scale,x:rect.width*.5-p.x*scale,y:rect.height*.48-p.y*scale},700);lastFocus='fate';await pause(750);}});
  casinoUI=window.PourtyCasinoUI({engine,model,players,session,pause,animateDie,displayWallets:wallets=>{effectWallets=wallets;renderHud();},getState:()=>state,setState:s=>{state=s;persist();},render,alive:()=>alive,animateChanges:(...args)=>eventUI.animateChanges(...args)});
  slotsUI=window.PourtySlotsUI({engine,session,pause,getState:()=>state,setState:s=>{state=s;persist();},render,alive:()=>alive,animateChanges:(...args)=>eventUI.animateChanges(...args),dropItem:(...args)=>shopUI.dropItem(...args)});
  tropicalUI=window.PourtyTropicalUI({engine,model,session,canvas,pause,getState:()=>state,setState:s=>{state=s;persist();},render,alive:()=>alive,dropItem:(...args)=>shopUI.dropItem(...args),animateChanges:(...args)=>eventUI.animateChanges(...args),

    animateChestCoins:(...args)=>eventUI.animateChestCoins(...args),
    nodeScreen:id=>{const n=nodes.get(id);return {x:n.x*canvas.view.scale+canvas.view.x,y:n.y*canvas.view.scale+canvas.view.y};},
    isMapOpen:()=>mapMode,showPortChoices:()=>showChoices(),clearPortChoices:()=>clearChoices(),portChoicesVisible:()=>!$('choice-layer').hidden&&$('choice-layer').classList.contains('port-choices'),
    framePorts:(a,b)=>{const points=[nodes.get(a),nodes.get(b)],r=svg.getBoundingClientRect(),minX=Math.min(...points.map(p=>p.x))-100,maxX=Math.max(...points.map(p=>p.x))+100,minY=Math.min(...points.map(p=>p.y))-100,maxY=Math.max(...points.map(p=>p.y))+100,scale=Math.max(.1,Math.min(1.8,(r.width-60)/(maxX-minX),Math.max(150,r.height-340)/(maxY-minY)));slideView({scale,x:r.width/2-(minX+maxX)/2*scale,y:(r.height-220)/2-(minY+maxY)/2*scale},850);lastFocus='port-preview';},
    focusNode:async id=>{const node=nodes.get(id);slideView(focusedView(node),750);lastFocus='tropical';await pause(800);},
    voyage:async t=>{
      cancelAnimationFrame(cameraFrame);const from=nodes.get(t.from),to=nodes.get(t.to),ns='http://www.w3.org/2000/svg',boat=document.createElementNS(ns,'g'),img=document.createElementNS(ns,'image');
      img.setAttribute('href','../assets/decors/tropical-sailboat.svg');for(const [k,v]of Object.entries({x:-40,y:-65,width:80,height:80}))img.setAttribute(k,v);boat.append(img);boat.setAttribute('pointer-events','none');
      const badge=document.createElementNS(ns,'circle');for(const [k,v]of Object.entries({cx:0,cy:-6,r:8,fill:players[t.owner].color,stroke:'#142438','stroke-width':2}))badge.setAttribute(k,v);boat.append(badge);canvas.world.append(boat);hiddenPawns.add(t.owner);paintPawns();
      const a={...canvas.view},b=focusedView(to);let previous=performance.now(),elapsed=0;
      await new Promise(resolve=>{function frame(now){if(!alive){resolve();return;}elapsed+=(now-previous)*boatSpeed;previous=now;const p=Math.min(1,elapsed/2100),e=p*p*(3-2*p);boat.setAttribute('transform','translate('+(from.x+(to.x-from.x)*e)+' '+(from.y+(to.y-from.y)*e-Math.sin(p*Math.PI)*18)+')');for(const k of ['x','y','scale'])canvas.view[k]=a[k]+(b[k]-a[k])*e;canvas.apply();if(p<1)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
      boatSpeed=1;boat.remove();hiddenPawns.delete(t.owner);lastFocus='tropical';
    }
  });
  streetUI=window.PourtyStreetUI({focusPlayer:async id=>{slideView(focusedView(nodes.get(state.positions[id])),650);lastFocus=state.round+':'+state.turn;await pause(680);},openMap,isMapOpen:()=>mapMode,engine,model,session,players,canvas,pause,getState:()=>state,setState:s=>{state=s;persist();},render,alive:()=>alive,animateChanges:(...args)=>eventUI.animateChanges(...args),dropItem:(...args)=>shopUI.dropItem(...args),focusNode:async id=>{const node=nodes.get(id),decor=(model.streetPlots(board)[id]||model.streetPlots(board,'factory')[id]);if(decor){const r=svg.getBoundingClientRect(),left=Math.min(node.x-60,decor.x-decor.size*.55),right=Math.max(node.x+60,decor.x+decor.size*.55),top=Math.min(node.y-60,decor.y-decor.size*.65),bottom=Math.max(node.y+60,decor.y+decor.size*.4),scale=Math.max(.08,Math.min(1.8,(r.width-90)/(right-left),(r.height-210)/(bottom-top)));slideView({scale,x:r.width/2-(left+right)/2*scale,y:(r.height-120)/2-(top+bottom)/2*scale},650);}else slideView(focusedView(node),650);lastFocus='street';await pause(680);}});
  fairUI=window.PourtyFairUI({dropItem:(...args)=>shopUI.dropItem(...args),engine,model,session,players,canvas,svg,pause,getState:()=>state,setState:s=>{state=s;persist();},render,alive:()=>alive,animateChanges:(...args)=>eventUI.animateChanges(...args),roulette:(...args)=>eventUI.roulette(...args),skipRoulette:()=>eventUI.skipRoulette(),hidePawn:(id,hidden)=>{hidden?hiddenPawns.add(id):hiddenPawns.delete(id);paintPawns();},focusNode:async id=>{slideView(focusedView(nodes.get(id)),650);lastFocus='fair';await pause(680);},frameNodes:async ids=>{const points=ids.map(id=>nodes.get(id)),r=svg.getBoundingClientRect(),minX=Math.min(...points.map(p=>p.x))-140,maxX=Math.max(...points.map(p=>p.x))+140,minY=Math.min(...points.map(p=>p.y))-240,maxY=Math.max(...points.map(p=>p.y))+120,scale=Math.max(.08,Math.min(1.8,(r.width-70)/(maxX-minX),(r.height-220)/(maxY-minY)));slideView({scale,x:r.width/2-(minX+maxX)/2*scale,y:(r.height-130)/2-(minY+maxY)/2*scale},750);lastFocus='fair';await pause(780);}});
  bankUI=window.PourtyBankUI({engine,session,canvas,pause,getState:()=>state,setState:s=>{state=s;persist();},render,alive:()=>alive,animateChanges:(...args)=>eventUI.animateChanges(...args)});
  finaleUI=window.PourtyFinaleUI({$,engine,session,players,pause,getState:()=>state,setState:s=>{state=s;persist();},alive:()=>alive,roulette:(...args)=>eventUI.roulette(...args),skipRoulette:()=>eventUI.skipRoulette(),zoomOut:()=>{closeMap();setItems(false);const view=overview(),rect=svg.getBoundingClientRect(),factor=.75;slideView({scale:view.scale*factor,x:rect.width/2-(rect.width/2-view.x)*factor,y:rect.height/2-(rect.height/2-view.y)*factor},3000);lastFocus='finale';}});
  window.PourtyDeveloper({$,players,board,session,registerOpen:fn=>{openTestTools=fn;},simulateEnd:()=>{closeMap();setItems(false);$('dice-panel').hidden=true;clearChoices();state=engine.simulateEnd(state);session.turns=state.simulatedTurns;persist();render();},giveItem:(owner,itemId)=>{closeMap();setItems(false);state=engine.giveItem(state,owner,itemId);persist();render();},getState:()=>state,enabled:value=>{devEnabled=value;document.body.classList.toggle('developer-mode',value);drawHiddenBlocks();},canEdit:()=>!busy&&!driving&&['turn','choice'].includes(state.phase),apply:(round,wallets)=>{state.round=round;for(const id of window.PourtyTeams.reps(state)){const members=window.PourtyTeams.members(state,id),changed=members.find(i=>wallets[i]!==state.wallets[i].ac)??id;for(const member of members)state.wallets[member].ac=wallets[changed];}persist();render();},teleport:id=>{
    closeMap();setItems(false);$('dice-panel').hidden=true;clearChoices();cancelAnimationFrame(cameraFrame);const node=nodes.get(id);state.positions[playerIndex()]=id;state.target=null;state.lastRoll=null;delete state.effect;state.remaining=node.countsAsStep?0:1;
    state.phase=node.countsAsStep?'land':node.type==='star'?(state.starVisible&&state.starNode===id?'star-offer':'land-complete'):'pass';lastFocus=null;persist();render();
  }});
  if(testMode){test.buddyTools({root:$('developer-panel'),session,getState:()=>state,canEdit:()=>!busy&&!driving&&['turn','choice'].includes(state.phase),add:(player,nodeId)=>{const result=test.addBuddy(engine,state,session,player,nodeId);test.saveBuddy(result);testRestarting=true;alive=false;location.reload();},move:(id,nodeId)=>{if(id<1||!players[id]||!nodes.has(nodeId))return;state.positions[id]=nodeId;persist();render();}});document.body.classList.add('developer-mode');$('developer-enabled').checked=true;test.toolbar({openTools:()=>openTestTools?.(),canEdit:()=>true,restart:()=>{testRestarting=true;alive=false;localStorage.removeItem(key);location.reload();}});}
  persist();render();
})();
