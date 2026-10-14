(() => {
  // Keep the current cadence when Space starts braking; never restart at full speed.
  function brake(i,total,count,delay,minSteps=0){let distance=((total-i)%count+count)%count;if(minSteps>0){while(distance<minSteps)distance+=count;return {start:i,stop:i+distance,delay};}return {start:i,stop:Math.min(total,i+distance+(distance<4?count:0)),delay};}
  function delay(plan,i){const t=Math.max(0,Math.min(1,(i-plan.start)/Math.max(1,plan.stop-plan.start)));return plan.delay+(Math.max(280,plan.delay)-plan.delay)*t*t;}
  function confirm(row){row?.animate?.([{filter:'brightness(1)',opacity:1},{filter:'brightness(1.65)',opacity:.75,offset:.18},{filter:'brightness(1)',opacity:1,offset:.38},{filter:'brightness(1.4)',opacity:.85,offset:.6},{filter:'brightness(1)',opacity:1}],{duration:580,easing:'ease-in-out'});}
  window.PourtySelectionMotion={brake,delay,confirm};
})();
