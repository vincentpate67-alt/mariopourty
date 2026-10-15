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
  async function host(){await window.startPhotoHost({el,action,avatar,notice});}
  async function compress(file){
    if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw Error('Choisis une image de moins de 20 Mo.');
    const local=URL.createObjectURL(file);try{const img=new Image();img.src=local;await img.decode();let ratio=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);let result;for(const quality of [.82,.65,.48]){result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(result&&result.size<700000)break;}if(!result||result.size>1000000)throw Error('Cette image reste trop lourde. Choisis une photo plus petite.');return result;}catch(e){if(e.message?.startsWith('Cette'))throw e;throw Error('Image illisible. Essaie une photo JPEG ou PNG.');}finally{URL.revokeObjectURL(local);}
  }
  function upload(blob,progress){return new Promise((resolve,reject)=>{const x=new XMLHttpRequest(),body=new FormData();body.append('file',blob,'photo.jpg');body.append('upload_preset',cfg.cloudinary.uploadPreset);x.open('POST','https://api.cloudinary.com/v1_1/'+encodeURIComponent(cfg.cloudinary.cloudName)+'/image/upload');x.timeout=60000;x.upload.onprogress=e=>{if(e.lengthComputable)progress(e.loaded/e.total);};x.onerror=()=>reject(Error('Envoi interrompu. Vérifie ta connexion.'));x.ontimeout=()=>reject(Error('L’envoi a pris trop de temps. Réessaie.'));x.onload=()=>{try{const value=JSON.parse(x.responseText);const url=C.imageURL(value.secure_url,cfg.cloudinary.cloudName);if(x.status<200||x.status>=300||!url)throw Error();resolve({url,publicId:value.public_id,deleteToken:typeof value.delete_token==='string'?value.delete_token:null});}catch{reject(Error('L’hébergeur a refusé la photo. Vérifie sa configuration ou son quota.'));}};x.send(body);});}
  async function player(){
    document.body.classList.add('player-controller','photo-game-player');$('connection').hidden=true;$('players').hidden=true;
    const token=params.get('player');roomId=params.get('room');
    if(!C.validToken(token)||!C.validToken(roomId)){notice('Lien de joueur invalide.',true);return;}
    let offset=0,seat=null,blob=null,previewURL=null,busy=false,signature='',raf,currentUpload=null,alive=true,boardUI=null;
    const now=()=>Date.now()+offset,storeKey='pourty-photo-upload:'+roomId+':'+token;
    try{currentUpload=JSON.parse(sessionStorage.getItem(storeKey)||'null');}catch{}
    const discard=()=>{if(currentUpload?.deleteToken)window.AboubaPhotoCleanup.remove(currentUpload.deleteToken).catch(()=>{});currentUpload=null;sessionStorage.removeItem(storeKey);};
    const panel=$('phone');panel.hidden=false;
    const head=document.querySelector('header'),identity=el('div',undefined,'player-identity'),name=el('h1'),face=el('span','','avatar');identity.append(face,name);head.replaceChildren(identity,$('connection'));
    const content=el('div',undefined,'controller-content');panel.append(content);
    const time=el('div',undefined,'phone-timer');panel.before(time);time.hidden=true;
    const preview=el('img',undefined,'preview');preview.alt='Ta photo avant validation';preview.hidden=true;
    const input=el('input');input.type='file';input.accept='image/*';input.capture='user';
    const pick=el('label',undefined,'file-label'),pickText=el('span','Prendre une photo');pick.append(pickText,input);
    const progress=el('progress');progress.max=1;progress.hidden=true;
    let send;
    const allowed=()=>alive&&seat?.activity==='photo'&&seat.game?.phase==='capture'&&now()<=seat.game.deadline&&seat.photo?.gameId!==seat.game.id;
    const releasePreview=()=>{blob=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;preview.hidden=true;input.value='';pickText.textContent='Prendre une photo';};
    function draw(){
      if(!alive||!seat)return;name.textContent=seat.name;document.title=seat.name+' · Mario Pourty';face.textContent=seat.name[0].toUpperCase();identity.style.setProperty('--color',seat.color);face.style.setProperty('--color',seat.color);panel.style.setProperty('--color',seat.color);
      if(['board','mini'].includes(seat.activity)){discard();releasePreview();time.hidden=true;notice('');boardUI?.update(seat.controller);signature='board';return;}boardUI?.hide();
      const g=seat.activity==='photo'?seat.game:null,locked=!!g&&seat.photo?.gameId===g.id,voted=!!g&&seat.vote?.gameId===g.id&&seat.vote?.round===g.round;
      if(currentUpload&&(!g||g.id!==currentUpload.gameId||g.phase==='final'))discard();
      const next=JSON.stringify([g?.id,g?.phase,g?.round,locked,voted,seat.vote?.choice,g?.points,g?.correct]);if(next===signature)return;
      const previous=signature;signature=next;content.replaceChildren();if(previous)content.animate([{opacity:0,transform:'translateY(10px) scale(.97)'},{opacity:1,transform:'none'}],{duration:350,easing:'ease-out'});
      notice('');
      if(!g){releasePreview();content.append(el('h2','En attente du jeu…'));return;}
      if(g.phase!=='capture')releasePreview();
      if(g.phase==='capture'){
        content.append(el('p','Imite cette situation','prompt-label'),el('h2',g.prompt,'phone-prompt'));
        if(locked){content.append(el('div','✓','photo-validated'),el('h3','Photo validée !'));releasePreview();return;}
        content.append(preview,pick,send,progress,el('p','Ta photo sera révélée pendant la partie.','upload-note'));return;
      }
      if(g.phase==='order'){content.append(el('h2','Regardez l’écran principal'),el('div','✦','waiting-star'));return;}
      if(g.phase==='vote'){
        content.append(el('h2',g.canVote?'Quelle était sa situation ?':'C’est ta photo !'),el('p',g.canVote?g.subjectName:'À tes amis de deviner.','stage-caption'));
        if(!g.canVote)return;
        const choices=el('div',undefined,'phone-choices');(g.options||[]).forEach((text,i)=>{const b=action('',async()=>{
          if(busy||now()>g.deadline||seat.vote?.gameId===g.id&&seat.vote?.round===g.round)return;busy=true;choices.querySelectorAll('button').forEach(n=>n.disabled=true);
          try{await sdk.set(sdk.ref(db,path+'/vote'),{gameId:g.id,round:g.round,choice:i,at:sdk.serverTimestamp()});}catch(e){notice('Vote non enregistré : '+(now()>g.deadline?'le temps est écoulé.':'réessaie.'),true);if(now()<=g.deadline)choices.querySelectorAll('button').forEach(n=>n.disabled=false);}finally{busy=false;}
        },'answer-card');b.dataset.answer='ABCD'[i];b.setAttribute('aria-label','Réponse '+'ABCD'[i]);b.append(el('b','ABCD'[i]));b.disabled=voted||now()>g.deadline;b.classList.toggle('chosen',voted&&seat.vote.choice===i);choices.append(b);});content.append(choices);if(voted)content.append(el('p','Vote validé ✓','vote-confirmed'));return;
      }
      if(g.phase==='reveal'){content.append(el('h2',g.options?.[g.answer]||'La bonne réponse'),el('div',g.correct?'+1 point':g.points+' point'+(g.points!==1?'s':''),g.correct?'earned-point':'phone-score'));return;}
      if(g.phase==='final'){content.append(el('h2','Partie terminée'),el('div',g.points+' point'+(g.points!==1?'s':''),'phone-score'),el('p','Le classement est sur l’écran principal.'));}
    }
    let path;
    send=action('Valider ma photo',async()=>{
      if(!blob||busy||!allowed())return;busy=true;send.disabled=true;input.disabled=true;progress.hidden=false;progress.value=0;const gameId=seat.game.id;
      try{
        const photo=await upload(blob,value=>progress.value=value);
        if(!allowed()||seat.game.id!==gameId){if(photo.deleteToken)window.AboubaPhotoCleanup.remove(photo.deleteToken).catch(()=>{});notice('Le temps pour envoyer la photo est écoulé.');return;}
        currentUpload={...photo,gameId};sessionStorage.setItem(storeKey,JSON.stringify(currentUpload));
        await sdk.set(sdk.ref(db,path+'/photo'),{url:photo.url,publicId:photo.publicId,gameId,sentAt:sdk.serverTimestamp()});
      }catch(e){discard();notice('La photo n’a pas été validée. '+(allowed()?'Réessaie.':'Le temps est écoulé.'),true);}finally{busy=false;progress.hidden=true;input.disabled=!allowed();send.disabled=!allowed()||!blob;}
    });send.disabled=true;
    input.addEventListener('change',async()=>{const file=input.files[0];if(!file||busy||!allowed())return;const id=seat.game.id;busy=true;send.disabled=true;input.disabled=true;try{const compressed=await compress(file);if(!allowed()||seat.game.id!==id)return;releasePreview();blob=compressed;previewURL=URL.createObjectURL(blob);preview.src=previewURL;preview.hidden=false;pickText.textContent='Reprendre la photo';}catch(e){notice(e.message,true);}finally{busy=false;input.disabled=!allowed();send.disabled=!blob||!allowed();}});
    const tick=()=>{if(!alive)return;const g=seat?.activity==='photo'?seat.game:null;const timed=g&&['capture','vote'].includes(g.phase);time.hidden=!timed;if(timed){const left=Math.max(0,g.deadline-now()),seconds=Math.ceil(left/1000);time.textContent=seconds>=60?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):String(seconds);time.style.setProperty('--remaining',left/(g.phase==='capture'?90000:30000));time.classList.toggle('urgent',left<6000);if(!left){send.disabled=true;input.disabled=true;content.querySelectorAll('.phone-choices button').forEach(n=>n.disabled=true);}}raf=requestAnimationFrame(tick);};tick();
    const end=()=>{boardUI?.hide();alive=false;cancelAnimationFrame(raf);discard();releasePreview();stopPresence();content.replaceChildren(el('h2','Salle fermée'));time.hidden=true;notice('');};
    window.addEventListener('pagehide',()=>{alive=false;cancelAnimationFrame(raf);},{once:true});
    notice('Connexion…');
    try{
      await connect();path='photoRooms/'+roomId+'/players/'+token;const r=sdk.ref(db,path),uid=auth.currentUser.uid,initial=await sdk.get(r);if(!initial.exists())throw Error('Cette salle est fermée.');
      const claim=await sdk.runTransaction(sdk.ref(db,path+'/uid'),old=>old&&old!==uid?undefined:uid,{applyLocally:false});if(!claim.committed)throw Error('Cette place est déjà utilisée sur un autre téléphone.');
      const online=sdk.ref(db,path+'/online'),stopClock=sdk.onValue(sdk.ref(db,'.info/serverTimeOffset'),s=>offset=Number(s.val())||0);
      stopPresence=sdk.onValue(sdk.ref(db,'.info/connected'),async s=>{if(s.val()===true&&alive){try{await sdk.onDisconnect(online).set(false);await sdk.set(online,true);}catch(e){notice('Connexion interrompue.',true);}}});
      boardUI=window.PourtyBoardController({root:content,identity,sendReaction:r=>sdk.set(sdk.ref(db,path+'/reaction'),{...r,sentAt:sdk.serverTimestamp()}),send:cmd=>sdk.set(sdk.ref(db,path+'/boardCommand'),cmd),readMap:async()=>(await sdk.get(sdk.ref(db,'photoRooms/'+roomId+'/boardMap'))).val()});
      const stopSeat=sdk.onValue(r,s=>{seat=s.val();if(!seat){end();return;}draw();},end);unsubscribe=()=>{stopSeat();stopClock();};
    }catch(e){alive=false;cancelAnimationFrame(raf);notice(e.message||'Connexion impossible.',true);}
  }
  window.addEventListener('pagehide',()=>{unsubscribe();stopPresence();if(db)sdk.goOffline(db);});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  (params.has('room')?player():host()).catch(fail);
})();
