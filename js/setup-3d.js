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
  var objects = {}, deskTop, deskEdge, deskBeam, deskControl, standingFrame, surfaceAnchor, legL, legR, roomFloor, roomWall, roomBaseboard;
  var deskButtons = [], deskModeStanding = false;
  var DESK_SIT = 0.73, DESK_STAND = 1.08, MAT_TOP = 0.0022, curTopY = DESK_SIT;
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
    pWood:0xc9975d, pWoodEdge:0x9a6338,
    pStandBlack:0x151719, pStandGun:0x252a2d, pStandRail:0x3a3f42,
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
    var blk=mat(0x0e1012,{m:0.42,r:0.48});
    var shell=mat(0x171a1d,{m:0.32,r:0.50});
    var edge=mat(0x08090a,{m:0.36,r:0.62});
    var screwM=mat(0xb7c3cc,{m:0.76,r:0.24});
    var rubber=mat(0x050607,{m:0.18,r:0.70});

    var clampX=0.24, rearZ=-0.18, vesaZ=-0.014;

    function bar3(a,b,w,d,material,radius){
      var dir=new THREE.Vector3().subVectors(b,a);
      var len=dir.length();
      var n=dir.clone().normalize();
      var part=mesh(rbox(w,len,d,radius||0.014),material);
      part.position.copy(a).add(b).multiplyScalar(0.5);
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
      return part;
    }
    function cyl3(a,b,r,material,segments){
      var dir=new THREE.Vector3().subVectors(b,a);
      var len=dir.length();
      var n=dir.clone().normalize();
      var part=mesh(new THREE.CylinderGeometry(r,r,len,segments||16),material);
      part.position.copy(a).add(b).multiplyScalar(0.5);
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
      return part;
    }
    function frontDisk(x,y,z,r,d,material,segments){
      var part=mesh(new THREE.CylinderGeometry(r,r,d,segments||22),material);
      part.rotation.x=Math.PI/2;
      part.position.set(x,y,z);
      return part;
    }
    function sideBar(x,y,z,w,h,d,material,radius){
      var rr=radius||0.006;
      rr=Math.min(rr,Math.min(w,h,d)*0.45);
      var part=mesh(rbox(w,h,d,rr),material);
      part.position.set(x,y,z);
      return part;
    }
    function hinge(p,r){
      var body=frontDisk(p.x,p.y,p.z,r,0.050,blk,24);
      g.add(body);
      var cap=frontDisk(p.x,p.y,p.z+0.026,r*0.62,0.006,edge,20);
      g.add(cap);
      var bolt=frontDisk(p.x,p.y,p.z+0.030,r*0.24,0.004,screwM,14);
      g.add(bolt);
    }
    function armHousing(a,b,w,d,trimCylinderEnd){
      g.add(bar3(a,b,w,d,shell,0.018));
      g.add(bar3(a.clone().add(new THREE.Vector3(0,0.002,0.003)),b.clone().add(new THREE.Vector3(0,0.002,0.003)),w*0.62,d*0.52,blk,0.014));
      g.add(bar3(a.clone().add(new THREE.Vector3(0,-0.016,0.023)),b.clone().add(new THREE.Vector3(0,-0.016,0.023)),0.020,0.018,edge,0.008));

      var cylinderEnd=b.clone();
      if(trimCylinderEnd){
        cylinderEnd.add(new THREE.Vector3().subVectors(a,b).normalize().multiplyScalar(trimCylinderEnd));
      }
      g.add(cyl3(a.clone().add(new THREE.Vector3(0,-0.019,0.026)),cylinderEnd.add(new THREE.Vector3(0,-0.019,0.026)),0.010,blk,16));
    }

    var clampTop=mesh(rbox(0.150,0.026,0.116,0.014),blk);
    clampTop.position.set(clampX,0.013,rearZ);
    g.add(clampTop);

    var topCover=mesh(rbox(0.105,0.016,0.084,0.012),shell);
    topCover.position.set(clampX,0.034,rearZ);
    g.add(topCover);

    var clampBack=mesh(rbox(0.046,0.148,0.034,0.008),blk);
    clampBack.position.set(clampX,-0.054,rearZ-0.052);
    g.add(clampBack);

    for(var side=-1;side<=1;side+=2){
      var cheek=mesh(rbox(0.009,0.122,0.044,0.004),edge);
      cheek.position.set(clampX+side*0.028,-0.058,rearZ-0.034);
      g.add(cheek);
    }

    var clampFoot=mesh(rbox(0.090,0.019,0.058,0.006),rubber);
    clampFoot.position.set(clampX,-0.126,rearZ-0.001);
    g.add(clampFoot);

    var screw=mesh(new THREE.CylinderGeometry(0.007,0.007,0.122,16),screwM);
    screw.position.set(clampX,-0.078,rearZ+0.001);
    g.add(screw);

    var washer=mesh(new THREE.CylinderGeometry(0.022,0.022,0.006,24),screwM);
    washer.position.set(clampX,-0.028,rearZ+0.001);
    g.add(washer);

    var knob=mesh(rbox(0.046,0.020,0.032,0.008),rubber);
    knob.position.set(clampX,-0.154,rearZ+0.001);
    g.add(knob);

    for(var h=0;h<2;h++){
      var clampBolt=frontDisk(clampX,-0.020-h*0.050,rearZ-0.033,0.006,0.004,screwM,12);
      g.add(clampBolt);
    }

    var port=sideBar(clampX-0.040,0.037,rearZ+0.050,0.020,0.004,0.007,edge,0.003);
    g.add(port);
    var button=sideBar(clampX+0.040,0.037,rearZ+0.050,0.014,0.004,0.007,edge,0.003);
    g.add(button);

    var post=mesh(new THREE.CylinderGeometry(0.020,0.022,0.112,22),blk);
    post.position.set(clampX,0.094,rearZ);
    g.add(post);
    var lowerCollar=mesh(new THREE.CylinderGeometry(0.030,0.030,0.020,22),shell);
    lowerCollar.position.set(clampX,0.043,rearZ);
    g.add(lowerCollar);
    var upperCollar=mesh(new THREE.CylinderGeometry(0.028,0.028,0.018,22),shell);
    upperCollar.position.set(clampX,0.151,rearZ);
    g.add(upperCollar);

    var p0=new THREE.Vector3(clampX,0.166,rearZ);
    var p1=new THREE.Vector3(0.176,0.308,-0.092);
    var p2=new THREE.Vector3(0.018,0.448,vesaZ);

    hinge(p0,0.032);
    armHousing(p0,p1,0.050,0.036);
    hinge(p1,0.034);
    armHousing(p1,p2,0.052,0.038,0.030);
    hinge(p2,0.027);

    var tilt=mesh(new THREE.CylinderGeometry(0.018,0.018,0.060,18),blk);
    tilt.rotation.z=Math.PI/2;
    tilt.position.set(0.001,0.444,vesaZ-0.002);
    g.add(tilt);

    var link=bar3(new THREE.Vector3(0.020,0.448,vesaZ-0.001),new THREE.Vector3(0.000,0.438,vesaZ-0.006),0.038,0.026,blk,0.009);
    g.add(link);

    var vesaCore=mesh(rbox(0.070,0.088,0.012,0.010),blk);
    vesaCore.position.set(0,0.438,vesaZ-0.012);
    g.add(vesaCore);

    var vesaDisk=mesh(new THREE.CylinderGeometry(0.030,0.030,0.010,20),shell);
    vesaDisk.rotation.x=Math.PI/2;
    vesaDisk.position.set(0,0.438,vesaZ-0.002);
    g.add(vesaDisk);

    for(var sx=-1;sx<=1;sx+=2)for(var sy=-1;sy<=1;sy+=2){
      var lobe=mesh(new THREE.SphereGeometry(0.018,14,10),blk);
      lobe.scale.set(1.08,1.20,0.34);
      lobe.position.set(sx*0.046,0.438+sy*0.040,vesaZ-0.012);
      g.add(lobe);

      var slot=sideBar(sx*0.038,0.438+sy*0.042,vesaZ-0.004,0.008,0.020,0.003,edge,0.004);
      g.add(slot);

      var screwHead=mesh(new THREE.CylinderGeometry(0.005,0.005,0.004,12),screwM);
      screwHead.rotation.x=Math.PI/2;
      screwHead.position.set(sx*0.043,0.438+sy*0.034,vesaZ+0.000);
      g.add(screwHead);
    }

    var topBite=frontDisk(0,0.491,vesaZ-0.004,0.018,0.003,edge,18);
    g.add(topBite);
    var bottomBite=frontDisk(0,0.385,vesaZ-0.004,0.018,0.003,edge,18);
    g.add(bottomBite);

    return g;
  }
  function joint(x,y,z,r,m){ var s=mesh(new THREE.SphereGeometry(r,12,10),m); s.position.set(x,y,z); return s; }

  /* pNotebook — Soporte ergonomico elevador para notebook (aluminio, inclinado) */
  function bStand(){
    var g=new THREE.Group();
    var black=mat(0x111316,{m:0.22,r:0.46});
    var satin=mat(0x262a2d,{m:0.18,r:0.52});
    var pad=mat(0xb5b8b2,{m:0.04,r:0.82});
    var slotM=mat(0xf1f3f5,{r:0.62,m:0.02});

    function railBetween(a,b,w,d,material,radius){
      var dir=new THREE.Vector3().subVectors(b,a);
      var len=dir.length();
      var n=dir.clone().normalize();
      var part=mesh(rbox(w,len,d,radius||0.008),material);
      part.position.copy(a).add(b).multiplyScalar(0.5);
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
      return part;
    }

    var baseL=mesh(rbox(0.026,0.010,0.255,0.010),black); baseL.position.set(-0.126,0.005,0); g.add(baseL);
    var baseR=mesh(rbox(0.026,0.010,0.255,0.010),black); baseR.position.set(0.126,0.005,0); g.add(baseR);
    var baseF=mesh(rbox(0.250,0.010,0.024,0.009),black); baseF.position.set(0,0.005,0.112); g.add(baseF);
    var baseB=mesh(rbox(0.250,0.010,0.024,0.009),black); baseB.position.set(0,0.005,-0.112); g.add(baseB);

    for(var sx=-1;sx<=1;sx+=2){
      var rear=mesh(rbox(0.020,0.122,0.025,0.010),black);
      rear.position.set(sx*0.126,0.065,-0.088); g.add(rear);

      var front=mesh(rbox(0.018,0.058,0.022,0.009),black);
      front.position.set(sx*0.126,0.035,0.100); g.add(front);

      var sideTop=railBetween(
        new THREE.Vector3(sx*0.126,0.064,0.104),
        new THREE.Vector3(sx*0.126,0.128,-0.086),
        0.020,0.024,black,0.009
      );
      g.add(sideTop);

      var sideInside=railBetween(
        new THREE.Vector3(sx*0.112,0.063,0.101),
        new THREE.Vector3(sx*0.112,0.124,-0.080),
        0.010,0.014,satin,0.006
      );
      g.add(sideInside);

      var slot=mesh(rbox(0.005,0.040,0.012,0.006),slotM);
      slot.position.set(sx*0.132,0.076,-0.080);
      g.add(slot);

      var rail=railBetween(
        new THREE.Vector3(sx*0.062,0.061,0.108),
        new THREE.Vector3(sx*0.062,0.126,-0.096),
        0.030,0.016,black,0.008
      );
      g.add(rail);

      var railPad=railBetween(
        new THREE.Vector3(sx*0.062,0.066,0.090),
        new THREE.Vector3(sx*0.062,0.121,-0.083),
        0.020,0.004,pad,0.004
      );
      railPad.castShadow=false;
      g.add(railPad);

      var stop=mesh(rbox(0.052,0.016,0.014,0.006),black);
      stop.position.set(sx*0.062,0.058,0.119);
      stop.rotation.x=rad(11);
      g.add(stop);

      var stopFace=mesh(rbox(0.036,0.004,0.010,0.003),satin);
      stopFace.position.set(sx*0.062,0.065,0.116);
      stopFace.rotation.x=rad(11);
      stopFace.castShadow=false;
      g.add(stopFace);
    }

    var rearBrace=mesh(rbox(0.198,0.014,0.020,0.007),black);
    rearBrace.position.set(0,0.126,-0.104);
    rearBrace.rotation.x=rad(11);
    g.add(rearBrace);

    return g;
  }

  /* pMechanic — Teclado mecanico compacto RGB (negro, underglow) */
  function bKeyboard(){
    var g=new THREE.Group();
    var caseM=mat(0x151719,{r:0.48,m:0.18});
    var deckM=mat(0x25282b,{r:0.54,m:0.12});
    var keyM=mat(0x202326,{r:0.62,m:0.03});
    var keyTopM=mat(0x2a2d30,{r:0.68,m:0.02});
    var edgeM=mat(0x0d0f11,{r:0.58,m:0.20});
    var rgb=[0xf43f5e,0xf59e0b,0x84cc16,0x10b981,0x22d3ee,0x6366f1,0xd946ef];
    var U=0.0228, GAP=0.0022, mainLeft=-0.203;

    var base=mesh(rbox(0.426,0.014,0.146,0.007),caseM);
    base.position.y=0.007;
    g.add(base);

    var deck=mesh(rbox(0.416,0.005,0.136,0.006),deckM);
    deck.position.y=0.0155;
    g.add(deck);

    var frontEdge=mesh(rbox(0.418,0.005,0.009,0.004),edgeM);
    frontEdge.position.set(0,0.006,0.069);
    g.add(frontEdge);

    function glowMat(c){ return mat(0x08090a,{e:c,ei:0.32,r:0.72}); }
    function legendMat(c){ return mat(0x35383c,{e:c,ei:0.38,r:0.70}); }

    function addKey(x,z,units,ci,depth){
      var w=U*units-GAP;
      var d=depth||0.0186;
      var under=mesh(rbox(Math.max(0.008,w-0.003),0.0014,d-0.002,0.002),glowMat(rgb[ci%rgb.length]));
      under.position.set(x,0.019,z);
      under.castShadow=false;
      g.add(under);

      var cap=mesh(rbox(w,0.010,d,0.003),keyM);
      cap.position.set(x,0.025,z);
      g.add(cap);

      var top=mesh(rbox(Math.max(0.006,w-0.004),0.0014,d-0.004,0.002),keyTopM);
      top.position.set(x,0.0304,z-0.0007);
      top.castShadow=false;
      g.add(top);

      var markW=Math.min(Math.max(w*0.28,0.004),0.009);
      var legend=box(markW,0.0012,0.0017,legendMat(rgb[ci%rgb.length]));
      legend.position.set(x,0.0313,z-0.002);
      legend.castShadow=false;
      g.add(legend);
    }

    function addRow(z,units,offset){
      var cursor=mainLeft;
      units.forEach(function(unitsWide,i){
        var x=cursor+U*unitsWide/2;
        addKey(x,z,unitsWide,offset+i);
        cursor+=U*unitsWide;
      });
    }

    /* Bloque principal ANSI compacto de 15 unidades. */
    addRow(-0.031,[1,1,1,1,1,1,1,1,1,1,1,1,1,2],0);
    addRow(-0.008,[1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5],1);
    addRow(0.015,[1.75,1,1,1,1,1,1,1,1,1,1,1,2.25],2);
    addRow(0.038,[2.25,1,1,1,1,1,1,1,1,1,1,2.75],3);
    addRow(0.061,[1.25,1.25,1.25,6.25,1.25,1.25,1.25,1.25],4);

    /* Fila de funciones con separaciones reales entre grupos. */
    addKey(-0.192,-0.055,1,0,0.0165);
    [-0.151,-0.127,-0.103,-0.079,-0.043,-0.019,0.005,0.029,0.065,0.089,0.113,0.137].forEach(function(x,i){
      addKey(x,-0.055,0.86,i+1,0.0165);
    });

    /* Navegacion de tres columnas y bloque de flechas independiente. */
    var navX=[0.153,0.177,0.201];
    [-0.055,-0.031,-0.008].forEach(function(z,row){
      navX.forEach(function(x,col){ addKey(x,z,0.92,5+row*3+col,z===-0.055?0.0165:0.0186); });
    });
    addKey(0.177,0.038,0.92,4);
    addKey(0.153,0.061,0.92,5);
    addKey(0.177,0.061,0.92,6);
    addKey(0.201,0.061,0.92,0);

    /* Espaciadora oficial ancha con indicador central discreto. */
    var spaceIndicator=box(0.020,0.0013,0.0018,legendMat(0x22c55e));
    spaceIndicator.position.set(-0.003,0.0315,0.058);
    spaceIndicator.castShadow=false;
    g.add(spaceIndicator);

    /* Sector derecho libre con marca e indicadores de estado. */
    var brandA=box(0.003,0.0012,0.012,mat(0xb8bec5,{r:0.66,m:0.04}));
    brandA.position.set(0.161,0.019,0.017);
    brandA.castShadow=false;
    g.add(brandA);
    var brandB=box(0.018,0.0012,0.002,mat(0x7f8790,{r:0.68,m:0.04}));
    brandB.position.set(0.174,0.019,0.022);
    brandB.castShadow=false;
    g.add(brandB);

    for(var led=0;led<3;led++){
      var indicator=box(0.007,0.0014,0.0022,legendMat(led===0?0x22c55e:0x94a3b8));
      indicator.position.set(0.197,0.019,0.010+led*0.006);
      indicator.castShadow=false;
      g.add(indicator);
    }

    return g;
  }

  /* pMouseProV — mouse vertical ergonomico, variante oficial negra */
  function bMouse(){
    var g=new THREE.Group();

    function roundedRect(ctx,x,y,w,h,r){
      var rr=Math.min(r,w/2,h/2);
      ctx.beginPath();
      ctx.moveTo(x+rr,y);
      ctx.lineTo(x+w-rr,y);
      ctx.quadraticCurveTo(x+w,y,x+w,y+rr);
      ctx.lineTo(x+w,y+h-rr);
      ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
      ctx.lineTo(x+rr,y+h);
      ctx.quadraticCurveTo(x,y+h,x,y+h-rr);
      ctx.lineTo(x,y+rr);
      ctx.quadraticCurveTo(x,y,x+rr,y);
      ctx.closePath();
    }

    function canvasTexture(canvas,isColor){
      var tex=new THREE.CanvasTexture(canvas);
      tex.wrapS=THREE.ClampToEdgeWrapping;
      tex.wrapT=THREE.ClampToEdgeWrapping;
      if(isColor && 'colorSpace' in tex) tex.colorSpace=THREE.SRGBColorSpace;
      return tex;
    }

    function makeShellMaps(){
      var colorCanvas=document.createElement('canvas');
      var bumpCanvas=document.createElement('canvas');
      var roughCanvas=document.createElement('canvas');
      colorCanvas.width=colorCanvas.height=256;
      bumpCanvas.width=bumpCanvas.height=256;
      roughCanvas.width=roughCanvas.height=256;
      var color=colorCanvas.getContext('2d');
      var bump=bumpCanvas.getContext('2d');
      var rough=roughCanvas.getContext('2d');

      color.fillStyle='#111315'; color.fillRect(0,0,256,256);
      bump.fillStyle='#808080'; bump.fillRect(0,0,256,256);
      rough.fillStyle='#c8c8c8'; rough.fillRect(0,0,256,256);

      /* Nervaduras moldeadas en la zona de apoyo, no geometria agregada. */
      color.strokeStyle='#1d2022';
      bump.strokeStyle='#969696';
      rough.strokeStyle='#e0e0e0';
      color.lineWidth=1.2; bump.lineWidth=1.5; rough.lineWidth=2;
      for(var r=0;r<9;r++){
        color.beginPath(); color.ellipse(128,140,114-r*6.4,124-r*7,0,0,Math.PI*2); color.stroke();
        bump.beginPath(); bump.ellipse(128,140,114-r*6.4,124-r*7,0,0,Math.PI*2); bump.stroke();
        rough.beginPath(); rough.ellipse(128,140,114-r*6.4,124-r*7,0,0,Math.PI*2); rough.stroke();
      }

      /* Riel, ranura de rueda y boton central impresos sobre la carcasa. */
      roundedRect(color,43,46,42,142,18); color.fillStyle='#1b1d1f'; color.fill();
      roundedRect(rough,43,46,42,142,18); rough.fillStyle='#707070'; rough.fill();
      roundedRect(color,94,41,34,49,12); color.fillStyle='#050607'; color.fill();
      roundedRect(bump,94,41,34,49,12); bump.fillStyle='#696969'; bump.fill();
      roundedRect(color,97,101,27,30,10); color.fillStyle='#17191b'; color.fill();
      roundedRect(rough,97,101,27,30,10); rough.fillStyle='#858585'; rough.fill();

      /* Juntas de los botones principales, hundidas en el acabado. */
      color.strokeStyle='#050607'; bump.strokeStyle='#6a6a6a';
      color.lineWidth=3; bump.lineWidth=3;
      color.beginPath(); color.moveTo(136,22); color.bezierCurveTo(137,68,140,111,143,184); color.stroke();
      bump.beginPath(); bump.moveTo(136,22); bump.bezierCurveTo(137,68,140,111,143,184); bump.stroke();
      color.beginPath(); color.moveTo(55,182); color.bezierCurveTo(109,187,161,181,214,166); color.stroke();
      bump.beginPath(); bump.moveTo(55,182); bump.bezierCurveTo(109,187,161,181,214,166); bump.stroke();

      /* Botones laterales enrasados, visibles como cambio de acabado. */
      roundedRect(color,5,102,15,40,7); color.fillStyle='#1b1d1f'; color.fill();
      roundedRect(color,5,150,15,36,7); color.fillStyle='#1b1d1f'; color.fill();
      roundedRect(rough,5,102,15,40,7); rough.fillStyle='#828282'; rough.fill();
      roundedRect(rough,5,150,15,36,7); rough.fillStyle='#828282'; rough.fill();

      return {
        color:canvasTexture(colorCanvas,true),
        bump:canvasTexture(bumpCanvas,false),
        rough:canvasTexture(roughCanvas,false)
      };
    }

    function makeShellGeometry(){
      var segments=48, rings=14;
      var positions=[], uvs=[], indices=[];
      var halfW=0.048, halfL=0.066;

      positions.push(-0.014,0.082,0.006);
      uvs.push(0.35,0.55);

      for(var ring=1;ring<=rings;ring++){
        var rr=ring/rings;
        var profile=Math.pow(Math.max(0,1-Math.pow(rr,1.62)),0.82);
        for(var i=0;i<segments;i++){
          var a=i/segments*Math.PI*2;
          var ca=Math.cos(a), sa=Math.sin(a);
          var z=sa*halfL*rr;
          var rear=(z/halfL+1)*0.5;
          var widthScale=0.82+rear*0.18;
          var x=ca*halfW*widthScale*rr-0.014*Math.pow(1-rr,1.1);
          var sideFall=0.91+0.09*(1-ca)*0.5;
          var endFall=0.94+0.06*(1+sa)*0.5;
          var y=0.004+0.078*profile*sideFall*endFall;
          positions.push(x,y,z);
          uvs.push(0.5+x/(halfW*2.05),0.5+z/(halfL*2.05));
        }
      }

      for(var c=0;c<segments;c++){
        indices.push(0,1+(c+1)%segments,1+c);
      }
      for(var row=1;row<rings;row++){
        var inner=1+(row-1)*segments;
        var outer=1+row*segments;
        for(var col=0;col<segments;col++){
          var next=(col+1)%segments;
          indices.push(inner+col,inner+next,outer+col);
          indices.push(inner+next,outer+next,outer+col);
        }
      }

      var topEdge=1+(rings-1)*segments;
      var bottomEdge=positions.length/3;
      for(var edge=0;edge<segments;edge++){
        var px=positions[(topEdge+edge)*3];
        var pz=positions[(topEdge+edge)*3+2];
        positions.push(px,0,pz);
        uvs.push(0.5+px/(halfW*2.05),0.5+pz/(halfL*2.05));
      }
      for(var side=0;side<segments;side++){
        var sn=(side+1)%segments;
        indices.push(topEdge+side,topEdge+sn,bottomEdge+side);
        indices.push(topEdge+sn,bottomEdge+sn,bottomEdge+side);
      }

      var bottomCenter=positions.length/3;
      positions.push(0,0,0.004);
      uvs.push(0.5,0.53);
      for(var base=0;base<segments;base++){
        indices.push(bottomCenter,bottomEdge+base,bottomEdge+(base+1)%segments);
      }

      var geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      return geo;
    }

    var shellMaps=makeShellMaps();
    var shellM=new THREE.MeshStandardMaterial({
      color:0xffffff,
      metalness:0.08,
      roughness:0.62,
      map:shellMaps.color,
      bumpMap:shellMaps.bump,
      bumpScale:0.00075,
      roughnessMap:shellMaps.rough
    });
    var body=mesh(makeShellGeometry(),shellM);
    g.add(body);

    return g;
  }

  /* pHub — Adaptador Hub USB-C multifuncional 7 en 1 (aluminio, puertos + LED) */
  function bHub(){
    var g=new THREE.Group();
    var spaceGray=mat(0x6f747a,{m:0.58,r:0.40});
    var edgeM=mat(0x34383d,{m:0.34,r:0.54});
    var portM=mat(0x090b0d,{m:0.04,r:0.72});
    var usbBlue=mat(0x276b8f,{m:0.08,r:0.55});
    var cableM=mat(0x202429,{m:0.02,r:0.82});
    var plugM=mat(0x90979d,{m:0.68,r:0.34});
    var w=0.070, h=0.010, d=0.030;

    var body=mesh(rbox(w,h,d,0.003),spaceGray);
    body.position.y=h/2;
    g.add(body);

    /* Tapas ABS discretas: rematan la extrusion sin engrosarla. */
    for(var sx=-1;sx<=1;sx+=2){
      var endCap=mesh(rbox(0.0032,h*0.92,d-0.003,0.0014),edgeM);
      endCap.position.set(sx*(w/2-0.0012),h/2,0);
      g.add(endCap);
    }

    function facePort(x,z,width,height,material){
      var port=mesh(rbox(width,height,0.0012,Math.min(0.0012,height*0.36)),material||portM);
      port.position.set(x,h/2,z);
      port.castShadow=false;
      g.add(port);
      return port;
    }

    /* Frente: dos USB 3.0 y HDMI 4K. */
    [-0.023,-0.008].forEach(function(x){
      facePort(x,d/2+0.00045,0.0115,0.0054,portM);
      var tongue=box(0.0075,0.0012,0.00055,usbBlue);
      tongue.position.set(x,h/2-0.0013,d/2+0.0011);
      tongue.castShadow=false;
      g.add(tongue);
    });

    var hdmiShape=new THREE.Shape();
    hdmiShape.moveTo(-0.0075,-0.0028);
    hdmiShape.lineTo(0.0075,-0.0028);
    hdmiShape.lineTo(0.0062,0.0028);
    hdmiShape.lineTo(-0.0062,0.0028);
    hdmiShape.closePath();
    var hdmi=mesh(new THREE.ShapeGeometry(hdmiShape),portM);
    hdmi.position.set(0.020,h/2,d/2+0.0011);
    hdmi.castShadow=false;
    g.add(hdmi);

    /* Dorso: lectores SD/TF y los dos USB-C oficiales. */
    facePort(-0.021,-d/2-0.00045,0.021,0.0012,portM);
    facePort(-0.002,-d/2-0.00045,0.012,0.0010,portM);
    facePort(0.015,-d/2-0.00045,0.0085,0.0032,portM);
    facePort(0.029,-d/2-0.00045,0.0085,0.0032,portM);

    /* Cable moldeado desde la tapa, con curva y alivio de tension. */
    var cableCurve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-w/2+0.001,h/2,-0.002),
      new THREE.Vector3(-0.047,h/2,-0.003),
      new THREE.Vector3(-0.061,h/2,-0.009),
      new THREE.Vector3(-0.074,h/2,-0.012)
    ]);
    var cable=mesh(new THREE.TubeGeometry(cableCurve,22,0.0018,8,false),cableM);
    cable.castShadow=false;
    g.add(cable);

    var relief=mesh(rbox(0.011,0.0065,0.008,0.0025),cableM);
    relief.position.set(-0.078,h/2,-0.012);
    relief.rotation.y=rad(-4);
    g.add(relief);

    var connector=mesh(rbox(0.010,0.0042,0.0072,0.002),plugM);
    connector.position.set(-0.087,h/2,-0.0126);
    connector.rotation.y=rad(-4);
    g.add(connector);

    var connectorCore=mesh(rbox(0.0058,0.0024,0.0048,0.0012),portM);
    connectorCore.position.set(-0.0921,h/2,-0.0130);
    connectorCore.rotation.y=rad(-4);
    connectorCore.castShadow=false;
    g.add(connectorCore);

    var led=mesh(new THREE.SphereGeometry(0.00125,10,6),mat(0x101820,{e:0x4cc9f0,ei:0.58,r:0.72}));
    led.position.set(0.025,h+0.00035,0.008);
    led.castShadow=false;
    g.add(led);

    g.rotation.y=rad(-10);
    return g;
  }

  /* pMat — Pad XL de cuero ecologico para escritorio (mate, borde cosido) */
  function bMousepad(){
    var g = new THREE.Group();
    var w = 0.72, d = 0.38;

    var grainCanvas=document.createElement('canvas');
    grainCanvas.width=256; grainCanvas.height=128;
    var grain=grainCanvas.getContext('2d');
    grain.fillStyle='#808080';
    grain.fillRect(0,0,256,128);
    grain.strokeStyle='rgba(162,162,162,.42)';
    grain.lineWidth=0.7;
    for(var gy=6;gy<128;gy+=9){
      grain.beginPath();
      for(var gx=0;gx<=256;gx+=16){
        var yy=gy+Math.sin((gx+gy)*0.11)*1.4;
        if(gx===0) grain.moveTo(gx,yy); else grain.lineTo(gx,yy);
      }
      grain.stroke();
    }
    var grainTex=new THREE.CanvasTexture(grainCanvas);
    grainTex.wrapS=THREE.RepeatWrapping;
    grainTex.wrapT=THREE.RepeatWrapping;
    grainTex.repeat.set(3.2,2.1);

    var leatherM=new THREE.MeshStandardMaterial({
      color:COL.mat,
      roughness:0.94,
      metalness:0.01,
      bumpMap:grainTex,
      bumpScale:0.00012
    });
    var pad=mesh(rbox(w,MAT_TOP,d,0.001),leatherM);
    pad.position.y=MAT_TOP/2;
    pad.castShadow=false;
    pad.receiveShadow=true;
    g.add(pad);

    /* Costura de un pixel, al ras y siguiendo las esquinas redondeadas. */
    var stitchPts=[];
    var rx=w/2-0.012, rz=d/2-0.012, corner=0.012;
    for(var i=0;i<72;i++){
      var a=i/72*Math.PI*2;
      var ca=Math.cos(a), sa=Math.sin(a);
      stitchPts.push(new THREE.Vector3(
        (ca<0?-1:1)*(rx-corner)+corner*ca,
        MAT_TOP+0.00018,
        (sa<0?-1:1)*(rz-corner)+corner*sa
      ));
    }
    var stitchGeo=new THREE.BufferGeometry().setFromPoints(stitchPts);
    var stitchM=new THREE.LineBasicMaterial({color:0x596574,transparent:true,opacity:0.62});
    var stitch=new THREE.LineLoop(stitchGeo,stitchM);
    stitch.renderOrder=2;
    g.add(stitch);
    return g;
  }

  /* pBox — Bandeja organizadora de cables de acero.
     Queda completamente debajo del tablero y se conecta mediante dos soportes.
     El origen del grupo se ubica en la base de la bandeja. */
  function bCableBox(){
    var g=new THREE.Group();

    var steel=mat(0x111417,{m:0.48,r:0.50});
    var faceM=mat(0x1b2024,{m:0.42,r:0.54});
    var innerM=mat(0x050607,{m:0.18,r:0.78});
    var edgeM=mat(0x2a3035,{m:0.52,r:0.42});
    var bracketM=mat(0x101317,{m:0.55,r:0.46});
    var cableM=mat(COL.cable,{r:0.64});

    var w=0.56, h=0.108, d=0.142, t=0.008;

    var floor=mesh(rbox(w,t,d+0.050,0.004),steel);
    floor.position.set(0,t/2,0.018);
    g.add(floor);

    var frontLip=mesh(rbox(w+0.018,0.010,t,0.004),edgeM);
    frontLip.position.set(0,0.018,d/2+0.048);
    g.add(frontLip);

    for(var si=0;si<13;si++){
      var slot=mesh(rbox(0.018,0.0016,0.064,0.004),innerM);
      slot.position.set(-0.234+si*0.039,0.0094,0.038);
      slot.rotation.y=rad(si%2 ? -3 : 3);
      slot.castShadow=false;
      g.add(slot);
    }

    var back=mesh(rbox(w,h,t,0.004),faceM);
    back.position.set(0,h/2,-d/2+t/2);
    g.add(back);

    var front=mesh(rbox(w,0.060,t,0.004),faceM);
    front.position.set(0,0.030,d/2-t/2);
    g.add(front);

    for(var sx=-1;sx<=1;sx+=2){
      var sideWall=mesh(rbox(t,h,d,0.004),faceM);
      sideWall.position.set(sx*(w/2-t/2),h/2,0);
      g.add(sideWall);

      var sideWindow=mesh(rbox(0.0014,0.036,0.050,0.006),innerM);
      sideWindow.position.set(sx*(w/2+0.0008),0.052,0.022);
      sideWindow.castShadow=false;
      g.add(sideWindow);
    }

    var topRear=mesh(rbox(w,0.012,0.034,0.004),edgeM);
    topRear.position.set(0,h+0.006,-d/2+0.020);
    g.add(topRear);

    for(var vx=-1;vx<=1;vx+=2){
      var endCap=mesh(rbox(0.014,h+0.012,d,0.004),edgeM);
      endCap.position.set(vx*(w/2-0.007),h/2+0.006,0);
      g.add(endCap);
    }

    function addHorizontalSlot(x,z,ww){
      var s=mesh(rbox(ww,0.018,0.0014,0.006),innerM);
      s.position.set(x,0.055,z);
      s.castShadow=false;
      g.add(s);
    }
    addHorizontalSlot(-0.165,d/2+0.0008,0.142);
    addHorizontalSlot(0.075,d/2+0.0008,0.190);
    addHorizontalSlot(-0.120,-d/2-0.0008,0.190);
    addHorizontalSlot(0.150,-d/2-0.0008,0.210);

    for(var nx=-2;nx<=2;nx++){
      var notch=mesh(rbox(0.016,0.014,0.003,0.004),innerM);
      notch.position.set(nx*0.055,0.018,d/2+0.002);
      notch.castShadow=false;
      g.add(notch);
    }

    var rearInside=mesh(rbox(w-0.055,0.004,0.010,0.002),innerM);
    rearInside.position.set(0,h-0.018,-d/2+0.016);
    rearInside.castShadow=false;
    g.add(rearInside);

    var screwM=mat(0x050607,{m:0.20,r:0.74});
    for(var sx2=-1;sx2<=1;sx2+=2){
      for(var sz2=-1;sz2<=1;sz2+=2){
        var screw=mesh(new THREE.CylinderGeometry(0.004,0.004,0.0014,12),screwM);
        screw.position.set(sx2*(w/2-0.030),h+0.013,sz2*(d/2-0.020));
        screw.castShadow=false;
        g.add(screw);
      }
    }

    for(var bx=-1;bx<=1;bx+=2){
      var stem=mesh(rbox(0.020,0.046,0.030,0.004),bracketM);
      stem.position.set(bx*0.190,h+0.026,-0.032);
      g.add(stem);

      var plate=mesh(rbox(0.096,0.010,0.064,0.004),bracketM);
      plate.position.set(bx*0.190,h+0.054,-0.032);
      g.add(plate);

      var rail=mesh(rbox(0.022,0.010,0.090,0.004),bracketM);
      rail.position.set(bx*0.190,h+0.006,-0.012);
      g.add(rail);
    }

    for(var c=0;c<3;c++){
      var curve=new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.150+c*0.110,0.072,-0.024),
        new THREE.Vector3(-0.120+c*0.105,0.040,0.018),
        new THREE.Vector3(-0.095+c*0.095,0.024,0.060)
      ]);
      var cable=mesh(new THREE.TubeGeometry(curve,16,0.0032,8,false),cableM);
      cable.castShadow=false;
      g.add(cable);
    }

    return g;
  }

  /* pGlow — Lampara/barra de luz LED para monitor (se apoya sobre la pantalla) */
  function bLightbar(){
    var g=new THREE.Group();
    var dk=mat(0x0c0e10,{r:0.48,m:0.34});
    var satin=mat(0x1b1f22,{r:0.54,m:0.26});
    var rubber=mat(0x050607,{r:0.72,m:0.10});
    var lightM=mat(0xfff1d4,{e:COL.warmLight,ei:1.75,r:0.42,m:0.02});

    var bar=mesh(new THREE.CylinderGeometry(0.014,0.014,0.505,28),dk);
    bar.rotation.z=Math.PI/2;
    g.add(bar);

    var lens=mesh(rbox(0.440,0.0045,0.010,0.003),lightM);
    lens.position.set(0,-0.010,0.010);
    lens.castShadow=false;
    g.add(lens);

    for(var ex=-1;ex<=1;ex+=2){
      var cap=mesh(new THREE.CylinderGeometry(0.0145,0.0145,0.006,24),satin);
      cap.rotation.z=Math.PI/2;
      cap.position.set(ex*0.256,0,0);
      g.add(cap);

      var ring=mesh(new THREE.TorusGeometry(0.010,0.0013,8,24),rubber);
      ring.rotation.y=Math.PI/2;
      ring.position.set(ex*0.259,0,0);
      ring.castShadow=false;
      g.add(ring);
    }

    var sleeve=mesh(new THREE.CylinderGeometry(0.0175,0.0175,0.082,28),satin);
    sleeve.rotation.z=Math.PI/2;
    sleeve.position.set(0,0.0005,-0.001);
    g.add(sleeve);

    var usb=mesh(rbox(0.018,0.009,0.003,0.002),rubber);
    usb.position.set(0,0.003,-0.019);
    usb.castShadow=false;
    g.add(usb);

    var shelf=mesh(rbox(0.152,0.010,0.046,0.005),dk);
    shelf.position.set(0,-0.027,-0.032);
    g.add(shelf);

    var pad=mesh(rbox(0.132,0.004,0.020,0.003),rubber);
    pad.position.set(0,-0.033,-0.010);
    pad.castShadow=false;
    g.add(pad);

    var hinge=mesh(new THREE.CylinderGeometry(0.011,0.011,0.070,18),satin);
    hinge.rotation.x=Math.PI/2;
    hinge.position.set(0,-0.041,-0.038);
    g.add(hinge);

    var neck=mesh(rbox(0.034,0.044,0.022,0.008),dk);
    neck.position.set(0,-0.059,-0.047);
    g.add(neck);

    var counter=mesh(rbox(0.066,0.070,0.040,0.018),dk);
    counter.position.set(0,-0.096,-0.058);
    g.add(counter);

    var belly=mesh(new THREE.SphereGeometry(0.032,22,14),dk);
    belly.scale.set(1.02,1.18,0.68);
    belly.position.set(0,-0.112,-0.057);
    g.add(belly);

    var rearPad=mesh(rbox(0.052,0.006,0.034,0.004),rubber);
    rearPad.position.set(0,-0.083,-0.084);
    rearPad.rotation.x=rad(-8);
    rearPad.castShadow=false;
    g.add(rearPad);

    return g;
  }

  /* =====================================================================
     REGISTRO de productos: id 'dsi-*' -> { name, build, model, scale, position, rotation }
     ===================================================================== */
  var REGISTRY={
    'dsi-monitor-arm':   { name:'pArm',       build:bMonArm,   model:null, glb:'assets/models/products/pArm.glb',       scale:1, position:null, rotation:null },
    'dsi-monitor-stand': { name:'pStandard',  build:bMonStand, model:null, glb:'assets/models/products/pStandard.glb',  scale:1, position:null, rotation:null },
    'dsi-stand':         { name:'pNotebook',  build:bStand,    model:null, glb:'assets/models/products/pNotebook.glb',  scale:1, position:null, rotation:null },
    'dsi-mousepad':      { name:'pMat',       build:bMousepad, model:null, glb:'assets/models/products/pMat.glb',       scale:1, position:null, rotation:null },
    'dsi-hub':           { name:'pHub',       build:bHub,      model:null, glb:'assets/models/products/pHub.glb',       scale:1.55, position:null, rotation:null },
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
    'dsi-hub':           {x: 0.53, y: 0.00,  z:-0.035, rx:0, ry:0},
    'dsi-organizer':     {x: 0.00, y:-0.207, z: 0.215, rx:0, ry:0},
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
      x=t.x; y=t.y+0.18+0.036; z=t.z+0.035;   /* apoyada sobre el borde superior del monitor */
    } else if(id==='dsi-laptop'){
      var onStand=isVisible('dsi-stand');
      /* Notebook y pNotebook deben compartir la MISMA inclinación.
         Antes estaban inclinados en sentidos opuestos y se atravesaban. */
      y = onStand ? 0.142 : 0.0;
      rx = onStand ? rad(13) : 0;
    } else if(id==='dsi-keyboard'){
      y = isVisible('dsi-mousepad') ? MAT_TOP : 0.0;
    } else if(id==='dsi-mouse'){
      y = isVisible('dsi-mousepad') ? MAT_TOP : 0.0;
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

  function makeWoodFloorMaterial(){
    var canvas=document.createElement('canvas');
    canvas.width=512; canvas.height=512;
    var ctx=canvas.getContext('2d');
    ctx.fillStyle='#c8ad83';
    ctx.fillRect(0,0,512,512);
    for(var y=0;y<512;y+=64){
      ctx.fillStyle=(y/64)%2 ? 'rgba(255,255,255,.035)' : 'rgba(77,52,30,.028)';
      ctx.fillRect(0,y,512,64);
      ctx.strokeStyle='rgba(92,66,39,.16)';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,y+.5); ctx.lineTo(512,y+.5); ctx.stroke();
      for(var x=((y/64)%2)*78;x<512;x+=156){
        ctx.strokeStyle='rgba(92,66,39,.10)';
        ctx.beginPath(); ctx.moveTo(x+.5,y+8); ctx.lineTo(x+.5,y+56); ctx.stroke();
      }
    }
    ctx.strokeStyle='rgba(255,255,255,.08)';
    for(var yy=18;yy<512;yy+=64){
      ctx.beginPath(); ctx.moveTo(0,yy+.5); ctx.lineTo(512,yy+.5); ctx.stroke();
    }
    var tex=new THREE.CanvasTexture(canvas);
    if('colorSpace' in tex) tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=THREE.RepeatWrapping;
    tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(2.6,2.15);
    return new THREE.MeshStandardMaterial({map:tex,color:0xd0b78b,roughness:0.9,metalness:0});
  }

  function buildAmbientRoom(){
    roomFloor=new THREE.Mesh(new THREE.PlaneGeometry(7.2,7.2),makeWoodFloorMaterial());
    roomFloor.name='s3d-floor-shadow-receiver';
    roomFloor.rotation.x=-Math.PI/2;
    roomFloor.position.set(0,-0.004,1.12);
    roomFloor.receiveShadow=true;
    roomFloor.castShadow=false;
    scene.add(roomFloor);

    var wallMat=new THREE.MeshStandardMaterial({color:0xd8d0bd,roughness:0.96,metalness:0});
    roomWall=new THREE.Mesh(new THREE.PlaneGeometry(5.8,0.44),wallMat);
    roomWall.name='s3d-lower-wall';
    roomWall.position.set(0,0.24,-0.90);
    roomWall.receiveShadow=true;
    roomWall.castShadow=false;
    scene.add(roomWall);

    roomBaseboard=mesh(rbox(5.8,0.055,0.035,0.006),mat(0xc7b99d,{r:0.82,m:0.02}));
    roomBaseboard.name='s3d-baseboard';
    roomBaseboard.position.set(0,0.055,-0.865);
    roomBaseboard.castShadow=false;
    roomBaseboard.receiveShadow=true;
    scene.add(roomBaseboard);
  }

  var _deskWoodMat=null;
  function makeDeskWoodMaterial(){
    if(_deskWoodMat) return _deskWoodMat;
    var canvas=document.createElement('canvas');
    canvas.width=512; canvas.height=256;
    var ctx=canvas.getContext('2d');
    ctx.fillStyle='#c9985f';
    ctx.fillRect(0,0,512,256);
    for(var z=0;z<256;z+=42){
      ctx.fillStyle=(z/42)%2 ? 'rgba(255,238,204,.12)' : 'rgba(91,49,22,.055)';
      ctx.fillRect(0,z,512,42);
      ctx.strokeStyle='rgba(94,57,29,.18)';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,z+.5); ctx.lineTo(512,z+.5); ctx.stroke();
    }
    for(var x=0;x<512;x+=36){
      var wave=Math.sin(x*0.055)*5;
      ctx.strokeStyle='rgba(104,61,29,.09)';
      ctx.beginPath();
      for(var y=0;y<256;y+=12){
        var px=x+Math.sin(y*.06+x*.02)*4+wave;
        if(y===0) ctx.moveTo(px,y); else ctx.lineTo(px,y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle='rgba(255,246,220,.10)';
    for(var hi=18;hi<256;hi+=42){
      ctx.beginPath(); ctx.moveTo(0,hi+.5); ctx.lineTo(512,hi+.5); ctx.stroke();
    }
    var tex=new THREE.CanvasTexture(canvas);
    if('colorSpace' in tex) tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=THREE.RepeatWrapping;
    tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(1.35,1.05);
    _deskWoodMat=new THREE.MeshStandardMaterial({map:tex,color:COL.pWood,roughness:0.78,metalness:0});
    return _deskWoodMat;
  }

  function makeStandingFrame(){
    var g=new THREE.Group();
    var black=mat(COL.pStandBlack,{m:0.62,r:0.34});
    var gun=mat(COL.pStandGun,{m:0.62,r:0.36});
    var rail=mat(COL.pStandRail,{m:0.56,r:0.38});
    var woodEdge=mat(COL.pWoodEdge,{r:0.78,m:0.02});
    var shell=mat(0xe9e2d4,{r:0.62,m:0.06});
    var button=mat(0xe8ecee,{r:0.48,m:0.10});

    var frontEdge=mesh(rbox(1.52,0.026,0.018,0.006),woodEdge);
    frontEdge.position.set(0,-0.044,0.365); frontEdge.castShadow=false; g.add(frontEdge);
    var leftEdge=mesh(rbox(0.018,0.026,0.70,0.006),woodEdge);
    leftEdge.position.set(-0.755,-0.044,0); leftEdge.castShadow=false; g.add(leftEdge);
    var rightEdge=mesh(rbox(0.018,0.026,0.70,0.006),woodEdge);
    rightEdge.position.set(0.755,-0.044,0); rightEdge.castShadow=false; g.add(rightEdge);

    for(var sx=-1;sx<=1;sx+=2){
      var plate=mesh(rbox(0.30,0.018,0.42,0.006),black);
      plate.position.set(sx*0.62,-0.064,-0.020);
      g.add(plate);

      var cap=mesh(rbox(0.15,0.032,0.12,0.008),gun);
      cap.position.set(sx*0.62,-0.095,-0.265);
      g.add(cap);
    }

    var railOuter=mesh(rbox(1.18,0.046,0.052,0.008),gun);
    railOuter.position.set(0,-0.127,-0.315);
    g.add(railOuter);

    var railSleeve=mesh(rbox(0.38,0.056,0.064,0.008),rail);
    railSleeve.position.set(0,-0.126,-0.315);
    g.add(railSleeve);

    var railSeam=box(0.012,0.058,0.068,black);
    railSeam.position.set(0.22,-0.126,-0.315);
    g.add(railSeam);

    var controlBox=mesh(rbox(0.25,0.036,0.095,0.008),black);
    controlBox.position.set(0.16,-0.168,-0.305);
    g.add(controlBox);

    var motor=mesh(new THREE.CylinderGeometry(0.035,0.038,0.23,18),black);
    motor.position.set(0.58,-0.185,-0.270);
    g.add(motor);

    var motorCase=mesh(rbox(0.070,0.180,0.074,0.012),black);
    motorCase.position.set(0.625,-0.170,-0.270);
    g.add(motorCase);

    var cable=mesh(new THREE.CylinderGeometry(0.004,0.004,0.76,8),mat(COL.cable,{r:0.68}));
    cable.rotation.z=Math.PI/2;
    cable.position.set(-0.12,-0.166,-0.348);
    g.add(cable);

    var cableKnob=mesh(new THREE.SphereGeometry(0.014,12,8),black);
    cableKnob.position.set(-0.48,-0.166,-0.348);
    g.add(cableKnob);

    var keypadShell=mesh(rbox(0.150,0.026,0.076,0.008),shell);
    keypadShell.position.set(0.555,-0.079,0.390);
    g.add(keypadShell);

    var keypadFace=mesh(rbox(0.066,0.024,0.006,0.003),black);
    keypadFace.position.set(0.520,-0.079,0.432);
    g.add(keypadFace);

    var display=box(0.018,0.010,0.004,mat(0x0e1114,{e:0x162d36,ei:0.45,r:0.5}));
    display.position.set(0.498,-0.079,0.436);
    g.add(display);

    for(var i=0;i<3;i++){
      var btn=mesh(new THREE.CylinderGeometry(0.0038,0.0038,0.004,10),button);
      btn.rotation.x=Math.PI/2;
      btn.position.set(0.516+i*0.014,-0.079,0.437);
      g.add(btn);
    }

    return g;
  }

  function buildScene(){
    var w=host.clientWidth||520, h=host.clientHeight||390;
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setSize(w,h,false); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    if('outputColorSpace' in renderer) renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
    host.appendChild(renderer.domElement);

    scene=new THREE.Scene();

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

    scene.add(new THREE.HemisphereLight(0xf2fbff,0xd8bf98,1.08));
    scene.add(new THREE.AmbientLight(0xc8d8e5,0.46));
    var key=new THREE.DirectionalLight(0xffffff,1.95); key.position.set(4.8,5.4,2.6); key.castShadow=true;
    key.shadow.mapSize.set(2048,2048); key.shadow.bias=-0.00035; key.shadow.normalBias=0.026; key.shadow.radius=7;
    var sc=key.shadow.camera; sc.near=0.5; sc.far=14; sc.left=-2.8; sc.right=2.8; sc.top=2.8; sc.bottom=-2.8; sc.updateProjectionMatrix();
    scene.add(key);
    var rim=new THREE.DirectionalLight(0x9fd8ff,0.24); rim.position.set(-3,2.1,-2.5); scene.add(rim);
    var fill=new THREE.DirectionalLight(0xffe0b8,0.52); fill.position.set(2.2,2.0,3.4); scene.add(fill);

    buildAmbientRoom();

    surfaceAnchor=new THREE.Object3D(); surfaceAnchor.position.y=curTopY; scene.add(surfaceAnchor);
    deskTop=mesh(rbox(1.5,0.04,0.72,0.012),mat(COL.surface,{r:0.6,m:0.04})); deskTop.position.y=-0.02; surfaceAnchor.add(deskTop);
    deskEdge=mesh(rbox(1.52,0.012,0.74,0.012),mat(COL.edge,{r:0.7})); deskEdge.position.y=-0.045; deskEdge.castShadow=false; surfaceAnchor.add(deskEdge);
    deskBeam=box(1.18,0.05,0.07,mat(COL.frame,{m:0.6,r:0.4})); deskBeam.position.set(0,-0.075,-0.30); surfaceAnchor.add(deskBeam);
    deskControl=mesh(rbox(0.11,0.022,0.055,0.006),mat(COL.frameDark,{m:0.4,r:0.5})); deskControl.position.set(0.5,-0.07,0.3); surfaceAnchor.add(deskControl);
    var b1=box(0.014,0.006,0.014,mat(COL.accent,{e:COL.accent,ei:0.5})); b1.position.set(0.476,-0.057,0.3); surfaceAnchor.add(b1);
    var b2=box(0.014,0.006,0.014,mat(0x222a34)); b2.position.set(0.5,-0.057,0.3); surfaceAnchor.add(b2);
    deskButtons=[b1,b2];
    standingFrame=makeStandingFrame(); standingFrame.visible=false; surfaceAnchor.add(standingFrame);

    legL=makeLeg(); legR=makeLeg(); scene.add(legL,legR); setLegs();

    DSI.forEach(function(id){
      var cfg=REGISTRY[id]; if(!cfg) return;
      var holder=new THREE.Group();
      holder.name=id; holder.userData.dsiId=id;
      var proc=cfg.build(); holder.add(proc); holder.userData.proc=proc; holder.userData.isModel=false;
      if(id==='dsi-hub') holder.scale.setScalar(cfg.scale);
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
    var foot=mesh(rbox(0.10,0.035,0.50,0.01),ft); foot.position.y=0.0175; g.userData.foot=foot; g.add(foot);
    var lower=mesh(rbox(0.085,1,0.085,0.012),dk); g.userData.lower=lower; g.add(lower);
    var upper=mesh(rbox(0.062,1,0.062,0.01),dk); g.userData.upper=upper; g.add(upper);

    var standingOnly=[];
    var glideM=mat(0x0f1012,{m:0.45,r:0.46});
    for(var sz=-1;sz<=1;sz+=2){
      var glide=mesh(new THREE.CylinderGeometry(0.028,0.032,0.014,18),glideM);
      glide.position.set(0,0.007,sz*0.285);
      g.add(glide); standingOnly.push(glide);
    }

    var faceM=mat(0x111315,{m:0.52,r:0.42});
    var lowerFace=mesh(rbox(0.052,1,0.004,0.002),faceM);
    lowerFace.position.z=0.046; g.add(lowerFace); standingOnly.push(lowerFace);
    var upperFace=mesh(rbox(0.040,1,0.004,0.002),faceM);
    upperFace.position.z=0.034; g.add(upperFace); standingOnly.push(upperFace);

    for(var sy=0.11;sy<=0.23;sy+=0.12){
      var screw=mesh(new THREE.CylinderGeometry(0.005,0.005,0.003,10),mat(0x08090a,{m:0.5,r:0.5}));
      screw.rotation.x=Math.PI/2;
      screw.position.set(0.024,sy,0.049);
      g.add(screw); standingOnly.push(screw);
    }

    standingOnly.forEach(function(p){ p.visible=false; });
    g.userData.standingOnly=standingOnly;
    g.userData.lowerFace=lowerFace;
    g.userData.upperFace=upperFace;
    return g;
  }
  function setLegs(){
    if(!legL||!legR) return;
    var colH=Math.max(0.30,curTopY-0.04), xx=0.62, lowerH=deskModeStanding?0.50:0.40;
    var lowerM=deskModeStanding ? mat(COL.pStandGun,{m:0.62,r:0.36}) : mat(COL.frame,{m:0.6,r:0.4});
    var upperM=deskModeStanding ? mat(COL.pStandRail,{m:0.58,r:0.38}) : mat(COL.frame,{m:0.6,r:0.4});
    var footM=deskModeStanding ? mat(COL.pStandBlack,{m:0.62,r:0.34}) : mat(COL.frameDark,{m:0.5,r:0.5});
    [legL,legR].forEach(function(L,i){
      L.position.set(i===0?-xx:xx,0,0);
      var lo=L.userData.lower, up=L.userData.upper, ft=L.userData.foot;
      if(ft){
        ft.material=footM;
        ft.scale.set(deskModeStanding?1.18:1,deskModeStanding?1.22:1,deskModeStanding?1.30:1);
        ft.position.y=deskModeStanding?0.022:0.0175;
      }
      lo.material=lowerM; up.material=upperM;
      lo.scale.set(deskModeStanding?1.08:1,lowerH,deskModeStanding?1.04:1);
      lo.position.y=0.02+lowerH/2;
      var upH=Math.max(0.05,colH-lowerH);
      up.scale.set(deskModeStanding?0.96:1,upH,deskModeStanding?0.96:1);
      up.position.y=0.02+lowerH+upH/2;

      var details=L.userData.standingOnly||[];
      details.forEach(function(p){ p.visible=deskModeStanding; });
      if(L.userData.lowerFace){
        L.userData.lowerFace.scale.y=lowerH;
        L.userData.lowerFace.position.y=0.02+lowerH/2;
      }
      if(L.userData.upperFace){
        L.userData.upperFace.scale.y=upH;
        L.userData.upperFace.position.y=0.02+lowerH+upH/2;
      }
    });
  }

  function setDeskVisual(standing){
    standing=!!standing;
    deskModeStanding=standing;
    if(deskTop) deskTop.material=standing ? makeDeskWoodMaterial() : mat(COL.surface,{r:0.6,m:0.04});
    if(deskEdge) deskEdge.material=standing ? mat(COL.pWoodEdge,{r:0.78,m:0.02}) : mat(COL.edge,{r:0.7});
    if(deskBeam) deskBeam.visible=!standing;
    if(deskControl) deskControl.visible=!standing;
    deskButtons.forEach(function(b){ b.visible=!standing; });
    if(standingFrame) standingFrame.visible=standing;
    setLegs();
  }

  function setDeskMode(standing,animated){
    standing=!!standing;
    setDeskVisual(standing);
    var target=standing?DESK_STAND:DESK_SIT; if(target===curTopY)return;
    var from=curTopY;
    addTween(animated&&!reduce?700:0,function(e){ curTopY=lerp(from,target,e); if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); if(controls)controls.target.y=curTopY*0.55; },function(){ if(controls)controls.update(); });
    if(reduce||!animated){ curTopY=target; if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); }
  }

  /* ---- camara ---- */
  function viewSpec(v){ var y=curTopY;
    if(v==='frontal') return {p:new THREE.Vector3(0,y+0.78,3.05),t:new THREE.Vector3(0,y*0.99,0.03)};
    if(v==='superior') return {p:new THREE.Vector3(0.001,y+3.08,0.04),t:new THREE.Vector3(0,y*0.10,0.04)};
    return {p:new THREE.Vector3(2.35,y+1.18,2.54),t:new THREE.Vector3(0,y*0.82,-0.02)};
  }
  function normalizedView(v){ return (v==='frontal'||v==='superior') ? v : 'perspectiva'; }
  function setStageView(v){
    var nv=normalizedView(v);
    if(stageEl) stageEl.setAttribute('data-s3d-view',nv);
    var showWall=nv!=='superior';
    if(roomFloor) roomFloor.receiveShadow=nv!=='superior';
    if(roomWall) roomWall.visible=showWall;
    if(roomBaseboard) roomBaseboard.visible=showWall;
  }
  function setView(v,animated){
    if(!ready)return; var s=viewSpec(v);
    setStageView(v);
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
