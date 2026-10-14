(() => {
  window.PourtyTropicalUI=ctx=>{
    const {engine,model,session,canvas,pause}=ctx,get=ctx.getState;let running=false,showPending=false;
    const panel=document.createElement('section');panel.className='tropical-overlay';panel.hidden=true;
    const content=document.createElement('div');content.className='tropical-content';const title=document.createElement('h2'),note=document.createElement('p'),row=document.createElement('div'),buttons=document.createElement('div');row.className='tropical-row';buttons.className='tropical-buttons';content.append(title,note,row,buttons);panel.append(content);document.body.append(panel);
    const update=s=>{ctx.setState(s);ctx.render();};
    function image(src,cls=''){const i=document.createElement('img');i.src=src;i.alt='';i.className=cls;return i;}
    function button(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{if(!running)action();});buttons.append(b);return b;}
    function open(heading){panel.classList.remove('port-view');title.textContent=heading;note.textContent='';row.replaceChildren();buttons.replaceChildren();panel.hidden=false;content.animate?.([{opacity:0,transform:'translateY(16px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:420,easing:'ease-out'});panel.animate?.([{opacity:0},{opacity:1}],{duration:300});}
    async function close(){if(panel.hidden)return;const a=panel.animate?.([{opacity:1},{opacity:0}],{duration:300,fill:'both'});await pause(300);panel.hidden=true;a?.cancel();}
    const sprite=r=>r.kind==='item'?model.items[r.itemId].image:r.kind==='stars'?'../assets/items/star.png':'../assets/items/coin.png';
    const label=r=>r.kind==='item'?model.items[r.itemId].name:r.kind==='stars'?'+1 étoile':'+'+r.amount+' AC';

    const ns='http://www.w3.org/2000/svg',colors=['red','blue','green','yellow','pink'],colorNames=['rouge','bleu','vert','jaune','rose'];
    function svgEl(tag,attrs={}){const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;}
    function drawTreasure(){
      const t=get().treasure;let marker=canvas.world.querySelector('.treasure-marker');
      if(!t?.node){marker?.remove();return;}
      const node=session.board.nodes.find(n=>n.id===t.node);if(!node)return;
      if(marker&&marker.dataset.node!==t.node){marker.remove();marker=null;}
      if(!marker){
        marker=svgEl('g',{class:'treasure-marker','pointer-events':'none'});marker.dataset.node=t.node;
        const motion=svgEl('g',{class:'treasure-motion'}),body=svgEl('image',{href:'../assets/plateaux/chest-base.svg',x:-32,y:-34,width:64,height:64}),lid=svgEl('g',{class:'treasure-lid'});
        lid.append(svgEl('image',{href:'../assets/plateaux/chest-lid.svg',x:-32,y:-34,width:64,height:64}));
        motion.append(body,lid);marker.append(motion);canvas.world.insertBefore(marker,canvas.pawnLayer||null);
      }
      marker.setAttribute('transform','translate('+node.x+' '+node.y+')');
      marker.style.visibility=t.pending&&!showPending?'hidden':'visible';
    }
    function clearRoute(){canvas.world.querySelector('.port-preview')?.remove();}
    function portMenu(){
      if(ctx.isMapOpen()){panel.hidden=true;clearRoute();return;}if(ctx.portChoicesVisible())return;panel.hidden=true;const t=get().tropical;
      const from=session.board.nodes.find(n=>n.id===t.from),to=session.board.nodes.find(n=>n.id===t.to);
      clearRoute();const group=svgEl('g',{class:'port-preview','pointer-events':'none'}),defs=svgEl('defs'),marker=svgEl('marker',{id:'port-route-tip',viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:5,markerHeight:5,orient:'auto'});
      marker.append(svgEl('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'currentColor'}));defs.append(marker);
      const d='M '+from.x+' '+from.y+' Q '+(from.x+to.x)/2+' '+((from.y+to.y)/2-36)+' '+to.x+' '+to.y;
      group.append(defs,svgEl('path',{d,fill:'none',stroke:'currentColor','stroke-width':3,'stroke-linecap':'round','marker-end':'url(#port-route-tip)'}));canvas.world.append(group);
      group.animate?.([{opacity:0},{opacity:1}],{duration:600});ctx.framePorts(t.from,t.to);
      ctx.showPortChoices();
    }
    async function voyage(){running=true;ctx.clearPortChoices();await close();clearRoute();const t=get().tropical;await ctx.animateChanges([{id:t.owner,resource:'ac',delta:-(t.cost??3)}],t.before);if(!ctx.alive())return;await ctx.voyage(t);if(!ctx.alive())return;running=false;update(engine.finishVoyage(get()));}
    function fishMenu(){open('Pêche');const t=get().tropical,node=session.board.nodes.find(n=>n.id===t.node),stock=get().fishingSpots[t.node];note.textContent=node.event==='fishing-items'?'Pêche aux objets':'Pêche aux pièces et étoiles';row.classList.add('fishing-row');stock.forEach((reward,index)=>{if(!reward){const empty=document.createElement('span');empty.className='fishing-empty';empty.setAttribute('aria-label','Canne déjà utilisée');row.append(empty);return;}const b=document.createElement('button');b.type='button';b.className='fishing-rod';b.setAttribute('aria-label','Choisir la canne à appât '+colorNames[index]);b.append(image('../assets/plateaux/fishing-rod-'+colors[index]+'.svg'));b.addEventListener('click',()=>{if(!running)update(engine.selectFishing(get(),index));});row.append(b);});}
    async function fishReveal(){running=true;const t=get().tropical,r=t.reward;open('');row.classList.remove('fishing-row');note.textContent='';const rod=image('../assets/plateaux/fishing-rod-'+colors[t.index]+'.svg','chosen-rod');row.append(rod);rod.animate?.([{transform:'rotate(0)'},{transform:'rotate(-12deg)',offset:.4},{transform:'translateY(-32px) rotate(8deg)'}],{duration:1000,easing:'ease-in-out',fill:'forwards'});await pause(1000);if(!ctx.alive())return;row.replaceChildren();const prize=image(sprite(r),'fishing-prize');if(r.kind==='item')model.itemImage(prize,r.itemId);row.append(prize);title.textContent=label(r);prize.animate?.([{opacity:0,transform:'translateY(50px) scale(.25)'},{opacity:1,transform:'translateY(-5px) scale(1.08)',offset:.7},{opacity:1,transform:'none'}],{duration:650,easing:'ease-out'});title.animate?.([{opacity:0,transform:'scale(.8)'},{opacity:1,transform:'scale(1)'}],{duration:450});await pause(1500);await close();if(!ctx.alive())return;running=false;update(engine.claimFishing(get()));}
    async function fishPaid(){running=true;await close();const t=get().tropical,r=t.reward;if(r.kind==='stars')await ctx.dropItem('star',t.owner);if(r.kind!=='item')await ctx.animateChanges([{id:t.owner,resource:r.kind,delta:r.amount}],t.before);if(!ctx.alive())return;running=false;update(engine.finishFishing(get()));}

    async function lid(open,duration=380){
      const el=canvas.world.querySelector('.treasure-lid');if(!el)return;
      const from=el.style.transform||'translateY(0px) scaleY(1)',to=open?'translateY(-17px) scaleY(.7)':'translateY(0px) scaleY(1)';
      const anim=el.animate?.([{transform:from},{transform:to}],{duration,easing:'ease-in-out',fill:'both'});
      await pause(duration);el.style.transform=to;anim?.cancel();
    }
    async function depositCoins(count){
      const flights=[];
      for(let i=0;i<count;i++){
        if(!ctx.alive())break;
        const point=ctx.nodeScreen(get().treasure.node),coin=image('../assets/items/coin.png','treasure-deposit-coin');
        coin.style.left=point.x+'px';coin.style.top=(point.y-8*canvas.view.scale)+'px';document.body.append(coin);
        const anim=coin.animate?.([{opacity:0,transform:'translate('+((i%2?1:-1)*35)+'px,-140px) scale(.6)'},{opacity:1,transform:'translate(0,-55px) scale(1)',offset:.45},{opacity:0,transform:'translate(0,0) scale(.2)'}],{duration:380,easing:'ease-in',fill:'both'});
        flights.push((anim?.finished||pause(380)).catch(()=>{}).then(()=>coin.remove()));await pause(65);
      }
      await Promise.all(flights);
    }
    async function chestIntro(){
      running=true;const title=document.getElementById('star-announcement');
      title.textContent='Apparition du coffre';title.hidden=false;title.classList.remove('play');void title.offsetWidth;title.classList.add('play');await pause(1450);title.hidden=true;
      await ctx.focusNode(get().treasure.node);if(!ctx.alive())return;
      const el=canvas.world.querySelector('.treasure-motion'),height=(window.innerHeight||900)/canvas.view.scale;
      const anim=el?.animate?.([{opacity:0,transform:'translateY(-'+height+'px) scale(.85)'},{opacity:1,transform:'translateY(0) scale(.85)',offset:.76},{opacity:1,transform:'translateY(3px) scale(.94,.73)',offset:.86},{opacity:1,transform:'translateY(0) scale(.85)'}],{duration:1100,easing:'cubic-bezier(.35,0,.75,1)',fill:'both'});
      showPending=true;drawTreasure();await pause(1100);if(el)el.style.transform='scale(.85)';anim?.cancel();
      await lid(true,200);await depositCoins(5);await lid(false,200);
      if(!ctx.alive())return;const after=get().tropical.after;
      if(after==='turn')await ctx.focusNode(get().positions[engine.active(get())]);
      const next=engine.finishTreasureIntro(get());showPending=false;running=false;update(next);
    }
    async function chestFill(){
      running=true;await ctx.focusNode(get().treasure.node);await lid(true);await depositCoins(get().tropical.deposit);await lid(false,200);
      if(!ctx.alive())return;if(get().tropical.after==='turn')await ctx.focusNode(get().positions[engine.active(get())]);
      running=false;update(engine.finishTreasureFill(get()));
    }
    async function chestCollect(){
      running=true;await ctx.focusNode(get().tropical.node);await lid(true);
      if(!ctx.alive())return;running=false;update(engine.claimTreasure(get(),session.board));
    }
    async function chestPaid(){
      running=true;const t=get().tropical;const top=canvas.world.querySelector('.treasure-lid');if(top)top.style.transform='translateY(-17px) scaleY(.7)';
      await ctx.animateChestCoins(t.owner,t.amount,t.before,()=>{const p=ctx.nodeScreen(t.node);return {x:p.x,y:p.y-8*canvas.view.scale};});
      const el=canvas.world.querySelector('.treasure-motion');el?.animate?.([{opacity:1,transform:'scale(.85)'},{opacity:0,transform:'scale(0)'}],{duration:650,easing:'ease-in-out',fill:'both'});await pause(650);
      if(!ctx.alive())return;running=false;update(engine.finishTreasure(get()));
    }
    return {drawTreasure,render(){const s=get();if(s.phase==='turn'&&s.treasure?.pending&&!running){update(engine.beginTreasureIntro(s));return true;}if(!s.phase.startsWith('tropical-')){if(!running){panel.hidden=true;clearRoute();}return false;}if(running)return true;row.classList.remove('fishing-row');if(s.phase==='tropical-port')portMenu();else if(s.phase==='tropical-voyage')voyage();else if(s.phase==='tropical-fishing')fishMenu();else if(s.phase==='tropical-fish-reveal')fishReveal();else if(s.phase==='tropical-fish-paid')fishPaid();else if(s.phase==='tropical-intro')chestIntro();else if(s.phase==='tropical-fill')chestFill();else if(s.phase==='tropical-chest')chestCollect();else if(s.phase==='tropical-chest-paid')chestPaid();return true;}};
  };
})();
