(() => {
  const records=new WeakMap();
  function reveal(root,key='',children=''){
    if(!root||root.hidden)return;const old=records.get(root);if(old?.key===key)return;
    old?.animations.forEach(a=>a.cancel());if(old?.frame)cancelAnimationFrame(old.frame);
    const entry={key,animations:[],frame:0};records.set(root,entry);
    entry.frame=requestAnimationFrame(()=>{entry.frame=0;if(root.hidden)return;
      const content=root.querySelector('.event-content,.shop-content,.dice-content')||root;
      entry.animations.push(content.animate([{opacity:0,translate:'0 10px'},{opacity:1,translate:'0 0'}],{duration:300,easing:'cubic-bezier(.22,1,.36,1)'}));
      if(children)[...root.querySelectorAll(children)].slice(0,12).forEach((child,i)=>{const opacity=Number.parseFloat(getComputedStyle(child).opacity);entry.animations.push(child.animate([{opacity:0,translate:'0 6px'},{opacity:Number.isFinite(opacity)?opacity:1,translate:'0 0'}],{duration:260,delay:Math.min(i*30,150),easing:'ease-out',fill:'backwards'}));});
    });
  }
  function reset(root){const old=records.get(root);old?.animations.forEach(a=>a.cancel());if(old?.frame)cancelAnimationFrame(old.frame);records.delete(root);}
  window.PourtyMenuMotion={reveal,reset};
  const observed=['dice-panel','player-actions','map-controls','item-tooltip','developer-panel','trap-prompt'];
  for(const id of [...observed,'event-overlay','shop-layer','object-panel']){const root=document.getElementById(id);if(!root)continue;let hidden=root.hidden;new MutationObserver(()=>{if(hidden===root.hidden)return;hidden=root.hidden;if(hidden)reset(root);else if(observed.includes(id))reveal(root,'visible');}).observe(root,{attributes:true,attributeFilter:['hidden']});}
  document.querySelectorAll('#players-menu,.developer-menu').forEach(details=>{
    const summary=details.querySelector('summary');let animation=null,wanted=details.open;
    summary.addEventListener('click',event=>{event.preventDefault();wanted=animation?!wanted:!details.open;const from=details.getBoundingClientRect().height;animation?.cancel();details.open=true;const to=wanted?details.getBoundingClientRect().height:summary.getBoundingClientRect().height;details.style.overflow='hidden';
      const current=details.animate([{height:from+'px'},{height:to+'px'}],{duration:330,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});animation=current;
      if(wanted){const content=details.querySelector('.roster-content,nav');reset(content);reveal(content,'open');}
      current.finished.then(()=>{if(animation!==current)return;details.open=wanted;current.cancel();animation=null;details.style.overflow='';}).catch(()=>{});
    });
    details.addEventListener('toggle',()=>{if(animation)return;wanted=details.open;if(wanted){const content=details.querySelector('.roster-content,nav');reset(content);reveal(content,'open');}});
  });
  const list=document.getElementById('players-list');if(list)new MutationObserver(()=>{reset(list);reveal(list,'players','.roster-row');}).observe(list,{childList:true});
})();