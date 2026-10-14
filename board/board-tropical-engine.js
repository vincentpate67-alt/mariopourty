(() => {
  'use strict';
  const base=window.PourtyBoardEngine,M=window.PourtyBoardModel,copy=M.clone;
  const fishing=node=>node?.type==='event'&&['fishing-items','fishing-treasure'].includes(node.event);
  const choose=(list,random=Math.random)=>list[Math.min(list.length-1,Math.floor(random()*list.length))];
  function chestNode(board,previous,random){const all=board.nodes.filter(n=>n.countsAsStep);return choose(all.filter(n=>n.id!==previous).length?all.filter(n=>n.id!==previous):all,random)?.id||null;}
  function chest(board,round=1,previous=null,random=Math.random){return {node:chestNode(board,previous,random),amount:5,round,pending:true};}
  function create(session,random){const s=base.create(session,random);s.fishingSpots={};if(session.board.treasureEnabled)s.treasure=chest(session.board,1,null,random);return s;}
  function finishRoundIntro(s,session){const n=base.finishRoundIntro(s,session);if(n.treasure?.node&&!n.treasure.waiting&&n.round>n.treasure.round){const deposit=5*(n.round-n.treasure.round);n.treasure.amount+=deposit;n.treasure.round=n.round;if(!n.treasure.pending){n.tropical={kind:'chest-fill',owner:base.active(n),after:n.phase,deposit};n.phase='tropical-fill';}}return n;}
  function finishTreasureFill(s){if(s.phase!=='tropical-fill')throw Error('Coffre indisponible.');const n=copy(s);n.phase=n.tropical.after;delete n.tropical;return n;}
  function completeLanding(s,session){if(s.phase==='land-complete'&&s.treasure?.waiting){const n=copy(s);n.treasure=chest(session.board,s.round,s.treasure.previous);n.tropical={kind:'chest-intro',owner:base.active(s),after:'land-complete'};n.phase='tropical-intro';return n;}return base.completeLanding(s,session);}
  function beginTreasureIntro(s){if(s.phase!=='turn'||!s.treasure?.pending)throw Error('Coffre indisponible.');const n=copy(s);n.tropical={kind:'chest-intro',owner:base.active(s),after:'turn'};n.phase='tropical-intro';return n;}
  function finishTreasureIntro(s){if(s.phase!=='tropical-intro')throw Error('Coffre indisponible.');const n=copy(s);n.treasure.pending=false;n.phase=n.tropical.after||'turn';delete n.tropical;return n;}
  function arrive(s,board){const n=base.arrive(s,board);if(!n.treasure?.collected&&n.treasure?.node===n.positions[base.active(n)]){n.tropical={kind:'chest',owner:base.active(n),after:n.phase,node:n.treasure.node,amount:n.treasure.amount};n.phase='tropical-chest';}return n;}
  function claimTreasure(s,board,random=Math.random){if(s.phase!=='tropical-chest'||s.tropical?.kind!=='chest')throw Error('Coffre indisponible.');const n=copy(s),t=n.tropical;t.before=copy(s.wallets);n.wallets[t.owner].ac+=t.amount;n.treasure.collected=true;n.phase='tropical-chest-paid';return n;}
  function finishTreasure(s){if(s.phase!=='tropical-chest-paid')throw Error('Coffre indisponible.');const n=copy(s);n.treasure={node:null,previous:n.tropical.node,amount:5,round:s.round,pending:false,waiting:true};n.phase=n.tropical.after;delete n.tropical;return n;}
  function newFishingStock(s,session,node,random=Math.random){
    const rewards=node.event==='fishing-treasure'?[1,5,10,15].map(amount=>({kind:'ac',amount})).concat({kind:'stars',amount:1}):M.normalizeFishingItems(node.fishingItems).map(itemId=>({kind:'item',itemId}));
    for(let i=rewards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rewards[i],rewards[j]]=[rewards[j],rewards[i]];}
    return rewards;
  }
  function startEffect(s,board,session){
    const node=base.nodeAt(s,board);
    if(s.phase==='pass'&&node.type==='port'){
      const n=copy(s),to=board.nodes.find(p=>p.id===node.portTarget&&p.type==='port'&&p.id!==node.id);
      const cost=3;if(!to||n.wallets[base.active(n)].ac<cost){n.phase='moving';return n;}
      n.tropical={kind:'port',owner:base.active(n),from:node.id,to:to.id,cost};n.phase='tropical-port';return n;
    }
    const n=base.startEffect(s,board,session);
    if(s.phase==='land'&&fishing(node)&&n.phase==='land-complete'){
      n.fishingSpots ||= {};if(!n.fishingSpots[node.id]?.some(Boolean))n.fishingSpots[node.id]=newFishingStock(n,session,node);
      n.tropical={kind:'fish',owner:base.active(n),node:node.id};n.phase='tropical-fishing';
    }
    return n;
  }
  function answerPort(s,buy){if(s.phase!=='tropical-port')throw Error('Port indisponible.');const n=copy(s);if(!buy){n.phase='moving';delete n.tropical;return n;}const t=n.tropical;const cost=t.cost??3;if(n.wallets[t.owner].ac<cost)throw Error('AC insuffisants.');t.before=copy(s.wallets);n.wallets[t.owner].ac-=cost;n.phase='tropical-voyage';return n;}
  function finishVoyage(s){if(s.phase!=='tropical-voyage')throw Error('Voyage indisponible.');const n=copy(s);n.positions[n.tropical.owner]=n.tropical.to;n.target=null;n.phase='moving';delete n.tropical;return n;}
  function selectFishing(s,index){if(s.phase!=='tropical-fishing'||!Number.isInteger(index)||!s.fishingSpots?.[s.tropical.node]?.[index])throw Error('Canne indisponible.');const n=copy(s);n.tropical.index=index;n.tropical.reward=copy(n.fishingSpots[n.tropical.node][index]);n.phase='tropical-fish-reveal';return n;}
  function claimFishing(s){if(s.phase!=='tropical-fish-reveal')throw Error('Prise indisponible.');const n=copy(s),t=n.tropical,r=t.reward;t.before=copy(s.wallets);n.fishingSpots[t.node][t.index]=null;if(r.kind==='stars'||!n.fishingSpots[t.node].some(Boolean))delete n.fishingSpots[t.node];if(r.kind==='ac'||r.kind==='stars')n.wallets[t.owner][r.kind]+=r.amount;n.phase='tropical-fish-paid';return n;}
  function finishFishing(s){if(s.phase!=='tropical-fish-paid')throw Error('Prise indisponible.');const n=copy(s),t=n.tropical;delete n.tropical;if(t.reward.kind==='item'){n.phase='gift-roll';return base.giveItem(n,t.owner,t.reward.itemId);}n.phase='land-complete';if(t.reward.kind==='stars'){n.rankingBefore=t.before;n.afterRanking='land-complete';n.phase='ranking';}return n;}

  function previewTravel(state,board,from,first,remaining,boat=false){
    const nodes=new Map(board.nodes.map(n=>[n.id,n])),seen=new Map(),found=new Set(),routeNodes=new Set([from]),edges=new Set(),boats=new Set();
    const funds=state.wallets[base.active(state)].ac-(boat?3:0),queue=[[first,remaining,funds,boat]];
    (boat?boats:edges).add(from+'>'+first);
    while(queue.length){
      const [id,steps,ac,skipPort]=queue.shift(),node=nodes.get(id);if(!node||ac<0)continue;
      const left=steps-(node.countsAsStep?1:0),key=id+':'+left+':'+skipPort;
      if(left<0||(seen.has(key)&&seen.get(key)>=ac))continue;seen.set(key,ac);routeNodes.add(id);
      if(node.type==='port')found.add(id);
      if(left===0&&node.countsAsStep){found.add(id);continue;}
      if(node.type==='zipline'){edges.add(id+'>'+board.startId);queue.push([board.startId,left+1,ac,false]);continue;}
      for(const next of base.exits(board,id)){edges.add(id+'>'+next);queue.push([next,left,ac,false]);}

    }
    return {nodes:[...routeNodes],edges:[...edges],boatEdges:[...boats],landings:board.nodes.filter(n=>found.has(n.id)).map(n=>n.id)};
  }

  function starRoutes(state,board){
    const from=base.nodeAt(state,board).id;
    if(!state.starVisible||!state.starNode||state.starNode===from)return [];
    const nodes=new Map(board.nodes.map(n=>[n.id,n])),budget=Math.min(state.wallets[base.active(state)].ac,board.nodes.length*6);
    const choices=base.exits(board,from).map(id=>({id,boat:false}));
    if(state.phase==='tropical-port')choices.push({id:state.tropical.to,boat:true});
    function distance(first,boat){
      const queue=[{id:first,ac:budget-(boat?3:0),skip:boat,d:nodes.get(first)?.countsAsStep?1:0}],seen=new Map();
      while(queue.length){
        queue.sort((a,b)=>a.d-b.d);const p=queue.shift(),node=nodes.get(p.id);if(!node||p.id===from||p.ac<0)continue;
        const key=p.id+':'+p.skip,prior=seen.get(key)||[];
        if(prior.some(v=>v.d<=p.d&&v.ac>=p.ac))continue;
        seen.set(key,prior.filter(v=>!(p.d<=v.d&&p.ac>=v.ac)).concat(p));
        if(p.id===state.starNode)return p.d+1;
        if(node.type==='zipline'){queue.push({id:board.startId,ac:p.ac,skip:false,d:p.d});continue;}
        for(const id of base.exits(board,p.id))queue.push({id,ac:p.ac,skip:false,d:p.d+(nodes.get(id)?.countsAsStep?1:0)});
        if(node.type==='port'&&!p.skip&&p.ac>=3&&nodes.get(node.portTarget)?.type==='port'&&node.portTarget!==p.id)
          queue.push({id:node.portTarget,ac:p.ac-3,skip:true,d:p.d});
      }
      return Infinity;
    }
    const routes=choices.map(r=>({...r,distance:distance(r.id,r.boat)})).filter(r=>Number.isFinite(r.distance));
    const best=Math.min(...routes.map(r=>r.distance));return routes.filter(r=>r.distance===best);
  }

  function travelShortest(board,from,to){
    const nodes=new Map(board.nodes.map(n=>[n.id,n]));if(!nodes.has(from)||!nodes.has(to))return null;
    const queue=[{id:from,skip:false,distance:0,cost:0,path:[from],boatEdges:[]}],seen=new Set();
    while(queue.length){
      queue.sort((a,b)=>a.distance-b.distance||a.cost-b.cost);
      const p=queue.shift(),key=p.id+':'+p.skip;if(seen.has(key))continue;seen.add(key);
      if(p.id===to)return {distance:p.distance,cost:p.cost,path:p.path,boatEdges:p.boatEdges};
      const node=nodes.get(p.id);
      if(node.type==='zipline'){queue.push({...p,id:board.startId,skip:false,path:p.path.concat(board.startId)});continue;}
      for(const id of base.exits(board,p.id)){if(!nodes.has(id))continue;queue.push({...p,id,skip:false,distance:p.distance+(nodes.get(id).countsAsStep?1:0),path:p.path.concat(id)});}
      if(node.type==='port'&&!p.skip&&nodes.get(node.portTarget)?.type==='port'&&node.portTarget!==p.id)
        queue.push({...p,id:node.portTarget,skip:true,cost:p.cost+3,path:p.path.concat(node.portTarget),boatEdges:p.boatEdges.concat([[p.id,node.portTarget]])});
    }
    return null;
  }
  function restore(raw,session){
    if(!raw)return null;
    try{
      const mapped=copy(raw),phase=raw.phase,t=raw.tropical,custom=phase.startsWith('tropical-');
      const phases=['tropical-intro','tropical-fill','tropical-chest','tropical-chest-paid','tropical-port','tropical-voyage','tropical-fishing','tropical-fish-reveal','tropical-fish-paid'];
      const node=id=>session.board.nodes.find(n=>n.id===id),wallets=ws=>Array.isArray(ws)&&ws.length===raw.wallets.length&&ws.every(w=>Number.isSafeInteger(w.ac)&&w.ac>=0&&Number.isSafeInteger(w.stars)&&w.stars>=0);
      const reward=r=>r&&(r.kind==='item'?!!M.items[r.itemId]:r.kind==='stars'?r.amount===1:r.kind==='ac'&&[1,5,10,15].includes(r.amount));
      if(raw.treasure&&(!session.board.treasureEnabled||!(raw.treasure.waiting?raw.treasure.node===null&&!!node(raw.treasure.previous):node(raw.treasure.node)?.countsAsStep)||!Number.isSafeInteger(raw.treasure.amount)||raw.treasure.amount<5||!Number.isInteger(raw.treasure.round)||raw.treasure.round<1||raw.treasure.round>raw.round))return null;
      if(raw.fishingSpots&&(typeof raw.fishingSpots!=='object'||Array.isArray(raw.fishingSpots)||Object.entries(raw.fishingSpots).some(([id,stock])=>!fishing(node(id))||!Array.isArray(stock)||stock.length!==5||stock.some(r=>r!==null&&!reward(r)))))return null;
      if(custom){
        if(!phases.includes(phase)||!t||t.owner!==base.active(raw))return null;
        if(phase==='tropical-intro'){if(t.kind!=='chest-intro'||!raw.treasure?.pending||!['turn','land-complete'].includes(t.after||'turn'))return null;mapped.phase=t.after||'turn';}
        else if(phase==='tropical-fill'){if(t.kind!=='chest-fill'||!raw.treasure?.node||!['turn','star-reveal','late-intro'].includes(t.after)||!Number.isSafeInteger(t.deposit)||t.deposit<5)return null;mapped.phase=t.after;}
        else if(phase.startsWith('tropical-chest')){if(t.kind!=='chest'||!node(t.node)||!Number.isSafeInteger(t.amount)||t.amount<5||!['moving','land','object-task','object-animation','stolen-choice','trap-clear'].includes(t.after))return null;mapped.phase=t.after;}
        else if(['tropical-port','tropical-voyage'].includes(phase)){if(t.kind!=='port'||node(t.from)?.type!=='port'||node(t.to)?.type!=='port'||node(t.from).portTarget!==t.to||t.from===t.to||!Number.isSafeInteger(t.cost??3)||(t.cost??3)<3||raw.positions[t.owner]!==t.from)return null;mapped.phase='pass';}
        else{if(t.kind!=='fish'||!fishing(node(t.node))||raw.positions[t.owner]!==t.node)return null;if(phase!=='tropical-fishing'&&(!Number.isInteger(t.index)||t.index<0||t.index>4||!reward(t.reward)))return null;mapped.phase='land';}
        if(['tropical-chest-paid','tropical-voyage','tropical-fish-paid'].includes(phase)&&!wallets(t.before))return null;
      }
      const s=base.restore(mapped,session);if(!s)return null;s.fishingSpots=copy(raw.fishingSpots||{});if(session.board.treasureEnabled)s.treasure=copy(raw.treasure||chest(session.board,raw.round));if(custom){s.phase=phase;s.tropical=copy(t);if(phase==='tropical-intro')s.tropical.after||='turn';if(phase==='tropical-chest-paid')s.treasure={...s.treasure,node:t.node,amount:t.amount,collected:true,pending:false};}return s;
    }catch{return null;}
  }
  window.PourtyBoardEngine=Object.freeze({...base,travelShortest,starRoutes,previewTravel,create,finishRoundIntro,completeLanding,finishTreasureFill,startEffect,arrive,restore,beginTreasureIntro,finishTreasureIntro,claimTreasure,finishTreasure,answerPort,finishVoyage,selectFishing,claimFishing,finishFishing});
})();
