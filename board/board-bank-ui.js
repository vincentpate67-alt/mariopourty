(() => {
  window.PourtyBankUI=ctx=>{
    const {engine,pause,canvas}=ctx,get=ctx.getState;let running=false,current=null,target=null,frame=null;
    const panel=document.createElement('section');panel.className='bank-overlay';panel.hidden=true;const content=document.createElement('div'),title=document.createElement('h2'),value=document.createElement('strong');title.textContent='Banque';content.append(title,value);panel.append(content);document.body.append(panel);
    function paint(amount){for(const entry of canvas.decorEntries||[]){if(entry.d.type!=='casino-bank')continue;const label=entry.group.querySelector('[data-bank-amount]');if(!label)continue;const text=Math.round(amount).toLocaleString('fr-FR')+' AC';label.textContent=text;label.setAttribute('font-size',entry.d.size*Math.min(.105,.64/(text.length*.61)));}}
    function updateDecorations(amount){if(current===null){current=target=amount;paint(amount);return;}if(target===amount){paint(current);return;}target=amount;cancelAnimationFrame(frame);const from=current,start=performance.now();for(const entry of canvas.decorEntries||[])if(entry.d.type==='casino-bank')entry.group.querySelector('[data-bank-amount]')?.animate?.([{opacity:.35},{opacity:1}],{duration:650});
      function tick(now){const t=Math.min(1,(now-start)/850);current=from+(target-from)*(1-Math.pow(1-t,3));paint(current);if(t<1&&ctx.alive())frame=requestAnimationFrame(tick);}frame=requestAnimationFrame(tick);
    }
    async function fade(show){if(show===!panel.hidden)return;if(show)panel.hidden=false;const a=panel.animate?.([{opacity:show?0:1},{opacity:show?1:0}],{duration:300,fill:'both'});await pause(300);if(!show)panel.hidden=true;a?.cancel();}
    async function reward(){running=true;const s=get();if(s.phase==='bank-offer'){value.textContent=s.bankAC?s.bankAC.toLocaleString('fr-FR')+' AC':'Banque vide';await fade(true);content.animate?.([{transform:'translateY(15px) scale(.94)'},{transform:'translateY(0) scale(1)'}],{duration:400,easing:'ease-out'});await pause(1200);await fade(false);if(ctx.alive()){running=false;ctx.setState(engine.claimBank(get()));ctx.render();}}
      else{await fade(false);const r=s.bankReward;if(r.amount)await ctx.animateChanges([{id:r.owner,resource:'ac',delta:r.amount}],r.before);if(ctx.alive()){running=false;ctx.setState(engine.finishBank(get(),ctx.session.gameMode));ctx.render();}}
    }
    return {updateDecorations,render(){if(!['bank-offer','bank-payout'].includes(get().phase)){if(!running)panel.hidden=true;return false;}if(!running)reward();return true;}};
  };
})();
