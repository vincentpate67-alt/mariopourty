(() => {
  const button=document.getElementById('connect-phones');
  const session=window.parent!==window && window.parent.PourtySession;
  button.addEventListener('click',()=>{
    if(session){session.showConnection();return;}
    location.href='session.html';
  });
  window.addEventListener('pourty-roster-changed',()=>session?.rosterChanged());
})();
