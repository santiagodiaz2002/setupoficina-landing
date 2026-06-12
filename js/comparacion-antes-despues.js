(function(){
  'use strict';
  var root=document.getElementById('ba-compare');
  if(!root)return;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var value=88,dragging=false,played=false,raf=0;
  function clamp(v){return Math.max(2,Math.min(98,v));}
  function set(v){value=clamp(v);root.style.setProperty('--ba-position',value+'%');root.setAttribute('aria-valuenow',Math.round(value));root.dataset.positionLow=value<18?'true':'false';root.dataset.positionHigh=value>82?'true':'false';}
  function fromPointer(e){var r=root.getBoundingClientRect();set((e.clientX-r.left)/r.width*100);}
  function down(e){dragging=true;root.setPointerCapture&&root.setPointerCapture(e.pointerId);fromPointer(e);}
  function move(e){if(dragging)fromPointer(e);}
  function up(e){dragging=false;if(root.releasePointerCapture)try{root.releasePointerCapture(e.pointerId);}catch(_){} }
  function animate(){if(played)return;played=true;if(reduce){set(50);return;}var start=performance.now(),from=92,to=46,duration=1900;set(from);function tick(now){var p=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-p,4);set(from+(to-from)*ease);if(p<1)raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);}
  root.addEventListener('pointerdown',down);root.addEventListener('pointermove',move);root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
  root.addEventListener('keydown',function(e){var step=e.shiftKey?10:3;if(e.key==='ArrowLeft'){e.preventDefault();set(value-step);}else if(e.key==='ArrowRight'){e.preventDefault();set(value+step);}else if(e.key==='Home'){e.preventDefault();set(2);}else if(e.key==='End'){e.preventDefault();set(98);}});
  if('IntersectionObserver'in window){new IntersectionObserver(function(entries,obs){entries.forEach(function(entry){if(entry.isIntersecting){animate();obs.disconnect();}});},{threshold:.42}).observe(root);}else{animate();}
  set(value);
})();
