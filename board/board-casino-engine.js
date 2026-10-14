(() => {
  'use strict';
  const base=window.PourtyBoardEngine,M=window.PourtyBoardModel,copy=M.clone;
  const phases=['casino-intro','casino-stake','casino-paid','casino-player','casino-bank','casino-roulette','casino-roll','casino-result','casino-payout'];
  const sum=values=>values.reduce((a,b)=>a+b,0),red=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const casinoColor=n=>n===0?'green':red.has(n)?'red':'black';
  function requirePhase(s,...allowed){if(!allowed.includes(s.phase)||!s.casino)throw Error('Action de casino indisponible.');}
  function startEffect(s,board,session){
    const n=base.startEffect(s,board,session),node=base.nodeAt(s,board);
    if(s.phase!=='land'||node.type!=='event'||n.phase!=='land-complete')return n;
    if(!['blackjack','roulette'].includes(node.event))return n;
    const owner=base.active(s);n.casino={kind:node.event,owner,player:[],bank:[],stake:0,entryBefore:copy(s.wallets),before:copy(s.wallets),gift:s.wallets[owner].ac===0?5:0};
    n.wallets[owner].ac+=n.casino.gift;n.phase='casino-intro';return n;
  }
  function casinoReady(s){requirePhase(s,'casino-intro');const n=copy(s);n.phase='casino-stake';return n;}
  function casinoBet(s,stake,color){requirePhase(s,'casino-stake');const c=s.casino;
    if(!Number.isSafeInteger(stake)||stake<1||stake>s.wallets[c.owner].ac||stake>Math.floor((Number.MAX_SAFE_INTEGER-s.wallets[c.owner].ac)/36))throw Error('Mise invalide.');
    if(c.kind==='roulette'&&!['red','black','green'].includes(color))throw Error('Choisis une couleur.');
    const n=copy(s);n.casino.stake=stake;n.casino.color=color||null;n.casino.before=copy(n.wallets);n.casino.betBefore=copy(n.wallets);n.wallets[c.owner].ac-=stake;n.phase='casino-paid';return n;
  }
  function casinoBegin(s){requirePhase(s,'casino-paid');const n=copy(s);n.phase=n.casino.kind==='blackjack'?'casino-player':'casino-roulette';return n;}
  function casinoStay(s){requirePhase(s,'casino-player');if(s.casino.player.length<2)throw Error('Lance au moins deux dés.');const n=copy(s);n.phase='casino-bank';return n;}
  function result(n){const c=n.casino;
    c.outcome=c.kind==='roulette'?(casinoColor(c.number)===c.color?'win':'lose'):sum(c.player)>21?'lose':sum(c.bank)>21||sum(c.player)>sum(c.bank)?'win':sum(c.player)===sum(c.bank)?'draw':'lose';
    c.payout=c.outcome==='draw'?c.stake:c.outcome==='win'?c.stake*(c.kind==='roulette'&&c.color==='green'?36:2):0;n.phase='casino-result';return n;
  }
  function casinoRoll(s,value){requirePhase(s,'casino-player','casino-bank','casino-roulette');
    if(!Number.isInteger(value)||value<(s.phase==='casino-roulette'?0:1)||value>(s.phase==='casino-roulette'?36:10))throw Error('Résultat de dé invalide.');
    const n=copy(s),c=n.casino;let after;
    if(s.phase==='casino-roulette'){c.number=value;result(n);after=n.phase;}
    else{const target=s.phase==='casino-player'?'player':'bank';c[target].push(value);const total=sum(c[target]);
      if(target==='player'){if(total>21){result(n);after=n.phase;}else after=total===21?'casino-bank':'casino-player';}
      else if(total>=17){result(n);after=n.phase;}else after='casino-bank';
    }
    c.pending={value,from:s.phase,after};n.phase='casino-roll';return n;
  }
  function casinoReveal(s){requirePhase(s,'casino-roll');const n=copy(s);n.phase=n.casino.pending.after;delete n.casino.pending;return n;}
  function casinoSettle(s){requirePhase(s,'casino-result');const n=copy(s),c=n.casino;c.before=copy(n.wallets);n.wallets[c.owner].ac+=c.payout;n.phase='casino-payout';return n;}
  function casinoBaseline(s){const c=s.casino;if(c.betBefore)return copy(c.betBefore);const wallets=copy(c.before);if(s.phase==='casino-payout')for(const id of window.PourtyTeams.members(s,c.owner))wallets[id].ac+=c.stake;return wallets;}
  function casinoFinish(s,mode='normal'){requirePhase(s,'casino-payout');const n=copy(s),before=n.casino.entryBefore||casinoBaseline(s),T=window.PourtyTeams,oldRanks=T.ranks(s,before,mode),newRanks=T.ranks(s,s.wallets,mode);delete n.casino;
    if(oldRanks.some((rank,id)=>rank!==newRanks[id])){n.rankingBefore=copy(before);n.afterRanking='land-complete';n.phase='ranking';}else n.phase='land-complete';return n;}
  function restore(raw,session){if(!raw?.phase?.startsWith('casino-'))return base.restore(raw,session);try{
    const c=raw.casino;if(!phases.includes(raw.phase)||!c||!M.events[c.kind]||c.owner!==base.active(raw)||!raw.wallets[c.owner])return null;
    if(!['player','bank'].every(k=>Array.isArray(c[k])&&c[k].length<=22&&c[k].every(v=>Number.isInteger(v)&&v>=1&&v<=10)))return null;
    if(!Number.isSafeInteger(c.stake)||c.stake<0||!['casino-intro','casino-stake'].includes(raw.phase)&&c.stake<1||![0,5].includes(c.gift))return null;
    if(!Array.isArray(c.before)||c.before.length!==raw.wallets.length||c.before.some(w=>!w||!Number.isSafeInteger(w.ac)||w.ac<0||!Number.isSafeInteger(w.stars)||w.stars<0))return null;
    for(const field of ['entryBefore','betBefore'])if(c[field]&&(!Array.isArray(c[field])||c[field].length!==raw.wallets.length||c[field].some(w=>!w||!Number.isSafeInteger(w.ac)||w.ac<0||!Number.isSafeInteger(w.stars)||w.stars<0)))return null;
    if(c.kind==='roulette'&&c.stake&&!['red','black','green'].includes(c.color))return null;
    if(c.number!==undefined&&(!Number.isInteger(c.number)||c.number<0||c.number>36))return null;
    if(['casino-result','casino-payout'].includes(raw.phase)||c.pending?.after==='casino-result'){const expected=result(copy(raw)).casino;if(c.payout!==expected.payout||c.outcome!==expected.outcome||!Number.isSafeInteger(c.payout))return null;}
    if(raw.phase==='casino-roll'){const p=c.pending;if(!p||!['casino-player','casino-bank','casino-roulette'].includes(p.from)||!['casino-player','casino-bank','casino-result'].includes(p.after)||!Number.isInteger(p.value)||p.value<(p.from==='casino-roulette'?0:1)||p.value>(p.from==='casino-roulette'?36:10))return null;}
    const checked=base.restore({...copy(raw),phase:'land'},session);return checked?{...checked,phase:raw.phase,casino:copy(c)}:null;
  }catch{return null;}}
  window.PourtyBoardEngine=Object.freeze({...base,startEffect,restore,casinoColor,casinoReady,casinoBet,casinoBegin,casinoStay,casinoRoll,casinoReveal,casinoSettle,casinoBaseline,casinoFinish});
})();
