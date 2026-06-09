/* =====================================================================
   PrimOffice · Adaptador 3D del preview (Three.js)
   ---------------------------------------------------------------------
   Reemplaza el preview 2D (#desk-scene) del resultado por una escena 3D
   real, SIN tocar la lógica del quiz/carrito de la landing canónica.

   - Carga diferida de Three.js (dynamic import + IntersectionObserver).
   - Fallback: si no hay WebGL, se mantiene el preview 2D existente.
   - Espeja la MISMA visibilidad de productos que el carrito: la landing
     llama window.Setup3D.setVisible(visMap, {standing}) con claves
     'dsi-*' (las mismas que usa el preview 2D).
   - Cámara con OrbitControls (rotar/zoom/táctil), vistas y reset.
   - Respeta prefers-reduced-motion.
   ===================================================================== */
(function () {
  'use strict';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var THREE, OrbitControls, RoundedBox;
  var renderer, scene, camera, controls, host, toolbar, loaderEl, deskScene2D, stageEl;
  var ready = false, initStarted = false, running = false, camFly = false;
  var objects = {}, deskTop, surfaceAnchor, legL, legR;
  var DESK_SIT = 0.74, DESK_STAND = 1.05, curTopY = DESK_SIT;
  var DSI = ['dsi-chair','dsi-monitor','dsi-monitor-stand','dsi-monitor-arm','dsi-laptop','dsi-stand','dsi-keyboard','dsi-mousepad','dsi-mouse','dsi-hub','dsi-organizer','dsi-lightbar'];

  function $(id){ return document.getElementById(id); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function clamp01(t){ return t<0?0:(t>1?1:t); }
  function easeInOut(t){ return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }

  function webglOk(){
    try { var c=document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl')||c.getContext('experimental-webgl'))); }
    catch(e){ return false; }
  }

  /* ---- tweens mínimos ---- */
  var tweens=[];
  function addTween(dur,upd,done){
    if(reduce||!dur){ upd(1); if(done)done(); return; }
    tweens.push({t0:performance.now(),dur:dur,upd:upd,done:done});
  }
  function stepTweens(now){
    for(var i=tweens.length-1;i>=0;i--){ var tw=tweens[i]; var p=clamp01((now-tw.t0)/tw.dur); tw.upd(easeInOut(p)); if(p>=1){ tweens.splice(i,1); if(tw.done)tw.done(); } }
  }

  /* ---- materiales / helpers ---- */
  function mat(color,o){ o=o||{}; return new THREE.MeshStandardMaterial({color:color,roughness:o.r!=null?o.r:0.7,metalness:o.m!=null?o.m:0.05}); }
  function screenMat(){ return new THREE.MeshStandardMaterial({color:0x0c1622,emissive:new THREE.Color(0x1b6fa0),emissiveIntensity:0.8,roughness:0.4}); }
  function rbox(w,h,d,r){ return new RoundedBox(w,h,d,3,r||0.02); }
  function mesh(g,m){ var x=new THREE.Mesh(g,m); x.castShadow=true; x.receiveShadow=true; return x; }

  var COL={ surface:0xe9eef4, metal:0x3a4756, metalL:0x8d99a8, dark:0x222a34, accent:0x38bdf8, white:0xeef3f8, fabric:0x2c3744 };

  /* ---- builders (devuelven Group ya posicionado sobre la superficie y=0 local) ---- */
  function bChair(){
    var g=new THREE.Group(); var fab=mat(COL.fabric,{r:0.85}), met=mat(COL.metal,{r:0.4,m:0.6});
    var hub=mesh(new THREE.CylinderGeometry(0.05,0.06,0.06,16),met); hub.position.y=0.11; g.add(hub);
    for(var i=0;i<5;i++){ var a=i/5*Math.PI*2; var leg=mesh(new THREE.BoxGeometry(0.26,0.03,0.05),met); leg.position.set(Math.cos(a)*0.13,0.05,Math.sin(a)*0.13); leg.rotation.y=-a; g.add(leg);
      var cs=mesh(new THREE.SphereGeometry(0.03,10,8),mat(COL.dark,{r:0.5})); cs.position.set(Math.cos(a)*0.24,0.03,Math.sin(a)*0.24); g.add(cs); }
    var post=mesh(new THREE.CylinderGeometry(0.03,0.035,0.34,12),met); post.position.y=0.30; g.add(post);
    var seat=mesh(rbox(0.50,0.09,0.48,0.04),fab); seat.position.y=0.50; g.add(seat);
    var back=mesh(rbox(0.46,0.56,0.08,0.04),fab); back.position.set(0,0.84,0.22); back.rotation.x=THREE.MathUtils.degToRad(8); g.add(back);
    g.position.set(0,0,0.95); // detrás, sobre el piso (anchor floor)
    return g;
  }
  function bMonitor(){ var g=new THREE.Group(); var body=mat(COL.dark,{r:0.5,m:0.2});
    g.add(mesh(rbox(0.62,0.36,0.035,0.012),body));
    var s=mesh(new THREE.PlaneGeometry(0.575,0.32),screenMat()); s.position.z=0.02; g.add(s);
    g.userData.baseY=0.30; return g; }
  function bMonStand(){ var g=new THREE.Group(); var m=mat(COL.metalL,{m:0.5,r:0.4});
    var neck=mesh(rbox(0.05,0.18,0.05,0.02),m); neck.position.y=0.09; g.add(neck);
    var base=mesh(new THREE.CylinderGeometry(0.12,0.13,0.018,24),m); base.position.y=0.009; g.add(base); return g; }
  function bMonArm(){ var g=new THREE.Group(); var m=mat(COL.metal,{m:0.7,r:0.35});
    var pole=mesh(new THREE.CylinderGeometry(0.018,0.018,0.40,12),m); pole.position.set(0,0.22,-0.30); g.add(pole);
    var arm=mesh(rbox(0.04,0.03,0.26,0.008),m); arm.position.set(0,0.42,-0.18); g.add(arm); return g; }
  function bLaptop(){ var g=new THREE.Group(); var body=mat(COL.metalL,{m:0.6,r:0.4});
    var base=mesh(rbox(0.34,0.018,0.24,0.01),body); base.position.y=0.01; g.add(base);
    var lid=new THREE.Group(); lid.add(mesh(rbox(0.34,0.22,0.012,0.008),body));
    var disp=mesh(new THREE.PlaneGeometry(0.30,0.185),screenMat()); disp.position.z=0.008; lid.add(disp);
    lid.position.set(0,0.12,-0.11); lid.rotation.x=THREE.MathUtils.degToRad(-15); g.add(lid); return g; }
  function bStand(){ var g=new THREE.Group(); var m=mat(COL.metalL,{m:0.4,r:0.45});
    var top=mesh(rbox(0.40,0.02,0.24,0.01),m); top.position.y=0.10; g.add(top);
    for(var sx=-1;sx<=1;sx+=2){ var leg=mesh(rbox(0.03,0.10,0.20,0.008),m); leg.position.set(sx*0.16,0.05,0); g.add(leg); } return g; }
  function bKeyboard(){ var g=new THREE.Group(); g.add(mesh(rbox(0.40,0.02,0.13,0.008),mat(COL.white,{r:0.5})));
    var keys=mat(0x2a323c,{r:0.6}); for(var r=0;r<3;r++)for(var c=0;c<12;c++){ var k=mesh(rbox(0.022,0.008,0.022,0.002),keys); k.position.set(-0.17+c*0.031,0.016,-0.035+r*0.03); g.add(k);} return g; }
  function bMousepad(){ var g=new THREE.Group(); g.add(mesh(rbox(0.26,0.006,0.20,0.01),mat(0x1f2935,{r:0.85}))); return g; }
  function bMouse(){ var g=new THREE.Group(); var b=mesh(new THREE.SphereGeometry(0.035,16,12),mat(COL.accent,{r:0.4})); b.scale.set(1,0.55,1.5); b.position.y=0.02; g.add(b); return g; }
  function bHub(){ var g=new THREE.Group(); g.add(mesh(rbox(0.16,0.022,0.05,0.008),mat(COL.metalL,{m:0.6,r:0.35})));
    var led=mesh(new THREE.CylinderGeometry(0.004,0.004,0.005,8),new THREE.MeshStandardMaterial({color:0x0c0f12,emissive:new THREE.Color(COL.accent),emissiveIntensity:1.4})); led.rotation.x=Math.PI/2; led.position.set(-0.06,0.016,0.026); g.add(led); return g; }
  function bOrganizer(){ var g=new THREE.Group(); g.add(mesh(rbox(0.12,0.10,0.10,0.01),mat(0x334155,{r:0.6})));
    var cols=[0x38bdf8,0xf59e0b,0x10b981]; for(var i=0;i<3;i++){ var pen=mesh(new THREE.CylinderGeometry(0.006,0.006,0.12,8),mat(cols[i],{r:0.5})); pen.position.set(-0.025+i*0.025,0.10,0); g.add(pen);} g.position.x=0.50; return g; }
  function bLightbar(){ var g=new THREE.Group(); g.add(mesh(rbox(0.46,0.03,0.05,0.012),mat(COL.dark,{r:0.5})));
    var glow=mesh(new THREE.BoxGeometry(0.42,0.012,0.03),new THREE.MeshStandardMaterial({color:0x0c0f12,emissive:new THREE.Color(0xbfeeff),emissiveIntensity:1.2})); glow.position.set(0,-0.018,0.022); g.add(glow); return g; }

  /* posiciones sobre la superficie (x,z); y se ajusta por tipo */
  var LAYOUT={
    'dsi-monitor':       {x:0,z:-0.18},
    'dsi-monitor-stand': {x:0,z:-0.18},
    'dsi-monitor-arm':   {x:0,z:-0.18},
    'dsi-laptop':        {x:-0.42,z:0.02},
    'dsi-stand':         {x:-0.42,z:0.02},
    'dsi-keyboard':      {x:0,z:0.14},
    'dsi-mousepad':      {x:0.30,z:0.14},
    'dsi-mouse':         {x:0.30,z:0.14},
    'dsi-hub':           {x:0.48,z:-0.05},
    'dsi-organizer':     {x:0.50,z:-0.02},
    'dsi-lightbar':      {x:0,z:-0.30},
    'dsi-chair':         {x:0,z:0.95}
  };

  function buildScene(){
    var w=host.clientWidth||520, h=host.clientHeight||390;
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setSize(w,h,false); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    if('outputColorSpace' in renderer) renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
    host.appendChild(renderer.domElement);

    scene=new THREE.Scene(); scene.fog=new THREE.Fog(0x0f172a,6,15);
    camera=new THREE.PerspectiveCamera(42,w/h,0.1,100);
    controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true; controls.dampingFactor=0.08; controls.enablePan=false;
    controls.minDistance=1.45; controls.maxDistance=5.0;
    controls.minPolarAngle=THREE.MathUtils.degToRad(12); controls.maxPolarAngle=THREE.MathUtils.degToRad(86);

    scene.add(new THREE.HemisphereLight(0xbfe3ff,0x0a1424,1.2));
    scene.add(new THREE.AmbientLight(0x6f93b5,0.5));
    var key=new THREE.DirectionalLight(0xffffff,2.6); key.position.set(2.6,4.2,2.4); key.castShadow=true;
    key.shadow.mapSize.set(2048,2048); key.shadow.bias=-0.0004; key.shadow.normalBias=0.02;
    var sc=key.shadow.camera; sc.near=0.5; sc.far=14; sc.left=-2.4; sc.right=2.4; sc.top=2.4; sc.bottom=-2.4; sc.updateProjectionMatrix();
    scene.add(key);
    var rim=new THREE.DirectionalLight(0x9fd8ff,0.7); rim.position.set(-3,2.4,-2.5); scene.add(rim);

    var floor=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.ShadowMaterial({opacity:0.26}));
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

    // escritorio
    surfaceAnchor=new THREE.Object3D(); surfaceAnchor.position.y=curTopY; scene.add(surfaceAnchor);
    deskTop=mesh(rbox(1.5,0.04,0.72,0.012),mat(COL.surface,{r:0.7})); deskTop.position.y=-0.02; surfaceAnchor.add(deskTop);
    var legMat=mat(COL.metal,{m:0.6,r:0.4});
    legL=mesh(new THREE.BoxGeometry(0.07,1,0.07),legMat); legR=mesh(new THREE.BoxGeometry(0.07,1,0.07),legMat);
    scene.add(legL,legR); setLegs();

    // objetos
    var builders={ 'dsi-chair':bChair,'dsi-monitor':bMonitor,'dsi-monitor-stand':bMonStand,'dsi-monitor-arm':bMonArm,'dsi-laptop':bLaptop,'dsi-stand':bStand,'dsi-keyboard':bKeyboard,'dsi-mousepad':bMousepad,'dsi-mouse':bMouse,'dsi-hub':bHub,'dsi-organizer':bOrganizer,'dsi-lightbar':bLightbar };
    DSI.forEach(function(id){
      var o=builders[id](); o.visible=false; objects[id]=o;
      var L=LAYOUT[id]; if(L && id!=='dsi-chair'){ o.position.x+=L.x; o.position.z+=L.z; }
      if(id==='dsi-chair'){ scene.add(o); } else { surfaceAnchor.add(o); }
    });

    ready=true;
    setView('perspectiva',false);
    var ro=new ResizeObserver(function(){ var cw=host.clientWidth,ch=host.clientHeight; if(cw&&ch){ renderer.setSize(cw,ch,false); camera.aspect=cw/ch; camera.updateProjectionMatrix(); } });
    ro.observe(host);

    var vis=new IntersectionObserver(function(en){ if(en[0].isIntersecting){ running=true; renderer.setAnimationLoop(loop); } else { running=false; renderer.setAnimationLoop(null); } },{threshold:0.01});
    vis.observe(stageEl);

    refreshFromDOM();
  }

  function setLegs(){
    var colH=Math.max(0.05,curTopY-0.04), xx=0.62;
    legL.scale.y=colH; legR.scale.y=colH;
    legL.position.set(-xx,colH/2,0); legR.position.set(xx,colH/2,0);
  }

  function arrangeMonitor(){
    var mon=objects['dsi-monitor']; if(!mon)return;
    var arm=objects['dsi-monitor-arm'].visible, stand=objects['dsi-monitor-stand'].visible;
    var y=0.30; if(arm) y=0.44; else if(stand) y=0.32; else y=0.20;
    mon.position.y=y;
    var lb=objects['dsi-lightbar']; if(lb) lb.position.y=y+0.20;
  }

  function applyVisible(vis){
    DSI.forEach(function(id){ if(objects[id]) objects[id].visible=!!vis[id]; });
    arrangeMonitor();
  }

  function setDeskMode(standing,animated){
    var target=standing?DESK_STAND:DESK_SIT; if(target===curTopY)return;
    var from=curTopY;
    addTween(animated&&!reduce?700:0,function(e){ curTopY=lerp(from,target,e); if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); if(controls)controls.target.y=curTopY*0.55; },function(){ if(controls)controls.update(); });
    if(reduce||!animated){ curTopY=target; if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); }
  }

  /* ---- cámara ---- */
  function viewSpec(v){ var y=curTopY;
    if(v==='frontal') return {p:new THREE.Vector3(0,y+0.30,2.55),t:new THREE.Vector3(0,y*0.58,0)};
    if(v==='superior') return {p:new THREE.Vector3(0.001,y+2.75,0.22),t:new THREE.Vector3(0,y*0.10,-0.05)};
    return {p:new THREE.Vector3(1.95,y+0.82,2.05),t:new THREE.Vector3(0,y*0.52,0)};
  }
  function setView(v,animated){
    if(!ready)return; var s=viewSpec(v);
    if(reduce||!animated){ camera.position.copy(s.p); controls.target.copy(s.t); controls.update(); return; }
    camFly=true; controls.enabled=false; var p0=camera.position.clone(), t0=controls.target.clone();
    addTween(800,function(e){ camera.position.lerpVectors(p0,s.p,e); controls.target.lerpVectors(t0,s.t,e); camera.lookAt(controls.target); },function(){ camFly=false; controls.enabled=true; controls.update(); });
    highlight(v);
  }
  function highlight(v){ if(!toolbar)return; var hv=v==='reset'?'perspectiva':v; toolbar.querySelectorAll('[data-view]').forEach(function(b){ var on=b.getAttribute('data-view')===hv; b.classList.toggle('is-active',on); b.setAttribute('aria-pressed',on?'true':'false'); }); }

  function loop(){ var now=performance.now(); stepTweens(now); if(!camFly&&controls)controls.update(); renderer.render(scene,camera); }

  /* ---- API pública ---- */
  function refreshFromDOM(){
    if(!ready)return; var vis={}, standing=false;
    DSI.forEach(function(id){ var el=$(id); vis[id]=!!(el && !el.classList.contains('hidden-item')); });
    var sb=$('dsi-standing-badge'); standing=!!(sb && !sb.classList.contains('hidden-item'));
    applyVisible(vis); setDeskMode(standing,false);
  }
  function setVisible(vis,opts){ if(!ready){ pending={vis:vis,opts:opts||{}}; return; } applyVisible(vis||{}); setDeskMode(!!(opts&&opts.standing),true); }
  var pending=null;

  /* ---- arranque diferido ---- */
  function reveal(){ // 3D ok: ocultar 2D, mostrar stage 3D
    if(deskScene2D) deskScene2D.style.display='none';
    if(stageEl) stageEl.removeAttribute('hidden');
    if(loaderEl) loaderEl.style.display='none';
    if(toolbar) toolbar.style.display='';
    if(pending){ setVisible(pending.vis,pending.opts); pending=null; }
  }
  function fallback(){ // sin WebGL: dejar 2D visible
    if(stageEl) stageEl.setAttribute('hidden','');
  }

  async function init(){
    if(initStarted)return; initStarted=true;
    host=$('s3dHost'); stageEl=$('s3dStage'); toolbar=$('s3dToolbar'); loaderEl=$('s3dLoader'); deskScene2D=$('desk-scene');
    if(!host||!stageEl){ return; }
    if(!webglOk()){ fallback(); return; }
    try{
      THREE=await import('three');
      OrbitControls=(await import('three/addons/controls/OrbitControls.js')).OrbitControls;
      RoundedBox=(await import('three/addons/geometries/RoundedBoxGeometry.js')).RoundedBoxGeometry;
    }catch(err){ console.warn('[setup-3d] No se pudo cargar Three.js; se usa el preview 2D.',err); fallback(); return; }
    try{ buildScene(); reveal();
      if(toolbar){ toolbar.querySelectorAll('[data-view]').forEach(function(b){ b.addEventListener('click',function(){ setView(b.getAttribute('data-view'),true); }); }); }
    }catch(err){ console.error('[setup-3d] Error al construir la escena 3D.',err); fallback(); }
  }

  function start(){
    var section=$('test')||$('s3dStage');
    if(!$('s3dStage')) return; // no hay host (otra página)
    if('IntersectionObserver' in window && section){
      var io=new IntersectionObserver(function(en,o){ if(en.some(function(e){return e.isIntersecting;})){ o.disconnect(); init(); } },{rootMargin:'400px 0px'});
      io.observe(section);
    } else { init(); }
  }

  window.Setup3D={ setVisible:setVisible, setView:setView, refreshFromDOM:refreshFromDOM, isReady:function(){return ready;} };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
