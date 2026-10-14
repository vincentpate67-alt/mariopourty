(() => {
  'use strict';
  // A short-lived deletion capability, never a Cloudinary API secret.
  // Older assets and interrupted sessions are handled by the private cleanup job.
  const requests=new Map();
  function remove(token){
    if(!token)return Promise.resolve(false);
    if(requests.has(token))return requests.get(token);
    const pending=(async()=>{
      const cloud=window.AboubaPhotoConfig.cloudinary.cloudName;
      const response=await fetch('https://api.cloudinary.com/v1_1/'+encodeURIComponent(cloud)+'/delete_by_token',{
        method:'POST',body:new URLSearchParams({token}),keepalive:true
      });
      return response.ok;
    })().finally(()=>requests.delete(token));
    requests.set(token,pending);return pending;
  }
  window.AboubaPhotoCleanup={remove};
})();
