(() => {
  'use strict';
  const icons={
    grapple:[['M-21 16-9 4M-15 20-5 10','none','#b39b7b'],['M-9 4 9-14M-4-18Q15-24 20-6L12-10 9-14 5-7-4-18Z','#8ea9bc'],['M9-14 18-20','none']],
    electric:[['M3-25-17 3H-2L-7 25 20-7H5L12-25Z','#e3c768'],['M3-17-9 0H6L-1 14','none','#fff0b3']],
    bowling:[['M-23 0A23 23 0 1 0 23 0A23 23 0 1 0-23 0','#7772bb'],['M-6-11A3 3 0 1 0 0-11A3 3 0 1 0-6-11M3-7A3 3 0 1 0 9-7A3 3 0 1 0 3-7M-5 0A3 3 0 1 0 1 0A3 3 0 1 0-5 0','#24213c'],['M-17 2Q-16 13-7 17','none','#b5b2ef']],
    knife:[['M-15 4 1-3 18-4 10 7-1 9Z','#bacbdf'],['M-18 5-5 1-2 9-15 13Z','#8c7464'],['M-4-2 0 12','none']],
    gun:[['M-17-8H17V1H-1L-4 14H-13L-11 0H-17Z','#71869d'],['M-2 2V8H4V1','none'],['M15-5H22V-1H15Z','#c2d2e5']],
    laser:[['M-16-7H8L14 0 8 7H-16Z','#967084'],['M-7-7V7M2-7V7','none'],['M16 0H24M21-6 25-6M21 6H25','none','#f0a1b3']],
    cactus:[['M-5 17V-1H-12Q-18-1-18-7V-12Q-18-17-13-17Q-8-17-8-12V-7H-5V-17Q-5-23 1-23Q7-23 7-17V2H11V-7Q11-12 16-12Q21-12 21-7V3Q21 10 14 10H7V17Z','#73aa87'],['M-2-14V12M-13-10V-5M16-4V3','none','#c4dfbd']],
    bomb:[['M-16 4A16 16 0 1 0 16 4A16 16 0 1 0-16 4','#344458'],['M-5-13V-19H5V-13Z','#b2a084'],['M3-19Q6-29 14-21M15-24 19-28M17-19H22','none','#f3cf89']],
    trap:[['M-20 12-16-8-9-2-5-14 0-6 5-14 10-2 16-8 20 12Z','#65788e'],['M-16 12 0 17 16 12M-13 5 13 5','none'],['M-5 2H5V10H-5Z','#c6a080']],
    hammer:[['M-19 13 10-16 16-10-13 19Z','#a28a69'],['M-1-18 6-25 24-7 17 0Z','#a1b3c7'],['M5-18 17-6','none','#e4edf5']],
    boomerang:[['M-21 16-6-18Q-4-23 1-19L22 7 16 14-2-4-13 20Z','#bd955f'],['M-14 10-5-8M6-2 14 7','none','#ecd3a1']],
    poison:[['M-7-21H7V-16H4V-9L15 9Q19 18 8 20H-8Q-19 18-15 9L-4-9V-16H-7Z','#8968a5'],['M-12 5Q0 0 12 5M-3-15H3','none','#d2b5ef'],['M-3 7H3V12H-3Z','#e0c9f5']],
    shield:[['M-18-15 0-23 18-15V-1Q18 13 0 23Q-18 13-18-1Z','#597d9d'],['M-11-10 0-15 11-10V0Q11 9 0 15Q-11 9-11 0Z','#92bad8'],['M0-10V11M-7 0H7','none','#ecf5ff']],
    vampire:[['M-21-7Q-10-18 0-10Q10-18 21-7L13 10 5 4 0 10-5 4-13 10Z','#ae697e'],['M-13-4-9 11-4-4M4-4 9 11 13-4','#f3e7e5'],['M-20-7Q0 0 20-7','none','#e4a2b4']]
  };
  const cache=new Map();
  function svg(id){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -32 60 64" aria-hidden="true">'+(icons[id]||icons.knife).map(([d,fill,stroke])=>'<path d="'+d+'" fill="'+fill+'" stroke="'+(stroke||'#d9e5f4')+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>').join('')+'</svg>';}
  function draw(g,id,x,y,size=32,rotation=0,tint=null){g.save();g.translate(x,y);g.rotate(rotation);g.scale(size/60,size/60);g.lineWidth=2;g.lineCap='round';g.lineJoin='round';const list=icons[id]||icons.knife;if(!cache.has(id))cache.set(id,list.map(([d])=>new Path2D(d)));list.forEach(([,fill,stroke],i)=>{if(fill!=='none'){g.fillStyle=id==='bowling'&&i===0&&tint?tint:fill;g.fill(cache.get(id)[i]);}g.strokeStyle=stroke||'#d9e5f4';g.stroke(cache.get(id)[i]);});g.restore();}
  window.AboubattleArt={svg,draw};
})();
