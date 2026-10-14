// Board-only integration. No behavior changes for standalone mini-games.
(() => {
  if (window.parent === window) return;
  const file = location.pathname.split('/').pop().toLowerCase();
  if (file === '../index.html') { document.documentElement.style.visibility = 'hidden'; window.parent.postMessage({ type: 'pourty-minigame-finished' }, '*'); return; }
  let context; try { context = JSON.parse(window.name); } catch { return; }
  if(context?.kind!=='pourty-minigame'||typeof context.token!=='string'||!Array.isArray(context.players)||!context.players.length||context.players.length>6)return;
  if(!context.players.every(p=>p&&typeof p.name==='string'&&/^#[0-9a-f]{6}$/i.test(p.color))||!/^game-\d+\.html$/.test(file))return;
  const notify=(type,extra={})=>window.parent.postMessage({type,token:context.token,...extra},'*'), backups=[];
  for(const[key,value]of [['mini-Jeux-host-players',JSON.stringify(context.players)],['marioPourty','true']]){
    try{backups.push({key,old:localStorage.getItem(key),value});localStorage.setItem(key,value);}catch{notify('pourty-minigame-storage-error');}
  }
  const style=document.createElement('style');style.textContent='#exit-button,#return-btn,.return-btn,#btnReturn,#backBtn,#returnToMenuBtn,#back-btn,#final-back{display:none!important}';document.head.append(style);
  // Read the exact displayed AC rewards after the final ranking has painted.
  // Use roster indices where available; custom result bars are matched by name and color.
  function collectRewards(){
    const found=new Map();
    const color=value=>{const hex=String(value||'').trim().toLowerCase();if(/^#[0-9a-f]{6}$/.test(hex))return hex;const rgb=hex.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);return rgb?'#'+rgb.slice(1,4).map(v=>Number(v).toString(16).padStart(2,'0')).join(''):hex;};
    document.querySelectorAll('.player-pill').forEach(pill=>{
      const badge=pill.querySelector('.ac-badge'),match=badge?.textContent.trim().match(/^\+?(\d+)\s*ac$/i);if(!match&&!context.wager&&!context.duel)return;
      let index=Number(pill.dataset.pourtyPlayerIndex);
      if(!Number.isInteger(index)||index<0||index>=context.players.length){
        const circle=pill.querySelector('.player-circle'),name=(circle?.nextElementSibling||pill.querySelector('span:nth-child(2)'))?.textContent.trim();
        const candidates=context.players.map((p,i)=>({p,i})).filter(({p})=>p.name===name);
        const matching=circle?candidates.filter(({p})=>color(p.color)===color(circle.style.backgroundColor||circle.style.background)):candidates;
        if(matching.length!==1)return;index=matching[0].i;
      }
      pill.dataset.pourtyPlayerIndex=String(index);const ac=match?Number(match[1]):0,rank=Number(pill.dataset.pourtyRank)||Number(pill.querySelector('.rank-badge')?.textContent.match(/\d+/)?.[0])||Number(pill.querySelector('.final-rank')?.textContent.match(/\d+/)?.[0])||undefined;if(Number.isSafeInteger(ac)&&ac>=0&&ac<=100000&&(!found.has(index)||rank))found.set(index,{playerIndex:index,ac,rank});
    });
    return [...found.values()];
  }
  const rewardMultiplier=!context.wager&&!context.duel&&context.rewardMultiplier===2?2:1;
  let potRewards=null;
  function updatePotBadges(){
    if(!context.wager&&!context.duel&&!context.bets?.length&&rewardMultiplier===1)return true;
    if(potRewards)return true;const results=collectRewards(),count=context.players.length;
    if(results.length!==count||results.some(r=>!Number.isInteger(r.rank)||r.rank<1||r.rank>count))return false;
    const amounts=context.duel?results.reduce((out,r)=>{out[r.playerIndex]=r.rank===1?context.duel.total:0;return out;},Array(count).fill(0)):context.wager?window.PourtyPot.distribute(context.wager.total,results,count):results.reduce((out,r)=>{out[r.playerIndex]=r.ac;return out;},Array(count).fill(0));
    // Keep base payouts for the board engine, which applies Gelano exactly once.
    potRewards=results.map(r=>({...r,ac:amounts[r.playerIndex]}));
    const displayed=amounts.map(ac=>ac*rewardMultiplier);if(context.duel?.resource!=='stars')for(const bet of context.bets||[]){if(Number.isInteger(bet.owner)&&Number.isInteger(bet.target)&&bet.owner>=0&&bet.owner<count&&bet.target>=0&&bet.target<count)displayed[bet.owner]+=amounts[bet.target]*rewardMultiplier;}
    document.querySelectorAll('.player-pill').forEach(pill=>{
      let badge=pill.querySelector('.ac-badge');if(!badge){badge=document.createElement('span');badge.className='ac-badge';pill.appendChild(badge);}
      const circle=pill.querySelector('.player-circle'),name=(circle?.nextElementSibling||pill.querySelector('span:nth-child(2)'))?.textContent.trim();
      let index=Number(pill.dataset.pourtyPlayerIndex);
      if(!Number.isInteger(index)){const candidates=context.players.map((p,i)=>({p,i})).filter(({p})=>p.name===name);if(candidates.length!==1)return;index=candidates[0].i;}
      if(index>=0&&index<amounts.length){badge.textContent='+'+displayed[index]+(context.duel?.resource==='stars'?' ★':'ac');badge.title=rewardMultiplier===2?'Pièces ×2'+(context.bets?.some(b=>b.owner===index)?' · Gelano':''):displayed[index]!==amounts[index]?'Gain avec Gelano':context.duel||context.wager?'Part du pot':'Gain du mini-jeu';if(displayed[index]!==amounts[index])badge.animate?.([{opacity:.3,transform:'scale(.75)'},{opacity:1,transform:'scale(1.2)',offset:.5},{opacity:1,transform:'scale(1)'}],{duration:650,easing:'ease-out'});if(badge.style)badge.style.display='inline-block';}
    });
    return true;
  }
  let finished=false,clock=null,frame=null,countdownReady=false,returned=false;
  function returnToBoard(){if(!countdownReady||returned)return;returned=true;clearInterval(clock);clock=null;notify('pourty-minigame-finished',{rewards:potRewards||collectRewards()});}
  window.addEventListener('keydown',event=>{if(event.code==='Space'&&!event.repeat&&countdownReady&&!returned){event.preventDefault();event.stopImmediatePropagation();returnToBoard();}},true);
  function finish(){
    if(finished)return;finished=true;
    // Allow the final score layout to paint before starting the five full seconds.
    frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(function awaitResults(){
      if(!updatePotBadges()){frame=requestAnimationFrame(awaitResults);return;}
      document.querySelectorAll('button').forEach(button=>{if(/^(retour|fermer)/i.test(button.textContent.trim()))button.style.setProperty('display','none','important');});
      const badge=document.createElement('div');badge.id='pourty-score-countdown';badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');
      Object.assign(badge.style,{position:'fixed',top:'16px',right:'16px',zIndex:'2147483647',padding:'12px 18px',background:'rgba(15,24,46,.97)',border:'1px solid rgba(230,204,144,.45)',borderRadius:'12px',color:'#ead5a2',font:'600 14px Segoe UI, sans-serif',boxShadow:'0 5px 24px #0005',pointerEvents:'none'});
      document.body.append(badge);countdownReady=true;let remaining=5;badge.textContent='Retour au plateau dans '+remaining+' s';
      clock=setInterval(()=>{remaining--;if(remaining<=0){returnToBoard();}else badge.textContent='Retour au plateau dans '+remaining+' s';},1000);
    });});
  }
  window.PourtyMiniGame=Object.freeze({finish});
  window.addEventListener('pagehide',()=>{
    clearInterval(clock);cancelAnimationFrame(frame);
    for(const backup of backups){try{if(localStorage.getItem(backup.key)!==backup.value)continue;if(backup.old===null)localStorage.removeItem(backup.key);else localStorage.setItem(backup.key,backup.old);}catch{}}
  });
})();
