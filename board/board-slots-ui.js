(() => {
  window.PourtySlotsUI=ctx=>{
    const {engine,pause}=ctx,get=ctx.getState;let busy=false,animations=[],skip=false;
    const el=(tag,cls='',text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
    const panel=el('section','slots-overlay'),content=el('div','slots-content');panel.hidden=true;panel.setAttribute('aria-label','Machine à sous');panel.append(content);document.body.append(panel);
    const update=s=>{ctx.setState(s);ctx.render();};
    function icon(id){const box=el('div','slots-symbol'),img=el('img');img.src=engine.slotSymbols[id].image;img.alt=engine.slotSymbols[id].name;const hue=engine.slotSymbols[id].hue;if(hue!==undefined)img.style.filter='hue-rotate('+hue+'deg) drop-shadow(0 3px 3px #0004)';box.append(img);return box;}
    function shell(){content.replaceChildren();content.append(el('h2','','Machine à sous'));const cabinet=el('div','slots-cabinet');content.append(cabinet);return cabinet;}
    async function fade(show){if(show===!panel.hidden)return;if(show)panel.hidden=false;const a=panel.animate?.([{opacity:show?0:1},{opacity:show?1:0}],{duration:300,fill:'both',easing:'ease-in-out'});await pause(300);if(!show)panel.hidden=true;a?.cancel();}
    function grid(parent,values){const reels=[];for(let x=0;x<5;x++){const reel=el('div','slots-reel');for(let y=0;y<3;y++){const cell=icon(values[y][x]);cell.dataset.row=String(y);reel.append(cell);}parent.append(reel);reels.push(reel);}return reels;}
    async function menu(){busy=true;const cabinet=shell();grid(cabinet,[['cherry','lemon','bell','coin','star'],['coin','cherry','star','lemon','bell'],['bell','star','lemon','cherry','coin']]);const b=el('button','slots-launch','Lancer');b.type='button';b.addEventListener('click',()=>{if(busy)return;skip=false;update(engine.spinSlots(get()));});content.append(b);await fade(true);busy=false;}
    async function spin(){busy=true;const cabinet=shell(),f=get().slots,keys=Object.keys(engine.slotSymbols),reels=[];for(let x=0;x<5;x++){const viewport=el('div','slots-reel'),strip=el('div','slots-strip'),count=25+x*5;for(let i=0;i<count;i++)strip.append(icon(keys[Math.floor(Math.random()*keys.length)]));for(let y=0;y<3;y++)strip.append(icon(f.grid[y][x]));viewport.append(strip);cabinet.append(viewport);reels.push({viewport,strip,count});}await fade(true);
      animations=reels.map(({viewport,strip,count},index)=>{const h=viewport.getBoundingClientRect().height/3,a=strip.animate?.([{transform:'translateY(0)'},{transform:'translateY('+(-count*h)+'px)'}],{duration:2400+index*380,easing:'cubic-bezier(.12,.6,.12,1)',fill:'forwards'});if(skip)a?.updatePlaybackRate?.(3);return a;});
      await Promise.all(animations.map((a,i)=>a?.finished?.catch(()=>{})||pause(2400+i*380)));if(!ctx.alive())return;animations.forEach(a=>a?.cancel());animations=[];busy=false;update(engine.revealSlots(get()));
    }
    async function result(){busy=true;const cabinet=shell(),f=get().slots,reels=grid(cabinet,f.grid),label=el('p','slots-win');label.setAttribute('aria-live','polite');content.append(label);await fade(true);
      for(const line of f.lines){for(let x=0;x<line.count;x++)reels[x].children[line.row].classList.add('winning');label.textContent=line.stars?'1 étoile !':'+'+line.ac+' AC';label.animate?.([{opacity:0,transform:'scale(.85)'},{opacity:1,transform:'scale(1)'}],{duration:260,easing:'ease-out'});await pause(800);}
      label.textContent=f.stars?'1 étoile !':'+'+f.ac+' AC';await pause(900);await fade(false);if(ctx.alive()){busy=false;update(engine.settleSlots(get()));}
    }
    async function payout(){busy=true;await fade(false);const f=get().slots;if(f.ac)await ctx.animateChanges([{id:f.owner,resource:'ac',delta:f.ac}],f.before);if(f.stars){await ctx.dropItem('star',f.owner);if(ctx.alive())await ctx.animateChanges([{id:f.owner,resource:'stars',delta:f.stars}],f.before);}if(ctx.alive()){busy=false;update(engine.finishSlots(get(),ctx.session.gameMode));}}
    return {canAccelerate:()=>get().phase==='slots-spin',handleSpace(){if(get().phase!=='slots-spin')return false;skip=true;animations.forEach(a=>a?.updatePlaybackRate?.(3));return true;},render(){const p=get().phase;if(!p.startsWith('slots-')){if(!busy)panel.hidden=true;return false;}if(busy)return true;if(p==='slots-menu')menu();else if(p==='slots-spin')spin();else if(p==='slots-result')result();else payout();return true;}};
  };
})();
