(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AboubamemoireEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ITEMS=[['costume','Aboubakar'],['star','Étoile'],['boo-bell','Cloche Boo'],['gelano','Gelano'],['item-bag','Sac d’objets'],['pipe','Tuyau'],['whistle','Sifflet Chomp'],['duel','Main duel'],['shop-pipe','Boîte shop'],['coin','Pièce'],['double-dice','Double dés'],['inflation','Inflation']].map(([id,name])=>({id,name,image:'../../assets/items/'+id+'.png'}));
 const COLORS=[{name:'Rouge',hex:'#ee7386'},{name:'Bleu',hex:'#719eff'},{name:'Vert',hex:'#74d39b'},{name:'Jaune',hex:'#edce65'}];
 const MOVES=['Immobile','De gauche à droite','De haut en bas','En diagonale'],SPINS=['Ne tournait pas','Tournait vers la droite','Tournait vers la gauche','Oscillait'];
 function shuffle(list,rng){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function create(count,rng=Math.random){return{count,rng,order:shuffle(Array.from({length:count},(_,i)=>i),rng),alive:Array.from({length:count},(_,i)=>i),round:0,scene:[],questions:[],answers:new Map(),turn:0,participants:[],resolved:true,groups:[],scores:Array(count).fill(0),ranking:null};}
 function begin(s){if(!s.resolved||s.ranking)return false;s.round++;s.resolved=false;s.turn=0;s.answers.clear();s.participants=s.order.filter(id=>s.alive.includes(id));
  const types=['presence','color',...(s.round>=3?['count','motion']:[]),...(s.round>=4?['rotation']:[])],type=types[(s.round-1)%types.length];
  const selected=[ITEMS[0],...shuffle(ITEMS.slice(1),s.rng).slice(0,Math.min(6,3+s.round)-1)],properties=new Map(selected.map((item,i)=>[item.id,{item,color:Math.floor(s.rng()*4),move:s.round>=2&&i<Math.min(6,s.round-1)?1+Math.floor(s.rng()*(s.round>=5?3:2)):0,spin:s.round>=3&&i<Math.min(6,s.round-2)?1+Math.floor(s.rng()*3):0}]));
  const objects=selected.map(item=>({...properties.get(item.id)}));if(s.round>=3)for(let i=0;i<Math.min(6,s.round-2);i++)objects.push({...properties.get(selected[Math.floor(s.rng()*selected.length)].id)});
  s.scene=shuffle(objects,s.rng).map((o,index)=>({...o,index,phase:s.rng()*Math.PI*2}));s.type=type;
  const subjects=shuffle(selected.slice(1),s.rng);subjects.unshift(ITEMS[0]);
  s.questions=s.participants.map((id,i)=>{const item=subjects[i%subjects.length],prop=properties.get(item.id),questionType=i<subjects.length?type:type==='presence'?'absence':'presence';let prompt,choices,correct;
   if(questionType==='presence'){prompt='Quel objet était présent dans la scène ?';correct=item.id;choices=[item,...shuffle(ITEMS.filter(a=>!selected.some(b=>a.id===b.id)),s.rng).slice(0,3)].map(a=>({value:a.id,label:a.name,image:a.image}));}
   if(questionType==='absence'){prompt='Quel objet était absent de la scène ?';const absent=ITEMS.filter(a=>!selected.some(b=>a.id===b.id))[i-subjects.length];correct=absent.id;choices=[absent,...shuffle(selected,s.rng).slice(0,3)].map(a=>({value:a.id,label:a.name,image:a.image}));}
   if(questionType==='color'){prompt='Quelle couleur entourait « '+item.name+' » ?';correct=prop.color;choices=COLORS.map((c,i)=>({value:i,label:c.name,color:c.hex}));}
   if(questionType==='count'){prompt='Combien de fois apparaissait '+item.name+' ?';correct=s.scene.filter(o=>o.item.id===item.id).length;const values=new Set([correct]);for(const v of shuffle([0,1,2,3,4,5,6,7],s.rng)){values.add(v);if(values.size===4)break;}choices=[...values].map(v=>({value:v,label:String(v)}));}
   if(questionType==='motion'){prompt='Comment se déplaçait '+item.name+' ?';correct=prop.move;choices=MOVES.map((label,value)=>({label,value}));}
   if(questionType==='rotation'){prompt='Comment tournait '+item.name+' ?';correct=prop.spin;choices=SPINS.map((label,value)=>({label,value}));}
   choices=shuffle(choices,s.rng);return{id,subject:item,prompt,choices,correct:choices.findIndex(c=>c.value===correct)};
  });return true;
 }
 function submit(s,id,index,elapsed){if(s.resolved||s.participants[s.turn]!==id||s.answers.has(id)||index!==null&&(!Number.isInteger(index)||index<0||index>3))return false;s.answers.set(id,{index,elapsed:index===null?10000:Math.max(0,Math.min(10000,elapsed))});s.turn++;return true;}
 function resolve(s){if(s.resolved||s.turn!==s.participants.length)return null;s.resolved=true;const rows=s.questions.map(q=>({id:q.id,question:q,answer:s.answers.get(q.id),correct:s.answers.get(q.id).index===q.correct}));const good=rows.filter(r=>r.correct),bad=rows.filter(r=>!r.correct);for(const r of good)s.scores[r.id]++;
  if(good.length){s.alive=good.map(r=>r.id);if(bad.length)s.groups.unshift(bad.sort((a,b)=>s.scores[b.id]-s.scores[a.id]||a.answer.elapsed-b.answer.elapsed||s.order.indexOf(a.id)-s.order.indexOf(b.id)).map(r=>r.id));if(s.alive.length===1)s.ranking=[...s.alive,...s.groups.flat()];}
  return{rows,replay:good.length===0,eliminated:good.length?bad.map(r=>r.id):[],finished:!!s.ranking};
 }
 return{ITEMS,COLORS,MOVES,SPINS,create,begin,submit,resolve};
});
