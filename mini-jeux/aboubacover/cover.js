(() => {
  'use strict';
  const E=window.AboubaCover,$=id=>document.getElementById(id),stage=$('stage'),footer=$('players');
  const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const button=(text,fn,cls='')=>{const b=make('button',text,cls);b.type='button';b.addEventListener('click',event=>{if(!transitioning)fn(event);});return b;};
  let players=[];try{const raw=JSON.parse(localStorage.getItem('mini-Jeux-host-players')||'[]');if(Array.isArray(raw))players=raw.filter(p=>p&&typeof p.name==='string'&&p.name.trim()&&/^#[0-9a-f]{6}$/i.test(p.color)).slice(0,6).map(p=>({name:p.name.trim(),color:p.color}));}catch{}
  let game=null,phase='setup',roleIndex=0,order=[],round=1,cursor=0,deadline=0,frame=0,epoch=0,speechTicket=0,voiceEnabled=true,pendingSpeech=null;
  let phoneRead=new Set(),phoneRoles=false;
  let choices=new Set(),options={undercovers:1,rounds:1,hints:true},usedWords=new Set();
  // Keep this game's requested transitions even when Windows disables UI animations.
  const reduced=()=>false;
  const wordHistoryKey='aboubacover-played-words-v1';
  try{const saved=JSON.parse(localStorage.getItem(wordHistoryKey)||'[]');if(Array.isArray(saved))usedWords=new Set(saved.filter(word=>typeof word==='string'&&window.AboubaCoverWords.some(e=>e.word===word)));}catch{}
  function pickWord(){
    let pool=window.AboubaCoverWords.filter(e=>!usedWords.has(e.word));
    if(!pool.length){
      // Start a new cycle without replaying the previous game's word immediately.
      const previous=[...usedWords].at(-1);usedWords.clear();
      pool=window.AboubaCoverWords.filter(e=>e.word!==previous);
      if(!pool.length)pool=window.AboubaCoverWords;
    }
    const entry=pool[Math.floor(Math.random()*pool.length)];usedWords.add(entry.word);
    try{localStorage.setItem(wordHistoryKey,JSON.stringify([...usedWords]));}catch{}
    return entry;
  }

  let transitioning=false,panelSerial=0;
  async function enter(panel){
    const ticket=++panelSerial,old=stage.firstElementChild;transitioning=true;
    if(old){old.inert=true;if(!reduced())await old.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(-9px) scale(.975)'}],{duration:300,easing:'ease-in-out',fill:'forwards'}).finished.catch(()=>{});}
    if(ticket!==panelSerial)return false;stage.replaceChildren(panel);panel.inert=true;
    if(!reduced()){const elements=[...panel.children].filter(el=>!el.classList.contains('ranking')&&!el.classList.contains('hurry'));elements.forEach((el,i)=>appear(el,80+i*45));panel.querySelectorAll('.ranking-row').forEach((el,i)=>appear(el,100+i*100));}
    if(!reduced())await panel.animate([{opacity:0,transform:'translateY(14px) scale(.965)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:520,easing:'cubic-bezier(.22,.61,.36,1)'}).finished.catch(()=>{});
    if(ticket!==panelSerial)return false;panel.inert=false;transitioning=false;return true;
  }
  function panel(title,eyebrow='',glass=true){const p=make('section',undefined,'panel'+(glass?' glass':''));if(eyebrow)p.append(make('div',eyebrow,'eyebrow'));if(title)p.append(make('h1',title));return p;}
  function tint(id){document.body.style.setProperty('--player',players[id]?.color||'#a68af2');}
  function cancelVoice(){speechTicket++;if(pendingSpeech){pendingSpeech();pendingSpeech=null;}window.speechSynthesis?.cancel();}
  function say(text){
    cancelVoice();if(!voiceEnabled||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return Promise.resolve();
    const ticket=speechTicket;return new Promise(resolve=>{let done=false,timer;const finish=()=>{if(done)return;done=true;clearTimeout(timer);if(pendingSpeech===finish)pendingSpeech=null;resolve();};pendingSpeech=finish;
      const u=new SpeechSynthesisUtterance(text);u.lang='fr-FR';u.rate=.92;const voices=speechSynthesis.getVoices(),quality=v=>(/natural|neural|online|premium|enhanced/i.test(v.name)?100:0)+(v.lang.toLowerCase()==='fr-fr'?10:0),voice=voices.filter(v=>v.lang.toLowerCase().startsWith('fr')).sort((a,b)=>quality(b)-quality(a))[0];if(voice)u.voice=voice;u.onend=finish;u.onerror=finish;timer=setTimeout(()=>{if(ticket===speechTicket)speechSynthesis.cancel();finish();},10000);try{speechSynthesis.speak(u);}catch{finish();}
    });
  }

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let announcement=null;
  async function announce(panel,ms){
    const state={requested:false,finish:null};announcement=state;
    await enter(panel);
    if(!state.requested)await new Promise(resolve=>{
      const timer=setTimeout(done,ms);
      function done(){clearTimeout(timer);state.finish=null;resolve();}
      state.finish=done;
    });
    if(announcement===state)announcement=null;
  }

  function roster(root){const r=make('div',undefined,'roster');players.forEach(p=>{const item=make('span',p.name);item.style.setProperty('--color',p.color);r.append(item);});root.append(r);}
  function setup(){epoch++;cancelVoice();cancelAnimationFrame(frame);phase='setup';footer.hidden=true;document.body.classList.remove('pressure');tint(null);const p=panel('Aboubacover');
    if(players.length<3){p.append(make('p','Il faut au moins 3 joueurs pour jouer.'));const link=make('a','Gérer les joueurs →');link.href='../../index.html#players';p.append(link);enter(p);return;}
    const form=make('form'),settings=make('div',undefined,'settings');
    function counter(title,initial,min,max){
      let value=initial;const wrap=make('div',undefined,'counter-field'),name=make('span',title,'counter-label'),controls=make('div',undefined,'counter-controls'),number=make('output',String(value),'counter-value');number.setAttribute('aria-label',title);number.setAttribute('aria-live','polite');
      const update=delta=>{value=Math.max(min,Math.min(max,value+delta));number.textContent=String(value);minus.disabled=value===min;plus.disabled=value===max;if(!reduced())number.animate([{opacity:.45,transform:'translateY('+(-delta*6)+'px) scale(.9)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:250,easing:'ease-out'});};
      const minus=button('−',()=>update(-1),'counter-minus'),plus=button('+',()=>update(1),'counter-plus');minus.setAttribute('aria-label','Diminuer : '+title);plus.setAttribute('aria-label','Augmenter : '+title);minus.disabled=value===min;plus.disabled=value===max;controls.append(minus,number,plus);wrap.append(name,controls);return {root:wrap,get value(){return value;}};
    }
    const select=counter('Undercovers',Math.min(options.undercovers,players.length-1),1,players.length-1),rounds=counter('Tours de mots',options.rounds,1,10);
    const hintsLabel=make('label',undefined,'check'),hints=make('input');hints.type='checkbox';hints.checked=options.hints;hintsLabel.append(hints,make('span','Indice'));settings.append(select.root,rounds.root,hintsLabel);
    const start=make('button','Commencer','primary');start.type='submit';form.append(settings,start);form.addEventListener('submit',event=>{event.preventDefault();if(transitioning||!form.reportValidity())return;options={undercovers:Number(select.value),rounds:Number(rounds.value),hints:hints.checked};startGame();});p.append(form);if(!window.speechSynthesis)p.append(make('p','La voix n’est pas disponible ici. Les instructions restent affichées.','voice-note'));enter(p);
  }
  async function startGame(){epoch++;const entry=pickWord();game=E.create(players,options,entry);roleIndex=0;round=1;cursor=0;phase='eyes-closed';footer.hidden=true;phoneRead=new Set();phoneRoles=!!window.PourtyGamePhones?.active?.allOnline();if(phoneRoles){await distributePhones();return;}
    const p=panel('Tout le monde ferme les yeux','Distribution des rôles',false);p.append(button('Annoncer les rôles →',nextRole,'primary next'));await enter(p);if(phase==='eyes-closed')say('Tout le monde ferme les yeux.');
  }
  async function distributePhones(){
    phase='phone-roles';cancelVoice();const p=panel('Regardez vos téléphones','',false),list=make('div',undefined,'roster');
    players.forEach((player,id)=>{const row=make('button',player.name);row.type='button';row.style.color=player.color;row.dataset.phoneRead=id;row.title='Confirmer la lecture pour ce joueur';row.onclick=()=>markPhoneRead(id);list.append(row);});p.append(list);
    await enter(p);
  }
  function markPhoneRead(id){
    if(phase!=='phone-roles'||phoneRead.has(id))return;phoneRead.add(id);const row=stage.querySelector('[data-phone-read="'+id+'"]');if(row){row.textContent=players[id].name+' ✓';row.disabled=true;}
    if(phoneRead.size===players.length){phase='eyes-open';startRound();}
  }
  async function nextRole(){
    if(!['eyes-closed','role'].includes(phase))return;
    if(phase==='role')roleIndex++;
    if(roleIndex>=game.roleOrder.length){openEyes();return;}
    phase='calling';const run=epoch,id=game.roleOrder[roleIndex];tint(id);const p=panel('','',false);p.append(make('div',players[id].name,'active-name'));const loading=make('div',undefined,'calling'),dots=make('div',undefined,'calling-dots');for(let i=0;i<3;i++)dots.append(make('i'));loading.append(dots);p.append(loading);await enter(p);
    if(run!==epoch)return;await say(players[id].name);await wait(150);if(run!==epoch||phase!=='calling')return;
    phase='role';const spy=game.undercoverIds.includes(id),role=panel('','',false);role.append(make('div',players[id].name,'active-name'));
    if(!window.PourtyGamePhones?.active?.online(id))role.append(make('div',spy?(options.hints?game.entry.hint:'Tu es imposteur'):game.entry.word,'secret'+(spy&&!options.hints?' impostor':'')));
    if(window.PourtyGamePhones?.active?.online(id))role.append(button('J’ai lu',nextRole,'primary'));
    await enter(role);
  }
  async function openEyes(){phase='eyes-open';cancelVoice();tint(null);const p=panel('Tout le monde ouvre les yeux','',false);p.append(button('Commencer les tours →',()=>startRound(),'primary next'));await enter(p);if(phase==='eyes-open')say('Tout le monde ouvre les yeux.');}
  function avatar(id){const a=make('span',players[id].name.slice(0,1).toUpperCase(),'player-circle');a.style.setProperty('--color',players[id].color);return a;}
  let barGame=null;const cards=new Map();
  function appear(el,delay=0){if(!reduced())el.animate([{opacity:0,transform:'translateY(7px) scale(.85)'},{opacity:el.disabled?.35:1,transform:'translateY(0) scale(1)'}],{duration:420,delay,easing:'cubic-bezier(.22,.61,.36,1)',fill:'backwards'});}
  async function hideBar(){if(footer.hidden)return;if(!reduced())await footer.animate([{opacity:1,transform:'translateX(-50%) scale(1)'},{opacity:0,transform:'translateX(-50%) translateY(10px) scale(.96)'}],{duration:300,easing:'ease-in',fill:'none'}).finished.catch(()=>{});footer.hidden=true;}
  function bar(active=null){
    const opening=footer.hidden;footer.hidden=false;
    if(barGame!==game){cards.clear();footer.replaceChildren();barGame=game;}
    for(const id of order){
      let card=cards.get(id),fresh=!card;
      if(fresh){
        const root=make('div',undefined,'player-pill'),heading=make('div',undefined,'pill-heading'),history=make('div',undefined,'word-history'),voters=make('div',undefined,'received-votes');
        root.style.setProperty('--color',players[id].color);root.dataset.player=String(id);
        heading.append(avatar(id),make('span',players[id].name,'player-name'));root.append(heading,history,voters);
        card={root,heading,history,voters,historyKey:null,checked:false,received:new Set()};cards.set(id,card);
      }
      card.root.classList.toggle('current',id===active);
      if(footer.children[order.indexOf(id)]!==card.root)footer.append(card.root);
      const answers=game.words.map(words=>words?.[id]),key=JSON.stringify(answers);
      if(key!==card.historyKey){
        const count=answers.filter(a=>a!==undefined).length;card.history.replaceChildren();
        answers.forEach((answer,r)=>{if(answer===undefined)return;const line=make('div');if(count>1)line.append(make('em',(r+1)+'. '));line.append(document.createTextNode(answer??'Aucune réponse'));card.history.append(line);});
        if(card.historyKey!==null)appear(card.history);card.historyKey=key;
      }
      if(game.votes[id]!==null&&!card.checked){const check=make('span','✓','vote-done');check.title='Vote validé';check.setAttribute('aria-label','Vote validé');card.heading.append(check);card.checked=true;appear(check);}
      game.votes.forEach((targets,voter)=>{if(!targets?.includes(id)||card.received.has(voter))return;const circle=avatar(voter);circle.classList.add('voter-circle');circle.dataset.voter=String(voter);circle.title=players[voter].name+' a voté pour '+players[id].name;circle.setAttribute('aria-label',circle.title);card.voters.append(circle);card.received.add(voter);appear(circle,70);});
      if(fresh||opening)appear(card.root,order.indexOf(id)*35);
    }
  }
  async function startRound(){if(!['eyes-open','round-end'].includes(phase))return;phase='round-intro';cancelVoice();const run=epoch;order=E.shuffle(players.map((_,i)=>i));cursor=0;bar();tint(null);const p=panel('Tour '+round+' / '+options.rounds,'Ordre de passage',false);rosterInOrder(p);await announce(p,3200);if(run!==epoch||phase!=='round-intro')return;wordTurn();}
  function rosterInOrder(p){const r=make('div',undefined,'roster');order.forEach((id,i)=>{const label=make('span',(i+1)+'. '+players[id].name);label.style.setProperty('--color',players[id].color);r.append(label);});p.append(r);}
  async function wordTurn(){phase='word';const id=order[cursor];tint(id);bar(id);document.body.classList.remove('pressure');const p=panel('',`Tour ${round} / ${options.rounds}`),head=make('div',undefined,'turn-head'),who=make('div');who.append(make('div',players[id].name,'active-name'),make('span','Donne un mot lié au mot secret','secret-label'));const clock=make('b','45','clock');head.append(who,clock);const track=make('div',undefined,'clock-track'),fill=make('i');track.append(fill);const hurry=make('div','Vite, dépêche-toi !','hurry');hurry.setAttribute('role','status');const form=make('form',undefined,'word-form'),input=make('input');input.type='text';input.maxLength=70;input.autocomplete='off';input.spellcheck=false;input.placeholder='Ton mot…';input.setAttribute('aria-label','Mot proposé par '+players[id].name);const submit=make('button','Valider','primary');submit.type='submit';submit.disabled=true;input.addEventListener('input',()=>submit.disabled=!input.value.trim());form.append(input,submit);form.addEventListener('submit',event=>{event.preventDefault();if(input.value.trim())commitWord(input.value.trim());});p.append(head,track,hurry,form);const run=epoch;await enter(p);if(run!==epoch||phase!=='word')return;input.focus();deadline=performance.now()+60000;let last=-1,pressure=false;
    const tick=()=>{if(phase!=='word')return;const left=deadline-performance.now();if(left<=0){commitWord(null);return;}const urgent=left<=15000;if(urgent&&!pressure){pressure=true;document.body.classList.add('pressure');}const seconds=Math.ceil((urgent?left:left-15000)/1000);if(seconds!==last){last=seconds;clock.textContent=String(seconds);}fill.style.transform='scaleX('+Math.max(0,(urgent?left/15000:(left-15000)/45000))+')';frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  }
  async function commitWord(word){if(phase!=='word'||transitioning)return;phase='word-transition';cancelAnimationFrame(frame);document.body.classList.remove('pressure');game.words[round-1]||=Array(players.length);game.words[round-1][order[cursor]]=word;bar();const run=epoch;const form=stage.querySelector('form');if(form)for(const el of form.elements)el.disabled=true;await wait(350);if(run!==epoch)return;cursor++;if(cursor<order.length){wordTurn();return;}if(round<options.rounds){round++;phase='round-end';startRound();}else beginVoting();}
  async function beginVoting(){phase='vote-intro';cancelVoice();tint(null);bar();const run=epoch,p=panel('VOTE','',false);p.classList.add('vote-intro');await announce(p,2400);if(run!==epoch||phase!=='vote-intro')return;cursor=0;voteTurn();}
  function voteTurn(){phase='vote';choices=new Set();const id=order[cursor];tint(id);bar(id);const p=panel('',`Vote ${cursor+1} / ${players.length}`);p.append(make('div',players[id].name,'active-name'));const count=make('p','0 / '+options.undercovers+' suspect'+(options.undercovers>1?'s':'')),grid=make('div',undefined,'vote-grid'),submit=button('Valider le vote',async()=>{if(phase!=='vote')return;E.vote(game,id,[...choices]);phase='vote-transition';submit.disabled=true;bar();const run=epoch;await wait(650);if(run!==epoch)return;cursor++;if(cursor<order.length)voteTurn();else reveal();},'primary');submit.disabled=true;players.forEach((player,target)=>{if(target===id)return;const b=button('',()=>{if(phase!=='vote')return;if(choices.has(target))choices.delete(target);else if(choices.size<options.undercovers)choices.add(target);update();},'vote-choice');b.style.setProperty('--color',player.color);b.setAttribute('aria-pressed','false');const tick=make('span','','tick');b.setAttribute('aria-label',player.name);b.append(avatar(target),make('span',player.name),tick);grid.append(b);b.dataset.target=String(target);});function update(){count.textContent=choices.size+' / '+options.undercovers+' suspect'+(options.undercovers>1?'s':'');for(const b of grid.children){const selected=choices.has(Number(b.dataset.target));b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.querySelector('.tick').textContent=selected?'✓':'';b.disabled=!selected&&choices.size===options.undercovers;}submit.disabled=choices.size!==options.undercovers;}p.append(count,grid,submit);enter(p);}
  async function reveal(){phase='reveal';cancelVoice();tint(null);await hideBar();const run=epoch,p=panel('Les masques tombent','Révélation',false);await announce(p,1500);if(run!==epoch)return;const title=game.undercoverIds.map(id=>players[id].name).join(' · '),r=panel(title,game.undercoverIds.length>1?'Les undercovers':'L’undercover',false);r.append(make('p','Le mot secret était'),make('div',game.entry.word,'secret'));await announce(r,3200);if(run!==epoch)return;results();}
  function results(){window.PourtyGamePhones?.finish();phase='results';const rows=E.score(game),p=panel('Classement','',false);p.classList.add('results');p.append(make('p','Mot secret : '+game.entry.word));const list=make('div',undefined,'ranking');for(const r of rows){const row=make('div',undefined,'ranking-row');row.dataset.rank=String(r.rank);row.style.setProperty('--color',r.player.color);const detail=make('div');detail.append(make('div',r.player.name+(r.undercover?' · Undercover':''),'result-name'),make('div',r.undercover?(players.length-game.undercoverIds.length-r.caughtBy)+' / '+(players.length-game.undercoverIds.length)+' civils trompés':r.hits+' / '+options.undercovers+' undercovers trouvés','result-detail'),make('div','Votes : '+game.votes[r.id].map(id=>players[id].name).join(', '),'result-votes'));const points=make('div',String(r.points),'score');points.append(make('small',' pts'));row.append(make('div','#'+r.rank,'rank'),detail,points);list.append(row);}const actions=make('div',undefined,'actions'),back=make('a','Retour aux mini-jeux');back.href='../../minigames.html';actions.append(button('Rejouer',setup,'primary'),back);p.append(list,actions);enter(p);}
  window.addEventListener('keydown',event=>{if(event.code!=='Space'||event.repeat||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;if(announcement){event.preventDefault();announcement.requested=true;announcement.finish?.();return;}if(['eyes-closed','role','eyes-open','calling'].includes(phase)){event.preventDefault();if(transitioning)return;if(phase==='eyes-open')startRound();else if(phase!=='calling')nextRole();}});
  window.addEventListener('pagehide',()=>{epoch++;cancelVoice();cancelAnimationFrame(frame);});
  setup();

  window.PourtyGamePhones?.register({id:'aboubacover',roster:()=>players,ranks:()=>phase==='results'?players.map((_,i)=>E.score(game).find(r=>r.id===i)?.rank):null,pill:i=>cards.get(i)?.root,view:(i,h)=>{
    if(!game)return {};
    const secretFor=id=>game.undercoverIds.includes(id)?(options.hints?game.entry.hint:'Tu es imposteur'):game.entry.word;
    if(phase==='phone-roles')return {key:epoch+':roles',secret:phoneRead.has(i)?null:secretFor(i),note:phoneRead.has(i)?'En attente des autres joueurs…':'',actions:transitioning||phoneRead.has(i)?[]:[h.action('read','J’ai lu',()=>markPhoneRead(i))]};
    if(phase==='role'&&game.roleOrder[roleIndex]===i)return {owner:i,key:epoch+':role:'+roleIndex,secret:secretFor(i),actions:transitioning?[]:[h.action('read','J’ai lu',()=>nextRole())]};
    const owner=order[cursor]??-1;
    if(phase==='word')return {owner,key:epoch+':word:'+round+':'+cursor,deadline:h.time(deadline),duration:60,note:deadline-performance.now()<=15000?'Vite, dépêche-toi !':'',actions:transitioning?[]:h.field('.word-form input',()=>commitWord(stage.querySelector('.word-form input').value.trim()),{maxLength:70,label:'Valider mon mot'})};
    if(phase==='vote')return {owner,key:epoch+':vote:'+cursor,title:'Choisis '+options.undercovers+' suspect'+(options.undercovers>1?'s':''),actions:transitioning?[]:[...h.buttons('.vote-grid button',{kind:'player',colors:h.all('.vote-grid button').filter(b=>h.visible(b)&&!b.disabled).map(b=>players[Number(b.dataset.target)].color)}),...h.buttons('#stage .panel>.primary')]};
    return {key:epoch+':'+phase};
  }});
})();
