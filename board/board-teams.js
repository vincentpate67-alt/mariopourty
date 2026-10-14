(() => {
  const clone=v=>JSON.parse(JSON.stringify(v));
  const teams=s=>s.teams||[];
  const team=(s,id)=>teams(s).find(t=>t.members.includes(id));
  const allied=(s,a,b)=>a===b||!!team(s,a)?.members.includes(b);
  const reps=s=>teams(s).length?teams(s).map(t=>t.members[0]):s.wallets.map((_,i)=>i);
  const members=(s,id)=>team(s,id)?.members||[id];
  function mix(players,ids){if(!ids.length)return '#8397cb';return '#'+[1,3,5].map(at=>Math.round(ids.reduce((sum,id)=>sum+parseInt(players[id].color.slice(at,at+2),16),0)/ids.length).toString(16).padStart(2,'0')).join('');}
  function validate(list,count){if(count<2)throw Error('Il faut au moins deux joueurs pour créer des équipes.');if(!Array.isArray(list)||list.length<2||list.length>Math.min(5,count))throw Error('Crée entre 2 et '+Math.min(5,count)+' équipes.');const ids=[];for(const t of list){if(!t||typeof t.name!=='string'||!t.name.trim()||t.name.length>30||!/^#[0-9a-f]{6}$/i.test(t.color)||!Array.isArray(t.members)||!t.members.length||t.members.length>=count)throw Error('Chaque équipe doit avoir un nom, une couleur et au moins un joueur.');ids.push(...t.members);}if(ids.length!==count||new Set(ids).size!==count||ids.some(id=>!Number.isInteger(id)||id<0||id>=count))throw Error('Répartis chaque joueur dans une seule équipe.');}
  function ranks(s,wallets,mode){const ids=reps(s);return wallets.map((w,id)=>1+ids.filter(i=>window.PourtyBoardModel.compareWallets(wallets[i],w,mode)<0).length);}
  function addDisplay(s,wallets,id,resource,delta){for(const member of members(s,id))wallets[member][resource]+=delta;}
  function sync(before,after){if(!before.teams?.length)return after;
    after.teamChanges=after.wallets.map((w,i)=>({ac:w.ac-before.wallets[i].ac,stars:w.stars-before.wallets[i].stars}));
    for(const t of before.teams){const first=t.members[0];for(const resource of ['ac','stars']){const value=before.wallets[first][resource]+t.members.reduce((sum,id)=>sum+after.teamChanges[id][resource],0);for(const id of t.members)after.wallets[id][resource]=value;}
      for(const field of ['inventories','inventoryCaps']){if(!after[field])continue;const changed=t.members.filter(id=>JSON.stringify(after[field][id])!==JSON.stringify(before[field]?.[id]));const value=after[field][changed[0]??first];for(const id of t.members)after[field][id]=clone(value);}
    }return after;
  }
  function stats(s,id){const out={spacesByType:{}};for(const member of members(s,id)){const p=s.statistics.players[member];for(const [key,value]of Object.entries(p)){if(typeof value==='number')out[key]=(out[key]||0)+value;}for(const [type,n]of Object.entries(p.spacesByType||{}))out.spacesByType[type]=(out.spacesByType[type]||0)+n;}return out;}
  window.PourtyTeams={team,allied,reps,members,mix,validate,ranks,addDisplay,sync,stats};
})();
