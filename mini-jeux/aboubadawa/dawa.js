(() => {
  'use strict';
  const E=window.AboubadawaEngine,$=id=>document.getElementById(id),canvas=$('dawa-canvas'),g=canvas.getContext('2d');
  let players=[];try{players=JSON.parse(localStorage.getItem('mini-Jeux-host-players')||'[]');}catch{}
  players=Array.isArray(players)?players.filter(p=>p&&typeof p.name==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)).slice(0,6):[];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms)),rankColors=['#edce77','#becbdc','#c38c68','#ae91d6','#ae91d6','#ae91d6'];
  let state,phase='order',turn=0,deadline=0,last=0,accumulator=0,effects=[],shake=0,popId=0,alive=true,finished=false,visualTime=0;
  const pills=()=>[...document.querySelectorAll('.player-pill')];
  function pill(id){return pills().find(p=>Number(p.dataset.pourtyPlayerIndex)===id);}
  function animate(el,frames,duration=400){return el.animate(frames,{duration,easing:'ease-in-out',fill:'both'});}
  async function pop(text,color='#f5f8ff',duration=1000){const token=++popId,el=$('dawa-pop');el.textContent=text;el.style.color=color;el.hidden=false;const a=animate(el,[{opacity:0,transform:'scale(.55)'},{opacity:1,transform:'scale(1.05)',offset:.25},{opacity:1,transform:'scale(1)',offset:.65},{opacity:0,transform:'scale(.5)'}],duration);await sleep(duration);if(token===popId){el.hidden=true;a.cancel();}}
  function chip(id){const p=players[id],el=document.createElement('div');el.className='dawa-order-chip';el.style.setProperty('--player',p.color);el.style.borderColor=p.color;el.style.background=p.color+'20';el.dataset.owner=id;el.textContent=(state.order.indexOf(id)+1)+'. '+p.name;return el;}
  function setStatus(text,id){$('dawa-status').replaceChildren();if(id!==undefined){const name=document.createElement('strong');name.style.setProperty('--player',players[id].color);name.textContent=players[id].name;$('dawa-status').append(name,document.createTextNode(text));}else $('dawa-status').textContent=text;}
  async function orderIntro(){
    $('dawa-main').style.opacity='0';
    for(let i=0;i<19&&alive;i++){setStatus('Ordre aléatoire... '+players[state.order[Math.floor(Math.random()*state.order.length)]].name);await sleep(80);}
    if(!alive)return;
    $('dawa-order').replaceChildren(...state.order.map(id=>chip(id)));
    $('dawa-main').style.opacity='1';$('dawa-main').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:350,easing:'ease-out'});
    nextPick();
  }
  function nextPick(){
    if(turn===players.length){countdown();return;}phase='choose';deadline=performance.now()+10000;
    const owner=state.order[turn];setStatus(', choisis ta position',owner);$('dawa-timer').hidden=false;
    pills().forEach(p=>{p.classList.toggle('dawa-turn',Number(p.dataset.pourtyPlayerIndex)===owner);p.style.setProperty('--player',players[Number(p.dataset.pourtyPlayerIndex)]?.color||'#fff');});
    document.querySelectorAll('.dawa-order-chip').forEach(el=>el.classList.toggle('active',Number(el.dataset.owner)===owner));
    const root=$('dawa-spots');root.replaceChildren();
    for(const spot of state.spots){if(spot.owner!==null)continue;const b=document.createElement('button');b.type='button';b.className='dawa-spot';b.textContent=spot.id+1;b.setAttribute('aria-label','Position '+(spot.id+1));b.style.left=(spot.x+80)/1160*100+'%';b.style.top=(spot.y+80)/740*100+'%';b.addEventListener('click',()=>pick(spot.id));b.animate([{opacity:0,scale:'.75'},{opacity:1,scale:'1'}],{duration:300,easing:'ease-out'});root.append(b);}
  }
  function pick(id){if(phase!=='choose')return;if(!E.choose(state,state.order[turn],id))return;phase='pick-transition';$('dawa-spots').replaceChildren();turn++;setTimeout(()=>{if(alive)nextPick();},260);}
  async function countdown(){phase='countdown';$('dawa-timer').hidden=true;$('dawa-spots').replaceChildren();setStatus('');pills().forEach(p=>p.classList.remove('dawa-turn'));
    for(const n of ['3','2','1']){await pop(n,'#f2f6ff',850);if(!alive)return;}E.start(state);phase='play';accumulator=0;setStatus('');
  }
  function particles(x,y,color,count=12,size=4){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=50+Math.random()*180;effects.push({kind:'particle',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,age:0,life:.45+Math.random()*.55,color,size});}if(effects.length>450)effects.splice(0,effects.length-450);}
  function receiveEvents(){for(const e of state.events.splice(0)){
    if(e.kind==='blast'||e.kind==='impact'){effects.push({...e,age:0,life:e.kind==='blast'?.65:.5});particles(e.x,e.y,e.color,e.kind==='blast'?18:8);shake=Math.max(shake,e.kind==='blast'?7:3);}
    if(e.kind==='break')particles(e.x,e.y,'#b99970',14,6);
    if(e.kind==='player-blast'){setStatus(' explose !',e.owner);document.querySelectorAll('.dawa-order-chip').forEach(el=>el.classList.toggle('active',Number(el.dataset.owner)===e.owner));}
    if(e.kind==='out'){const p=pill(e.owner);p?.classList.add('eliminated');document.querySelectorAll('.dawa-order-chip').forEach(el=>{if(Number(el.dataset.owner)===e.owner)el.classList.add('out');});particles(e.x,e.y,players[e.owner].color,22,5);}
    if(e.kind==='supply')pop('Renforts !','#f3d29d',950);
    if(e.kind==='finished'&&!finished){finished=true;phase='ending';setTimeout(()=>{if(alive)endGame();},1100);}
  }}
  async function endGame(){
    setStatus('');await pop(players[state.ranking[0]].name+' gagne !',players[state.ranking[0]].color,1500);if(!alive)return;
    const bar=document.querySelector('.player-bar');for(let rank=0;rank<state.ranking.length;rank++){const id=state.ranking[rank],p=pill(id);if(!p)continue;p.classList.remove('eliminated');p.classList.add('final');p.style.setProperty('--rank',rankColors[rank]);const badge=document.createElement('span');badge.className='rank-badge';badge.textContent='#'+(rank+1);p.append(badge);p.dataset.pourtyRank=rank+1;window.setACText(p,rank+1,players.length);bar.append(p);p.animate([{opacity:.3,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:450,delay:rank*70,fill:'backwards'});}
    phase='finished';setStatus('Classement final');if(window.PourtyMiniGame){window.PourtyMiniGame.finish();}else{$('dawa-end').hidden=false;animate($('dawa-end'),[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}]);}
  }
  function rounded(x,y,w,h,r,fill,stroke){g.beginPath();g.roundRect(x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.stroke();}}
  function body(b,fall=0,alpha=1){g.save();g.globalAlpha=alpha;g.shadowOffsetY=0;g.translate(b.x,b.y-fall);const size=b.size;
    if(b.kind==='crate'){
      g.shadowColor='#0005';g.shadowBlur=8;g.shadowOffsetY=5;g.lineWidth=2;rounded(-size/2,-size/2,size,size,5,'#887157','#b79a70');g.shadowColor='transparent';g.strokeStyle='#5b4b3c';g.lineWidth=3;g.beginPath();g.moveTo(-size*.35,-size*.35);g.lineTo(size*.35,size*.35);g.moveTo(size*.35,-size*.35);g.lineTo(-size*.35,size*.35);g.stroke();g.lineWidth=2;rounded(-size/2+5,-size/2+5,size-10,size-10,2,null,'#c3a17a');
      if(b.hp<3){g.strokeStyle='#302b2a';g.lineWidth=1.8;g.beginPath();g.moveTo(-size*.3,-size*.5);g.lineTo(-size*.1,0);g.lineTo(size*.22,size*.16);g.lineTo(size*.1,size*.5);if(b.hp===1){g.moveTo(-size*.5,size*.2);g.lineTo(size*.1,-size*.2);g.lineTo(size*.5,-size*.05);}g.stroke();}
      for(let i=0;i<3;i++){g.fillStyle=i<b.hp?'#e4c892':'#302a2566';g.beginPath();g.arc((i-1)*7,size/2+6,2,0,Math.PI*2);g.fill();}
    }else if(b.kind==='player'){
      const p=players[b.owner];g.shadowColor=p.color+'65';g.shadowBlur=17;g.lineWidth=3;g.fillStyle=p.color;g.strokeStyle='#101a2d';g.beginPath();g.arc(0,0,19,0,Math.PI*2);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#fff';g.font='bold 18px Segoe UI';g.textAlign='center';g.textBaseline='middle';g.fillText(p.name.slice(0,1).toUpperCase(),0,0);
    }else{
      if(b.kind==='dynamite'){for(let i=-1;i<=1;i++)rounded(i*7-4,-15,8,30,3,i===0?'#d48270':'#9e5a53','#e3a18a');rounded(-13,-4,26,7,2,'#baa77d');}
      else{g.fillStyle='#263344';g.strokeStyle='#8899ae';g.lineWidth=2;g.beginPath();g.arc(0,2,12,0,Math.PI*2);g.fill();g.stroke();rounded(-5,-14,10,6,2,'#bba989');}
      g.strokeStyle='#c6aa7b';g.lineWidth=2;g.beginPath();g.moveTo(2,-13);g.quadraticCurveTo(11,-26,15,-19);g.stroke();g.fillStyle=b.fuse===null?'#ffe3a6':'#fff';g.shadowColor='#ffb555';g.shadowBlur=b.fuse===null?5:17;g.beginPath();g.arc(15,-19,b.fuse===null?2:4+Math.sin(visualTime*40),0,Math.PI*2);g.fill();
    }g.restore();
  }
  function draw(dt){
    const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);if(!w||!h)return;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    g.setTransform(w/1160,0,0,h/740,0,0);g.clearRect(0,0,1160,740);g.save();g.translate(80+(Math.random()-.5)*shake,80+(Math.random()-.5)*shake);shake*=Math.exp(-10*dt);
    g.shadowColor='#0007';g.shadowBlur=30;g.shadowOffsetY=18;rounded(0,0,E.W,E.H,13,'#13243b');g.shadowColor='transparent';const ice=g.createLinearGradient(0,0,E.W,E.H);ice.addColorStop(0,'#1b3650');ice.addColorStop(.5,'#203c54');ice.addColorStop(1,'#142c43');rounded(0,0,E.W,E.H,13,ice,'#7591ad');
    g.save();g.beginPath();g.roundRect(2,2,E.W-4,E.H-4,12);g.clip();g.strokeStyle='#aac9de09';g.lineWidth=1;for(let x=-E.H;x<E.W;x+=70){g.beginPath();g.moveTo(x,0);g.lineTo(x+E.H,E.H);g.stroke();}g.restore();
    g.lineWidth=2;g.setLineDash([12,12]);rounded(10,10,E.W-20,E.H-20,8,null,'#bdcfe025');g.setLineDash([]);
    for(const d of state.drops){if(state.time<d.at)continue;const t=Math.min(1,(state.time-d.at)/d.duration);g.globalAlpha=.15+t*.3;g.fillStyle='#050b16';g.beginPath();g.ellipse(d.x,d.y,d.size*.65,d.size*.27,0,0,Math.PI*2);g.fill();g.globalAlpha=1;body({...d,hp:3,fuse:null},320*(1-t*t),Math.min(1,t*4));}
    for(const b of state.bodies.filter(b=>b.kind!=='player'))body(b);for(const b of state.bodies.filter(b=>b.kind==='player'))body(b);
    effects=effects.filter(e=>e.age<e.life);for(const e of effects){e.age+=dt;const t=Math.min(1,e.age/e.life);g.globalAlpha=(1-t)*(1-t);if(e.kind==='particle'){e.x+=e.vx*dt;e.y+=e.vy*dt;g.fillStyle=e.color;rounded(e.x,e.y,e.size,e.size,1,e.color);}else{g.strokeStyle=e.color;g.lineWidth=6*(1-t)+1;g.beginPath();g.arc(e.x,e.y,e.radius*(.12+.88*t),0,Math.PI*2);g.stroke();const glow=g.createRadialGradient(e.x,e.y,0,e.x,e.y,e.radius*.65);glow.addColorStop(0,e.color+'88');glow.addColorStop(1,e.color+'00');g.fillStyle=glow;g.beginPath();g.arc(e.x,e.y,e.radius*.65,0,Math.PI*2);g.fill();}}g.globalAlpha=1;g.restore();
  }
  function frame(now){if(!alive)return;const dt=last?Math.min((now-last)/1000,.06):0;last=now;visualTime+=dt;
    if(!document.hidden){if(phase==='choose'){const remaining=Math.max(0,(deadline-now)/1000);$('dawa-timer').firstElementChild.style.transform='scaleX('+remaining/10+')';$('dawa-timer').lastElementChild.textContent=Math.ceil(remaining);if(!remaining){const available=state.spots.filter(s=>s.owner===null);pick(available[Math.floor(Math.random()*available.length)].id);}}
      if(phase==='play'){accumulator+=dt;while(accumulator>=E.STEP&&!state.over){E.step(state);accumulator-=E.STEP;}receiveEvents();}draw(dt);}
    requestAnimationFrame(frame);
  }
  let hiddenAt=null;document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=performance.now();else{if(hiddenAt!==null&&phase==='choose')deadline+=performance.now()-hiddenAt;hiddenAt=null;last=performance.now();}});
  window.addEventListener('pagehide',()=>{alive=false;});
  $('return-btn').addEventListener('click',()=>location.href='../../minigames.html');$('dawa-replay').addEventListener('click',()=>location.reload());
  window.addEventListener('load',()=>{if(!players.length){setStatus('Crée des joueurs dans le menu principal.');$('dawa-main').hidden=true;$('dawa-end').hidden=false;$('dawa-replay').hidden=true;return;}state=E.create(players.length);requestAnimationFrame(frame);orderIntro();});
})();
