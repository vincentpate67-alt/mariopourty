(() => {
  const G=window.AboubaPhotoGame,C=window.AboubaPhotoCore;
  window.startPhotoHost=async({el,action,avatar,notice})=>{
    const session=window.parent!==window&&window.parent.PourtySession;
    if(!session?.photoUpdate){notice('Ouvre les téléphones depuis le menu principal, puis reviens ici.');document.getElementById('actions').append(action('Menu principal',()=>location.href='../../index.html#players'));return;}
    const now=()=>session.now?session.now():Date.now();
    document.body.classList.add('shared-host','photo-game-host');
    const stage=el('section',undefined,'game-stage'),hud=document.getElementById('players');hud.before(stage);document.getElementById('connection').hidden=true;notice('');
    let room=null,active=true,phase='',deadline=0,round=-1,subject=null,players=[],scores={},answers={},order=[],photos={},gameId=C.token(),frameId,started=false;
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const timer=()=>{const left=Math.max(0,deadline-now()),n=stage.querySelector('.game-timer');if(n){n.textContent=Math.ceil(left/1000)>=60?Math.floor(Math.ceil(left/1000)/60)+':'+String(Math.ceil(left/1000)%60).padStart(2,'0'):String(Math.ceil(left/1000));n.style.setProperty('--remaining',String(left/(phase==='capture'?90000:30000)));n.classList.toggle('urgent',left<6000);}if(active)frameId=requestAnimationFrame(timer);};timer();
    async function screen(...nodes){if(!active)return;if(stage.children.length){await stage.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.97) translateY(-8px)'}],{duration:230,easing:'ease-in'}).finished;}if(!active)return;stage.replaceChildren(...nodes);await stage.animate([{opacity:0,transform:'scale(.96) translateY(12px)'},{opacity:1,transform:'scale(1)'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'}).finished;}
    function drawHUD(){
      for(const p of players){let n=hud.querySelector('[data-key="'+p.key+'"]');if(!n){n=el('article',undefined,'photo-hud');n.dataset.key=p.key;n.style.setProperty('--color',p.color);n.append(avatar(p),el('strong',p.name),el('span',undefined,'hud-state'));hud.append(n);}
        const seat=room?.players?.[p.key];const ready=phase==='capture'?G.validPhoto(seat,gameId,deadline):phase==='vote'&&p.key!==subject?G.validVote(seat,gameId,round,deadline):false;
        n.querySelector('.hud-state').textContent=phase==='capture'?(ready?'✓':'…'):phase==='vote'?(p.key===subject?'📷':ready?'✓':'…'):(scores[p.key]||0)+' pt';n.classList.toggle('is-subject',p.key===subject);}
    }
    const update=(state,extra={})=>session.photoUpdate(Object.fromEntries(players.map(p=>[p.key,{...(state==='final'?{photo:null}:{}),game:{id:gameId,phase:state,round,deadline,points:scores[p.key]||0,...(extra[p.key]||{})}}])));
    const stop=session.subscribe(data=>{room=data;if(!data&&started){active=false;cancelAnimationFrame(frameId);stage.replaceChildren(el('h2','Salle fermée'));notice('Reviens au menu principal pour reconnecter les joueurs.');}drawHUD();});
    window.addEventListener('pagehide',()=>{active=false;cancelAnimationFrame(frameId);stop();},{once:true});
    const waitFor=async predicate=>{while(active&&now()<deadline&&!predicate())await sleep(100);return active;};
    async function finale(){
      if(!active)return;phase='final';subject=null;deadline=0;await update('final');drawHUD();
      const list=el('div',undefined,'final-ranking');for(const p of G.rank(players,scores)){const row=el('div',undefined,'ranking-row');row.style.setProperty('--color',p.color);row.style.setProperty('--delay',(p.rank-1)*160+'ms');row.append(el('b','#'+p.rank),avatar(p),el('strong',p.name),el('span',p.score+' point'+(p.score!==1?'s':'')));list.append(row);}
      const buttons=el('div',undefined,'actions');buttons.append(action('Rejouer',()=>location.reload()),action('Retour aux mini-jeux',()=>location.href='../../minigames.html'));
      await screen(el('h2','Classement final','stage-title'),...(!order.length?[el('p','Aucune photo validée cette fois.')]:[]),list,buttons);
    }
    async function run(){
      for(let i=0;i<100&&!room&&active;i++)await sleep(100);if(!room||!active){notice('La salle n’est pas disponible.');return;}
      players=Object.entries(room.players||{}).sort((a,b)=>a[1].index-b[1].index).map(([key,p])=>({key,name:p.name,color:p.color,index:p.index}));if(!players.length)return;
      started=true;answers=G.assignments(players.map(p=>p.key));scores=Object.fromEntries(players.map(p=>[p.key,0]));phase='capture';deadline=now()+90000;
      await session.photoUpdate(Object.fromEntries(players.map(p=>[p.key,{photo:null,vote:null,game:{id:gameId,phase,round,deadline,prompt:answers[p.key].prompt,points:0}}])));
      drawHUD();await screen(el('h2','Regardez vos téléphones','stage-title'),el('div','1:30','game-timer'),el('p','Prenez la pose !','stage-caption'));
      if(!await waitFor(()=>players.every(p=>G.validPhoto(room?.players?.[p.key],gameId,deadline))))return;
      photos=Object.fromEntries(players.filter(p=>G.validPhoto(room?.players?.[p.key],gameId,deadline)).map(p=>[p.key,room.players[p.key].photo]));order=G.shuffle(Object.keys(photos));
      if(!order.length){await finale();return;}
      phase='order';deadline=0;await update('order');drawHUD();
      const reel=el('div',undefined,'order-reel'),result=el('div',undefined,'order-result');await screen(el('h2','Qui se cache derrière cette tête ?','stage-title'),reel,result);
      const start=performance.now();let last=-1;while(active&&performance.now()-start<2700){const t=(performance.now()-start)/2700,index=Math.floor(28*(1-Math.pow(1-t,3)));if(index!==last){last=index;const p=players.find(p=>p.key===order[index%order.length]);reel.style.setProperty('--color',p.color);reel.replaceChildren(avatar(p),el('strong',p.name));}await sleep(25);}
      for(const key of order){const p=players.find(p=>p.key===key),card=el('div',undefined,'order-pill');card.style.setProperty('--color',p.color);card.append(avatar(p),el('span',p.name));result.append(card);await sleep(180);}
      if(!active)return;const first=players.find(p=>p.key===order[0]);reel.style.setProperty('--color',first.color);reel.replaceChildren(avatar(first),el('strong',first.name));reel.classList.add('selected');await sleep(850);
      for(round=0;round<order.length&&active;round++){
        subject=order[round];const p=players.find(p=>p.key===subject),q=answers[subject];phase='order';deadline=0;
        if(round>0){await update('order');const title=el('h2',p.name,'stage-title');title.style.color=p.color;await screen(title);await sleep(1100);}
        if(!active)return;
        const image=el('img',undefined,'face-photo');image.alt='La photo de '+p.name;image.referrerPolicy='no-referrer';image.src=C.imageURL(photos[subject].url,window.AboubaPhotoConfig.cloudinary.cloudName)||'';
        await Promise.race([image.decode().catch(()=>{}),sleep(4000)]);if(!active)return;
        const choices=el('div',undefined,'host-choices');q.options.forEach((text,i)=>{const card=el('div',undefined,'answer-card');card.dataset.answer='ABCD'[i];card.append(el('b','ABCD'[i]),el('span',text));choices.append(card);});
        const layout=el('div',undefined,'reveal-layout'),portrait=el('div',undefined,'portrait');portrait.style.setProperty('--color',p.color);portrait.append(image,el('h2',p.name));layout.append(portrait,choices);
        phase='vote';deadline=now()+30000;
        await session.photoUpdate(Object.fromEntries(players.map(player=>[player.key,{vote:null,game:{id:gameId,phase,round,deadline,options:q.options,subjectName:p.name,canVote:player.key!==subject,points:scores[player.key]}}])));
        drawHUD();await screen(el('div','30','game-timer compact'),layout);
        if(!await waitFor(()=>players.filter(player=>player.key!==subject).every(player=>G.validVote(room?.players?.[player.key],gameId,round,deadline))))return;
        const winners=players.filter(player=>player.key!==subject&&G.validVote(room?.players?.[player.key],gameId,round,deadline)&&room.players[player.key].vote.choice===q.answer);winners.forEach(player=>scores[player.key]++);
        phase='reveal';deadline=0;await update('reveal',Object.fromEntries(players.map(player=>[player.key,{options:q.options,answer:q.answer,subjectName:p.name,correct:winners.some(w=>w.key===player.key)}])));drawHUD();
        stage.querySelector('.game-timer')?.remove();[...choices.children].forEach((card,i)=>card.classList.add(i===q.answer?'correct':'incorrect'));
        const awarded=el('div',undefined,'awarded');for(const winner of winners){const badge=el('span',winner.name+' +1','point-pop');badge.style.setProperty('--color',winner.color);awarded.append(badge);}if(!winners.length)awarded.textContent='Personne n’a trouvé cette fois !';stage.append(awarded);await sleep(4100);
      }
      await finale();
    }
    run().catch(error=>{if(active){notice('La partie a été interrompue : '+error.message,true);stage.append(action('Réessayer',()=>location.reload()));}});
  };
})();
