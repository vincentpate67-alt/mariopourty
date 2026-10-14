(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AboubapixelEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim().replace(/^(?:c est )?(?:(?:un|une|le|la|les|des|l) )?/,'');}
 function shuffle(a,rng){const list=[...a];for(let i=list.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
 function create(count,bank,rng=Math.random){if(!bank.length)throw Error('Banque vide');return{count,bank,rng,active:Array.from({length:count},(_,i)=>i),qualified:[],out:[],queue:[],image:null,previous:null,elapsed:0,answerElapsed:0,buzzer:null,phase:'ready',ranking:null};}
 function finish(s){if(s.active.length>1)return false;s.ranking=[...s.qualified,...s.active,...s.out.slice().reverse()];s.phase='finished';return true;}
 function next(s){if(finish(s))return false;if(!s.queue.length){s.queue=shuffle(s.bank,s.rng);if(s.queue.length>1&&s.queue[0].id===s.previous)[s.queue[0],s.queue[1]]=[s.queue[1],s.queue[0]];}s.image=s.queue.shift();s.previous=s.image.id;s.elapsed=0;s.answerElapsed=0;s.buzzer=null;s.phase='view';return true;}
 function buzz(s){if(s.phase!=='view')return false;s.phase='select';s.buzzer=null;return true;}
 function select(s,id){if(s.phase!=='select'||!s.active.includes(id))return false;s.buzzer=id;s.answerElapsed=0;s.phase='answer';return true;}
 function answer(s,text){if(s.phase!=='answer')return null;const id=s.buzzer,correct=!!normalize(text)&&[s.image.word,...(s.image.aliases||[])].some(a=>normalize(a)===normalize(text));s.active=s.active.filter(v=>v!==id);if(correct)s.qualified.push(id);else s.out.push(id);s.phase=correct?'reveal':'wrong';return{id,correct,rank:correct?s.qualified.length:null,finished:s.active.length<=1};}
 function resume(s){if(s.phase!=='wrong')return false;if(finish(s))return false;s.buzzer=null;s.phase='view';return true;}
 function tick(s,dt){if(s.phase==='view'){s.elapsed=Math.min(15,s.elapsed+dt);if(s.elapsed>=15){s.phase='reveal';return{kind:'reveal'};}}else if(s.phase==='answer'){s.answerElapsed+=dt;if(s.answerElapsed>=15)return{kind:'answer',result:answer(s,'')};}return null;}
 return{normalize,create,next,buzz,select,answer,resume,finish,tick};
});
