/* Rules are resolved by the host. Phones receive only their own private view. */
(function(root){
'use strict';
const roles={
 switcher:['Switcheur','Chaque nuit, tentez d’échanger votre carte avec un autre joueur : une chance sur deux. Le nouveau Switcheur rejoint toujours le village et peut réessayer la nuit suivante.','switch'],
 mute:['Aboubakar muet','Survivez à votre première attaque des loups, puis communiquez uniquement par signes. Les autres causes de mort restent mortelles.','silence'],
 dictator:['Aboubakar dictateur','Une fois par partie, interrompez le vote pour accuser un joueur. Un loup meurt ; face à un innocent, vous mourez à sa place.','crown'],
 mystery:['Aboubakar mystère','Une fois, la nuit, masquez votre carte ou celle d’un joueur : elle apparaît inconnue aux révélations et à la Voyante jusqu’à la fin.','mystery'],
 crow:['Aboubakar corbeau','Chaque nuit, désignez un autre joueur : il reçoit une voix supplémentaire contre lui au vote du jour suivant.','crow'],
 wild:['Abousauvage','La première nuit, choisissez votre modèle. Vous êtes du village tant qu’il vit ; à sa mort, vous rejoignez les loups.','wolf'],
 redhood:['Petit Chaperon rouge','Les loups ne peuvent pas vous tuer tant que le Chasseur est vivant. Le vote du village et la potion de mort restent dangereux.','heart'],
 guard:['Garde','Chaque nuit, protégez-vous ou protégez un joueur des loups. Vous ne pouvez pas protéger la même personne deux nuits de suite.','shield'],
 elder:['Aboubakar vieux','Survivez une fois au vote du village : votre carte est révélée, mais vous restez en vie.','elder'],
 villager:['Aboubakar','Vous appartenez au village, sans pouvoir spécial.','mask'],
 wolf:['Abougarou','Choisissez ensemble une victime chaque nuit.','wolf'],
 seer:['Voyante','Chaque nuit, découvrez la carte exacte d’un joueur.','eye'],
 witch:['Sorcière','Une potion de vie et une potion de mort, utilisables une fois chacune.','potion'],
 hunter:['Chasseur','À votre mort, vous pouvez emporter un joueur avec vous.','target'],
 cupid:['Cupidon','La première nuit, liez deux amoureux. Si l’un meurt, l’autre aussi.','heart'],
 silencer:['Roi du silence','Rendez un joueur muet pour la journée, jamais le même deux nuits de suite.','silence'],
 fool:['Farceur','Faites-vous éliminer au vote pour gagner seul immédiatement.','mask'],
 oracle:['Aboubakar prémonitoire','Prédisez la cible des loups. Deux réussites offrent un vote double utilisable une fois.','moon'],
 messenger:['Aboubakar messager','Envoyez un message anonyme à un autre joueur chaque nuit.','letter'],
 heir:['Aboubakar héritier','Une seule tentative : héritez du pouvoir de votre cible si elle meurt cette nuit et appartient au village.','key'],
 protector:['Aboubakar protecteur','Une fois par partie, protégez-vous ou protégez quelqu’un des loups pendant une nuit.','shield'],
 predictor:['Aboubakar pronostiqueur','Chaque nuit, prédisez qui sera éliminé au vote du jour suivant. Une réussite ajoute une voix à votre vote le jour d’après.','ballot'],
 informant:['Aboubakar informateur','Chaque nuit, recevez cinq informations : une vraie et quatre fausses.','scroll']
};
const base=['mute','dictator','mystery','crow','elder','villager','oracle','messenger','heir','protector','predictor','informant'];
const shuffle=(a,rng=Math.random)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function legacyDeck(n,wolves,selected,random=false,rng=Math.random){
 if(n<3||n>20||wolves<1||wolves>=n/2)throw Error('Choisis entre 1 et '+Math.floor((n-1)/2)+' loups.');
 let others=[];selected={...selected};if(selected.aboubakar){const count=selected.aboubakar;if(!Number.isInteger(count)||count<0||count>n)throw Error('Nombre d’Aboubakar invalide.');delete selected.aboubakar;if(random){for(const k of base)selected[k]=1;}else{let pool=[];for(let i=0;i<count;i++){if(!pool.length)pool=shuffle(base,rng);const k=pool.pop();selected[k]=(selected[k]||0)+1;}}}
 if(random){const allowed=Object.keys(roles).filter(k=>k!=='wolf'&&selected[k]);if(!allowed.length)throw Error('Autorise au moins une spécialité.');const unique=shuffle(allowed,rng);others=unique.slice(0,n-wolves);const fill=allowed.filter(k=>base.includes(k));while(others.length<n-wolves){if(!fill.length)throw Error('Autorise une spécialité d’Aboubakar pour compléter le paquet.');others.push(fill[Math.floor(rng()*fill.length)]);}}
 else {for(const [k,count]of Object.entries(selected)){if(k==='wolf'||!roles[k])continue;if(!Number.isInteger(count)||count<0||(!base.includes(k)&&count>1))throw Error('Composition invalide.');for(let i=0;i<count;i++)others.push(k);}if(others.length!==n-wolves)throw Error('Il faut exactement '+n+' cartes.');}
 return shuffle([...Array(wolves).fill('wolf'),...others],rng);
}
function configuredDeck(n,wolves,selected,random=false,rng=Math.random,settings=null){
 if(!settings)return legacyDeck(n,wolves,selected,random,rng);
 const group=selected.aboubakar||0,copy={...selected};delete copy.aboubakar;
 if(!group)return legacyDeck(n,wolves,copy,random,rng);
 const types=base.filter(k=>k!=='villager'),pool=types.filter(k=>settings.allowed?.[k]!==false);
 if(settings.enabled!==false&&settings.mode==='counts'){
  const counts=settings.counts||{},total=types.reduce((n,k)=>n+(counts[k]||0),0);
  if(!random&&total!==group)throw Error('Répartis exactement '+group+' Aboubakar entre leurs spécialités.');
  for(const k of types)if(!Number.isInteger(counts[k]||0)||(counts[k]||0)<0)throw Error('Quantité de spécialité invalide.');
  if(random){const others=shuffle(Object.keys(copy).filter(k=>copy[k]&&k!=='wolf'&&!base.includes(k)),rng);if(total>n-wolves||others.length<n-wolves-total)throw Error('Ajuste les quantités d’Aboubakar pour compléter les '+n+' cartes.');return legacyDeck(n,wolves,{...Object.fromEntries(others.slice(0,n-wolves-total).map(k=>[k,1])),...counts},false,rng);}
  return legacyDeck(n,wolves,{...copy,...counts},false,rng);
 }
 if(settings.enabled!==false&&!pool.length)throw Error('Autorise au moins une spécialité d’Aboubakar.');
 const cards=legacyDeck(n,wolves,selected,random,rng);let bag=[];return cards.map(k=>{if(!base.includes(k))return k;if(settings.enabled===false)return 'villager';if(!bag.length)bag=shuffle(pool,rng);return bag.pop();});
}
function deck(n,wolves,selected,random=false,rng=Math.random,settings=null){
 selected={...selected};if(selected.redhood&&!selected.hunter){if(!random)throw Error('Ajoute un Chasseur pour jouer avec le Petit Chaperon rouge.');delete selected.redhood;}
 const cards=configuredDeck(n,wolves,selected,random,rng,settings);
 if(cards.includes('redhood')&&!cards.includes('hunter')){const replacement=cards.findIndex(k=>k!=='wolf'&&k!=='redhood'&&!base.includes(k));if(replacement>=0)cards[replacement]='hunter';else cards[cards.indexOf('redhood')]='hunter';}
 return cards;
}
const isWolf=p=>p.role==='wolf'||p.role==='wild'&&!!p.turned;
const village=p=>!isWolf(p)&&p.role!=='fool';
class Game{
 constructor(players,cards,now=Date.now()){this.players=players.map((p,i)=>({...p,role:cards[i],alive:true,used:{},notes:[],hits:0,double:false,bonusDay:0,prediction:null,lastMute:null}));this.phase='roles';this.day=0;this.version=1;this.deadline=now+90000;this.duration=90000;this.choices={};this.lovers=[];this.muted=[];this.deaths=[];this.hunters=[];this.shot=[];this.winner=null;this.log=[];this.extensions=0;this.extended=[];this.signals={};this.preNightRoles={};}
 living(){return this.players.filter(p=>p.alive);}
 publicRole(p){return p.masked&&this.phase!=='final'?'unknown':p.role;}
 isMuted(key){return this.muted.includes(key)||!!this.p(key)?.permanentMute;}
 canDictate(p){return p.alive&&p.role==='dictator'&&!p.used.dictator&&['day','runoff'].includes(this.phase);}
 startDictator(key,now){const p=this.p(key);if(!p||!this.canDictate(p)||now>=this.deadline)return false;p.used.dictator=true;this.pausedVote={phase:this.phase,choices:this.choices,remaining:this.deadline-now,duration:this.duration};this.dictator=key;this.phaseTo('dictator',now,30000);return true;}
 resumeVote(now){const v=this.pausedVote;this.pausedVote=null;this.dictator=null;this.phaseTo(v.phase,now,v.remaining);this.duration=v.duration;this.choices=Object.fromEntries(Object.entries(v.choices).filter(([k,a])=>this.p(k)?.alive&&(!a.target||this.p(a.target)?.alive)));if(this.phase==='runoff')this.tied=this.tied.filter(k=>this.p(k)?.alive);}
 p(k){return this.players.find(p=>p.key===k);}
 phaseTo(phase,now,ms){this.phase=phase;this.version++;this.deadline=now+ms;this.duration=ms;this.choices={};}
 note(k,text){const p=this.p(k);if(p){p.notes.push(text);p.notes=p.notes.slice(-12);}}
 night(now){this.switchReadyAt=0;for(const p of this.players)p.switchRoll=null;this.survived=null;this.attackLocked=false;this.attack=null;this.day++;this.crowMarks=[];this.muted=[];this.deaths=[];this.shot=[];this.preNightRoles=Object.fromEntries(this.players.map(p=>[p.key,{role:p.role,used:{...p.used},hits:p.hits,double:p.double,lastGuard:p.lastGuard||null}]));for(const p of this.players)p.prediction=null;this.phaseTo('night',now,60000);for(const p of this.living())if(p.role==='informant')p.info=this.information();}
 information(){const facts=[];for(const p of this.living()){facts.push([p.name+' appartient au village.',village(p)]);for(const k of Object.keys(roles))facts.push([p.name+' est '+roles[k][0]+'.',p.role===k]);}facts.push(['Les deux amoureux appartiennent au même camp.',this.lovers.length===2&&village(this.p(this.lovers[0]))===village(this.p(this.lovers[1]))]);const yes=shuffle(facts.filter(f=>f[1])),no=shuffle(facts.filter(f=>!f[1]));return shuffle([yes[0],...no.slice(0,4)]).map(f=>f[0]);}
 task(p){
 const targets=this.living().map(q=>({key:q.key,name:q.name,color:q.color,index:q.index}));
 if(this.phase==='roles')return {kind:'ready',title:'Découvre ta carte'};
 if(this.phase==='hunter'&&this.hunters[0]===p.key)return {kind:'hunter',title:'Qui emportes-tu avec toi ?',targets:targets.filter(q=>q.key!==p.key)};
 if(!p.alive)return null;
 if(this.phase==='dictator'&&this.dictator===p.key)return {kind:'dictator',title:'Qui accuses-tu ?',targets:targets.filter(q=>q.key!==p.key)};
 if((this.phase==='witch'||this.phase==='night'&&this.attackLocked)&&p.role==='witch'&&(!p.used.save||!p.used.poison))return {kind:'witch',title:'Tes potions',victim:this.attack?this.p(this.attack).name:'Aucune victime',save:!!this.attack&&!p.used.save,poison:!p.used.poison,victimPlayer:this.attack?targets.find(q=>q.key===this.attack):null,targets:targets.filter(q=>q.key!==this.attack)};
 if(['day','runoff'].includes(this.phase)){const candidates=this.phase==='runoff'?targets.filter(q=>this.tied.includes(q.key)):targets;return {kind:'vote',title:this.phase==='runoff'?'Second vote':'Qui soupçonnes-tu ?',targets:candidates.filter(q=>q.key!==p.key),double:p.double,bonus:p.bonusDay===this.day};}
 if(this.phase!=='night')return null;
 const others=targets.filter(q=>q.key!==p.key);
 if(p.role==='mystery'&&!p.used.mystery)return {kind:'mystery',title:'Quelle carte veux-tu masquer ?',targets:targets.filter(q=>!this.p(q.key).masked)};
 if(p.role==='switcher')return {kind:'switcher',title:'Avec qui veux-tu échanger ta carte ?',targets:others};
 if(p.role==='wild'&&!p.model)return {kind:'model',title:'Qui sera ton modèle ?',targets:others};
 if(p.role==='crow')return {kind:'crow',title:'Qui recevra une voix contre lui ?',targets:others};
 if(p.role==='predictor')return {kind:'predict',title:'Qui sera éliminé au vote demain ?',targets};
 if(isWolf(p))return {kind:'wolf',title:'Choisissez votre victime',targets:targets.filter(q=>!isWolf(this.p(q.key))),wolves:this.living().filter(q=>isWolf(q)).map(q=>({name:q.name,target:this.choices[q.key]?.target?this.p(this.choices[q.key].target)?.name:''}))};
 if(p.role==='seer'){const unknown=others.filter(q=>!(p.known||[]).includes(q.key)&&!this.p(q.key).revealed);return unknown.length?{kind:'seer',title:'Quelle carte veux-tu découvrir ?',targets:unknown}:null;}
 if(p.role==='cupid'&&!p.used.cupid)return {kind:'cupid',title:'Lie deux amoureux',targets};
 if(p.role==='silencer')return {kind:'silencer',title:'Qui sera muet demain ?',targets:others.filter(q=>q.key!==p.lastMute)};
 if(p.role==='oracle')return {kind:'oracle',title:'Qui sera visé par les loups ?',targets};
 if(p.role==='messenger')return {kind:'messenger',title:'Un message anonyme',targets:others};
 if(p.role==='heir'&&!p.used.heir&&!p.heirSpent)return {kind:'heir',title:'Tenter un héritage cette nuit ?',targets:others};
 if(p.role==='guard')return {kind:'guard',title:'Qui protèges-tu cette nuit ?',targets:targets.filter(q=>q.key!==p.lastGuard)};
 if(p.role==='protector'&&!p.used.protector)return {kind:'protector',title:'Utiliser ta protection ?',targets};
 return p.role==='informant'?{kind:'sleep',title:'Une seule information est vraie'}:null;
 }
 act(key,a,now){
 const p=this.p(key),t=p&&this.task(p);if(!t||now>=this.deadline||this.choices[key])return false;
 if(a.pass){if(t.kind==='model')return false;if(t.kind==='predict')p.prediction='skip';this.choices[key]={pass:true};return true;}
 if(['ready','sleep'].includes(t.kind)){this.choices[key]={ready:true};return true;}
 if(t.kind==='cupid'){if(!Array.isArray(a.targets)||a.targets.length!==2||a.targets[0]===a.targets[1]||a.targets.some(k=>!t.targets.some(q=>q.key===k)))return false;this.choices[key]={targets:a.targets};return true;}
 if(t.kind==='witch'){if(a.save&&!t.save||a.target&&(!t.poison||!t.targets.some(q=>q.key===a.target)))return false;this.choices[key]={save:!!a.save,target:a.target||null};return true;}
 if(!t.targets?.some(q=>q.key===a.target))return false;
 if(t.kind==='switcher'){p.switchRoll={day:this.day,target:a.target,success:Math.random()<.5,at:now,until:now+4200};this.switchReadyAt=Math.max(this.switchReadyAt||0,now+4200);this.choices[key]={target:a.target};return true;}
 if(t.kind==='mystery'){p.used.mystery=true;this.p(a.target).masked=true;this.note(key,'La carte de '+this.p(a.target).name+' restera inconnue jusqu’à la fin.');this.choices[key]={target:a.target};return true;}
 if(t.kind==='model'){p.model=a.target;this.note(key,'Ton modèle est '+this.p(a.target).name+'.');this.choices[key]={target:a.target};return true;}
 if(t.kind==='predict'){p.prediction=a.target;this.choices[key]={target:a.target};return true;}
 if(t.kind==='messenger'&&(typeof a.text!=='string'||!a.text.trim()||a.text.length>180))return false;
 if(t.kind==='messenger')this.note(a.target,'Message anonyme : '+a.text.trim());
 if(t.kind==='seer'){p.known=[...(p.known||[]),a.target];this.note(key,this.p(a.target).name+' est '+(this.p(a.target).masked?'Inconnu':roles[this.p(a.target).role][0])+( !this.p(a.target).masked&&this.p(a.target).role==='wild'&&isWolf(this.p(a.target))?' (devenu Abougarou)':'')+'.');}
 this.choices[key]={target:a.target,...(t.kind==='messenger'?{text:a.text.trim()}:{}),...(t.kind==='vote'?{double:!!a.double&&p.double}:{})};return true;
 }
 extend(key,now){if(!['day','runoff'].includes(this.phase)||!this.p(key)?.alive||now>=this.deadline||this.extensions>=3||this.extended.includes(key))return false;this.extended.push(key);if(this.extended.length>this.living().length/2){this.extensions++;this.extended=[];this.deadline+=30000;this.duration+=30000;}return true;}
 allDone(){if(['roles','night'].includes(this.phase))return this.living().every(p=>!this.task(p)||this.choices[p.key]);if(this.phase==='witch')return this.living().filter(p=>p.role==='witch').every(p=>this.choices[p.key]);if(this.phase==='dictator')return !!this.choices[this.dictator];if(this.phase==='hunter')return !!this.choices[this.hunters[0]];if(['day','runoff'].includes(this.phase))return this.living().every(p=>this.choices[p.key]);return false;}
 lockAttack(now){if(this.attackLocked)return false;const wolves=this.living().filter(p=>isWolf(p));if(now<this.deadline&&!wolves.every(p=>this.choices[p.key]))return false;const votes={};for(const p of wolves){const k=this.choices[p.key]?.target;if(k)votes[k]=(votes[k]||0)+1;}const max=Math.max(0,...Object.values(votes));this.attack=shuffle(Object.keys(votes).filter(k=>votes[k]===max))[0]||null;this.attackLocked=true;if(this.living().some(p=>p.role==='witch'&&(!p.used.save||!p.used.poison))){const extra=Math.max(0,now+30000-this.deadline);this.deadline+=extra;this.duration+=extra;}return true;}
 resolveNight(now){
 for(const p of this.living().filter(p=>p.role==='wild'&&!p.model)){p.model=shuffle(this.living().filter(q=>q.key!==p.key))[0]?.key;if(p.model)this.note(p.key,'Ton modèle est '+this.p(p.model).name+'.');}
 this.nightChoices=this.choices;for(const p of this.living()){const a=this.choices[p.key];if(!a||a.pass)continue;
 if(p.role==='cupid'&&a.targets){this.lovers=a.targets;p.used.cupid=true;this.note(p.key,'Tu as uni '+this.p(a.targets[0]).name+' et '+this.p(a.targets[1]).name+'.');for(const k of this.lovers)this.note(k,'Ton amour est '+this.p(this.lovers.find(x=>x!==k)).name+'.');}

 if(p.role==='crow'&&a.target)(this.crowMarks||(this.crowMarks=[])).push(a.target);
 if(p.role==='silencer'&&a.target){this.muted.push(a.target);p.lastMute=a.target;}

 if(p.role==='heir'&&a.target){p.used.heir=true;p.heirSpent=true;}
 if(p.role==='protector'&&a.target)p.used.protector=true;
 }
 if(!this.attackLocked)this.lockAttack(this.deadline);
 for(const p of this.living().filter(p=>p.role==='oracle'))if(this.attack&&this.choices[p.key]?.target===this.attack){p.hits++;this.note(p.key,'Bonne prémonition ! ('+p.hits+'/2)');if(p.hits>=2&&!p.used.double){p.double=true;this.note(p.key,'Tu peux doubler un vote.');}}
 this.protected=this.living().some(p=>['protector','guard'].includes(p.role)&&!!this.attack&&this.choices[p.key]?.target===this.attack);
 for(const p of this.living().filter(p=>p.role==='guard'))p.lastGuard=this.choices[p.key]?.target||null;
 // All choices stay in the same night, including the witch's potions.
 }
 kill(keys){for(const key of keys){const p=this.p(key);if(!p?.alive)continue;p.alive=false;this.deaths.push(key);this.log.push({day:this.day,key,role:p.role});if(p.role==='hunter'&&!p.used.hunter&&!this.hunters.includes(key))this.hunters.push(key);if(this.lovers.includes(key))this.kill(this.lovers.filter(k=>k!==key));}}
 resolveWitch(now){const dead=[];let saved=false;for(const p of this.living().filter(p=>p.role==='witch')){const a=this.choices[p.key];if(a?.save&&!p.used.save){saved=true;p.used.save=true;}if(a?.target&&!p.used.poison){p.used.poison=true;dead.push(a.target);}}const protectedHood=this.p(this.attack)?.role==='redhood'&&this.living().some(p=>p.role==='hunter'&&!dead.includes(p.key));if(this.attack&&!this.protected&&!saved&&!protectedHood){const victim=this.p(this.attack);if(victim.role==='mute'&&!victim.used.mute&&!dead.includes(victim.key)){victim.used.mute=true;victim.permanentMute=true;this.note(victim.key,'Vous avez survécu aux loups. Désormais, communiquez uniquement par signes.');}else dead.push(this.attack);}this.resolveSwitches();this.kill(dead);this.afterDeaths(now,'night');}
 afterDeaths(now,origin,awake=false){this.transformWild();this.origin=origin;this.hunters=this.hunters.filter(k=>!this.p(k).used.hunter);
 if(origin==='night'&&!awake){for(const p of this.living()){const a=this.nightChoices?.[p.key];if(p.role==='heir'&&this.preNightRoles[p.key]?.role==='heir'&&a?.target&&this.deaths.includes(a.target)&&village(this.p(a.target))){const old=this.p(a.target);p.role=old.role;p.model=this.p(a.target).model||null;p.turned=!!this.p(a.target).turned;p.used={...this.p(a.target).used};if(p.role==='heir')p.used.heir=true;p.hits=old.hits;p.double=old.double;p.lastGuard=this.p(a.target).lastGuard||null;this.note(p.key,'Tu hérites de la carte '+roles[p.role][0]+'.');}}}
 this.transformWild();
 this.phaseTo(origin==='night'&&!awake?'wake':'reveal',now,origin==='night'&&!awake?4000:5000+this.deaths.length*1000);
 }
 resolveSwitches(){
 const attempts=this.players.filter(p=>p.switchRoll?.day===this.day&&!p.switchRoll.resolved);
 const fields=['role','used','hits','double','bonusDay','prediction','lastGuard','lastMute','model','turned','heirSpent'];
 for(const actor of attempts){const roll=actor.switchRoll;roll.resolved=true;if(!roll.success)continue;const target=this.p(roll.target);
  if(!actor.alive||!target?.alive||actor.role!=='switcher'){this.note(actor.key,'L’échange ne peut pas avoir lieu : un des joueurs n’est plus disponible.');continue;}
  const previousWolves=this.players.filter(isWolf).map(p=>p.key);
  for(const field of fields){const old=actor[field];actor[field]=target[field];target[field]=old;}
  target.turned=false;actor.revealed=false;target.revealed=false;
  for(const p of this.players)if(p.known)p.known=p.known.filter(k=>k!==actor.key&&k!==target.key);
  for(const p of [actor,target])this.note(p.key,'Échange de cartes : tu deviens '+roles[p.role][0]+'. Ton camp : '+(isWolf(p)?'loups':p.role==='fool'?'solitaire':'village')+'.');
  for(const wolf of this.living().filter(isWolf)){for(const key of previousWolves)if(!isWolf(this.p(key)))this.note(wolf.key,this.p(key).name+' ne fait plus partie des loups.');for(const newWolf of this.living().filter(p=>isWolf(p)&&!previousWolves.includes(p.key)))if(newWolf.key!==wolf.key)this.note(wolf.key,newWolf.name+' rejoint les Abougarous.');}
 }
 }
 transformWild(){for(const p of this.living().filter(p=>p.role==='wild'&&!p.turned&&p.model&&!this.p(p.model)?.alive)){p.turned=true;this.note(p.key,'Ton modèle est mort. Tu deviens Abougarou et rejoins les loups.');for(const wolf of this.living().filter(q=>isWolf(q)&&q.key!==p.key))this.note(wolf.key,p.name+' rejoint les Abougarous.');}}
 crowBonus(key){return (this.crowMarks||[]).filter(k=>k===key).length;}
 addCrowVotes(counts){for(const p of this.living())if(this.phase!=='runoff'||this.tied.includes(p.key)){const bonus=this.crowBonus(p.key);if(bonus)counts[p.key]=(counts[p.key]||0)+bonus;}}
 victory(){const alive=this.living(),wolves=alive.filter(p=>isWolf(p)),mixed=this.lovers.length===2&&this.lovers.filter(k=>isWolf(this.p(k))).length===1,eligible=p=>!mixed||!this.lovers.includes(p.key);if(alive.length===2&&this.lovers.length===2&&alive.every(p=>this.lovers.includes(p.key))&&wolves.length===1)return {title:'Les amoureux gagnent !',keys:this.lovers};if(!wolves.length)return {title:alive.length?'Le village gagne !':'Personne ne survit…',keys:alive.length?this.players.filter(p=>village(p)&&eligible(p)).map(p=>p.key):[]};if(wolves.length>=alive.length-wolves.length)return {title:'Les Abougarous gagnent !',keys:this.players.filter(p=>isWolf(p)&&eligible(p)).map(p=>p.key)};return null;}
 resolveVotes(now){this.ballots=this.living().filter(p=>this.choices[p.key]?.target).map(p=>({from:p.key,to:this.choices[p.key].target,weight:1+(p.bonusDay===this.day?1:0)+(this.choices[p.key].double?1:0)}));this.voteCounts={};for(const b of this.ballots)this.voteCounts[b.to]=(this.voteCounts[b.to]||0)+b.weight;this.addCrowVotes(this.voteCounts);this.pendingVote={phase:this.phase,choices:this.choices};this.phaseTo('voteResults',now,7000);}
 finishVotes(now){this.phase=this.pendingVote.phase;this.choices=this.pendingVote.choices;this.pendingVote=null;const counts={};for(const p of this.living()){const a=this.choices[p.key];if(!a?.target)continue;counts[a.target]=(counts[a.target]||0)+1+(p.bonusDay===this.day?1:0)+(a.double?1:0);if(a.double){p.double=false;p.used.double=true;}}
 this.addCrowVotes(counts);this.voteCounts=counts;const max=Math.max(0,...Object.values(counts)),top=Object.keys(counts).filter(k=>counts[k]===max);
 if(top.length>1&&this.phase==='day'){this.tied=top;this.phaseTo('runoff',now,60000);return;}
 this.deaths=[];this.survived=null;if(top.length===1){const k=top[0];for(const p of this.living())if(p.role==='predictor'&&p.prediction===k)p.bonusDay=this.day+1;
 if(this.p(k).role==='elder'&&!this.p(k).used.elder){this.p(k).used.elder=true;this.p(k).revealed=true;this.survived=k;this.note(k,'Ton pouvoir d’Aboubakar vieux te permet de survivre à ce vote.');this.afterDeaths(now,'day');return;}
 if(this.p(k).role==='fool'){this.kill([k]);this.winner={title:this.p(k).name+' gagne en Farceur !',keys:[k]};this.phaseTo('final',now,0);return;}this.kill([k]);}
 this.afterDeaths(now,'day');
 }
 advance(now){if(this.phase==='night'&&now<(this.switchReadyAt||0))return false;if(this.phase==='night'&&this.lockAttack(now))return true;if(this.phase==='setup'||this.phase==='final')return false;if(now<this.deadline&&!this.allDone())return false;
 if(this.phase==='dictator'){const a=this.choices[this.dictator];this.deaths=[];if(a?.target)this.kill([isWolf(this.p(a.target))?a.target:this.dictator]);this.afterDeaths(now,'dictator');}
 else if(this.phase==='roles')this.night(now);
 else if(this.phase==='night'){this.resolveNight(now);this.resolveWitch(now);}
 else if(this.phase==='witch')this.resolveWitch(now);
 else if(this.phase==='hunter'){const k=this.hunters.shift(),a=this.choices[k];this.p(k).used.hunter=true;this.deaths=[];if(a?.target)this.kill([a.target]);this.afterDeaths(now,this.origin,true);}
 else if(this.phase==='wake')this.phaseTo('reveal',now,5000+this.deaths.length*1000);
 else if(this.phase==='reveal'){if(this.hunters.length){this.phaseTo('hunter',now,30000);return true;}this.winner=this.victory();if(this.winner)this.phaseTo('final',now,0);else if(this.pausedVote){this.resumeVote(now);}else if(this.origin==='night'){this.extensions=0;this.extended=[];this.phaseTo('day',now,120000);}else this.night(now);}
 else if(this.phase==='voteResults')this.finishVotes(now);else if(['day','runoff'].includes(this.phase))this.resolveVotes(now);return true;
 }
 view(key){const p=this.p(key),task=this.task(p),done=!!this.choices[key],day=['day','runoff'].includes(this.phase);return {phase:this.phase,day:this.day,role:p.role,switchRoll:p.switchRoll||null,wolfCamp:isWolf(p),description:p.role==='wild'&&p.turned?'Votre modèle est mort. Choisissez désormais une victime avec les loups chaque nuit.':roles[p.role][1],alive:p.alive,muted:this.isMuted(key)&&day,canDictate:this.canDictate(p),lastProtection:p.role==='guard'?(p.lastGuard?this.p(p.lastGuard)?.name:'Personne'):null,waitingWolves:this.phase==='night'&&p.role==='witch'&&!this.attackLocked,task:done?null:task,done,notes:p.notes,info:p.role==='informant'?p.info||[]:[],lover:this.lovers.includes(key)?this.p(this.lovers.find(k=>k!==key)).name:null,extensions:this.extensions,extensionVotes:this.extended.length,extensionThreshold:Math.floor(this.living().length/2)+1,canExtend:day&&p.alive&&this.extensions<3&&!this.extended.includes(key),players:this.players.map(q=>({key:q.key,name:q.name,color:q.color,index:q.index,alive:q.alive,...(!q.alive||q.revealed||this.phase==='final'?{role:this.publicRole(q),wolfCamp:this.publicRole(q)==='unknown'?false:isWolf(q)}:{})})),deaths:this.phase==='reveal'?this.deaths:[],winner:this.phase==='final'?this.winner:null};}
}
Object.defineProperty(roles,'unknown',{value:['Inconnu','Cette carte sera révélée à la fin de la partie.','mystery'],enumerable:false});
const api={roles,base,deck,shuffle,Game,isWolf};root.Abougarou=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
