(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AboubapianoEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const NOTES=[{name:'Do',white:0},{name:'Do♯',alias:'Ré♭',black:1},{name:'Ré',white:1},{name:'Ré♯',alias:'Mi♭',black:2},{name:'Mi',white:2},{name:'Fa',white:3},{name:'Fa♯',alias:'Sol♭',black:4},{name:'Sol',white:4},{name:'Sol♯',alias:'La♭',black:5},{name:'La',white:5},{name:'La♯',alias:'Si♭',black:6},{name:'Si',white:6}];
  const POINTS=[10,7,5,3,2,1];
  function distance(answer,target){return Number.isInteger(answer)&&answer>=0&&answer<12?Math.abs(answer-target):Infinity;}
  function points(answer,target){return POINTS[distance(answer,target)]||0;}
  function create(count,rng=Math.random){const order=Array.from({length:count},(_,i)=>i);for(let i=count-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}return {count,rng,order,round:0,tie:0,target:null,used:[],scores:Array(count).fill(0),groups:null,participants:[],answers:new Map(),turn:0,resolved:true,ranking:null};}
  function begin(s){if(!s.resolved||s.ranking)return false;s.answers.clear();s.turn=0;s.resolved=false;
    if(s.round<3){s.round++;s.participants=[...s.order];}else{s.tie++;const tied=new Set(s.groups.filter(g=>g.length>1).flat());s.participants=s.order.filter(id=>tied.has(id));}
    const available=NOTES.map((_,i)=>i).filter(i=>s.tie?i!==s.target:!s.used.includes(i));s.target=available[Math.floor(s.rng()*available.length)];if(!s.tie)s.used.push(s.target);return true;
  }
  function submit(s,id,note){if(s.resolved||s.participants[s.turn]!==id||s.answers.has(id)||note!==null&&(!Number.isInteger(note)||note<0||note>11))return false;s.answers.set(id,note);s.turn++;return true;}
  function partition(ids,key){const sorted=[...ids].sort((a,b)=>key(a)-key(b)),groups=[];for(const id of sorted){const last=groups.at(-1);if(last&&key(last[0])===key(id))last.push(id);else groups.push([id]);}return groups;}
  function resolve(s){if(s.resolved||s.turn!==s.participants.length)return null;s.resolved=true;const rows=s.participants.map(id=>({id,answer:s.answers.get(id),distance:distance(s.answers.get(id),s.target),gain:s.tie?0:points(s.answers.get(id),s.target)}));
    if(!s.tie){for(const r of rows)s.scores[r.id]+=r.gain;if(s.round===3)s.groups=partition(s.order,id=>-s.scores[id]);}
    else s.groups=s.groups.flatMap(g=>g.length<2?[g]:partition(g,id=>distance(s.answers.get(id),s.target)));
    if(s.groups?.every(g=>g.length===1))s.ranking=s.groups.flat();return rows;
  }
  return {NOTES,POINTS,distance,points,create,begin,submit,resolve};
});
