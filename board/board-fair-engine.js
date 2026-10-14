(() => {
  'use strict';
  const base=window.PourtyBoardEngine,M=window.PourtyBoardModel,copy=M.clone;
  const cost=s=>5*(base.priceMultiplier?.(s)||1);
  function magicPositions(positions,random=Math.random){
    if(positions.length<2)return [...positions];
    let best=-1,candidates=[];
    function visit(order,used){if(order.length===positions.length){const score=order.reduce((n,id,i)=>n+(positions[id]!==positions[i]),0);if(score>best){best=score;candidates=[];}if(score===best)candidates.push(order.map(id=>positions[id]));return;}for(let i=0;i<positions.length;i++)if(!used.has(i)&&i!==order.length){used.add(i);visit([...order,i],used);used.delete(i);}}
    visit([],new Set());return candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
  }
  function create(session,random=Math.random){const s=base.create(session,random),nodes=session.board.nodes.filter(n=>n.type==='blue').map(n=>n.id);for(let i=nodes.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[nodes[i],nodes[j]]=[nodes[j],nodes[i]];}s.hiddenBlockNodes=session.hiddenBlocks===false?[]:nodes.slice(0,Math.min(nodes.length,session.hiddenBlockCount??1));return s;}
  function claimHiddenBlock(state){if(state.phase!=='fair-hidden'||state.fair?.kind!=='hidden'||!state.hiddenBlockNodes?.includes(state.fair.node))throw Error('Block déjà découvert.');const n=copy(state),f=n.fair,before=copy(n.wallets),resource=f.reward===1?'stars':'ac';n.hiddenBlockNodes=n.hiddenBlockNodes.filter(id=>id!==f.node);n.wallets[f.owner][resource]+=f.reward;n.objectVisual={kind:'wallet',owner:f.owner,before,deltas:[{id:f.owner,resource,delta:f.reward}],ranking:true};n.objectReturn='land-complete';n.phase='object-animation';delete n.fair;return n;}
  function startEffect(s,board,session){
    const node=base.nodeAt(s,board),owner=base.active(s);let n=copy(s);
    if(s.phase==='pass'&&node.type==='lucky-box'){
      if(s.round>=session.turns||s.wallets[owner].ac<cost(s)||!M.normalizeLuckyItems(node.luckyItems).length){n.phase='moving';return n;}
      n.fair={kind:'lucky',owner,node:node.id,cost:cost(s),items:M.normalizeLuckyItems(node.luckyItems)};n.phase='fair-lucky';return n;
    }
    if(s.phase==='pass'&&node.type==='zipline'){
      n.fair={kind:'zipline',owner,from:node.id,to:board.startId,after:'moving'};n.phase='fair-travel';return n;
    }
    if(s.phase==='land'&&node.type==='event'&&['ferris-wheel','magic-show','roller-coaster'].includes(node.event)){n=base.startEffect(s,board,session);if(n.phase!=='land-complete')return n;}
    if(s.phase==='land'&&node.type==='event'&&node.event==='ferris-wheel'){
      if(!node.wheelTarget)return n;
      const to=board.nodes.find(p=>p.id===node.wheelTarget&&p.id!==node.id&&p.event==='ferris-wheel'&&p.type==='event');
      if(!to)throw Error('Relie cette grande roue à une autre dans l’éditeur.');
      n.fair={kind:'wheel',owner,from:node.id,to:to.id,after:'land-complete'};n.phase='fair-travel';return n;
    }
    if(s.phase==='land'&&node.type==='event'&&node.event==='roller-coaster'){const to=board.nodes.find(p=>p.id===node.coasterTarget&&p.id!==node.id);if(!to)throw Error('Choisis une case d’arrivée dans l’éditeur.');n.fair={kind:'coaster',owner,from:node.id,to:to.id,after:'land-complete'};n.phase='fair-travel';return n;}
    if(s.phase==='land'&&node.type==='event'&&node.event==='magic-show'){
      n.fair={kind:'magic',owner,before:[...s.positions],positions:magicPositions(s.positions)};n.phase='fair-magic';return n;
    }
    const result=base.startEffect(s,board,session);if(s.phase==='land'&&node.type==='blue'&&s.hiddenBlockNodes?.includes(node.id)&&result.phase==='effect-dice'&&result.effect?.kind==='blue'){delete result.effect;result.fair={kind:'hidden',owner,node:node.id,reward:[5,10,15,20,25,30,1][Math.floor(Math.random()*7)]};result.phase='fair-hidden';}return result;
  }
  function answerLucky(s,buy,random=Math.random){
    if(s.phase!=='fair-lucky')throw Error('Lucky box indisponible.');const n=copy(s);
    if(!buy){n.phase='moving';delete n.fair;return n;}
    const t=n.fair;if(n.wallets[t.owner].ac<t.cost)throw Error('AC insuffisants.');t.before=copy(s.wallets);n.wallets[t.owner].ac-=t.cost;t.itemId=t.items[Math.min(t.items.length-1,Math.floor(random()*t.items.length))];n.phase='fair-lucky-roll';return n;
  }
  function finishLucky(s,itemId=s.fair?.itemId){
    if(s.phase!=='fair-lucky-roll'||!s.fair.items.includes(itemId))throw Error('Objet indisponible.');const n=copy(s),owner=n.fair.owner;delete n.fair;n.phase='gift-roll';const result=base.giveItem(n,owner,itemId);result.gift.after='moving';return result;
  }
  function finishFairTravel(s){if(s.phase!=='fair-travel')throw Error('Trajet indisponible.');const n=copy(s);n.positions[n.fair.owner]=n.fair.to;n.phase=n.fair.after;n.target=null;delete n.fair;return n;}
  function finishMagic(s){if(s.phase!=='fair-magic')throw Error('Magie indisponible.');const n=copy(s);n.positions=[...n.fair.positions];n.phase='land-complete';n.target=null;delete n.fair;return n;}
  function finishItem(state,session){const action=state.itemAction,n=base.finishItem(state,session);if(action?.itemId!=='pebble')return n;n.fair={kind:'rock',owner:action.owner,itemId:'pebble',amount:1+Math.floor(Math.random()*3),openClicks:0};n.phase='fair-rock';return n;}
  function finishRock(state){if(state.phase!=='fair-rock'||state.fair?.kind!=='rock'||state.fair.openClicks!==3)throw Error('Casse d’abord le caillou.');const n=copy(state),f=n.fair,before=copy(n.wallets);n.wallets[f.owner].ac+=f.amount;n.objectVisual={kind:'wallet',owner:f.owner,before,deltas:[{id:f.owner,resource:'ac',delta:f.amount}]};n.objectReturn='turn';n.phase='object-animation';delete n.fair;return n;}
  function restore(raw,session){
    if(raw?.hiddenBlockNodes!==undefined&&(!Array.isArray(raw.hiddenBlockNodes)||new Set(raw.hiddenBlockNodes).size!==raw.hiddenBlockNodes.length||raw.hiddenBlockNodes.some(id=>!session.board.nodes.some(n=>n.id===id&&n.type==='blue'))))return null;
    if(!raw?.phase?.startsWith('fair-'))return base.restore(raw,session);
    try{const f=raw.fair,owner=base.active(raw),node=session.board.nodes.find(n=>n.id===raw.positions[owner]);if(!f||f.owner!==owner||!node)return null;
      if(raw.phase==='fair-hidden'){if(f.kind!=='hidden'||node.type!=='blue'||f.node!==node.id||!raw.hiddenBlockNodes?.includes(node.id)||![1,5,10,15,20,25,30].includes(f.reward))return null;const restored=base.restore({...copy(raw),phase:'land'},session);return restored?{...restored,phase:raw.phase}:null;}
      if(raw.phase==='fair-rock'){if(f.kind!=='rock'||f.itemId!=='pebble'||!Number.isInteger(f.amount)||f.amount<1||f.amount>3||!Number.isInteger(f.openClicks)||f.openClicks<0||f.openClicks>3)return null;const restored=base.restore({...copy(raw),phase:'turn'},session);return restored?{...restored,phase:raw.phase}:null;}
      if(['fair-lucky','fair-lucky-roll'].includes(raw.phase)){if(f.kind!=='lucky'||node.type!=='lucky-box'||f.node!==node.id||!Number.isSafeInteger(f.cost)||f.cost<5||!Array.isArray(f.items)||!f.items.length||f.items.some(id=>!M.items[id]))return null;if(raw.phase==='fair-lucky-roll'&&(!f.items.includes(f.itemId)||!Array.isArray(f.before)||f.before.length!==raw.wallets.length||f.before.some(w=>!Number.isSafeInteger(w.ac)||w.ac<0||!Number.isSafeInteger(w.stars)||w.stars<0)))return null;}
      else if(raw.phase==='fair-travel'){if(f.from!==node.id||!session.board.nodes.some(n=>n.id===f.to))return null;if(f.kind==='zipline'){if(node.type!=='zipline'||f.to!==session.board.startId||f.after!=='moving')return null;}else if(f.kind==='coaster'){if(node.type!=='event'||node.event!=='roller-coaster'||node.coasterTarget!==f.to||f.to===f.from||f.after!=='land-complete')return null;}else if(f.kind!=='wheel'||node.event!=='ferris-wheel'||node.wheelTarget!==f.to||f.to===f.from||!session.board.nodes.some(n=>n.id===f.to&&n.type==='event'&&n.event==='ferris-wheel')||f.after!=='land-complete')return null;}
      else if(raw.phase==='fair-magic'){if(f.kind!=='magic'||node.event!=='magic-show'||!Array.isArray(f.positions)||!Array.isArray(f.before)||JSON.stringify(f.before)!==JSON.stringify(raw.positions)||JSON.stringify([...f.positions].sort())!==JSON.stringify([...raw.positions].sort()))return null;}
      else return null;
      const mapped=base.restore({...copy(raw),phase:node.countsAsStep?'land':'pass'},session);return mapped?{...mapped,phase:raw.phase,fair:copy(f)}:null;
    }catch{return null;}
  }
  window.PourtyBoardEngine=Object.freeze({...base,create,claimHiddenBlock,startEffect,answerLucky,finishLucky,finishFairTravel,finishMagic,magicPositions,finishItem,finishRock,restore});
})();
