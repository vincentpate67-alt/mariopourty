(() => {
  window.PourtyFairUI=ctx=>{
    const {engine,model,session,players,canvas,pause}=ctx,get=ctx.getState,ns='http://www.w3.org/2000/svg';let running=false,speed=1;
    const node=id=>session.board.nodes.find(n=>n.id===id),save=s=>{ctx.setState(s);ctx.render();};
    const overlay=document.createElement('section');overlay.className='fair-overlay';overlay.hidden=true;
    const panel=document.createElement('div');panel.className='fair-panel';overlay.append(panel);document.body.append(overlay);
    function el(tag,attrs={}){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
    function fade(element,enter,duration=350){return element.animate?.(enter?[{opacity:0,transform:'translateY(12px) scale(.95)'},{opacity:1,transform:'none'}]:[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-8px) scale(.95)'}],{duration,easing:'cubic-bezier(.22,.75,.25,1)',fill:'both'});}
    async function close(){if(overlay.hidden)return;const a=fade(panel,false);await pause(350);overlay.hidden=true;a?.cancel();}
    async function title(text){const p=document.createElement('div');p.className='fair-announcement';p.textContent=text;document.body.append(p);p.animate?.([{opacity:0,transform:'scale(.6)'},{opacity:1,transform:'scale(1.04)',offset:.23},{opacity:1,transform:'scale(1)',offset:.7},{opacity:0,transform:'scale(.6)'}],{duration:1400,easing:'ease-in-out',fill:'both'});await pause(1400);p.remove();}
    function menu(){const f=get().fair;panel.replaceChildren();const art=document.createElement('img');art.src='../assets/decors/fair-lucky-box.svg';art.alt='';art.className='fair-box-art';const h=document.createElement('h2');h.textContent='Lucky box';const actions=document.createElement('div');actions.className='fair-actions';for(const[label,buy]of [[f.cost+' AC',true],['Passer',false]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',async()=>{if(running)return;running=true;for(const button of actions.children)button.disabled=true;await close();if(!ctx.alive())return;running=false;save(engine.answerLucky(get(),buy));});actions.append(b);}panel.append(art,h,actions);overlay.hidden=false;fade(panel,true);}
    async function lucky(){
      running=true;const f=get().fair,isRock=get().phase==='fair-rock';
      if(!isRock&&!f.paymentShown){const next=model.clone(get());next.fair.paymentShown=true;ctx.setState(next);await ctx.animateChanges([{id:f.owner,resource:'ac',delta:-f.cost}],f.before);if(!ctx.alive())return;}
      panel.replaceChildren();panel.classList.add('fair-gift-panel');panel.classList.toggle('fair-rock-panel',isRock);
      const gift=document.createElement('button');gift.type='button';gift.className='fair-gift';
      const glow=document.createElement('span');glow.className='fair-gift-glow';
      const body=document.createElement('img');if(isRock)model.itemImage(body,'pebble');else body.src='../assets/plateaux/lucky-gift-body.svg';body.alt='';body.className='fair-gift-body';
      const lid=document.createElement('img');lid.src='../assets/plateaux/lucky-gift-lid.svg';lid.alt='';lid.className='fair-gift-lid';lid.hidden=isRock;
      const progress=document.createElement('div');progress.className='fair-gift-progress';progress.setAttribute('aria-hidden','true');
      for(let i=0;i<3;i++)progress.append(document.createElement('span'));
      gift.append(glow,body,lid);panel.append(gift,progress);overlay.hidden=false;fade(panel,true);
      let clicks=Math.min(3,Math.max(0,Number(get().fair.openClicks)||0)),shake=null;
      function updateClicks(){gift.setAttribute('aria-label',(isRock?'Casser le caillou · ':'Ouvrir le cadeau · ')+clicks+' sur 3');[...progress.children].forEach((dot,i)=>dot.classList.toggle('lit',i<clicks));glow.style.opacity=String(.25+clicks*.22);body.classList.toggle('rock-cracked',isRock&&clicks>0);}
      updateClicks();
      if(clicks<3)await new Promise(resolve=>{
        gift.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();event.stopPropagation();if(!event.repeat)gift.click();}else if(event.repeat)event.preventDefault();});
        gift.addEventListener('click',()=>{if(clicks>=3||!ctx.alive())return;clicks++;const next=model.clone(get());next.fair.openClicks=clicks;ctx.setState(next);updateClicks();shake?.cancel();
          if(clicks===3){gift.disabled=true;resolve();return;}
          shake=gift.animate?.([{transform:'scale(1) rotate(0)'},{transform:'scale(.92) rotate(-6deg)',offset:.18},{transform:'scale(1.08) rotate(6deg)',offset:.45},{transform:'scale(1.02) rotate(-3deg)',offset:.7},{transform:'scale(1) rotate(0)'}],{duration:430,easing:'ease-out'});
        });
      });
      if(!ctx.alive())return;gift.disabled=true;
      if(isRock)for(let i=0;i<9;i++){const chip=document.createElement('span');chip.className='rock-fragment';gift.append(chip);const angle=i*Math.PI*2/9;chip.animate?.([{opacity:1,transform:'translate(0,0) scale(1)'},{opacity:0,transform:'translate('+Math.cos(angle)*150+'px,'+Math.sin(angle)*130+'px) rotate('+(i*70)+'deg) scale(.2)'}],{duration:750,fill:'forwards',easing:'ease-out'});}
      lid.animate?.([{opacity:1,transform:'translateY(0) rotate(0)'},{opacity:1,transform:'translateY(-65px) rotate(-13deg)',offset:.4},{opacity:0,transform:'translateY(-160px) rotate(-25deg)'}],{duration:700,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
      glow.animate?.([{opacity:.75,transform:'scale(.8)'},{opacity:1,transform:'scale(1.65)',offset:.45},{opacity:.35,transform:'scale(1.3)'}],{duration:900,fill:'forwards'});
      await pause(240);if(!ctx.alive())return;
      const prize=document.createElement('img');prize.className='fair-gift-prize';prize.alt=isRock?'Pièces':model.items[f.itemId].name;if(isRock)prize.src='../assets/items/coin.png';else model.itemImage(prize,f.itemId);gift.append(prize);
      prize.animate?.([{opacity:0,transform:'translateY(35px) scale(.2)'},{opacity:1,transform:'translateY(-35px) scale(1.12)',offset:.65},{opacity:1,transform:'translateY(-25px) scale(1)'}],{duration:750,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
      body.animate?.([{opacity:1,transform:'scale(1)'},{opacity:isRock?0:.25,transform:isRock?'scale(.1)':'translateY(22px) scale(.85)'}],{duration:650,fill:'forwards'});
      const name=document.createElement('h2');name.textContent=isRock?'+'+f.amount+' AC':model.items[f.itemId].name;name.className='fair-gift-name';panel.append(name);fade(name,true,600);progress.hidden=true;
      await pause(1650);await close();panel.classList.remove('fair-gift-panel','fair-rock-panel');if(!ctx.alive())return;running=false;save(isRock?engine.finishRock(get()):engine.finishLucky(get()));
    }
    function badge(id){const group=el('g');group.append(el('circle',{r:15,fill:players[id].color,stroke:'#15213b','stroke-width':3}));const letter=el('text',{'text-anchor':'middle','dominant-baseline':'central',fill:'#fff','font-size':14,'font-weight':800});letter.textContent=players[id].name.slice(0,1);group.append(letter);return group;}
    async function timeline(duration,draw){let elapsed=0,last=performance.now();await new Promise(resolve=>{function frame(now){if(!ctx.alive()){resolve();return;}elapsed+=Math.min(50,now-last)*speed;last=now;const p=Math.min(1,elapsed/duration);draw(p);if(p===1)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});speed=1;}
    async function travel(){if(get().fair.kind==='coaster')return coaster();running=true;const f=get().fair,a=node(f.from),b=node(f.to),wheel=f.kind==='wheel';await ctx.frameNodes([f.from,f.to]);if(!ctx.alive())return;
      const group=el('g',{'pointer-events':'none',class:'fair-journey'}),path=el('path',{fill:'none',stroke:wheel?'#f4d494':'#ccd6e4','stroke-width':wheel?4:3,'stroke-linecap':'round',opacity:.7});
      const lift=wheel?Math.min(200,Math.max(90,Math.hypot(b.x-a.x,b.y-a.y)*.28)):65;
      path.setAttribute('d',`M ${a.x} ${a.y-45} Q ${(a.x+b.x)/2} ${(a.y+b.y)/2-lift*2-45} ${b.x} ${b.y-45}`);group.append(path);
      const ride=el('g'),sprite=el('image',{href:'../assets/plateaux/'+(wheel?'wheel-cabin':'zipline-rider')+'.svg',x:-43,y:-64,width:86,height:86});ride.append(sprite);const avatar=badge(f.owner);avatar.setAttribute('transform','translate(0,-6)');ride.append(avatar);group.append(ride);canvas.world.append(group);ctx.hidePawn(f.owner,true);
      await timeline(wheel?3200:2200,p=>{const e=p*p*(3-2*p),x=a.x+(b.x-a.x)*e,y=a.y+(b.y-a.y)*e-4*lift*e*(1-e);ride.setAttribute('transform',`translate(${x} ${y}) rotate(${Math.sin(p*Math.PI*4)*(wheel?2:5)})`);ride.style.opacity=String(Math.min(1,p*8,(1-p)*10+.1));});
      group.remove();if(!ctx.alive()){ctx.hidePawn(f.owner,false);return;}ctx.setState(engine.finishFairTravel(get()));ctx.hidePawn(f.owner,false);running=false;ctx.render();
    }
    async function coaster(){
      running=true;const f=get().fair,a=node(f.from),b=node(f.to);if(!ctx.alive())return;await ctx.frameNodes([f.from,f.to]);if(!ctx.alive())return;
      const distance=Math.hypot(b.x-a.x,b.y-a.y),height=Math.min(95,distance*.18),direction=b.x>=a.x?1:-1;
      const point=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-Math.sin(t*Math.PI)*height-Math.sin(t*Math.PI*4)*height*.3});
      const group=el('g',{'pointer-events':'none',class:'fair-journey'}),track=el('g');let d='';
      for(let i=0;i<=100;i++){const p=point(i/100);d+=(i?' L ':'M ')+p.x+' '+(p.y+16);if(i%4===0){const q=point(Math.min(1,(i+1)/100)),angle=Math.atan2(q.y-p.y,q.x-p.x),nx=-Math.sin(angle)*9,ny=Math.cos(angle)*9;track.append(el('path',{d:'M '+(p.x-nx)+' '+(p.y+16-ny)+' L '+(p.x+nx)+' '+(p.y+16+ny),stroke:'#aa7962','stroke-width':4}));}}
      track.append(el('path',{d,fill:'none',stroke:'#435775','stroke-width':9}),el('path',{d,fill:'none',stroke:'#c8d8e8','stroke-width':3}));group.append(track);
      const ride=el('g'),cart=el('g');cart.append(el('image',{href:'../assets/plateaux/coaster-cart.svg',x:-45,y:-43,width:90,height:70}));cart.setAttribute('transform','scale('+direction+',1)');ride.append(badge(f.owner),cart);group.append(ride);canvas.world.append(group);ctx.hidePawn(f.owner,true);
      group.animate?.([{opacity:0},{opacity:1}],{duration:300,fill:'both'});
      await timeline(3200,p=>{const t=p*p*(3-2*p),v=point(t),before=point(Math.max(0,t-.002)),after=point(Math.min(1,t+.002)),angle=Math.atan2((after.y-before.y)*direction,Math.abs(after.x-before.x))*180/Math.PI;ride.setAttribute('transform','translate('+v.x+' '+v.y+') rotate('+Math.max(-55,Math.min(55,angle))+')');ride.style.opacity=String(Math.min(1,p*10,(1-p)*12));});
      if(ctx.alive())ctx.setState(engine.finishFairTravel(get()));ctx.hidePawn(f.owner,false);group.animate?.([{opacity:1},{opacity:0}],{duration:250,fill:'both'});await pause(250);group.remove();running=false;if(ctx.alive())ctx.render();
    }
    async function hiddenBlock(){
      running=true;const f=get().fair,point=node(f.node),group=el('g',{'pointer-events':'none'});let pawn,hidden=false;
      try{
        await ctx.focusNode(f.node);if(!ctx.alive())return;await pause(3000);if(!ctx.alive())return;
        let path='../assets/plateaux/hidden-block.png';await new Promise(resolve=>{const image=new Image();image.onload=resolve;image.onerror=()=>{path='../assets/plateaux/hidden-block.svg';resolve();};image.src=path;});if(!ctx.alive())return;
        const block=el('g'),art=el('image',{href:path,x:-32,y:-32,width:64,height:64});block.append(art);group.append(block);canvas.world.append(group);block.setAttribute('transform','translate('+point.x+' '+(point.y-82)+')');
        const announcement=title('Block caché');await timeline(450,p=>{block.style.opacity=String(p);block.setAttribute('transform','translate('+point.x+' '+(point.y-82-15*(1-p))+') scale('+(.5+p*.5)+')');});await announcement;if(!ctx.alive())return;
        await new Promise(resolve=>{const hit=e=>{if(e.button!==0)return;e.preventDefault();cleanup();resolve();},exit=()=>{cleanup();resolve();},cleanup=()=>{delete window.PourtyHiddenBlockHit;document.removeEventListener('pointerdown',hit,true);window.removeEventListener('pagehide',exit);};window.PourtyHiddenBlockHit=()=>hit({button:0,preventDefault(){}});document.addEventListener('pointerdown',hit,true);window.addEventListener('pagehide',exit,{once:true});});if(!ctx.alive())return;
        pawn=el('g');const token=canvas.pawnElements?.get(f.owner)?.group.cloneNode(true)||badge(f.owner);if(!canvas.pawnElements?.get(f.owner))token.setAttribute('transform','translate('+point.x+' '+point.y+')');pawn.append(token);group.append(pawn);ctx.hidePawn(f.owner,true);hidden=true;
        await timeline(450,p=>{pawn.setAttribute('transform','translate(0 '+(-Math.sin(p*Math.PI)*43)+')');const bump=p>.4?Math.sin((p-.4)/.6*Math.PI)*13:0;block.setAttribute('transform','translate('+point.x+' '+(point.y-82-bump)+')');});if(!ctx.alive())return;ctx.hidePawn(f.owner,false);hidden=false;pawn.remove();
        await timeline(300,p=>{block.style.opacity=String(1-p);block.setAttribute('transform','translate('+point.x+' '+(point.y-82)+') scale('+(1+p*.3)+')');});if(!ctx.alive())return;
        await title(f.reward===1?'1 étoile !':'+'+f.reward+' AC');if(!ctx.alive())return;if(f.reward===1){await ctx.dropItem('star',f.owner);if(!ctx.alive())return;}ctx.setState(engine.claimHiddenBlock(get()));
      }finally{group.remove();if(hidden)ctx.hidePawn(f.owner,false);running=false;}
      if(ctx.alive())ctx.render();
    }
    async function magic(){
      running=true;const f=get().fair,group=el('g',{'pointer-events':'none'});let ghosts=[];
      function position(positions,i){const ids=positions.map((id,j)=>id===positions[i]?j:-1).filter(j=>j>=0),slot=ids.indexOf(i),angle=slot*Math.PI*2/ids.length-(ids.length===2?Math.PI:Math.PI/2),offset=ids.length>1?19/Math.sin(Math.PI/ids.length):0,p=node(positions[i]);return {x:p.x+Math.cos(angle)*offset,y:p.y+Math.sin(angle)*offset};}
      const sky=()=>-(canvas.view.y+100)/canvas.view.scale;
      try{
        if(!ctx.alive())return;
        await ctx.frameNodes(session.board.nodes.map(n=>n.id));if(!ctx.alive())return;
        ghosts=players.map((_,i)=>{const ghost=canvas.pawnElements?.get(i)?.group.cloneNode(true)||badge(i);group.append(ghost);return ghost;});
        canvas.world.append(group);players.forEach((_,i)=>ctx.hidePawn(i,true));
        const starts=players.map((_,i)=>position(f.before,i)),ceiling=sky();
        await timeline(1100,p=>{const rise=p*p*p;ghosts.forEach((ghost,i)=>{const a=starts[i],y=a.y+(ceiling-a.y)*rise;ghost.setAttribute('transform','translate('+a.x+' '+y+') scale('+(1-.12*p)+','+(1+.22*Math.sin(p*Math.PI))+')');});});
        ghosts.forEach(g=>{g.style.visibility='hidden';});if(!ctx.alive())return;
        await pause(180);
        for(let i=0;i<players.length;i++){
          if(!ctx.alive())return;await ctx.focusNode(f.positions[i]);if(!ctx.alive())return;
          const ghost=ghosts[i],end=position(f.positions,i),top=sky();ghost.setAttribute('transform','translate('+end.x+' '+top+')');ghost.style.visibility='visible';
          await timeline(850,p=>{const fall=p*p,y=top+(end.y-top)*fall;ghost.setAttribute('transform','translate('+end.x+' '+y+') scale(1,'+(1+.18*Math.sin(p*Math.PI))+')');});
          if(!ctx.alive())return;
          const ring=el('circle',{cx:end.x,cy:end.y,r:16,fill:'none',stroke:players[i].color,'stroke-width':3});group.insertBefore(ring,ghost);
          await timeline(300,p=>{const bounce=Math.sin(p*Math.PI)*(1-p)*10;ghost.setAttribute('transform','translate('+end.x+' '+(end.y-bounce)+')');ring.setAttribute('r',16+p*25);ring.style.opacity=String(1-p);});ring.remove();
          ghost.setAttribute('transform','translate('+end.x+' '+end.y+')');
          await pause(160);
        }
        if(ctx.alive())ctx.setState(engine.finishMagic(get()));
      }finally{
        group.remove();players.forEach((_,i)=>ctx.hidePawn(i,false));running=false;
      }
      if(ctx.alive())ctx.render();
    }
    return {canAccelerate:()=>running&&['fair-travel','fair-magic'].includes(get().phase),releaseSpace(){speed=1;},handleSpace(event){if(!get().phase.startsWith('fair-'))return false;if(['fair-lucky-roll','fair-rock'].includes(get().phase)){if(!event.repeat&&!overlay.hidden){const gift=panel.querySelector('.fair-gift');if(gift&&!gift.disabled)gift.click();}return true;}if(running&&['fair-travel','fair-magic'].includes(get().phase)){speed=3;return true;}return false;},render(){const phase=get().phase;document.body.classList.toggle('fair-active',phase.startsWith('fair-'));if(!phase.startsWith('fair-')){if(!running)overlay.hidden=true;return false;}if(running)return true;if(phase==='fair-hidden')hiddenBlock();else if(phase==='fair-lucky')menu();else if(['fair-lucky-roll','fair-rock'].includes(phase))lucky();else if(phase==='fair-travel')travel();else if(phase==='fair-magic')magic();return true;}};
  };
})();
