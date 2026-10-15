(() => {
  'use strict';
  const visible=e=>!!e&&e.isConnected&&!e.closest('[hidden]')&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getClientRects().length>0;
  const roots=['#intro','#dice-panel','#player-actions','#items-panel','#choice-layer','#star-offer','#event-overlay','#shop-layer','#object-panel','.fate-overlay','.casino-overlay','.fair-overlay','.tropical-overlay','.street-overlay','.slots-overlay'];
  const url=src=>{if(!src)return '';try{const u=new URL(src,location.href);return u.origin===location.origin?u.pathname+u.search+u.hash:'';}catch{return '';}};
  function owner(s,engine){
    if(s.phase==='intro')return s.introQueue[s.introCursor];
    if(s.phase==='order-ready')return s.order[0];
    if(s.phase==='effect-dice')return s.effect?.kind==='boo-coins'?s.effect.victim:s.effect?.owner;
    if(s.phase==='gift-replace')return s.gift?.owner;
    if(s.phase==='stolen-choice')return s.stolenChoice?.owner;
    if(s.phase==='inventory-discard')return s.inventoryDiscard?.owner;
    if(s.phase==='street-item')return s.streetAction?.owner;
    if(s.phase==='fate-item-choice')return s.fate?.to;
    return engine.active(s) ?? s.order?.[Math.min(s.turn,s.order.length-1)] ?? 0;
  }
  window.PourtyBoardPhoneOwner=owner;
  window.PourtyBoardPhones=ctx=>{
    const bridge=window.parent!==window&&window.parent.PourtySession;if(!bridge?.boardPublish)return;
    const {engine,model,board,session,players}=ctx;let stopped=false,working=false,last='',version='',semantic='',serial=0,bindings=new Map(),room=null,ack={};
    let selectedItem=null,selectedDirection=null,heldSeat=null,holdUntil=0;
    function releaseHold(){if(heldSeat!==null)ctx.space?.(false);heldSeat=null;holdUntil=0;}
    function hold(seat,value){if(value==='up'){if(heldSeat===seat)releaseHold();return;}if(!['down','hold'].includes(value))return;const repeat=heldSeat===seat;if(heldSeat!==null&&!repeat)releaseHold();heldSeat=seat;holdUntil=Date.now()+1800;ctx.space?.(true,repeat);}
    const ids=new WeakMap(),id=e=>{if(!ids.has(e))ids.set(e,'a'+(++serial));return ids.get(e);};
    const item=itemId=>{const p=model.items[itemId];return {name:p?.name||itemId,description:p?.description||'',image:url(p?.image||''),fallback:url(p?.fallback||'')};};
    // Send a small, safe text tree rather than flattening prices into a single label.
    function richText(root){
      function walk(node,depth=0){
        if(depth>6)return null;if(node.nodeType===3)return {text:node.textContent.slice(0,600)};
        if(node.nodeType!==1||node.tagName==='IMG'||node.tagName==='SVG')return null;
        const tag=['STRONG','B','SMALL','S','BR','DIV','SPAN'].includes(node.tagName)?node.tagName.toLowerCase():'span';
        const style=getComputedStyle(node),cls=node.classList;
        const tone=tag==='s'?'flat':node.closest('.street-up')||(node.closest('.sale-item')&&node.closest('.item-price'))?'up':node.closest('.street-down')||cls.contains('expensive')?'down':cls.contains('affordable')||(tag==='span'&&node.closest('.street-building,.street-item'))?'gold':cls.contains('street-flat')||tag==='s'?'flat':'';
        return {tag,color:style.color,tone,children:[...node.childNodes].slice(0,30).map(n=>walk(n,depth+1)).filter(Boolean)};
      }
      return [...root.childNodes].slice(0,30).map(n=>walk(n)).filter(Boolean);
    }
    function dieSpec(e){
      const face=e.querySelector('.die-face'),style=face?getComputedStyle(face):null;
      return {kind:e.dataset.kind||'normal',small:e.classList.contains('mini-turn-die'),rigged:e.classList.contains('rigged'),background:style?.backgroundImage||'',edge:style?.borderTopColor||'',ink:style?.color||'',faces:[...e.querySelectorAll('.die-face')].map(f=>{const img=f.querySelector('img'),avatar=f.querySelector('.fate-avatar'),dot=f.querySelector('.casino-color');return {text:f.textContent.trim().slice(0,24),image:img?url(img.src):'',avatar:avatar?getComputedStyle(avatar).backgroundColor:'',dot:dot?getComputedStyle(dot).backgroundColor:''};})};
    }
    function directionSpec(e){return {angle:parseFloat(e.closest('.direction-choice')?.style.getPropertyValue('--direction'))||0,title:e.querySelector('.landing-heading')?.textContent||'Chemin',caption:e.querySelector('.landing-caption')?.textContent||'Tu arrives ici',gold:e.classList.contains('star-route'),distance:e.querySelector('.landing-star-distance')?.textContent||'',fare:e.querySelector('.port-fare')?.textContent||'',landings:[...e.querySelectorAll('.landing-chip')].map(chip=>{const img=chip.querySelector('img,image');return {name:chip.lastElementChild?.textContent||'',image:img?url(img.getAttribute('src')||img.getAttribute('href')):'',color:chip.style.getPropertyValue('--case-color'),symbol:img?'':chip.querySelector('b')?.textContent||''};})};}
    function scopes(s){return roots.map(selector=>document.querySelector(selector)).filter(visible).filter(root=>{
      if(root.id==='intro')return ['intro','order-ready'].includes(s.phase);
      if(root.id==='event-overlay')return ['effect-dice','boo-menu','boo-target'].includes(s.phase);
      if(root.id==='shop-layer')return ['shop-menu','shop-sale-menu','shop-replace','gift-replace','item-target'].includes(s.phase);
      if(root.id==='object-panel')return ['duel-stake','encounter-target','stolen-choice','inventory-discard'].includes(s.phase);
      if(root.matches('.fate-overlay'))return ['fate-roll','fate-item-choice'].includes(s.phase);
      if(root.matches('.casino-overlay'))return ['casino-stake','casino-player','casino-roulette'].includes(s.phase);
      if(root.matches('.tropical-overlay'))return s.phase==='tropical-fishing';
      return true;
    });}
    function collect(s){
      const next=new Map(),actions={},readouts=[],groups=scopes(s);let title='À toi de jouer',note='',visual=null;
      for(const root of groups){const h=root.querySelector('h2,h1');if(h?.textContent.trim())title=h.textContent.trim();const p=root.querySelector('#object-note,#shop-note,.street-note,.casino-error,.tropical-content>p');if(p?.textContent.trim())note=p.textContent.trim();
        root.querySelectorAll('button,input[type=number],select').forEach(e=>{
          if(!visible(e)||e.disabled||e.closest('#inventory-slots')||e.matches('.extra-turn-die,#event-die-second,.direction-arrow')||['open-map','map-fit','close-map','open-items','close-items'].includes(e.id)||/^Carte$/.test(e.textContent.trim()))return;
          const key=id(e),kind=e.classList.contains('dice')?'dice':e.classList.contains('fair-gift')?'gift':e.classList.contains('landing-preview')?'direction':e.tagName==='INPUT'?'number':e.tagName==='SELECT'?'select':'button';
          let label=e.classList.contains('dice')?(e.getAttribute('aria-label')||'Lancer le dé'):e.getAttribute('aria-label')||e.textContent.trim()||'Choisir';
          const value={kind,label:e.id==='close-items'?'Retour':label.slice(0,600),disabled:!!e.disabled};
          if(kind==='dice'){
            const companions=e.id==='turn-die'?[...document.querySelectorAll('.extra-turn-die')].filter(visible):e.id==='event-die'?[document.getElementById('event-die-second')].filter(visible):[];
            value.dice=[e,...companions].map(dieSpec);
          }
          if(kind==='direction'){value.direction=directionSpec(e);value.previewed=selectedDirection===e;}
          if(kind==='number'){value.value=e.value;value.min=e.min||'0';value.max=e.max||'100000';value.step=e.step||'1';}
          if(kind==='select'){value.value=e.value;value.options=Array.from(e.options).map(o=>({value:o.value,label:o.textContent,disabled:o.disabled}));}
          const img=e.querySelector('img');if(img)value.image=url(img.currentSrc||img.src);
          if(e.closest('.street-overlay')||e.classList.contains('shop-item'))value.content=richText(e);
          if(e.title)value.description=e.title.slice(0,500);
          if(e.classList.contains('shop-item')&&img){const match=Object.keys(model.items).find(i=>url(model.items[i].image)===url(img.src));if(match)value.description=model.items[match].description;}
          if(e.getAttribute('aria-pressed')!==null)value.selected=e.getAttribute('aria-pressed')==='true';
          actions[key]=value;next.set(key,{e,kind});
        });
        root.querySelectorAll('.street-catalogue-item').forEach(e=>{if(visible(e)){const img=e.querySelector('img');readouts.push({text:e.textContent.trim().slice(0,800),content:richText(e),image:img?url(img.src):''});}});
      }
      const gift=document.querySelector('.fair-gift');
      if(['fair-rock','fair-lucky-roll'].includes(s.phase)&&visible(gift)){
        const prize=gift.querySelector('.fair-gift-prize');visual={kind:'gift',key:s.phase+':'+s.round+':'+s.turn,rock:s.phase==='fair-rock',clicks:s.fair?.openClicks||0,body:url(gift.querySelector('.fair-gift-body')?.src),lid:url(gift.querySelector('.fair-gift-lid')?.src),prize:prize?url(prize.src):'',prizeName:prize?document.querySelector('.fair-gift-name')?.textContent||'':'',action:gift.disabled?'':id(gift)};
      }
      const active=engine.active(s),bag=engine.inventory(s,active),canInspect=s.phase==='turn'&&!ctx.busy()&&!engine.usedItem(s)&&(visible(document.getElementById('player-actions'))||visible(document.getElementById('items-panel')));
      if(!canInspect||selectedItem&&(bag[selectedItem.index]!==selectedItem.itemId||!visible(document.getElementById('items-panel'))||document.getElementById('open-items')?.getAttribute('aria-expanded')==='false'))selectedItem=null;
      if(canInspect)bag.forEach((itemId,index)=>{if(!engine.canUseItem(s,itemId,session))return;const key='inspect-'+index;actions[key]={kind:'inspect',index,label:model.items[itemId].name,disabled:false};next.set(key,{kind:'inspect',index,itemId});});
      if(selectedItem){const key='use-'+selectedItem.index;actions[key]={kind:'use',label:'Utiliser',disabled:false,...item(selectedItem.itemId)};next.set(key,{kind:'use',...selectedItem});}
      if(s.phase==='turn'&&!groups.some(r=>r.id==='dice-panel'))title='À toi de jouer';
      if(['choice','tropical-port'].includes(s.phase))title='Choisis ton chemin';
      if(s.phase==='trap-select'){title='Choisis une case à piéger';document.querySelectorAll('.trap-candidate[data-node]').forEach(e=>{const key=id(e),n=board.nodes.find(n=>n.id===e.dataset.node);actions[key]={kind:'node',label:model.types[n.type].name,node:n.id,disabled:false};next.set(key,{e,kind:'node'});});}
      if(ctx.hiddenHit()){actions.hit={kind:'block',label:'Frapper le bloc caché',image:url('../assets/plateaux/hidden-block.png'),disabled:false};next.set('hit',{kind:'hit'});title='Bloc caché';}
      if(s.phase==='turn'&&visible(document.getElementById('turn-die'))&&engine.diceSpec(s).rigged&&!ctx.busy()){
        actions.rigged={kind:'number',label:'Résultat du dé pipé',value:String(ctx.dieValue()),min:'1',max:String(engine.diceSpec(s).max),step:'1',disabled:false};next.set('rigged',{kind:'rigged'});
      }
      // Animations never become remotely clickable just because a decorative die remains visible.
      if(ctx.busy())for(const key of Object.keys(actions))delete actions[key];
      const remote=ctx.mapState?.();
      if(remote?.open){
        for(const key of Object.keys(actions))delete actions[key];
        for(const name of ['up','left','right','down','plus','minus',...(remote.trap?['confirm']:['close'])]){
          if(name==='confirm'&&!remote.canConfirm)continue;
          const key='map-'+name;actions[key]={kind:'map-control',label:name,command:name,disabled:false};next.set(key,{kind:'map-control',command:name});
        }
        title=remote.trap?'Choisis une case à piéger':'Carte';note=remote.info||'';
      }else if(!ctx.busy()){
        const mapButton=[...document.querySelectorAll('#open-map,.shop-overlay button,#shop-layer button,.street-overlay button')].find(e=>visible(e)&&!e.disabled&&(e.id==='open-map'||/^Carte$/.test(e.textContent.trim())));
        if(mapButton){actions['map-open']={kind:'map-open',label:'Map',disabled:false};next.set('map-open',{kind:'map-open',e:mapButton});}
      }
      if(!remote?.open&&(ctx.canAccelerate?.()||heldSeat!==null)){
        actions.accelerate={kind:'accelerate',label:'Accélérer',disabled:false};next.set('accelerate',{kind:'accelerate'});
      }
      Object.values(actions).forEach((action,index)=>action.order=index);
      if(selectedDirection&&!visible(selectedDirection))selectedDirection=null;
      if(visual||Object.values(actions).some(a=>a.kind==='dice')){title='';note='';}
      if(selectedItem){title= model.items[selectedItem.itemId].name;note=model.items[selectedItem.itemId].description;}
      bindings=next;return {title,note,actions,readouts,visual,remote:remote?.open?remote:null,selectedItem:selectedItem?.index??-1};
    }
    function snapshot(){
      const s=ctx.state(),who=owner(s,engine),view=collect(s),key=JSON.stringify([s.phase,s.round,s.turn,who,view]);
      if(key!==semantic){semantic=key;version=crypto.getRandomValues(new Uint32Array(3)).join('-');}
      const seats=Object.entries(room?.players||{}),result={};
      players.forEach((p,index)=>{
        const found=seats.find(([,seat])=>p.connectionId&&seat.clientId===p.connectionId)||seats.find(([,seat])=>seat.index===index&&seat.name===p.name&&seat.color===p.color);if(!found)return;const seatKey=found[0],acting=index===who,team=window.PourtyTeams.team(s,index),wallet=s.wallets[index]||{ac:0,stars:0};
        result[seatKey]={version,sessionId:session.id,title:acting?view.title:'',note:acting?view.note:'',canAct:acting,color:p.color,ready:acting&&Object.keys(view.actions).length>0,mapAvailable:acting&&!!view.actions['map-open'],remoteMap:acting?view.remote:null,visual:acting?view.visual:null,selectedItem:acting?view.selectedItem:-1,ac:wallet.ac,stars:wallet.stars,inventory:engine.inventory(s,index).map(item),capacity:engine.inventoryCapacity(s,index),team:team?.name||'',actions:acting?view.actions:{},readouts:acting?view.readouts:[],ack:ack[seatKey]||''};
      });return result;
    }
    async function send(){if(stopped||working||bridge.miniActive?.())return;working=true;try{
      if(heldSeat!==null&&(Date.now()>holdUntil||!snapshot()[heldSeat]?.canAct))releaseHold();const views=snapshot(),json=JSON.stringify(views);if(json!==last){await bridge.boardPublish(views);last=json;}

    }catch(e){console.warn('Téléphones plateau :',e.message);}finally{working=false;}}
    const seen=new Map();
    async function command(seatKey,cmd){
      if(stopped||bridge.miniActive?.()||!cmd||seen.get(seatKey)===cmd.nonce)return;seen.set(seatKey,cmd.nonce);
      const current=snapshot()[seatKey],entry=bindings.get(cmd.action);if(!current?.canAct||cmd.version!==current.version||!entry||!current.actions[cmd.action]||current.actions[cmd.action].disabled)return;
      ack[seatKey]=cmd.nonce;
      try{
        if(entry.kind==='accelerate'){hold(seatKey,cmd.value);}
        else if(entry.kind==='map-control'){ctx.mapCommand?.(entry.command);}
        else if(entry.kind==='map-open'){selectedDirection=null;entry.e.click();}
        else if(entry.kind==='inspect'){if(selectedItem?.index===entry.index){ctx.closeItemPreview?.();selectedItem=null;}else if(ctx.previewItem(entry.index)){selectedItem={index:entry.index,itemId:entry.itemId};}}
        else if(entry.kind==='use'){const button=document.querySelectorAll('#inventory-slots>button')[entry.index];if(button&&!button.disabled&&visible(button)&&engine.inventory(ctx.state())[entry.index]===entry.itemId){selectedItem=null;button.click();}}
        else if(entry.kind==='hit'){ctx.hiddenHit()?.();}
        else if(entry.kind==='rigged'){const n=Number(cmd.value);if(Number.isInteger(n)&&n>=1&&n<=engine.diceSpec(ctx.state()).max)ctx.setDie(n);}
        else if(visible(entry.e)&&!entry.e.disabled){
          if(entry.kind==='number'){const value=Number(cmd.value),min=Number(entry.e.min||0),max=Number(entry.e.max||100000);if(!Number.isSafeInteger(value)||value<min||value>max)return;entry.e.value=String(value);entry.e.dispatchEvent(new Event('input',{bubbles:true}));entry.e.dispatchEvent(new Event('change',{bubbles:true}));}
          else if(entry.kind==='select'){if(!Array.from(entry.e.options).some(o=>o.value===cmd.value&&!o.disabled))return;entry.e.value=cmd.value;entry.e.dispatchEvent(new Event('change',{bubbles:true}));}
          else if(entry.kind==='direction'){
            if(selectedDirection===entry.e){selectedDirection=null;entry.e.click();}
            else{selectedDirection?.closest('.direction-choice')?.dispatchEvent(new Event('pointerleave'));selectedDirection=entry.e;entry.e.dispatchEvent(new Event('pointerenter'));entry.e.closest('.direction-choice')?.dispatchEvent(new Event('pointerenter'));}
          }
          else if(entry.kind==='node')entry.e.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0}));
          else entry.e.click();
        }
      }finally{last='';send();}
    }
    const reactionIds=new Set(["guez", "noob", "ff", "chad", "goat", "porto", "aboubakar", "skibidi", "zzz", "pog", "plait-il", "yuki", "zebi", "mashallah", "mog", "67", "tigre"]),reactionSeen=new Map(),reactionTimes=new Map();let reactionReady=false;
    const unsubscribe=bridge.subscribe(data=>{
      room=data;
      for(const [key,p]of Object.entries(data?.players||{})){
        if(p.boardCommand)command(key,p.boardCommand);
        const reaction=p.reaction;
        if(!reaction||reactionSeen.get(key)===reaction.nonce)continue;
        reactionSeen.set(key,reaction.nonce);
        if(bridge.miniActive?.()||!reactionReady||p.activity!=='board'||!reactionIds.has(reaction.id))continue;
        const index=players.findIndex((player,i)=>player.connectionId?player.connectionId===p.clientId:p.index===i&&p.name===player.name&&p.color===player.color);
        if(index<0||Date.now()-(reactionTimes.get(key)||0)<1800)continue;
        reactionTimes.set(key,Date.now());ctx.react?.(index,reaction.id);
      }
      reactionReady=true;
    });
    const interval=setInterval(send,250);send();window.addEventListener('pagehide',()=>{releaseHold();stopped=true;clearInterval(interval);unsubscribe();},{once:true});
  };
})();
