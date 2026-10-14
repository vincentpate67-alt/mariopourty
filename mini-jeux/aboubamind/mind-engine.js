(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AboubamindEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CODES=Array.from({length:9000},(_,i)=>String(i+1000));
  const digits=code=>Array.from({length:10},(_,d)=>[...code].filter(c=>Number(c)===d).length);
  function feedback(secret,guess){let good=0;const a=digits(secret),b=digits(guess);for(let i=0;i<4;i++)if(secret[i]===guess[i])good++;return{good,near:a.reduce((n,v,i)=>n+Math.min(v,b[i]),0)-good};}
  function shuffle(list,rng){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function knowledge(codes){const fixed=Array(4).fill(null),present=Array(10).fill(4);if(!codes.length)throw Error('Aucune solution possible');for(let i=0;i<4;i++)if(codes.every(c=>c[i]===codes[0][i]))fixed[i]=codes[0][i];for(const code of codes){const counts=digits(code);for(let d=0;d<10;d++)present[d]=Math.min(present[d],counts[d]);}return{fixed,present};}
  function remember(s){s.known=knowledge(s.possible);s.known.fixed.forEach((d,i)=>{if(d!==null)s.foundPlaces[i]=true;});s.known.present.forEach((v,d)=>s.foundDigits[d]=Math.max(s.foundDigits[d],v));}
  function create(count,rng=Math.random,code){if(!Number.isInteger(count)||count<1||count>6)throw Error('Nombre de joueurs invalide');const secret=code||CODES[Math.floor(rng()*CODES.length)];if(!/^[1-9]\d{3}$/.test(secret))throw Error('Code invalide');const order=shuffle(Array.from({length:count},(_,i)=>i),rng);return{secret,rng,order,initialOrder:[...order],round:0,turn:0,phase:'intro',remaining:20,possible:[...CODES],known:knowledge(CODES),foundPlaces:Array(4).fill(false),foundDigits:Array(10).fill(0),hints:[],usedHints:[],attempts:[],used:new Set(),scores:Array(count).fill(0),best:Array(count).fill(0),tries:Array(count).fill(0),winner:null,ranking:null};}
  function hintPool(secret){const a=[...secret].map(Number),sum=a.reduce((n,v)=>n+v,0),unique=new Set(a).size;
    const pool=[{id:'sum',text:'La somme des quatre chiffres est '+sum+'.',test:c=>[...c].reduce((n,v)=>n+Number(v),0)===sum},
      {id:'unique',text:'Le code contient '+unique+' chiffre'+(unique>1?'s différents.':' différent.'),test:c=>new Set(c).size===unique},
      {id:'even',text:a.filter(n=>n%2===0).length+' chiffre'+(a.filter(n=>n%2===0).length>1?'s du code sont pairs.':' du code est pair.'),test:c=>[...c].filter(n=>Number(n)%2===0).length===a.filter(n=>n%2===0).length},
      {id:'halfs',text:'Les deux premiers chiffres forment un nombre '+(Number(secret.slice(0,2))>Number(secret.slice(2))?'plus grand que':Number(secret.slice(0,2))<Number(secret.slice(2))?'plus petit que':'égal à')+' celui des deux derniers.',test:c=>Math.sign(Number(c.slice(0,2))-Number(c.slice(2)))===Math.sign(Number(secret.slice(0,2))-Number(secret.slice(2)))}];
    for(let i=0;i<4;i++){const label=['premier','deuxième','troisième','quatrième'][i];pool.push({id:'parity'+i,text:'Le '+label+' chiffre est '+(a[i]%2?'impair.':'pair.'),test:c=>Number(c[i])%2===a[i]%2});pool.push({id:'half'+i,text:'Le '+label+' chiffre est '+(a[i]>=5?'entre 5 et 9.':'entre 0 et 4.'),test:c=>(Number(c[i])>=5)===(a[i]>=5)});pool.push({id:'digit'+i,text:'Le '+label+' chiffre est '+a[i]+'.',direct:true,test:c=>c[i]===secret[i]});}
    for(let d=0;d<10;d++){const n=a.filter(v=>v===d).length;pool.push({id:'count'+d,text:n?'Le chiffre '+d+' apparaît '+n+' fois.':'Le code ne contient pas de '+d+'.',test:c=>[...c].filter(v=>Number(v)===d).length===n});}
    for(let i=0;i<3;i++)pool.push({id:'pair'+i,text:'Les chiffres '+(i+1)+' et '+(i+2)+' ont une somme de '+(a[i]+a[i+1])+'.',test:c=>Number(c[i])+Number(c[i+1])===a[i]+a[i+1]});
    return pool;
  }
  function addHint(s){const options=hintPool(s.secret).filter(h=>!s.usedHints.includes(h.id)).map(h=>({...h,remaining:s.possible.filter(h.test)})).filter(h=>h.remaining.length<s.possible.length);let choice;
    if(options.length){const indirect=options.filter(h=>!h.direct),pool=indirect.length?indirect:options;const target=s.possible.length*(s.round===1?.35:.4);pool.sort((a,b)=>Math.abs(a.remaining.length-target)-Math.abs(b.remaining.length-target));const shortlist=pool.slice(0,Math.min(3,pool.length));choice=shortlist[Math.floor(s.rng()*shortlist.length)];s.possible=choice.remaining;s.usedHints.push(choice.id);s.hints.push({text:choice.text,round:s.round});remember(s);return s.hints.at(-1);}
    return null;
  }
  function round(s){if(s.phase==='finished')return null;if(s.round)s.order.push(s.order.shift());s.round++;s.turn=0;s.phase='between';return addHint(s);}
  function startTurn(s){if(s.phase==='finished')return false;s.phase='answer';s.remaining=20;return true;}
  function current(s){return s.order[s.turn];}
  function rank(s,winner){s.winner=winner;s.ranking=[winner,...s.initialOrder.filter(id=>id!==winner).sort((a,b)=>s.scores[b]-s.scores[a]||s.best[b]-s.best[a]||s.tries[a]-s.tries[b]||s.initialOrder.indexOf(a)-s.initialOrder.indexOf(b))];s.phase='finished';}
  function submit(s,text){if(s.phase!=='answer')return{error:'inactive'};const guess=String(text).trim();if(!/^[1-9]\d{3}$/.test(guess))return{error:'Saisis quatre chiffres, sans zéro au début.'};if(s.used.has(guess))return{error:'Ce code a déjà été essayé.'};
    const id=current(s),f=feedback(s.secret,guess),counts=digits(guess),actual=digits(s.secret),goodCounts=Array(10).fill(0);let points=0,places=0,numbers=0;
    for(let i=0;i<4;i++)if(guess[i]===s.secret[i]){goodCounts[Number(guess[i])]++;if(!s.foundPlaces[i]){points+=3;places++;s.foundPlaces[i]=true;}}
    for(let d=0;d<10;d++){const found=Math.min(counts[d],actual[d]),novel=Math.max(0,found-Math.max(s.foundDigits[d],goodCounts[d]));numbers+=novel;points+=novel;s.foundDigits[d]=Math.max(s.foundDigits[d],found);}
    s.scores[id]+=points;s.best[id]=Math.max(s.best[id],f.good*3+f.near);s.tries[id]++;s.used.add(guess);
    const result={id,guess,...f,points,places,numbers,round:s.round};s.attempts.push(result);s.possible=s.possible.filter(c=>{const r=feedback(c,guess);return r.good===f.good&&r.near===f.near;});remember(s);
    if(f.good===4)rank(s,id);else s.phase='result';return result;
  }
  function timeout(s){if(s.phase!=='answer')return null;const result={id:current(s),guess:null,points:0,round:s.round,timeout:true};s.tries[result.id]++;s.attempts.push(result);s.phase='result';s.remaining=0;return result;}
  function advance(s){if(s.phase!=='result')return false;s.turn++;s.phase='between';return s.turn>=s.order.length;}
  function tick(s,dt){if(s.phase!=='answer')return null;s.remaining=Math.max(0,s.remaining-Math.max(0,dt));return s.remaining===0?timeout(s):null;}
  // Only deductions from public clues and aggregate feedback may colour a draft.
  function colors(s,guess){const remaining=[...s.known.present],out=Array(4).fill('');for(let i=0;i<4;i++)if(guess[i]&&s.known.fixed[i]===guess[i]){out[i]='good';remaining[Number(guess[i])]--;}
    for(let i=0;i<4;i++){const d=Number(guess[i]);if(guess[i]&&!out[i]&&remaining[d]>0&&s.possible.every(c=>c[i]!==guess[i])){out[i]='near';remaining[d]--;}}return out;
  }
  return{create,feedback,knowledge,round,startTurn,current,submit,timeout,advance,tick,colors};
});
