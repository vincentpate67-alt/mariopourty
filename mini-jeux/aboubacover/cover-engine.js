(() => {
  'use strict';
  const shuffle=(list,random=Math.random)=>{const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  function create(players,options,entry,random=Math.random){
    const n=players.length,k=options.undercovers;
    if(n<3||n>20||!Number.isInteger(k)||k<1||k>=n||!Number.isInteger(options.rounds)||options.rounds<1||options.rounds>10)throw Error('Paramètres invalides.');
    const ids=players.map((_,i)=>i),roles=shuffle(ids,random);
    return {players:players.map(p=>({...p})),options:{...options},entry:{...entry},undercoverIds:roles.slice(0,k),roleOrder:shuffle(ids,random),words:[],votes:Array(n).fill(null)};
  }
  function vote(game,id,targets){
    if(!Number.isInteger(id)||!game.players[id]||game.votes[id]!==null||targets.length!==game.options.undercovers||new Set(targets).size!==targets.length||targets.some(t=>!Number.isInteger(t)||!game.players[t]||t===id))throw Error('Vote invalide.');
    game.votes[id]=[...targets];
  }
  function score(game){
    if(game.votes.some(v=>v===null))throw Error('Les votes ne sont pas terminés.');
    const spies=new Set(game.undercoverIds),civilians=game.players.map((_,i)=>i).filter(i=>!spies.has(i));
    const rows=game.players.map((player,id)=>{
      const undercover=spies.has(id),hits=game.votes[id].filter(t=>spies.has(t)).length,caughtBy=civilians.filter(i=>game.votes[i].includes(id)).length;
      const points=Math.round(100*(undercover?1-caughtBy/civilians.length:hits/spies.size));
      return {id,player,undercover,hits,caughtBy,points};
    }).sort((a,b)=>b.points-a.points||a.id-b.id);
    rows.forEach((r,i)=>r.rank=i&&rows[i-1].points===r.points?rows[i-1].rank:i+1);return rows;
  }
  window.AboubaCover={shuffle,create,vote,score};
})();
