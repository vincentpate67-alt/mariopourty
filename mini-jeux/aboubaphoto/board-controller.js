(() => {
  'use strict';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const array=value=>Array.isArray(value)?value:Object.values(value||{});
  const art=(url,fallback)=>{const img=el('img');img.alt='';img.src=url;img.loading='lazy';if(fallback)img.addEventListener('error',()=>{img.src=fallback;},{once:true});return img;};
  function route(map,start,target){
    const nodes=new Map(array(map.nodes).map(n=>[n.id,n])),edges=array(map.edges),best=new Map([[start,{steps:0,cost:0,path:[start]}]]),done=new Set();
    while(true){const candidates=[...best].filter(([id])=>!done.has(id)).sort((a,b)=>a[1].steps-b[1].steps||a[1].cost-b[1].cost);if(!candidates.length)return null;const [id,r]=candidates[0];if(id===target)return r;done.add(id);const options=edges.filter(e=>e.from===id).map(e=>({to:e.to,cost:0}));if(nodes.get(id)?.port)options.push({to:nodes.get(id).port,cost:3});
      for(const next of options){if(!nodes.has(next.to))continue;const v={steps:r.steps+(nodes.get(next.to).counts?1:0),cost:r.cost+next.cost,path:[...r.path,next.to]},old=best.get(next.to);if(!old||v.steps<old.steps||v.steps===old.steps&&v.cost<old.cost)best.set(next.to,v);}
    }
  }
  window.PourtyPhoneRoute=route;
  function formatted(parts){const fragment=document.createDocumentFragment();for(const part of array(parts)){
    if(Object.hasOwn(part,'text')){fragment.append(document.createTextNode(part.text));continue;}
    const tag=['strong','b','small','s','br','div','span'].includes(part.tag)?part.tag:'span',node=el(tag);
    if(part.color)node.style.color=part.color;
    if(['up','down','gold','flat'].includes(part.tone))node.classList.add('price-'+part.tone);
    node.append(formatted(part.children));fragment.append(node);
  }return fragment;}
  window.PourtyBoardController=({root,identity,send,readMap,sendReaction,sendMemePhoto,sendDrawing,clock=Date.now})=>{
    let view=null,pending='',pendingVersion='',active=false,last='',pendingTimer,serial=0;
    const widgets=window.PourtyPhoneWidgets({act:(id,value,version)=>execute(id,value,version)});
    const miniDrafts=new Map();let miniPreview='',miniScope='',clockView=null,clockFrame=0;
    const miniClock=el('div',undefined,'mini-phone-clock'),clockFill=el('i'),clockText=el('b');miniClock.append(clockFill,clockText);
    function clockTick(){if(clockView&&active){const left=Math.max(0,clockView.deadline-Date.now());clockText.textContent=Math.ceil(left/1000);clockFill.style.transform='scaleX('+Math.min(1,left/((clockView.duration||10)*1000))+')';miniClock.classList.toggle('urgent',left<5000);}clockFrame=requestAnimationFrame(clockTick);}clockFrame=requestAnimationFrame(clockTick);
    function miniForm(id,a){
      const form=el('form',undefined,'mini-phone-form'),input=el('input'),submit=el('button',a.label||'Valider');submit.type='submit';input.type=a.inputType==='number'?'number':'text';input.autocomplete='off';input.spellcheck=false;input.maxLength=a.maxLength||100;if(a.pattern)input.pattern=a.pattern;if(a.min!=='')input.min=a.min;if(a.max!=='')input.max=a.max;
      input.inputMode=a.inputType==='number'||a.maxLength===4?'numeric':'text';input.value=miniDrafts.get(id)??a.value??'';input.dataset.field=id;input.placeholder=a.title||'Ta réponse';input.setAttribute('aria-label',a.title||'Ta réponse');
      const digits=el('div',undefined,'mini-code-digits');
      function refresh(){miniDrafts.set(id,input.value);submit.disabled=!!pending||!input.value.trim();if(view.keyboard?.known){digits.replaceChildren();const known=view.keyboard.known,remaining=Array.from({length:10},(_,i)=>Number(known.present?.[i])||0),colors=Array(4).fill('');for(let i=0;i<4;i++)if(input.value[i]&&known.fixed?.[i]===input.value[i]){colors[i]='good';remaining[Number(input.value[i])]--;}for(let i=0;i<4;i++)if(input.value[i]&&!colors[i]&&remaining[Number(input.value[i])]>0){colors[i]='near';remaining[Number(input.value[i])]--;}for(let i=0;i<4;i++)digits.append(el('b',input.value[i]||'—',colors[i]));}}
      input.oninput=refresh;form.onsubmit=e=>{e.preventDefault();if(!pending&&input.value.trim()&&form.reportValidity())execute(id,input.value);};
      if(a.title)form.append(el('label',a.title));if(view.keyboard?.known)form.append(digits);form.append(input);
      if(view.keyboard?.letters){const keys=el('div',undefined,'mini-letter-keys');for(const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){const b=el('button',char);b.type='button';b.disabled=array(view.keyboard.used).some(c=>c.toUpperCase()===char);b.onclick=()=>{input.value=char;refresh();};keys.append(b);}form.append(keys);}
      form.append(submit);refresh();return form;
    }
    function miniScene(scene,entries){
      const field=el('div',undefined,'mini-phone-scene');field.style.aspectRatio=scene.aspect||1;
      if(scene.circle)field.classList.add('circle');if(scene.grid){field.style.setProperty('--grid',scene.grid);field.classList.add('grid');}
      for(const shape of array(scene.shapes)){const n=el('i',undefined,'mini-scene-shape');Object.assign(n.style,{left:shape.x+'%',top:shape.y+'%',width:(shape.w||shape.r*2||5)+'%',height:(shape.h||shape.r*2||5)+'%',background:shape.color||'#7392bd',borderRadius:shape.r?'50%':'5px'});if(scene.grid||shape.r)n.style.translate='-50% -50%';field.append(n);}
      if(scene.pizza){field.classList.add('pizza');const slices=array(scene.pizza);for(let i=0;i<slices.length;i++){const angle=(i+.5)*Math.PI*2/slices.length-Math.PI/2,mark=el('span',slices[i].type==='poop'?'💩':'●'.repeat(slices[i].count),'mini-pizza-topping');mark.style.left=(50+17*Math.cos(angle))+'%';mark.style.top=(50+17*Math.sin(angle))+'%';field.append(mark);const ray=el('i',undefined,'mini-pizza-ray');ray.style.transform='rotate('+(i*360/slices.length-90)+'deg)';field.append(ray);}}
      for(const [id,a]of entries.filter(([,a])=>a.kind==='point')){const b=el('button',a.label,'mini-point'+(miniPreview===id?' selected':''));b.style.left=a.x+'%';b.style.top=a.y+'%';b.disabled=!!pending;b.onclick=()=>miniAction(id,a);field.append(b);}
      const surface=entries.find(([,a])=>a.kind==='surface');if(surface)field.addEventListener('click',e=>{if(pending)return;const r=field.getBoundingClientRect();execute(surface[0],JSON.stringify({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}));});
      return field;
    }
    const panelCache=new Map();
    function miniPanel(p){const key=[view.game,p.kind,p.heading,p.title,p.bottom].join('|');let cached=panelCache.get(key);if(cached&&cached.signature===JSON.stringify(p))return cached.node;const node=el('section',undefined,'mini-panel mini-panel-'+p.kind+(p.bottom?' bottom':''));if(p.color)node.style.setProperty('--item-color',p.color);if(p.heading)node.append(el('small',p.heading));if(p.image)node.append(art(p.image));if(p.title)node.append(el('strong',p.title));if(p.value)node.append(el('b',p.value,p.stat?'stattrak':''));if(p.text)node.append(el('p',p.text));if(cached){cached.node.replaceChildren(...node.childNodes);cached.node.style.cssText=node.style.cssText;cached.signature=JSON.stringify(p);return cached.node;}panelCache.set(key,{node,signature:JSON.stringify(p)});return node;}
    function miniAction(id,a){if(a.preview){if(miniPreview===id){miniPreview='';execute(id,'confirm');}else{miniPreview=id;execute(id,'preview');}}else execute(id);}
    const actionBox=el('div',undefined,'board-actions');
    const mount=(parent,children)=>{children.forEach((node,index)=>{if(parent.children[index]!==node)parent.insertBefore(node,parent.children[index]||null);});while(parent.children.length>children.length)parent.lastElementChild.remove();};
    const wallet=el('div',undefined,'controller-wallet'),bag=el('div',undefined,'controller-inventory');identity.append(wallet);root.before(bag);wallet.hidden=true;bag.hidden=true;
    const reactions=[["guez", "T'es guez"], ["noob", "Noob"], ["ff", "FF"], ["chad", "Chad"], ["goat", "Goat"], ["porto", "Porto"], ["aboubakar", "Aboubakar"], ["skibidi", "Skibidi"], ["zzz", "Zzz..."], ["pog", "POG"], ["plait-il", "Plaît-il?"], ["yuki", "Nan gros yuki"], ["zebi", "Zebi"], ["mashallah", "Mashallah"], ["mog", "Mog"], ["67", "67"], ["tigre", "Tié un tigre"]],reactionDock=el('div',undefined,'phone-reactions'),reactionToggle=el('button',undefined,'reaction-toggle'),reactionMenu=el('div',undefined,'reaction-menu'),reactionStatus=el('span',undefined,'reaction-status');
    reactionToggle.type='button';reactionToggle.setAttribute('aria-label','Réactions');reactionToggle.setAttribute('aria-expanded','false');reactionToggle.innerHTML='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 5h18a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H14l-7 4v-4a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="2"/><path d="M10 18q6 6 12 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="11" cy="12" r="1.5" fill="currentColor"/><circle cx="21" cy="12" r="1.5" fill="currentColor"/></svg>';
    reactionMenu.hidden=true;reactionDock.hidden=true;reactionMenu.id='phone-reaction-menu';reactionToggle.setAttribute('aria-controls',reactionMenu.id);reactionStatus.setAttribute('aria-live','polite');reactionDock.append(reactionMenu,reactionStatus,reactionToggle);document.body.append(reactionDock);
    let reactionOpen=false,reactionUntil=0,reactionTimer=0;
    function toggleReactions(open){reactionOpen=open;reactionToggle.setAttribute('aria-expanded',String(open));clearTimeout(reactionTimer);reactionMenu.getAnimations?.().forEach(a=>a.cancel());if(open)reactionMenu.hidden=false;reactionMenu.animate?.(open?[{opacity:0,transform:'translateY(12px) scale(.85)'},{opacity:1,transform:'translateY(0) scale(1)'}]:[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(12px) scale(.85)'}],{duration:220,easing:'ease-out',fill:'both'});if(!open)reactionTimer=setTimeout(()=>{if(!reactionOpen)reactionMenu.hidden=true;},220);}
    reactionToggle.onclick=()=>toggleReactions(!reactionOpen);
    for(const [id,label]of reactions){const button=el('button');button.type='button';button.setAttribute('aria-label',label);button.append(art('../../assets/reactions/'+id+'.svg'));button.onclick=async()=>{
      if(!active||view?.garou||view?.meme?.phase==='vote'||Date.now()<reactionUntil||!sendReaction)return;reactionUntil=Date.now()+2100;reactionStatus.textContent='';toggleReactions(false);
      try{await sendReaction({id,nonce:crypto.getRandomValues(new Uint32Array(3)).join('-')});}catch{reactionUntil=0;reactionStatus.textContent='Réaction non envoyée. Réessaie.';}
    };reactionMenu.append(button);}
    const outsideReaction=e=>{if(reactionOpen&&!reactionDock.contains(e.target))toggleReactions(false);};document.addEventListener('pointerdown',outsideReaction);
    const accelerate=el('button','Accélérer','controller-accelerate');accelerate.type='button';accelerate.hidden=true;document.body.append(accelerate);
    let holding=false,holdTimer=null,holdChain=Promise.resolve();
    function sendHold(value){
      holdChain=holdChain.catch(()=>{}).then(async()=>{
        if(value!=='up'&&!holding)return;
        if(!active||!view?.canAct||!view.actions?.accelerate)return;
        await send({version:view.version,action:'accelerate',value,nonce:crypto.getRandomValues(new Uint32Array(3)).join('-')+'-'+(++serial)});
      }).catch(()=>{});
    }
    function release(){if(!holding)return;holding=false;clearInterval(holdTimer);accelerate.classList.remove('held');sendHold('up');}
    accelerate.addEventListener('pointerdown',e=>{if(e.button!==0||holding||accelerate.hidden)return;e.preventDefault();holding=true;accelerate.classList.add('held');accelerate.setPointerCapture?.(e.pointerId);sendHold('down');holdTimer=setInterval(()=>sendHold('hold'),600);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])accelerate.addEventListener(event,release);
    accelerate.addEventListener('contextmenu',e=>e.preventDefault());
    accelerate.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&!holding){e.preventDefault();holding=true;accelerate.classList.add('held');sendHold('down');holdTimer=setInterval(()=>sendHold('hold'),600);}});
    accelerate.addEventListener('keyup',release);
    const onHidden=()=>{if(document.hidden)release();};document.addEventListener('visibilitychange',onHidden);window.addEventListener('blur',release);window.addEventListener('pagehide',release);
    async function execute(id,value,version=view?.version){
      if(!active||pending||!view?.canAct||view.version!==version||!view.actions?.[id]||view.actions[id].disabled)return false;
      const nonce=crypto.getRandomValues(new Uint32Array(3)).join('-')+'-'+(++serial);pending=nonce;pendingVersion=view.version;render(true);clearTimeout(pendingTimer);
      pendingTimer=setTimeout(()=>{if(pending===nonce){pending='';widgets.clear();render(true);if(!view?.garou){const n=el('p','Pas de réponse de l’hôte. Réessaie.','controller-error');root.append(n);}}},5000);
      try{await send({version:view.version,action:id,nonce,...(value===undefined?{}:{value:String(value)})});return true;}catch(e){pending='';widgets.clear();clearTimeout(pendingTimer);render(true);root.append(el('p','Cette action n’est plus disponible.','controller-error'));return false;}
    }
    const memeUI=window.PourtyMemePhone?.({root,identity,send:(id,value)=>execute(id,value),sendPhoto:sendMemePhoto,now:clock});
    const responsesUI=window.PourtyResponsesPhone?.({root,identity,send:(id,value)=>execute(id,value),now:clock});
    const garouUI=window.PourtyGarouPhone?.({root,send:(id,value)=>execute(id,value),now:clock});
    const drawingUI=window.PourtyDrawingPhone?.({root,identity,send:(id,value)=>execute(id,value),sendDrawing,now:clock});
    function render(force=false){
      if(!active||!view)return;const fingerprint=JSON.stringify(view)+pending;if(!force&&fingerprint===last)return;last=fingerprint;
      const focused=document.activeElement?.dataset.field,value=focused?document.activeElement.value:null;
      document.body.style.setProperty('--controller-color',view.color||'#6482b3');document.body.classList.toggle('controller-ready',!!view.ready);
      if(view.garou&&garouUI){drawingUI?.hide();responsesUI?.hide();memeUI?.hide();clockView=null;wallet.hidden=true;bag.hidden=true;release();accelerate.hidden=true;garouUI.update(view);return;}garouUI?.hide();
      if(view.drawing&&drawingUI){memeUI?.hide();responsesUI?.hide();clockView=null;wallet.hidden=true;bag.hidden=true;release();accelerate.hidden=true;drawingUI.update(view);return;}drawingUI?.hide();
      if(view.responses&&responsesUI){memeUI?.hide();clockView=null;wallet.hidden=true;bag.hidden=true;release();accelerate.hidden=true;responsesUI.update(view);return;}responsesUI?.hide();
      if(view.meme&&memeUI){clockView=null;wallet.hidden=true;bag.hidden=true;release();accelerate.hidden=true;memeUI.update(view);return;}memeUI?.hide();wallet.hidden=false;
      wallet.replaceChildren(...(view.mini?[...(view.wins===null||view.wins===undefined?[]:[el('span','🏆 '+view.wins,'mini-session-wins')]),el('span',view.score||'','mini-phone-score')]:[el('span','★ '+view.stars),el('span',view.ac+' AC')]));bag.hidden=!!view.mini;bag.replaceChildren();if(view.mini){const scope=view.game+':'+view.key;if(scope!==miniScope){miniScope=scope;miniDrafts.clear();miniPreview='';}clockView=view.deadline?view:null;}else clockView=null;
      for(let i=0;i<(view.mini?0:view.capacity||3);i++){
        const p=array(view.inventory)[i],inspect=Object.entries(view.actions||{}).find(([,a])=>a.kind==='inspect'&&a.index===i),slot=el(p?'button':'div',undefined,'controller-slot');
        if(p){slot.type='button';if(p.image)slot.append(art(p.image,p.fallback));slot.append(el('span',p.name,'inventory-name'));slot.title=p.description;slot.disabled=!inspect||!!pending;slot.classList.toggle('selected',view.selectedItem===i);slot.onclick=()=>inspect&&execute(inspect[0]);}else slot.append(el('span','—'));bag.append(slot);
      }
      const children=[],actionNodes=[],pianoKeys=[],bowlingPositions=[],golfDirections=[],entries=Object.entries(view.actions||{}).filter(([,a])=>!a.disabled);
      if(view.mini&&view.deadline)children.push(miniClock);
      actionBox.dataset.layout=view.layout||'';
      if(view.mini&&view.secret)children.push(el('div',view.secret,'mini-phone-secret'));
      if(view.ready)children.push(el('p','À toi de jouer','controller-ready-title'));
      if(view.title&&view.title!=='À toi de jouer')children.push(el('h2',view.title));
      if(view.note)children.push(el('p',view.note,'controller-note'));
      entries.sort((a,b)=>Number(!['number','select'].includes(a[1].kind))-Number(!['number','select'].includes(b[1].kind))||(a[1].order??0)-(b[1].order??0));
      for(const [id,a]of entries){if(['inspect','gift','accelerate','map-control','point','surface'].includes(a.kind))continue;
        if(a.kind==='power'){
          const label=el('label',undefined,'mini-power'),caption=el('b','Puissance · '+a.value),range=el('input');range.type='range';range.min=a.min;range.max=a.max;range.step=1;range.value=a.value;range.disabled=!!pending;range.setAttribute('aria-label','Puissance');range.oninput=()=>caption.textContent='Puissance · '+range.value;range.onchange=()=>execute(id,range.value);label.append(caption,range);actionNodes.push(label);continue;
        }
        if(a.kind==='entry'){actionNodes.push(miniForm(id,a));continue;}
        if(a.kind==='number'||a.kind==='select'){
          const label=el('label',a.label,'board-field'),field=el(a.kind==='number'?'input':'select');field.dataset.field=id;
          if(a.kind==='number'){field.type='number';field.inputMode='numeric';field.min=a.min;field.max=a.max;field.step=a.step;}else array(a.options).forEach(o=>{const option=el('option',o.label);option.value=o.value;option.disabled=o.disabled;field.append(option);});field.value=focused===id&&!pending?value:a.value;field.disabled=!!pending;field.addEventListener('change',()=>execute(id,field.value));label.append(field);actionNodes.push(label);continue;
        }
        if(a.kind==='dice'){actionNodes.push(widgets.dice(id,a,view.version));continue;}
        if(a.kind==='direction'){actionNodes.push(widgets.direction(id,a,view.version));continue;}
        if(a.kind==='block'){actionNodes.push(widgets.block(id,a,view.version));continue;}
        const button=el('button',undefined,'board-action'+(a.kind==='use'?' use-item':''));button.disabled=!!pending;
        if(a.kind!=='use'&&a.image)button.append(art(a.image));if(a.content){const text=el('span',undefined,'phone-rich-label');text.append(formatted(a.content));button.append(text);}else button.append(el('span',a.label));
        if(a.kind!=='use'&&a.description)button.append(el('small',a.description));if(a.selected)button.classList.add('selected');if(view.mini){button.classList.add('mini-action');button.classList.toggle('mini-circle',a.kind==='circle');button.classList.toggle('mini-answer',a.kind==='answer');button.classList.toggle('mini-player',a.kind==='player');button.classList.toggle('mini-buzz',a.kind==='buzz');button.classList.toggle('mini-piano-key',a.kind==='piano');button.classList.toggle('black',!!a.black);if(a.color)button.style.setProperty('--button-color',a.color);if(miniPreview===id)button.append(el('small','Toucher à nouveau pour confirmer'));}if(view.mini){
          if(a.card){button.classList.add('mini-themed');button.dataset.theme=a.theme||'';Object.assign(button.style,{background:a.card.background,backgroundImage:a.card.backgroundImage||'none',borderColor:a.card.border,boxShadow:a.card.shadow});const title=button.querySelector(':scope>span');if(title)title.style.color=a.card.color;}
          if(a.difficulty){const stars=el('div',undefined,'mini-difficulty');for(let i=1;i<=3;i++)stars.append(el('span','★',i>a.difficulty?'empty':''));button.append(stars);}
          if(a.alias)button.append(el('small',a.alias,'piano-alias'));
          if(a.gridIndex!==undefined){button.style.gridColumn=String(a.gridIndex%5+1);button.style.gridRow=String(Math.floor(a.gridIndex/5)+1);}
        }
        button.onclick=()=>view.mini?miniAction(id,a):execute(id);if(view.mini&&a.kind==='piano'){button.style.setProperty('--key-position',a.position);pianoKeys.push(button);}else if(a.kind==='bowling-position'){button.classList.add('mini-bowling-dot');bowlingPositions.push(button);}else if(a.kind==='golf-direction'){button.style.gridColumn=String(Math.sign(a.dx)+2);button.style.gridRow=String(Math.sign(a.dy)+2);golfDirections.push(button);}else actionNodes.push(button);
      }
      if(view.remoteMap?.open){
        const pad=el('div',undefined,'controller-dpad'),labels={up:'↑',down:'↓',left:'←',right:'→',plus:'+',minus:'−',close:'Retour',confirm:'Poser le piège ici'},accessible={up:'Case au-dessus',down:'Case en dessous',left:'Case à gauche',right:'Case à droite',plus:'Zoomer',minus:'Dézoomer'};
        for(const [id,a]of entries.filter(([,a])=>a.kind==='map-control')){const button=el('button',labels[a.command],'map-control map-'+a.command);button.setAttribute('aria-label',accessible[a.command]||labels[a.command]);button.disabled=!!pending;button.onclick=()=>execute(id);pad.append(button);}
        actionNodes.push(pad);
      }
      if(bowlingPositions.length){const column=el('div',undefined,'mini-bowling-positions');column.append(...bowlingPositions);actionNodes.unshift(column);}
      if(golfDirections.length){const pad=el('div',undefined,'mini-golf-pad'),ball=el('i',undefined,'mini-golf-ball');pad.append(ball,...golfDirections);actionNodes.unshift(pad);}
      if(view.ranking){const rank=el('section',undefined,'mini-final-ranking');rank.append(el('strong','#'+view.rank,'my-final-rank'));for(const row of array(view.ranking).sort((a,b)=>a.rank-b.rank)){const r=el('div','#'+row.rank+' · '+row.name);r.style.color=row.color;rank.append(r);}children.push(rank);}
      for(const panel of array(view.panels).filter(p=>!p.bottom))children.push(miniPanel(panel));
      if(pianoKeys.length){const piano=el('div',undefined,'mini-phone-piano');piano.append(...pianoKeys);children.push(piano);}
      if(view.mini&&view.scene)children.push(miniScene(view.scene,entries));
      mount(actionBox,actionNodes);children.push(actionBox);
      if(view.visual?.kind==='gift')children.push(widgets.gift(view.visual,view.version));
      for(const r of array(view.readouts)){const card=el('div',undefined,'controller-readout');if(r.image)card.append(art(r.image));const text=el('span',undefined,'phone-rich-label');text.append(r.content?formatted(r.content):document.createTextNode(r.text));card.append(text);children.push(card);}
      for(const panel of array(view.panels).filter(p=>p.bottom))children.push(miniPanel(panel));
      mount(root,children);
      if(!view.canAct||!view.actions?.accelerate)release();accelerate.hidden=!view.canAct||!view.actions?.accelerate;

      if(pending)root.querySelectorAll('.phone-dice-launch,.phone-gift,.phone-direction,.phone-hidden-block').forEach(b=>b.disabled=true);
      if(focused&&!pending){const field=[...root.querySelectorAll('[data-field]')].find(f=>f.dataset.field===focused);field?.focus();}
      widgets.prune();
    }
    return {photoReactions(){if(view){this.hide();view=null;}active=true;reactionDock.hidden=!sendReaction;},update(next){active=true;reactionDock.hidden=!sendReaction||!!next?.garou||next?.meme?.phase==='vote';if((next?.garou||next?.meme?.phase==='vote')&&reactionOpen)toggleReactions(false);wallet.hidden=false;bag.hidden=false;document.body.classList.add('board-controller');view=next;if(!view){root.replaceChildren(el('h2','Le plateau arrive…'));return;}if(pending&&(view.ack===pending||view.version!==pendingVersion)){pending='';clearTimeout(pendingTimer);}render();},hide(){garouUI?.hide();drawingUI?.hide();responsesUI?.hide();memeUI?.hide();clockView=null;reactionDock.hidden=true;toggleReactions(false);release();accelerate.hidden=true;active=false;clearTimeout(pendingTimer);pending='';wallet.hidden=true;bag.hidden=true;document.body.classList.remove('board-controller','controller-ready');widgets.clear();last='';},destroy(){garouUI?.destroy();drawingUI?.destroy();responsesUI?.destroy();memeUI?.destroy();cancelAnimationFrame(clockFrame);clearTimeout(reactionTimer);document.removeEventListener('pointerdown',outsideReaction);reactionDock.remove();release();clearInterval(holdTimer);document.removeEventListener('visibilitychange',onHidden);window.removeEventListener('blur',release);window.removeEventListener('pagehide',release);clearTimeout(pendingTimer);accelerate.remove();wallet.remove();bag.remove();}};
  };
})();
