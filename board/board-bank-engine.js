(() => {
  'use strict';
  const base=window.PourtyBoardEngine,M=window.PourtyBoardModel,T=window.PourtyTeams,copy=M.clone;
  function deposit(name,before,after){
    // Stakes are escrow, not expenses. Player-to-player transfers cancel out
    // in the total; team wallets are counted only once.
    if(name==='casinoBet'||name==='startDuel'||name==='applyEffect'&&before.effect?.kind==='minigame')return 0;
    if(name==='casinoSettle')return Math.max(0,before.casino.stake-before.casino.payout);
    return Math.max(0,T.reps(before).reduce((sum,id)=>sum+before.wallets[id].ac-after.wallets[id].ac,0));
  }
  const wrapped={};for(const [name,fn]of Object.entries(base))if(typeof fn==='function'&&!['create','restore','startEffect'].includes(name))wrapped[name]=(...args)=>{const before=args[0];let after=fn(...args);if(!before?.wallets||!after?.wallets)return after;if(after===before)after=copy(after);after.bankAC=(before.bankAC??0)+deposit(name,before,after);return after;};
  function startEffect(s,board,session){const n=base.startEffect(s,board,session);n.bankAC=(s.bankAC??0)+deposit('startEffect',s,n);const node=base.nodeAt(s,board);if(s.phase==='land'&&node.type==='event'&&node.event==='bank'&&n.phase==='land-complete'){n.phase='bank-offer';n.bankReward={owner:base.active(s)};}return n;}
  function claimBank(s){if(s.phase!=='bank-offer'||!s.bankReward)throw Error('Banque indisponible.');const n=copy(s),r=n.bankReward;r.before=copy(s.wallets);r.amount=s.bankAC??0;n.wallets[r.owner].ac+=r.amount;n.bankAC=0;n.phase='bank-payout';return T.sync(s,n);}
  function finishBank(s,mode='normal'){if(s.phase!=='bank-payout')throw Error('Banque indisponible.');const n=copy(s),before=n.bankReward.before,old=T.ranks(s,before,mode),next=T.ranks(s,s.wallets,mode);delete n.bankReward;n.phase='land-complete';if(old.some((rank,id)=>rank!==next[id])){n.phase='ranking';n.rankingBefore=before;n.afterRanking='land-complete';}return n;}
  function create(...args){return {...base.create(...args),bankAC:0};}
  function restore(raw,session){if(!raw)return null;if(raw.bankAC!==undefined&&(!Number.isSafeInteger(raw.bankAC)||raw.bankAC<0))return null;
    if(!['bank-offer','bank-payout'].includes(raw.phase)){const s=base.restore(raw,session);return s?{...s,bankAC:raw.bankAC??0}:null;}
    try{const r=raw.bankReward;if(!r||r.owner!==base.active(raw)||base.nodeAt(raw,session.board).event!=='bank')return null;
      if(raw.phase==='bank-payout'&&(!Number.isSafeInteger(r.amount)||r.amount<0||raw.bankAC!==0||!Array.isArray(r.before)||r.before.length!==raw.wallets.length||r.before.some(w=>!w||!Number.isSafeInteger(w.ac)||w.ac<0||!Number.isSafeInteger(w.stars)||w.stars<0)))return null;
      const s=base.restore({...copy(raw),phase:'land'},session);return s?{...s,bankAC:raw.bankAC??0,phase:raw.phase,bankReward:copy(r)}:null;
    }catch{return null;}
  }
  window.PourtyBoardEngine=Object.freeze({...base,...wrapped,startEffect,create,restore,claimBank,finishBank});
})();
