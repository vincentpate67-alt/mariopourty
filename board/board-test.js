(() => {
  'use strict';
  const M=window.PourtyBoardModel,keys={session:'mario-pourty-editor-test-session',progress:'mario-pourty-editor-test-progress'};
  function launch(raw){const board=M.normalize(raw),errors=M.issues(board).errors;if(errors.length)throw Error(errors.join(' '));
    const session={version:1,editorTest:true,id:M.id('editor-test'),createdAt:new Date().toISOString(),map:{id:board.id,name:board.name,file:'board-play.html'},board,players:[{name:'Test',color:'#57bc91'}],gameMode:'normal',teams:[],turns:30,startingAC:100,startingStars:0,inventorySlots:3,movementDieMax:10,starPrice:20,shopMultiplier:1,shopSelling:true,bonusStars:false,bonusCategories:[],bonusCount:1,minigameIds:['editor-test']};
    localStorage.setItem(keys.session,JSON.stringify(session));localStorage.removeItem(keys.progress);
    return 'board-play.html?test=1&map='+encodeURIComponent(board.id);
  }
  function read(){try{const s=JSON.parse(localStorage.getItem(keys.session));if(!s?.editorTest||s.version!==1||!Array.isArray(s.players)||s.players.length<1||s.players.length>6||s.players.some(p=>!p||typeof p.name!=='string'||!/^#[0-9a-f]{6}$/i.test(p.color))||!s.id?.startsWith('editor-test-'))return null;s.board=M.normalize(s.board);if(M.issues(s.board).errors.length||s.map?.id!==s.board.id)return null;return s;}catch{return null;}}
  function initial(engine,session){let s=engine.create(session);s.order=session.players.map((_,id)=>id);s.rolls=session.players.map(()=>[1]);s.phase='order-ready';s=engine.start(s,session.board);s.phase='turn';s.starVisible=!!s.starNode;s.starIntroPending=false;session.players.forEach((p,id)=>{if(id&&p.testNode&&session.board.nodes.some(n=>n.id===p.testNode))s.positions[id]=p.testNode;});return s;}
  function skipMinigame(engine,state,session){return engine.finishMinigame({...M.clone(state),phase:'minigame-playing'},session,(state.duel?.participants||session.players).map((_,id)=>({playerIndex:id,rank:id+1,ac:0})));}
  function skipBuddies(engine,state,session){let next=state;while(next.phase==='turn'&&engine.active(next)!==0)next=engine.nextPlayer({...M.clone(next),phase:'land'},session);return next;}
  function addBuddy(engine,state,session,player,nodeId){
    if(!session.editorTest||!['turn','choice'].includes(state.phase)||session.players.length>=6)throw Error('Ajout indisponible : six joueurs maximum.');
    if(typeof player.name!=='string'||!player.name.trim()||player.name.length>24||!/^#[0-9a-f]{6}$/i.test(player.color)||!session.board.nodes.some(n=>n.id===nodeId))throw Error('Vérifie le nom, la couleur et la case.');
    const nextSession=M.clone(session),next=M.clone(state),id=session.players.length;
    nextSession.players.push({name:player.name.trim(),color:player.color,testPassive:true,testNode:nodeId});
    const defaults=engine.create(nextSession);
    for(const key of ['positions','wallets','rolls','inventories','inventoryCaps']){next[key]||=M.clone(defaults[key].slice(0,id));next[key].push(M.clone(defaults[key][id]));}
    next.positions[id]=nodeId;next.rolls[id]=[1];next.order.push(id);next.introQueue?.push(id);
    if(next.rankingBefore)next.rankingBefore.push(M.clone(next.wallets[id]));
    if(next.statistics){next.statistics.players.push(M.clone(defaults.statistics.players[id]));for(const h of next.statistics.history)h.stars.push(next.wallets[id].stars);}
    if(!engine.restore(next,nextSession))throw Error('La progression ne permet pas cet ajout pour le moment.');
    return {state:next,session:nextSession};
  }
  function saveBuddy(result){const previousSession=localStorage.getItem(keys.session),previousProgress=localStorage.getItem(keys.progress);try{localStorage.setItem(keys.session,JSON.stringify(result.session));localStorage.setItem(keys.progress,JSON.stringify(result.state));}catch(error){for(const [key,value]of [[keys.session,previousSession],[keys.progress,previousProgress]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}throw error;}}
  function buddyTools({root,session,getState,canEdit,add,move}){
    const box=document.createElement('section');box.className='test-buddies';const heading=document.createElement('h3');heading.textContent='Potes de test';const note=document.createElement('p');note.textContent='Ils restent sur le plateau et ne jouent pas de tour.';
    const name=document.createElement('input');name.maxLength=24;name.value='Pote '+session.players.length;name.setAttribute('aria-label','Nom du pote');
    const color=document.createElement('input');color.type='color';color.value=['#e98c75','#78b8ee','#c791e4','#e5bf63','#72cbbb'][session.players.length-1]||'#e98c75';color.setAttribute('aria-label','Couleur du pote');
    function positions(){const select=document.createElement('select');select.setAttribute('aria-label','Case du pote');session.board.nodes.forEach((n,i)=>{const o=document.createElement('option');o.value=n.id;o.textContent=(i+1)+' · '+(n.label||M.types[n.type].name);select.append(o);});return select;}
    const position=positions();position.value=session.board.nodes.find(n=>n.countsAsStep&&!getState().positions.includes(n.id))?.id||session.board.startId;
    const button=document.createElement('button');button.type='button';button.textContent=session.players.length>=6?'Maximum : 5 potes':'Ajouter un pote';button.disabled=session.players.length>=6;
    const message=document.createElement('p');message.className='test-buddies-message';
    button.addEventListener('click',()=>{if(!canEdit()){message.textContent='Attends le choix des actions ou une intersection.';return;}try{add({name:name.value,color:color.value},position.value);}catch(e){message.textContent=e.message;}});
    box.append(heading,note,name,color,position,button,message);
    session.players.forEach((p,id)=>{if(!id)return;const row=document.createElement('div');row.className='test-buddy-row';const label=document.createElement('strong');label.textContent=p.name;label.style.color=p.color;const select=positions();select.value=getState().positions[id];const moveButton=document.createElement('button');moveButton.type='button';moveButton.textContent='Déplacer';moveButton.addEventListener('click',()=>{if(!canEdit()){message.textContent='Attends le choix des actions ou une intersection.';return;}move(id,select.value);message.textContent=p.name+' déplacé.';});row.append(label,select,moveButton);box.append(row);});root.append(box);
  }
  function toolbar({openTools,restart,canEdit}){const bar=document.createElement('nav');bar.className='board-test-toolbar';bar.setAttribute('aria-label','Test du plateau');const title=document.createElement('span');title.textContent='Test solo';bar.append(title);
    for(const [label,action]of [['Outils de test',openTools],['Recommencer',()=>{if(canEdit())restart();}],['Retour à l’éditeur',()=>{location.href='board-editor.html';}]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',action);bar.append(b);}
    document.body.append(bar);document.body.classList.add('board-testing');
  }
  window.PourtyBoardTest=Object.freeze({keys,launch,read,initial,skipMinigame,skipBuddies,addBuddy,saveBuddy,buddyTools,toolbar});
})();
