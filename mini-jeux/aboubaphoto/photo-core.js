(() => {
  'use strict';
  const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(18)),v=>v.toString(16).padStart(2,'0')).join('');
  const roster=raw=>Array.isArray(raw)?raw.filter(p=>p&&typeof p.name==='string'&&p.name.trim()&&/^#[0-9a-f]{6}$/i.test(p.color)).slice(0,6).map(p=>({name:p.name.trim().slice(0,40),color:p.color})):[];
  const validToken=value=>/^[a-f0-9]{36}$/.test(value||'');
  function link(base,room,player){const url=new URL(base);url.search='';url.hash=new URLSearchParams({room,player}).toString();return url.href;}
  function imageURL(value,cloud){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='res.cloudinary.com'&&url.pathname.startsWith('/'+cloud+'/image/upload/')&&!url.username&&!url.password?url.href:null;}catch{return null;}}
  function room(players,uid,now=Date.now()){return {host:uid,createdAt:now,expiresAt:now+86400000,players:Object.fromEntries(players.map((p,index)=>[token(),{...p,index,online:false}]))};}
  window.AboubaPhotoCore={token,roster,validToken,link,imageURL,room};
})();
