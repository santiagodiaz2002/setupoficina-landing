/* =====================================================================
   PrimOffice · Adaptador 3D del preview (Three.js)
   ---------------------------------------------------------------------
   Reemplaza el preview 2D (#desk-scene) del resultado por una escena 3D
   real, SIN tocar la lógica del quiz/carrito de la landing canónica.

   - Carga diferida de Three.js (dynamic import + IntersectionObserver).
   - Fallback: si no hay WebGL, se mantiene el preview 2D existente.
   - Geometrías procedurales fieles a los productos reales de PrimOffice
     (pArm, pStandard, pNotebook, pMat, pHub, pBox, pGlow, pMechanic,
     pMouseProV) + escritorio tipo pStanding (columnas telescópicas).
   - LAYOUT canónico: cada objeto tiene una POSICIÓN PREDETERMINADA
     coherente (tabla HOME) y `computeHome()` resuelve los apoyos
     dependientes (monitor sobre soporte/brazo, lightbar sobre monitor,
     teclado/mouse sobre el pad, notebook sobre el elevador).
   - Modo LIBRE: el usuario puede arrastrar cada objeto sobre la
     superficie (raycasting + plano), con límites coherentes.
   - Botón REINICIAR: anima todo de vuelta a su posición predeterminada
     y restablece cámara y modo libre.
   - Entorno de reflejos (RoomEnvironment + PMREM) para acabado moderno.
   - Pipeline .glb opcional por producto (GLTFLoader, carga diferida).
   - Espeja la MISMA visibilidad de productos que el carrito mediante
     window.Setup3D.setVisible(visMap, {standing}).
   - Cámara con OrbitControls (rotar/zoom/táctil), vistas y reset.
   - Respeta prefers-reduced-motion.
   ===================================================================== */
(function () {
  'use strict';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var THREE, OrbitControls, RoundedBox, RoomEnv;
  var renderer, scene, camera, controls, host, toolbar, loaderEl, deskScene2D, stageEl, hintEl;
  var ready = false, initStarted = false, running = false, camFly = false;
  var objects = {}, deskTop, surfaceAnchor, legL, legR;
  var DESK_SIT = 0.73, DESK_STAND = 1.08, curTopY = DESK_SIT;
  var DSI = ['dsi-chair','dsi-monitor','dsi-monitor-stand','dsi-monitor-arm','dsi-laptop','dsi-stand','dsi-keyboard','dsi-mousepad','dsi-mouse','dsi-hub','dsi-organizer','dsi-lightbar'];

  function $(id){ return document.getElementById(id); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function clamp01(t){ return t<0?0:(t>1?1:t); }
  function clampN(v,a,b){ return v<a?a:(v>b?b:v); }
  function easeInOut(t){ return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
  function rad(d){ return THREE.MathUtils.degToRad(d); }

  function webglOk(){
    try { var c=document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl')||c.getContext('experimental-webgl'))); }
    catch(e){ return false; }
  }

  /* ---- tweens minimos ---- */
  var tweens=[];
  function addTween(dur,upd,done){
    if(reduce||!dur){ upd(1); if(done)done(); return; }
    tweens.push({t0:performance.now(),dur:dur,upd:upd,done:done});
  }
  function stepTweens(now){
    for(var i=tweens.length-1;i>=0;i--){ var tw=tweens[i]; var p=clamp01((now-tw.t0)/tw.dur); tw.upd(easeInOut(p)); if(p>=1){ tweens.splice(i,1); if(tw.done)tw.done(); } }
  }

  /* ---- materiales / geometrias con cache (reutilizacion -> performance) ---- */
  var _matCache={};
  function mat(color,o){
    o=o||{};
    var r=o.r!=null?o.r:0.7, m=o.m!=null?o.m:0.05, e=o.e||0, ei=o.ei!=null?o.ei:1;
    var key=color+'|'+r+'|'+m+'|'+e+'|'+ei;
    if(_matCache[key]) return _matCache[key];
    var p={color:color,roughness:r,metalness:m};
    if(e){ p.emissive=new THREE.Color(e); p.emissiveIntensity=ei; }
    var mm=new THREE.MeshStandardMaterial(p);
    _matCache[key]=mm; return mm;
  }
  function screenMat(){ return mat(0x0c1622,{e:0x1b6fa0,ei:0.8,r:0.4}); }
  function rbox(w,h,d,r){ return new RoundedBox(w,h,d,2,r||0.02); }
  function mesh(g,m){ var x=new THREE.Mesh(g,m); x.castShadow=true; x.receiveShadow=true; return x; }
  function box(w,h,d,m){ return mesh(new THREE.BoxGeometry(w,h,d),m); }
  var _keyGeo=null; function keyGeo(){ if(!_keyGeo)_keyGeo=new THREE.BoxGeometry(0.024,0.011,0.022); return _keyGeo; }

  var COL={
    surface:0xeceff3, edge:0xc7cfd9,
    frame:0x39424e, frameDark:0x232a32,
    steel:0x2a3038, steelDark:0x1b2026, alu:0x9aa6b4, aluDark:0x6f7c8c,
    dark:0x222a34, accent:0x38bdf8, white:0xeef3f8, fabric:0x2c3744,
    mat:0x232d39, matEdge:0x161d26,
    boxSteel:0x2b323b, boxLid:0x222831, cable:0x2a2f37,
    barDark:0x222932, warmLight:0xfff1d4,
    armBlk:0x262d36, kbCase:0x20262e, keycap:0x2d343e,
    mouseBody:0x2a313b, portDark:0x10141a, ledGreen:0x10b981
  };

  /* =====================================================================
     BUILDERS — devuelven un Group con la base apoyada en y~0 (superficie).
     ===================================================================== */

  /* Silla ergonomica (contextual, generica) — base centrada en el origen */
  function bChair(){
    var g=new THREE.Group(); var fab=mat(COL.fabric,{r:0.85}), met=mat(COL.frame,{r:0.4,m:0.6});
    var hub=mesh(new THREE.CylinderGeometry(0.05,0.06,0.06,16),met); hub.position.y=0.11; g.add(hub);
    for(var i=0;i<5;i++){ var a=i/5*Math.PI*2; var leg=box(0.26,0.03,0.05,met); leg.position.set(Math.cos(a)*0.13,0.05,Math.sin(a)*0.13); leg.rotation.y=-a; g.add(leg);
      var cs=mesh(new THREE.SphereGeometry(0.03,10,8),mat(COL.dark,{r:0.5})); cs.position.set(Math.cos(a)*0.24,0.03,Math.sin(a)*0.24); g.add(cs); }
    var post=mesh(new THREE.CylinderGeometry(0.03,0.035,0.34,12),met); post.position.y=0.30; g.add(post);
    var seat=mesh(rbox(0.50,0.09,0.48,0.04),fab); seat.position.y=0.50; g.add(seat);
    var back=mesh(rbox(0.46,0.56,0.08,0.04),fab); back.position.set(0,0.84,0.22); back.rotation.x=rad(8); g.add(back);
    return g;
  }

  /* Monitor (contextual, generico) */
  function bMonitor(){ var g=new THREE.Group(); var body=mat(COL.dark,{r:0.5,m:0.2});
    g.add(mesh(rbox(0.62,0.36,0.035,0.012),body));
    var s=mesh(new THREE.PlaneGeometry(0.575,0.32),screenMat()); s.position.z=0.0185; g.add(s);
    g.userData.baseY=0.30; return g; }

  /* Notebook (contextual, generica) */
  function bLaptop(){ var g=new THREE.Group(); var body=mat(COL.alu,{m:0.6,r:0.4});
    var base=mesh(rbox(0.34,0.018,0.24,0.01),body); base.position.y=0.01; g.add(base);
    var lid=new THREE.Group(); lid.add(mesh(rbox(0.34,0.22,0.012,0.008),body));
    var disp=mesh(new THREE.PlaneGeometry(0.30,0.185),screenMat()); disp.position.z=0.0075; lid.add(disp);
    lid.position.set(0,0.12,-0.11); lid.rotation.x=rad(-15); g.add(lid);
    g.userData.baseY=0; return g; }

  /* pStandard — Soporte para Monitor de altura regulable (acero al carbono / epoxi, negro) */
  function bMonStand(){ var g=new THREE.Group(); var steel=mat(COL.steel,{m:0.5,r:0.42}), dk=mat(COL.steelDark,{m:0.5,r:0.5});
    var plat=mesh(rbox(0.34,0.022,0.20,0.01),steel); plat.position.y=0.106; g.add(plat);
    for(var sx=-1;sx<=1;sx+=2){
      var leg=mesh(rbox(0.03,0.10,0.16,0.006),steel); leg.position.set(sx*0.14,0.05,0); g.add(leg);
      var ft=mesh(rbox(0.05,0.012,0.19,0.006),dk); ft.position.set(sx*0.14,0.006,0); g.add(ft);
    }
    var rail=mesh(rbox(0.30,0.012,0.02,0.004),steel); rail.position.set(0,0.045,0.085); g.add(rail);
    return g; }

  /* pArm — Soporte para monitor con brazo articulado (negro, clamp al borde TRASERO del escritorio).
     Origen del grupo = punto de apoyo en la superficie, justo bajo el monitor (z = -0.18 mundo).
     El clamp se ancla en el borde trasero (z local -0.18) y el brazo lleva la placa VESA
     hasta el monitor (y ~ 0.44, z local ~ 0). Así NUNCA flota detrás del escritorio. */
  function bMonArm(){
    var g=new THREE.Group();
    var blk=mat(COL.armBlk,{m:0.55,r:0.42});
    var steel=mat(COL.steel,{m:0.62,r:0.34});

    /* El holder vive en z=-0.18. El borde trasero real de la mesa queda
       en z local=-0.18. Se desplaza el poste a la derecha para que el
       recorrido articulado sea visible y termine en la placa VESA. */
    var clampX=0.24, rearZ=-0.18, elbowZ=-0.05, vesaZ=-0.012;

    function barBetweenXZ(x1,z1,x2,z2,y){
      var dx=x2-x1, dz=z2-z1;
      var len=Math.sqrt(dx*dx+dz*dz);
      var b=mesh(rbox(0.042,0.032,len,0.010),blk);
      b.position.set((x1+x2)/2,y,(z1+z2)/2);
      b.rotation.y=Math.atan2(dx,dz);
      return b;
    }

    var clamp=mesh(rbox(0.080,0.060,0.090,0.010),blk);
    clamp.position.set(clampX,0.030,rearZ);
    g.add(clamp);

    var jaw=mesh(rbox(0.080,0.016,0.066,0.005),blk);
    jaw.position.set(clampX,-0.014,rearZ);
    g.add(jaw);

    var knob=mesh(new THREE.CylinderGeometry(0.014,0.014,0.034,14),steel);
    knob.position.set(clampX,-0.034,rearZ+0.020);
    g.add(knob);

    var pole=mesh(new THREE.CylinderGeometry(0.018,0.021,0.440,16),steel);
    pole.position.set(clampX,0.250,rearZ);
    g.add(pole);

    g.add(joint(clampX,0.450,rearZ,0.027,blk));
    g.add(barBetweenXZ(clampX,rearZ,clampX,elbowZ,0.452));
    g.add(joint(clampX,0.452,elbowZ,0.024,blk));
    g.add(barBetweenXZ(clampX,elbowZ,0,vesaZ,0.452));
    g.add(joint(0,0.452,vesaZ,0.022,blk));

    var tilt=mesh(rbox(0.050,0.034,0.040,0.008),blk);
    tilt.position.set(0,0.450,vesaZ);
    g.add(tilt);

    var vesa=mesh(rbox(0.105,0.115,0.022,0.008),blk);
    vesa.position.set(0,0.440,vesaZ);
    g.add(vesa);

    return g;
  }
  function joint(x,y,z,r,m){ var s=mesh(new THREE.SphereGeometry(r,12,10),m); s.position.set(x,y,z); return s; }

  /* pNotebook — Soporte ergonomico elevador para notebook (aluminio, inclinado) */
  function bStand(){ var g=new THREE.Group(); var alu=mat(COL.alu,{m:0.6,r:0.4});
    for(var sx=-1;sx<=1;sx+=2){
      var legF=mesh(rbox(0.022,0.10,0.022,0.006),alu); legF.position.set(sx*0.14,0.05,0.09); g.add(legF);
      var legB=mesh(rbox(0.022,0.14,0.022,0.006),alu); legB.position.set(sx*0.14,0.07,-0.09); g.add(legB);
    }
    var plate=mesh(rbox(0.28,0.012,0.21,0.008),alu); plate.position.set(0,0.118,0); plate.rotation.x=rad(13); g.add(plate);
    var lip=mesh(rbox(0.28,0.02,0.012,0.004),alu); lip.position.set(0,0.10,0.105); g.add(lip);
    return g; }

  /* pMechanic — Teclado mecanico compacto RGB (negro, underglow) */
  function bKeyboard(){ var g=new THREE.Group();
    var base=mesh(rbox(0.40,0.022,0.135,0.006),mat(COL.kbCase,{r:0.5,m:0.2})); base.position.y=0.012; g.add(base);
    var glow=box(0.40,0.004,0.135,mat(0x0c0f12,{e:COL.accent,ei:0.7})); glow.position.y=0.001; g.add(glow);
    var keyM=mat(COL.keycap,{r:0.6}), gk=keyGeo();
    for(var r=0;r<4;r++)for(var c=0;c<13;c++){ var k=mesh(gk,keyM); k.castShadow=true; k.position.set(-0.168+c*0.028,0.027,-0.041+r*0.027); g.add(k); }
    var sb=box(0.14,0.011,0.022,keyM); sb.position.set(0,0.027,0.05); g.add(sb);
    return g; }

  /* Mouse — placeholder original estable y visualmente limpio */
  function bMouse(){
    var g=new THREE.Group();

    var body=mesh(
      new THREE.SphereGeometry(0.035,16,12),
      mat(COL.accent,{r:0.4})
    );

    body.scale.set(1,0.55,1.5);
    body.position.y=0.02;

    g.add(body);

    return g;
  }

  /* pHub — Adaptador Hub USB-C multifuncional 7 en 1 (aluminio, puertos + LED) */
  function bHub(){
    var g = new THREE.Group();
    var alu = mat(COL.alu, { m: 0.72, r: 0.30 });
    var aluDark = mat(COL.aluDark, { m: 0.58, r: 0.38 });
    var portM = mat(COL.portDark, { r: 0.62 });
    var cableM = mat(COL.cable, { r: 0.68 });
    var w = 0.18, h = 0.026, d = 0.058;
    var body = mesh(rbox(w, h, d, 0.006), alu); body.position.y = h / 2; g.add(body);
    var top = mesh(rbox(w - 0.016, 0.005, d - 0.012, 0.004), aluDark); top.position.y = h + 0.002; g.add(top);
    for(var i = 0; i < 3; i++){
      var port = box(0.022, 0.009, 0.004, portM);
      port.position.set(-0.047 + i * 0.038, h / 2, d / 2 + 0.001); g.add(port);
    }
    var sidePort = box(0.004, 0.009, 0.020, portM);
    sidePort.position.set(w / 2 + 0.001, h / 2, -0.010); g.add(sidePort);
    var cable = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 8), cableM);
    cable.rotation.z = Math.PI / 2; cable.position.set(-(w / 2 + 0.045), h / 2, -0.006); g.add(cable);
    var plug = mesh(rbox(0.022, 0.010, 0.014, 0.003), aluDark);
    plug.position.set(-(w / 2 + 0.094), h / 2, -0.006); g.add(plug);
    var led = mesh(new THREE.SphereGeometry(0.004, 8, 6), mat(0x0c0f12, { e: COL.accent, ei: 1.7 }));
    led.position.set(0.066, h + 0.004, 0.008); g.add(led);
    g.rotation.y = rad(-10);
    return g;
  }

  /* pMat — Pad XL de cuero ecologico para escritorio (mate, borde cosido) */
  function bMousepad(){
    var g = new THREE.Group();
    var w = 0.72, d = 0.38;
    var base = mesh(rbox(w, 0.006, d, 0.016), mat(COL.matEdge, { r: 0.86 }));
    base.position.y = 0.003; base.castShadow = false; g.add(base);
    var top = mesh(rbox(w - 0.018, 0.006, d - 0.018, 0.014), mat(COL.mat, { r: 0.94 }));
    top.position.y = 0.007; top.castShadow = false; g.add(top);
    var seamM = mat(0x4a5b6e, { r: 0.92 });
    var sy = 0.0105;
    var seamFront = box(w - 0.05, 0.0015, 0.002, seamM); seamFront.position.set(0, sy, d / 2 - 0.024); seamFront.castShadow = false; g.add(seamFront);
    var seamBack = box(w - 0.05, 0.0015, 0.002, seamM); seamBack.position.set(0, sy, -(d / 2 - 0.024)); seamBack.castShadow = false; g.add(seamBack);
    var seamLeft = box(0.002, 0.0015, d - 0.05, seamM); seamLeft.position.set(-(w / 2 - 0.024), sy, 0); seamLeft.castShadow = false; g.add(seamLeft);
    var seamRight = box(0.002, 0.0015, d - 0.05, seamM); seamRight.position.set(w / 2 - 0.024, sy, 0); seamRight.castShadow = false; g.add(seamRight);
    return g;
  }

  /* pBox — Bandeja organizadora de cables de acero.
     Queda completamente debajo del tablero y se conecta mediante dos soportes.
     El origen del grupo se ubica en la base de la bandeja. */
  function bCableBox(){
    var g=new THREE.Group();

    var steel=mat(COL.boxSteel,{m:0.55,r:0.45});
    var lidM=mat(COL.boxLid,{m:0.50,r:0.50});
    var bracketM=mat(COL.steelDark,{m:0.58,r:0.44});
    var cableM=mat(COL.cable,{r:0.62});

    var w=0.40, h=0.10, d=0.18, t=0.010;

    /* Cuerpo de la bandeja */
    var floor=mesh(rbox(w,t,d,0.004),steel);
    floor.position.set(0,t/2,0);
    g.add(floor);

    var back=mesh(rbox(w,h,t,0.004),steel);
    back.position.set(0,h/2,-d/2+t/2);
    g.add(back);

    var front=mesh(rbox(w,0.045,t,0.004),steel);
    front.position.set(0,0.0225,d/2-t/2);
    g.add(front);

    for(var sx=-1;sx<=1;sx+=2){
      var sideWall=mesh(rbox(t,h,d,0.004),steel);
      sideWall.position.set(sx*(w/2-t/2),h/2,0);
      g.add(sideWall);
    }

    /* Tapa cerrada: evita intersecciones visuales con el escritorio */
    var lid=mesh(rbox(w,t,d*0.96,0.004),lidM);
    lid.position.set(0,h+t/2,-0.002);
    g.add(lid);

    /* Soportes superiores que conectan la bandeja al tablero */
    for(var bx=-1;bx<=1;bx+=2){
      var stem=mesh(rbox(0.025,0.055,0.035,0.005),bracketM);
      stem.position.set(bx*0.145,h+0.032,-0.035);
      g.add(stem);

      var plate=mesh(rbox(0.085,0.010,0.070,0.005),bracketM);
      plate.position.set(bx*0.145,h+0.064,-0.035);
      g.add(plate);
    }

    /* Cables internos discretos */
    for(var c=0;c<3;c++){
      var cyl=mesh(new THREE.CylinderGeometry(0.004,0.004,0.11,8),cableM);
      cyl.position.set(-0.10+c*0.10,0.064,0.010);
      cyl.rotation.x=rad(76);
      g.add(cyl);
    }

    return g;
  }

  /* pGlow — Lampara/barra de luz LED para monitor (se apoya sobre la pantalla) */
  function bLightbar(){ var g=new THREE.Group(); var dk=mat(COL.barDark,{r:0.5,m:0.3});
    var bar=mesh(rbox(0.44,0.028,0.05,0.01),dk); g.add(bar);
    var glow=box(0.40,0.010,0.028,mat(0x0c0f12,{e:COL.warmLight,ei:1.5})); glow.position.set(0,-0.016,0.008); g.add(glow);
    var arm=mesh(rbox(0.03,0.05,0.02,0.006),dk); arm.position.set(0,-0.03,-0.032); g.add(arm);
    var weight=mesh(rbox(0.10,0.03,0.05,0.008),dk); weight.position.set(0,-0.06,-0.06); g.add(weight);
    return g; }

  /* =====================================================================
     REGISTRO de productos: id 'dsi-*' -> { name, build, model, scale, position, rotation }
     ===================================================================== */
  var REGISTRY={
    'dsi-monitor-arm':   { name:'pArm',       build:bMonArm,   model:null, glb:'assets/models/products/pArm.glb',       scale:1, position:null, rotation:null },
    'dsi-monitor-stand': { name:'pStandard',  build:bMonStand, model:null, glb:'assets/models/products/pStandard.glb',  scale:1, position:null, rotation:null },
    'dsi-stand':         { name:'pNotebook',  build:bStand,    model:null, glb:'assets/models/products/pNotebook.glb',  scale:1, position:null, rotation:null },
    'dsi-mousepad':      { name:'pMat',       build:bMousepad, model:null, glb:'assets/models/products/pMat.glb',       scale:1, position:null, rotation:null },
    'dsi-hub':           { name:'pHub',       build:bHub,      model:null, glb:'assets/models/products/pHub.glb',       scale:1, position:null, rotation:null },
    'dsi-organizer':     { name:'pBox',       build:bCableBox, model:null, glb:'assets/models/products/pBox.glb',       scale:1, position:null, rotation:null },
    'dsi-lightbar':      { name:'pGlow',      build:bLightbar, model:null, glb:'assets/models/products/pGlow.glb',      scale:1, position:null, rotation:null },
    'dsi-keyboard':      { name:'pMechanic',  build:bKeyboard, model:null, glb:'assets/models/products/pMechanic.glb',  scale:1, position:null, rotation:null },
    'dsi-mouse':         { name:'pMouseProV', build:bMouse,    model:null, glb:'assets/models/products/pMouseProV.glb', scale:1, position:null, rotation:null },
    /* contextuales genericos (no son productos del catalogo a modelar) */
    'dsi-monitor':       { name:'monitor (contextual)',  build:bMonitor, model:null },
    'dsi-laptop':        { name:'notebook (contextual)', build:bLaptop,  model:null },
    'dsi-chair':         { name:'silla (contextual)',    build:bChair,   model:null }
  };

  /* =====================================================================
     HOME — POSICIÓN PREDETERMINADA de cada objeto (fuente de verdad única).
     Coordenadas relativas a la superficie del escritorio (top en y=0),
     salvo la silla que vive en el piso (mundo). ry/rx en radianes.
     Los apoyos dependientes (monitor sobre soporte, lightbar sobre monitor,
     teclado/mouse sobre el pad, notebook sobre el elevador) los resuelve
     computeHome() para que TODO quede coherente y apoyado.
     ===================================================================== */
  var HOME={
    'dsi-monitor':       {x: 0.00, y: 0.30,  z:-0.18, rx:0, ry:0},
    'dsi-monitor-stand': {x: 0.00, y: 0.00,  z:-0.18, rx:0, ry:0},
    'dsi-monitor-arm':   {x: 0.00, y: 0.00,  z:-0.18, rx:0, ry:0},
    'dsi-laptop':        {x:-0.46, y: 0.00,  z: 0.05, rx:0, ry:0.16},
    'dsi-stand':         {x:-0.46, y: 0.00,  z: 0.05, rx:0, ry:0.16},
    'dsi-keyboard':      {x:-0.02, y: 0.00,  z: 0.15, rx:0, ry:0},
    'dsi-mousepad':      {x: 0.03, y: 0.00,  z: 0.12, rx:0, ry:0},
    'dsi-mouse':         {x: 0.30, y: 0.00,  z: 0.20, rx:0, ry:0},    
    'dsi-hub':           {x: 0.52, y: 0.00,  z:-0.05, rx:0, ry:0},
    'dsi-organizer':     {x: 0.00, y:-0.215, z:-0.17, rx:0, ry:0},
    'dsi-lightbar':      {x: 0.00, y: 0.50,  z:-0.12, rx:0, ry:0},
    'dsi-chair':         {x: 0.00, y: 0.00,  z: 0.95, rx:0, ry:0}
  };

  function isVisible(id){ return objects[id] && objects[id].visible; }

  /* Resuelve la posición/rotación canónica de un objeto según el contexto
     actual de visibilidad (apoyos dependientes). */
  function computeHome(id){
    var b=HOME[id]||{x:0,y:0,z:0,rx:0,ry:0};
    var x=b.x, y=b.y, z=b.z, rx=b.rx||0, ry=b.ry||0;

    if(id==='dsi-monitor'){
      var arm=isVisible('dsi-monitor-arm'), stand=isVisible('dsi-monitor-stand');
      y = arm ? 0.44 : (stand ? 0.30 : 0.19);
    } else if(id==='dsi-lightbar'){
      var t=computeHome('dsi-monitor');
      x=t.x; y=t.y+0.18+0.02; z=t.z+0.05;   /* apoyada sobre el borde superior del monitor */
    } else if(id==='dsi-laptop'){
      var onStand=isVisible('dsi-stand');
      /* Notebook y pNotebook deben compartir la MISMA inclinación.
         Antes estaban inclinados en sentidos opuestos y se atravesaban. */
      y = onStand ? 0.124 : 0.0;
      rx = onStand ? rad(13) : 0;
    } else if(id==='dsi-keyboard'){
      y = isVisible('dsi-mousepad') ? 0.013 : 0.0;   /* sobre el pad si está */
    } else if(id==='dsi-mouse'){
      y = isVisible('dsi-mousepad') ? 0.010 : 0.0;
    }
    return {x:x,y:y,z:z,rx:rx,ry:ry};
  }

  /* Coloca TODOS los objetos en su posición predeterminada.
     instant=true -> inmediato (cambios de carrito); false -> animado (reiniciar). */
  function placeAll(animated){
    var anim = animated && !reduce && running;
    DSI.forEach(function(id){
      var h=objects[id]; if(!h) return;
      var t=computeHome(id);
      if(!anim){
        h.position.set(t.x,t.y,t.z); h.rotation.x=t.rx; h.rotation.y=t.ry;
      } else {
        var p0=h.position.clone(), rx0=h.rotation.x, ry0=h.rotation.y;
        (function(node,from,frx,fry,to){
          addTween(640,function(e){
            node.position.set(lerp(from.x,to.x,e),lerp(from.y,to.y,e),lerp(from.z,to.z,e));
            node.rotation.x=lerp(frx,to.rx,e);
            node.rotation.y=lerp(fry,to.ry,e);
          });
        })(h,p0,rx0,ry0,t);
      }
    });
    if(!anim) render1();
  }

  function applyVisible(vis){
    vis=Object.assign({},vis||{});

    /* Mantener coherencia sin inventar productos:
       - El monitor solo aparece si fue seleccionado desde el carrito.
       - pArm y pStandard son alternativas; si pArm está activo se oculta
         pStandard para evitar superposición.
       - pGlow solo se renderiza si también está activo un monitor.
       - pNotebook conserva la notebook contextual para poder visualizar
         el soporte elevador. */
    if(vis['dsi-monitor-arm']){
      vis['dsi-monitor-stand']=false;
    }
    if(!vis['dsi-monitor']){
      vis['dsi-lightbar']=false;
    }
    if(vis['dsi-stand']){
      vis['dsi-laptop']=true;
    }

    DSI.forEach(function(id){ if(objects[id]) objects[id].visible=!!vis[id]; });
    placeAll(false);
  }

  function buildScene(){
    var w=host.clientWidth||520, h=host.clientHeight||390;
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setSize(w,h,false); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    if('outputColorSpace' in renderer) renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
    host.appendChild(renderer.domElement);

    scene=new THREE.Scene(); scene.fog=new THREE.Fog(0x0f172a,6,15);

    /* Entorno de reflejos (acabado moderno sobre aluminio/acero/plásticos) */
    if(RoomEnv){
      try{
        var pmrem=new THREE.PMREMGenerator(renderer);
        scene.environment=pmrem.fromScene(new RoomEnv(),0.04).texture;
      }catch(e){ /* sin entorno: materiales siguen viéndose bien */ }
    }

    camera=new THREE.PerspectiveCamera(42,w/h,0.1,100);
    controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;
    controls.dampingFactor=0.08;
    controls.enablePan=false;

    /* Zoom y rotación libres dentro de límites razonables */
    controls.enableZoom=true;
    controls.zoomSpeed=0.90;

    controls.enableRotate=true;
    controls.rotateSpeed=0.78;

    controls.minDistance=1.10;
    controls.maxDistance=6.50;

    controls.minPolarAngle=rad(8);
    controls.maxPolarAngle=rad(88);

    /* Mapeo explícito para evitar comportamientos inconsistentes */
    controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE=THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;

    controls.touches.ONE=THREE.TOUCH.ROTATE;
    controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;

    scene.add(new THREE.HemisphereLight(0xbfe3ff,0x0a1424,1.15));
    scene.add(new THREE.AmbientLight(0x6f93b5,0.42));
    var key=new THREE.DirectionalLight(0xffffff,2.5); key.position.set(2.6,4.2,2.4); key.castShadow=true;
    key.shadow.mapSize.set(2048,2048); key.shadow.bias=-0.0004; key.shadow.normalBias=0.02;
    var sc=key.shadow.camera; sc.near=0.5; sc.far=14; sc.left=-2.4; sc.right=2.4; sc.top=2.4; sc.bottom=-2.4; sc.updateProjectionMatrix();
    scene.add(key);
    var rim=new THREE.DirectionalLight(0x9fd8ff,0.7); rim.position.set(-3,2.4,-2.5); scene.add(rim);
    var fill=new THREE.DirectionalLight(0xffd9a8,0.35); fill.position.set(-1.4,1.6,3.0); scene.add(fill);

    var floor=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.ShadowMaterial({opacity:0.26}));
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

    surfaceAnchor=new THREE.Object3D(); surfaceAnchor.position.y=curTopY; scene.add(surfaceAnchor);
    deskTop=mesh(rbox(1.5,0.04,0.72,0.012),mat(COL.surface,{r:0.6,m:0.04})); deskTop.position.y=-0.02; surfaceAnchor.add(deskTop);
    var edge=mesh(rbox(1.52,0.012,0.74,0.012),mat(COL.edge,{r:0.7})); edge.position.y=-0.045; edge.castShadow=false; surfaceAnchor.add(edge);
    var beam=box(1.18,0.05,0.07,mat(COL.frame,{m:0.6,r:0.4})); beam.position.set(0,-0.10,-0.22); surfaceAnchor.add(beam);
    var ctrl=mesh(rbox(0.11,0.022,0.055,0.006),mat(COL.frameDark,{m:0.4,r:0.5})); ctrl.position.set(0.5,-0.07,0.3); surfaceAnchor.add(ctrl);
    var b1=box(0.014,0.006,0.014,mat(COL.accent,{e:COL.accent,ei:0.5})); b1.position.set(0.476,-0.057,0.3); surfaceAnchor.add(b1);
    var b2=box(0.014,0.006,0.014,mat(0x222a34)); b2.position.set(0.5,-0.057,0.3); surfaceAnchor.add(b2);

    legL=makeLeg(); legR=makeLeg(); scene.add(legL,legR); setLegs();

    DSI.forEach(function(id){
      var cfg=REGISTRY[id]; if(!cfg) return;
      var holder=new THREE.Group();
      holder.name=id; holder.userData.dsiId=id;
      var proc=cfg.build(); holder.add(proc); holder.userData.proc=proc; holder.userData.isModel=false;
      holder.visible=false; objects[id]=holder;
      if(id==='dsi-chair'){ scene.add(holder); }
      else { surfaceAnchor.add(holder); }
    });

    ready=true;
    placeAll(false);
    setupDrag();
    setView('perspectiva',false);
    var ro=new ResizeObserver(function(){ var cw=host.clientWidth,ch=host.clientHeight; if(cw&&ch){ renderer.setSize(cw,ch,false); camera.aspect=cw/ch; camera.updateProjectionMatrix(); } });
    ro.observe(host);

    var vis=new IntersectionObserver(function(en){ if(en[0].isIntersecting){ running=true; renderer.setAnimationLoop(loop); } else { running=false; renderer.setAnimationLoop(null); } },{threshold:0.01});
    vis.observe(stageEl);

    refreshFromDOM();
    kickModelLoads();
  }

  /* Columna telescopica de escritorio (segmento inferior fijo + superior deslizante) */
  function makeLeg(){
    var g=new THREE.Group();
    var dk=mat(COL.frame,{m:0.6,r:0.4}), ft=mat(COL.frameDark,{m:0.5,r:0.5});
    var foot=mesh(rbox(0.10,0.035,0.50,0.01),ft); foot.position.y=0.0175; g.add(foot);
    var lower=mesh(rbox(0.085,1,0.085,0.012),dk); g.userData.lower=lower; g.add(lower);
    var upper=mesh(rbox(0.062,1,0.062,0.01),dk); g.userData.upper=upper; g.add(upper);
    return g;
  }
  function setLegs(){
    var colH=Math.max(0.30,curTopY-0.04), xx=0.62, lowerH=0.40;
    [legL,legR].forEach(function(L,i){
      L.position.set(i===0?-xx:xx,0,0);
      var lo=L.userData.lower, up=L.userData.upper;
      lo.scale.y=lowerH; lo.position.y=0.02+lowerH/2;
      var upH=Math.max(0.05,colH-lowerH); up.scale.y=upH; up.position.y=0.02+lowerH+upH/2;
    });
  }

  function setDeskMode(standing,animated){
    var target=standing?DESK_STAND:DESK_SIT; if(target===curTopY)return;
    var from=curTopY;
    addTween(animated&&!reduce?700:0,function(e){ curTopY=lerp(from,target,e); if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); if(controls)controls.target.y=curTopY*0.55; },function(){ if(controls)controls.update(); });
    if(reduce||!animated){ curTopY=target; if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); }
  }

  /* ---- camara ---- */
  function viewSpec(v){ var y=curTopY;
    if(v==='frontal') return {p:new THREE.Vector3(0,y+0.30,2.55),t:new THREE.Vector3(0,y*0.58,0)};
    if(v==='superior') return {p:new THREE.Vector3(0.001,y+2.75,0.22),t:new THREE.Vector3(0,y*0.10,-0.05)};
    return {p:new THREE.Vector3(1.95,y+0.82,2.05),t:new THREE.Vector3(0,y*0.52,0)};
  }
  function setView(v,animated){
  if(!ready)return; var s=viewSpec(v);
  /* Cancelar cualquier interpolación pendiente al elegir una vista */
  zoomTarget=null;
    if(reduce||!animated){ camera.position.copy(s.p); controls.target.copy(s.t); controls.update(); highlight(v); return; }
    camFly=true; controls.enabled=false; var p0=camera.position.clone(), t0=controls.target.clone();
    addTween(800,function(e){ camera.position.lerpVectors(p0,s.p,e); controls.target.lerpVectors(t0,s.t,e); camera.lookAt(controls.target); },function(){ camFly=false; controls.enabled=true; controls.update(); });
    highlight(v);
  }
  function highlight(v){ if(!toolbar)return; var hv=v==='reset'?'perspectiva':v; toolbar.querySelectorAll('[data-view]').forEach(function(b){ var on=b.getAttribute('data-view')===hv; b.classList.toggle('is-active',on); b.setAttribute('aria-pressed',on?'true':'false'); }); }

  function loop(){
    var now=performance.now();

    stepTweens(now);

    if(!camFly && controls && !dragObj){
      controls.update();
      stepSmoothZoom();
    }

    renderer.render(scene,camera);
  }  
  function render1(){ if(renderer&&scene&&camera) renderer.render(scene,camera); }

  /* =====================================================================
     MODO LIBRE — arrastrar objetos sobre la superficie (raycasting + plano)
     ===================================================================== */
  var freeMode=false, dragObj=null, raycaster=null, ndc=null, dragPlane=null, dragOffset=null, freeBtn=null;
  /* Zoom suave y continuo:
   normaliza la rueda para evitar saltos bruscos al mínimo o máximo. */
var zoomTarget=null;

function cameraDistance(){
  return (camera && controls)
    ? camera.position.distanceTo(controls.target)
    : 0;
}

function onWheelZoom(ev){
  if(!ready || !camera || !controls || camFly) return;

  ev.preventDefault();
  ev.stopImmediatePropagation();

  var delta=ev.deltaY;

  /* Normalización entre mouse tradicional, touchpad y navegadores */
  if(ev.deltaMode===1) delta*=16;
  else if(ev.deltaMode===2) delta*=window.innerHeight;

  /* Un gesto nunca debe disparar un salto gigante */
  delta=clampN(delta,-120,120);

  var base=zoomTarget!=null
    ? zoomTarget
    : cameraDistance();

  zoomTarget=clampN(
    base*Math.exp(delta*0.0012),
    0.95,
    7.50
  );
}

function stepSmoothZoom(){
  if(zoomTarget==null || !camera || !controls) return;

  var offset=camera.position.clone().sub(controls.target);
  var dist=offset.length();

  if(dist<0.0001){
    zoomTarget=null;
    return;
  }

  var next=lerp(dist,zoomTarget,0.18);

  camera.position
    .copy(controls.target)
    .add(offset.multiplyScalar(next/dist));

  if(Math.abs(next-zoomTarget)<0.002){
    zoomTarget=null;
  }
}
  function setupDrag(){
    raycaster=new THREE.Raycaster();
    ndc=new THREE.Vector2();
    dragPlane=new THREE.Plane();
    dragOffset=new THREE.Vector3();
    var el=renderer.domElement;
    el.addEventListener('pointerdown', onPointerDown, true);   /* captura: antes que OrbitControls */
    el.addEventListener('wheel', onWheelZoom, {
    capture:true,
    passive:false
  });

    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    el.addEventListener('pointermove', onHover);
  }
  function ndcFrom(ev){
    var r=renderer.domElement.getBoundingClientRect();
    ndc.x=((ev.clientX-r.left)/r.width)*2-1;
    ndc.y=-((ev.clientY-r.top)/r.height)*2+1;
  }
  function visibleHolders(){
    var out=[]; DSI.forEach(function(id){ var o=objects[id]; if(o&&o.visible) out.push(o); }); return out;
  }
  function topHolder(o){ while(o){ if(o.userData && o.userData.dsiId) return o; o=o.parent; } return null; }
  function pickHolder(ev){
    ndcFrom(ev); raycaster.setFromCamera(ndc,camera);
    var hits=raycaster.intersectObjects(visibleHolders(),true);
    if(!hits.length) return null;
    return { holder: topHolder(hits[0].object), point: hits[0].point };
  }
  /* límites coherentes por objeto (espacio local del padre) */
  function clampLocal(h,local){
    if(h.userData.dsiId==='dsi-chair'){ local.x=clampN(local.x,-0.62,0.62); local.z=clampN(local.z,0.5,1.55); }
    else { local.x=clampN(local.x,-0.66,0.66); local.z=clampN(local.z,-0.30,0.30); }
  }
  function onPointerDown(ev){
    if(!freeMode || !ready) return;
    var pick=pickHolder(ev);
    if(!pick || !pick.holder){ return; }   /* clic en vacío -> deja orbitar */
    dragObj=pick.holder;
    controls.enabled=false;
    var wp=new THREE.Vector3(); dragObj.getWorldPosition(wp);
    dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0), wp);
    dragOffset.copy(wp).sub(pick.point);  /* mantener el punto de agarre bajo el cursor */
    renderer.domElement.style.cursor='grabbing';
    ev.preventDefault();
  }
  function onPointerMove(ev){
    if(!dragObj) return;
    ndcFrom(ev); raycaster.setFromCamera(ndc,camera);
    var pt=new THREE.Vector3();
    if(!raycaster.ray.intersectPlane(dragPlane,pt)) return;
    pt.add(dragOffset);
    var parent=dragObj.parent;
    var local=parent.worldToLocal(pt.clone());
    local.y=dragObj.position.y;            /* no se mueve en vertical: queda apoyado */
    clampLocal(dragObj,local);
    dragObj.position.x=local.x; dragObj.position.z=local.z;
    render1();
  }
  function onPointerUp(){
    if(dragObj) dragObj=null;

    /* Recuperación defensiva:
      nunca dejar OrbitControls bloqueado tras finalizar un gesto */
    if(!camFly && controls) controls.enabled=true;

    if(renderer && renderer.domElement){
      renderer.domElement.style.cursor = freeMode ? 'grab' : '';
    }
  }
  function onHover(ev){
    if(!freeMode || dragObj) return;
    var pick=pickHolder(ev);
    renderer.domElement.style.cursor = (pick && pick.holder) ? 'grab' : 'default';
  }

  function setHint(txt){ if(hintEl) hintEl.textContent=txt; }
  function updateFreeUI(){
    if(freeBtn){ freeBtn.classList.toggle('is-active',freeMode); freeBtn.setAttribute('aria-pressed',freeMode?'true':'false'); }
    if(stageEl) stageEl.classList.toggle('is-free',freeMode);
    renderer.domElement.style.cursor = freeMode ? 'grab' : '';
    setHint(freeMode
      ? 'Modo libre · agarrá y arrastrá los objetos · rueda para zoom'
      : 'Arrastra para rotar · rueda o pellizco para acercar');
  }
  function setFree(on){
    freeMode=!!on;

    if(!freeMode) dragObj=null;

    /* Al salir o entrar del modo Libre, OrbitControls debe seguir operativo */
    if(!camFly && controls) controls.enabled=true;

    updateFreeUI();
  }
  function toggleFree(){ setFree(!freeMode); }

  /* REINICIAR — todo vuelve a su posición predeterminada (+ cámara, + modo) */
  function resetPositions(){
    if(!ready) return;
    zoomTarget=null;
    setFree(false);
    placeAll(true);                 /* animado a HOME */
    setView('perspectiva',true);
  }

  /* =====================================================================
     PIPELINE .glb (carga diferida, opcional, con fallback procedural)
     ===================================================================== */
  var _gltfPromise=null;
  function ensureGLTFLoader(){
    if(_gltfPromise) return _gltfPromise;
    _gltfPromise=import('three/addons/loaders/GLTFLoader.js')
      .then(function(m){ return new m.GLTFLoader(); })
      .catch(function(e){ _gltfPromise=null; throw e; });
    return _gltfPromise;
  }
  function applyModel(holder,gltfScene,cfg){
    gltfScene.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    var s=cfg.scale!=null?cfg.scale:1;
    if(typeof s==='number') gltfScene.scale.set(s,s,s); else gltfScene.scale.set(s[0],s[1],s[2]);
    if(cfg.rotation) gltfScene.rotation.set(cfg.rotation[0]||0,cfg.rotation[1]||0,cfg.rotation[2]||0);
    if(cfg.position) gltfScene.position.set(cfg.position[0]||0,cfg.position[1]||0,cfg.position[2]||0);
    if(holder.userData.proc){ holder.remove(holder.userData.proc); }
    holder.add(gltfScene); holder.userData.isModel=true;
  }
  function loadModelFor(id){
    var cfg=REGISTRY[id]; if(!cfg||!cfg.model||cfg._tried) return; cfg._tried=true;
    var holder=objects[id]; if(!holder) return;
    ensureGLTFLoader().then(function(loader){
      loader.load(cfg.model,function(gltf){
        try{ applyModel(holder,gltf.scene,cfg); render1(); }
        catch(e){ console.info('[setup-3d] '+cfg.name+': no se pudo aplicar el .glb, se mantiene procedural.'); }
      },undefined,function(){
        console.info('[setup-3d] '+cfg.name+' ('+id+'): sin .glb disponible, se usa geometria procedural.');
      });
    }).catch(function(){ /* GLTFLoader no disponible: se mantiene procedural */ });
  }
  function kickModelLoads(){
    var ids=Object.keys(REGISTRY).filter(function(id){ return REGISTRY[id].model; });
    if(!ids.length) return;
    var run=function(){ ids.forEach(loadModelFor); };
    if('requestIdleCallback' in window) requestIdleCallback(run,{timeout:2500}); else setTimeout(run,1200);
  }

  /* ---- API publica ---- */
  function refreshFromDOM(){
    if(!ready)return; var vis={}, standing=false;
    DSI.forEach(function(id){ var el=$(id); vis[id]=!!(el && !el.classList.contains('hidden-item')); });
    var sb=$('dsi-standing-badge'); standing=!!(sb && !sb.classList.contains('hidden-item'));
    applyVisible(vis); setDeskMode(standing,false);
  }
  function setVisible(vis,opts){ if(!ready){ pending={vis:vis,opts:opts||{}}; return; } applyVisible(vis||{}); setDeskMode(!!(opts&&opts.standing),true); }
  var pending=null;

  /* ---- arranque diferido ---- */
  function reveal(){
    if(deskScene2D) deskScene2D.style.display='none';
    if(stageEl) stageEl.removeAttribute('hidden');
    if(loaderEl) loaderEl.style.display='none';
    if(toolbar) toolbar.style.display='';
    if(pending){ setVisible(pending.vis,pending.opts); pending=null; }
  }
  function fallback(){
    if(stageEl) stageEl.setAttribute('hidden','');
  }

  function ensureToolbarAction(action,label,title){
    var btn=toolbar.querySelector('[data-action="'+action+'"]');
    if(btn) return btn;

    btn=document.createElement('button');
    btn.type='button';
    btn.className='s3d-cam s3d-action';
    btn.setAttribute('data-action',action);
    btn.setAttribute('aria-pressed','false');
    btn.title=title;
    btn.innerHTML='<span>'+label+'</span>';
    toolbar.appendChild(btn);
    return btn;
  }

  function wireToolbar(){
    if(!toolbar) return;

    /* Compatibilidad con HTML viejo:
       si todavía existe Reset, se elimina para dejar un solo botón Reiniciar. */
    var legacyReset=toolbar.querySelector('[data-view="reset"]');
    if(legacyReset) legacyReset.remove();

    toolbar.querySelectorAll('[data-view]').forEach(function(b){
      b.addEventListener('click',function(){
        setView(b.getAttribute('data-view'),true);
      });
    });

    freeBtn=ensureToolbarAction('libre','Libre','Mover objetos libremente');
    freeBtn.addEventListener('click',toggleFree);

    var rb=ensureToolbarAction('reiniciar','Reiniciar','Reiniciar cámara y objetos');
    rb.addEventListener('click',resetPositions);

    updateFreeUI();
  }

  async function init(){
    if(initStarted)return; initStarted=true;
    host=$('s3dHost'); stageEl=$('s3dStage'); toolbar=$('s3dToolbar'); loaderEl=$('s3dLoader'); deskScene2D=$('desk-scene');
    hintEl=stageEl?stageEl.querySelector('.s3d-hint'):null;
    if(!host||!stageEl){ return; }
    if(!webglOk()){ fallback(); return; }
    try{
      THREE=await import('three');
      OrbitControls=(await import('three/addons/controls/OrbitControls.js')).OrbitControls;
      RoundedBox=(await import('three/addons/geometries/RoundedBoxGeometry.js')).RoundedBoxGeometry;
    }catch(err){ console.warn('[setup-3d] No se pudo cargar Three.js; se usa el preview 2D.',err); fallback(); return; }
    try{ RoomEnv=(await import('three/addons/environments/RoomEnvironment.js')).RoomEnvironment; }catch(e){ RoomEnv=null; }
    try{ buildScene(); reveal(); wireToolbar();
    }catch(err){ console.error('[setup-3d] Error al construir la escena 3D.',err); fallback(); }
  }

  function start(){
    var section=$('test')||$('s3dStage');
    if(!$('s3dStage')) return;
    if('IntersectionObserver' in window && section){
      var io=new IntersectionObserver(function(en,o){ if(en.some(function(e){return e.isIntersecting;})){ o.disconnect(); init(); } },{rootMargin:'400px 0px'});
      io.observe(section);
    } else { init(); }
  }

  window.Setup3D={ setVisible:setVisible, setView:setView, refreshFromDOM:refreshFromDOM, isReady:function(){return ready;}, reset:resetPositions, setFree:setFree };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})(); /* setup-3d ready */
