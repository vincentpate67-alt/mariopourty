(() => {
  'use strict';
  const base=window.PourtyBoardEngine,M=window.PourtyBoardModel,copy=M.clone;
  const symbols=Object.freeze({cherry:{name:'Pièce jaune',image:'../assets/items/coin.png',hue:0,pays:[2,4,8]},lemon:{name:'Pièce rouge',image:'../assets/items/coin.png',hue:-55,pays:[3,6,10]},bell:{name:'Pièce bleue',image:'../assets/items/coin.png',hue:180,pays:[4,8,15]},coin:{name:'Pièce violette',image:'../assets/items/coin.png',hue:240,pays:[5,10,20]},star:{name:'Étoile',image:'../assets/items/star.png',pays:[5,15,0]}});
  // 100 equally likely tickets: E[AC] = 800/100, P(star) = 5/100.
  const tickets=[[2,5],[3,5],[4,10],[5,13],[6,10],[8,15],[10,20],[15,10],[20,7],['star',5]];
  const choose=(a,r)=>a[Math.min(a.length-1,Math.floor(r()*a.length))];
  function evaluate(grid){if(!Array.isArray(grid)||grid.length!==3||grid.some(row=>!Array.isArray(row)||row.length!==5||row.some(id=>!Object.hasOwn(symbols,id))))throw Error('Grille de machine invalide.');const lines=[];grid.forEach((row,index)=>{let count=1;while(count<5&&row[count]===row[0])count++;if(count>=3)lines.push({row:index,symbol:row[0],count,ac:symbols[row[0]].pays[count-3],stars:row[0]==='star'&&count===5?1:0});});return {lines,ac:lines.reduce((s,l)=>s+l.ac,0),stars:lines.reduce((s,l)=>s+l.stars,0)};}
  function draw(random=Math.random){let ticket=Math.min(99,Math.floor(random()*100)),award;for(const [value,weight]of tickets){ticket-=weight;if(ticket<0){award=value;break;}}
    const partitions={2:[[2]],3:[[3]],4:[[4],[2,2]],5:[[5],[2,3]],6:[[6],[3,3],[2,2,2]],8:[[8],[4,4],[3,5],[2,3,3]],10:[[10],[5,5],[2,3,5]],15:[[15],[5,10],[5,5,5]],20:[[20],[10,10],[5,5,10]]};
    const keys=Object.keys(symbols),grid=Array.from({length:3},()=>Array.from({length:5},()=>choose(keys,random)));
    // Non-winning filler cannot accidentally alter the advertised reward.
    for(const row of grid)if(row[0]===row[1]&&row[1]===row[2])row[2]=choose(keys.filter(k=>k!==row[0]),random);
    const rows=[0,1,2];for(let i=2;i>0;i--){const j=Math.floor(random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
    const parts=award==='star'?['star']:choose(partitions[award],random);
    parts.forEach((amount,index)=>{const variants=[];for(const [id,def]of Object.entries(symbols))for(let n=3;n<=5;n++)if(amount==='star'?id==='star'&&n===5:!(id==='star'&&n===5)&&def.pays[n-3]===amount)variants.push([id,n]);const [id,n]=choose(variants,random),row=grid[rows[index]];for(let j=0;j<n;j++)row[j]=id;if(n<5)row[n]=choose(keys.filter(k=>k!==id),random);});
    return {grid,...evaluate(grid)};
  }
  function need(s,phase){if(s.phase!==phase||!s.slots)throw Error('Machine indisponible.');}
  function startEffect(s,board,session){if(s.phase!=='pass'||base.nodeAt(s,board).type!=='slots')return base.startEffect(s,board,session);const n=copy(s);n.slots={owner:base.active(s)};n.phase='slots-menu';return n;}
  function spinSlots(s,random=Math.random){need(s,'slots-menu');const n=copy(s);Object.assign(n.slots,draw(random));n.phase='slots-spin';return n;}
  function revealSlots(s){need(s,'slots-spin');const n=copy(s);n.phase='slots-result';return n;}
  function settleSlots(s){need(s,'slots-result');const n=copy(s),f=n.slots;f.before=copy(s.wallets);n.wallets[f.owner].ac+=f.ac;n.wallets[f.owner].stars+=f.stars;n.phase='slots-payout';return n;}
  function finishSlots(s,mode='normal'){need(s,'slots-payout');const n=copy(s),T=window.PourtyTeams,before=n.slots.before,a=T.ranks(s,before,mode),b=T.ranks(s,s.wallets,mode);delete n.slots;n.phase='moving';if(a.some((rank,id)=>rank!==b[id])){n.rankingBefore=before;n.afterRanking='moving';n.phase='ranking';}return n;}
  function restore(raw,session){if(!raw?.phase?.startsWith('slots-'))return base.restore(raw,session);try{if(!['slots-menu','slots-spin','slots-result','slots-payout'].includes(raw.phase)||raw.slots?.owner!==base.active(raw)||base.nodeAt(raw,session.board).type!=='slots'||raw.remaining<1)return null;const f=raw.slots;if(raw.phase!=='slots-menu'){const outcome=evaluate(f.grid);if(f.ac!==outcome.ac||f.stars!==outcome.stars||JSON.stringify(f.lines)!==JSON.stringify(outcome.lines)||f.stars>1||(!f.stars&&!f.ac))return null;}
    if(raw.phase==='slots-payout'&&(!Array.isArray(f.before)||f.before.length!==raw.wallets.length||f.before.some(w=>!w||!Number.isSafeInteger(w.ac)||w.ac<0||!Number.isSafeInteger(w.stars)||w.stars<0)))return null;
    const checked=base.restore({...copy(raw),phase:'pass'},session);return checked?{...checked,phase:raw.phase,slots:copy(f)}:null;}catch{return null;}}
  window.PourtyBoardEngine=Object.freeze({...base,startEffect,restore,slotSymbols:symbols,evaluateSlots:evaluate,drawSlots:draw,spinSlots,revealSlots,settleSlots,finishSlots});
})();
