(() => {
  'use strict';
  const base=new URL('.',document.currentScript.src),asset=path=>new URL(path,base).pathname;
  const visible=e=>!!e&&e.isConnected&&!e.closest('[hidden],[inert],.hidden')&&[e,...parents(e)].every(n=>getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden');
  function parents(e){const result=[];for(let p=e.parentElement;p;p=p.parentElement)result.push(p);return result;}
  const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],text=s=>q(s)?.textContent.trim()||'';
  const safeURL=src=>{try{const u=new URL(src,location.href);return u.origin===location.origin?u.pathname+u.search:'';}catch{return '';}};
  const images=e=>{const img=e.querySelector('img');if(img)return safeURL(img.src);const svg=[...e.querySelectorAll('svg')].at(-1);return svg?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg)):'';};
  let app=null,room=null,endRequested=false,endAt=0;
  function register(adapter){
    let shell=null;try{for(let w=window.parent;w!==window;w=w.parent){if(w.PourtySession?.miniAcquire){shell=w.PourtySession;break;}if(w===w.parent)break;}}catch{}
    if(!shell)return;
    const lease=shell.miniAcquire(window);if(!lease)return;
    let live=true,sending=false,last='',seq=0,roomReady=false;const ids=new WeakMap(),seen=new Map(),versions=new Map(),acks={},reactionSeen=new Map(),reactionAt=new Map();
    const runId=crypto.getRandomValues(new Uint32Array(3)).join('-'),bindings=new Map();
    let savedSeats=[];try{savedSeats=JSON.parse(localStorage.getItem('mini-Jeux-host-players')||'[]');}catch{}
    const roster=()=>adapter.roster(),index=p=>{if(typeof p==='number')return p;const exact=roster().indexOf(p);if(exact>=0)return exact;if(p&&Number.isInteger(p.id)&&roster()[p.id]?.name===p.name)return p.id;return roster().findIndex(r=>p&&(r.connectionId&&r.connectionId===p.connectionId||r.name===p.name&&r.color===p.color));};
    const action=(id,label,run,extra={})=>({id,label,kind:'button',run,...extra});
    const key=e=>{if(!ids.has(e))ids.set(e,'b'+(++seq));return ids.get(e);};
    const buttons=(selector,opts={})=>all(selector).filter(e=>visible(e)&&!e.disabled&&!e.classList.contains('disabled')).map((e,i)=>action(key(e),opts.labels?.[i]??e.getAttribute('aria-label')??(e.textContent.trim()||String(i+1)),()=>e.click(),{image:images(e),selected:e.matches('.active,.selected,[aria-pressed=true]'),...opts.kind&&{kind:opts.kind},...opts.colors&&{color:opts.colors[i%opts.colors.length]},...opts.preview&&{preview:true,run:()=>{e.dispatchEvent(new Event('mouseenter'));e.dispatchEvent(new Event('pointerenter'));},confirm:()=>e.click()}}));
    const field=(selector,submit,extra={})=>{const e=q(selector);if(!visible(e)||e.disabled)return [];return [action(key(e),'Valider',v=>{const value=String(v??'').slice(0,extra.maxLength||100);if(e.type==='number'||e.type==='range'){const n=Number(value);if(!Number.isFinite(n)||n<Number(e.min||0)||n>Number(e.max||1e9))return;}if(extra.pattern&&!new RegExp(extra.pattern).test(value))return;e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));if(submit){if(typeof submit==='function')submit();else q(submit)?.click();}},{kind:'entry',inputType:e.type==='number'||e.type==='range'?'number':'text',value:e.value,min:e.min||'',max:e.max||'',maxLength:extra.maxLength||100,...extra})];};
    const h={q,all,text,visible,action,buttons,field,index,images,safeURL,asset,styled,vote,
      time:deadline=>deadline?Math.round((lease.now()+deadline-performance.now())/100)*100:0,
      clickAt:(selector,x,y)=>{const e=q(selector),r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+x*r.width,clientY:r.top+y*r.height,button:0}));},
      online:i=>Object.values(room?.players||{}).some(p=>p.online&&match(p,roster()[i],i)),
      allOnline:()=>roster().length>0&&roster().every((_,i)=>h.online(i))
    };

    const polls=new Map();let finalRanks=null,credited=false,finalPanel=null;
    let boardMode=false;try{boardMode=JSON.parse(window.name)?.kind==='pourty-minigame';}catch{}
    const winsKey='pourty-mini-wins:'+lease.roomId;let wins={};try{wins=JSON.parse(sessionStorage.getItem(winsKey)||'{}');}catch{}
    const identity=i=>{const p=roster()[i];return p?.connectionId||savedSeats.find(s=>s.name===p?.name&&s.color===p?.color)?.connectionId||p?.name+'|'+p?.color;};
    function styled(selector,extra={}){return all(selector).filter(e=>visible(e)&&!e.disabled&&!e.classList.contains('disabled')).map(e=>{
      const cs=getComputedStyle(e),title=e.querySelector('.title,.name-title,strong'),description=e.querySelector('.desc,.description,p,.action-list');
      return action(key(e),title?.textContent.trim()||e.getAttribute('aria-label')||e.textContent.trim(),()=>e.click(),{kind:'card',image:images(e),description:description?.textContent.trim()||'',card:{background:cs.backgroundColor,backgroundImage:cs.backgroundImage,border:cs.borderColor,color:title?getComputedStyle(title).color:cs.color,shadow:cs.boxShadow},...extra});
    });}
    function vote(pollId,i,options,done,{strict=false,title='Vote'}={}){
      let poll=polls.get(pollId);if(!poll){poll={votes:{},done:false};polls.set(pollId,poll);}
      const counts=options.map(o=>Object.values(poll.votes).filter(id=>id===o.id).length);
      return {key:'vote:'+pollId,title,note:Object.keys(poll.votes).length+' / '+roster().length+' votes',actions:poll.done||poll.votes[i]!==undefined?[]:options.map(o=>action('vote-'+o.id,o.label,()=>{
        if(poll.done||poll.votes[i]!==undefined)return;poll.votes[i]=o.id;if(pollId==='end')updateEndVotes(poll);
        const tally=options.map(v=>({id:v.id,n:Object.values(poll.votes).filter(id=>id===v.id).length})).sort((a,b)=>b.n-a.n),top=tally[0],n=roster().length,allVoted=Object.keys(poll.votes).length===n;
        if(top&&(strict?top.n>n/2:top.n>n/2||top.n>=Math.ceil(n/2)&&top.n===Object.keys(poll.votes).length||allVoted)){
          const tied=tally.filter(v=>v.n===top.n);poll.done=true;done(tied[Math.floor(Math.random()*tied.length)].id);
        }
      },{kind:'vote',votes:counts[options.indexOf(o)],selected:poll.votes[i]===o.id}))};
    }
    function updateEndVotes(poll){
      if(boardMode)return;
      const entries=[['replay','Rejouer'],['random','Aléatoire']].map(([id,label])=>({id,label,count:Object.values(poll.votes).filter(v=>v===id).length})).filter(v=>v.count>0);
      if(!entries.length)return;
      if(!finalPanel){finalPanel=document.createElement('aside');finalPanel.className='phone-vote-counts';finalPanel.setAttribute('aria-live','polite');Object.assign(finalPanel.style,{position:'fixed',top:'max(10px, env(safe-area-inset-top))',right:'max(12px, env(safe-area-inset-right))',display:'grid',gap:'3px',color:'#e6edf9',font:'600 12px/1.4 system-ui',textAlign:'right',pointerEvents:'none',textShadow:'0 1px 4px #000',zIndex:2147483640});document.body.append(finalPanel);}
      for(const entry of entries){let row=finalPanel.querySelector('[data-choice="'+entry.id+'"]');if(!row){row=document.createElement('div');row.dataset.choice=entry.id;finalPanel.append(row);row.animate?.([{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'ease-out'});}row.textContent=entry.label+' '+entry.count+'/'+roster().length;}
    }
    function rankOf(pill){return Number(pill?.dataset.pourtyRank)||Number(pill?.querySelector('.rank-badge,.final-rank,.rank')?.textContent.match(/\d+/)?.[0])||Number([...pill?.children||[]].find(e=>/^#\d+$/.test(e.textContent.trim()))?.textContent.slice(1));}
    function playerPill(i){const candidates=all('.player-pill').filter(e=>e.dataset.pourtyPlayerIndex!==undefined?Number(e.dataset.pourtyPlayerIndex)===i:[...e.querySelectorAll('span,strong')].some(n=>n.textContent.trim()===roster()[i]?.name));return candidates.find(e=>rankOf(e)&&e.closest('.ranking-overlay,.ranking-list'))||candidates.find(e=>rankOf(e))||adapter.pill?.(i)||candidates[0];}
    function results(){
      if(!endRequested||Date.now()-endAt<1200)return null;
      const explicit=adapter.ranks?.();
      const rows=roster().map((p,i)=>({id:i,name:p.name,color:p.color,rank:explicit?.[i]||rankOf(playerPill(i))}));
      if(rows.some(r=>!Number.isInteger(r.rank)||r.rank<1||r.rank>roster().length))return null;
      if(!finalRanks)finalRanks=rows;
      if(!credited&&!boardMode){credited=true;for(const r of finalRanks)if(r.rank===1)wins[identity(r.id)]=(wins[identity(r.id)]||0)+1;try{sessionStorage.setItem(winsKey,JSON.stringify(wins));}catch{}}
      return finalRanks;
    }
    function match(seat,p,i){if(!p)return false;const original=savedSeats[i],id=p.connectionId||(original?.name===p.name&&original?.color===p.color?original.connectionId:null);return id?seat.clientId===id:seat.name===p.name&&seat.color===p.color;}
    function snapshot(){
      const result={};bindings.clear();
      roster().forEach((player,i)=>{
        const entry=Object.entries(room?.players||{}).find(([,seat])=>match(seat,player,i));if(!entry)return;const seatKey=entry[0];
        let v=adapter.view(i,h)||{};const ranking=results();if(ranking){v=boardMode?{key:'final',title:'Classement final'}:vote('end',i,[{id:'replay',label:'Rejouer'},{id:'random',label:'Au hasard'}],choice=>{if(choice==='replay')location.reload();else location.href=asset('../../minigames.html')+'?phoneRandom=1';},{title:'Classement final'});v.ranking=ranking;v.rank=ranking.find(r=>r.id===i)?.rank;}const available=(v.owner===undefined||index(v.owner)===i)&&!v.wait;
        const actions={},runs=new Map();if(available)for(const [order,a]of (v.actions||[]).filter(Boolean).entries()){
          const {run,confirm,id,...spec}=a;actions[id]={...spec,disabled:false,order};runs.set(id,{run,confirm});
        }
        const score=adapter.score?.(i)??'';
        const view={mini:true,game:adapter.id,sessionId:runId,title:available?(v.title||''):'' ,note:available?(v.note||''):'',color:player.color,canAct:Object.keys(actions).length>0,ready:Object.keys(actions).length>0,actions,ac:0,stars:0,capacity:0,inventory:[],score:String(score),wins:boardMode?null:wins[identity(i)]||0,ranking:v.ranking||null,rank:v.rank||null,layout:v.layout||null,panels:adapter.panels?.(i,h)||[],deadline:available?v.deadline||0:0,duration:v.duration||10,scene:available?v.scene||null:null,keyboard:available?v.keyboard||null:null,secret:available?v.secret||null:null,readouts:available?v.readouts||[]:[],key:String(v.key??''),ack:acks[seatKey]||''};
        let version=versions.get(seatKey);if(version?.deadline&&view.deadline&&Math.abs(version.deadline-view.deadline)<500)view.deadline=version.deadline;const semantic=JSON.stringify({...view,ack:''});if(!version||version.semantic!==semantic){version={semantic,deadline:view.deadline,id:runId+':'+(++seq)};versions.set(seatKey,version);}view.version=version.id;result[seatKey]=view;bindings.set(seatKey,runs);
      });
      for(const [seatKey,seat]of Object.entries(room?.players||{}))if(!result[seatKey])result[seatKey]={mini:true,game:adapter.id,sessionId:runId,version:runId+':spectator',key:'spectator',canAct:false,ready:false,actions:{},inventory:[],capacity:0,ac:0,stars:0,score:'',title:'',note:'',color:seat.color};
      return result;
    }
    async function publish(){if(!live||!lease.current()||sending)return;sending=true;try{const views=snapshot(),encoded=JSON.stringify(views);if(encoded!==last){await lease.publish(views);last=encoded;}}catch(e){console.warn('Téléphones mini-jeu:',adapter.id,e);}finally{sending=false;}}
    function receive(key,cmd){
      if(!cmd||seen.get(key)===cmd.nonce)return;seen.set(key,cmd.nonce);
      const view=snapshot()[key],run=bindings.get(key)?.get(cmd.action);if(!view?.canAct||view.version!==cmd.version||!run)return;
      acks[key]=cmd.nonce;try{if(cmd.value==='confirm'&&run.confirm)run.confirm();else run.run?.(cmd.value);}catch(e){console.warn('Commande mini-jeu:',adapter.id,e);}last='';publish();
    }
    const reactionIds=new Set(['guez','noob','ff','chad','goat','porto','aboubakar','skibidi','zzz','pog','plait-il','yuki','zebi','mashallah','mog','67','tigre']);
    const cleanupReactions=new Map();
    function react(i,id){
      cleanupReactions.get(i)?.();const wrapper=document.createElement('div'),image=document.createElement('img');wrapper.style.cssText='position:fixed;z-index:9999;pointer-events:none;width:210px;transform:translate(-50%,-100%);filter:drop-shadow(0 5px 10px #0005)';image.src=asset('../../assets/reactions/'+id+'.svg');image.style.width='100%';wrapper.append(image);document.body.append(wrapper);let frame,timer;
      const cleanup=()=>{cancelAnimationFrame(frame);clearTimeout(timer);wrapper.remove();cleanupReactions.delete(i);};cleanupReactions.set(i,cleanup);
      const position=()=>{const card=adapter.pill?.(i)||all('.player-pill').find(e=>e.dataset.pourtyPlayerIndex!==undefined&&Number(e.dataset.pourtyPlayerIndex)===i)||all('.player-pill').find(e=>e.textContent.includes(roster()[i]?.name));if(card){const r=card.getBoundingClientRect();wrapper.style.left=Math.max(105,Math.min(innerWidth-105,r.left+r.width/2))+'px';wrapper.style.top=Math.max(100,r.top-8)+'px';wrapper.style.visibility=visible(card)?'visible':'hidden';}frame=requestAnimationFrame(position);};position();
      image.animate?.([{opacity:0,transform:'translateY(12px) scale(.35)'},{opacity:1,transform:'scale(1.1)',offset:.14},{opacity:1,transform:'scale(1)',offset:.25},{opacity:1,transform:'translateY(-4px)',offset:.72},{opacity:0,transform:'translateY(-22px) scale(.55)'}],{duration:2700,easing:'ease-in-out',fill:'both'});timer=setTimeout(cleanup,2750);
    }
    const stop=lease.subscribe(data=>{room=data;if(!live||!lease.current())return;for(const [key,seat]of Object.entries(data?.players||{})){
      if(seat.activity==='mini')receive(key,seat.boardCommand);
      const r=seat.reaction;if(!r||reactionSeen.get(key)===r.nonce)continue;reactionSeen.set(key,r.nonce);if(!roomReady||lease.now()-Number(r.sentAt)>8000||seat.activity!=='mini'||!reactionIds.has(r.id)||Date.now()-(reactionAt.get(key)||0)<1800)continue;const i=roster().findIndex((p,i)=>match(seat,p,i));if(i>=0){reactionAt.set(key,Date.now());react(i,r.id);}
    }roomReady=true;});
    app={allOnline:h.allOnline,online:h.online,refresh:()=>{last='';publish();},h};
    const timer=setInterval(publish,200);publish();window.addEventListener('pagehide',()=>{live=false;finalPanel?.remove();clearInterval(timer);stop();for(const cleanup of cleanupReactions.values())cleanup();lease.release();},{once:true});
    return app;
  }
  window.PourtyGamePhones={register,finish(){if(!endRequested){endRequested=true;endAt=Date.now();}app?.refresh();},get active(){return app;}};
})();
