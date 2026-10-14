(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./matter.min.js'):root.Matter);if(typeof module==='object'&&module.exports)module.exports=api;else root.AboubatourEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  const STEP=1000/120, GAP=220, BASE=100;
  const shapes=[
    {name:'Brique',difficulty:1,points:[[-43,-18],[43,-18],[43,18],[-43,18]]},
    {name:'Carré',difficulty:1,points:[[-28,-28],[28,-28],[28,28],[-28,28]]},
    {name:'Socle',difficulty:1,points:[[-30,-18],[30,-18],[44,18],[-44,18]]},
    {name:'Poutre',difficulty:2,points:[[-65,-11],[65,-11],[65,11],[-65,11]]},
    {name:'Hexagone',difficulty:2,points:[[-20,-28],[20,-28],[39,0],[20,28],[-20,28],[-39,0]]},
    {name:'Bloc penché',difficulty:2,points:[[-20,-27],[46,-27],[20,27],[-46,27]]},
    {name:'Triangle',difficulty:3,points:[[-47,30],[0,-40],[47,30]]},
    {name:'Losange',difficulty:3,points:[[-47,0],[0,-37],[47,0],[0,37]]},
    {name:'Aiguille',difficulty:3,points:[[-12,-53],[12,-53],[12,53],[-12,53]]},
    {name:'Rampe',difficulty:3,points:[[-51,22],[-51,-22],[51,22]]},
    {name:'Trapèze inversé',difficulty:3,points:[[-48,-23],[48,-23],[17,23],[-17,23]]}
  ];
  const ring=(rx,ry,n=24)=>Array.from({length:n},(_,i)=>[Math.cos(i/n*Math.PI*2)*rx,Math.sin(i/n*Math.PI*2)*ry]);
  const arc=(r,i)=>{const a=(20+i*140/8)*Math.PI/180;return [Math.cos(a)*r,Math.sin(a)*r-32];};
  shapes.push(
    {name:'Boule',difficulty:3,points:ring(33,33),round:true},
    {name:'Œuf',difficulty:3,points:ring(25,43)},
    {name:'Pastèque',difficulty:3,fruit:'melon',points:Array.from({length:19},(_,i)=>{const a=i/18*Math.PI;return [Math.cos(a)*49,Math.sin(a)*43-18];})},
    {name:'Banane',difficulty:3,fruit:'banana',points:[...Array.from({length:9},(_,i)=>arc(56,i)),...Array.from({length:9},(_,i)=>arc(30,8-i))],parts:Array.from({length:8},(_,i)=>[arc(56,i),arc(56,i+1),arc(30,i+1),arc(30,i)])},
    {name:'Pointe',difficulty:3,points:[[-45,-25],[45,-25],[0,42]]},
    {name:'Galet',difficulty:2,points:ring(47,21,12)},
    {name:'Culbuto',difficulty:3,points:[[-15,-46],[15,-46],[34,10],[25,31],[0,42],[-25,31],[-34,10]]}
  );
  const colors=['#df9b68','#7bafe2','#b18ae0','#67bdab','#dfbf68','#d881a3'];
  function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function create(count,rng=Math.random){
    const engine=M.Engine.create({enableSleeping:true,positionIterations:10,velocityIterations:10,constraintIterations:3});engine.gravity.y=1;engine.gravity.scale=.001;
    const state={engine,rng,count,round:0,time:0,bodies:[],out:[],events:[],ranking:null,order:shuffle(Array.from({length:count},(_,i)=>i),rng),alive:Array(count).fill(true),choices:[],picks:new Map(),settling:false,elapsed:0,quiet:0};
    state.bases=Array.from({length:count},(_,i)=>M.Bodies.rectangle(x(i),14,BASE,28,{isStatic:true,friction:.8,label:'base'}));M.Composite.add(engine.world,state.bases);return state;
  }
  function x(owner){return (owner+.5)*GAP;}
  function option(state){const n=state.round,r=state.rng(),difficulty=n===1?(r<.5?1:2):n===2?(r<.15?1:r<.6?2:3):n===3?(r<.25?2:3):3;const pool=shapes.filter(s=>s.difficulty===difficulty);return {...pool[Math.floor(state.rng()*pool.length)],color:colors[Math.floor(state.rng()*colors.length)],taken:null};}
  function nextRound(state){state.round++;state.order=state.order.filter(id=>state.alive[id]);if(state.round>1&&state.order.length>1)state.order.push(state.order.shift());state.picks.clear();state.choices=state.order.map(()=>option(state));return state.choices;}
  function choose(state,owner,index){const o=state.choices[index];if(!state.alive[owner]||state.picks.has(owner)||!o||o.taken!==null)return false;o.taken=owner;state.picks.set(owner,index);return true;}
  function drop(state){
    if(state.picks.size!==state.order.length)return false;
    for(const owner of state.order){const o=state.choices[state.picks.get(owner)],top=Math.min(0,...state.bodies.filter(b=>b.owner===owner&&!b.lost).map(b=>b.bounds.min.y));
      const properties={friction:.7,frictionStatic:1,frictionAir:.006,restitution:.035,sleepThreshold:70};
      const vertices=o.points.map(([x,y])=>({x,y}));let center=M.Vertices.centre(vertices),b;
      if(o.parts){const parts=o.parts.map(points=>{const vs=points.map(([x,y])=>({x,y})),c=M.Vertices.centre(vs);return M.Bodies.fromVertices(c.x,c.y,[vs],properties);});b=M.Body.create({...properties,parts});center={...b.position};M.Body.setPosition(b,{x:x(owner),y:top-125});}
      else b=M.Bodies.fromVertices(x(owner),top-125,[vertices],properties);
      b.art=vertices.map(p=>({x:p.x-center.x,y:p.y-center.y}));b.fruit=o.fruit;b.artCenter=center;
      b.owner=owner;b.color=o.color;b.shapeName=o.name;b.lost=false;M.Body.setAngle(b,(state.rng()-.5)*(o.difficulty===1?.02:o.difficulty===2?.14:.32));state.bodies.push(b);M.Composite.add(state.engine.world,b);
      state.bodies.filter(p=>p.owner===owner).forEach(p=>M.Sleeping.set(p,false));
    }
    state.settling=true;state.elapsed=0;state.quiet=0;return true;
  }
  function step(state){
    if(!state.settling)return;state.time+=STEP;state.elapsed+=STEP;M.Engine.update(state.engine,STEP);
    const falling=state.bodies.filter(b=>!b.lost&&state.alive[b.owner]&&b.bounds.min.y>42).sort((a,b)=>b.bounds.min.y-a.bounds.min.y);
    for(const b of falling){if(!state.alive[b.owner])continue;state.alive[b.owner]=false;state.out.push(b.owner);state.events.push({kind:'out',owner:b.owner});}
    // Eliminated towers remain visible while tumbling, but cannot strike another tower.
    for(const b of state.bodies){if(!state.alive[b.owner]){if(!b.lost&&b.bounds.min.y<=42)M.Body.setStatic(b,true);b.lost=true;b.collisionFilter.mask=0;}if(b.position.y>650&&!b.removed){M.Composite.remove(state.engine.world,b);b.removed=true;}}
    const remaining=state.alive.map((a,i)=>a?i:null).filter(i=>i!==null);
    if(remaining.length<=(state.count===1?0:1)){state.ranking=remaining.concat([...state.out].reverse());state.settling=false;state.events.push({kind:'finished'});return;}
    const moving=state.bodies.some(b=>state.alive[b.owner]&&!b.isSleeping&&(b.speed>.18||Math.abs(b.angularVelocity)>.008));
    state.quiet=moving?0:state.quiet+STEP;
    if(state.elapsed>1600&&state.quiet>900||state.elapsed>14000){state.settling=false;state.events.push({kind:'settled'});}
  }
  return {STEP,GAP,BASE,shapes,colors,create,nextRound,choose,drop,step,x};
});
