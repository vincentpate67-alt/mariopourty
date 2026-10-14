(() => {
'use strict';
  function distributePot(total,results,count){
    if(!Number.isSafeInteger(total)||total<0||!Array.isArray(results)||results.length!==count||new Set(results.map(r=>r.playerIndex)).size!==count||results.some(r=>!Number.isInteger(r.playerIndex)||r.playerIndex<0||r.playerIndex>=count||!Number.isInteger(r.rank)||r.rank<1||r.rank>count))throw Error('Classement incomplet pour partager le pot.');
    const tables={1:[100],2:[70,30],3:[60,30,10],4:[55,28,14,3],5:[50,27,15,6,2],6:[48,26,14,7,4,1]},weights=tables[count],sorted=[...results].sort((a,b)=>a.rank-b.rank||a.playerIndex-b.playerIndex),exact=Array(count).fill(0);
    for(let i=0;i<count;){let end=i+1;while(end<count&&sorted[end].rank===sorted[i].rank)end++;const share=weights.slice(i,end).reduce((a,b)=>a+b,0)/(end-i);for(let j=i;j<end;j++)exact[sorted[j].playerIndex]=total*share/100;i=end;}
    const amounts=exact.map(Math.floor);let rest=total-amounts.reduce((a,b)=>a+b,0);const fractions=exact.map((v,id)=>({id,fraction:v-amounts[id]})).sort((a,b)=>b.fraction-a.fraction||a.id-b.id);for(let i=0;i<rest;i++)amounts[fractions[i%count].id]++;return amounts;
  }
window.PourtyPot=Object.freeze({distribute:distributePot});
})();
