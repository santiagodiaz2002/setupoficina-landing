// GUÍA EDUCATIVA: este archivo se ejecuta como módulo visual autocontenido; los comentarios explican cada decisión sin modificar el comportamiento.
(function(){
  // Activa el modo estricto para detectar asignaciones accidentales y aplicar reglas más seguras del lenguaje.
  'use strict';
  // Declara estado mutable para root; su inicialización define el dato que consumirán las sentencias siguientes.
  var root=document.getElementById('ba-compare');
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if(!root)return;
  // Declara estado mutable para reduce; su inicialización define el dato que consumirán las sentencias siguientes.
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Declara estado mutable para value; su inicialización define el dato que consumirán las sentencias siguientes.
  var value=88,dragging=false,played=false,raf=0;
  // Declara la función clamp; recibe v y devuelve el resultado indicado por sus ramas, o ningún valor explícito si sólo produce efectos.
  function clamp(v){return Math.max(2,Math.min(98,v));}
  // Declara la función set; recibe v y devuelve el resultado indicado por sus ramas, o ningún valor explícito si sólo produce efectos.
  function set(v){value=clamp(v);root.style.setProperty('--ba-position',value+'%');root.setAttribute('aria-valuenow',Math.round(value));root.dataset.positionLow=value<18?'true':'false';root.dataset.positionHigh=value>82?'true':'false';}
  // Declara la función fromPointer; recibe e y devuelve el resultado indicado por sus ramas, o ningún valor explícito si sólo produce efectos.
  function fromPointer(e){var r=root.getBoundingClientRect();set((e.clientX-r.left)/r.width*100);}
  // Declara la función down; recibe e y devuelve el resultado indicado por sus ramas, o ningún valor explícito si sólo produce efectos.
  function down(e){dragging=true;root.setPointerCapture&&root.setPointerCapture(e.pointerId);fromPointer(e);}
  // Declara la función move; recibe e y devuelve el resultado indicado por sus ramas, o ningún valor explícito si sólo produce efectos.
  function move(e){if(dragging)fromPointer(e);}
  // Declara la función up; recibe e y devuelve el resultado indicado por sus ramas, o ningún valor explícito si sólo produce efectos.
  function up(e){dragging=false;if(root.releasePointerCapture)try{root.releasePointerCapture(e.pointerId);}catch(_){} }
  // Declara la función animate; recibe ningún argumento y devuelve el resultado indicado por sus ramas, o ningún valor explícito si sólo produce efectos.
  function animate(){if(played)return;played=true;if(reduce){set(50);return;}var start=performance.now(),from=92,to=46,duration=1900;set(from);function tick(now){var p=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-p,4);set(from+(to-from)*ease);if(p<1)raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);}
  // Registra un manejador para la interacción indicada; el callback recibirá el evento cuando ocurra.
  root.addEventListener('pointerdown',down);root.addEventListener('pointermove',move);root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
  // Registra un manejador para la interacción indicada; el callback recibirá el evento cuando ocurra.
  root.addEventListener('keydown',function(e){var step=e.shiftKey?10:3;if(e.key==='ArrowLeft'){e.preventDefault();set(value-step);}else if(e.key==='ArrowRight'){e.preventDefault();set(value+step);}else if(e.key==='Home'){e.preventDefault();set(2);}else if(e.key==='End'){e.preventDefault();set(98);}});
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if('IntersectionObserver'in window){new IntersectionObserver(function(entries,obs){entries.forEach(function(entry){if(entry.isIntersecting){animate();obs.disconnect();}});},{threshold:.42}).observe(root);}else{animate();}
  // Ejecuta la operación indicada y deja que sus efectos o retorno alimenten el flujo siguiente.
  set(value);
// Esta sentencia completa la construcción o actualización del bloque lógico actual.
})();
