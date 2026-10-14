(() => {
  'use strict';
  const C=window.AboubaPhotoCore,cfg=window.AboubaPhotoConfig,$=id=>document.getElementById(id),frame=$('site'),dialog=$('connections');
  const listeners=new Set(),cards=new Map();
  let sdk,db,auth,id,data,ready,stopRoom=()=>{},stopDirectory=()=>{},stopConnection=()=>{},closeTimer,expiryTimer,closing=false,activity='lobby',syncQueue=Promise.resolve();
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const status=(text,error=false)=>{$('room-status').textContent=text;$('room-status').classList.toggle('error',error);};
  const fail=e=>status(String(e?.code||'').includes('permission')?'Les règles Firebase doivent être mises à jour pour les salles partagées.':e.message||'Connexion interrompue. Réessaie.',true);
  const emit=()=>listeners.forEach(fn=>fn(data));
  function roster(){
    let raw;try{raw=JSON.parse(localStorage.getItem('mini-Jeux-host-players')||'[]');}catch{raw=[];}
    const valid=Array.isArray(raw)?raw.filter(p=>p&&typeof p.name==='string'&&p.name.trim()&&/^#[0-9a-f]{6}$/i.test(p.color)).slice(0,6):[];
    let changed=false;const ids=new Set();for(const p of valid){if(!p.connectionId||ids.has(p.connectionId)){p.connectionId=crypto.randomUUID();changed=true;}ids.add(p.connectionId);}
    if(changed)localStorage.setItem('mini-Jeux-host-players',JSON.stringify(valid));return valid;
  }
  function directory(room){return {host:room.host,createdAt:room.createdAt,expiresAt:room.expiresAt,players:Object.fromEntries(Object.values(room.players).map(p=>[String(p.index),{name:p.name,color:p.color}]))};}
  function removals(roomId){return {['photoRooms/'+roomId]:null,['roomDirectory/'+roomId]:null};}
  async function connect(){
    const root='https://www.gstatic.com/firebasejs/12.19.0/';
    const [app,a,d]=await Promise.all([import(root+'firebase-app.js'),import(root+'firebase-auth.js'),import(root+'firebase-database.js')]);
    sdk={...a,...d};const instance=app.getApps().length?app.getApp():app.initializeApp(cfg.firebase);auth=a.getAuth(instance);await auth.authStateReady();if(!auth.currentUser)await a.signInAnonymously(auth);db=d.getDatabase(instance);
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
  async function hide(){clearTimeout(closeTimer);if(!dialog.open)return;await dialog.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.97)'}],{duration:240,easing:'ease-in'}).finished;dialog.close();frame.contentWindow.focus();stopDirectory();$('rooms').hidden=true;}
  async function show(){clearTimeout(closeTimer);if(!dialog.open)dialog.showModal();try{await ensure();render();}catch(e){fail(e);}}
  function render(){
    if(!data)return;
    const entries=Object.entries(data.players||{}).sort((a,b)=>a[1].index-b[1].index),keys=new Set(entries.map(([k])=>k));
    for(const [key,c] of cards)if(!keys.has(key)){c.n.remove();cards.delete(key);}
    for(const [key,p] of entries){
      let c=cards.get(key);if(!c){const n=node('article',undefined,'connection-card'),h=node('h2'),body=node('div'),s=node('p');n.append(h,body,s);c={n,h,body,s,online:null};cards.set(key,c);}
      c.n.style.setProperty('--color',p.color);c.h.textContent=p.name;$('room-players').append(c.n);c.s.textContent=p.online?'Connecté':'Scanne ton QR code';
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
    activity=next;if(!data||closing)return;const updates={};for(const [key,p] of Object.entries(data.players||{})){if(p.activity!==next)updates['photoRooms/'+id+'/players/'+key+'/activity']=next;if(next!=='photo'&&p.photo)updates['photoRooms/'+id+'/players/'+key+'/photo']=null;}
    if(Object.keys(updates).length)await sdk.update(sdk.ref(db),updates);
  }
  window.PourtySession={subscribe(fn){listeners.add(fn);fn(data);return()=>listeners.delete(fn);},showConnection:show,rosterChanged(){syncQueue=syncQueue.then(syncRoster).catch(fail);}};
  frame.addEventListener('load',()=>{try{const path=frame.contentWindow.location.pathname;document.title=frame.contentDocument.title||'Mario Pourty';setActivity(path.endsWith('/aboubaphoto/index.html')?'photo':'lobby').catch(fail);}catch{}});
  $('close-connections').onclick=hide;$('return-home').onclick=()=>hide().then(()=>frame.src='index.html');dialog.addEventListener('cancel',e=>{e.preventDefault();hide();});
  $('room-list').onclick=async()=>{
    clearTimeout(closeTimer);$('rooms').hidden=false;$('room-directory').textContent='Chargement…';
    try{if(!db)await connect();stopDirectory();stopDirectory=sdk.onValue(sdk.ref(db,'roomDirectory'),snap=>{
      const entries=Object.entries(snap.val()||{}).sort((a,b)=>b[1].createdAt-a[1].createdAt);$('room-directory').replaceChildren();
      for(const [key,room] of entries){const row=node('article'),names=node('p');for(const p of Object.values(room.players||{})){const span=node('span',p.name+'  ');span.style.color=p.color;names.append(span);}const del=node('button','Supprimer','danger');del.onclick=async()=>{if(!confirm('Fermer cette salle pour tous ses joueurs ?'))return;del.disabled=true;try{await sdk.update(sdk.ref(db),removals(key));}catch(e){fail(e);del.disabled=false;}};row.append(names,del);$('room-directory').append(row);}
      if(!entries.length)$('room-directory').textContent='Aucune salle ouverte.';
    },fail);}catch(e){fail(e);}
  };
  window.addEventListener('pagehide',()=>{clearTimeout(closeTimer);clearTimeout(expiryTimer);stopDirectory();stopRoom();stopConnection();if(db)sdk.goOffline(db);});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  frame.src='index.html';show();
})();
