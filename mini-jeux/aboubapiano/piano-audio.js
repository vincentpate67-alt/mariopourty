(() => {
  'use strict';
  let context=null,voice=null;
  async function unlock(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio indisponible');if(!context||context.state==='closed')context=new Audio();if(context.state!=='running')await context.resume();if(context.state!=='running')throw new Error('Audio bloqué');}
  function stop(){if(!context||!voice)return;const time=context.currentTime;voice.gain.cancelScheduledValues(time);voice.gain.setTargetAtTime(0,time,.015);voice=null;}
  function play(note){if(!context||context.state!=='running')return false;stop();const now=context.currentTime,frequency=440*Math.pow(2,(60+note-69)/12),gain=context.createGain();gain.gain.value=.72;gain.connect(context.destination);voice=gain;
    // A short hammer attack and faster decay of high harmonics give a piano-like tone.
    const partials=[1,.32,.14,.06,.025];partials.forEach((level,index)=>{const oscillator=context.createOscillator(),envelope=context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency*(index+1);envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(.24*level,now+.008);envelope.gain.exponentialRampToValueAtTime(.0001,now+1.3/(1+index*.3));oscillator.connect(envelope);envelope.connect(gain);oscillator.start(now);oscillator.stop(now+1.42);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();if(index===partials.length-1){gain.disconnect();if(voice===gain)voice=null;}};});return true;
  }
  window.AboubapianoAudio={unlock,play,stop};window.addEventListener('pagehide',()=>{stop();if(context&&context.state!=='closed')context.close();});
})();
