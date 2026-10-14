(() => {
  'use strict';
  window.PourtyCasinoUI=ctx=>{
    const {engine,model,players,pause}=ctx,get=ctx.getState,save=ctx.setState;
    let busy=false,chosenColor='red';
    const el=(tag,cls='',text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
    const panel=el('section','casino-overlay');panel.hidden=true;panel.setAttribute('aria-label','Événement casino');
    const content=el('div','casino-content');panel.append(content);document.body.append(panel);
    const total=a=>a.reduce((x,y)=>x+y,0),name=()=> (window.PourtyTeams.team(get(),get().casino.owner)||players[get().casino.owner]).name;
    function button(label,action,disabled=false){const b=el('button','casino-button',label);b.type='button';b.disabled=disabled;b.addEventListener('click',()=>{if(!busy)action();});return b;}
    function update(s){save(s);ctx.render();}
    async function fade(show){if(show===!panel.hidden)return;if(show)panel.hidden=false;const a=panel.animate?.([{opacity:show?0:1},{opacity:show?1:0}],{duration:300,fill:'both',easing:'ease-in-out'});await pause(300);if(!show)panel.hidden=true;a?.cancel();}
    function layout(){const c=get().casino;content.replaceChildren();content.append(el('p','casino-player-name',name()),el('h2','',model.events[c.kind].name));}
    async function transition(){const a=content.animate?.([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});await fade(true);await pause(280);a?.cancel();}
    function colorFace(surface,color){surface.replaceChildren();const dot=el('span','casino-color '+color);surface.append(dot);surface.setAttribute('aria-label',({red:'Rouge',black:'Noir',green:'Vert'})[color]);}
    function die(action,color=false){const b=button('',action),cube=el('span','die-cube');b.className='dice casino-die';b.setAttribute('aria-label','Lancer le dé');for(const [i,side]of ['front','back','right','left','top','bottom'].entries()){const f=el('span','die-face '+side);if(i===0)f.setAttribute('data-die-value','');if(color)colorFace(f,['red','black','green'][i%3]);else f.textContent='?';cube.append(f);}b.append(cube);return b;}
    function scores(hidePending=false){const c=get().casino,table=el('div','casino-scores');for(const [key,label]of [['player',name()],['bank','Banque']]){const values=[...c[key]];if(hidePending&&c.pending?.from==='casino-'+(key==='player'?'player':'bank'))values.pop();const col=el('div','casino-hand');col.append(el('h3','',label));const row=el('div','casino-hand-dice');for(const value of values)row.append(el('span','casino-small-die',value));if(!values.length)row.append(el('span','casino-empty','—'));col.append(row,el('strong',total(values)>21?'bust':'',total(values)));table.append(col);}content.append(table);}
    async function stake(){layout();const c=get().casino,wallet=get().wallets[c.owner].ac,max=Math.min(wallet,Math.floor((Number.MAX_SAFE_INTEGER-wallet)/36));
      const options=el('div','casino-stake-options'),input=el('input');input.type='number';input.min='0';input.max=String(max);input.step='1';input.value='0';input.setAttribute('aria-label','Mise en AC');
      if(c.kind==='roulette'){const row=el('div','casino-bet-colors');for(const [id,title,mult]of [['red','Rouge',2],['black','Noir',2],['green','Vert',36]]){const b=button(title+' ×'+mult,()=>{chosenColor=id;for(const child of row.children)child.setAttribute('aria-pressed',String(child===b));});b.classList.add(id);b.setAttribute('aria-pressed',String(id===chosenColor));row.append(b);}content.append(row);}
      const error=el('p','casino-error'),play=button('Miser et jouer',()=>{try{const next=engine.casinoBet(get(),Number(input.value),chosenColor);busy=true;save(next);fade(false).then(()=>{busy=false;ctx.render();});}catch(e){error.textContent=e.message;}},true);
      input.addEventListener('input',()=>{play.disabled=!Number.isSafeInteger(Number(input.value))||Number(input.value)<1||Number(input.value)>max;});options.append(input,play);content.append(options,error);await transition();input.focus();
    }
    async function table(){layout();const roulette=get().casino.kind==='roulette';if(!roulette)scores();
      const stage=el('div','casino-dice-stage'),b=die(()=>roll(),roulette);stage.append(b);content.append(stage);
      if(!roulette){const actions=el('div','casino-actions');actions.append(button('Rester',()=>update(engine.casinoStay(get())),get().casino.player.length<2));content.append(actions);}
      await transition();
    }
    async function roll(){if(busy)return;const s=get(),value=s.phase==='casino-roulette'?Math.floor(Math.random()*37):1+Math.floor(Math.random()*10);update(engine.casinoRoll(s,value));}
    async function animateRoll(){const c=get().casino,p=c.pending,isRoulette=p.from==='casino-roulette';layout();if(!isRoulette){scores(true);content.append(el('p','casino-help',p.from==='casino-bank'?'La banque lance…':name()+' lance…'));}
      const stage=el('div','casino-dice-stage'),b=die(()=>{},isRoulette);b.disabled=true;stage.append(b);content.append(stage);await fade(true);
      if(isRoulette){const color=engine.casinoColor(p.value);await ctx.animateDie(b,color,Array.from({length:37},(_,n)=>engine.casinoColor(n)),null,[],{face:colorFace,label:({red:'Rouge',black:'Noir',green:'Vert'})[color],result:root=>{root.replaceChildren(el('span','casino-result-color '+color,({red:'Rouge',black:'Noir',green:'Vert'})[color]));}});}
      else await ctx.animateDie(b,p.value,undefined,null,[],null,p.from==='casino-bank'?2:1);
      if(ctx.alive()){busy=false;update(engine.casinoReveal(get()));}
    }
    async function automatic(phase){busy=true;const c=get().casino;
      if(phase==='casino-intro'){busy=false;update(engine.casinoReady(get()));}
      else if(phase==='casino-paid'){busy=false;update(engine.casinoBegin(get()));}
      else if(phase==='casino-bank'){layout();scores();await fade(true);await pause(250);if(ctx.alive()){busy=false;roll();}}
      else if(phase==='casino-roll')await animateRoll();
      else if(phase==='casino-result'){layout();if(c.kind==='blackjack')scores();content.append(el('p','casino-outcome',c.outcome==='win'?'Gagné !':c.outcome==='draw'?'Égalité':'Perdu'));await fade(true);await pause(1100);await fade(false);if(ctx.alive()){busy=false;update(engine.casinoSettle(get()));}}
      else if(phase==='casino-payout'){await fade(false);const before=engine.casinoBaseline(get()),delta=get().wallets[c.owner].ac-before[c.owner].ac;if(delta)await ctx.animateChanges([{id:c.owner,resource:'ac',delta}],before);if(ctx.alive()){ctx.displayWallets(null);busy=false;update(engine.casinoFinish(get(),ctx.session.gameMode));}}

    }
    return {render(){const phase=get().phase;if(!phase.startsWith('casino-')){if(!busy)panel.hidden=true;return false;}if(phase!=='casino-payout'&&get().casino.stake)ctx.displayWallets(engine.casinoBaseline(get()));if(busy)return true;if(phase==='casino-stake'||phase==='casino-player'||phase==='casino-roulette'){busy=true;(phase==='casino-stake'?stake():table()).then(()=>{busy=false;});}else automatic(phase);return true;}};
  };
})();
