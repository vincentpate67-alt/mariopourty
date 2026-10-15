(() => {
  'use strict';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const list=v=>Array.isArray(v)?v:Object.values(v||{});
  const image=src=>{const n=el('img');n.src=src;n.alt='';n.draggable=false;return n;};
  const animate=(node,frames,options)=>{const animation=node.animate?.(frames,options);return animation?.finished?.catch(()=>{})||Promise.resolve();};
  window.PourtyPhoneWidgets=({act})=>{
    const cache=new Map();
    function dice(id,action,version){
      const key='dice:'+id+':'+JSON.stringify(action.dice);let entry=cache.get(key);
      if(entry){entry.version=version;return entry.node;}
      const node=el('div',undefined,'phone-dice-stage'),button=el('button',undefined,'phone-dice-launch');button.type='button';button.setAttribute('aria-label',action.label);button.style.setProperty('--dice-count',list(action.dice).length);
      entry={node,version,flying:false};cache.set(key,entry);
      for(const spec of list(action.dice)){
        const die=el('span',undefined,'phone-die'+(spec.small?' mini':'')+(spec.rigged?' rigged':'')),cube=el('span',undefined,'phone-die-cube');die.dataset.kind=spec.kind;
        if(spec.background&&spec.background!=='none')die.style.setProperty('--die-background',spec.background);if(spec.edge)die.style.setProperty('--die-edge',spec.edge);if(spec.ink)die.style.setProperty('--die-ink',spec.ink);
        for(const [i,side]of ['front','back','right','left','top','bottom'].entries()){
          const face=el('span',undefined,'phone-die-face '+side),data=list(spec.faces)[i]||{text:'?'};
          if(data.avatar){const avatar=el('span',data.text,'phone-die-avatar');avatar.style.background=data.avatar;face.append(avatar);}
          else if(data.dot){const dot=el('span',undefined,'phone-die-dot');dot.style.background=data.dot;face.append(dot);}
          else {if(data.image)face.append(image(data.image));if(data.text)face.append(el('span',data.text));}
          cube.append(face);
        }
        die.append(cube);button.append(die);
      }
      node.append(button);let drag=null,suppressClick=false;
      async function launch(dx=0,dy=-1){
        if(entry.flying||button.disabled)return;entry.flying=true;const expected=entry.version;button.disabled=true;
        const distance=Math.max(innerHeight,innerWidth)+250,length=Math.hypot(dx,dy)||1,x=dx/length*distance,y=dy/length*distance;
        await animate(button,[{transform:button.style.transform||'none',opacity:1},{transform:`translate(${x}px,${y}px) rotate(${dx>0?22:-18}deg) scale(.6)`,opacity:0}],{duration:360,easing:'cubic-bezier(.4,0,.8,.3)',fill:'forwards'});
        const accepted=await act(id,undefined,expected);if(accepted===false){button.getAnimations?.().forEach(a=>a.cancel());button.style.transform='';button.disabled=false;entry.flying=false;}
      }
      button.onclick=()=>{if(!suppressClick)launch();};
      button.onpointerdown=e=>{if(entry.flying||button.disabled)return;drag={x:e.clientX,y:e.clientY};button.setPointerCapture?.(e.pointerId);};
      button.onpointermove=e=>{if(!drag||entry.flying)return;button.style.transform=`translate(${e.clientX-drag.x}px,${e.clientY-drag.y}px) rotate(${(e.clientX-drag.x)*.08}deg)`;};
      button.onpointerup=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag=null;if(button.hasPointerCapture?.(e.pointerId))button.releasePointerCapture(e.pointerId);if(Math.hypot(dx,dy)>85||e.clientY<15||e.clientX<15||e.clientX>innerWidth-15){suppressClick=true;launch(dx,dy);setTimeout(()=>suppressClick=false,500);}else{button.style.transform='';}};
      button.onpointercancel=()=>{drag=null;button.style.transform='';};return node;
    }
    function gift(spec,version){
      const key='gift:'+spec.key;let entry=cache.get(key);
      if(!entry){
        const node=el('div',undefined,'phone-gift-stage'+(spec.rock?' rock':'')),button=el('button',undefined,'phone-gift'),glow=el('span',undefined,'phone-gift-glow'),body=image(spec.body),lid=image(spec.lid),dots=el('div',undefined,'phone-gift-dots'),name=el('h2',undefined,'phone-prize-name');body.className='phone-gift-body';lid.className='phone-gift-lid';lid.hidden=spec.rock;
        for(let i=0;i<3;i++)dots.append(el('span'));button.append(glow,body,lid);node.append(button,dots,name);entry={node,button,glow,body,lid,dots,name,clicks:0,revealed:false,version,spec};cache.set(key,entry);
        button.onclick=()=>{if(!entry.spec.action||button.disabled)return;animate(button,[{transform:'scale(1)'},{transform:'scale(.92) rotate(-6deg)',offset:.18},{transform:'scale(1.08) rotate(6deg)',offset:.45},{transform:'scale(1.02) rotate(-3deg)',offset:.7},{transform:'scale(1)'}],{duration:430,easing:'ease-out'});act(entry.spec.action,undefined,entry.version);};
      }
      entry.version=version;entry.spec=spec;entry.button.disabled=!spec.action;entry.button.setAttribute('aria-label',(spec.rock?'Casser le caillou':'Ouvrir le cadeau')+' · '+spec.clicks+' sur 3');entry.glow.style.opacity=String(.25+spec.clicks*.22);list([...entry.dots.children]).forEach((d,i)=>d.classList.toggle('lit',i<spec.clicks));entry.body.classList.toggle('cracked',spec.rock&&spec.clicks>0);
      if(spec.clicks>=3&&entry.clicks<3){
        entry.dots.hidden=true;
        if(spec.rock)for(let i=0;i<9;i++){const fragment=el('span',undefined,'phone-rock-fragment'),angle=i*Math.PI*2/9;entry.button.append(fragment);animate(fragment,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:`translate(${Math.cos(angle)*150}px,${Math.sin(angle)*130}px) rotate(${i*70}deg) scale(.2)`}],{duration:750,easing:'ease-out',fill:'forwards'}).then(()=>fragment.remove());}
        animate(entry.lid,[{opacity:1,transform:'none'},{opacity:1,transform:'translateY(-65px) rotate(-13deg)',offset:.4},{opacity:0,transform:'translateY(-160px) rotate(-25deg)'}],{duration:700,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
        animate(entry.glow,[{opacity:.75,transform:'scale(.8)'},{opacity:1,transform:'scale(1.65)',offset:.45},{opacity:.35,transform:'scale(1.3)'}],{duration:900,fill:'forwards'});
        animate(entry.body,[{opacity:1,transform:'scale(1)'},{opacity:spec.rock?0:.25,transform:spec.rock?'scale(.1)':'translateY(22px) scale(.85)'}],{duration:650,fill:'forwards'});
      }
      entry.clicks=spec.clicks;
      if(spec.prize&&!entry.revealed){entry.revealed=true;const prize=image(spec.prize);prize.className='phone-gift-prize';entry.button.append(prize);animate(prize,[{opacity:0,transform:'translateY(35px) scale(.2)'},{opacity:1,transform:'translateY(-35px) scale(1.12)',offset:.65},{opacity:1,transform:'translateY(-25px) scale(1)'}],{duration:750,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});entry.name.textContent=spec.prizeName;animate(entry.name,[{opacity:0,transform:'scale(.6)'},{opacity:1,transform:'scale(1)'}],{duration:600,easing:'ease-out'});}
      return entry.node;
    }
    function direction(id,a,version){
      const d=a.direction,node=el('button',undefined,'phone-direction'+(d.gold?' gold':'')),arrow=el('span','➜','phone-direction-arrow'),box=el('span',undefined,'phone-direction-box');arrow.style.setProperty('--angle',d.angle+'deg');box.append(el('strong',d.title),el('small',d.caption));
      for(const c of list(d.landings)){const row=el('span',undefined,'phone-landing'),badge=el('span',undefined,'phone-case');badge.style.setProperty('--case-color',c.color);if(c.image)badge.append(image(c.image));else badge.textContent=c.symbol;row.append(badge,el('span',c.name));box.append(row);}
      if(d.distance)box.append(el('small',d.distance,'phone-star-distance'));if(d.fare)box.append(el('b',d.fare,'phone-port-fare'));node.classList.toggle('previewed',!!a.previewed);node.setAttribute('aria-pressed',String(!!a.previewed));if(a.previewed)box.append(el('small','Toucher à nouveau pour choisir','phone-direction-confirm'));node.append(arrow,box);node.onclick=()=>act(id,undefined,version);return node;
    }
    function block(id,a,version){const node=el('button',undefined,'phone-hidden-block');node.append(image(a.image));node.setAttribute('aria-label',a.label);node.onclick=async()=>{if(node.disabled)return;node.disabled=true;await animate(node,[{transform:'scale(1)'},{transform:'translateY(-35px) scale(1.15)',offset:.5},{transform:'scale(.5)',opacity:0}],{duration:400,fill:'forwards'});act(id,undefined,version);};return node;}
    return {dice,gift,direction,block,prune(){for(const [key,entry]of cache)if(!entry.node.isConnected)cache.delete(key);},clear(){cache.clear();}};
  };
})();
