(() => {
  'use strict';
  const C=window.AboubaPhotoCore,cfg=window.AboubaPhotoConfig,$=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1));
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const action=(text,fn,cls)=>{const n=el('button',text,cls);n.type='button';n.addEventListener('click',fn);return n;};
  const notice=(text,error=false)=>{$('notice').textContent=text;$('notice').classList.toggle('error',error);};
  let sdk,db,auth,roomId,unsubscribe=()=>{},stopPresence=()=>{};
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
  async function showPhoto(url,name){const dialog=$('lightbox'),img=dialog.querySelector('img');img.src=url;img.alt='Photo de '+name;dialog.querySelector('p').textContent=name;dialog.showModal();}
  async function closePhoto(){const d=$('lightbox');if(!d.open)return;await d.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.95)'}],{duration:220,easing:'ease-in'}).finished;d.close();}
  $('close-photo').addEventListener('click',closePhoto);$('lightbox').addEventListener('cancel',e=>{e.preventDefault();closePhoto();});
  async function host(){
    const session=window.parent!==window && window.parent.PourtySession;
    if(!session){notice('Connecte les téléphones depuis le menu Joueurs.');$('actions').append(action('Menu principal',()=>location.href='../../index.html#players'));return;}
    document.body.classList.add('shared-host');
    const gallery=el('section',undefined,'photo-gallery');$('players').before(gallery);
    unsubscribe=session.subscribe(data=>{
      $('players').replaceChildren();cards.clear();
      if(!data){gallery.replaceChildren();$('connection').textContent='Salle fermée';notice('Connecte les téléphones depuis le menu principal.');return;}
      $('connection').textContent='Salle connectée';notice('');
      const entries=Object.entries(data.players||{}).sort((a,b)=>a[1].index-b[1].index),keys=new Set(entries.map(([key])=>key));
      for(const child of [...gallery.children])if(!keys.has(child.dataset.player))child.remove();
      for(const [key,p] of entries){
        const hud=el('article',undefined,'photo-hud');hud.style.setProperty('--color',p.color);hud.append(avatar(p),el('strong',p.name),el('span',p.online?'✓':'…'));$('players').append(hud);
        let slot=[...gallery.children].find(n=>n.dataset.player===key);if(!slot){slot=el('article',undefined,'gallery-card');slot.dataset.player=key;gallery.append(slot);}
        slot.style.setProperty('--color',p.color);const url=C.imageURL(p.photo?.url,cfg.cloudinary.cloudName);
        if(slot.dataset.url!==(url||'')||slot.dataset.name!==p.name){slot.dataset.url=url||'';slot.dataset.name=p.name;slot.replaceChildren(el('h2',p.name));if(url){const img=el('img');img.src=url;img.alt='Photo de '+p.name;img.referrerPolicy='no-referrer';const button=action('',()=>showPhoto(url,p.name));button.append(img);slot.append(button);}else slot.append(el('p','En attente de photo…'));}
      }
    });
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
      let blob=null,previewURL=null,pendingUpload=null,currentUpload=null,busy=false,roomClosed=false,photoActive=p.activity==='photo';
      const discard=photo=>{if(photo?.deleteToken)window.AboubaPhotoCleanup.remove(photo.deleteToken).catch(()=>{});};
      const roomEnded=()=>{roomClosed=true;input.disabled=true;send.disabled=true;discard(currentUpload);discard(pendingUpload);notice('Cette salle est fermée.');stopPresence();};
      const send=action('Envoyer la photo',async()=>{if(!blob||busy||!photoActive||roomClosed)return;busy=true;send.disabled=true;input.disabled=true;progress.hidden=false;notice('Envoi de la photo…');try{pendingUpload||=await upload(blob,v=>progress.value=v);if(roomClosed||!photoActive){discard(pendingUpload);pendingUpload=null;return;}await sdk.set(sdk.ref(db,path+'/photo'),{url:pendingUpload.url,publicId:pendingUpload.publicId,sentAt:sdk.serverTimestamp()});if(roomClosed||!photoActive){discard(pendingUpload);pendingUpload=null;return;}discard(currentUpload);currentUpload=pendingUpload;notice('Photo affichée sur l’écran principal !');blob=null;pendingUpload=null;send.textContent='Photo envoyée';}catch(e){fail(e);send.disabled=roomClosed;send.textContent='Réessayer';}finally{busy=false;input.disabled=roomClosed||!photoActive;progress.hidden=true;}});send.disabled=true;
      input.addEventListener('change',async()=>{const f=input.files[0];if(!f||busy)return;send.disabled=true;notice('Préparation de la photo…');blob=null;discard(pendingUpload);pendingUpload=null;try{blob=await compress(f);if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(blob);preview.src=previewURL;preview.hidden=false;send.textContent='Envoyer la photo';send.disabled=roomClosed||!uploadReady();notice(uploadReady()?'Ta photo est prête.':'L’envoi attend la configuration de l’hébergeur.');}catch(e){fail(e);}});
      const actions=el('div',undefined,'actions');actions.append(label,send);panel.append(preview,actions,progress,el('p','En envoyant, tu partages cette photo avec la salle. Elle sera hébergée sur Cloudinary et accessible aux personnes disposant de son lien.','upload-note'));
      notice(uploadReady()?'Prends une photo pour l’afficher sur l’écran principal.':'Tu es connecté. L’envoi des photos n’est pas encore activé.');
      const note=panel.querySelector('.upload-note');
      const updateActivity=seat=>{if(!seat){roomEnded();return;}panel.style.setProperty('--color',seat.color);panel.querySelector('h2').textContent=seat.name;panel.querySelector('.avatar').textContent=seat.name[0].toUpperCase();
        const next=seat.activity==='photo';if(photoActive&&!next){discard(currentUpload);discard(pendingUpload);currentUpload=null;pendingUpload=null;blob=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;preview.hidden=true;send.disabled=true;}
        photoActive=next;actions.hidden=!next;note.hidden=!next;preview.hidden=!next||!previewURL;input.disabled=!next||roomClosed||busy;notice(next?'Prends une photo pour l’afficher sur l’écran principal.':'Tu es connecté. En attente du jeu…');
      };updateActivity(p);
      unsubscribe=sdk.onValue(r,snap=>updateActivity(snap.val()),()=>roomEnded());
    }catch(e){fail(e);}
  }
  window.addEventListener('pagehide',()=>{unsubscribe();stopPresence();if(db)sdk.goOffline(db);});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  (params.has('room')?player():host()).catch(fail);
})();
