(() => {
  'use strict';
  const E=window.AboubatourEngine,$=id=>document.getElementById(id),canvas=$('tour-canvas'),g=canvas.getContext('2d'),ns='http://www.w3.org/2000/svg';
  let players=[];try{players=JSON.parse(localStorage.getItem('mini-Jeux-host-players')||'[]');}catch{}
  players=Array.isArray(players)?players.filter(p=>p&&typeof p.name==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)).slice(0,6):[];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms)),ranks=['#edce77','#becbdc','#c38c68','#ae91d6','#ae91d6','#ae91d6'];
  let state,phase='intro',turn=0,deadline=0,last=0,accumulator=0,live=true,popToken=0,cameraHeight=420,confetti=[],visualSlots=[],slotMove=null,choiceMove=null,tintColor='#0b172a';
  const pills=()=>[...document.querySelectorAll('.player-pill')],pill=id=>pills().find(p=>Number(p.dataset.pourtyPlayerIndex)===id);
  function motion(el,frames,duration=400,extra={}){return el.animate(frames,{duration,easing:'cubic-bezier(.22,.75,.25,1)',...extra});}
  function tint(id){const el=$('tour-tint'),next=id===undefined?'#0b172a':players[id].color;el.style.backgroundColor=next;motion(el,[{backgroundColor:tintColor},{backgroundColor:next}],500);tintColor=next;}
  function layout(choosing){
    const root=$('tour-choices'),panels=[$('tour-arena'),root],before=panels.map(el=>el.getBoundingClientRect());
    choiceMove=choosing?null:{start:performance.now(),from:[...root.children].map(el=>{const r=el.getBoundingClientRect();return{left:r.left-before[1].left,width:r.width};})};
    root.classList.toggle('docked',!choosing);if(choosing)for(const el of root.children){el.style.removeProperty('left');el.style.removeProperty('width');}
    $('tour-main').classList.toggle('choosing',choosing);
    panels.forEach((el,i)=>{const after=el.getBoundingClientRect();motion(el,[{height:before[i].height+'px',transform:'translateY('+(before[i].top-after.top)+'px)'},{height:after.height+'px',transform:'translateY(0)'}],650);});
  }
  function alignChoices(scale,offset,canvasLeft){
    const root=$('tour-choices');if(!root.classList.contains('docked'))return;
    const relativeLeft=canvasLeft-root.getBoundingClientRect().left,width=Math.max(20,Math.min(174,E.GAP*scale-12));
    const t=choiceMove?Math.min(1,(performance.now()-choiceMove.start)/650):1,q=1-Math.pow(1-t,3);
    [...root.children].forEach((el,index)=>{const owner=state.choices[index]?.taken;if(owner===null||owner===undefined)return;
      const left=relativeLeft+offset+(visualSlots[owner]??E.x(owner))*scale-width/2,from=choiceMove?.from[index];
      el.style.left=(from?from.left+(left-from.left)*q:left)+'px';el.style.width=(from?from.width+(width-from.width)*q:width)+'px';
    });if(t===1)choiceMove=null;
  }
  function arrangeTowers(){const order=state.order.concat(Array.from({length:players.length},(_,i)=>i).filter(i=>!state.alive[i]));const target=[];order.forEach((id,index)=>target[id]=E.x(index));if(!visualSlots.length)visualSlots=target.slice();slotMove={from:visualSlots.slice(),to:target,start:performance.now()};}
  function status(text,id){const root=$('tour-status');root.replaceChildren();if(id!==undefined){const name=document.createElement('strong');name.style.color=players[id].color;name.textContent=players[id].name;root.append(name,document.createTextNode(text));}else root.textContent=text;}
  async function pop(text,color='#eef4ff',duration=1000){const token=++popToken,el=$('tour-pop');el.textContent=text;el.style.color=color;el.hidden=false;const a=motion(el,[{opacity:0,transform:'scale(.6)'},{opacity:1,transform:'scale(1.05)',offset:.25},{opacity:1,transform:'scale(1)',offset:.7},{opacity:0,transform:'scale(.6)'}],duration);await sleep(duration);if(token===popToken){el.hidden=true;a.cancel();}}
  function shapeSVG(shape,color){const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','-80 -60 160 120');svg.setAttribute('aria-hidden','true');const polygon=document.createElementNS(ns,'polygon');polygon.setAttribute('points',shape.points.map(p=>p.join(',')).join(' '));polygon.setAttribute('fill',shape.fruit==='banana'?'#e5c45c':shape.fruit==='melon'?'#76b68b':color);polygon.setAttribute('stroke','#ffffff85');polygon.setAttribute('stroke-width','2');polygon.setAttribute('stroke-linejoin','round');svg.append(polygon);if(shape.fruit==='melon'){const flesh=document.createElementNS(ns,'path');flesh.setAttribute('d','M-40 -14 A40 33 0 0 0 40 -14 Z');flesh.setAttribute('fill','#df7d85');svg.append(flesh);for(const [x,y] of [[-20,-3],[0,5],[20,-3],[-10,12],[12,12]]){const seed=document.createElementNS(ns,'ellipse');seed.setAttribute('cx',x);seed.setAttribute('cy',y);seed.setAttribute('rx','1.6');seed.setAttribute('ry','2.8');seed.setAttribute('fill','#553845');svg.append(seed);}}return svg;}
  function showOrder(rotate=false){const root=$('tour-order'),old=new Map([...root.children].map(el=>[Number(el.dataset.owner),el.getBoundingClientRect()]));const existing=new Map([...root.children].map(el=>[Number(el.dataset.owner),el]));root.replaceChildren(...state.order.map((id,i)=>{const el=existing.get(id)||document.createElement('div');el.className='tour-order-chip';el.dataset.owner=id;el.style.setProperty('--player',players[id].color);el.textContent=(i+1)+'. '+players[id].name;return el;}));
    for(const el of root.children){const before=old.get(Number(el.dataset.owner)),after=el.getBoundingClientRect();if(rotate&&before)motion(el,[{transform:`translateX(${before.left-after.left}px)`,opacity:.55},{transform:'translateX(0)',opacity:1}],650);else motion(el,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],350);}}
  async function intro(){ $('tour-main').style.opacity='0';for(let i=0;i<19&&live;i++){status('Ordre aléatoire... '+players[state.order[Math.floor(Math.random()*state.order.length)]].name);await sleep(80);}if(!live)return;$('tour-main').style.opacity='1';motion($('tour-main'),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}]);beginRound(); }
  async function beginRound(){if(!live)return;phase='reels';E.nextRound(state);arrangeTowers();turn=0;status('Manche '+state.round);showOrder(state.round>1);$('tour-timer').hidden=true;
    if(state.round>1)await sleep(680);if(!live)return;
    const root=$('tour-choices');root.replaceChildren();
    state.choices.forEach((option,index)=>{const button=document.createElement('button');button.type='button';button.className='tour-choice';button.disabled=true;
      const viewport=document.createElement('div');viewport.className='reel-window';const strip=document.createElement('div');strip.className='reel-strip';const count=18+index*2;
      for(let n=0;n<count;n++)strip.append(shapeSVG(E.shapes[Math.floor(Math.random()*E.shapes.length)],E.colors[Math.floor(Math.random()*E.colors.length)]));strip.append(shapeSVG(option,option.color));viewport.append(strip);
      const label=document.createElement('strong');label.textContent='…';const stars=document.createElement('div');stars.className='tour-stars';const owner=document.createElement('span');owner.className='tour-choice-owner';button.append(viewport,label,stars,owner);root.append(button);
      motion(button,[{opacity:0,transform:'translateY(14px) scale(.95)'},{opacity:1,transform:'none'}],420,{delay:index*45,fill:'backwards'});
      const end=-100*count;strip.style.transform=`translateY(${end}%)`;motion(strip,[{transform:'translateY(0)'},{transform:`translateY(${end}%)`}],1500+index*100,{easing:'cubic-bezier(.12,.55,.18,1)'});
      setTimeout(()=>{if(!live)return;label.textContent=option.name;stars.textContent='★'.repeat(option.difficulty);const empty=document.createElement('span');empty.className='empty';empty.textContent='★'.repeat(3-option.difficulty);stars.append(empty);button.setAttribute('aria-label',`${option.name}, difficulté ${option.difficulty} sur 3`);motion(label,[{opacity:0},{opacity:1}],250);},1500+index*100);
      button.addEventListener('click',()=>pick(index));
    });
    layout(true);await sleep(1650+(state.choices.length-1)*100);if(live)nextPick();
  }
  function nextPick(){if(turn>=state.order.length){launch();return;}phase='choose';deadline=performance.now()+10000;const id=state.order[turn];status(', choisis ta forme',id);tint(id);$('tour-timer').hidden=false;
    [...$('tour-choices').children].forEach((el,i)=>el.disabled=state.choices[i].taken!==null);
    [...$('tour-order').children].forEach(el=>el.classList.toggle('active',Number(el.dataset.owner)===id));pills().forEach(p=>{const n=Number(p.dataset.pourtyPlayerIndex);p.style.setProperty('--player',players[n]?.color||'#fff');p.classList.toggle('tour-turn',n===id);});
  }
  function pick(index){if(phase!=='choose')return;const id=state.order[turn];if(!E.choose(state,id,index))return;phase='pick';for(const b of $('tour-choices').children)b.disabled=true;const b=$('tour-choices').children[index];b.classList.add('taken');b.style.borderColor=players[id].color;b.lastElementChild.textContent=players[id].name;b.lastElementChild.style.color=players[id].color;motion(b,[{transform:'scale(1)'},{transform:'scale(.94)'},{transform:'scale(1)'}],300);turn++;setTimeout(()=>{if(live)nextPick();},330);}
  async function launch(){phase='countdown';$('tour-timer').hidden=true;status('');tint();pills().forEach(p=>p.classList.remove('tour-turn'));layout(false);await sleep(650);
    for(const n of ['3','2','1']){await pop(n,'#eef4ff',300);if(!live)return;}E.drop(state);phase='fall';accumulator=0;
  }
  function events(){for(const e of state.events.splice(0)){if(e.kind==='out'){pill(e.owner)?.classList.add('eliminated');status(' a perdu sa tour',e.owner);const chip=[...$('tour-order').children].find(c=>Number(c.dataset.owner)===e.owner);chip?.classList.add('out');}if(e.kind==='settled'){phase='between';setTimeout(()=>{if(live)beginRound();},750);}if(e.kind==='finished'){phase='ending';setTimeout(()=>{if(live)endGame();},1000);}}}
  async function endGame(){const winner=state.ranking[0];status('');for(let i=0;i<70;i++)confetti.push({x:Math.random(),y:-Math.random(),vx:(Math.random()-.5)*.1,vy:.2+Math.random()*.25,color:E.colors[i%E.colors.length],angle:Math.random()*6});await pop(players[winner].name+' gagne !',players[winner].color,1600);if(!live)return;
    const bar=document.querySelector('.player-bar');state.ranking.forEach((id,index)=>{const p=pill(id);if(!p)return;p.classList.remove('eliminated');p.classList.add('final');p.style.setProperty('--rank',ranks[index]);const badge=document.createElement('span');badge.className='rank-badge';badge.textContent='#'+(index+1);p.append(badge);window.setACText(p,index+1,players.length);bar.append(p);motion(p,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],450,{delay:index*80,fill:'backwards'});});phase='finished';status('Classement final');if(window.PourtyMiniGame)window.PourtyMiniGame.finish();else{$('tour-end').hidden=false;motion($('tour-end'),[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}]);}}
  function polygon(vertices,fill,stroke){g.beginPath();vertices.forEach((v,i)=>i?g.lineTo(v.x,v.y):g.moveTo(v.x,v.y));g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.stroke();}}
  function draw(dt){if(slotMove){const t=Math.min(1,(performance.now()-slotMove.start)/700),q=t*t*(3-2*t);visualSlots=slotMove.to.map((x,i)=>slotMove.from[i]+(x-slotMove.from[i])*q);if(t===1)slotMove=null;}const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=rect.width,h=rect.height;if(!w||!h)return;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    const top=Math.min(-260,...state.bodies.filter(b=>state.alive[b.owner]&&!b.removed).map(b=>b.bounds.min.y-85));const desired=Math.max(360,-top+85);cameraHeight+=(desired-cameraHeight)*(1-Math.exp(-dt*2));const scale=Math.min(w/(E.GAP*players.length+60),Math.max(20,h-85)/cameraHeight,1.25),offset=(w-E.GAP*players.length*scale)/2,floor=h-65;
    alignChoices(scale,offset,rect.left);
    g.save();g.translate(offset,floor);g.scale(scale,scale);g.lineWidth=1.5/scale;
    for(let i=0;i<players.length;i++){const x=visualSlots[i]??E.x(i),shift=x-E.x(i),color=state.alive[i]?players[i].color:'#7a8492';g.globalAlpha=state.alive[i]?1:.6;
      const glow=g.createLinearGradient(0,-cameraHeight,0,0);glow.addColorStop(0,color+'00');glow.addColorStop(1,color+'10');g.fillStyle=glow;g.fillRect(x-85,-cameraHeight,170,cameraHeight);g.strokeStyle=color+'16';g.setLineDash([3,9]);g.beginPath();g.moveTo(x,-cameraHeight);g.lineTo(x,0);g.stroke();g.setLineDash([]);
      g.shadowColor=color+'45';g.shadowBlur=12;polygon(state.bases[i].vertices.map(v=>({x:v.x+shift,y:v.y})),state.alive[i]?'#20354d':'#303741',color);g.shadowBlur=0;g.fillStyle=color;g.fillRect(x-E.BASE/2+2,0,E.BASE-4,3);
      g.font='bold 13px Segoe UI';g.textAlign='center';g.fillStyle=color;g.fillText(players[i].name,x,52,180);g.globalAlpha=1;
    }
    for(const b of state.bodies){if(b.removed)continue;const inactive=!state.alive[b.owner];g.globalAlpha=b.lost?Math.max(0,1-Math.max(0,b.position.y)/400):1;g.save();g.translate((visualSlots[b.owner]??E.x(b.owner))-E.x(b.owner)+b.position.x,b.position.y);g.rotate(b.angle);g.shadowColor='#0005';g.shadowBlur=7;g.shadowOffsetY=4;polygon(b.art||[],inactive?'#77818d':b.fruit==='banana'?'#e5c45c':b.fruit==='melon'?'#76b68b':b.color,'#ffffff55');g.shadowBlur=0;g.shadowOffsetY=0;
      if(b.fruit==='melon'&&!inactive){const c=b.artCenter;g.save();g.translate(-c.x,-c.y);polygon([{x:-40,y:-14},...Array.from({length:17},(_,i)=>({x:Math.cos(i/16*Math.PI)*40,y:Math.sin(i/16*Math.PI)*33-14}))],'#df7d85');g.fillStyle='#553845';for(const [x,y] of [[-20,-3],[0,5],[20,-3],[-10,12],[12,12]]){g.beginPath();g.ellipse(x,y,1.6,2.8,0,0,Math.PI*2);g.fill();}g.restore();}
      if(b.fruit==='banana'&&!inactive){g.strokeStyle='#a58134';g.lineWidth=2;g.beginPath();g.moveTo(-25,0);g.quadraticCurveTo(0,20,25,0);g.stroke();}
      g.restore();}g.globalAlpha=1;g.restore();
    confetti=confetti.filter(p=>p.y<1.2);for(const p of confetti){p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=dt*3;g.save();g.translate(p.x*w,p.y*h);g.rotate(p.angle);g.fillStyle=p.color;g.fillRect(-3,-5,6,10);g.restore();}
  }
  function frame(now){if(!live)return;const dt=last?Math.min((now-last)/1000,.06):0;last=now;if(!document.hidden){if(phase==='choose'){const left=Math.max(0,(deadline-now)/1000);$('tour-timer').firstElementChild.style.transform=`scaleX(${left/10})`;$('tour-timer').lastElementChild.textContent=Math.ceil(left);if(!left){const options=state.choices.map((o,i)=>o.taken===null?i:null).filter(i=>i!==null);pick(options[Math.floor(Math.random()*options.length)]);}}
    if(phase==='fall'){accumulator+=dt*1000;while(accumulator>=E.STEP&&state.settling){E.step(state);accumulator-=E.STEP;}events();}draw(dt);}requestAnimationFrame(frame);}
  let hiddenAt=null;document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=performance.now();else{if(hiddenAt!==null&&phase==='choose')deadline+=performance.now()-hiddenAt;hiddenAt=null;last=performance.now();}});window.addEventListener('pagehide',()=>live=false);
  $('return-btn').addEventListener('click',()=>location.href='../../minigames.html');$('tour-replay').addEventListener('click',()=>location.reload());window.addEventListener('load',()=>{if(!players.length){status('Crée des joueurs dans le menu principal.');$('tour-main').hidden=true;$('tour-end').hidden=false;$('tour-replay').hidden=true;return;}state=E.create(players.length);requestAnimationFrame(frame);intro();});
})();
