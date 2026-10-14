(() => {
  'use strict';
  const base=window.PourtyBoardEngine,copy=value=>JSON.parse(JSON.stringify(value));
  const boubakarEvents=[{id:'ten',label:'−10 AC'},{id:'twenty',label:'−20 AC'},{id:'half',label:'1/2 des AC'},{id:'star',label:'−1 étoile'},{id:'all',label:'Perte totale des AC'}];
  function startEffect(state,board){
    const node=base.nodeAt(state,board),next=copy(state);
    if(state.phase==='pass'&&node.type==='boo'){if(!booTargets(state,'coins').length&&(state.wallets[base.active(state)].ac<50||!booTargets(state,'stars').length)){next.phase='moving';return next;}next.phase='boo-menu';next.effect={kind:'boo',owner:base.active(state),after:'moving'};return next;}
    if(state.phase!=='land')throw Error('Case non disponible.');
    if(!['blue','red','boubakar','minigame','chance','malchance'].includes(node.type)){next.phase='land-complete';return next;}
    if(node.type==='minigame'&&next.wallets.every(wallet=>wallet.ac===0)){next.phase='minigame';next.spaceMinigame=true;next.minigameId=null;next.miniSpin=null;delete next.effect;delete next.wager;return next;}
    next.effect={kind:node.type,owner:base.active(state),after:'land-complete'};
    next.phase=['boubakar','chance','malchance'].includes(node.type)?'effect-roulette':'effect-dice';return next;
  }
  function diceFaces(state){return state.effect?.kind==='minigame'?[1,5,10,20]:['boo-coins','luck-double','badluck-double','luck-move'].includes(state.effect?.kind)?Array.from({length:state.effect.kind==='boo-coins'?10:(state.movementDieMax??10)},(_,i)=>i+1):Array.from({length:state.effect?.kind==='red'?(state.effect.max||3):(state.effect.max||5)},(_,i)=>i+1);}
  function boubakarOptions(state){
    if(state.effect.kind==='chance')return [{id:'ten',label:'+10 pièces'},{id:'twelve',label:'+12 pièces'},{id:'fifteen',label:'+15 pièces'},{id:'move',label:'Relancer un dé pour avancer'},{id:'double',label:'2 dés pièces'}];
    if(state.effect.kind==='malchance')return [{id:'eight',label:'−8 pièces'},{id:'ten',label:'−10 pièces'},{id:'fifteen',label:'−15 pièces'},{id:'start',label:'Retour à la case départ'},{id:'double',label:'2 dés anti-pièces'}];
    return boubakarEvents.filter(event=>event.id!=='star'||state.wallets[state.effect.owner].stars>0);}
  function planBoubakar(state,random=Math.random){if(state.phase!=='effect-roulette')throw Error('Événement indisponible.');if(state.effect.event)return copy(state);const next=copy(state),options=boubakarOptions(state);next.effect.event=options[Math.floor(random()*options.length)].id;return next;}
  function applyEffect(state,value,board){
    if(!['effect-dice','effect-roulette'].includes(state.phase))throw Error('Effet indisponible.');
    const next=copy(state),effect=next.effect,owner=effect.owner;effect.before=copy(next.wallets);effect.deltas=[];
    const change=(id,resource,delta)=>{next.wallets[id][resource]+=delta;effect.deltas.push({id,resource,delta});};
    const double=['luck-double','badluck-double'].includes(effect.kind);
    if(state.phase==='effect-dice'&&(double?(!Array.isArray(value)||value.length!==2||value.some(v=>!diceFaces(state).includes(v))):!diceFaces(state).includes(value)))throw Error('Lancer invalide.');
    if(effect.kind==='luck-move'){delete next.effect;return base.rollTurn({...next,phase:'turn'},value);}
    if(['chance','malchance'].includes(effect.kind)){
      if(!boubakarOptions(state).some(o=>o.id===effect.event))throw Error('Événement invalide.');
      if(effect.event==='move'||effect.event==='double'){effect.kind=effect.event==='move'?'luck-move':effect.kind==='chance'?'luck-double':'badluck-double';next.phase='effect-dice';delete effect.event;return next;}
      if(effect.event==='start'){if(!board?.startId)throw Error('Départ introuvable.');next.positions[owner]=board.startId;next.target=null;next.remaining=0;}
      else{const amount={eight:8,ten:10,twelve:12,fifteen:15}[effect.event];change(owner,'ac',effect.kind==='chance'?amount:-Math.min(amount,next.wallets[owner].ac));}
      next.phase='effect-animation';return next;
    }
    if(double){effect.rolls=value;const amount=value[0]+value[1];change(owner,'ac',effect.kind==='luck-double'?amount:-Math.min(amount,next.wallets[owner].ac));next.phase='effect-animation';return next;}
    effect.roll=value;
    if(effect.kind==='blue')change(owner,'ac',value);
    else if(effect.kind==='red')change(owner,'ac',-Math.min(value,next.wallets[owner].ac));
    else if(effect.kind==='boubakar'){
      const event=effect.event;if(!boubakarOptions(state).some(option=>option.id===event))throw Error('Événement invalide.');
      if(event==='star')change(owner,'stars',-1);else{const ac=next.wallets[owner].ac,loss=event==='ten'?10:event==='twenty'?20:event==='half'?Math.ceil(ac/2):ac;change(owner,'ac',-Math.min(ac,loss));}
    }else if(effect.kind==='minigame'){
      const representatives=window.PourtyTeams.reps(next);const contributions=next.wallets.map((wallet,id)=>representatives.includes(id)?Math.min(value,wallet.ac):0);contributions.forEach((amount,id)=>{if(amount>0)change(id,'ac',-amount);});
      next.wager={stake:value,contributions,total:contributions.reduce((a,b)=>a+b,0)};effect.after='wager-start';
    }else if(effect.kind==='boo-coins'){
      const amount=Math.min(value,next.wallets[effect.victim].ac);change(effect.victim,'ac',-amount);change(owner,'ac',amount);
    }else throw Error('Effet inconnu.');
    next.phase='effect-animation';return next;
  }
  function booTargets(state,mode=state.effect?.mode){return state.wallets.map((wallet,id)=>({wallet,id})).filter(({id,wallet})=>!window.PourtyTeams?.allied(state,id,base.active(state))&&(mode==='stars'?wallet.stars>0:wallet.ac>0)).map(({id})=>id);}
  function chooseBooMode(state,mode){if(state.phase!=='boo-menu'||!['coins','stars'].includes(mode))throw Error('Choix Boo invalide.');if(!booTargets(state,mode).length)throw Error('Aucune cible disponible.');if(mode==='stars'&&state.wallets[base.active(state)].ac<50)throw Error('Il faut 50 AC.');const next=copy(state);next.effect.mode=mode;next.phase='boo-target';return next;}
  function chooseBooTarget(state,id,random=false){if(state.phase!=='boo-target'||!booTargets(state).includes(id))throw Error('Cible invalide.');const next=copy(state);next.effect.victim=id;if(random){next.phase='boo-random';return next;}return resolveBooTarget({...next,phase:'boo-random'});}
  function resolveBooTarget(state){
    if(state.phase!=='boo-random'||!booTargets(state).includes(state.effect.victim))throw Error('Cible indisponible.');const next=copy(state),e=next.effect;
    if(e.mode==='coins'){e.kind='boo-coins';next.phase='effect-dice';return next;}
    const owner=e.owner,victim=e.victim;if(next.wallets[owner].ac<50)throw Error('Il faut 50 AC.');
    e.kind='boo-stars';e.before=copy(next.wallets);next.wallets[owner].ac-=50;next.wallets[victim].stars--;next.wallets[owner].stars++;
    e.deltas=[{id:victim,resource:'stars',delta:-1},{id:owner,resource:'stars',delta:1}];e.fee=50;next.phase='effect-animation';return next;
  }
  function backBoo(state){if(state.phase!=='boo-target')throw Error('Choix Boo indisponible.');const next=copy(state);next.phase='boo-menu';delete next.effect.mode;delete next.effect.victim;return next;}
  function skipBoo(state){if(!['boo-menu','boo-target'].includes(state.phase))throw Error('Boo indisponible.');const next=copy(state);next.phase='moving';delete next.effect;return next;}
  function finishEffect(state){
    if(state.phase!=='effect-animation')throw Error('Aucun effet à terminer.');const next=copy(state),e=next.effect;
    if(e.kind==='boo-stars'){next.rankingBefore=e.before;next.afterRanking='moving';next.phase='ranking';}
    else if(e.after==='wager-start'){next.phase='minigame';next.minigameId=null;next.miniSpin=null;}
    else next.phase=e.after;delete next.effect;return next;
  }
  function completeLanding(state,session){if(state.phase!=='land-complete')throw Error('Case non terminée.');return base.nextPlayer({...copy(state),phase:'land'},session);}
  function starRoutes(state,board){
    const from=base.nodeAt(state,board).id;
    if(!state.starVisible||!state.starNode||state.starNode===from)return [];
    // Compare each outgoing route without doubling back through this intersection.
    const forward={...board,edges:board.edges.filter(edge=>edge.to!==from)},nodes=new Map(board.nodes.map(node=>[node.id,node]));
    const routes=base.exits(board,from).map(id=>{const route=base.shortest(forward,id,state.starNode);return route?{id,distance:(nodes.get(id).countsAsStep?1:0)+route.distance+1}:null;}).filter(Boolean);
    const best=Math.min(...routes.map(route=>route.distance));return routes.filter(route=>route.distance===best);
  }
  const distributePot=(...args)=>window.PourtyPot.distribute(...args);
  function finishMinigame(state,session,rewards=[]){
    if(state.spaceMinigame){
      if(state.phase!=='minigame-playing')throw Error('Aucun mini-jeu de case en cours.');
      const next=base.finishMinigame(state,session,rewards);next.turn=state.turn;next.round=state.round;next.afterRanking='land-complete';delete next.spaceMinigame;return next;
    }
    if(!state.wager)return base.finishMinigame(state,session,rewards);
    if(state.phase!=='minigame-playing')throw Error('Aucun mini-jeu à mise en cours.');const next=copy(state),payouts=distributePot(next.wager.total,rewards,session.players.length);next.rankingBefore=copy(next.wallets);
    payouts.forEach((amount,id)=>{next.wallets[id].ac+=amount;});
    next.effect={kind:'payout',owner:base.active(next),before:next.rankingBefore,deltas:payouts.map((delta,id)=>({id,resource:'ac',delta})),after:'ranking',pool:next.wager.total};next.afterRanking='land-complete';next.phase='effect-animation';next.minigameId=null;delete next.wager;return next;
  }
  function playedGames(state,session){return [...new Set(Array.isArray(state.playedMinigames)?state.playedMinigames:[])].filter(id=>session.minigameIds.includes(id));}
  function pickMinigame(state,session,random=Math.random){const played=playedGames(state,session),available=session.minigameIds.filter(id=>!played.includes(id)),pool=played.length>session.minigameIds.length/2||!available.length?session.minigameIds:available;return pool[Math.floor(random()*pool.length)];}
  function recordMinigame(state,session,id){const next=copy(state),played=playedGames(state,session);if(session.minigameIds.includes(id)&&!played.includes(id))played.push(id);next.playedMinigames=played.length>session.minigameIds.length/2?[]:played;return next;}
  const custom=['effect-dice','effect-roulette','effect-animation','boo-menu','boo-target','boo-random','land-complete'];
  function restore(raw,session){
    try{
      if(!raw)return null;const mapped=copy(raw),effect=mapped.effect,pass=effect&&['boo','boo-coins','boo-stars'].includes(effect.kind);
      if(custom.includes(mapped.phase))mapped.phase=pass?'pass':'land';
      if(['minigame','minigame-playing'].includes(mapped.phase)&&(mapped.wager||mapped.spaceMinigame))mapped.turn=session.players.length;
      if(mapped.phase==='ranking'&&mapped.afterRanking==='land-complete')mapped.afterRanking='finished';
      const checked=base.restore(mapped,session);if(!checked)return null;
      if(raw.spaceMinigame&&(raw.spaceMinigame!==true||raw.wager||!['minigame','minigame-playing'].includes(raw.phase)||!Number.isInteger(raw.turn)||raw.turn<0||raw.turn>=session.players.length||raw.remaining!==0))return null;
      if(raw.wager){const w=raw.wager;if(![1,5,10,20].includes(w.stake)||!Array.isArray(w.contributions)||w.contributions.length!==session.players.length||w.contributions.some(v=>!Number.isSafeInteger(v)||v<0||v>w.stake)||w.total!==w.contributions.reduce((a,b)=>a+b,0)||raw.turn>=session.players.length||raw.remaining!==0)return null;}
      if(custom.includes(raw.phase)&&raw.phase!=='land-complete'){
        if(!effect||!['blue','red','boubakar','minigame','boo','boo-coins','boo-stars','payout','chance','malchance','luck-double','badluck-double','luck-move'].includes(effect.kind)||effect.owner!==base.active(raw)||!['land-complete','moving','wager-start','ranking'].includes(effect.after))return null;
        if(effect.victim!==undefined&&(!Number.isInteger(effect.victim)||effect.victim<0||effect.victim>=session.players.length||effect.victim===effect.owner))return null;
        if(raw.phase==='effect-animation'&&(!Array.isArray(effect.deltas)||effect.deltas.some(d=>!Number.isInteger(d.id)||d.id<0||d.id>=session.players.length||!['ac','stars'].includes(d.resource)||!Number.isSafeInteger(d.delta))))return null;
      }
      return {...checked,playedMinigames:playedGames(raw,session),phase:raw.phase,turn:raw.turn,afterRanking:raw.afterRanking};
    }catch{return null;}
  }
  window.PourtyBoardEngine=Object.freeze({...base,startEffect,diceFaces,boubakarOptions,planBoubakar,applyEffect,booTargets,chooseBooMode,chooseBooTarget,resolveBooTarget,backBoo,skipBoo,finishEffect,completeLanding,starRoutes,distributePot,pickMinigame,recordMinigame,finishMinigame,restore});
})();
