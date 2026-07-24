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
  var objects = {}, deskTop, deskEdge, deskBeam, deskControl, standingFrame, surfaceAnchor, legL, legR, roomFloor, roomWall, roomSideWall, roomRightWall, roomCeiling, roomBaseboard, roomSideBaseboard, roomRightBaseboard, roomCornerTrim, roomRightCornerTrim, roomPlant, roomArt, roomRightArt, roomWindow;
  var glowSpot, glowTarget, glowPool, hemiLight, ambientLight, keyLight, rimLight, fillLight, modeSwapTimer=0, bulkSwapTimer=0;
  var activeView='perspectiva', cameraTweenToken=0, userAdjustedCamera=false;
  var lastDesiredVisibility={}, productTransitionToken=0;
  var deskButtons = [], deskModeStanding = false;
  var DESK_SIT = 0.73, DESK_STAND = 1.08, MAT_TOP = 0.0022, curTopY = DESK_SIT;
  var DSI = ['dsi-chair','dsi-lumbar','dsi-monitor','dsi-monitor-base','dsi-monitor-stand','dsi-monitor-arm','dsi-laptop','dsi-stand','dsi-keyboard','dsi-wrist-rest','dsi-mousepad','dsi-mouse','dsi-hub','dsi-organizer','dsi-lightbar','dsi-context'];
  var comparisonMode = 'current';
  var diagnosisAnswers = new Array(6).fill(null);
  var primOfficeState = {vis:{},opts:{}};
  var hasPrimOfficeState = false;

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
  var _matCache={}, _microTextures={}, _surfaceMatCache={}, _screenMaterials={};
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
  function microTexture(kind){
    if(_microTextures[kind]) return _microTextures[kind];
    var canvas=document.createElement('canvas'); canvas.width=96; canvas.height=96;
    var ctx=canvas.getContext('2d'); ctx.fillStyle='#808080'; ctx.fillRect(0,0,96,96);
    if(kind==='fabric'){
      ctx.strokeStyle='rgba(210,210,210,.28)'; ctx.lineWidth=1;
      for(var i=0;i<96;i+=4){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,96); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(96,i); ctx.stroke(); }
    }else if(kind==='leather'){
      for(var n=0;n<180;n++){ var x=(n*37)%96,y=(n*61)%96,r=1+(n%3); ctx.fillStyle=n%2?'rgba(205,205,205,.22)':'rgba(45,45,45,.16)'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
    }else if(kind==='rubber'){
      for(var d=0;d<150;d++){ var dx=(d*29)%96,dy=(d*47)%96; ctx.fillStyle=d%3?'rgba(40,40,40,.20)':'rgba(190,190,190,.14)'; ctx.fillRect(dx,dy,1.4,1.4); }
    }else if(kind==='paper'){
      ctx.strokeStyle='rgba(220,220,220,.26)';
      for(var py=2;py<96;py+=5){ ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(96,py+(py%3)-1); ctx.stroke(); }
    }
    var tex=new THREE.CanvasTexture(canvas); tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2);
    _microTextures[kind]=tex; return tex;
  }
  function surfaceMat(color,kind,o){
    o=o||{}; var key=color+'|'+kind+'|'+(o.r||'')+'|'+(o.m||'');
    if(_surfaceMatCache[key]) return _surfaceMatCache[key];
    var material=new THREE.MeshStandardMaterial({color:color,roughness:o.r!=null?o.r:(kind==='fabric'?0.92:kind==='leather'?0.70:kind==='rubber'?0.88:0.96),metalness:o.m||0,bumpMap:microTexture(kind),bumpScale:kind==='paper'?0.00045:(kind==='fabric'?0.0018:0.0012)});
    _surfaceMatCache[key]=material; return material;
  }
  function screenMat(kind){
    kind=kind==='current'?'current':'primoffice';
    if(_screenMaterials[kind]) return _screenMaterials[kind];
    var canvas=document.createElement('canvas'); canvas.width=768; canvas.height=432;
    var ctx=canvas.getContext('2d');
    if(kind==='current'){
      ctx.fillStyle='#10171d'; ctx.fillRect(0,0,768,432);
      ctx.fillStyle='#202930'; ctx.fillRect(0,0,768,42);
      ctx.fillStyle='#3a454d'; ctx.fillRect(22,15,104,12);
      ctx.fillStyle='#172128'; ctx.fillRect(42,74,442,292);
      ctx.fillStyle='#29343b'; ctx.fillRect(64,96,398,34);
      ctx.fillStyle='#222d34'; ctx.fillRect(64,151,180,170); ctx.fillRect(266,151,174,76);
      ctx.fillStyle='#4d5960';
      for(var oldRow=0;oldRow<5;oldRow++) ctx.fillRect(82,174+oldRow*27,128+(oldRow%2)*38,8);
      ctx.fillStyle='#29343a'; ctx.fillRect(514,94,208,236);
      ctx.fillStyle='#6f6452'; ctx.fillRect(536,119,72,10); ctx.fillRect(536,146,142,8);
      ctx.fillStyle='#313c43'; ctx.fillRect(536,190,160,108);
    }else{
      ctx.fillStyle='#071827'; ctx.fillRect(0,0,768,432);
      ctx.fillStyle='#0c2940'; ctx.fillRect(0,0,768,48);
      ctx.fillStyle='#29b6e8'; ctx.fillRect(24,17,88,13);
      ctx.fillStyle='rgba(255,255,255,.68)'; ctx.fillRect(604,17,48,12); ctx.fillRect(670,17,72,12);
      ctx.fillStyle='#0a2235'; ctx.fillRect(0,48,148,384);
      for(var nav=0;nav<5;nav++){ ctx.fillStyle=nav===1?'#0d6f9f':'#17364b'; ctx.fillRect(22,82+nav*52,102,20); }
      ctx.fillStyle='#e5f6fc'; ctx.fillRect(178,78,224,18);
      ctx.fillStyle='#12364e'; ctx.fillRect(178,117,258,112); ctx.fillRect(458,117,280,112);
      ctx.fillStyle='#1c516e'; ctx.fillRect(198,142,88,58); ctx.fillRect(303,142,112,58);
      ctx.fillStyle='#29b6e8'; ctx.fillRect(478,183,36,25); ctx.fillRect(526,162,36,46); ctx.fillRect(574,144,36,64); ctx.fillRect(622,125,36,83); ctx.fillRect(670,154,36,54);
      ctx.strokeStyle='#70d4f4'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(190,332); ctx.bezierCurveTo(276,274,320,355,390,294); ctx.bezierCurveTo(466,230,535,320,610,258); ctx.bezierCurveTo(652,224,684,238,720,194); ctx.stroke();
      ctx.fillStyle='#102f45'; ctx.fillRect(178,254,560,142);
      ctx.fillStyle='#1f4a63'; for(var row=0;row<4;row++){ ctx.fillRect(198,278+row*26,330+(row%2)*96,9); }
    }
    var tex=new THREE.CanvasTexture(canvas); if('colorSpace' in tex) tex.colorSpace=THREE.SRGBColorSpace;
    if(renderer&&renderer.capabilities) tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    _screenMaterials[kind]=new THREE.MeshStandardMaterial({map:tex,emissive:kind==='current'?0x182027:0x0a4466,emissiveMap:tex,emissiveIntensity:kind==='current'?0.20:0.58,roughness:kind==='current'?0.48:0.34,metalness:0.03});
    return _screenMaterials[kind];
  }
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

  /* Sillas contextuales: tres siluetas distintas segun el diagnostico. */
  function chairStarBase(parent,spokes){
    var met=mat(COL.frame,{r:0.4,m:0.58}), wheel=mat(COL.dark,{r:0.58});
    var hub=mesh(new THREE.CylinderGeometry(0.05,0.06,0.06,16),met); hub.position.y=0.11; parent.add(hub);
    for(var i=0;i<spokes;i++){
      var a=i/spokes*Math.PI*2;
      var leg=box(0.26,0.03,0.05,met); leg.position.set(Math.cos(a)*0.13,0.05,Math.sin(a)*0.13); leg.rotation.y=-a; parent.add(leg);
      var caster=mesh(new THREE.SphereGeometry(0.028,10,8),wheel); caster.position.set(Math.cos(a)*0.24,0.03,Math.sin(a)*0.24); parent.add(caster);
    }
    var post=mesh(new THREE.CylinderGeometry(0.03,0.035,0.34,12),met); post.position.y=0.30; parent.add(post);
  }
  function ergonomicChair(){
    var g=new THREE.Group(); g.name='chair-ergonomic';
    var fab=surfaceMat(COL.fabric,'fabric',{r:0.88}), met=mat(COL.frame,{r:0.4,m:0.58});
    chairStarBase(g,5);
    var seat=mesh(rbox(0.50,0.09,0.48,0.04),fab); seat.position.y=0.50; g.add(seat);
    var back=mesh(rbox(0.46,0.58,0.075,0.04),fab); back.position.set(0,0.86,0.22); back.rotation.x=rad(8); g.add(back);
    for(var sx=-1;sx<=1;sx+=2){
      var armPost=box(0.025,0.22,0.025,met); armPost.position.set(sx*0.245,0.64,0.02); g.add(armPost);
      var armPad=mesh(rbox(0.065,0.025,0.24,0.012),fab); armPad.position.set(sx*0.245,0.76,0.02); g.add(armPad);
    }
    var head=mesh(rbox(0.31,0.12,0.065,0.03),fab); head.position.set(0,1.18,0.27); head.rotation.x=rad(8); g.add(head);
    return g;
  }
  function basicOfficeChair(){
    var g=new THREE.Group(); g.name='chair-basic';
    var fab=surfaceMat(0x3f4853,'leather',{r:0.74}), met=mat(0x4b535c,{r:0.52,m:0.35});
    chairStarBase(g,4);
    var seat=mesh(rbox(0.46,0.075,0.43,0.025),fab); seat.position.y=0.49; g.add(seat);
    var support=box(0.055,0.42,0.045,met); support.position.set(0,0.70,0.19); support.rotation.x=rad(5); g.add(support);
    var back=mesh(rbox(0.40,0.39,0.065,0.025),fab); back.position.set(0,0.86,0.22); back.rotation.x=rad(5); g.add(back);
    return g;
  }
  function diningChair(){
    var g=new THREE.Group(); g.name='chair-dining';
    var wood=mat(0x9a6740,{r:0.78,m:0.01}), edge=mat(0x71472d,{r:0.82,m:0.01});
    var seat=mesh(rbox(0.46,0.075,0.42,0.018),wood); seat.position.y=0.48; g.add(seat);
    for(var sx=-1;sx<=1;sx+=2){
      for(var sz=-1;sz<=1;sz+=2){
        var leg=mesh(rbox(0.045,0.48,0.045,0.008),edge); leg.position.set(sx*0.18,0.24,sz*0.16); leg.rotation.z=rad(-sx*3); leg.rotation.x=rad(sz*3); g.add(leg);
      }
    }
    for(var bx=-1;bx<=1;bx+=2){
      var upright=mesh(rbox(0.045,0.58,0.045,0.008),edge); upright.position.set(bx*0.18,0.76,0.18); g.add(upright);
    }
    for(var y=0.67;y<=1.00;y+=0.11){
      var slat=mesh(rbox(0.39,0.045,0.035,0.008),wood); slat.position.set(0,y,0.18); g.add(slat);
    }
    return g;
  }
  function bChair(){
    var root=new THREE.Group();
    root.add(ergonomicChair(),basicOfficeChair(),diningChair());
    root.children.forEach(function(chair){ chair.visible=false; });
    return root;
  }

  /* Monitor (contextual, generico) */
  function bMonitor(){ var g=new THREE.Group(); var body=mat(COL.dark,{r:0.5,m:0.2});
    g.add(mesh(rbox(0.62,0.36,0.035,0.012),body));
    var s=mesh(new THREE.PlaneGeometry(0.575,0.32),screenMat('current')); s.name='screen-contextual'; s.position.z=0.0185; g.add(s);
    g.userData.baseY=0.30; return g; }

  /* Notebook (contextual, generica) */
  function bLaptop(){
    var g=new THREE.Group();
    var body=mat(COL.alu,{m:0.62,r:0.36});
    var edge=mat(0x778290,{m:0.58,r:0.44});
    var keyM=mat(0x1d2228,{r:0.62,m:0.05});
    var deckM=mat(0x323942,{r:0.58,m:0.12});
    var glassM=mat(0x0a1118,{r:0.48,m:0.03});

    var base=mesh(rbox(0.39,0.022,0.265,0.012),body);
    base.position.y=0.011;
    g.add(base);

    var frontLip=mesh(rbox(0.37,0.004,0.010,0.004),edge);
    frontLip.position.set(0,0.024,0.126);
    frontLip.castShadow=false;
    g.add(frontLip);

    var deck=mesh(rbox(0.335,0.003,0.132,0.006),deckM);
    deck.position.set(0,0.025,-0.012);
    deck.castShadow=false;
    g.add(deck);

    var keyGeometry=new THREE.BoxGeometry(0.018,0.003,0.014);
    for(var row=0;row<4;row++){
      for(var col=0;col<12;col++){
        var key=mesh(keyGeometry,keyM);
        key.position.set(-0.126+col*0.023,0.029,-0.060+row*0.021);
        key.castShadow=false;
        g.add(key);
      }
    }
    var space=mesh(rbox(0.110,0.003,0.014,0.003),keyM);
    space.position.set(0,0.029,0.026);
    space.castShadow=false;
    g.add(space);

    var trackpad=mesh(rbox(0.105,0.002,0.060,0.006),mat(0x66707c,{m:0.42,r:0.50}));
    trackpad.position.set(0,0.027,0.080);
    trackpad.castShadow=false;
    g.add(trackpad);

    var hinge=mesh(new THREE.CylinderGeometry(0.008,0.008,0.345,18),edge);
    hinge.rotation.z=Math.PI/2;
    hinge.position.set(0,0.032,-0.126);
    g.add(hinge);

    var lid=new THREE.Group();
    var lidShell=mesh(rbox(0.39,0.252,0.014,0.010),body);
    lid.add(lidShell);
    var bezel=mesh(rbox(0.356,0.218,0.003,0.004),glassM);
    bezel.position.z=0.008;
    bezel.castShadow=false;
    lid.add(bezel);
    var disp=mesh(new THREE.PlaneGeometry(0.325,0.193),screenMat('current'));
    disp.name='screen-contextual';
    disp.position.z=0.0102;
    lid.add(disp);
    lid.position.set(0,0.146,-0.124);
    lid.rotation.x=rad(-16);
    g.add(lid);

    g.userData.baseY=0;
    return g;
  }

  /* Base comun del monitor contextual. No representa un producto PrimOffice. */
  function bMonitorBase(){
    var g=new THREE.Group(); var body=mat(0x3b424b,{r:0.48,m:0.42});
    var foot=mesh(rbox(0.30,0.025,0.19,0.012),body); foot.position.y=0.013; g.add(foot);
    var post=mesh(rbox(0.055,0.25,0.045,0.012),body); post.position.set(0,0.135,-0.035); g.add(post);
    var neck=mesh(rbox(0.18,0.045,0.04,0.01),body); neck.position.set(0,0.245,-0.018); g.add(neck);
    return g;
  }

  /* pEase - reposamunecas acolchado delante del teclado. */
  function bWristRest(){
    var g=new THREE.Group();
    var baseM=surfaceMat(0x090b0d,'rubber',{r:0.90});
    var rimM=surfaceMat(0x15181b,'rubber',{r:0.80});
    var topM=surfaceMat(0x202428,'rubber',{r:0.76});
    var reliefM=mat(0x343a40,{r:0.58,m:0.02});

    var base=mesh(rbox(0.46,0.007,0.088,0.026),baseM);
    base.position.y=0.0035; g.add(base);

    var rim=mesh(rbox(0.45,0.026,0.082,0.026),rimM);
    rim.position.y=0.017; g.add(rim);

    var top=mesh(rbox(0.416,0.012,0.056,0.018),topM);
    top.position.y=0.030; top.castShadow=false; g.add(top);

    /* Campo de celdas hexagonales poco profundas, construido como relieve
       real para que se lea en perspectiva y no dependa de una textura. */
    var hexGeo=new THREE.CylinderGeometry(0.0086,0.0086,0.0038,6);
    for(var row=0;row<4;row++){
      var z=-0.021+row*0.014;
      for(var col=0;col<19;col++){
        var x=-0.188+col*0.021+(row%2?0.0105:0);
        if(Math.abs(x)>0.195)continue;
        var cell=mesh(hexGeo,reliefM);
        cell.position.set(x,0.0375,z); cell.rotation.y=rad(30); cell.castShadow=false; g.add(cell);
      }
    }
    return g;
  }

  /* pLumbar - soporte lumbar abierto de malla sobre el respaldo contextual. */
  function bLumbar(){
    var g=new THREE.Group();
    var frameM=surfaceMat(0x14181c,'rubber',{r:0.82});
    var strapM=surfaceMat(0x1b2025,'fabric',{r:0.94});
    var panelM=surfaceMat(0x20262c,'rubber',{r:0.80});
    var nodeM=mat(0x101419,{r:0.62,m:0.03});

    function bowedZ(x,y){
      var nx=Math.min(1,Math.abs(x)/0.18), ny=Math.min(1,Math.abs(y)/0.16);
      return -0.058*(1-nx*nx)*(0.86+0.14*(1-ny*ny));
    }

    var framePoints=[
      new THREE.Vector3(-0.18,-0.145,0.004),new THREE.Vector3(-0.20,-0.045,0.002),
      new THREE.Vector3(-0.19,0.105,0.001),new THREE.Vector3(-0.13,0.158,-0.014),
      new THREE.Vector3(0,0.172,-0.034),new THREE.Vector3(0.13,0.158,-0.014),
      new THREE.Vector3(0.19,0.105,0.001),new THREE.Vector3(0.20,-0.045,0.002),
      new THREE.Vector3(0.18,-0.145,0.004),new THREE.Vector3(0,-0.164,-0.030)
    ];
    var frameCurve=new THREE.CatmullRomCurve3(framePoints,true,'catmullrom',0.18);
    var frame=mesh(new THREE.TubeGeometry(frameCurve,80,0.011,8,true),frameM);
    g.add(frame);

    /* Malla abierta: una superficie casi transparente mas su reticula
       triangulada, ambas curvadas hacia adelante en el centro. */
    var meshGeo=new THREE.PlaneGeometry(0.34,0.285,12,14);
    var positions=meshGeo.attributes.position;
    for(var i=0;i<positions.count;i++){
      var px=positions.getX(i), py=positions.getY(i);
      positions.setZ(i,bowedZ(px,py));
    }
    positions.needsUpdate=true; meshGeo.computeVertexNormals();
    var veilM=new THREE.MeshStandardMaterial({color:0x202830,roughness:0.92,metalness:0,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false});
    var gridM=new THREE.MeshStandardMaterial({color:0x59636d,roughness:0.90,metalness:0,transparent:true,opacity:0.42,side:THREE.DoubleSide,wireframe:true,depthWrite:false});
    var veil=mesh(meshGeo,veilM); veil.castShadow=false; veil.renderOrder=2; g.add(veil);
    var grid=mesh(meshGeo.clone(),gridM); grid.castShadow=false; grid.renderOrder=3; g.add(grid);

    /* Correas por detras de la malla, visibles a traves de la abertura. */
    var horizontal=mesh(rbox(0.39,0.026,0.009,0.008),strapM);
    horizontal.position.set(0,-0.010,0.009); horizontal.castShadow=false; g.add(horizontal);
    var vertical=mesh(rbox(0.026,0.305,0.009,0.008),strapM);
    vertical.position.set(0,0,0.009); vertical.castShadow=false; g.add(vertical);

    /* Panel central abierto con nodulos de masaje en relieve. */
    var panelZ=-0.064;
    var sideL=mesh(rbox(0.014,0.218,0.018,0.008),panelM); sideL.position.set(-0.069,0,panelZ); g.add(sideL);
    var sideR=mesh(rbox(0.014,0.218,0.018,0.008),panelM); sideR.position.set(0.069,0,panelZ); g.add(sideR);
    var panelTop=mesh(rbox(0.138,0.014,0.018,0.008),panelM); panelTop.position.set(0,0.102,panelZ); g.add(panelTop);
    var panelBottom=mesh(rbox(0.138,0.014,0.018,0.008),panelM); panelBottom.position.set(0,-0.102,panelZ); g.add(panelBottom);

    var nodeGeo=new THREE.SphereGeometry(0.008,8,5);
    for(var ny=0;ny<6;ny++){
      for(var nx=0;nx<4;nx++){
        var node=mesh(nodeGeo,nodeM);
        node.scale.z=0.55;
        node.position.set(-0.045+nx*0.030,-0.075+ny*0.030,panelZ-0.012);
        node.castShadow=false; g.add(node);
      }
    }
    return g;
  }

  /* Contexto diagnostico: cables, cargadores, papeles y rutas resueltas. */
  function bDeskContext(){
    var root=new THREE.Group();
    var paperM=surfaceMat(0xe4dccb,'paper',{r:0.97}), paperAlt=surfaceMat(0xc8dce7,'paper',{r:0.96});
    var inkM=mat(0x8d98a3,{r:0.9});
    var bookMats=[mat(0x766b5d,{r:0.88}),mat(0x9d6b53,{r:0.88}),mat(0x556979,{r:0.88}),mat(0xc7b18a,{r:0.90})];

    function group(name){ var g=new THREE.Group(); g.name=name; g.visible=false; root.add(g); return g; }
    function paper(parent,x,z,ry,count,color){
      var stack=new THREE.Group(); stack.position.set(x,0,z); stack.rotation.y=ry||0; parent.add(stack);
      count=count||1;
      for(var i=0;i<count;i++){
        var p=mesh(rbox(0.18,0.0025,0.23,0.004),color||paperM);
        p.position.set(i*0.004,0.004+i*0.0025,-i*0.003); p.rotation.y=rad(i*1.4); stack.add(p);
      }
      for(var line=0;line<3;line++){
        var mark=box(0.105-line*0.012,0.001,0.004,inkM);
        mark.position.set(-0.018,0.006+count*0.0025,-0.055+line*0.020); mark.castShadow=false; stack.add(mark);
      }
    }
    function displacedKeyboard(parent,x,z,ry){
      var unit=new THREE.Group(); unit.position.set(x,0.004,z); unit.rotation.y=ry||0; parent.add(unit);
      var basicCase=mat(0x656b6f,{r:0.84,m:0.02}), basicKey=mat(0x92979a,{r:0.88,m:0.01});
      var base=mesh(rbox(0.36,0.018,0.128,0.006),basicCase); base.position.y=0.009; unit.add(base);
      var keyGeometry=new THREE.BoxGeometry(0.018,0.004,0.016);
      for(var row=0;row<4;row++){
        for(var col=0;col<11;col++){
          var key=mesh(keyGeometry,basicKey); key.position.set(-0.145+col*0.022,0.020,-0.040+row*0.022); key.castShadow=false; unit.add(key);
        }
        for(var pad=0;pad<3;pad++){
          var numKey=mesh(keyGeometry,basicKey); numKey.position.set(0.105+pad*0.022,0.020,-0.040+row*0.022); numKey.castShadow=false; unit.add(numKey);
        }
      }
      var space=mesh(new THREE.BoxGeometry(0.115,0.004,0.016),basicKey); space.position.set(-0.020,0.020,0.048); space.castShadow=false; unit.add(space);
    }
    function bookStack(parent,x,z,ry,count){
      var unit=new THREE.Group(); unit.position.set(x,0,z); unit.rotation.y=ry||0; parent.add(unit);
      for(var i=0;i<count;i++){
        var book=mesh(rbox(0.22-i*0.008,0.020,0.15+(i%2)*0.018,0.004),bookMats[i%bookMats.length]);
        book.position.set((i%2)*0.008,0.011+i*0.021,(i%3-1)*0.004); book.rotation.y=rad((i%2?1:-1)*2); unit.add(book);
      }
    }
    function taskLamp(parent,x,z){
      var unit=new THREE.Group(); unit.position.set(x,0,z); parent.add(unit);
      var lampM=mat(0x252a2f,{r:0.56,m:0.34});
      var base=mesh(new THREE.CylinderGeometry(0.070,0.078,0.018,22),lampM); base.position.y=0.009; unit.add(base);
      var stem=mesh(new THREE.CylinderGeometry(0.009,0.011,0.29,12),lampM); stem.position.set(0,0.158,0.012); stem.rotation.z=rad(-7); unit.add(stem);
      var shade=mesh(new THREE.ConeGeometry(0.066,0.105,20,1,true),lampM); shade.position.set(0.035,0.300,0.010); shade.rotation.z=rad(-20); unit.add(shade);
      var bulb=new THREE.PointLight(0xffcf95,0.30,1.15,2); bulb.position.set(0.052,0.260,0.012); bulb.castShadow=false; unit.add(bulb);
    }
    var currentBase=group('context-current-base');
    taskLamp(currentBase,-0.67,-0.26);

    var clean=group('context-clean');

    var medium=group('context-medium');
    paper(medium,0.46,0.18,rad(-9),2); paper(medium,0.24,0.28,rad(8),1,paperAlt);
    bookStack(medium,-0.58,-0.20,rad(6),2);

    var messy=group('context-messy');
    paper(messy,0.47,0.14,rad(-16),3); paper(messy,-0.44,-0.04,rad(20),2,paperAlt); paper(messy,0.15,0.29,rad(7),1);
    displacedKeyboard(messy,-0.20,0.26,rad(14));
    bookStack(messy,-0.58,-0.21,rad(8),4);

    var tidy=group('context-tidy');

    root.userData.cableCounts={clean:0,medium:0,messy:0,tidy:0};
    return root;
  }

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
    var slotM=mat(0x050607,{r:0.78,m:0.04});

    function railBetween(a,b,w,d,material,radius){
      var dir=new THREE.Vector3().subVectors(b,a);
      var len=dir.length();
      var n=dir.clone().normalize();
      var part=mesh(rbox(w,len,d,radius||0.008),material);
      part.position.copy(a).add(b).multiplyScalar(0.5);
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
      return part;
    }

    /* Base en U de 26 x 22 cm, rasgo principal de la referencia oficial. */
    var baseL=mesh(rbox(0.028,0.011,0.230,0.010),black); baseL.position.set(-0.112,0.006,0); g.add(baseL);
    var baseR=mesh(rbox(0.028,0.011,0.230,0.010),black); baseR.position.set(0.112,0.006,0); g.add(baseR);
    var baseF=mesh(rbox(0.252,0.011,0.026,0.009),black); baseF.position.set(0,0.006,0.103); g.add(baseF);
    var baseB=mesh(rbox(0.252,0.011,0.026,0.009),black); baseB.position.set(0,0.006,-0.103); g.add(baseB);

    for(var sx=-1;sx<=1;sx+=2){
      var sideCurve=new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx*0.112,0.014,0.104),
        new THREE.Vector3(sx*0.112,0.012,-0.088),
        new THREE.Vector3(sx*0.110,0.060,-0.116),
        new THREE.Vector3(sx*0.106,0.138,-0.104),
        new THREE.Vector3(sx*0.080,0.158,-0.068),
        new THREE.Vector3(sx*0.073,0.133,0.108)
      ],false,'catmullrom',0.18);
      var sideHoop=mesh(new THREE.TubeGeometry(sideCurve,34,0.0095,10,false),black);
      g.add(sideHoop);

      var rear=mesh(rbox(0.026,0.145,0.030,0.011),black);
      rear.position.set(sx*0.108,0.078,-0.088); g.add(rear);

      var slot=mesh(rbox(0.005,0.040,0.012,0.006),slotM);
      slot.position.set(sx*0.122,0.090,-0.079); slot.castShadow=false;
      g.add(slot);

      /* Dos superficies anchas, no cuatro barras finas: silueta reconocible
         y contacto paralelo con la notebook contextual. */
      var rail=railBetween(
        new THREE.Vector3(sx*0.072,0.107,0.108),
        new THREE.Vector3(sx*0.072,0.155,-0.096),
        0.062,0.014,black,0.009
      );
      g.add(rail);

      var railPad=railBetween(
        new THREE.Vector3(sx*0.072,0.115,0.094),
        new THREE.Vector3(sx*0.072,0.159,-0.078),
        0.046,0.004,pad,0.004
      );
      railPad.castShadow=false;
      g.add(railPad);

      var stop=mesh(rbox(0.062,0.024,0.014,0.006),black);
      stop.position.set(sx*0.072,0.111,0.120);
      stop.rotation.x=rad(13);
      g.add(stop);

      var stopPad=mesh(rbox(0.052,0.005,0.012,0.004),pad);
      stopPad.position.set(sx*0.072,0.124,0.115);
      stopPad.rotation.x=rad(13);
      stopPad.castShadow=false;
      g.add(stopPad);

      var stopFace=mesh(rbox(0.044,0.004,0.010,0.003),satin);
      stopFace.position.set(sx*0.072,0.120,0.116);
      stopFace.rotation.x=rad(13);
      stopFace.castShadow=false;
      g.add(stopFace);
    }

    var rearBrace=mesh(rbox(0.218,0.014,0.020,0.007),black);
    rearBrace.position.set(0,0.153,-0.104);
    rearBrace.rotation.x=rad(13);
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
     REGISTRO de productos procedurales: id 'dsi-*' -> { name, build, scale }
     ===================================================================== */
  var REGISTRY={
    'dsi-monitor-arm':   { name:'pArm',       build:bMonArm },
    'dsi-monitor-stand': { name:'pStandard',  build:bMonStand },
    'dsi-stand':         { name:'pNotebook',  build:bStand },
    'dsi-mousepad':      { name:'pMat',       build:bMousepad },
    'dsi-hub':           { name:'pHub',       build:bHub, scale:1.55 },
    'dsi-organizer':     { name:'pBox',       build:bCableBox },
    'dsi-lightbar':      { name:'pGlow',      build:bLightbar },
    'dsi-keyboard':      { name:'pMechanic',  build:bKeyboard },
    'dsi-wrist-rest':    { name:'pEase',      build:bWristRest },
    'dsi-mouse':         { name:'pMouseProV', build:bMouse },
    'dsi-lumbar':        { name:'pLumbar',    build:bLumbar, draggable:false },
    /* contextuales genericos (no son productos del catalogo a modelar) */
    'dsi-monitor':       { name:'monitor (contextual)',  build:bMonitor },
    'dsi-monitor-base':  { name:'base de monitor (contextual)', build:bMonitorBase, draggable:false },
    'dsi-laptop':        { name:'notebook (contextual)', build:bLaptop },
    'dsi-chair':         { name:'silla (contextual)',    build:bChair },
    'dsi-context':       { name:'contexto del diagnostico', build:bDeskContext, draggable:false }
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
    'dsi-monitor-base':  {x: 0.00, y: 0.00,  z:-0.18, rx:0, ry:0},
    'dsi-monitor-stand': {x: 0.00, y: 0.00,  z:-0.18, rx:0, ry:0},
    'dsi-monitor-arm':   {x: 0.00, y: 0.00,  z:-0.18, rx:0, ry:0},
    'dsi-laptop':        {x:-0.46, y: 0.00,  z: 0.05, rx:0, ry:0.16},
    'dsi-stand':         {x:-0.46, y: 0.00,  z: 0.05, rx:0, ry:0.16},
    'dsi-keyboard':      {x:-0.02, y: 0.00,  z: 0.15, rx:0, ry:0},
    'dsi-wrist-rest':    {x:-0.02, y: 0.00,  z: 0.285,rx:0, ry:0},
    'dsi-mousepad':      {x: 0.03, y: 0.00,  z: 0.12, rx:0, ry:0},
    'dsi-mouse':         {x: 0.30, y: 0.00,  z: 0.20, rx:0, ry:0},    
    'dsi-hub':           {x: 0.53, y: 0.00,  z:-0.035, rx:0, ry:0},
    'dsi-organizer':     {x: 0.00, y:-0.207, z: 0.21,  rx:0, ry:0},
    'dsi-lightbar':      {x: 0.00, y: 0.50,  z:-0.12, rx:0, ry:0},
    'dsi-chair':         {x: 0.00, y: 0.00,  z: 0.95, rx:0, ry:0},
    'dsi-lumbar':        {x: 0.00, y: 0.76,  z: 0.155,rx:-7*Math.PI/180,ry:0},
    'dsi-context':       {x: 0.00, y: 0.00,  z: 0.00, rx:0, ry:0}
  };

  function isVisible(id){ return objects[id] && objects[id].visible; }
  function diagnosisValue(index){
    var value=diagnosisAnswers[index];
    return value===0||value===1||value===2?value:0;
  }
  function visualChairType(){return comparisonMode==='primoffice'?0:diagnosisValue(4);}

  function configureLighting(glowOn,animated){
    if(!renderer||!hemiLight||!ambientLight||!keyLight||!rimLight||!fillLight) return;
    var current=comparisonMode==='current';
    var target=current
      ? {hemi:0.82,ambient:0.48,key:1.36,rim:0.09,fill:0.28,exposure:0.96,glow:0,pool:0}
      : {hemi:1.06,ambient:0.43,key:1.98,rim:0.25,fill:0.56,exposure:glowOn?1.06:1.09,glow:glowOn?3.55:0,pool:glowOn?0.18:0};
    var from={hemi:hemiLight.intensity,ambient:ambientLight.intensity,key:keyLight.intensity,rim:rimLight.intensity,fill:fillLight.intensity,exposure:renderer.toneMappingExposure,glow:glowSpot?glowSpot.intensity:0,pool:glowPool?glowPool.material.opacity:0};
    var duration=animated&&!reduce&&running?520:0;
    if(glowSpot) glowSpot.visible=target.glow>0||from.glow>0;
    if(glowPool) glowPool.visible=target.pool>0||from.pool>0;
    addTween(duration,function(e){
      hemiLight.intensity=lerp(from.hemi,target.hemi,e); ambientLight.intensity=lerp(from.ambient,target.ambient,e);
      keyLight.intensity=lerp(from.key,target.key,e); rimLight.intensity=lerp(from.rim,target.rim,e); fillLight.intensity=lerp(from.fill,target.fill,e);
      renderer.toneMappingExposure=lerp(from.exposure,target.exposure,e);
      if(glowSpot) glowSpot.intensity=lerp(from.glow,target.glow,e);
      if(glowPool) glowPool.material.opacity=lerp(from.pool,target.pool,e);
    },function(){
      if(glowSpot) glowSpot.visible=target.glow>0;
      if(glowPool) glowPool.visible=target.pool>0;
    });
  }

  function setContextOpacity(group,value){
    if(!group)return;
    group.traverse(function(node){
      if(!node.isMesh||!node.material)return;
      if(!node.userData.contextFadeMaterial){node.material=node.material.clone();node.material.transparent=true;node.userData.contextFadeMaterial=true;}
      node.material.opacity=value;node.material.depthWrite=value>0.98;
    });
  }

  function configureVisualContext(vis,animated,transition){
    transition=transition||{};
    var device=diagnosisValue(2), order=diagnosisValue(3), chairType=visualChairType();
    var chairNames=['chair-ergonomic','chair-basic','chair-dining'];
    var chairHolder=objects['dsi-chair'];
    if(chairHolder){
      chairNames.forEach(function(name){ var part=chairHolder.getObjectByName(name); if(part) part.visible=name===chairNames[chairType]; });
    }

    var monitorBase=objects['dsi-monitor-base'];
    if(monitorBase){
      monitorBase.scale.set(1,device===1?0.78:1.18,1);
    }

    var contextualScreen=screenMat(comparisonMode==='current'?'current':'primoffice');
    ['dsi-monitor','dsi-laptop'].forEach(function(id){
      var holder=objects[id]; if(!holder)return;
      holder.traverse(function(node){if(node.isMesh&&node.name==='screen-contextual')node.material=contextualScreen;});
    });

    var contextHolder=objects['dsi-context'];
    var cableCount=0;
    if(contextHolder){
      var currentBase=contextHolder.getObjectByName('context-current-base');
      if(currentBase){currentBase.visible=comparisonMode==='current';setContextOpacity(currentBase,1);}
      var contextNames=['context-clean','context-medium','context-messy','context-tidy'];
      var targetContext='context-tidy';
      if(comparisonMode==='current'){
        var currentNames=['context-clean','context-medium','context-messy'];
        targetContext=currentNames[order];
        cableCount=0;
      }else{
        targetContext='';
        cableCount=0;
      }
      var previousGroups=contextNames.map(function(name){return contextHolder.getObjectByName(name);}).filter(function(group){return group&&group.visible&&group.name!==targetContext;});
      var targetGroup=contextHolder.getObjectByName(targetContext);
      if(animated&&!reduce&&running&&!transition.bulk&&previousGroups.length&&targetGroup){
        targetGroup.visible=true; setContextOpacity(targetGroup,0);
        addTween(480,function(e){
          setContextOpacity(targetGroup,e);
          previousGroups.forEach(function(group){setContextOpacity(group,1-e);});
        },function(){
          setContextOpacity(targetGroup,1);
          previousGroups.forEach(function(group){group.visible=false;setContextOpacity(group,1);});
        });
      }else{
        contextNames.forEach(function(name){var group=contextHolder.getObjectByName(name);if(group){group.visible=name===targetContext;setContextOpacity(group,1);}});
      }
    }

    var glowOn=comparisonMode==='primoffice'&&!!vis['dsi-lightbar'];
    configureLighting(glowOn,animated);

    if(stageEl){
      stageEl.setAttribute('data-s3d-device',['laptop-low','monitor-low','monitor-correct'][device]);
      stageEl.setAttribute('data-s3d-monitor-position',vis['dsi-monitor-arm']?'elevated-arm':(vis['dsi-monitor']?(device===1?'low-base':'correct-base'):'hidden'));
      stageEl.setAttribute('data-s3d-laptop-position',vis['dsi-stand']?'elevated-stand':(vis['dsi-laptop']?'flat':'hidden'));
      stageEl.setAttribute('data-s3d-order',['clean','medium','messy'][order]);
      stageEl.setAttribute('data-s3d-chair',['ergonomic','basic','dining'][chairType]);
      stageEl.setAttribute('data-s3d-diagnosed-chair',['ergonomic','basic','dining'][diagnosisValue(4)]);
      stageEl.setAttribute('data-s3d-cables',String(cableCount));
      stageEl.setAttribute('data-s3d-context-props',comparisonMode==='current'?'improvised-office':'balanced-office');
      stageEl.setAttribute('data-s3d-box',vis['dsi-organizer']?'true':'false');
      stageEl.setAttribute('data-s3d-hub',vis['dsi-hub']?'true':'false');
      stageEl.setAttribute('data-s3d-glow',glowOn?'true':'false');
      stageEl.setAttribute('data-s3d-lighting',comparisonMode==='current'?'neutral-flat':(glowOn?'clean-warm-focus':'clean-balanced'));
      stageEl.setAttribute('data-s3d-ease',vis['dsi-wrist-rest']?'true':'false');
      stageEl.setAttribute('data-s3d-lumbar',vis['dsi-lumbar']?'true':'false');
    }
  }

  /* Resuelve la posición/rotación canónica de un objeto según el contexto
     actual de visibilidad (apoyos dependientes). */
  function computeHome(id){
    var b=HOME[id]||{x:0,y:0,z:0,rx:0,ry:0};
    var x=b.x, y=b.y, z=b.z, rx=b.rx||0, ry=b.ry||0;

    if(id==='dsi-monitor'){
      var arm=isVisible('dsi-monitor-arm'), stand=isVisible('dsi-monitor-stand');
      var device=diagnosisValue(2);
      y = arm ? 0.44 : (stand ? 0.30 : (device===1?0.20:0.32));
      z = arm ? -0.18 : (device===1?-0.08:-0.18);
    } else if(id==='dsi-monitor-base'){
      z=diagnosisValue(2)===1?-0.08:-0.18;
    } else if(id==='dsi-lightbar'){
      var t=computeHome('dsi-monitor');
      x=t.x; y=t.y+0.18+0.036; z=t.z+0.035;   /* apoyada sobre el borde superior del monitor */
    } else if(id==='dsi-laptop'){
      var onStand=isVisible('dsi-stand');
      /* Notebook y pNotebook deben compartir la MISMA inclinación.
         Antes estaban inclinados en sentidos opuestos y se atravesaban. */
      y = onStand ? 0.142 : 0.0;
      rx = onStand ? rad(13) : 0;
      x = onStand ? -0.46 : 0;
      z = onStand ? 0.05 : 0.015;
      ry = onStand ? 0.16 : 0;
    } else if(id==='dsi-keyboard'){
      y = isVisible('dsi-mousepad') ? MAT_TOP : 0.0;
    } else if(id==='dsi-wrist-rest'){
      y = isVisible('dsi-mousepad') ? MAT_TOP : 0.0;
    } else if(id==='dsi-mouse'){
      y = isVisible('dsi-mousepad') ? MAT_TOP : 0.0;
    } else if(id==='dsi-chair'){
      x = comparisonMode==='current'?0.06:-0.52;
      z = comparisonMode==='current'?0.98:1.10;
      ry = comparisonMode==='current'?rad(-2):rad(14);
    } else if(id==='dsi-lumbar'){
      var chair=visualChairType();
      y = chair===0?0.79:(chair===1?0.76:0.75);
      z = chair===0?0.155:(chair===1?0.145:0.14);
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

  function setHolderScale(holder,factor){
    var rest=holder.userData.restScale||new THREE.Vector3(1,1,1);
    holder.scale.set(rest.x*factor,rest.y*factor,rest.z*factor);
  }
  function productHighlight(holder,color){
    if(reduce||!scene||!holder) return;
    var helper=new THREE.BoxHelper(holder,color||0x38bdf8); helper.material.transparent=true; helper.material.opacity=0.48; helper.renderOrder=8; scene.add(helper);
    addTween(680,function(e){ helper.material.opacity=lerp(0.48,0,e); },function(){ scene.remove(helper); helper.geometry.dispose(); helper.material.dispose(); });
  }
  function animateHolder(id,show,duration){
    var holder=objects[id]; if(!holder||id==='dsi-context') return;
    var token=++productTransitionToken; holder.userData.transitionToken=token;
    var targetScale=id==='dsi-monitor-base'?holder.scale.clone():(holder.userData.restScale||new THREE.Vector3(1,1,1)).clone();
    function scaleTo(factor){holder.scale.set(targetScale.x*factor,targetScale.y*factor,targetScale.z*factor);}
    if(show){
      holder.visible=true; scaleTo(0.88);
      addTween(duration,function(e){ if(holder.userData.transitionToken!==token)return; scaleTo(lerp(0.88,1,e)); },function(){ if(holder.userData.transitionToken===token)scaleTo(1); });
      if(id!=='dsi-monitor'&&id!=='dsi-monitor-base'&&id!=='dsi-laptop'&&id!=='dsi-chair') productHighlight(holder,0x38bdf8);
    }else{
      addTween(duration,function(e){ if(holder.userData.transitionToken!==token)return; scaleTo(lerp(1,0.88,e)); },function(){
        if(holder.userData.transitionToken!==token)return; holder.visible=false; scaleTo(1); placeAll(true);
      });
    }
  }

  function applyVisible(vis,animated,transition){
    vis=Object.assign({},vis||{});
    transition=transition||{};

    /* Mantener coherencia sin inventar productos:
       - El monitor solo aparece si fue seleccionado desde el carrito.
       - pArm y pStandard son alternativas; si pArm está activo se oculta
         pStandard para evitar superposición.
       - pGlow solo se renderiza si también está activo un monitor.
       - pNotebook conserva la notebook contextual para poder visualizar
         el soporte elevador. */
    if(vis['dsi-monitor-arm']){
      vis['dsi-monitor-stand']=false;
      vis['dsi-monitor-base']=false;
    }else if(vis['dsi-monitor']&&!vis['dsi-monitor-stand']){
      /* Si pArm se retira, el monitor vuelve a una base coherente incluso
         cuando el diagnostico original era una notebook. */
      vis['dsi-monitor-base']=true;
    }
    if(!vis['dsi-monitor']){
      vis['dsi-lightbar']=false;
    }
    if(vis['dsi-stand']){
      vis['dsi-laptop']=true;
    }
    if(vis['dsi-lumbar']){
      vis['dsi-chair']=true;
    }

    var changed=DSI.filter(function(id){return !!lastDesiredVisibility[id]!==!!vis[id];});
    var bulk=!!transition.bulk||!animated||reduce||!running;
    if(bulk){
      DSI.forEach(function(id){ if(objects[id]){objects[id].visible=!!vis[id];setHolderScale(objects[id],1);} });
    }else{
      DSI.forEach(function(id){
        var holder=objects[id]; if(!holder)return;
        if(vis[id]) holder.visible=true;
        else if(changed.indexOf(id)===-1) holder.visible=false;
      });
    }
    configureVisualContext(vis,animated,transition);
    placeAll(!bulk&&changed.length>0);
    if(!bulk){
      changed.forEach(function(id){animateHolder(id,!!vis[id],vis[id]?560:430);});
    }
    lastDesiredVisibility=Object.assign({},vis);
    if(stageEl&&transition.productIds&&transition.productIds.length)stageEl.setAttribute('data-s3d-last-products',transition.productIds.join(','));
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
    tex.repeat.set(4.85,9.3);
    if(renderer&&renderer.capabilities) tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return new THREE.MeshStandardMaterial({map:tex,color:0xd0b78b,roughness:0.9,metalness:0});
  }

  function makePlasterWallMaterial(color){
    var canvas=document.createElement('canvas'); canvas.width=256; canvas.height=256;
    var ctx=canvas.getContext('2d'); ctx.fillStyle='#ebe9e4'; ctx.fillRect(0,0,256,256);
    for(var y=0;y<256;y+=12){
      ctx.fillStyle=(y/12)%2?'rgba(255,255,255,.018)':'rgba(79,71,61,.014)';
      ctx.fillRect(0,y,256,12);
    }
    for(var i=0;i<140;i++){
      var x=(i*73)%256, py=(i*47)%256;
      ctx.fillStyle=i%3?'rgba(77,70,62,.028)':'rgba(255,255,255,.045)';
      ctx.fillRect(x,py,1+(i%2),1);
    }
    var tex=new THREE.CanvasTexture(canvas); if('colorSpace' in tex)tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(3.2,2.4);
    if(renderer&&renderer.capabilities)tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return new THREE.MeshStandardMaterial({map:tex,color:color,roughness:0.98,metalness:0});
  }

  function buildAmbientRoom(){
    var sideX=-2.05, roomRight=2.30, roomWidth=roomRight-sideX, roomDepth=18.0, wallHeight=5.2;
    var roomCenterX=(sideX+roomRight)/2, backZ=-1.35, roomCenterZ=backZ+roomDepth/2;

    roomFloor=new THREE.Mesh(new THREE.PlaneGeometry(roomWidth,roomDepth),makeWoodFloorMaterial());
    roomFloor.name='s3d-floor-shadow-receiver';
    roomFloor.rotation.x=-Math.PI/2;
    roomFloor.position.set(roomCenterX,-0.006,roomCenterZ);
    roomFloor.receiveShadow=true;
    roomFloor.castShadow=false;
    scene.add(roomFloor);

    var wallMat=makePlasterWallMaterial(0xe1ddd3);
    var sideWallMat=makePlasterWallMaterial(0xd5d0c6);
    var rightWallMat=makePlasterWallMaterial(0xdbd7ce);
    roomWall=new THREE.Mesh(new THREE.PlaneGeometry(roomWidth,wallHeight),wallMat);
    roomWall.name='s3d-room-wall';
    roomWall.position.set(roomCenterX,wallHeight/2,backZ);
    roomWall.receiveShadow=true;
    roomWall.castShadow=false;
    scene.add(roomWall);

    roomSideWall=new THREE.Mesh(new THREE.PlaneGeometry(roomDepth,wallHeight),sideWallMat);
    roomSideWall.name='s3d-room-side-wall';
    roomSideWall.rotation.y=Math.PI/2;
    roomSideWall.position.set(sideX,wallHeight/2,roomCenterZ);
    roomSideWall.receiveShadow=true;
    roomSideWall.castShadow=false;
    scene.add(roomSideWall);

    roomRightWall=new THREE.Mesh(new THREE.PlaneGeometry(roomDepth,wallHeight),rightWallMat);
    roomRightWall.name='s3d-room-right-wall';
    roomRightWall.rotation.y=-Math.PI/2;
    roomRightWall.position.set(roomRight,wallHeight/2,roomCenterZ);
    roomRightWall.receiveShadow=true;
    roomRightWall.castShadow=false;
    scene.add(roomRightWall);

    roomCeiling=new THREE.Mesh(
      new THREE.PlaneGeometry(roomWidth,roomDepth),
      new THREE.MeshStandardMaterial({color:0xe5e1d8,roughness:0.98,metalness:0})
    );
    roomCeiling.name='s3d-room-ceiling';
    roomCeiling.rotation.x=Math.PI/2;
    roomCeiling.position.set(roomCenterX,wallHeight,roomCenterZ);
    roomCeiling.receiveShadow=true;
    roomCeiling.castShadow=false;
    scene.add(roomCeiling);

    var baseboardMat=mat(0xc4baa7,{r:0.86,m:0.01});
    roomBaseboard=mesh(rbox(roomWidth,0.065,0.04,0.006),baseboardMat);
    roomBaseboard.name='s3d-baseboard';
    roomBaseboard.position.set(roomCenterX,0.04,backZ+0.022);
    roomBaseboard.castShadow=false;
    roomBaseboard.receiveShadow=true;
    scene.add(roomBaseboard);

    roomSideBaseboard=mesh(rbox(0.04,0.065,roomDepth,0.006),baseboardMat);
    roomSideBaseboard.name='s3d-side-baseboard';
    roomSideBaseboard.position.set(sideX+0.022,0.04,roomCenterZ);
    roomSideBaseboard.castShadow=false;
    roomSideBaseboard.receiveShadow=true;
    scene.add(roomSideBaseboard);

    roomRightBaseboard=mesh(rbox(0.04,0.065,roomDepth,0.006),baseboardMat);
    roomRightBaseboard.name='s3d-right-baseboard';
    roomRightBaseboard.position.set(roomRight-0.022,0.04,roomCenterZ);
    roomRightBaseboard.castShadow=false;
    roomRightBaseboard.receiveShadow=true;
    scene.add(roomRightBaseboard);

    roomCornerTrim=mesh(rbox(0.045,wallHeight,0.045,0.006),baseboardMat);
    roomCornerTrim.name='s3d-room-corner-trim';
    roomCornerTrim.position.set(sideX+0.024,wallHeight/2,backZ+0.024);
    roomCornerTrim.castShadow=false;
    roomCornerTrim.receiveShadow=true;
    scene.add(roomCornerTrim);

    roomRightCornerTrim=mesh(rbox(0.045,wallHeight,0.045,0.006),baseboardMat);
    roomRightCornerTrim.name='s3d-room-right-corner-trim';
    roomRightCornerTrim.position.set(roomRight-0.024,wallHeight/2,backZ+0.024);
    roomRightCornerTrim.castShadow=false;
    roomRightCornerTrim.receiveShadow=true;
    scene.add(roomRightCornerTrim);

    /* Ventana procedural inspirada en la luz lateral y las cortinas de las referencias. */
    roomWindow=new THREE.Group(); roomWindow.name='s3d-room-window';
    var windowFrameM=mat(0xe8e5de,{r:0.82,m:0.02});
    var windowGlassM=new THREE.MeshStandardMaterial({color:0xb7ccd3,emissive:0xc9dfe6,emissiveIntensity:0.18,roughness:0.38,metalness:0.02});
    var glass=mesh(new THREE.PlaneGeometry(0.88,1.18),windowGlassM); glass.position.z=0.004; glass.castShadow=false; roomWindow.add(glass);
    var winTop=mesh(rbox(1.02,0.052,0.050,0.006),windowFrameM); winTop.position.set(0,0.64,0.020); roomWindow.add(winTop);
    var winBottom=winTop.clone(); winBottom.position.y=-0.64; roomWindow.add(winBottom);
    var winLeft=mesh(rbox(0.052,1.33,0.050,0.006),windowFrameM); winLeft.position.set(-0.485,0,0.020); roomWindow.add(winLeft);
    var winRight=winLeft.clone(); winRight.position.x=0.485; roomWindow.add(winRight);
    var winMidV=mesh(rbox(0.034,1.24,0.040,0.005),windowFrameM); winMidV.position.z=0.025; roomWindow.add(winMidV);
    var winMidH=mesh(rbox(0.94,0.034,0.040,0.005),windowFrameM); winMidH.position.z=0.025; roomWindow.add(winMidH);
    var sill=mesh(rbox(1.10,0.055,0.13,0.010),windowFrameM); sill.position.set(0,-0.685,0.060); roomWindow.add(sill);
    var curtainM=surfaceMat(0xe4dfd5,'fabric',{r:0.98});
    for(var ci=0;ci<4;ci++){
      var curtain=mesh(rbox(0.105,1.48,0.030,0.012),curtainM);
      curtain.position.set(0.57+ci*0.070,-0.02,0.055+Math.sin(ci)*0.012); curtain.castShadow=false; roomWindow.add(curtain);
    }
    var windowLight=new THREE.PointLight(0xd9eff6,0.20,3.0,2); windowLight.position.set(0,0,0.42); windowLight.castShadow=false; roomWindow.add(windowLight);
    roomWindow.position.set(-1.18,1.77,backZ+0.030); scene.add(roomWindow);

    /* Elemento ambiental 1: planta de piso discreta, fuera del escritorio. */
    roomPlant=new THREE.Group(); roomPlant.name='s3d-room-plant';
    var potM=mat(0x8f5f43,{r:0.86,m:0.01}), leafM=mat(0x426b51,{r:0.9,m:0.01}), stemM=mat(0x4d5a3f,{r:0.9});
    var pot=mesh(new THREE.CylinderGeometry(0.14,0.11,0.22,24),potM); pot.position.y=0.11; roomPlant.add(pot);
    var stem=mesh(new THREE.CylinderGeometry(0.012,0.016,0.52,12),stemM); stem.position.y=0.42; roomPlant.add(stem);
    for(var li=0;li<7;li++){
      var leaf=mesh(new THREE.SphereGeometry(0.12,16,10),leafM); var la=li/7*Math.PI*2;
      leaf.scale.set(0.48,1,0.30); leaf.rotation.z=rad(-28+li*9); leaf.rotation.y=-la;
      leaf.position.set(Math.cos(la)*0.10,0.46+(li%3)*0.11,Math.sin(la)*0.07); roomPlant.add(leaf);
    }
    roomPlant.position.set(-1.28,0,backZ+0.30); scene.add(roomPlant);

    /* Elemento ambiental 2: cuadro abstracto procedural. */
    roomArt=new THREE.Group(); roomArt.name='s3d-room-art';
    var artCanvas=document.createElement('canvas'); artCanvas.width=384; artCanvas.height=256;
    var actx=artCanvas.getContext('2d'); actx.fillStyle='#ebe8e1'; actx.fillRect(0,0,384,256);
    actx.fillStyle='#34383a'; actx.fillRect(30,28,132,196); actx.fillStyle='#a7a39a'; actx.fillRect(184,28,168,82);
    actx.fillStyle='#676b6b'; actx.beginPath(); actx.arc(252,170,57,0,Math.PI*2); actx.fill();
    actx.fillStyle='#d0ccc2'; actx.fillRect(190,126,64,92); actx.fillStyle='rgba(255,255,255,.68)'; actx.fillRect(204,52,124,12);
    var artTex=new THREE.CanvasTexture(artCanvas); if('colorSpace' in artTex) artTex.colorSpace=THREE.SRGBColorSpace;
    var art=mesh(new THREE.PlaneGeometry(0.66,0.44),new THREE.MeshStandardMaterial({map:artTex,roughness:0.88,metalness:0})); art.position.z=0.006; art.castShadow=false; roomArt.add(art);
    var frameM=mat(0x313840,{r:0.58,m:0.16});
    var frameTop=mesh(rbox(0.72,0.035,0.035,0.006),frameM); frameTop.position.set(0,0.237,0); roomArt.add(frameTop);
    var frameBottom=frameTop.clone(); frameBottom.position.y=-0.237; roomArt.add(frameBottom);
    var frameLeft=mesh(rbox(0.035,0.51,0.035,0.006),frameM); frameLeft.position.set(-0.342,0,0); roomArt.add(frameLeft);
    var frameRight=frameLeft.clone(); frameRight.position.x=0.342; roomArt.add(frameRight);
    roomArt.position.set(0.58,1.58,backZ+0.026); scene.add(roomArt);

    /* Segundo cuadro discreto, montado sobre la pared lateral derecha. */
    roomRightArt=new THREE.Group(); roomRightArt.name='s3d-room-right-art';
    var rightCanvas=document.createElement('canvas'); rightCanvas.width=256; rightCanvas.height=320;
    var rctx=rightCanvas.getContext('2d'); rctx.fillStyle='#e8e5de'; rctx.fillRect(0,0,256,320);
    rctx.fillStyle='#3f4445'; rctx.fillRect(34,36,188,74); rctx.fillStyle='#9e9b93'; rctx.fillRect(34,132,82,152);
    rctx.fillStyle='#666b6b'; rctx.beginPath(); rctx.arc(174,210,48,0,Math.PI*2); rctx.fill();
    var rightTex=new THREE.CanvasTexture(rightCanvas); if('colorSpace' in rightTex)rightTex.colorSpace=THREE.SRGBColorSpace;
    var rightPrint=mesh(new THREE.PlaneGeometry(0.46,0.60),new THREE.MeshStandardMaterial({map:rightTex,roughness:0.90,metalness:0})); rightPrint.position.z=0.006; rightPrint.castShadow=false; roomRightArt.add(rightPrint);
    var rightFrameM=mat(0x3a3e40,{r:0.62,m:0.12});
    var rightTop=mesh(rbox(0.51,0.030,0.032,0.005),rightFrameM); rightTop.position.set(0,0.315,0); roomRightArt.add(rightTop);
    var rightBottom=rightTop.clone(); rightBottom.position.y=-0.315; roomRightArt.add(rightBottom);
    var rightLeft=mesh(rbox(0.030,0.66,0.032,0.005),rightFrameM); rightLeft.position.set(-0.245,0,0); roomRightArt.add(rightLeft);
    var rightRight=rightLeft.clone(); rightRight.position.x=0.245; roomRightArt.add(rightRight);
    roomRightArt.rotation.y=-Math.PI/2;
    roomRightArt.position.set(roomRight-0.026,1.52,-0.42); scene.add(roomRightArt);
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
      plate.position.set(sx*0.62,-0.049,-0.020);
      g.add(plate);

      var cap=mesh(rbox(0.15,0.032,0.12,0.008),gun);
      cap.position.set(sx*0.62,-0.080,-0.265);
      g.add(cap);
    }

    var railOuter=mesh(rbox(1.18,0.046,0.052,0.008),gun);
    railOuter.position.set(0,-0.112,-0.315);
    g.add(railOuter);

    var railSleeve=mesh(rbox(0.38,0.056,0.064,0.008),rail);
    railSleeve.position.set(0,-0.111,-0.315);
    g.add(railSleeve);

    var railSeam=box(0.012,0.058,0.068,black);
    railSeam.position.set(0.22,-0.111,-0.315);
    g.add(railSeam);

    var controlBox=mesh(rbox(0.25,0.036,0.095,0.008),black);
    controlBox.position.set(0.16,-0.153,-0.305);
    g.add(controlBox);

    var motor=mesh(new THREE.CylinderGeometry(0.035,0.038,0.23,18),black);
    motor.position.set(0.58,-0.170,-0.270);
    g.add(motor);

    var motorCase=mesh(rbox(0.070,0.180,0.074,0.012),black);
    motorCase.position.set(0.625,-0.155,-0.270);
    g.add(motorCase);

    var cable=mesh(new THREE.CylinderGeometry(0.004,0.004,0.76,8),mat(COL.cable,{r:0.68}));
    cable.rotation.z=Math.PI/2;
    cable.position.set(-0.12,-0.151,-0.348);
    g.add(cable);

    var cableKnob=mesh(new THREE.SphereGeometry(0.014,12,8),black);
    cableKnob.position.set(-0.48,-0.151,-0.348);
    g.add(cableKnob);

    var keypadShell=mesh(rbox(0.150,0.026,0.076,0.008),shell);
    keypadShell.position.set(0.555,-0.064,0.390);
    g.add(keypadShell);

    var keypadFace=mesh(rbox(0.066,0.024,0.006,0.003),black);
    keypadFace.position.set(0.520,-0.064,0.432);
    g.add(keypadFace);

    var display=box(0.018,0.010,0.004,mat(0x0e1114,{e:0x162d36,ei:0.45,r:0.5}));
    display.position.set(0.498,-0.064,0.436);
    g.add(display);

    for(var i=0;i<3;i++){
      var btn=mesh(new THREE.CylinderGeometry(0.0038,0.0038,0.004,10),button);
      btn.rotation.x=Math.PI/2;
      btn.position.set(0.516+i*0.014,-0.064,0.437);
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
    controls.addEventListener('start',function(){ if(!camFly) userAdjustedCamera=true; });

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

    hemiLight=new THREE.HemisphereLight(0xf2fbff,0xd8bf98,1.02); scene.add(hemiLight);
    ambientLight=new THREE.AmbientLight(0xc8d8e5,0.43); scene.add(ambientLight);
    keyLight=new THREE.DirectionalLight(0xffffff,1.90); keyLight.position.set(4.2,5.0,2.8); keyLight.castShadow=true;
    keyLight.shadow.mapSize.set(2048,2048); keyLight.shadow.bias=-0.00018; keyLight.shadow.normalBias=0.018; keyLight.shadow.radius=9;
    var sc=keyLight.shadow.camera; sc.near=0.5; sc.far=13; sc.left=-2.35; sc.right=2.35; sc.top=2.35; sc.bottom=-2.35; sc.updateProjectionMatrix();
    scene.add(keyLight);
    rimLight=new THREE.DirectionalLight(0x9fd8ff,0.22); rimLight.position.set(-3,2.1,-2.5); scene.add(rimLight);
    fillLight=new THREE.DirectionalLight(0xffe0b8,0.48); fillLight.position.set(2.2,2.0,3.4); scene.add(fillLight);

    buildAmbientRoom();

    surfaceAnchor=new THREE.Object3D(); surfaceAnchor.position.y=curTopY; scene.add(surfaceAnchor);
    deskTop=mesh(rbox(1.5,0.04,0.72,0.012),mat(COL.surface,{r:0.6,m:0.04})); deskTop.position.y=-0.02; surfaceAnchor.add(deskTop);
    deskEdge=mesh(rbox(1.52,0.012,0.74,0.012),mat(COL.edge,{r:0.7})); deskEdge.position.y=-0.045; deskEdge.castShadow=false; surfaceAnchor.add(deskEdge);

    /* Iluminacion localizada de pGlow: solo superficie, sin alterar la sala. */
    glowTarget=new THREE.Object3D(); glowTarget.position.set(0,0,0.05); surfaceAnchor.add(glowTarget);
    glowSpot=new THREE.SpotLight(0xffd9a6,0,1.45,rad(38),0.72,2);
    glowSpot.position.set(0,0.52,-0.10); glowSpot.target=glowTarget; glowSpot.visible=false; surfaceAnchor.add(glowSpot);
    glowPool=mesh(new THREE.CircleGeometry(0.48,48),new THREE.MeshBasicMaterial({color:0xffd49a,transparent:true,opacity:0.16,depthWrite:false}));
    glowPool.rotation.x=-Math.PI/2; glowPool.scale.set(1.45,0.82,1); glowPool.position.set(0,0.004,0.035); glowPool.visible=false; glowPool.castShadow=false; glowPool.receiveShadow=false; surfaceAnchor.add(glowPool);
    /* Escritorio base limpio: sin viga trasera ni control genérico.
       Esos elementos no pertenecen a ningún producto seleccionado. */
    deskBeam=null;
    deskControl=null;
    deskButtons=[];
    standingFrame=makeStandingFrame(); standingFrame.visible=false; surfaceAnchor.add(standingFrame);

    legL=makeLeg(); legR=makeLeg(); scene.add(legL,legR); setLegs();

    DSI.forEach(function(id){
      var cfg=REGISTRY[id]; if(!cfg) return;
      var holder=new THREE.Group();
      holder.name=id; holder.userData.dsiId=id;
      holder.userData.draggable=cfg.draggable!==false;
      holder.add(cfg.build());
      if(id==='dsi-hub') holder.scale.setScalar(cfg.scale);
      holder.userData.restScale=holder.scale.clone();
      holder.visible=false; objects[id]=holder;
      if(id==='dsi-chair'){ scene.add(holder); }
      else if(id==='dsi-lumbar'&&objects['dsi-chair']){ objects['dsi-chair'].add(holder); }
      else { surfaceAnchor.add(holder); }
    });

    ready=true;
    placeAll(false);
    setupDrag();
    setView('perspectiva',false);
    var ro=new ResizeObserver(function(){ var cw=host.clientWidth,ch=host.clientHeight; if(cw&&ch){ renderer.setSize(cw,ch,false); camera.aspect=cw/ch; camera.updateProjectionMatrix(); if(ready&&!userAdjustedCamera) autoFrame(false,'resize',activeView); } });
    ro.observe(host);

    var vis=new IntersectionObserver(function(en){ if(en[0].isIntersecting){ running=true; renderer.setAnimationLoop(loop); } else { running=false; renderer.setAnimationLoop(null); } },{threshold:0.01});
    vis.observe(stageEl);

    if(hasPrimOfficeState) renderComparison(false,{force:true,reason:'initial'});
    else refreshFromDOM();
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
    addTween(animated&&!reduce&&running?620:0,function(e){ curTopY=lerp(from,target,e); if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); },function(){ if(controls)controls.update(); });
    if(reduce||!animated){ curTopY=target; if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); }
  }

  /* ---- camara ---- */
  function normalizedView(v){ return (v==='frontal'||v==='superior') ? v : 'perspectiva'; }
  function actuallyVisible(node,root){
    var current=node;
    while(current){ if(current.visible===false) return false; if(current===root) break; current=current.parent; }
    return true;
  }
  function expandVisibleBounds(box3,root){
    if(!root||root.visible===false) return;
    root.updateWorldMatrix(true,true);
    root.traverse(function(node){
      if(!node.isMesh||!actuallyVisible(node,root)) return;
      if(!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      if(!node.geometry.boundingBox) return;
      var local=node.geometry.boundingBox.clone(); local.applyMatrix4(node.matrixWorld); box3.union(local);
    });
  }
  function contentBounds(plannedStanding){
    var bounds=new THREE.Box3(); bounds.makeEmpty();
    [deskTop,deskEdge,standingFrame,legL,legR].forEach(function(node){ expandVisibleBounds(bounds,node); });
    DSI.forEach(function(id){ var node=objects[id]; if(node&&node.visible) expandVisibleBounds(bounds,node); });
    if(bounds.isEmpty()) bounds.set(new THREE.Vector3(-0.8,0,-0.4),new THREE.Vector3(0.8,1.3,1.35));
    var plannedY=plannedStanding?DESK_STAND:DESK_SIT, delta=plannedY-curTopY;
    if(Math.abs(delta)>0.001) bounds.max.y=Math.max(bounds.min.y+0.55,bounds.max.y+delta);
    return bounds;
  }
  function projectedCoverage(bounds,probe){
    probe.updateProjectionMatrix(); probe.updateMatrixWorld();
    var min=bounds.min,max=bounds.max;
    var corners=[new THREE.Vector3(min.x,min.y,min.z),new THREE.Vector3(max.x,min.y,min.z),new THREE.Vector3(min.x,max.y,min.z),new THREE.Vector3(max.x,max.y,min.z),new THREE.Vector3(min.x,min.y,max.z),new THREE.Vector3(max.x,min.y,max.z),new THREE.Vector3(min.x,max.y,max.z),new THREE.Vector3(max.x,max.y,max.z)];
    var minX=1,maxX=-1,minY=1,maxY=-1;
    corners.forEach(function(point){ point.project(probe); minX=Math.min(minX,point.x); maxX=Math.max(maxX,point.x); minY=Math.min(minY,point.y); maxY=Math.max(maxY,point.y); });
    return {width:(maxX-minX)/2,height:(maxY-minY)/2};
  }
  function refineFraming(spec){
    var direction=spec.p.clone().sub(spec.t).normalize();
    for(var i=0;i<3;i++){
      var probe=camera.clone(); probe.aspect=camera.aspect; probe.position.copy(spec.p); probe.lookAt(spec.t);
      var coverage=projectedCoverage(spec.bounds,probe);
      var targetHeight=spec.view==='perspectiva'?0.92:0.87;
      var scale=Math.max(coverage.width/0.83,coverage.height/targetHeight);
      if(Math.abs(scale-1)<0.015) break;
      spec.distance=clampN(spec.distance*scale*1.015,1.45,5.40);
      spec.p.copy(spec.t).add(direction.clone().multiplyScalar(spec.distance));
    }
    return spec;
  }
  function framingSpec(view,plannedStanding){
    view=normalizedView(view); var bounds=contentBounds(plannedStanding), size=new THREE.Vector3(), center=new THREE.Vector3();
    bounds.getSize(size); bounds.getCenter(center);
    var vfov=rad(camera.fov), hfov=2*Math.atan(Math.tan(vfov/2)*camera.aspect), useful=0.82;
    var fitW=(size.x*0.5)/(Math.tan(hfov/2)*useful), fitH;
    if(view==='superior') fitH=(size.z*0.5)/(Math.tan(vfov/2)*0.80);
    else if(view==='frontal') fitH=(size.y*0.5)/(Math.tan(vfov/2)*0.82);
    else fitH=((size.y+size.z*0.16)*0.5)/(Math.tan(vfov/2)*0.82);
    var distance=clampN(Math.max(fitW,fitH)+(view==='perspectiva'?size.z*0.10:0.08),1.45,5.40);
    var direction;
    if(view==='superior') direction=new THREE.Vector3(0.001,1,0.001);
    else if(view==='frontal') direction=new THREE.Vector3(0,0.16,1);
    else if(comparisonMode==='current') direction=new THREE.Vector3(0.34,0.46,1.75);
    else direction=new THREE.Vector3(1.18,0.72,1.46);
    direction.normalize();
    var target=center.clone();
    if(view==='perspectiva') target.y+=comparisonMode==='current'?-0.02:0.04;
    var position=target.clone().add(direction.multiplyScalar(distance));
    if(view==='superior') position.x+=0.001;
    return refineFraming({p:position,t:target,bounds:bounds,distance:distance,view:view});
  }
  function writeFrameDiagnostics(spec){
    if(!stageEl||!spec||!spec.bounds) return;
    var coverage=projectedCoverage(spec.bounds,camera);
    stageEl.setAttribute('data-s3d-projected-width',String(Math.round(coverage.width*100)));
    stageEl.setAttribute('data-s3d-projected-height',String(Math.round(coverage.height*100)));
    stageEl.setAttribute('data-s3d-camera-distance',spec.distance.toFixed(2));
  }
  function animateCamera(spec,animated,reason){
    zoomTarget=null; var token=++cameraTweenToken, duration=animated&&!reduce&&running?560:0;
    userAdjustedCamera=false;
    if(!duration){ camera.position.copy(spec.p); controls.target.copy(spec.t); camera.lookAt(spec.t); controls.update(); camFly=false; controls.enabled=true; writeFrameDiagnostics(spec); }
    else{
      camFly=true; controls.enabled=false; var p0=camera.position.clone(),t0=controls.target.clone();
      addTween(duration,function(e){ if(token!==cameraTweenToken) return; camera.position.lerpVectors(p0,spec.p,e); controls.target.lerpVectors(t0,spec.t,e); camera.lookAt(controls.target); },function(){ if(token!==cameraTweenToken) return; camFly=false; controls.enabled=true; controls.update(); writeFrameDiagnostics(spec); });
    }
    if(stageEl){
      stageEl.setAttribute('data-s3d-camera',comparisonMode+'-'+spec.view);
      stageEl.setAttribute('data-s3d-frame-reason',reason||'manual');
      stageEl.setAttribute('data-s3d-frame-width','82');
    }
  }
  function autoFrame(animated,reason,view){
    if(!ready) return;
    activeView=normalizedView(view||activeView);
    setStageView(activeView); animateCamera(framingSpec(activeView,deskModeStanding),animated,reason); highlight(activeView);
  }
  function objectOutsideFrame(id){
    var object=objects[id]; if(!object||!object.visible) return false;
    var box3=new THREE.Box3(); box3.makeEmpty(); expandVisibleBounds(box3,object); if(box3.isEmpty()) return false;
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    var min=box3.min,max=box3.max;
    var corners=[new THREE.Vector3(min.x,min.y,min.z),new THREE.Vector3(max.x,min.y,min.z),new THREE.Vector3(min.x,max.y,min.z),new THREE.Vector3(max.x,max.y,min.z),new THREE.Vector3(min.x,min.y,max.z),new THREE.Vector3(max.x,min.y,max.z),new THREE.Vector3(min.x,max.y,max.z),new THREE.Vector3(max.x,max.y,max.z)];
    return corners.some(function(point){ point.project(camera); return Math.abs(point.x)>0.90||Math.abs(point.y)>0.88||point.z<-1||point.z>1; });
  }
  function importantChangeOutsideFrame(changedIds){
    var important={'dsi-monitor-arm':1,'dsi-stand':1,'dsi-laptop':1,'dsi-lumbar':1,'dsi-chair':1};
    return (changedIds||[]).some(function(id){ return important[id]&&objectOutsideFrame(id); });
  }
  function setStageView(v){
    var nv=normalizedView(v);
    if(stageEl) stageEl.setAttribute('data-s3d-view',nv);
    var showWall=nv!=='superior';
    if(roomFloor) roomFloor.receiveShadow=true;
    if(roomWall) roomWall.visible=showWall;
    if(roomSideWall) roomSideWall.visible=showWall;
    if(roomRightWall) roomRightWall.visible=showWall;
    if(roomCeiling) roomCeiling.visible=showWall;
    if(roomBaseboard) roomBaseboard.visible=showWall;
    if(roomSideBaseboard) roomSideBaseboard.visible=showWall;
    if(roomRightBaseboard) roomRightBaseboard.visible=showWall;
    if(roomCornerTrim) roomCornerTrim.visible=showWall;
    if(roomRightCornerTrim) roomRightCornerTrim.visible=showWall;
    if(roomArt) roomArt.visible=false;
    if(roomRightArt) roomRightArt.visible=false;
    if(roomWindow) roomWindow.visible=showWall;
  }
  function setView(v,animated){
    if(!ready)return;
    activeView=normalizedView(v); autoFrame(animated,'toolbar',activeView);
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
    var out=[]; DSI.forEach(function(id){ var o=objects[id]; if(o&&o.visible&&o.userData.draggable!==false) out.push(o); }); return out;
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
    autoFrame(true,'reset','perspectiva');
  }

  /* ---- Comparador: diagnostico actual vs seleccion PrimOffice ---- */
  function currentSetupVisible(){
    var vis={'dsi-context':true,'dsi-chair':true};
    var computer=diagnosisValue(2);

    if(computer===0){
      vis['dsi-laptop']=true;
    }else if(computer===1){
      vis['dsi-monitor']=true;
      vis['dsi-monitor-base']=true;
    }else if(computer===2){
      vis['dsi-monitor']=true;
      vis['dsi-monitor-base']=true;
    }
    return vis;
  }

  function comparisonState(){
    var current=currentSetupVisible();
    if(comparisonMode==='current') return {vis:current,opts:{standing:false}};
    return {
      vis:Object.assign({},current,primOfficeState.vis),
      opts:Object.assign({},primOfficeState.opts)
    };
  }

  function applyFallbackVisible(vis,standing){
    var fallbackIds=DSI.concat(['dsi-stand-leg','dsi-pens','dsi-standing-badge']);
    fallbackIds.forEach(function(id){
      var el=$(id); if(!el) return;
      var show=id==='dsi-standing-badge'?standing:!!vis[id];
      el.classList.toggle('hidden-item',!show);
    });
  }

  function renderComparison(animated,frameRequest){
    var state=comparisonState();
    if(stageEl) stageEl.setAttribute('data-s3d-setup',comparisonMode);
    applyFallbackVisible(state.vis,!!state.opts.standing);
    if(!ready) return;
    frameRequest=frameRequest||{};
    applyVisible(state.vis,!!animated,frameRequest);
    setDeskMode(!!state.opts.standing,!!animated);
    if(frameRequest.force){ autoFrame(!!animated,frameRequest.reason||'content',activeView); }
    else if(comparisonMode==='primoffice'&&importantChangeOutsideFrame(frameRequest.changedIds)){ autoFrame(!!animated,'important-product',activeView); }
  }

  function setDiagnosis(diagnosis){
    var source=diagnosis&&Array.isArray(diagnosis.answers)?diagnosis.answers:[];
    diagnosisAnswers=new Array(6).fill(null).map(function(_,i){
      var answer=source[i];
      return Number.isInteger(answer)&&answer>=0&&answer<=2?answer:null;
    });
    pending=!ready;
    renderComparison(false,{force:true,reason:'diagnosis',bulk:true});
  }

  function setMode(mode){
    if(mode!=='current'&&mode!=='primoffice') return false;
    if(mode===comparisonMode){ renderComparison(false); return true; }
    comparisonMode=mode;
    pending=!ready;
    if(!ready||reduce||!stageEl){ renderComparison(false,{force:true,reason:'mode',bulk:true}); return true; }
    if(modeSwapTimer) window.clearTimeout(modeSwapTimer);
    stageEl.classList.add('is-switching');
    modeSwapTimer=window.setTimeout(function(){
      renderComparison(true,{force:true,reason:'mode',bulk:true});
      window.requestAnimationFrame(function(){ stageEl.classList.remove('is-switching'); });
      modeSwapTimer=0;
    },90);
    return true;
  }

  /* ---- API publica ---- */
  function refreshFromDOM(){
    var vis={}, standing=false;
    DSI.forEach(function(id){ var el=$(id); vis[id]=!!(el && !el.classList.contains('hidden-item')); });
    var sb=$('dsi-standing-badge'); standing=!!(sb && !sb.classList.contains('hidden-item'));
    primOfficeState={vis:vis,opts:{standing:standing}};
    hasPrimOfficeState=true;
    renderComparison(false,{force:true,reason:'refresh',bulk:true});
  }
  function setVisible(vis,opts){
    var nextVis=Object.assign({},vis||{}), nextOpts=Object.assign({},opts||{}), previous=primOfficeState;
    var changedIds=DSI.filter(function(id){ return !!previous.vis[id]!==!!nextVis[id]; });
    var standingChanged=!!previous.opts.standing!==!!nextOpts.standing;
    primOfficeState={vis:nextVis,opts:nextOpts};
    hasPrimOfficeState=true;
    pending=!ready;
    var bulkChange=!!nextOpts.bulk||changedIds.length>=3;
    var request={force:comparisonMode==='primoffice'&&(standingChanged||bulkChange),reason:standingChanged?'standing':(nextOpts.preset?'preset':(bulkChange?'preset':'cart')),changedIds:changedIds,bulk:bulkChange,productIds:nextOpts.changedProductIds||[],changeType:nextOpts.changeType||''};
    if(bulkChange&&comparisonMode==='primoffice'&&ready&&!reduce&&stageEl){
      if(bulkSwapTimer)window.clearTimeout(bulkSwapTimer);
      stageEl.classList.add('is-switching');
      bulkSwapTimer=window.setTimeout(function(){renderComparison(true,request);window.requestAnimationFrame(function(){stageEl.classList.remove('is-switching');});bulkSwapTimer=0;},90);
    }else renderComparison(true,request);
  }
  var pending=false;

  /* ---- arranque diferido ---- */
  function reveal(){
    if(deskScene2D) deskScene2D.style.display='none';
    if(stageEl) stageEl.removeAttribute('hidden');
    if(loaderEl) loaderEl.style.display='none';
    if(toolbar) toolbar.style.display='';
    if(pending){ renderComparison(false,{force:true,reason:'reveal',bulk:true}); pending=false; }
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

  window.Setup3D={ setVisible:setVisible, setDiagnosis:setDiagnosis, setMode:setMode, setView:setView, refreshFromDOM:refreshFromDOM, isReady:function(){return ready;}, reset:resetPositions, setFree:setFree };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})(); /* setup-3d ready */
