(() => {
  'use strict';
  const shuffle=(items,rng=Math.random)=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  function caption(value){if(!value||typeof value.top!=='string'||typeof value.bottom!=='string')return null;const top=value.top.trim(),bottom=value.bottom.trim();return top.length<=80&&bottom.length<=80&&(top||bottom)?{top,bottom}:null;}
  function ranking(players,scores){return players.map(p=>({...p,points:scores[p.key]||0})).sort((a,b)=>b.points-a.points||a.index-b.index).map((p,i,all)=>({...p,rank:1+all.filter(q=>q.points>p.points).length}));}
  function score(entries,votes,scores){const result={...scores};if(entries.length<2)return result;for(const [voter,id]of Object.entries(votes)){const entry=entries.find(e=>e.id===id);if(entry&&entry.owner!==voter)result[entry.owner]=(result[entry.owner]||0)+1;}return result;}
  function publicEntry(e){return {id:e.id,label:e.label||'',url:e.url,top:e.top||'',bottom:e.bottom||''};}
  const images=new Map();
  function load(url){if(!images.has(url)){const promise=new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>{images.delete(url);reject(Error('Photo indisponible'));};img.src=url;});images.set(url,promise);}return images.get(url);}
  function lines(ctx,text,width){const result=[];let line='';for(const word of text.toUpperCase().split(/\s+/)){if(ctx.measureText(word).width>width){if(line){result.push(line);line='';}for(const char of Array.from(word)){if(ctx.measureText(line+char).width>width){result.push(line);line=char;}else line+=char;}}else if(line&&ctx.measureText(line+' '+word).width>width){result.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)result.push(line);return result;}
  async function draw(canvas,entry){
    const token={};canvas.memeDraw=token;const img=await load(entry.url);if(canvas.memeDraw!==token)return;
    const ratio=Math.min(1000/img.naturalWidth,1200/img.naturalHeight);canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);ctx.textBaseline='top';ctx.lineJoin='round';
    const margin=canvas.width*.035;
    // Draw letters separately so spacing is consistent on Safari and desktop.
    for(const [text,bottom]of [[entry.top,false],[entry.bottom,true]]){
      if(!text)continue;let size=Math.min(canvas.width*.18,canvas.height*.16),wrapped;
      const measure=t=>ctx.measureText(t).width+Math.max(0,Array.from(t).length-1)*size*.045;
      const wrap=()=>{const out=[];let line='';for(const word of text.toUpperCase().split(/\s+/)){if(measure(word)>canvas.width-margin*2){if(line){out.push(line);line='';}for(const ch of Array.from(word)){if(line&&measure(line+ch)>canvas.width-margin*2){out.push(line);line=ch;}else line+=ch;}}else if(line&&measure(line+' '+word)>canvas.width-margin*2){out.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)out.push(line);return out;};
      do{ctx.font='900 '+size+'px Impact, "Arial Black", sans-serif';wrapped=wrap();if(wrapped.length*size*1.14<=canvas.height*.27||size<=12)break;size-=1;}while(size>0);
      ctx.lineWidth=Math.max(1.5,size*.055);ctx.strokeStyle='#080808';ctx.fillStyle='#fff';ctx.textAlign='left';const start=bottom?canvas.height-margin-wrapped.length*size*1.14:margin;
      for(let i=0;i<wrapped.length;i++){let x=(canvas.width-measure(wrapped[i]))/2;const y=start+i*size*1.14;for(const ch of Array.from(wrapped[i])){ctx.strokeText(ch,x,y);ctx.fillText(ch,x,y);x+=ctx.measureText(ch).width+size*.045;}}
    }
  }
  function artwork(entry,cls=''){const wrapper=document.createElement('div');wrapper.className='meme-art '+cls;const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',[entry.top,entry.bottom].filter(Boolean).join(' / ')||'Photo du meme');wrapper.append(canvas);draw(canvas,entry).catch(()=>{if(canvas.isConnected)wrapper.textContent='Photo indisponible';});return wrapper;}
  window.AboubaMeme={shuffle,caption,ranking,score,publicEntry,draw,artwork,clearImages:()=>images.clear()};
})();
