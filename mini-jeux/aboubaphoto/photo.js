(() => {
  'use strict';
  const C=window.AboubaPhotoCore,cfg=window.AboubaPhotoConfig,$=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1));
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const action=(text,fn,cls)=>{const n=el('button',text,cls);n.type='button';n.addEventListener('click',fn);return n;};
  const notice=(text,error=false)=>{$('notice').textContent=text;$('notice').classList.toggle('error',error);};
  let sdk,db,auth,roomId,roomData,unsubscribe=()=>{},stopPresence=()=>{},stopHostConnection=()=>{},expiryTimer,hostRoom=false,closed=false;
  const cards=new Map();
  const firebaseReady=()=>['apiKey','projectId','databaseURL','appId'].every(k=>cfg.firebase[k]);
  const uploadReady=()=>/^[a-z0-9_-]+$/i.test(cfg.cloudinary.cloudName)&&!!cfg.cloudinary.uploadPreset;
  const fail=err=>{const code=String(err?.code||'');notice(code.includes('permission')?'Accès refusé : cette partie est fermée, ce joueur est déjà connecté ailleurs ou les règles Firebase restent à configurer.':code.includes('operation-not-allowed')?'La connexion des joueurs reste à activer dans Firebase.':code.includes('network')?'Connexion interrompue. Vérifie Internet puis réessaie.':err?.message||'Connexion impossible. Réessaie dans un instant.',true);};
  async function connect(){
    const root='https://www.gstatic.com/firebasejs/12.19.0/';
    const [app,a,d]=await Promise.all([import(root+'firebase-app.js'),import(root+'firebase-auth.js'),import(root+'firebase-database.js')]);
    sdk={...a,...d};const instance=app.getApps().length?app.getApp():app.initializeApp(cfg.firebase);auth=a.getAuth(instance);
    await auth.authStateReady();if(!auth.currentUser)await a.signInAnonymously(auth);db=d.getDatabase(instance);
  }
  function avatar(p){const a=el('span',p.name[0].toUpperCase(),'avatar');a.style.setProperty('--color',p.color);return a;}
  function placeholder(){const box=el('div',undefined,'qr pending'),img=el('img');img.src='../../assets/minigames/aboubaphoto.svg';img.alt='';box.append(img);return box;}
  function card(p,key){const n=el('article',undefined,'player-card');n.style.setProperty('--color',p.color);n.style.setProperty('--delay',(p.index||0)*60+'ms');const name=el('h2');name.append(avatar(p),document.createTextNode(p.name));const status=el('p','En attente','status'),qr=placeholder(),slot=el('div',undefined,'photo-slot');n.append(name,status,qr,slot);$('players').append(n);const data={n,status,qr,slot,url:null};cards.set(key,data);return data;}
  async function showPhoto(url,name){const dialog=$('lightbox'),img=dialog.querySelector('img');img.src=url;img.alt='Photo de '+name;dialog.querySelector('p').textContent=name;dialog.showModal();}
  async function closePhoto(){const d=$('lightbox');if(!d.open)return;await d.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.95)'}],{duration:220,easing:'ease-in'}).finished;d.close();}
  $('close-photo').addEventListener('click',closePhoto);$('lightbox').addEventListener('cancel',e=>{e.preventDefault();closePhoto();});
  function renderRoom(data){
    if(!data){closed=true;sessionStorage.removeItem('aboubaphoto-host');clearTimeout(expiryTimer);stopHostConnection();$('players').replaceChildren();cards.clear();$('actions').replaceChildren(action('Nouvelle salle',()=>location.reload()));$('connection').textContent='Salle fermée';notice('Cette partie est fermée.');return;}roomData=data;
    for(const [key,p] of Object.entries(data.players||{}).sort((a,b)=>a[1].index-b[1].index)){
      let c=cards.get(key);if(!c){c=card(p,key);const url=C.link(location.href,roomId,key),qr=qrcode(0,'M');qr.addData(url);qr.make();c.qr.classList.remove('pending');c.qr.innerHTML=qr.createSvgTag({cellSize:4,margin:4,scalable:true});c.qr.setAttribute('aria-label','QR code pour '+p.name);const copy=action('Copier le lien',async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='Copié !';setTimeout(()=>copy.textContent='Copier le lien',1500);}catch{notice('Copie du lien indisponible : utilise le QR code.');}},'small');c.qr.after(copy);}
      c.status.textContent=p.online?'Connecté':p.uid?'Déconnecté':'Scanne ton QR code';c.status.classList.toggle('ready',!!p.online);
      const url=C.imageURL(p.photo?.url,cfg.cloudinary.cloudName);
      if(url&&url!==c.url){c.url=url;const img=el('img');img.alt='Photo de '+p.name;img.referrerPolicy='no-referrer';img.onload=()=>{const b=action('',()=>showPhoto(url,p.name));b.setAttribute('aria-label','Agrandir la photo de '+p.name);b.append(img);c.slot.replaceChildren(b);};img.onerror=()=>{c.slot.replaceChildren(el('p','Photo indisponible.'));};img.src=url;}
    }
  }
  async function closeRoom(){
    if(!hostRoom||!roomId)return;
    await sdk.remove(sdk.ref(db,'photoRooms/'+roomId));
    closed=true;sessionStorage.removeItem('aboubaphoto-host');
    unsubscribe();stopHostConnection();clearTimeout(expiryTimer);
  }
  async function attachRoom(data){
    hostRoom=true;closed=false;
    const roomRef=sdk.ref(db,'photoRooms/'+roomId);
    // Stored on Firebase: still executes if the host loses power or closes the browser.
    await sdk.onDisconnect(roomRef).remove();
    stopHostConnection();
    stopHostConnection=sdk.onValue(sdk.ref(db,'.info/connected'),snap=>{
      if(snap.val()===true&&!closed)sdk.onDisconnect(roomRef).remove().catch(fail);
    });
    unsubscribe();clearTimeout(expiryTimer);$('players').replaceChildren();cards.clear();renderRoom(data);
    $('actions').replaceChildren(action('Fermer la salle',async()=>{try{await closeRoom();location.reload();}catch(e){fail(e);}}));
    unsubscribe=sdk.onValue(sdk.ref(db,'photoRooms/'+roomId),snap=>renderRoom(snap.val()),fail);
    expiryTimer=setTimeout(()=>{closeRoom().then(()=>{renderRoom(null);notice('Cette salle a expiré et a été supprimée.');}).catch(fail);},Math.max(0,data.expiresAt-Date.now()));
    notice(uploadReady()?'Chaque joueur scanne son QR code.':'Les téléphones peuvent rejoindre. L’envoi des photos attend la configuration de l’hébergeur.');$('connection').textContent='Salle ouverte';
  }
  async function host(){
    let players=[];try{players=C.roster(JSON.parse(localStorage.getItem('mini-Jeux-host-players')||'[]'));}catch{}
    players.forEach((p,index)=>card({...p,index},'preview-'+index));
    if(!players.length){notice('Crée d’abord les joueurs dans le menu principal.');return;}
    if(!firebaseReady()){notice('Les joueurs sont prêts. La connexion aux téléphones sera disponible après la configuration Firebase et la publication du site.');return;}
    if(location.protocol!=='https:'){notice('Ouvre la version publiée en HTTPS pour connecter les téléphones.');return;}
    const saved=sessionStorage.getItem('aboubaphoto-host');
    if(C.validToken(saved)){
      notice('Reconnexion à ta salle…');
      try{await connect();const snap=await sdk.get(sdk.ref(db,'photoRooms/'+saved)),data=snap.val();if(data&&data.host===auth.currentUser.uid&&data.expiresAt>Date.now()){roomId=saved;await attachRoom(data);return;}}
      catch(e){fail(e);}
      sessionStorage.removeItem('aboubaphoto-host');
    }
    const create=action('Ouvrir la salle',async()=>{
      create.disabled=true;notice('Connexion…');
      try{
        if(!db)await connect();roomId=C.token();const data=C.room(players,auth.currentUser.uid);await sdk.set(sdk.ref(db,'photoRooms/'+roomId),data);
        sessionStorage.setItem('aboubaphoto-host',roomId);await attachRoom(data);
      }catch(e){fail(e);create.disabled=false;}
    });$('actions').append(create);
  }
  async function compress(file){
    if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw Error('Choisis une image de moins de 20 Mo.');
    const local=URL.createObjectURL(file);try{const img=new Image();img.src=local;await img.decode();let ratio=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);let result;for(const quality of [.82,.65,.48]){result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(result&&result.size<700000)break;}if(!result||result.size>1000000)throw Error('Cette image reste trop lourde. Choisis une photo plus petite.');return result;}catch(e){if(e.message?.startsWith('Cette'))throw e;throw Error('Image illisible. Essaie une photo JPEG ou PNG.');}finally{URL.revokeObjectURL(local);}
  }
  function upload(blob,progress){return new Promise((resolve,reject)=>{const x=new XMLHttpRequest(),body=new FormData();body.append('file',blob,'photo.jpg');body.append('upload_preset',cfg.cloudinary.uploadPreset);x.open('POST','https://api.cloudinary.com/v1_1/'+encodeURIComponent(cfg.cloudinary.cloudName)+'/image/upload');x.timeout=60000;x.upload.onprogress=e=>{if(e.lengthComputable)progress(e.loaded/e.total);};x.onerror=()=>reject(Error('Envoi interrompu. Vérifie ta connexion.'));x.ontimeout=()=>reject(Error('L’envoi a pris trop de temps. Réessaie.'));x.onload=()=>{try{const value=JSON.parse(x.responseText);const url=C.imageURL(value.secure_url,cfg.cloudinary.cloudName);if(x.status<200||x.status>=300||!url)throw Error();resolve({url,publicId:value.public_id,deleteToken:typeof value.delete_token==='string'?value.delete_token:null});}catch{reject(Error('L’hébergeur a refusé la photo. Vérifie sa configuration ou son quota.'));}};x.send(body);});}
  async function player(){
    $('connection').textContent='Joueur';$('players').hidden=true;const token=params.get('player');roomId=params.get('room');
    if(!C.validToken(token)||!C.validToken(roomId)){notice('Lien de joueur invalide. Scanne à nouveau le QR code.',true);return;}
    if(!firebaseReady()){notice('La connexion aux téléphones n’est pas encore configurée.',true);return;}
    notice('Connexion à ta place…');
    try{
      await connect();const path='photoRooms/'+roomId+'/players/'+token,r=sdk.ref(db,path),uid=auth.currentUser.uid;
      const initial=await sdk.get(r);if(!initial.exists())throw Error('Cette salle est fermée ou ce lien a expiré.');
      const claim=await sdk.runTransaction(sdk.ref(db,path+'/uid'),previous=>{if(previous&&previous!==uid)return;return uid;},{applyLocally:false});
      if(!claim.committed)throw Error('Cette place est déjà utilisée sur un autre téléphone.');const p=initial.val();
      const online=sdk.ref(db,path+'/online');stopPresence=sdk.onValue(sdk.ref(db,'.info/connected'),async snap=>{if(snap.val()===true){try{await sdk.onDisconnect(online).set(false);await sdk.set(online,true);$('connection').textContent='Connecté';}catch(e){fail(e);}}else $('connection').textContent='Reconnexion…';});
      const panel=$('phone');panel.hidden=false;panel.style.setProperty('--color',p.color);panel.append(avatar(p),el('h2',p.name));
      const input=document.createElement('input');input.type='file';input.accept='image/*';input.capture='environment';const label=el('label','Prendre une photo','file-label');label.append(input);
      const preview=el('img',undefined,'preview');preview.alt='Aperçu de ta photo';preview.hidden=true;
      const progress=el('progress');progress.max=1;progress.value=0;progress.hidden=true;
      let blob=null,previewURL=null,pendingUpload=null,currentUpload=null,busy=false,roomClosed=false;
      const discard=photo=>{if(photo?.deleteToken)window.AboubaPhotoCleanup.remove(photo.deleteToken).catch(()=>{});};
      const roomEnded=()=>{roomClosed=true;input.disabled=true;send.disabled=true;discard(currentUpload);discard(pendingUpload);notice('Cette salle est fermée.');stopPresence();};
      const send=action('Envoyer la photo',async()=>{if(!blob||busy)return;busy=true;send.disabled=true;input.disabled=true;progress.hidden=false;notice('Envoi de la photo…');try{pendingUpload||=await upload(blob,v=>progress.value=v);if(roomClosed){discard(pendingUpload);return;}await sdk.set(sdk.ref(db,path+'/photo'),{url:pendingUpload.url,publicId:pendingUpload.publicId,sentAt:sdk.serverTimestamp()});if(roomClosed){discard(pendingUpload);return;}discard(currentUpload);currentUpload=pendingUpload;notice('Photo affichée sur l’écran principal !');blob=null;pendingUpload=null;send.textContent='Photo envoyée';}catch(e){fail(e);send.disabled=roomClosed;send.textContent='Réessayer';}finally{busy=false;input.disabled=roomClosed;progress.hidden=true;}});send.disabled=true;
      input.addEventListener('change',async()=>{const f=input.files[0];if(!f||busy)return;send.disabled=true;notice('Préparation de la photo…');blob=null;discard(pendingUpload);pendingUpload=null;try{blob=await compress(f);if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(blob);preview.src=previewURL;preview.hidden=false;send.textContent='Envoyer la photo';send.disabled=roomClosed||!uploadReady();notice(uploadReady()?'Ta photo est prête.':'L’envoi attend la configuration de l’hébergeur.');}catch(e){fail(e);}});
      const actions=el('div',undefined,'actions');actions.append(label,send);panel.append(preview,actions,progress,el('p','En envoyant, tu partages cette photo avec la salle. Elle sera hébergée sur Cloudinary et accessible aux personnes disposant de son lien.','upload-note'));
      notice(uploadReady()?'Prends une photo pour l’afficher sur l’écran principal.':'Tu es connecté. L’envoi des photos n’est pas encore activé.');
      unsubscribe=sdk.onValue(r,snap=>{if(!snap.exists())roomEnded();},()=>roomEnded());
    }catch(e){fail(e);}
  }
  document.querySelector('header a').addEventListener('click',async e=>{
    if(!hostRoom||closed)return;e.preventDefault();const destination=e.currentTarget.href;
    try{await closeRoom();location.href=destination;}catch(err){fail(err);}
  });
  window.addEventListener('pagehide',()=>{unsubscribe();stopPresence();stopHostConnection();if(hostRoom&&db){sdk.goOffline(db);}});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  (params.has('room')?player():host()).catch(fail);
})();
