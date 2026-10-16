(() => {
  const allowed=new Set(['guez','noob','ff','chad','goat','porto','aboubakar','skibidi','zzz','pog','plait-il','yuki','zebi','mashallah','mog','67','tigre']);
  window.createPourtyHUDReactions=()=>{
    const seen=new Map(),visible=new Map();
    return (key,reaction,card,now=Date.now())=>{
      if(!reaction||seen.get(key)===reaction.nonce)return;
      seen.set(key,reaction.nonce);
      if(!card||!allowed.has(reaction.id)||typeof reaction.sentAt!=='number'||now-reaction.sentAt>5000||reaction.sentAt>now+1000)return;
      visible.get(key)?.remove();const box=card.getBoundingClientRect(),img=document.createElement('img');
      img.src='../../assets/reactions/'+reaction.id+'.svg';img.alt='';
      Object.assign(img.style,{position:'fixed',left:(box.left+box.width/2)+'px',top:(box.top-90)+'px',width:'145px',height:'100px',objectFit:'contain',zIndex:'50',pointerEvents:'none'});
      document.body.append(img);visible.set(key,img);
      const animation=img.animate([{opacity:0,transform:'translateX(-50%) translateY(12px) scale(.4)'},{opacity:1,transform:'translateX(-50%) scale(1.06)',offset:.16},{opacity:1,transform:'translateX(-50%) scale(1)',offset:.7},{opacity:0,transform:'translateX(-50%) translateY(-16px) scale(.6)'}],{duration:2300,easing:'ease-out',fill:'both'});
      animation.finished.finally(()=>{img.remove();if(visible.get(key)===img)visible.delete(key);});
    };
  };
})();
