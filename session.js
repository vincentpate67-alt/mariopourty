(() => {
  'use strict';
  const C=window.AboubaPhotoCore,cfg=window.AboubaPhotoConfig,$=id=>document.getElementById(id),frame=$('site'),dialog=$('connections');
  const listeners=new Set(),cards=new Map(),boardSent=new Map();let serverOffset=0,miniLease=null;
  let sdk,db,auth,id,data,ready,stopRoom=()=>{},stopDirectory=()=>{},stopConnection=()=>{},closeTimer,expiryTimer,closing=false,activity='lobby',syncQueue=Promise.resolve();
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const status=(text,error=false)=>{$('room-status').textContent=text;$('room-status').classList.toggle('error',error);};
  const fail=e=>status(String(e?.code||'').includes('permission')?'Les règles Firebase doivent être mises à jour pour les salles partagées.':e.message||'Connexion interrompue. Réessaie.',true);
  const emit=()=>listeners.forEach(fn=>fn(data));
  function roster(){
    let raw;try{raw=JSON.parse(localStorage.getItem('mini-Jeux-host-players')||'[]');}catch{raw=[];}
    const valid=Array.isArray(raw)?raw.filter(p=>p&&typeof p.name==='string'&&p.name.trim()&&/^#[0-9a-f]{6}$/i.test(p.color)).slice(0,20):[];
    let changed=false;const ids=new Set();for(const p of valid){if(!p.connectionId||ids.has(p.connectionId)){p.connectionId=C.token();changed=true;}ids.add(p.connectionId);}
    if(changed)localStorage.setItem('mini-Jeux-host-players',JSON.stringify(valid));return valid;
  }
  function directory(room){return {host:room.host,createdAt:room.createdAt,expiresAt:room.expiresAt,players:Object.fromEntries(Object.values(room.players).map(p=>[String(p.index),{name:p.name,color:p.color}]))};}
  function removals(roomId){return {['photoRooms/'+roomId]:null,['roomDirectory/'+roomId]:null};}
  async function connect(){
    const root='https://www.gstatic.com/firebasejs/12.19.0/';
    const [app,a,d]=await Promise.all([import(root+'firebase-app.js'),import(root+'firebase-auth.js'),import(root+'firebase-database.js')]);
    sdk={...a,...d};const instance=app.getApps().length?app.getApp():app.initializeApp(cfg.firebase);auth=a.getAuth(instance);await auth.authStateReady();if(!auth.currentUser)await a.signInAnonymously(auth);db=d.getDatabase(instance);sdk.onValue(sdk.ref(db,'.info/serverTimeOffset'),s=>serverOffset=Number(s.val())||0);
  }
  async function arm(){if(id&&!closing)await sdk.onDisconnect(sdk.ref(db)).update(removals(id));}
  async function start(){
    if(location.protocol!=='https:'&&!(location.protocol==='http:'&&C.localHost(location.hostname)))throw Error('Ouvre le site publié ou le serveur de test local.');
    await connect();const players=roster();if(!players.length)throw Error('Ajoute d’abord un joueur dans le menu principal.');
    id=C.token();data=C.room(players.map(p=>({name:p.name,color:p.color,clientId:p.connectionId,activity})),auth.currentUser.uid);
    // Register disconnect cleanup before publishing the room; the shell survives iframe navigation.
    await arm();await sdk.update(sdk.ref(db),{['photoRooms/'+id]:data,['roomDirectory/'+id]:directory(data)});
    stopConnection=sdk.onValue(sdk.ref(db,'.info/connected'),snap=>{if(snap.val()===true)arm().catch(fail);});
    stopRoom=sdk.onValue(sdk.ref(db,'photoRooms/'+id),snap=>{
      data=snap.val();emit();render();
      if(!data){closing=true;clearTimeout(expiryTimer);stopConnection();status('Cette salle a été fermée. Rouvre les téléphones depuis le menu pour en créer une nouvelle.');}
    },fail);
    expiryTimer=setTimeout(()=>sdk.update(sdk.ref(db),removals(id)).catch(fail),Math.max(0,data.expiresAt-Date.now()));render();emit();
  }
  async function ensure(){if(closing){stopRoom();ready=null;id=null;data=null;closing=false;}if(!ready)ready=start().catch(e=>{ready=null;throw e;});await ready;}
  async function hide(){clearTimeout(closeTimer);if(!dialog.open)return;await dialog.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.97)'}],{duration:240,easing:'ease-in'}).finished;dialog.close();frame.contentWindow.focus();stopDirectory();$('rooms').hidden=true;$('room-list').setAttribute('aria-expanded','false');}
  async function show(){clearTimeout(closeTimer);if(!dialog.open)dialog.showModal();try{await ensure();render();}catch(e){fail(e);}}
  function render(){
    if(!data)return;
    const entries=Object.entries(data.players||{}).sort((a,b)=>a[1].index-b[1].index),keys=new Set(entries.map(([k])=>k));
    for(const [key,c] of cards)if(!keys.has(key)){c.n.remove();cards.delete(key);}
    for(const [key,p] of entries){
      let c=cards.get(key);if(!c){const n=node('article',undefined,'connection-card'),h=node('a',undefined,'player-link'),body=node('div'),s=node('p');n.append(h,body,s);c={n,h,body,s,online:null};cards.set(key,c);}
      c.n.style.setProperty('--color',p.color);c.h.textContent=p.name;c.h.href=C.link(new URL('mini-jeux/aboubaphoto/index.html',location.href).href,id,key);c.h.target='_blank';c.h.rel='noopener';c.h.setAttribute('aria-label','Ouvrir la page de '+p.name+' dans un nouvel onglet');$('room-players').append(c.n);c.s.textContent=p.online?'Connecté':'Scanne ton QR code';
      if(c.online!==!!p.online){c.online=!!p.online;c.body.replaceChildren();if(p.online)c.body.append(node('div','✓','connected-check'));else{const qr=qrcode(0,'M');qr.addData(C.link(new URL('mini-jeux/aboubaphoto/index.html',location.href).href,id,key));qr.make();const box=node('div',undefined,'qr');box.innerHTML=qr.createSvgTag({cellSize:4,margin:4,scalable:true});box.setAttribute('aria-label','QR code de '+p.name);c.body.append(box);}}
    }
    const count=entries.filter(([,p])=>p.online).length;status(count+' / '+entries.length+' connectés');clearTimeout(closeTimer);
    if(entries.length&&count===entries.length&&dialog.open&&$('rooms').hidden)closeTimer=setTimeout(()=>hide().then(()=>{frame.src='index.html';}),950);
  }
  async function syncRoster(){
    await ensure();if(!data)return;const players=roster();
    if(!players.length){await sdk.update(sdk.ref(db),removals(id));return;}
    const updates={},next={},old=data.players||{};let added=false;
    for(let index=0;index<players.length;index++){
      const p=players[index],entry=Object.entries(old).find(([,s])=>s.clientId===p.connectionId),key=entry?.[0]||C.token();
      next[key]={...(entry?.[1]||{online:false}),name:p.name,color:p.color,index,clientId:p.connectionId,activity};
      if(!entry){updates['photoRooms/'+id+'/players/'+key]=next[key];added=true;}
      else for(const field of ['name','color','index'])if(next[key][field]!==entry[1][field])updates['photoRooms/'+id+'/players/'+key+'/'+field]=next[key][field];
    }
    for(const key of Object.keys(old))if(!next[key])updates['photoRooms/'+id+'/players/'+key]=null;
    updates['roomDirectory/'+id]=directory({...data,players:next});await sdk.update(sdk.ref(db),updates);if(added)await show();
  }
  async function setActivity(next){
    activity=next;if(!data||closing)return;const updates={};for(const [key,p] of Object.entries(data.players||{})){if(p.activity!==next)updates['photoRooms/'+id+'/players/'+key+'/activity']=next;if(!['board','mini'].includes(next)){for(const field of ['controller','boardCommand','reaction'])if(p[field])updates['photoRooms/'+id+'/players/'+key+'/'+field]=null;}if(next!=='mini'&&p.memePhoto)updates['photoRooms/'+id+'/players/'+key+'/memePhoto']=null;if(next!=='mini'&&p.drawingPhoto)updates['photoRooms/'+id+'/players/'+key+'/drawingPhoto']=null;if(next!=='photo'){for(const field of ['photo','vote','game'])if(p[field])updates['photoRooms/'+id+'/players/'+key+'/'+field]=null;}}
    if(Object.keys(updates).length)await sdk.update(sdk.ref(db),updates);
  }
  function insideSite(source){try{for(let w=source;w&&w!==window;w=w.parent)if(w===frame.contentWindow)return true;}catch{}return false;}
  function pageActivity(){const path=frame.contentWindow.location.pathname;return path.endsWith('/aboubaphoto/index.html')?'photo':path.endsWith('/board-play.html')?'board':/\/mini-jeux\/(?:.*\/)?(?:game-\d+|index)\.html$/.test(path)?'mini':'lobby';}
  window.PourtySession={miniActive:()=>!!miniLease,miniAcquire(source){
    if(!insideSite(source))return null;const lease={source};miniLease=lease;boardSent.clear();setActivity('mini').catch(fail);
    return {roomId:id,current:()=>miniLease===lease,now:()=>Date.now()+serverOffset,subscribe(fn){listeners.add(fn);fn(data);return()=>listeners.delete(fn);},
      async publish(views){if(miniLease!==lease||closing||!ready)return;await ready;if(miniLease!==lease||!data||closing)return;const updates={};for(const [key,view]of Object.entries(views)){if(!data.players[key])continue;const encoded=JSON.stringify(view);if(boardSent.get(key)===encoded&&data.players[key].activity==='mini')continue;updates['photoRooms/'+id+'/players/'+key+'/controller']=view;updates['photoRooms/'+id+'/players/'+key+'/activity']='mini';}if(Object.keys(updates).length){await sdk.update(sdk.ref(db),updates);if(miniLease===lease)for(const [key,view]of Object.entries(views))boardSent.set(key,JSON.stringify(view));}},
      release(){if(miniLease!==lease)return;miniLease=null;boardSent.clear();setActivity(pageActivity()).catch(fail);}
    };
  },async boardPublish(views){
    if(miniLease||closing||!ready)return;await ready;if(miniLease||closing||!data||!frame.contentWindow.location.pathname.endsWith('/board-play.html'))return;const updates={},sent=[];for(const [key,view]of Object.entries(views))if(data.players[key]&&(boardSent.get(key)!==JSON.stringify(view)||data.players[key].activity!=='board')){sent.push([key,JSON.stringify(view)]);updates['photoRooms/'+id+'/players/'+key+'/controller']=view;if(data.players[key].activity!=='board')updates['photoRooms/'+id+'/players/'+key+'/activity']='board';}if(Object.keys(updates).length){await sdk.update(sdk.ref(db),updates);sent.forEach(([key,value])=>boardSent.set(key,value));}
  },async boardMap(map){if(closing||!ready)return;await ready;if(closing||!data||!frame.contentWindow.location.pathname.endsWith('/board-play.html'))return;await sdk.set(sdk.ref(db,'photoRooms/'+id+'/boardMap'),map);},now:()=>Date.now()+serverOffset,async photoUpdate(changes){
    await ensure();if(!data)throw Error('Salle fermée.');const updates={};
    for(const [key,patch] of Object.entries(changes)){if(!data.players[key])continue;for(const [field,value] of Object.entries(patch)){if(!['game','photo','vote','memePhoto','drawingPhoto'].includes(field))throw Error('Champ de jeu invalide');updates['photoRooms/'+id+'/players/'+key+'/'+field]=value;}}
    await sdk.update(sdk.ref(db),updates);
  },subscribe(fn){listeners.add(fn);fn(data);return()=>listeners.delete(fn);},showConnection:show,rosterChanged(){syncQueue=syncQueue.then(syncRoster).catch(fail);}};
  frame.addEventListener('load',()=>{try{const path=frame.contentWindow.location.pathname;document.title=frame.contentDocument.title||'Mario Pourty';if(miniLease&&!insideSite(miniLease.source))miniLease=null;setActivity(miniLease?'mini':pageActivity()).catch(fail);}catch{}});
  $('close-connections').onclick=hide;$('return-home').onclick=()=>hide().then(()=>frame.src='index.html');dialog.addEventListener('cancel',e=>{e.preventDefault();hide();});
  $('room-list').onclick=async()=>{
    clearTimeout(closeTimer);
    const panel=$('rooms'),button=$('room-list');
    if(!panel.hidden){
      button.disabled=true;stopDirectory();
      try{await panel.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-6px)'}],{duration:200,easing:'ease-in'}).finished;}catch{}
      panel.hidden=true;button.disabled=false;button.setAttribute('aria-expanded','false');render();return;
    }
    panel.hidden=false;button.setAttribute('aria-expanded','true');
    panel.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
    $('room-directory').textContent='Chargement…';
    try{if(!db)await connect();if(panel.hidden)return;stopDirectory();stopDirectory=sdk.onValue(sdk.ref(db,'roomDirectory'),snap=>{
      const entries=Object.entries(snap.val()||{}).sort((a,b)=>b[1].createdAt-a[1].createdAt);$('room-directory').replaceChildren();
      for(const [key,room] of entries){const row=node('article'),names=node('p');for(const p of Object.values(room.players||{})){const span=node('span',p.name+'  ');span.style.color=p.color;names.append(span);}const del=node('button','Supprimer','danger');del.onclick=async()=>{if(!confirm('Fermer cette salle pour tous ses joueurs ?'))return;del.disabled=true;try{await sdk.update(sdk.ref(db),removals(key));}catch(e){fail(e);del.disabled=false;}};row.append(names,del);$('room-directory').append(row);}
      if(!entries.length)$('room-directory').textContent='Aucune salle ouverte.';
    },fail);}catch(e){fail(e);}
  };
  window.addEventListener('pagehide',()=>{clearTimeout(closeTimer);clearTimeout(expiryTimer);stopDirectory();stopRoom();stopConnection();if(db)sdk.goOffline(db);});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  frame.src='index.html';show();
})();
