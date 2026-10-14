/* Fixed-step, deterministic arena simulation; no input or rendering dependencies. */
(() => {
  'use strict';
  const W=1000,H=580,STEP=1/120;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function shuffle(list,rng){const a=[...list];for(let i=a.length-1;i;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function create(count,rng=Math.random){
    const s={rng,time:0,cycle:0,cursor:0,nextBlast:.7,nextSupply:10,bodies:[],drops:[],events:[],order:shuffle(Array.from({length:count},(_,i)=>i),rng),spots:[],out:[],started:false,over:false,serial:0};
    const angle=rng()*Math.PI*2;
    for(let i=0;i<count;i++){const a=angle+i*Math.PI*2/count;s.spots.push({id:i,x:W/2+Math.cos(a)*285,y:H/2+Math.sin(a)*145,owner:null});}
    for(let i=0;i<15;i++)spawn(s,'crate',freePoint(s,true));
    for(let i=0;i<7;i++)spawn(s,i%3===0?'dynamite':'bomb',freePoint(s,true));
    return s;
  }
  function freePoint(s,initial=false,size=45){
    let best=null,score=-Infinity;
    for(let i=0;i<100;i++){
      const p={x:65+s.rng()*(W-130),y:65+s.rng()*(H-130)};
      const clear=Math.min(...s.bodies.filter(b=>!b.dead).map(b=>Math.hypot(b.x-p.x,b.y-p.y)-(b.kind==='crate'?b.size*.72:b.r)-size*.72),...(initial?s.spots.map(v=>Math.hypot(v.x-p.x,v.y-p.y)-80-size*.72):[Infinity]));
      if(clear>score){best=p;score=clear;}if(clear>10)return p;
    }return best;
  }
  function spawn(s,kind,p,owner=null,size=null){
    const side=size??(kind==='crate'?30+s.rng()*32:kind==='dynamite'?28:23);
    const b={id:++s.serial,kind,x:p.x,y:p.y,vx:0,vy:0,px:p.x,py:p.y,size:side,r:kind==='player'?19:side/2,mass:kind==='player'?1:kind==='crate'?1.1+side*side/1100:.65,hp:3,owner,dead:false,fuse:null,hit:0};s.bodies.push(b);return b;
  }
  function choose(s,owner,spotId){
    if(s.started||s.bodies.some(b=>b.kind==='player'&&b.owner===owner))return false;
    const spot=s.spots.find(v=>v.id===spotId);if(!spot||spot.owner!==null||!s.order.includes(owner))return false;
    spot.owner=owner;spawn(s,'player',spot,owner);return true;
  }
  function start(s){if(s.bodies.filter(b=>b.kind==='player').length!==s.order.length)throw Error('Positions incomplètes.');s.started=true;}
  function drop(s,kind,size=null,delay=0){const p=freePoint(s,false,size||45);s.drops.push({...p,kind,size:size??(kind==='crate'?30+s.rng()*32:kind==='dynamite'?28:23),at:s.time+delay,duration:.85});}
  function blast(s,x,y,radius,force,source=null,damage=true,color='#ffca85'){
    s.events.push({kind:damage?'blast':'impact',x,y,radius,color});
    for(const b of s.bodies){
      if(b.dead||b===source)continue;let dx=b.x-x,dy=b.y-y;const d=Math.hypot(dx,dy),extent=b.kind==='crate'?b.size*.6:b.r;if(d>radius+extent)continue;
      if(d<.01){const a=s.rng()*Math.PI*2;dx=Math.cos(a);dy=Math.sin(a);}else{dx/=d;dy/=d;}
      const kick=force*Math.max(.15,1-d/(radius+extent))/Math.sqrt(b.mass);
      b.vx+=dx*kick;b.vy+=dy*kick;b.hit=s.time;
      if(damage&&b.kind==='crate'){
        b.hp--;if(b.hp<=0){b.dead=true;s.events.push({kind:'break',x:b.x,y:b.y,size:b.size});drop(s,'crate',null,.7+s.rng()*.6);}
      }else if(damage&&(b.kind==='bomb'||b.kind==='dynamite')&&b.fuse===null)b.fuse=s.time+.16+s.rng()*.12;
    }
  }
  function contact(a,b){
    const boxA=a.kind==='crate',boxB=b.kind==='crate';
    if(boxA&&boxB){const dx=b.x-a.x,dy=b.y-a.y,ox=(a.size+b.size)/2-Math.abs(dx),oy=(a.size+b.size)/2-Math.abs(dy);if(ox<=0||oy<=0)return null;return ox<oy?{nx:Math.sign(dx)||1,ny:0,depth:ox}:{nx:0,ny:Math.sign(dy)||1,depth:oy};}
    if(!boxA&&!boxB){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),depth=a.r+b.r-d;if(depth<=0)return null;return {nx:d?dx/d:1,ny:d?dy/d:0,depth};}
    const box=boxA?a:b,circle=boxA?b:a,h=box.size/2;
    let dx=circle.x-clamp(circle.x,box.x-h,box.x+h),dy=circle.y-clamp(circle.y,box.y-h,box.y+h),d=Math.hypot(dx,dy),depth=circle.r-d;
    if(d===0){const ox=h-Math.abs(circle.x-box.x),oy=h-Math.abs(circle.y-box.y);if(ox<oy){dx=Math.sign(circle.x-box.x)||1;dy=0;depth=circle.r+ox;}else{dx=0;dy=Math.sign(circle.y-box.y)||1;depth=circle.r+oy;}d=1;}
    if(depth<=0)return null;return {nx:dx/d*(boxA?1:-1),ny:dy/d*(boxA?1:-1),depth};
  }
  function collide(a,b){const c=contact(a,b);if(!c)return;const ia=1/a.mass,ib=1/b.mass,total=ia+ib,shift=Math.max(0,c.depth-.02)*.85/total;
    a.x-=c.nx*shift*ia;a.y-=c.ny*shift*ia;b.x+=c.nx*shift*ib;b.y+=c.ny*shift*ib;
    const speed=(b.vx-a.vx)*c.nx+(b.vy-a.vy)*c.ny;if(speed>=0)return;const impulse=-(1.35)*speed/total;
    a.vx-=impulse*c.nx*ia;a.vy-=impulse*c.ny*ia;b.vx+=impulse*c.nx*ib;b.vy+=impulse*c.ny*ib;
  }
  function keepCrate(b){const h=b.size/2;for(const [p,v,max]of [['x','vx',W],['y','vy',H]]){if(b[p]<h){b[p]=h;b[v]=Math.abs(b[v])*.42;}else if(b[p]>max-h){b[p]=max-h;b[v]=-Math.abs(b[v])*.42;}}}
  function crossing(b){let f=1;for(const [p,prev,min,max]of [['x','px',-b.r,W+b.r],['y','py',-b.r,H+b.r]]){if(b[p]<min&&b[prev]>=min)f=Math.min(f,(min-b[prev])/(b[p]-b[prev]));if(b[p]>max&&b[prev]<=max)f=Math.min(f,(max-b[prev])/(b[p]-b[prev]));}return clamp(f,0,1);}
  function step(s,dt=STEP){
    if(!s.started||s.over)return;s.time+=dt;
    const survivors=()=>s.bodies.filter(b=>b.kind==='player'&&!b.dead);
    if(s.time>=s.nextSupply){for(let i=0;i<4;i++)drop(s,i%2?'bomb':'dynamite',null,i*.3);s.nextSupply=s.time+8;s.events.push({kind:'supply'});}
    for(const d of s.drops.filter(d=>s.time>=d.at+d.duration)){const b=spawn(s,d.kind,d,null,d.size);if(d.kind==='crate')blast(s,b.x,b.y,100+b.size*2,80+b.size*1.8,b,false,'#c7deff');else s.events.push({kind:'impact',x:b.x,y:b.y,radius:40,color:'#ffcf91'});d.done=true;}s.drops=s.drops.filter(d=>!d.done);
    if(s.time>=s.nextBlast){
      let b;for(let i=0;i<s.order.length;i++){const owner=s.order[s.cursor];s.cursor++;if(s.cursor===s.order.length){s.cursor=0;s.cycle++;}b=survivors().find(v=>v.owner===owner);if(b)break;}
      if(b){const boost=1+Math.min(2.5,s.cycle*.15);blast(s,b.x,b.y,240+Math.min(380,s.cycle*15),155*boost,b,true);s.events.push({kind:'player-blast',owner:b.owner});}
      s.nextBlast=s.time+Math.max(.65,2-s.time*.035);
    }
    for(const b of s.bodies){if(b.dead)continue;if(b.fuse!==null&&s.time>=b.fuse){b.dead=true;blast(s,b.x,b.y,b.kind==='dynamite'?245:200,b.kind==='dynamite'?280:220,b,true);}}
    const live=s.bodies.filter(b=>!b.dead);
    for(const b of live){b.px=b.x;b.py=b.y;const drag=Math.exp(-.48*dt);b.vx=clamp(b.vx*drag,-1100,1100);b.vy=clamp(b.vy*drag,-1100,1100);b.x+=b.vx*dt;b.y+=b.vy*dt;}
    for(let pass=0;pass<3;pass++){for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++)collide(live[i],live[j]);for(const b of live)if(b.kind==='crate')keepCrate(b);}
    const fallen=live.filter(b=>b.kind==='player'&&(b.x<-b.r||b.x>W+b.r||b.y<-b.r||b.y>H+b.r)).sort((a,b)=>crossing(a)-crossing(b)||s.order.indexOf(b.owner)-s.order.indexOf(a.owner));
    for(const b of fallen){b.dead=true;s.out.push(b.owner);s.events.push({kind:'out',owner:b.owner,x:b.x,y:b.y});}
    for(const b of live)if(b.kind!=='crate'&&b.kind!=='player'&&(b.x<-80||b.x>W+80||b.y<-80||b.y>H+80))b.dead=true;
    s.bodies=s.bodies.filter(b=>!b.dead);
    if(s.order.length>1&&survivors().length<=1||s.order.length===1&&survivors().length===0){s.over=true;const alive=survivors();s.ranking=alive.map(b=>b.owner).concat([...s.out].reverse());s.events.push({kind:'finished'});}
  }
  const api={W,H,STEP,create,choose,start,step,blast,drop,contact};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.AboubadawaEngine=api;
})();
