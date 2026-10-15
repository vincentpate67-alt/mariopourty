(() => {
  'use strict';
  window.PourtyBoardEvents=function(ctx){
    const {$,engine,players,board,session,pause}=ctx;let running=false,rouletteSkip=false;
    let coinRun=null;
    function coinAnimation(node,frames,options,resource){const animation=node.animate?.(frames,options);if(resource==='ac'&&coinRun&&animation){const run=coinRun;run.animations.add(animation);animation.updatePlaybackRate?.(run.rate);animation.finished?.then(()=>run.animations.delete(animation),()=>run.animations.delete(animation));}return animation;}
    function coinPause(duration,run){if(!run)return pause(duration);return new Promise(resolve=>{let remaining=duration,start=performance.now(),rate=run.rate,timer;
      const finish=()=>{run.wake=null;resolve();};
      const schedule=()=>{start=performance.now();rate=run.rate;timer=setTimeout(finish,remaining/rate);};
      run.wake=()=>{clearTimeout(timer);remaining=Math.max(0,remaining-(performance.now()-start)*rate);schedule();};schedule();
    });}
    const get=ctx.getState;
    const save=state=>ctx.setState(state);
    function advance(state){save(state);ctx.render();}
    function clearPanel(title,subtitle=''){$('event-overlay').hidden=false;$('event-overlay').dataset.theme=['chance','luck-double','luck-move'].includes(get().effect?.kind)?'blue':['malchance','badluck-double'].includes(get().effect?.kind)?'red':get().effect?.kind==='boubakar'?'brown':'';$('event-die-second').hidden=true;$('event-title').textContent=title;$('event-subtitle').textContent=subtitle;$('event-options').replaceChildren();$('event-roulette').replaceChildren();$('event-pool').textContent='';$('event-die').hidden=true;window.PourtyMenuMotion?.reveal($('event-overlay'),get().phase+':'+title,'#event-options>button');}
    function button(text,fn,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=disabled;b.addEventListener('click',()=>{if(!running)fn();});$('event-options').append(b);return b;}
    async function focus(id){ctx.focusPlayer(id);await pause(750);}
    function particle(id,resource,gain,index,units=1){
      const point=ctx.playerScreen(id),node=document.createElement(resource==='stars'?'span':'img');node.className='wallet-particle '+(resource==='stars'?'star-particle':'coin-particle');if(resource==='stars')node.textContent='★';else{node.src='../assets/items/coin.png';node.alt='';node.draggable=false;}node.style.left=point.x+'px';node.style.top=point.y+'px';$('effect-particles').append(node);
      const spread=(index%5-2)*15,from=gain?{transform:`translate(${spread}px,-155px) scale(.7)`,opacity:0}:{transform:'translate(0,0) scale(1)',opacity:1},to=gain?{transform:'translate(0,0) scale(.7)',opacity:0}:{transform:`translate(${spread}px,-155px) scale(.6)`,opacity:0};
      coinAnimation(node,[from,{transform:gain?`translate(${spread/2}px,-60px) scale(1)`:`translate(${spread/2}px,-60px) scale(1)`,opacity:1},to],{duration:720,easing:gain?'ease-in':'ease-out',fill:'both'},resource);
      const label=document.createElement('span');label.className='wallet-float '+(resource==='stars'?'star-change':gain?'coin-gain':'coin-loss');label.textContent=(gain?'+':'−')+units;label.style.left=(point.x+32+index%3*8)+'px';label.style.top=(point.y-8)+'px';$('effect-particles').append(label);coinAnimation(label,[{opacity:0,transform:'translateY(12px) scale(.5)'},{opacity:1,transform:'translateY(-12px) scale(1.1)',offset:.35},{opacity:0,transform:'translateY(-60px) scale(.7)'}],{duration:850,fill:'both'},resource);setTimeout(()=>{node.remove();label.remove();},900);
    }
    async function animateDelta(delta,display){
      const {id,resource}=delta,amount=Math.abs(delta.delta),gain=delta.delta>=0;
      if(!amount){await pause(450);return;}
      const visible=Math.min(amount,40),interval=Math.min(170,Math.max(35,2100/visible));
      const run=resource==='ac'?{rate:1,animations:new Set(),wake:null}:null;if(run)coinRun=run;
      try{for(let i=0;i<visible;i++){if(!ctx.alive())return;const units=Math.floor((i+1)*amount/visible)-Math.floor(i*amount/visible);particle(id,resource,gain,i,units);window.PourtyTeams.addDisplay(get(),display,id,resource,gain?units:-units);ctx.displayWallets(display);await coinPause(interval,run);}await coinPause(650,run);}finally{if(coinRun===run)coinRun=null;}
    }
    async function hudDelta(delta,display,duration=1000){
      if(!delta.delta)return;
      const card=ctx.hudCard(delta.id);if(card){const badge=document.createElement('span');badge.className='hud-change';badge.textContent=(delta.delta>=0?'+':'')+delta.delta+(delta.resource==='stars'?' ★':' AC');const rect=card.getBoundingClientRect();badge.style.left=(rect.left+rect.width/2)+'px';badge.style.top=rect.top+'px';document.body.append(badge);badge.animate?.([{opacity:0,transform:'translate(-50%,8px)'},{opacity:1,transform:'translate(-50%,-18px)',offset:.4},{opacity:0,transform:'translate(-50%,-48px)'}],{duration,fill:'both'});setTimeout(()=>badge.remove(),duration+50);}
      window.PourtyTeams.addDisplay(get(),display,delta.id,delta.resource,delta.delta);ctx.displayWallets(display);await pause(duration);
    }
    async function animateEffect(){
      running=true;const state=get(),effect=state.effect,display=JSON.parse(JSON.stringify(effect.before));$('event-overlay').hidden=true;ctx.displayWallets(display);
      if(effect.kind==='minigame'||effect.kind==='payout'){
        for(const delta of effect.deltas)await hudDelta(delta,display,effect.kind==='minigame'?1400:1000);
        if(effect.kind==='minigame'){clearPanel('Mise en jeu');$('event-pool').textContent=state.wager.total+' AC';await pause(1600);}
      }else{
        if(effect.event==='start'){clearPanel('Retour au départ');await focus(effect.owner);await pause(700);$('event-overlay').hidden=true;}
        if(effect.fee){await hudDelta({id:effect.owner,resource:'ac',delta:-effect.fee},display);}
        for(const delta of effect.deltas){if(!['blue','red'].includes(effect.kind))await focus(delta.id);await animateDelta(delta,display);}
      }
      if(!ctx.alive())return;ctx.displayWallets(null);$('event-overlay').hidden=true;running=false;advance(engine.finishEffect(get()));
    }
    async function rollDice(){
      if(running||get().phase!=='effect-dice')return;running=true;const faces=engine.diceFaces(get()),value=faces[Math.floor(Math.random()*faces.length)],double=['luck-double','badluck-double'].includes(get().effect.kind),second=double?faces[Math.floor(Math.random()*faces.length)]:null;
      // Commit the result once before showing it; reloads resume the effect, never reroll it.
      save(engine.applyEffect(get(),double?[value,second]:value,board));await ctx.animateDie($('event-die'),value,faces,second);if(!ctx.alive())return;running=false;ctx.render();
    }
    async function showDice(){
      running=true;const e=get().effect,owner=e.kind==='boo-coins'?e.victim:e.owner;
      if(e.kind==='boo-coins')await focus(owner);else ctx.focusPlayer(owner);if(!ctx.alive())return;
      clearPanel(e.kind==='luck-move'?'Avance encore !':e.kind==='luck-double'?'2 dés pièces':e.kind==='badluck-double'?'2 dés anti-pièces':e.kind==='blue'?'AC gagnés':e.kind==='red'?'AC perdus':e.kind==='minigame'?'Combien mise chaque joueur ?':'Boo vole des AC',players[owner].name);
      const faces=engine.diceFaces(get());$('event-subtitle').textContent=(e.kind==='minigame'?faces.join(' / '):faces[0]+'-'+faces[faces.length-1])+(e.kind==='luck-move'?' cases':' AC');const color=e.kind==='luck-double'?'blue':e.kind==='badluck-double'?'red':e.kind;$('event-die').dataset.kind=color;if(['luck-double','badluck-double'].includes(e.kind)){const second=$('event-die-second');second.hidden=false;second.disabled=false;second.dataset.kind=color;second.querySelector('[data-die-value]').textContent='?';}$('event-die').hidden=false;$('event-die').disabled=false;$('event-die').querySelector('[data-die-value]').textContent='?';running=false;
    }
    async function roulette(options,selected,title,slow=false,theme='',fixedDuration=false){
      rouletteSkip=false;clearPanel(title);if(theme)$('event-overlay').dataset.theme=theme;
      let forced=null;const rows=options.map(option=>{const li=document.createElement('li');li.textContent=option.label;if(option.image){const image=document.createElement('img');image.src=option.image;if(option.fallback)image.addEventListener('error',()=>{image.src=option.fallback;},{once:true});image.alt='';image.className='roulette-item-image';li.prepend(image);}li.tabIndex=0;const pick=()=>{if(ctx.devEnabled?.())forced=option.id;};li.addEventListener('click',pick);li.addEventListener('keydown',e=>{if(e.key==='Enter')pick();});$('event-roulette').append(li);return li;});
      const compact=theme==='green'||fixedDuration,target=options.findIndex(option=>option.id===selected),total=compact?36:options.length*(slow?4:3)+target,start=compact?((target-total)%rows.length+rows.length)%rows.length:0;
      if(slow){await pause(compact?450:1500);if(!ctx.alive())return;}
      let stop=total,braking=null,lastDelay=compact?28:45;for(let i=0;i<=stop;i++){
        if(!ctx.alive())return;
        if(forced!==null)break;
        if(rouletteSkip&&!braking){braking=window.PourtySelectionMotion.brake(i,total,rows.length,lastDelay);stop=braking.stop;}
        rows.forEach((row,index)=>row.classList.toggle('selected',index===(start+i)%rows.length));
        rows[(start+i)%rows.length].scrollIntoView?.({block:'nearest'});
        const delay=braking?window.PourtySelectionMotion.delay(braking,i):compact?28+Math.pow(i/total,3)*320:slow?45+Math.pow(i/total,3)*700:45+Math.pow(i/total,5)*260;lastDelay=delay;
        await pause(delay);
      }
      const result=forced??selected;rows.forEach((row,index)=>row.classList.toggle('selected',options[index].id===result));rows[options.findIndex(option=>option.id===result)].scrollIntoView?.({block:'nearest'});window.PourtySelectionMotion.confirm(rows[options.findIndex(option=>option.id===result)]);await pause(compact?650:slow?950:750);return result;
    }
    async function boubakar(){running=true;save(engine.planBoubakar(get()));const selected=await roulette(engine.boubakarOptions(get()),get().effect.event,board.nodes.find(n=>n.id===get().positions[engine.active(get())])?.type==='chance'?'Chance':get().effect.kind==='malchance'?'Malchance':'Boubakar',true,'',get().effect.kind==='chance');if(!ctx.alive())return;const planned=get();planned.effect.event=selected;save(planned);$('event-overlay').hidden=true;save(engine.applyEffect(get(),undefined,board));running=false;ctx.render();}
    function booMenu(){
      clearPanel('Boo');const owner=engine.active(get()),coins=engine.booTargets(get(),'coins'),stars=engine.booTargets(get(),'stars');
      button('Voler des pièces',()=>advance(engine.chooseBooMode(get(),'coins')),!coins.length);
      button('Voler une étoile — '+(50*engine.priceMultiplier(get()))+' AC',()=>advance(engine.chooseBooMode(get(),'stars')),get().wallets[owner].ac<50*engine.priceMultiplier(get())||!stars.length);
      const canSteal=coins.length>0||(stars.length>0&&get().wallets[owner].ac>=50*engine.priceMultiplier(get()));
      if(session.gameMode!=='inverted'||!canSteal)button('Passer',()=>advance(engine.skipBoo(get())));
    }
    function booChoices(state){const eligible=engine.booTargets(state);return state.teams?.length?window.PourtyTeams.reps(state).filter(id=>eligible.includes(id)):eligible;}
    const booIdentity=id=>window.PourtyTeams.team(get(),id)||players[id];
    function booTargets(){
      clearPanel(get().teams?.length?'Quelle équipe veux-tu voler ?':'Qui veux-tu voler ?');const targets=booChoices(get());
      targets.forEach(id=>{const identity=booIdentity(id),b=button(identity.name,()=>advance(engine.chooseBooTarget(get(),id)));const dot=document.createElement('span');dot.className='boo-player-icon';dot.style.background=identity.color;dot.textContent=identity.name.slice(0,1).toUpperCase();b.prepend(dot);});
      button('Aléatoire',()=>{const id=targets[Math.floor(Math.random()*targets.length)];advance(engine.chooseBooTarget(get(),id,true));});button('Annuler',()=>advance(engine.backBoo(get())));
    }
    async function randomBoo(){running=true;const state=get();$('event-overlay').hidden=true;const choices=booChoices(state),initial=choices.find(id=>window.PourtyTeams.allied(state,id,state.effect.victim))??state.effect.victim;const selected=await ctx.chooseTarget(choices,initial,'Boo choisit sa cible',booIdentity);if(!ctx.alive())return;const planned=get();planned.effect.victim=selected;save(planned);running=false;advance(engine.resolveBooTarget(get()));}
    $('event-die').addEventListener('click',rollDice);$('event-die-second').addEventListener('click',rollDice);
    async function animateChestCoins(id,amount,before,source){
      const display=JSON.parse(JSON.stringify(before)),run={rate:1,animations:new Set(),wake:null},flights=[];coinRun=run;ctx.displayWallets(display);
      try{for(let i=0;i<amount;i++){
        if(!ctx.alive())return;
        const from=source(),to=ctx.playerScreen(id),coin=document.createElement('img');coin.src='../assets/items/coin.png';coin.alt='';coin.className='wallet-particle coin-particle';coin.style.left=from.x+'px';coin.style.top=from.y+'px';$('effect-particles').append(coin);
        const dx=to.x-from.x,dy=to.y-from.y,spread=(i%2?1:-1)*(30+i%4*9);
        const a=coinAnimation(coin,[{opacity:0,transform:'translate(0,0) scale(.45)'},{opacity:1,transform:'translate('+spread+'px,-65px) scale(1)',offset:.42},{opacity:1,transform:'translate('+dx+'px,'+dy+'px) scale(.55)',offset:.9},{opacity:0,transform:'translate('+dx+'px,'+dy+'px) scale(.1)'}],{duration:720,easing:'ease-in-out',fill:'both'},'ac');
        flights.push((a?.finished||pause(720)).catch(()=>{}).then(()=>{coin.remove();if(!ctx.alive())return;window.PourtyTeams.addDisplay(get(),display,id,'ac',1);ctx.displayWallets(display);const label=document.createElement('span');label.className='wallet-float coin-gain';label.textContent='+1';label.style.left=(to.x+30+i%3*8)+'px';label.style.top=(to.y-8)+'px';$('effect-particles').append(label);const anim=coinAnimation(label,[{opacity:0,transform:'translateY(8px) scale(.6)'},{opacity:1,transform:'translateY(-10px) scale(1.05)',offset:.3},{opacity:0,transform:'translateY(-55px) scale(.65)'}],{duration:700,fill:'both'},'ac');return (anim?.finished||pause(700)).catch(()=>{}).then(()=>label.remove());}));
        await coinPause(Math.max(18,Math.min(120,2000/Math.max(1,amount))),run);
      }await Promise.all(flights);}finally{if(coinRun===run)coinRun=null;ctx.displayWallets(null);}
    }
    return {canAccelerate:()=>!!coinRun||(running&&['effect-roulette','boo-random'].includes(get().phase)),releaseSpace(){if(coinRun){coinRun.rate=1;for(const a of coinRun.animations)a.updatePlaybackRate?.(1);coinRun.wake?.();}},animateChestCoins,async animateChanges(deltas,before,hud=false){const display=JSON.parse(JSON.stringify(before));ctx.displayWallets(display);for(const delta of deltas){if(hud)await hudDelta(delta,display,1400);else{await focus(delta.id);await animateDelta(delta,display);}}ctx.displayWallets(null);},roulette,skipRoulette(){rouletteSkip=true;},async animateLoss(id,amount,before){const display=JSON.parse(JSON.stringify(before));ctx.displayWallets(display);await focus(id);await animateDelta({id,resource:'ac',delta:-amount},display);ctx.displayWallets(null);},handleSpace(event){if(coinRun){if(coinRun.rate!==3){coinRun.rate=3;for(const animation of coinRun.animations)animation.updatePlaybackRate?.(3);coinRun.wake?.();}return true;}if(running&&['effect-roulette','boo-random'].includes(get().phase)){if(get().phase==='effect-roulette'&&event?.repeat)return true;rouletteSkip=true;return true;}return false;},render(){
      const phase=get().phase;if(!['effect-dice','effect-roulette','effect-animation','boo-menu','boo-target','boo-random','land-complete'].includes(phase)){if(!running)$('event-overlay').hidden=true;return false;}
      if(running)return true;
      if(phase==='land-complete'){advance(engine.completeLanding(get(),session));return true;}
      if(phase==='effect-dice')showDice();else if(phase==='effect-animation')animateEffect();else if(phase==='effect-roulette')boubakar();else if(phase==='boo-menu')booMenu();else if(phase==='boo-target')booTargets();else if(phase==='boo-random')randomBoo();return true;
    }};
  };
})();
