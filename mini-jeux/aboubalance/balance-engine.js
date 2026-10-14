(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../aboubatour/matter.min.js'):root.Matter);if(typeof module==='object'&&module.exports)module.exports=api;else root.AboubalanceEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(M){
 'use strict';const W=1100,H=740,STEP=1/120,PIVOT={x:550,y:380},LENGTH=650;
 function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function create(count,rng=Math.random){const engine=M.Engine.create({enableSleeping:false,positionIterations:10,velocityIterations:8});engine.gravity.scale=.001;
  const beam=M.Bodies.rectangle(PIVOT.x,PIVOT.y,LENGTH,20,{density:.002,friction:1.2,frictionStatic:1.6}),weight=M.Bodies.circle(PIVOT.x,PIVOT.y+48,23,{density:.045,friction:.8}),platform=M.Body.create({parts:[beam,weight],friction:1.2,frictionStatic:2,frictionAir:.025,restitution:.05});const offset={x:PIVOT.x-platform.position.x,y:PIVOT.y-platform.position.y},pin=M.Constraint.create({pointA:{...PIVOT},bodyB:platform,pointB:offset,length:0,stiffness:1,damping:.15});M.Composite.add(engine.world,[platform,pin]);
  const s={engine,world:engine.world,platform,beam,weight,pin,count,rng,order:shuffle(Array.from({length:count},(_,i)=>i),rng),dead:new Set(),out:[],blocks:[],events:[],turn:0,current:null,options:[],size:58,phase:'intro',elapsed:0,settled:0,placed:0,ranking:null,time:0,serial:0};return s;}
 function next(s){if(s.phase==='finished')return false;while(s.dead.has(s.order[s.turn%s.count]))s.turn++;s.current=s.order[s.turn%s.count];s.size=Math.min(160,58+s.placed*3.5);const xs=s.beam.vertices.map(v=>v.x),left=Math.min(...xs)+s.size*.5+6,right=Math.max(...xs)-s.size*.5-6,center=s.beam.position.x,span=Math.max(120,right-left),start=right>left?left:center-span/2;
  const top=Math.min(...s.platform.parts.flatMap(b=>b.vertices.map(v=>v.y)),...s.blocks.filter(b=>!b.game.fallen).flatMap(b=>b.vertices.map(v=>v.y)))-s.size/2-70;
  s.options=Array.from({length:5},(_,i)=>({id:i,x:Math.max(65,Math.min(W-65,start+span*(i+.2+s.rng()*.6)/5)),y:top}));s.phase='choose';s.events.push({kind:'choose',owner:s.current});return true;}
 function choose(s,index){if(s.phase!=='choose'||!s.options[index])return false;const spot=s.options[index],body=M.Bodies.rectangle(spot.x,spot.y,s.size,s.size,{density:.002,friction:.8,frictionStatic:1.3,restitution:.08,frictionAir:.003});body.game={owner:s.current,size:s.size,id:++s.serial,fallen:false};s.blocks.push(body);M.Composite.add(s.world,body);s.phase='drop';s.elapsed=0;s.settled=0;s.placed++;s.options=[];s.events.push({kind:'drop',owner:s.current,x:spot.x,y:spot.y});return true;}
 function finishTurn(s){const alive=s.order.filter(id=>!s.dead.has(id));if(alive.length===0||(s.count>1&&alive.length===1)){s.phase='finished';s.ranking=alive.concat([...s.out].reverse());s.events.push({kind:'finished'});return;}s.turn++;next(s);}
 function step(s,dt=STEP){if(s.phase!=='drop')return;s.elapsed+=dt;s.time+=dt;M.Engine.update(s.engine,dt*1000);
  for(const b of s.blocks){if(b.game.fallen)continue;if(b.bounds.min.y>H+40||b.bounds.max.x<-60||b.bounds.min.x>W+60){b.game.fallen=true;M.Composite.remove(s.world,b);const id=b.game.owner;s.events.push({kind:'fall',owner:id,x:b.position.x,y:Math.min(H,b.position.y)});if(!s.dead.has(id)){s.dead.add(id);s.out.push(id);s.events.push({kind:'out',owner:id});}}}
  s.blocks=s.blocks.filter(b=>!b.game.fallen);const quiet=Math.abs(s.platform.angularVelocity)<.0025&&s.blocks.every(b=>b.speed<.22&&Math.abs(b.angularVelocity)<.006);s.settled=quiet?s.settled+dt:0;
  if(s.elapsed>1.5&&s.settled>.6||s.elapsed>10)finishTurn(s);
 }
 return{W,H,STEP,PIVOT,LENGTH,create,next,choose,step};
});


