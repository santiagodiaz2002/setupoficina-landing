// DOCUMENTACIÓN EDUCATIVA: este adaptador 3D es legado y el `index.html` actual no lo carga.
// Si se reconecta, necesita los nodos heredados de la interfaz y carga sus dependencias gráficas de forma diferida.
// Su responsabilidad era reemplazar el preview bidimensional sin asumir el estado comercial del configurador.
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
// Encapsula todo el adaptador en un ámbito privado para no filtrar variables auxiliares al objeto global.
(function () {
  // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones que siguen.
  'use strict';
  // Declara `reduce` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var reduce = false;
  // Inicia una operación que puede fallar por disponibilidad del navegador y permite aplicar un reemplazo seguro.
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // Declara `THREE`, `OrbitControls`, `RoundedBox`, `RoomEnv` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var THREE, OrbitControls, RoundedBox, RoomEnv;
  // Declara `renderer`, `scene`, `camera`, `controls`, `host`, `toolbar`, `loaderEl`, `deskScene2D`, `stageEl`, `hintEl` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var renderer, scene, camera, controls, host, toolbar, loaderEl, deskScene2D, stageEl, hintEl;
  // Declara `ready` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var ready = false, initStarted = false, running = false, camFly = false;
  // Declara `objects` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var objects = {}, deskTop, deskEdge, deskBeam, deskControl, standingFrame, surfaceAnchor, legL, legR, roomFloor, roomWall, roomSideWall, roomRightWall, roomCeiling, roomBaseboard, roomSideBaseboard, roomRightBaseboard, roomCornerTrim, roomRightCornerTrim, roomPlant, roomArt, roomRightArt, roomWindow;
  // Declara `glowSpot`, `glowTarget`, `glowPool`, `hemiLight`, `ambientLight`, `keyLight`, `rimLight`, `fillLight`, `modeSwapTimer` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var glowSpot, glowTarget, glowPool, hemiLight, ambientLight, keyLight, rimLight, fillLight, modeSwapTimer=0, bulkSwapTimer=0;
  // Declara `activeView` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var activeView='perspectiva', cameraTweenToken=0, userAdjustedCamera=false;
  // Declara `lastDesiredVisibility` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var lastDesiredVisibility={}, productTransitionToken=0;
  // Declara `deskButtons` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var deskButtons = [], deskModeStanding = false;
  // Declara `DESK_SIT` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var DESK_SIT = 0.73, DESK_STAND = 1.08, MAT_TOP = 0.0022, curTopY = DESK_SIT;
  // Declara `DSI` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var DSI = ['dsi-chair','dsi-lumbar','dsi-monitor','dsi-monitor-base','dsi-monitor-stand','dsi-monitor-arm','dsi-laptop','dsi-stand','dsi-keyboard','dsi-wrist-rest','dsi-mousepad','dsi-mouse','dsi-hub','dsi-organizer','dsi-lightbar','dsi-context'];
  // Declara `comparisonMode` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var comparisonMode = 'current';
  // Declara `diagnosisAnswers` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var diagnosisAnswers = new Array(6).fill(null);
  // Declara `primOfficeState` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var primOfficeState = {vis:{},opts:{}};
  // Declara `hasPrimOfficeState` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var hasPrimOfficeState = false;

  // Define la rutina `$`: recibe `id` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function $(id){ return document.getElementById(id); }
  // Define la rutina `lerp`: recibe `a`, `b`, `t` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function lerp(a,b,t){ return a+(b-a)*t; }
  // Define la rutina `clamp01`: recibe `t` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function clamp01(t){ return t<0?0:(t>1?1:t); }
  // Define la rutina `clampN`: recibe `v`, `a`, `b` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function clampN(v,a,b){ return v<a?a:(v>b?b:v); }
  // Define la rutina `easeInOut`: recibe `t` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function easeInOut(t){ return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
  // Define la rutina `rad`: recibe `d` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function rad(d){ return THREE.MathUtils.degToRad(d); }

  // Define la rutina `webglOk`: no recibe argumentos directos; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function webglOk(){
    // Inicia una operación que puede fallar por disponibilidad del navegador y permite aplicar un reemplazo seguro.
    try { var c=document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl')||c.getContext('experimental-webgl'))); }
    // Captura el fallo de la operación anterior y devuelve el control al modo de respaldo.
    catch(e){ return false; }
  }

  /* ---- tweens minimos ---- */
  // Declara `tweens` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var tweens=[];
  // Define la rutina `addTween`: recibe `dur`, `upd`, `done` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function addTween(dur,upd,done){
    // Evalúa la condición de esta rama antes de continuar; así protege el flujo frente a estados o capacidades no disponibles.
    if(reduce||!dur){ upd(1); if(done)done(); return; }
    // Ejecuta esta operación con los valores preparados y entrega su efecto al siguiente paso del flujo.
    tweens.push({t0:performance.now(),dur:dur,upd:upd,done:done});
  }
  // Define la rutina `stepTweens`: recibe `now` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function stepTweens(now){
    // Recorre la colección o el rango indicado para construir o actualizar cada elemento de manera uniforme.
    for(var i=tweens.length-1;i>=0;i--){ var tw=tweens[i]; var p=clamp01((now-tw.t0)/tw.dur); tw.upd(easeInOut(p)); if(p>=1){ tweens.splice(i,1); if(tw.done)tw.done(); } }
  }

  /* ---- materiales / geometrias con cache (reutilizacion -> performance) ---- */
  // Declara `_matCache` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var _matCache={}, _microTextures={}, _surfaceMatCache={}, _screenMaterials={};
  // Define la rutina `mat`: recibe `color`, `o` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function mat(color,o){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
    o=o||{};
    // Declara `r` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var r=o.r!=null?o.r:0.7, m=o.m!=null?o.m:0.05, e=o.e||0, ei=o.ei!=null?o.ei:1;
    // Declara `key` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var key=color+'|'+r+'|'+m+'|'+e+'|'+ei;
    // Evalúa la condición de esta rama antes de continuar; así protege el flujo frente a estados o capacidades no disponibles.
    if(_matCache[key]) return _matCache[key];
    // Declara `p` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var p={color:color,roughness:r,metalness:m};
    // Evalúa la condición de esta rama antes de continuar; así protege el flujo frente a estados o capacidades no disponibles.
    if(e){ p.emissive=new THREE.Color(e); p.emissiveIntensity=ei; }
    // Declara `mm` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var mm=new THREE.MeshStandardMaterial(p);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
    _matCache[key]=mm; return mm;
  }
  // Define la rutina `microTexture`: recibe `kind` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function microTexture(kind){
    // Evalúa la condición de esta rama antes de continuar; así protege el flujo frente a estados o capacidades no disponibles.
    if(_microTextures[kind]) return _microTextures[kind];
    // Declara `canvas` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var canvas=document.createElement('canvas'); canvas.width=96; canvas.height=96;
    // Declara `ctx` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var ctx=canvas.getContext('2d'); ctx.fillStyle='#808080'; ctx.fillRect(0,0,96,96);
    // Evalúa la condición de esta rama antes de continuar; así protege el flujo frente a estados o capacidades no disponibles.
    if(kind==='fabric'){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.strokeStyle='rgba(210,210,210,.28)'; ctx.lineWidth=1;
      // Recorre la colección o el rango indicado para construir o actualizar cada elemento de manera uniforme.
      for(var i=0;i<96;i+=4){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,96); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(96,i); ctx.stroke(); }
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    }else if(kind==='leather'){
      // Recorre la colección o el rango indicado para construir o actualizar cada elemento de manera uniforme.
      for(var n=0;n<180;n++){ var x=(n*37)%96,y=(n*61)%96,r=1+(n%3); ctx.fillStyle=n%2?'rgba(205,205,205,.22)':'rgba(45,45,45,.16)'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    }else if(kind==='rubber'){
      // Recorre la colección o el rango indicado para construir o actualizar cada elemento de manera uniforme.
      for(var d=0;d<150;d++){ var dx=(d*29)%96,dy=(d*47)%96; ctx.fillStyle=d%3?'rgba(40,40,40,.20)':'rgba(190,190,190,.14)'; ctx.fillRect(dx,dy,1.4,1.4); }
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    }else if(kind==='paper'){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.strokeStyle='rgba(220,220,220,.26)';
      // Recorre la colección o el rango indicado para construir o actualizar cada elemento de manera uniforme.
      for(var py=2;py<96;py+=5){ ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(96,py+(py%3)-1); ctx.stroke(); }
    }
    // Declara `tex` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var tex=new THREE.CanvasTexture(canvas); tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
    _microTextures[kind]=tex; return tex;
  }
  // Define la rutina `surfaceMat`: recibe `color`, `kind`, `o` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function surfaceMat(color,kind,o){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
    o=o||{}; var key=color+'|'+kind+'|'+(o.r||'')+'|'+(o.m||'');
    // Evalúa la condición de esta rama antes de continuar; así protege el flujo frente a estados o capacidades no disponibles.
    if(_surfaceMatCache[key]) return _surfaceMatCache[key];
    // Declara `material` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var material=new THREE.MeshStandardMaterial({color:color,roughness:o.r!=null?o.r:(kind==='fabric'?0.92:kind==='leather'?0.70:kind==='rubber'?0.88:0.96),metalness:o.m||0,bumpMap:microTexture(kind),bumpScale:kind==='paper'?0.00045:(kind==='fabric'?0.0018:0.0012)});
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
    _surfaceMatCache[key]=material; return material;
  }
  // Define la rutina `screenMat`: recibe `kind` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function screenMat(kind){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
    kind=kind==='current'?'current':'primoffice';
    // Evalúa la condición de esta rama antes de continuar; así protege el flujo frente a estados o capacidades no disponibles.
    if(_screenMaterials[kind]) return _screenMaterials[kind];
    // Declara `canvas` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var canvas=document.createElement('canvas'); canvas.width=768; canvas.height=432;
    // Declara `ctx` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var ctx=canvas.getContext('2d');
    // Evalúa la condición de esta rama antes de continuar; así protege el flujo frente a estados o capacidades no disponibles.
    if(kind==='current'){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#10171d'; ctx.fillRect(0,0,768,432);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#202930'; ctx.fillRect(0,0,768,42);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#3a454d'; ctx.fillRect(22,15,104,12);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#172128'; ctx.fillRect(42,74,442,292);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#29343b'; ctx.fillRect(64,96,398,34);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#222d34'; ctx.fillRect(64,151,180,170); ctx.fillRect(266,151,174,76);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#4d5960';
      // Recorre la colección o el rango indicado para construir o actualizar cada elemento de manera uniforme.
      for(var oldRow=0;oldRow<5;oldRow++) ctx.fillRect(82,174+oldRow*27,128+(oldRow%2)*38,8);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#29343a'; ctx.fillRect(514,94,208,236);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#6f6452'; ctx.fillRect(536,119,72,10); ctx.fillRect(536,146,142,8);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#313c43'; ctx.fillRect(536,190,160,108);
    // Ejecuta la alternativa cuando la condición anterior no se cumple.
    }else{
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#071827'; ctx.fillRect(0,0,768,432);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#0c2940'; ctx.fillRect(0,0,768,48);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#29b6e8'; ctx.fillRect(24,17,88,13);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='rgba(255,255,255,.68)'; ctx.fillRect(604,17,48,12); ctx.fillRect(670,17,72,12);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#0a2235'; ctx.fillRect(0,48,148,384);
      // Recorre la colección o el rango indicado para construir o actualizar cada elemento de manera uniforme.
      for(var nav=0;nav<5;nav++){ ctx.fillStyle=nav===1?'#0d6f9f':'#17364b'; ctx.fillRect(22,82+nav*52,102,20); }
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#e5f6fc'; ctx.fillRect(178,78,224,18);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#12364e'; ctx.fillRect(178,117,258,112); ctx.fillRect(458,117,280,112);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#1c516e'; ctx.fillRect(198,142,88,58); ctx.fillRect(303,142,112,58);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#29b6e8'; ctx.fillRect(478,183,36,25); ctx.fillRect(526,162,36,46); ctx.fillRect(574,144,36,64); ctx.fillRect(622,125,36,83); ctx.fillRect(670,154,36,54);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.strokeStyle='#70d4f4'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(190,332); ctx.bezierCurveTo(276,274,320,355,390,294); ctx.bezierCurveTo(466,230,535,320,610,258); ctx.bezierCurveTo(652,224,684,238,720,194); ctx.stroke();
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#102f45'; ctx.fillRect(178,254,560,142);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el nuevo valor.
      ctx.fillStyle='#1f4a63'; for(var row=0;row<4;row++){ ctx.fillRect(198,278+row*26,330+(row%2)*96,9); }
    }
    // Declara `tex` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var tex=new THREE.CanvasTexture(canvas); if('colorSpace' in tex) tex.colorSpace=THREE.SRGBColorSpace;
    // Evalúa la condición de esta rama antes de continuar; así protege el flujo frente a estados o capacidades no disponibles.
    if(renderer&&renderer.capabilities) tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    // Crea una instancia de Three.js que pasa a formar parte de la geometría, el material o la escena.
    _screenMaterials[kind]=new THREE.MeshStandardMaterial({map:tex,emissive:kind==='current'?0x182027:0x0a4466,emissiveMap:tex,emissiveIntensity:kind==='current'?0.20:0.58,roughness:kind==='current'?0.48:0.34,metalness:0.03});
    // Devuelve este resultado al llamador y finaliza aquí la ejecución de la rutina.
    return _screenMaterials[kind];
  }
  // Define la rutina `rbox`: recibe `w`, `h`, `d`, `r` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function rbox(w,h,d,r){ return new RoundedBox(w,h,d,2,r||0.02); }
  // Define la rutina `mesh`: recibe `g`, `m` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function mesh(g,m){ var x=new THREE.Mesh(g,m); x.castShadow=true; x.receiveShadow=true; return x; }
  // Define la rutina `box`: recibe `w`, `h`, `d`, `m` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function box(w,h,d,m){ return mesh(new THREE.BoxGeometry(w,h,d),m); }
  // Define la rutina `keyGeo`: no recibe argumentos directos; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  var _keyGeo=null; function keyGeo(){ if(!_keyGeo)_keyGeo=new THREE.BoxGeometry(0.024,0.011,0.022); return _keyGeo; }

  // Declara `COL` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
  var COL={
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    surface:0xeceff3, edge:0xc7cfd9,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    frame:0x39424e, frameDark:0x232a32,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    pWood:0xc9975d, pWoodEdge:0x9a6338,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    pStandBlack:0x151719, pStandGun:0x252a2d, pStandRail:0x3a3f42,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    steel:0x2a3038, steelDark:0x1b2026, alu:0x9aa6b4, aluDark:0x6f7c8c,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    dark:0x222a34, accent:0x38bdf8, white:0xeef3f8, fabric:0x2c3744,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    mat:0x232d39, matEdge:0x161d26,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    boxSteel:0x2b323b, boxLid:0x222831, cable:0x2a2f37,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    barDark:0x222932, warmLight:0xfff1d4,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    armBlk:0x262d36, kbCase:0x20262e, keycap:0x2d343e,
    // Continúa la construcción o actualización del adaptador con la operación descrita en esta línea.
    mouseBody:0x2a313b, portDark:0x10141a, ledGreen:0x10b981
  };

  /* =====================================================================
     BUILDERS — devuelven un Group con la base apoyada en y~0 (superficie).
     ===================================================================== */

  /* Sillas contextuales: tres siluetas distintas segun el diagnostico. */
  // Define la rutina `chairStarBase`: recibe `parent`, `spokes` como entrada; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function chairStarBase(parent,spokes){
    // Declara `met` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var met=mat(COL.frame,{r:0.4,m:0.58}), wheel=mat(COL.dark,{r:0.58});
    // Declara `hub` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var hub=mesh(new THREE.CylinderGeometry(0.05,0.06,0.06,16),met); hub.position.y=0.11; parent.add(hub);
    // Recorre la colección o el rango indicado para construir o actualizar cada elemento de manera uniforme.
    for(var i=0;i<spokes;i++){
      // Declara `a` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
      var a=i/spokes*Math.PI*2;
      // Declara `leg` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
      var leg=box(0.26,0.03,0.05,met); leg.position.set(Math.cos(a)*0.13,0.05,Math.sin(a)*0.13); leg.rotation.y=-a; parent.add(leg);
      // Declara `caster` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
      var caster=mesh(new THREE.SphereGeometry(0.028,10,8),wheel); caster.position.set(Math.cos(a)*0.24,0.03,Math.sin(a)*0.24); parent.add(caster);
    }
    // Declara `post` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var post=mesh(new THREE.CylinderGeometry(0.03,0.035,0.34,12),met); post.position.y=0.30; parent.add(post);
  }
  // Define la rutina `ergonomicChair`: no recibe argumentos directos; sus consumidores usan el valor devuelto cuando corresponde y, en los demás casos, sus efectos sobre la escena o la interfaz.
  function ergonomicChair(){
    // Declara `g` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var g=new THREE.Group(); g.name='chair-ergonomic';
    // Declara `fab` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var fab=surfaceMat(COL.fabric,'fabric',{r:0.88}), met=mat(COL.frame,{r:0.4,m:0.58});
    // Ejecuta esta operación con los valores preparados y entrega su efecto al siguiente paso del flujo.
    chairStarBase(g,5);
    // Declara `seat` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var seat=mesh(rbox(0.50,0.09,0.48,0.04),fab); seat.position.y=0.50; g.add(seat);
    // Declara `back` para conservar referencias o estado que consumen las operaciones siguientes de este ámbito.
    var back=mesh(rbox(0.46,0.58,0.075,0.04),fab); back.position.set(0,0.86,0.22); back.rotation.x=rad(8); g.add(back);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sx=-1;sx<=1;sx+=2){
      // Declara `armPost` para conservar referencias o estado consumidos por las operaciones siguientes.
      var armPost=box(0.025,0.22,0.025,met); armPost.position.set(sx*0.245,0.64,0.02); g.add(armPost);
      // Declara `armPad` para conservar referencias o estado consumidos por las operaciones siguientes.
      var armPad=mesh(rbox(0.065,0.025,0.24,0.012),fab); armPad.position.set(sx*0.245,0.76,0.02); g.add(armPad);
    }
    // Declara `head` para conservar referencias o estado consumidos por las operaciones siguientes.
    var head=mesh(rbox(0.31,0.12,0.065,0.03),fab); head.position.set(0,1.18,0.27); head.rotation.x=rad(8); g.add(head);
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }
  // Define la rutina `basicOfficeChair`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function basicOfficeChair(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group(); g.name='chair-basic';
    // Declara `fab` para conservar referencias o estado consumidos por las operaciones siguientes.
    var fab=surfaceMat(0x3f4853,'leather',{r:0.74}), met=mat(0x4b535c,{r:0.52,m:0.35});
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    chairStarBase(g,4);
    // Declara `seat` para conservar referencias o estado consumidos por las operaciones siguientes.
    var seat=mesh(rbox(0.46,0.075,0.43,0.025),fab); seat.position.y=0.49; g.add(seat);
    // Declara `support` para conservar referencias o estado consumidos por las operaciones siguientes.
    var support=box(0.055,0.42,0.045,met); support.position.set(0,0.70,0.19); support.rotation.x=rad(5); g.add(support);
    // Declara `back` para conservar referencias o estado consumidos por las operaciones siguientes.
    var back=mesh(rbox(0.40,0.39,0.065,0.025),fab); back.position.set(0,0.86,0.22); back.rotation.x=rad(5); g.add(back);
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }
  // Define la rutina `diningChair`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function diningChair(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group(); g.name='chair-dining';
    // Declara `wood` para conservar referencias o estado consumidos por las operaciones siguientes.
    var wood=mat(0x9a6740,{r:0.78,m:0.01}), edge=mat(0x71472d,{r:0.82,m:0.01});
    // Declara `seat` para conservar referencias o estado consumidos por las operaciones siguientes.
    var seat=mesh(rbox(0.46,0.075,0.42,0.018),wood); seat.position.y=0.48; g.add(seat);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sx=-1;sx<=1;sx+=2){
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var sz=-1;sz<=1;sz+=2){
        // Declara `leg` para conservar referencias o estado consumidos por las operaciones siguientes.
        var leg=mesh(rbox(0.045,0.48,0.045,0.008),edge); leg.position.set(sx*0.18,0.24,sz*0.16); leg.rotation.z=rad(-sx*3); leg.rotation.x=rad(sz*3); g.add(leg);
      }
    }
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var bx=-1;bx<=1;bx+=2){
      // Declara `upright` para conservar referencias o estado consumidos por las operaciones siguientes.
      var upright=mesh(rbox(0.045,0.58,0.045,0.008),edge); upright.position.set(bx*0.18,0.76,0.18); g.add(upright);
    }
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var y=0.67;y<=1.00;y+=0.11){
      // Declara `slat` para conservar referencias o estado consumidos por las operaciones siguientes.
      var slat=mesh(rbox(0.39,0.045,0.035,0.008),wood); slat.position.set(0,y,0.18); g.add(slat);
    }
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }
  // Define la rutina `bChair`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bChair(){
    // Declara `root` para conservar referencias o estado consumidos por las operaciones siguientes.
    var root=new THREE.Group();
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    root.add(ergonomicChair(),basicOfficeChair(),diningChair());
    // Define una devolución que la API invoca con cada valor o al ocurrir la transición.
    root.children.forEach(function(chair){ chair.visible=false; });
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return root;
  }

  /* Monitor (contextual, generico) */
  // Define la rutina `bMonitor`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bMonitor(){ var g=new THREE.Group(); var body=mat(COL.dark,{r:0.5,m:0.2});
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(mesh(rbox(0.62,0.36,0.035,0.012),body));
    // Declara `s` para conservar referencias o estado consumidos por las operaciones siguientes.
    var s=mesh(new THREE.PlaneGeometry(0.575,0.32),screenMat('current')); s.name='screen-contextual'; s.position.z=0.0185; g.add(s);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    g.userData.baseY=0.30; return g; }

  /* Notebook (contextual, generica) */
  // Define la rutina `bLaptop`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bLaptop(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `body` para conservar referencias o estado consumidos por las operaciones siguientes.
    var body=mat(COL.alu,{m:0.62,r:0.36});
    // Declara `edge` para conservar referencias o estado consumidos por las operaciones siguientes.
    var edge=mat(0x778290,{m:0.58,r:0.44});
    // Declara `keyM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var keyM=mat(0x1d2228,{r:0.62,m:0.05});
    // Declara `deckM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var deckM=mat(0x323942,{r:0.58,m:0.12});
    // Declara `glassM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var glassM=mat(0x0a1118,{r:0.48,m:0.03});

    // Declara `base` para conservar referencias o estado consumidos por las operaciones siguientes.
    var base=mesh(rbox(0.39,0.022,0.265,0.012),body);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    base.position.y=0.011;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(base);

    // Declara `frontLip` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frontLip=mesh(rbox(0.37,0.004,0.010,0.004),edge);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    frontLip.position.set(0,0.024,0.126);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    frontLip.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(frontLip);

    // Declara `deck` para conservar referencias o estado consumidos por las operaciones siguientes.
    var deck=mesh(rbox(0.335,0.003,0.132,0.006),deckM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    deck.position.set(0,0.025,-0.012);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    deck.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(deck);

    // Declara `keyGeometry` para conservar referencias o estado consumidos por las operaciones siguientes.
    var keyGeometry=new THREE.BoxGeometry(0.018,0.003,0.014);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var row=0;row<4;row++){
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var col=0;col<12;col++){
        // Declara `key` para conservar referencias o estado consumidos por las operaciones siguientes.
        var key=mesh(keyGeometry,keyM);
        // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
        key.position.set(-0.126+col*0.023,0.029,-0.060+row*0.021);
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        key.castShadow=false;
        // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
        g.add(key);
      }
    }
    // Declara `space` para conservar referencias o estado consumidos por las operaciones siguientes.
    var space=mesh(rbox(0.110,0.003,0.014,0.003),keyM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    space.position.set(0,0.029,0.026);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    space.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(space);

    // Declara `trackpad` para conservar referencias o estado consumidos por las operaciones siguientes.
    var trackpad=mesh(rbox(0.105,0.002,0.060,0.006),mat(0x66707c,{m:0.42,r:0.50}));
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    trackpad.position.set(0,0.027,0.080);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    trackpad.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(trackpad);

    // Declara `hinge` para conservar referencias o estado consumidos por las operaciones siguientes.
    var hinge=mesh(new THREE.CylinderGeometry(0.008,0.008,0.345,18),edge);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    hinge.rotation.z=Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    hinge.position.set(0,0.032,-0.126);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(hinge);

    // Declara `lid` para conservar referencias o estado consumidos por las operaciones siguientes.
    var lid=new THREE.Group();
    // Declara `lidShell` para conservar referencias o estado consumidos por las operaciones siguientes.
    var lidShell=mesh(rbox(0.39,0.252,0.014,0.010),body);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    lid.add(lidShell);
    // Declara `bezel` para conservar referencias o estado consumidos por las operaciones siguientes.
    var bezel=mesh(rbox(0.356,0.218,0.003,0.004),glassM);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    bezel.position.z=0.008;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    bezel.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    lid.add(bezel);
    // Declara `disp` para conservar referencias o estado consumidos por las operaciones siguientes.
    var disp=mesh(new THREE.PlaneGeometry(0.325,0.193),screenMat('current'));
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    disp.name='screen-contextual';
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    disp.position.z=0.0102;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    lid.add(disp);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    lid.position.set(0,0.146,-0.124);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    lid.rotation.x=rad(-16);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(lid);

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    g.userData.baseY=0;
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* Base comun del monitor contextual. No representa un producto PrimOffice. */
  // Define la rutina `bMonitorBase`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bMonitorBase(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group(); var body=mat(0x3b424b,{r:0.48,m:0.42});
    // Declara `foot` para conservar referencias o estado consumidos por las operaciones siguientes.
    var foot=mesh(rbox(0.30,0.025,0.19,0.012),body); foot.position.y=0.013; g.add(foot);
    // Declara `post` para conservar referencias o estado consumidos por las operaciones siguientes.
    var post=mesh(rbox(0.055,0.25,0.045,0.012),body); post.position.set(0,0.135,-0.035); g.add(post);
    // Declara `neck` para conservar referencias o estado consumidos por las operaciones siguientes.
    var neck=mesh(rbox(0.18,0.045,0.04,0.01),body); neck.position.set(0,0.245,-0.018); g.add(neck);
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* pEase - reposamunecas acolchado delante del teclado. */
  // Define la rutina `bWristRest`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bWristRest(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `baseM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var baseM=surfaceMat(0x090b0d,'rubber',{r:0.90});
    // Declara `rimM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rimM=surfaceMat(0x15181b,'rubber',{r:0.80});
    // Declara `topM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var topM=surfaceMat(0x202428,'rubber',{r:0.76});
    // Declara `reliefM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var reliefM=mat(0x343a40,{r:0.58,m:0.02});

    // Declara `base` para conservar referencias o estado consumidos por las operaciones siguientes.
    var base=mesh(rbox(0.46,0.007,0.088,0.026),baseM);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    base.position.y=0.0035; g.add(base);

    // Declara `rim` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rim=mesh(rbox(0.45,0.026,0.082,0.026),rimM);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    rim.position.y=0.017; g.add(rim);

    // Declara `top` para conservar referencias o estado consumidos por las operaciones siguientes.
    var top=mesh(rbox(0.416,0.012,0.056,0.018),topM);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    top.position.y=0.030; top.castShadow=false; g.add(top);

    /* Campo de celdas hexagonales poco profundas, construido como relieve
       real para que se lea en perspectiva y no dependa de una textura. */
    // Declara `hexGeo` para conservar referencias o estado consumidos por las operaciones siguientes.
    var hexGeo=new THREE.CylinderGeometry(0.0086,0.0086,0.0038,6);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var row=0;row<4;row++){
      // Declara `z` para conservar referencias o estado consumidos por las operaciones siguientes.
      var z=-0.021+row*0.014;
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var col=0;col<19;col++){
        // Declara `x` para conservar referencias o estado consumidos por las operaciones siguientes.
        var x=-0.188+col*0.021+(row%2?0.0105:0);
        // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
        if(Math.abs(x)>0.195)continue;
        // Declara `cell` para conservar referencias o estado consumidos por las operaciones siguientes.
        var cell=mesh(hexGeo,reliefM);
        // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
        cell.position.set(x,0.0375,z); cell.rotation.y=rad(30); cell.castShadow=false; g.add(cell);
      }
    }
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* pLumbar - soporte lumbar abierto de malla sobre el respaldo contextual. */
  // Define la rutina `bLumbar`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bLumbar(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `frameM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frameM=surfaceMat(0x14181c,'rubber',{r:0.82});
    // Declara `strapM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var strapM=surfaceMat(0x1b2025,'fabric',{r:0.94});
    // Declara `panelM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var panelM=surfaceMat(0x20262c,'rubber',{r:0.80});
    // Declara `nodeM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var nodeM=mat(0x101419,{r:0.62,m:0.03});

    // Define la rutina `bowedZ`: recibe `x`, `y` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function bowedZ(x,y){
      // Declara `nx` para conservar referencias o estado consumidos por las operaciones siguientes.
      var nx=Math.min(1,Math.abs(x)/0.18), ny=Math.min(1,Math.abs(y)/0.16);
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return -0.058*(1-nx*nx)*(0.86+0.14*(1-ny*ny));
    }

    // Declara `framePoints` para conservar referencias o estado consumidos por las operaciones siguientes.
    var framePoints=[
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.Vector3(-0.18,-0.145,0.004),new THREE.Vector3(-0.20,-0.045,0.002),
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.Vector3(-0.19,0.105,0.001),new THREE.Vector3(-0.13,0.158,-0.014),
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.Vector3(0,0.172,-0.034),new THREE.Vector3(0.13,0.158,-0.014),
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.Vector3(0.19,0.105,0.001),new THREE.Vector3(0.20,-0.045,0.002),
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.Vector3(0.18,-0.145,0.004),new THREE.Vector3(0,-0.164,-0.030)
    ];
    // Declara `frameCurve` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frameCurve=new THREE.CatmullRomCurve3(framePoints,true,'catmullrom',0.18);
    // Declara `frame` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frame=mesh(new THREE.TubeGeometry(frameCurve,80,0.011,8,true),frameM);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(frame);

    /* Malla abierta: una superficie casi transparente mas su reticula
       triangulada, ambas curvadas hacia adelante en el centro. */
    // Declara `meshGeo` para conservar referencias o estado consumidos por las operaciones siguientes.
    var meshGeo=new THREE.PlaneGeometry(0.34,0.285,12,14);
    // Declara `positions` para conservar referencias o estado consumidos por las operaciones siguientes.
    var positions=meshGeo.attributes.position;
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var i=0;i<positions.count;i++){
      // Declara `px` para conservar referencias o estado consumidos por las operaciones siguientes.
      var px=positions.getX(i), py=positions.getY(i);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      positions.setZ(i,bowedZ(px,py));
    }
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    positions.needsUpdate=true; meshGeo.computeVertexNormals();
    // Declara `veilM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var veilM=new THREE.MeshStandardMaterial({color:0x202830,roughness:0.92,metalness:0,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false});
    // Declara `gridM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var gridM=new THREE.MeshStandardMaterial({color:0x59636d,roughness:0.90,metalness:0,transparent:true,opacity:0.42,side:THREE.DoubleSide,wireframe:true,depthWrite:false});
    // Declara `veil` para conservar referencias o estado consumidos por las operaciones siguientes.
    var veil=mesh(meshGeo,veilM); veil.castShadow=false; veil.renderOrder=2; g.add(veil);
    // Declara `grid` para conservar referencias o estado consumidos por las operaciones siguientes.
    var grid=mesh(meshGeo.clone(),gridM); grid.castShadow=false; grid.renderOrder=3; g.add(grid);

    /* Correas por detras de la malla, visibles a traves de la abertura. */
    // Declara `horizontal` para conservar referencias o estado consumidos por las operaciones siguientes.
    var horizontal=mesh(rbox(0.39,0.026,0.009,0.008),strapM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    horizontal.position.set(0,-0.010,0.009); horizontal.castShadow=false; g.add(horizontal);
    // Declara `vertical` para conservar referencias o estado consumidos por las operaciones siguientes.
    var vertical=mesh(rbox(0.026,0.305,0.009,0.008),strapM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    vertical.position.set(0,0,0.009); vertical.castShadow=false; g.add(vertical);

    /* Panel central abierto con nodulos de masaje en relieve. */
    // Declara `panelZ` para conservar referencias o estado consumidos por las operaciones siguientes.
    var panelZ=-0.064;
    // Declara `sideL` para conservar referencias o estado consumidos por las operaciones siguientes.
    var sideL=mesh(rbox(0.014,0.218,0.018,0.008),panelM); sideL.position.set(-0.069,0,panelZ); g.add(sideL);
    // Declara `sideR` para conservar referencias o estado consumidos por las operaciones siguientes.
    var sideR=mesh(rbox(0.014,0.218,0.018,0.008),panelM); sideR.position.set(0.069,0,panelZ); g.add(sideR);
    // Declara `panelTop` para conservar referencias o estado consumidos por las operaciones siguientes.
    var panelTop=mesh(rbox(0.138,0.014,0.018,0.008),panelM); panelTop.position.set(0,0.102,panelZ); g.add(panelTop);
    // Declara `panelBottom` para conservar referencias o estado consumidos por las operaciones siguientes.
    var panelBottom=mesh(rbox(0.138,0.014,0.018,0.008),panelM); panelBottom.position.set(0,-0.102,panelZ); g.add(panelBottom);

    // Declara `nodeGeo` para conservar referencias o estado consumidos por las operaciones siguientes.
    var nodeGeo=new THREE.SphereGeometry(0.008,8,5);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var ny=0;ny<6;ny++){
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var nx=0;nx<4;nx++){
        // Declara `node` para conservar referencias o estado consumidos por las operaciones siguientes.
        var node=mesh(nodeGeo,nodeM);
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        node.scale.z=0.55;
        // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
        node.position.set(-0.045+nx*0.030,-0.075+ny*0.030,panelZ-0.012);
        // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
        node.castShadow=false; g.add(node);
      }
    }
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* Contexto diagnostico: cables, cargadores, papeles y rutas resueltas. */
  // Define la rutina `bDeskContext`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bDeskContext(){
    // Declara `root` para conservar referencias o estado consumidos por las operaciones siguientes.
    var root=new THREE.Group();
    // Declara `paperM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var paperM=surfaceMat(0xe4dccb,'paper',{r:0.97}), paperAlt=surfaceMat(0xc8dce7,'paper',{r:0.96});
    // Declara `inkM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var inkM=mat(0x8d98a3,{r:0.9});
    // Declara `bookMats` para conservar referencias o estado consumidos por las operaciones siguientes.
    var bookMats=[mat(0x766b5d,{r:0.88}),mat(0x9d6b53,{r:0.88}),mat(0x556979,{r:0.88}),mat(0xc7b18a,{r:0.90})];

    // Define la rutina `group`: recibe `name` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function group(name){ var g=new THREE.Group(); g.name=name; g.visible=false; root.add(g); return g; }
    // Define la rutina `paper`: recibe `parent`, `x`, `z`, `ry`, `count`, `color` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function paper(parent,x,z,ry,count,color){
      // Declara `stack` para conservar referencias o estado consumidos por las operaciones siguientes.
      var stack=new THREE.Group(); stack.position.set(x,0,z); stack.rotation.y=ry||0; parent.add(stack);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      count=count||1;
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var i=0;i<count;i++){
        // Declara `p` para conservar referencias o estado consumidos por las operaciones siguientes.
        var p=mesh(rbox(0.18,0.0025,0.23,0.004),color||paperM);
        // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
        p.position.set(i*0.004,0.004+i*0.0025,-i*0.003); p.rotation.y=rad(i*1.4); stack.add(p);
      }
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var line=0;line<3;line++){
        // Declara `mark` para conservar referencias o estado consumidos por las operaciones siguientes.
        var mark=box(0.105-line*0.012,0.001,0.004,inkM);
        // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
        mark.position.set(-0.018,0.006+count*0.0025,-0.055+line*0.020); mark.castShadow=false; stack.add(mark);
      }
    }
    // Define la rutina `displacedKeyboard`: recibe `parent`, `x`, `z`, `ry` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function displacedKeyboard(parent,x,z,ry){
      // Declara `unit` para conservar referencias o estado consumidos por las operaciones siguientes.
      var unit=new THREE.Group(); unit.position.set(x,0.004,z); unit.rotation.y=ry||0; parent.add(unit);
      // Declara `basicCase` para conservar referencias o estado consumidos por las operaciones siguientes.
      var basicCase=mat(0x656b6f,{r:0.84,m:0.02}), basicKey=mat(0x92979a,{r:0.88,m:0.01});
      // Declara `base` para conservar referencias o estado consumidos por las operaciones siguientes.
      var base=mesh(rbox(0.36,0.018,0.128,0.006),basicCase); base.position.y=0.009; unit.add(base);
      // Declara `keyGeometry` para conservar referencias o estado consumidos por las operaciones siguientes.
      var keyGeometry=new THREE.BoxGeometry(0.018,0.004,0.016);
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var row=0;row<4;row++){
        // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
        for(var col=0;col<11;col++){
          // Declara `key` para conservar referencias o estado consumidos por las operaciones siguientes.
          var key=mesh(keyGeometry,basicKey); key.position.set(-0.145+col*0.022,0.020,-0.040+row*0.022); key.castShadow=false; unit.add(key);
        }
        // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
        for(var pad=0;pad<3;pad++){
          // Declara `numKey` para conservar referencias o estado consumidos por las operaciones siguientes.
          var numKey=mesh(keyGeometry,basicKey); numKey.position.set(0.105+pad*0.022,0.020,-0.040+row*0.022); numKey.castShadow=false; unit.add(numKey);
        }
      }
      // Declara `space` para conservar referencias o estado consumidos por las operaciones siguientes.
      var space=mesh(new THREE.BoxGeometry(0.115,0.004,0.016),basicKey); space.position.set(-0.020,0.020,0.048); space.castShadow=false; unit.add(space);
    }
    // Define la rutina `bookStack`: recibe `parent`, `x`, `z`, `ry`, `count` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function bookStack(parent,x,z,ry,count){
      // Declara `unit` para conservar referencias o estado consumidos por las operaciones siguientes.
      var unit=new THREE.Group(); unit.position.set(x,0,z); unit.rotation.y=ry||0; parent.add(unit);
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var i=0;i<count;i++){
        // Declara `book` para conservar referencias o estado consumidos por las operaciones siguientes.
        var book=mesh(rbox(0.22-i*0.008,0.020,0.15+(i%2)*0.018,0.004),bookMats[i%bookMats.length]);
        // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
        book.position.set((i%2)*0.008,0.011+i*0.021,(i%3-1)*0.004); book.rotation.y=rad((i%2?1:-1)*2); unit.add(book);
      }
    }
    // Define la rutina `taskLamp`: recibe `parent`, `x`, `z` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function taskLamp(parent,x,z){
      // Declara `unit` para conservar referencias o estado consumidos por las operaciones siguientes.
      var unit=new THREE.Group(); unit.position.set(x,0,z); parent.add(unit);
      // Declara `lampM` para conservar referencias o estado consumidos por las operaciones siguientes.
      var lampM=mat(0x252a2f,{r:0.56,m:0.34});
      // Declara `base` para conservar referencias o estado consumidos por las operaciones siguientes.
      var base=mesh(new THREE.CylinderGeometry(0.070,0.078,0.018,22),lampM); base.position.y=0.009; unit.add(base);
      // Declara `stem` para conservar referencias o estado consumidos por las operaciones siguientes.
      var stem=mesh(new THREE.CylinderGeometry(0.009,0.011,0.29,12),lampM); stem.position.set(0,0.158,0.012); stem.rotation.z=rad(-7); unit.add(stem);
      // Declara `shade` para conservar referencias o estado consumidos por las operaciones siguientes.
      var shade=mesh(new THREE.ConeGeometry(0.066,0.105,20,1,true),lampM); shade.position.set(0.035,0.300,0.010); shade.rotation.z=rad(-20); unit.add(shade);
      // Declara `bulb` para conservar referencias o estado consumidos por las operaciones siguientes.
      var bulb=new THREE.PointLight(0xffcf95,0.30,1.15,2); bulb.position.set(0.052,0.260,0.012); bulb.castShadow=false; unit.add(bulb);
    }
    // Declara `currentBase` para conservar referencias o estado consumidos por las operaciones siguientes.
    var currentBase=group('context-current-base');
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    taskLamp(currentBase,-0.67,-0.26);

    // Declara `clean` para conservar referencias o estado consumidos por las operaciones siguientes.
    var clean=group('context-clean');

    // Declara `medium` para conservar referencias o estado consumidos por las operaciones siguientes.
    var medium=group('context-medium');
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    paper(medium,0.46,0.18,rad(-9),2); paper(medium,0.24,0.28,rad(8),1,paperAlt);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    bookStack(medium,-0.58,-0.20,rad(6),2);

    // Declara `messy` para conservar referencias o estado consumidos por las operaciones siguientes.
    var messy=group('context-messy');
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    paper(messy,0.47,0.14,rad(-16),3); paper(messy,-0.44,-0.04,rad(20),2,paperAlt); paper(messy,0.15,0.29,rad(7),1);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    displacedKeyboard(messy,-0.20,0.26,rad(14));
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    bookStack(messy,-0.58,-0.21,rad(8),4);

    // Declara `tidy` para conservar referencias o estado consumidos por las operaciones siguientes.
    var tidy=group('context-tidy');

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    root.userData.cableCounts={clean:0,medium:0,messy:0,tidy:0};
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return root;
  }

  /* pStandard — Soporte para Monitor de altura regulable (acero al carbono / epoxi, negro) */
  // Define la rutina `bMonStand`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bMonStand(){ var g=new THREE.Group(); var steel=mat(COL.steel,{m:0.5,r:0.42}), dk=mat(COL.steelDark,{m:0.5,r:0.5});
    // Declara `plat` para conservar referencias o estado consumidos por las operaciones siguientes.
    var plat=mesh(rbox(0.34,0.022,0.20,0.01),steel); plat.position.y=0.106; g.add(plat);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sx=-1;sx<=1;sx+=2){
      // Declara `leg` para conservar referencias o estado consumidos por las operaciones siguientes.
      var leg=mesh(rbox(0.03,0.10,0.16,0.006),steel); leg.position.set(sx*0.14,0.05,0); g.add(leg);
      // Declara `ft` para conservar referencias o estado consumidos por las operaciones siguientes.
      var ft=mesh(rbox(0.05,0.012,0.19,0.006),dk); ft.position.set(sx*0.14,0.006,0); g.add(ft);
    }
    // Declara `rail` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rail=mesh(rbox(0.30,0.012,0.02,0.004),steel); rail.position.set(0,0.045,0.085); g.add(rail);
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g; }

  /* pArm — Soporte para monitor con brazo articulado (negro, clamp al borde TRASERO del escritorio).
     Origen del grupo = punto de apoyo en la superficie, justo bajo el monitor (z = -0.18 mundo).
     El clamp se ancla en el borde trasero (z local -0.18) y el brazo lleva la placa VESA
     hasta el monitor (y ~ 0.44, z local ~ 0). Así NUNCA flota detrás del escritorio. */
  // Define la rutina `bMonArm`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bMonArm(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `blk` para conservar referencias o estado consumidos por las operaciones siguientes.
    var blk=mat(0x0e1012,{m:0.42,r:0.48});
    // Declara `shell` para conservar referencias o estado consumidos por las operaciones siguientes.
    var shell=mat(0x171a1d,{m:0.32,r:0.50});
    // Declara `edge` para conservar referencias o estado consumidos por las operaciones siguientes.
    var edge=mat(0x08090a,{m:0.36,r:0.62});
    // Declara `screwM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var screwM=mat(0xb7c3cc,{m:0.76,r:0.24});
    // Declara `rubber` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rubber=mat(0x050607,{m:0.18,r:0.70});

    // Declara `clampX` para conservar referencias o estado consumidos por las operaciones siguientes.
    var clampX=0.24, rearZ=-0.18, vesaZ=-0.014;

    // Define la rutina `bar3`: recibe `a`, `b`, `w`, `d`, `material`, `radius` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function bar3(a,b,w,d,material,radius){
      // Declara `dir` para conservar referencias o estado consumidos por las operaciones siguientes.
      var dir=new THREE.Vector3().subVectors(b,a);
      // Declara `len` para conservar referencias o estado consumidos por las operaciones siguientes.
      var len=dir.length();
      // Declara `n` para conservar referencias o estado consumidos por las operaciones siguientes.
      var n=dir.clone().normalize();
      // Declara `part` para conservar referencias o estado consumidos por las operaciones siguientes.
      var part=mesh(rbox(w,len,d,radius||0.014),material);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      part.position.copy(a).add(b).multiplyScalar(0.5);
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return part;
    }
    // Define la rutina `cyl3`: recibe `a`, `b`, `r`, `material`, `segments` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function cyl3(a,b,r,material,segments){
      // Declara `dir` para conservar referencias o estado consumidos por las operaciones siguientes.
      var dir=new THREE.Vector3().subVectors(b,a);
      // Declara `len` para conservar referencias o estado consumidos por las operaciones siguientes.
      var len=dir.length();
      // Declara `n` para conservar referencias o estado consumidos por las operaciones siguientes.
      var n=dir.clone().normalize();
      // Declara `part` para conservar referencias o estado consumidos por las operaciones siguientes.
      var part=mesh(new THREE.CylinderGeometry(r,r,len,segments||16),material);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      part.position.copy(a).add(b).multiplyScalar(0.5);
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return part;
    }
    // Define la rutina `frontDisk`: recibe `x`, `y`, `z`, `r`, `d`, `material`, `segments` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function frontDisk(x,y,z,r,d,material,segments){
      // Declara `part` para conservar referencias o estado consumidos por las operaciones siguientes.
      var part=mesh(new THREE.CylinderGeometry(r,r,d,segments||22),material);
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      part.rotation.x=Math.PI/2;
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      part.position.set(x,y,z);
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return part;
    }
    // Define la rutina `sideBar`: recibe `x`, `y`, `z`, `w`, `h`, `d`, `material`, `radius` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function sideBar(x,y,z,w,h,d,material,radius){
      // Declara `rr` para conservar referencias o estado consumidos por las operaciones siguientes.
      var rr=radius||0.006;
      // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
      rr=Math.min(rr,Math.min(w,h,d)*0.45);
      // Declara `part` para conservar referencias o estado consumidos por las operaciones siguientes.
      var part=mesh(rbox(w,h,d,rr),material);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      part.position.set(x,y,z);
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return part;
    }
    // Define la rutina `hinge`: recibe `p`, `r` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function hinge(p,r){
      // Declara `body` para conservar referencias o estado consumidos por las operaciones siguientes.
      var body=frontDisk(p.x,p.y,p.z,r,0.050,blk,24);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(body);
      // Declara `cap` para conservar referencias o estado consumidos por las operaciones siguientes.
      var cap=frontDisk(p.x,p.y,p.z+0.026,r*0.62,0.006,edge,20);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(cap);
      // Declara `bolt` para conservar referencias o estado consumidos por las operaciones siguientes.
      var bolt=frontDisk(p.x,p.y,p.z+0.030,r*0.24,0.004,screwM,14);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(bolt);
    }
    // Define la rutina `armHousing`: recibe `a`, `b`, `w`, `d`, `trimCylinderEnd` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function armHousing(a,b,w,d,trimCylinderEnd){
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(bar3(a,b,w,d,shell,0.018));
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      g.add(bar3(a.clone().add(new THREE.Vector3(0,0.002,0.003)),b.clone().add(new THREE.Vector3(0,0.002,0.003)),w*0.62,d*0.52,blk,0.014));
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      g.add(bar3(a.clone().add(new THREE.Vector3(0,-0.016,0.023)),b.clone().add(new THREE.Vector3(0,-0.016,0.023)),0.020,0.018,edge,0.008));

      // Declara `cylinderEnd` para conservar referencias o estado consumidos por las operaciones siguientes.
      var cylinderEnd=b.clone();
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(trimCylinderEnd){
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        cylinderEnd.add(new THREE.Vector3().subVectors(a,b).normalize().multiplyScalar(trimCylinderEnd));
      }
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      g.add(cyl3(a.clone().add(new THREE.Vector3(0,-0.019,0.026)),cylinderEnd.add(new THREE.Vector3(0,-0.019,0.026)),0.010,blk,16));
    }

    // Declara `clampTop` para conservar referencias o estado consumidos por las operaciones siguientes.
    var clampTop=mesh(rbox(0.150,0.026,0.116,0.014),blk);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    clampTop.position.set(clampX,0.013,rearZ);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(clampTop);

    // Declara `topCover` para conservar referencias o estado consumidos por las operaciones siguientes.
    var topCover=mesh(rbox(0.105,0.016,0.084,0.012),shell);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    topCover.position.set(clampX,0.034,rearZ);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(topCover);

    // Declara `clampBack` para conservar referencias o estado consumidos por las operaciones siguientes.
    var clampBack=mesh(rbox(0.046,0.148,0.034,0.008),blk);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    clampBack.position.set(clampX,-0.054,rearZ-0.052);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(clampBack);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var side=-1;side<=1;side+=2){
      // Declara `cheek` para conservar referencias o estado consumidos por las operaciones siguientes.
      var cheek=mesh(rbox(0.009,0.122,0.044,0.004),edge);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      cheek.position.set(clampX+side*0.028,-0.058,rearZ-0.034);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(cheek);
    }

    // Declara `clampFoot` para conservar referencias o estado consumidos por las operaciones siguientes.
    var clampFoot=mesh(rbox(0.090,0.019,0.058,0.006),rubber);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    clampFoot.position.set(clampX,-0.126,rearZ-0.001);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(clampFoot);

    // Declara `screw` para conservar referencias o estado consumidos por las operaciones siguientes.
    var screw=mesh(new THREE.CylinderGeometry(0.007,0.007,0.122,16),screwM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    screw.position.set(clampX,-0.078,rearZ+0.001);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(screw);

    // Declara `washer` para conservar referencias o estado consumidos por las operaciones siguientes.
    var washer=mesh(new THREE.CylinderGeometry(0.022,0.022,0.006,24),screwM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    washer.position.set(clampX,-0.028,rearZ+0.001);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(washer);

    // Declara `knob` para conservar referencias o estado consumidos por las operaciones siguientes.
    var knob=mesh(rbox(0.046,0.020,0.032,0.008),rubber);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    knob.position.set(clampX,-0.154,rearZ+0.001);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(knob);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var h=0;h<2;h++){
      // Declara `clampBolt` para conservar referencias o estado consumidos por las operaciones siguientes.
      var clampBolt=frontDisk(clampX,-0.020-h*0.050,rearZ-0.033,0.006,0.004,screwM,12);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(clampBolt);
    }

    // Declara `port` para conservar referencias o estado consumidos por las operaciones siguientes.
    var port=sideBar(clampX-0.040,0.037,rearZ+0.050,0.020,0.004,0.007,edge,0.003);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(port);
    // Declara `button` para conservar referencias o estado consumidos por las operaciones siguientes.
    var button=sideBar(clampX+0.040,0.037,rearZ+0.050,0.014,0.004,0.007,edge,0.003);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(button);

    // Declara `post` para conservar referencias o estado consumidos por las operaciones siguientes.
    var post=mesh(new THREE.CylinderGeometry(0.020,0.022,0.112,22),blk);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    post.position.set(clampX,0.094,rearZ);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(post);
    // Declara `lowerCollar` para conservar referencias o estado consumidos por las operaciones siguientes.
    var lowerCollar=mesh(new THREE.CylinderGeometry(0.030,0.030,0.020,22),shell);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    lowerCollar.position.set(clampX,0.043,rearZ);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(lowerCollar);
    // Declara `upperCollar` para conservar referencias o estado consumidos por las operaciones siguientes.
    var upperCollar=mesh(new THREE.CylinderGeometry(0.028,0.028,0.018,22),shell);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    upperCollar.position.set(clampX,0.151,rearZ);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(upperCollar);

    // Declara `p0` para conservar referencias o estado consumidos por las operaciones siguientes.
    var p0=new THREE.Vector3(clampX,0.166,rearZ);
    // Declara `p1` para conservar referencias o estado consumidos por las operaciones siguientes.
    var p1=new THREE.Vector3(0.176,0.308,-0.092);
    // Declara `p2` para conservar referencias o estado consumidos por las operaciones siguientes.
    var p2=new THREE.Vector3(0.018,0.448,vesaZ);

    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    hinge(p0,0.032);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    armHousing(p0,p1,0.050,0.036);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    hinge(p1,0.034);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    armHousing(p1,p2,0.052,0.038,0.030);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    hinge(p2,0.027);

    // Declara `tilt` para conservar referencias o estado consumidos por las operaciones siguientes.
    var tilt=mesh(new THREE.CylinderGeometry(0.018,0.018,0.060,18),blk);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    tilt.rotation.z=Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    tilt.position.set(0.001,0.444,vesaZ-0.002);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(tilt);

    // Declara `link` para conservar referencias o estado consumidos por las operaciones siguientes.
    var link=bar3(new THREE.Vector3(0.020,0.448,vesaZ-0.001),new THREE.Vector3(0.000,0.438,vesaZ-0.006),0.038,0.026,blk,0.009);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(link);

    // Declara `vesaCore` para conservar referencias o estado consumidos por las operaciones siguientes.
    var vesaCore=mesh(rbox(0.070,0.088,0.012,0.010),blk);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    vesaCore.position.set(0,0.438,vesaZ-0.012);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(vesaCore);

    // Declara `vesaDisk` para conservar referencias o estado consumidos por las operaciones siguientes.
    var vesaDisk=mesh(new THREE.CylinderGeometry(0.030,0.030,0.010,20),shell);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    vesaDisk.rotation.x=Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    vesaDisk.position.set(0,0.438,vesaZ-0.002);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(vesaDisk);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sx=-1;sx<=1;sx+=2)for(var sy=-1;sy<=1;sy+=2){
      // Declara `lobe` para conservar referencias o estado consumidos por las operaciones siguientes.
      var lobe=mesh(new THREE.SphereGeometry(0.018,14,10),blk);
      // Ajusta la escala tridimensional sin reconstruir la geometría.
      lobe.scale.set(1.08,1.20,0.34);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      lobe.position.set(sx*0.046,0.438+sy*0.040,vesaZ-0.012);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(lobe);

      // Declara `slot` para conservar referencias o estado consumidos por las operaciones siguientes.
      var slot=sideBar(sx*0.038,0.438+sy*0.042,vesaZ-0.004,0.008,0.020,0.003,edge,0.004);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(slot);

      // Declara `screwHead` para conservar referencias o estado consumidos por las operaciones siguientes.
      var screwHead=mesh(new THREE.CylinderGeometry(0.005,0.005,0.004,12),screwM);
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      screwHead.rotation.x=Math.PI/2;
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      screwHead.position.set(sx*0.043,0.438+sy*0.034,vesaZ+0.000);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(screwHead);
    }

    // Declara `topBite` para conservar referencias o estado consumidos por las operaciones siguientes.
    var topBite=frontDisk(0,0.491,vesaZ-0.004,0.018,0.003,edge,18);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(topBite);
    // Declara `bottomBite` para conservar referencias o estado consumidos por las operaciones siguientes.
    var bottomBite=frontDisk(0,0.385,vesaZ-0.004,0.018,0.003,edge,18);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(bottomBite);

    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }
  // Define la rutina `joint`: recibe `x`, `y`, `z`, `r`, `m` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function joint(x,y,z,r,m){ var s=mesh(new THREE.SphereGeometry(r,12,10),m); s.position.set(x,y,z); return s; }

  /* pNotebook — Soporte ergonomico elevador para notebook (aluminio, inclinado) */
  // Define la rutina `bStand`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bStand(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `black` para conservar referencias o estado consumidos por las operaciones siguientes.
    var black=mat(0x111316,{m:0.22,r:0.46});
    // Declara `satin` para conservar referencias o estado consumidos por las operaciones siguientes.
    var satin=mat(0x262a2d,{m:0.18,r:0.52});
    // Declara `pad` para conservar referencias o estado consumidos por las operaciones siguientes.
    var pad=mat(0xb5b8b2,{m:0.04,r:0.82});
    // Declara `slotM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var slotM=mat(0x050607,{r:0.78,m:0.04});

    // Define la rutina `railBetween`: recibe `a`, `b`, `w`, `d`, `material`, `radius` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function railBetween(a,b,w,d,material,radius){
      // Declara `dir` para conservar referencias o estado consumidos por las operaciones siguientes.
      var dir=new THREE.Vector3().subVectors(b,a);
      // Declara `len` para conservar referencias o estado consumidos por las operaciones siguientes.
      var len=dir.length();
      // Declara `n` para conservar referencias o estado consumidos por las operaciones siguientes.
      var n=dir.clone().normalize();
      // Declara `part` para conservar referencias o estado consumidos por las operaciones siguientes.
      var part=mesh(rbox(w,len,d,radius||0.008),material);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      part.position.copy(a).add(b).multiplyScalar(0.5);
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return part;
    }

    /* Base en U de 26 x 22 cm, rasgo principal de la referencia oficial. */
    // Declara `baseL` para conservar referencias o estado consumidos por las operaciones siguientes.
    var baseL=mesh(rbox(0.028,0.011,0.230,0.010),black); baseL.position.set(-0.112,0.006,0); g.add(baseL);
    // Declara `baseR` para conservar referencias o estado consumidos por las operaciones siguientes.
    var baseR=mesh(rbox(0.028,0.011,0.230,0.010),black); baseR.position.set(0.112,0.006,0); g.add(baseR);
    // Declara `baseF` para conservar referencias o estado consumidos por las operaciones siguientes.
    var baseF=mesh(rbox(0.252,0.011,0.026,0.009),black); baseF.position.set(0,0.006,0.103); g.add(baseF);
    // Declara `baseB` para conservar referencias o estado consumidos por las operaciones siguientes.
    var baseB=mesh(rbox(0.252,0.011,0.026,0.009),black); baseB.position.set(0,0.006,-0.103); g.add(baseB);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sx=-1;sx<=1;sx+=2){
      // Declara `sideCurve` para conservar referencias o estado consumidos por las operaciones siguientes.
      var sideCurve=new THREE.CatmullRomCurve3([
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.112,0.014,0.104),
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.112,0.012,-0.088),
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.110,0.060,-0.116),
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.106,0.138,-0.104),
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.080,0.158,-0.068),
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.073,0.133,0.108)
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      ],false,'catmullrom',0.18);
      // Declara `sideHoop` para conservar referencias o estado consumidos por las operaciones siguientes.
      var sideHoop=mesh(new THREE.TubeGeometry(sideCurve,34,0.0095,10,false),black);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(sideHoop);

      // Declara `rear` para conservar referencias o estado consumidos por las operaciones siguientes.
      var rear=mesh(rbox(0.026,0.145,0.030,0.011),black);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      rear.position.set(sx*0.108,0.078,-0.088); g.add(rear);

      // Declara `slot` para conservar referencias o estado consumidos por las operaciones siguientes.
      var slot=mesh(rbox(0.005,0.040,0.012,0.006),slotM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      slot.position.set(sx*0.122,0.090,-0.079); slot.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(slot);

      /* Dos superficies anchas, no cuatro barras finas: silueta reconocible
         y contacto paralelo con la notebook contextual. */
      // Declara `rail` para conservar referencias o estado consumidos por las operaciones siguientes.
      var rail=railBetween(
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.072,0.107,0.108),
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.072,0.155,-0.096),
        // Continúa la construcción o actualización del adaptador con la operación de esta línea.
        0.062,0.014,black,0.009
      );
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(rail);

      // Declara `railPad` para conservar referencias o estado consumidos por las operaciones siguientes.
      var railPad=railBetween(
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.072,0.115,0.094),
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(sx*0.072,0.159,-0.078),
        // Continúa la construcción o actualización del adaptador con la operación de esta línea.
        0.046,0.004,pad,0.004
      );
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      railPad.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(railPad);

      // Declara `stop` para conservar referencias o estado consumidos por las operaciones siguientes.
      var stop=mesh(rbox(0.062,0.024,0.014,0.006),black);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      stop.position.set(sx*0.072,0.111,0.120);
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      stop.rotation.x=rad(13);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(stop);

      // Declara `stopPad` para conservar referencias o estado consumidos por las operaciones siguientes.
      var stopPad=mesh(rbox(0.052,0.005,0.012,0.004),pad);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      stopPad.position.set(sx*0.072,0.124,0.115);
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      stopPad.rotation.x=rad(13);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      stopPad.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(stopPad);

      // Declara `stopFace` para conservar referencias o estado consumidos por las operaciones siguientes.
      var stopFace=mesh(rbox(0.044,0.004,0.010,0.003),satin);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      stopFace.position.set(sx*0.072,0.120,0.116);
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      stopFace.rotation.x=rad(13);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      stopFace.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(stopFace);
    }

    // Declara `rearBrace` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rearBrace=mesh(rbox(0.218,0.014,0.020,0.007),black);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    rearBrace.position.set(0,0.153,-0.104);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    rearBrace.rotation.x=rad(13);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(rearBrace);

    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* pMechanic — Teclado mecanico compacto RGB (negro, underglow) */
  // Define la rutina `bKeyboard`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bKeyboard(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `caseM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var caseM=mat(0x151719,{r:0.48,m:0.18});
    // Declara `deckM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var deckM=mat(0x25282b,{r:0.54,m:0.12});
    // Declara `keyM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var keyM=mat(0x202326,{r:0.62,m:0.03});
    // Declara `keyTopM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var keyTopM=mat(0x2a2d30,{r:0.68,m:0.02});
    // Declara `edgeM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var edgeM=mat(0x0d0f11,{r:0.58,m:0.20});
    // Declara `rgb` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rgb=[0xf43f5e,0xf59e0b,0x84cc16,0x10b981,0x22d3ee,0x6366f1,0xd946ef];
    // Declara `U` para conservar referencias o estado consumidos por las operaciones siguientes.
    var U=0.0228, GAP=0.0022, mainLeft=-0.203;

    // Declara `base` para conservar referencias o estado consumidos por las operaciones siguientes.
    var base=mesh(rbox(0.426,0.014,0.146,0.007),caseM);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    base.position.y=0.007;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(base);

    // Declara `deck` para conservar referencias o estado consumidos por las operaciones siguientes.
    var deck=mesh(rbox(0.416,0.005,0.136,0.006),deckM);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    deck.position.y=0.0155;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(deck);

    // Declara `frontEdge` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frontEdge=mesh(rbox(0.418,0.005,0.009,0.004),edgeM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    frontEdge.position.set(0,0.006,0.069);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(frontEdge);

    // Define la rutina `glowMat`: recibe `c` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function glowMat(c){ return mat(0x08090a,{e:c,ei:0.32,r:0.72}); }
    // Define la rutina `legendMat`: recibe `c` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function legendMat(c){ return mat(0x35383c,{e:c,ei:0.38,r:0.70}); }

    // Define la rutina `addKey`: recibe `x`, `z`, `units`, `ci`, `depth` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function addKey(x,z,units,ci,depth){
      // Declara `w` para conservar referencias o estado consumidos por las operaciones siguientes.
      var w=U*units-GAP;
      // Declara `d` para conservar referencias o estado consumidos por las operaciones siguientes.
      var d=depth||0.0186;
      // Declara `under` para conservar referencias o estado consumidos por las operaciones siguientes.
      var under=mesh(rbox(Math.max(0.008,w-0.003),0.0014,d-0.002,0.002),glowMat(rgb[ci%rgb.length]));
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      under.position.set(x,0.019,z);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      under.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(under);

      // Declara `cap` para conservar referencias o estado consumidos por las operaciones siguientes.
      var cap=mesh(rbox(w,0.010,d,0.003),keyM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      cap.position.set(x,0.025,z);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(cap);

      // Declara `top` para conservar referencias o estado consumidos por las operaciones siguientes.
      var top=mesh(rbox(Math.max(0.006,w-0.004),0.0014,d-0.004,0.002),keyTopM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      top.position.set(x,0.0304,z-0.0007);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      top.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(top);

      // Declara `markW` para conservar referencias o estado consumidos por las operaciones siguientes.
      var markW=Math.min(Math.max(w*0.28,0.004),0.009);
      // Declara `legend` para conservar referencias o estado consumidos por las operaciones siguientes.
      var legend=box(markW,0.0012,0.0017,legendMat(rgb[ci%rgb.length]));
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      legend.position.set(x,0.0313,z-0.002);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      legend.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(legend);
    }

    // Define la rutina `addRow`: recibe `z`, `units`, `offset` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function addRow(z,units,offset){
      // Declara `cursor` para conservar referencias o estado consumidos por las operaciones siguientes.
      var cursor=mainLeft;
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      units.forEach(function(unitsWide,i){
        // Declara `x` para conservar referencias o estado consumidos por las operaciones siguientes.
        var x=cursor+U*unitsWide/2;
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        addKey(x,z,unitsWide,offset+i);
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        cursor+=U*unitsWide;
      });
    }

    /* Bloque principal ANSI compacto de 15 unidades. */
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addRow(-0.031,[1,1,1,1,1,1,1,1,1,1,1,1,1,2],0);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addRow(-0.008,[1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5],1);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addRow(0.015,[1.75,1,1,1,1,1,1,1,1,1,1,1,2.25],2);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addRow(0.038,[2.25,1,1,1,1,1,1,1,1,1,1,2.75],3);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addRow(0.061,[1.25,1.25,1.25,6.25,1.25,1.25,1.25,1.25],4);

    /* Fila de funciones con separaciones reales entre grupos. */
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addKey(-0.192,-0.055,1,0,0.0165);
    // Define una devolución que la API invoca con cada valor o al ocurrir la transición.
    [-0.151,-0.127,-0.103,-0.079,-0.043,-0.019,0.005,0.029,0.065,0.089,0.113,0.137].forEach(function(x,i){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      addKey(x,-0.055,0.86,i+1,0.0165);
    });

    /* Navegacion de tres columnas y bloque de flechas independiente. */
    // Declara `navX` para conservar referencias o estado consumidos por las operaciones siguientes.
    var navX=[0.153,0.177,0.201];
    // Define una devolución que la API invoca con cada valor o al ocurrir la transición.
    [-0.055,-0.031,-0.008].forEach(function(z,row){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      navX.forEach(function(x,col){ addKey(x,z,0.92,5+row*3+col,z===-0.055?0.0165:0.0186); });
    });
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addKey(0.177,0.038,0.92,4);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addKey(0.153,0.061,0.92,5);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addKey(0.177,0.061,0.92,6);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addKey(0.201,0.061,0.92,0);

    /* Espaciadora oficial ancha con indicador central discreto. */
    // Declara `spaceIndicator` para conservar referencias o estado consumidos por las operaciones siguientes.
    var spaceIndicator=box(0.020,0.0013,0.0018,legendMat(0x22c55e));
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    spaceIndicator.position.set(-0.003,0.0315,0.058);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    spaceIndicator.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(spaceIndicator);

    /* Sector derecho libre con marca e indicadores de estado. */
    // Declara `brandA` para conservar referencias o estado consumidos por las operaciones siguientes.
    var brandA=box(0.003,0.0012,0.012,mat(0xb8bec5,{r:0.66,m:0.04}));
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    brandA.position.set(0.161,0.019,0.017);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    brandA.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(brandA);
    // Declara `brandB` para conservar referencias o estado consumidos por las operaciones siguientes.
    var brandB=box(0.018,0.0012,0.002,mat(0x7f8790,{r:0.68,m:0.04}));
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    brandB.position.set(0.174,0.019,0.022);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    brandB.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(brandB);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var led=0;led<3;led++){
      // Declara `indicator` para conservar referencias o estado consumidos por las operaciones siguientes.
      var indicator=box(0.007,0.0014,0.0022,legendMat(led===0?0x22c55e:0x94a3b8));
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      indicator.position.set(0.197,0.019,0.010+led*0.006);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      indicator.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(indicator);
    }

    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* pMouseProV — mouse vertical ergonomico, variante oficial negra */
  // Define la rutina `bMouse`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bMouse(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();

    // Define la rutina `roundedRect`: recibe `ctx`, `x`, `y`, `w`, `h`, `r` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function roundedRect(ctx,x,y,w,h,r){
      // Declara `rr` para conservar referencias o estado consumidos por las operaciones siguientes.
      var rr=Math.min(r,w/2,h/2);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.beginPath();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.moveTo(x+rr,y);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.lineTo(x+w-rr,y);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.quadraticCurveTo(x+w,y,x+w,y+rr);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.lineTo(x+w,y+h-rr);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.lineTo(x+rr,y+h);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.quadraticCurveTo(x,y+h,x,y+h-rr);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.lineTo(x,y+rr);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.quadraticCurveTo(x,y,x+rr,y);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.closePath();
    }

    // Define la rutina `canvasTexture`: recibe `canvas`, `isColor` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function canvasTexture(canvas,isColor){
      // Declara `tex` para conservar referencias o estado consumidos por las operaciones siguientes.
      var tex=new THREE.CanvasTexture(canvas);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      tex.wrapS=THREE.ClampToEdgeWrapping;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      tex.wrapT=THREE.ClampToEdgeWrapping;
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(isColor && 'colorSpace' in tex) tex.colorSpace=THREE.SRGBColorSpace;
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return tex;
    }

    // Define la rutina `makeShellMaps`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function makeShellMaps(){
      // Declara `colorCanvas` para conservar referencias o estado consumidos por las operaciones siguientes.
      var colorCanvas=document.createElement('canvas');
      // Declara `bumpCanvas` para conservar referencias o estado consumidos por las operaciones siguientes.
      var bumpCanvas=document.createElement('canvas');
      // Declara `roughCanvas` para conservar referencias o estado consumidos por las operaciones siguientes.
      var roughCanvas=document.createElement('canvas');
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      colorCanvas.width=colorCanvas.height=256;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      bumpCanvas.width=bumpCanvas.height=256;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      roughCanvas.width=roughCanvas.height=256;
      // Declara `color` para conservar referencias o estado consumidos por las operaciones siguientes.
      var color=colorCanvas.getContext('2d');
      // Declara `bump` para conservar referencias o estado consumidos por las operaciones siguientes.
      var bump=bumpCanvas.getContext('2d');
      // Declara `rough` para conservar referencias o estado consumidos por las operaciones siguientes.
      var rough=roughCanvas.getContext('2d');

      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      color.fillStyle='#111315'; color.fillRect(0,0,256,256);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      bump.fillStyle='#808080'; bump.fillRect(0,0,256,256);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      rough.fillStyle='#c8c8c8'; rough.fillRect(0,0,256,256);

      /* Nervaduras moldeadas en la zona de apoyo, no geometria agregada. */
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      color.strokeStyle='#1d2022';
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      bump.strokeStyle='#969696';
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      rough.strokeStyle='#e0e0e0';
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      color.lineWidth=1.2; bump.lineWidth=1.5; rough.lineWidth=2;
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var r=0;r<9;r++){
        // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
        color.beginPath(); color.ellipse(128,140,114-r*6.4,124-r*7,0,0,Math.PI*2); color.stroke();
        // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
        bump.beginPath(); bump.ellipse(128,140,114-r*6.4,124-r*7,0,0,Math.PI*2); bump.stroke();
        // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
        rough.beginPath(); rough.ellipse(128,140,114-r*6.4,124-r*7,0,0,Math.PI*2); rough.stroke();
      }

      /* Riel, ranura de rueda y boton central impresos sobre la carcasa. */
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(color,43,46,42,142,18); color.fillStyle='#1b1d1f'; color.fill();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(rough,43,46,42,142,18); rough.fillStyle='#707070'; rough.fill();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(color,94,41,34,49,12); color.fillStyle='#050607'; color.fill();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(bump,94,41,34,49,12); bump.fillStyle='#696969'; bump.fill();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(color,97,101,27,30,10); color.fillStyle='#17191b'; color.fill();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(rough,97,101,27,30,10); rough.fillStyle='#858585'; rough.fill();

      /* Juntas de los botones principales, hundidas en el acabado. */
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      color.strokeStyle='#050607'; bump.strokeStyle='#6a6a6a';
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      color.lineWidth=3; bump.lineWidth=3;
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      color.beginPath(); color.moveTo(136,22); color.bezierCurveTo(137,68,140,111,143,184); color.stroke();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      bump.beginPath(); bump.moveTo(136,22); bump.bezierCurveTo(137,68,140,111,143,184); bump.stroke();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      color.beginPath(); color.moveTo(55,182); color.bezierCurveTo(109,187,161,181,214,166); color.stroke();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      bump.beginPath(); bump.moveTo(55,182); bump.bezierCurveTo(109,187,161,181,214,166); bump.stroke();

      /* Botones laterales enrasados, visibles como cambio de acabado. */
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(color,5,102,15,40,7); color.fillStyle='#1b1d1f'; color.fill();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(color,5,150,15,36,7); color.fillStyle='#1b1d1f'; color.fill();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(rough,5,102,15,40,7); rough.fillStyle='#828282'; rough.fill();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      roundedRect(rough,5,150,15,36,7); rough.fillStyle='#828282'; rough.fill();

      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return {
        // Continúa la construcción o actualización del adaptador con la operación de esta línea.
        color:canvasTexture(colorCanvas,true),
        // Continúa la construcción o actualización del adaptador con la operación de esta línea.
        bump:canvasTexture(bumpCanvas,false),
        // Continúa la construcción o actualización del adaptador con la operación de esta línea.
        rough:canvasTexture(roughCanvas,false)
      };
    }

    // Define la rutina `makeShellGeometry`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function makeShellGeometry(){
      // Declara `segments` para conservar referencias o estado consumidos por las operaciones siguientes.
      var segments=48, rings=14;
      // Declara `positions` para conservar referencias o estado consumidos por las operaciones siguientes.
      var positions=[], uvs=[], indices=[];
      // Declara `halfW` para conservar referencias o estado consumidos por las operaciones siguientes.
      var halfW=0.048, halfL=0.066;

      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      positions.push(-0.014,0.082,0.006);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      uvs.push(0.35,0.55);

      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var ring=1;ring<=rings;ring++){
        // Declara `rr` para conservar referencias o estado consumidos por las operaciones siguientes.
        var rr=ring/rings;
        // Declara `profile` para conservar referencias o estado consumidos por las operaciones siguientes.
        var profile=Math.pow(Math.max(0,1-Math.pow(rr,1.62)),0.82);
        // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
        for(var i=0;i<segments;i++){
          // Declara `a` para conservar referencias o estado consumidos por las operaciones siguientes.
          var a=i/segments*Math.PI*2;
          // Declara `ca` para conservar referencias o estado consumidos por las operaciones siguientes.
          var ca=Math.cos(a), sa=Math.sin(a);
          // Declara `z` para conservar referencias o estado consumidos por las operaciones siguientes.
          var z=sa*halfL*rr;
          // Declara `rear` para conservar referencias o estado consumidos por las operaciones siguientes.
          var rear=(z/halfL+1)*0.5;
          // Declara `widthScale` para conservar referencias o estado consumidos por las operaciones siguientes.
          var widthScale=0.82+rear*0.18;
          // Declara `x` para conservar referencias o estado consumidos por las operaciones siguientes.
          var x=ca*halfW*widthScale*rr-0.014*Math.pow(1-rr,1.1);
          // Declara `sideFall` para conservar referencias o estado consumidos por las operaciones siguientes.
          var sideFall=0.91+0.09*(1-ca)*0.5;
          // Declara `endFall` para conservar referencias o estado consumidos por las operaciones siguientes.
          var endFall=0.94+0.06*(1+sa)*0.5;
          // Declara `y` para conservar referencias o estado consumidos por las operaciones siguientes.
          var y=0.004+0.078*profile*sideFall*endFall;
          // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
          positions.push(x,y,z);
          // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
          uvs.push(0.5+x/(halfW*2.05),0.5+z/(halfL*2.05));
        }
      }

      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var c=0;c<segments;c++){
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        indices.push(0,1+(c+1)%segments,1+c);
      }
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var row=1;row<rings;row++){
        // Declara `inner` para conservar referencias o estado consumidos por las operaciones siguientes.
        var inner=1+(row-1)*segments;
        // Declara `outer` para conservar referencias o estado consumidos por las operaciones siguientes.
        var outer=1+row*segments;
        // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
        for(var col=0;col<segments;col++){
          // Declara `next` para conservar referencias o estado consumidos por las operaciones siguientes.
          var next=(col+1)%segments;
          // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
          indices.push(inner+col,inner+next,outer+col);
          // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
          indices.push(inner+next,outer+next,outer+col);
        }
      }

      // Declara `topEdge` para conservar referencias o estado consumidos por las operaciones siguientes.
      var topEdge=1+(rings-1)*segments;
      // Declara `bottomEdge` para conservar referencias o estado consumidos por las operaciones siguientes.
      var bottomEdge=positions.length/3;
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var edge=0;edge<segments;edge++){
        // Declara `px` para conservar referencias o estado consumidos por las operaciones siguientes.
        var px=positions[(topEdge+edge)*3];
        // Declara `pz` para conservar referencias o estado consumidos por las operaciones siguientes.
        var pz=positions[(topEdge+edge)*3+2];
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        positions.push(px,0,pz);
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        uvs.push(0.5+px/(halfW*2.05),0.5+pz/(halfL*2.05));
      }
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var side=0;side<segments;side++){
        // Declara `sn` para conservar referencias o estado consumidos por las operaciones siguientes.
        var sn=(side+1)%segments;
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        indices.push(topEdge+side,topEdge+sn,bottomEdge+side);
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        indices.push(topEdge+sn,bottomEdge+sn,bottomEdge+side);
      }

      // Declara `bottomCenter` para conservar referencias o estado consumidos por las operaciones siguientes.
      var bottomCenter=positions.length/3;
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      positions.push(0,0,0.004);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      uvs.push(0.5,0.53);
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var base=0;base<segments;base++){
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        indices.push(bottomCenter,bottomEdge+base,bottomEdge+(base+1)%segments);
      }

      // Declara `geo` para conservar referencias o estado consumidos por las operaciones siguientes.
      var geo=new THREE.BufferGeometry();
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      geo.setIndex(indices);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      geo.computeVertexNormals();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      geo.computeBoundingSphere();
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return geo;
    }

    // Declara `shellMaps` para conservar referencias o estado consumidos por las operaciones siguientes.
    var shellMaps=makeShellMaps();
    // Declara `shellM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var shellM=new THREE.MeshStandardMaterial({
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      color:0xffffff,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      metalness:0.08,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      roughness:0.62,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      map:shellMaps.color,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      bumpMap:shellMaps.bump,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      bumpScale:0.00075,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      roughnessMap:shellMaps.rough
    });
    // Declara `body` para conservar referencias o estado consumidos por las operaciones siguientes.
    var body=mesh(makeShellGeometry(),shellM);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(body);

    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* pHub — Adaptador Hub USB-C multifuncional 7 en 1 (aluminio, puertos + LED) */
  // Define la rutina `bHub`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bHub(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `spaceGray` para conservar referencias o estado consumidos por las operaciones siguientes.
    var spaceGray=mat(0x6f747a,{m:0.58,r:0.40});
    // Declara `edgeM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var edgeM=mat(0x34383d,{m:0.34,r:0.54});
    // Declara `portM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var portM=mat(0x090b0d,{m:0.04,r:0.72});
    // Declara `usbBlue` para conservar referencias o estado consumidos por las operaciones siguientes.
    var usbBlue=mat(0x276b8f,{m:0.08,r:0.55});
    // Declara `cableM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var cableM=mat(0x202429,{m:0.02,r:0.82});
    // Declara `plugM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var plugM=mat(0x90979d,{m:0.68,r:0.34});
    // Declara `w` para conservar referencias o estado consumidos por las operaciones siguientes.
    var w=0.070, h=0.010, d=0.030;

    // Declara `body` para conservar referencias o estado consumidos por las operaciones siguientes.
    var body=mesh(rbox(w,h,d,0.003),spaceGray);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    body.position.y=h/2;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(body);

    /* Tapas ABS discretas: rematan la extrusion sin engrosarla. */
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sx=-1;sx<=1;sx+=2){
      // Declara `endCap` para conservar referencias o estado consumidos por las operaciones siguientes.
      var endCap=mesh(rbox(0.0032,h*0.92,d-0.003,0.0014),edgeM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      endCap.position.set(sx*(w/2-0.0012),h/2,0);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(endCap);
    }

    // Define la rutina `facePort`: recibe `x`, `z`, `width`, `height`, `material` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function facePort(x,z,width,height,material){
      // Declara `port` para conservar referencias o estado consumidos por las operaciones siguientes.
      var port=mesh(rbox(width,height,0.0012,Math.min(0.0012,height*0.36)),material||portM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      port.position.set(x,h/2,z);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      port.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(port);
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return port;
    }

    /* Frente: dos USB 3.0 y HDMI 4K. */
    // Define una devolución que la API invoca con cada valor o al ocurrir la transición.
    [-0.023,-0.008].forEach(function(x){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      facePort(x,d/2+0.00045,0.0115,0.0054,portM);
      // Declara `tongue` para conservar referencias o estado consumidos por las operaciones siguientes.
      var tongue=box(0.0075,0.0012,0.00055,usbBlue);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      tongue.position.set(x,h/2-0.0013,d/2+0.0011);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      tongue.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(tongue);
    });

    // Declara `hdmiShape` para conservar referencias o estado consumidos por las operaciones siguientes.
    var hdmiShape=new THREE.Shape();
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    hdmiShape.moveTo(-0.0075,-0.0028);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    hdmiShape.lineTo(0.0075,-0.0028);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    hdmiShape.lineTo(0.0062,0.0028);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    hdmiShape.lineTo(-0.0062,0.0028);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    hdmiShape.closePath();
    // Declara `hdmi` para conservar referencias o estado consumidos por las operaciones siguientes.
    var hdmi=mesh(new THREE.ShapeGeometry(hdmiShape),portM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    hdmi.position.set(0.020,h/2,d/2+0.0011);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    hdmi.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(hdmi);

    /* Dorso: lectores SD/TF y los dos USB-C oficiales. */
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    facePort(-0.021,-d/2-0.00045,0.021,0.0012,portM);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    facePort(-0.002,-d/2-0.00045,0.012,0.0010,portM);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    facePort(0.015,-d/2-0.00045,0.0085,0.0032,portM);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    facePort(0.029,-d/2-0.00045,0.0085,0.0032,portM);

    /* Cable moldeado desde la tapa, con curva y alivio de tension. */
    // Declara `cableCurve` para conservar referencias o estado consumidos por las operaciones siguientes.
    var cableCurve=new THREE.CatmullRomCurve3([
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.Vector3(-w/2+0.001,h/2,-0.002),
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.Vector3(-0.047,h/2,-0.003),
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.Vector3(-0.061,h/2,-0.009),
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.Vector3(-0.074,h/2,-0.012)
    ]);
    // Declara `cable` para conservar referencias o estado consumidos por las operaciones siguientes.
    var cable=mesh(new THREE.TubeGeometry(cableCurve,22,0.0018,8,false),cableM);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    cable.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(cable);

    // Declara `relief` para conservar referencias o estado consumidos por las operaciones siguientes.
    var relief=mesh(rbox(0.011,0.0065,0.008,0.0025),cableM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    relief.position.set(-0.078,h/2,-0.012);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    relief.rotation.y=rad(-4);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(relief);

    // Declara `connector` para conservar referencias o estado consumidos por las operaciones siguientes.
    var connector=mesh(rbox(0.010,0.0042,0.0072,0.002),plugM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    connector.position.set(-0.087,h/2,-0.0126);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    connector.rotation.y=rad(-4);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(connector);

    // Declara `connectorCore` para conservar referencias o estado consumidos por las operaciones siguientes.
    var connectorCore=mesh(rbox(0.0058,0.0024,0.0048,0.0012),portM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    connectorCore.position.set(-0.0921,h/2,-0.0130);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    connectorCore.rotation.y=rad(-4);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    connectorCore.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(connectorCore);

    // Declara `led` para conservar referencias o estado consumidos por las operaciones siguientes.
    var led=mesh(new THREE.SphereGeometry(0.00125,10,6),mat(0x101820,{e:0x4cc9f0,ei:0.58,r:0.72}));
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    led.position.set(0.025,h+0.00035,0.008);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    led.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(led);

    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    g.rotation.y=rad(-10);
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* pMat — Pad XL de cuero ecologico para escritorio (mate, borde cosido) */
  // Define la rutina `bMousepad`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bMousepad(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g = new THREE.Group();
    // Declara `w` para conservar referencias o estado consumidos por las operaciones siguientes.
    var w = 0.72, d = 0.38;

    // Declara `grainCanvas` para conservar referencias o estado consumidos por las operaciones siguientes.
    var grainCanvas=document.createElement('canvas');
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    grainCanvas.width=256; grainCanvas.height=128;
    // Declara `grain` para conservar referencias o estado consumidos por las operaciones siguientes.
    var grain=grainCanvas.getContext('2d');
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    grain.fillStyle='#808080';
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    grain.fillRect(0,0,256,128);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    grain.strokeStyle='rgba(162,162,162,.42)';
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    grain.lineWidth=0.7;
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var gy=6;gy<128;gy+=9){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      grain.beginPath();
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var gx=0;gx<=256;gx+=16){
        // Declara `yy` para conservar referencias o estado consumidos por las operaciones siguientes.
        var yy=gy+Math.sin((gx+gy)*0.11)*1.4;
        // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
        if(gx===0) grain.moveTo(gx,yy); else grain.lineTo(gx,yy);
      }
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      grain.stroke();
    }
    // Declara `grainTex` para conservar referencias o estado consumidos por las operaciones siguientes.
    var grainTex=new THREE.CanvasTexture(grainCanvas);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    grainTex.wrapS=THREE.RepeatWrapping;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    grainTex.wrapT=THREE.RepeatWrapping;
    // Copia los valores calculados en el objeto mutable que consumen los pasos siguientes.
    grainTex.repeat.set(3.2,2.1);

    // Declara `leatherM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var leatherM=new THREE.MeshStandardMaterial({
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      color:COL.mat,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      roughness:0.94,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      metalness:0.01,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      bumpMap:grainTex,
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      bumpScale:0.00012
    });
    // Declara `pad` para conservar referencias o estado consumidos por las operaciones siguientes.
    var pad=mesh(rbox(w,MAT_TOP,d,0.001),leatherM);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    pad.position.y=MAT_TOP/2;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    pad.castShadow=false;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    pad.receiveShadow=true;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(pad);

    /* Costura de un pixel, al ras y siguiendo las esquinas redondeadas. */
    // Declara `stitchPts` para conservar referencias o estado consumidos por las operaciones siguientes.
    var stitchPts=[];
    // Declara `rx` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rx=w/2-0.012, rz=d/2-0.012, corner=0.012;
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var i=0;i<72;i++){
      // Declara `a` para conservar referencias o estado consumidos por las operaciones siguientes.
      var a=i/72*Math.PI*2;
      // Declara `ca` para conservar referencias o estado consumidos por las operaciones siguientes.
      var ca=Math.cos(a), sa=Math.sin(a);
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      stitchPts.push(new THREE.Vector3(
        // Continúa la construcción o actualización del adaptador con la operación de esta línea.
        (ca<0?-1:1)*(rx-corner)+corner*ca,
        // Continúa la construcción o actualización del adaptador con la operación de esta línea.
        MAT_TOP+0.00018,
        // Continúa la construcción o actualización del adaptador con la operación de esta línea.
        (sa<0?-1:1)*(rz-corner)+corner*sa
      ));
    }
    // Declara `stitchGeo` para conservar referencias o estado consumidos por las operaciones siguientes.
    var stitchGeo=new THREE.BufferGeometry().setFromPoints(stitchPts);
    // Declara `stitchM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var stitchM=new THREE.LineBasicMaterial({color:0x596574,transparent:true,opacity:0.62});
    // Declara `stitch` para conservar referencias o estado consumidos por las operaciones siguientes.
    var stitch=new THREE.LineLoop(stitchGeo,stitchM);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    stitch.renderOrder=2;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(stitch);
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* pBox — Bandeja organizadora de cables de acero.
     Queda completamente debajo del tablero y se conecta mediante dos soportes.
     El origen del grupo se ubica en la base de la bandeja. */
  // Define la rutina `bCableBox`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bCableBox(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();

    // Declara `steel` para conservar referencias o estado consumidos por las operaciones siguientes.
    var steel=mat(0x111417,{m:0.48,r:0.50});
    // Declara `faceM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var faceM=mat(0x1b2024,{m:0.42,r:0.54});
    // Declara `innerM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var innerM=mat(0x050607,{m:0.18,r:0.78});
    // Declara `edgeM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var edgeM=mat(0x2a3035,{m:0.52,r:0.42});
    // Declara `bracketM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var bracketM=mat(0x101317,{m:0.55,r:0.46});
    // Declara `cableM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var cableM=mat(COL.cable,{r:0.64});

    // Declara `w` para conservar referencias o estado consumidos por las operaciones siguientes.
    var w=0.56, h=0.108, d=0.142, t=0.008;

    // Declara `floor` para conservar referencias o estado consumidos por las operaciones siguientes.
    var floor=mesh(rbox(w,t,d+0.050,0.004),steel);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    floor.position.set(0,t/2,0.018);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(floor);

    // Declara `frontLip` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frontLip=mesh(rbox(w+0.018,0.010,t,0.004),edgeM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    frontLip.position.set(0,0.018,d/2+0.048);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(frontLip);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var si=0;si<13;si++){
      // Declara `slot` para conservar referencias o estado consumidos por las operaciones siguientes.
      var slot=mesh(rbox(0.018,0.0016,0.064,0.004),innerM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      slot.position.set(-0.234+si*0.039,0.0094,0.038);
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      slot.rotation.y=rad(si%2 ? -3 : 3);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      slot.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(slot);
    }

    // Declara `back` para conservar referencias o estado consumidos por las operaciones siguientes.
    var back=mesh(rbox(w,h,t,0.004),faceM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    back.position.set(0,h/2,-d/2+t/2);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(back);

    // Declara `front` para conservar referencias o estado consumidos por las operaciones siguientes.
    var front=mesh(rbox(w,0.060,t,0.004),faceM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    front.position.set(0,0.030,d/2-t/2);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(front);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sx=-1;sx<=1;sx+=2){
      // Declara `sideWall` para conservar referencias o estado consumidos por las operaciones siguientes.
      var sideWall=mesh(rbox(t,h,d,0.004),faceM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      sideWall.position.set(sx*(w/2-t/2),h/2,0);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(sideWall);

      // Declara `sideWindow` para conservar referencias o estado consumidos por las operaciones siguientes.
      var sideWindow=mesh(rbox(0.0014,0.036,0.050,0.006),innerM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      sideWindow.position.set(sx*(w/2+0.0008),0.052,0.022);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      sideWindow.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(sideWindow);
    }

    // Declara `topRear` para conservar referencias o estado consumidos por las operaciones siguientes.
    var topRear=mesh(rbox(w,0.012,0.034,0.004),edgeM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    topRear.position.set(0,h+0.006,-d/2+0.020);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(topRear);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var vx=-1;vx<=1;vx+=2){
      // Declara `endCap` para conservar referencias o estado consumidos por las operaciones siguientes.
      var endCap=mesh(rbox(0.014,h+0.012,d,0.004),edgeM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      endCap.position.set(vx*(w/2-0.007),h/2+0.006,0);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(endCap);
    }

    // Define la rutina `addHorizontalSlot`: recibe `x`, `z`, `ww` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function addHorizontalSlot(x,z,ww){
      // Declara `s` para conservar referencias o estado consumidos por las operaciones siguientes.
      var s=mesh(rbox(ww,0.018,0.0014,0.006),innerM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      s.position.set(x,0.055,z);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      s.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(s);
    }
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addHorizontalSlot(-0.165,d/2+0.0008,0.142);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addHorizontalSlot(0.075,d/2+0.0008,0.190);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addHorizontalSlot(-0.120,-d/2-0.0008,0.190);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addHorizontalSlot(0.150,-d/2-0.0008,0.210);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var nx=-2;nx<=2;nx++){
      // Declara `notch` para conservar referencias o estado consumidos por las operaciones siguientes.
      var notch=mesh(rbox(0.016,0.014,0.003,0.004),innerM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      notch.position.set(nx*0.055,0.018,d/2+0.002);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      notch.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(notch);
    }

    // Declara `rearInside` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rearInside=mesh(rbox(w-0.055,0.004,0.010,0.002),innerM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    rearInside.position.set(0,h-0.018,-d/2+0.016);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    rearInside.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(rearInside);

    // Declara `screwM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var screwM=mat(0x050607,{m:0.20,r:0.74});
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sx2=-1;sx2<=1;sx2+=2){
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var sz2=-1;sz2<=1;sz2+=2){
        // Declara `screw` para conservar referencias o estado consumidos por las operaciones siguientes.
        var screw=mesh(new THREE.CylinderGeometry(0.004,0.004,0.0014,12),screwM);
        // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
        screw.position.set(sx2*(w/2-0.030),h+0.013,sz2*(d/2-0.020));
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        screw.castShadow=false;
        // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
        g.add(screw);
      }
    }

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var bx=-1;bx<=1;bx+=2){
      // Declara `stem` para conservar referencias o estado consumidos por las operaciones siguientes.
      var stem=mesh(rbox(0.020,0.046,0.030,0.004),bracketM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      stem.position.set(bx*0.190,h+0.026,-0.032);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(stem);

      // Declara `plate` para conservar referencias o estado consumidos por las operaciones siguientes.
      var plate=mesh(rbox(0.096,0.010,0.064,0.004),bracketM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      plate.position.set(bx*0.190,h+0.054,-0.032);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(plate);

      // Declara `rail` para conservar referencias o estado consumidos por las operaciones siguientes.
      var rail=mesh(rbox(0.022,0.010,0.090,0.004),bracketM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      rail.position.set(bx*0.190,h+0.006,-0.012);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(rail);
    }

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var c=0;c<3;c++){
      // Declara `curve` para conservar referencias o estado consumidos por las operaciones siguientes.
      var curve=new THREE.CatmullRomCurve3([
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(-0.150+c*0.110,0.072,-0.024),
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(-0.120+c*0.105,0.040,0.018),
        // Crea una instancia de Three.js que integra la geometría, material o escena.
        new THREE.Vector3(-0.095+c*0.095,0.024,0.060)
      ]);
      // Declara `cable` para conservar referencias o estado consumidos por las operaciones siguientes.
      var cable=mesh(new THREE.TubeGeometry(curve,16,0.0032,8,false),cableM);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      cable.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(cable);
    }

    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* pGlow — Lampara/barra de luz LED para monitor (se apoya sobre la pantalla) */
  // Define la rutina `bLightbar`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function bLightbar(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `dk` para conservar referencias o estado consumidos por las operaciones siguientes.
    var dk=mat(0x0c0e10,{r:0.48,m:0.34});
    // Declara `satin` para conservar referencias o estado consumidos por las operaciones siguientes.
    var satin=mat(0x1b1f22,{r:0.54,m:0.26});
    // Declara `rubber` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rubber=mat(0x050607,{r:0.72,m:0.10});
    // Declara `lightM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var lightM=mat(0xfff1d4,{e:COL.warmLight,ei:1.75,r:0.42,m:0.02});

    // Declara `bar` para conservar referencias o estado consumidos por las operaciones siguientes.
    var bar=mesh(new THREE.CylinderGeometry(0.014,0.014,0.505,28),dk);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    bar.rotation.z=Math.PI/2;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(bar);

    // Declara `lens` para conservar referencias o estado consumidos por las operaciones siguientes.
    var lens=mesh(rbox(0.440,0.0045,0.010,0.003),lightM);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    lens.position.set(0,-0.010,0.010);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    lens.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(lens);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var ex=-1;ex<=1;ex+=2){
      // Declara `cap` para conservar referencias o estado consumidos por las operaciones siguientes.
      var cap=mesh(new THREE.CylinderGeometry(0.0145,0.0145,0.006,24),satin);
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      cap.rotation.z=Math.PI/2;
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      cap.position.set(ex*0.256,0,0);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(cap);

      // Declara `ring` para conservar referencias o estado consumidos por las operaciones siguientes.
      var ring=mesh(new THREE.TorusGeometry(0.010,0.0013,8,24),rubber);
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      ring.rotation.y=Math.PI/2;
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      ring.position.set(ex*0.259,0,0);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ring.castShadow=false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(ring);
    }

    // Declara `sleeve` para conservar referencias o estado consumidos por las operaciones siguientes.
    var sleeve=mesh(new THREE.CylinderGeometry(0.0175,0.0175,0.082,28),satin);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    sleeve.rotation.z=Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    sleeve.position.set(0,0.0005,-0.001);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(sleeve);

    // Declara `usb` para conservar referencias o estado consumidos por las operaciones siguientes.
    var usb=mesh(rbox(0.018,0.009,0.003,0.002),rubber);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    usb.position.set(0,0.003,-0.019);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    usb.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(usb);

    // Declara `shelf` para conservar referencias o estado consumidos por las operaciones siguientes.
    var shelf=mesh(rbox(0.152,0.010,0.046,0.005),dk);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    shelf.position.set(0,-0.027,-0.032);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(shelf);

    // Declara `pad` para conservar referencias o estado consumidos por las operaciones siguientes.
    var pad=mesh(rbox(0.132,0.004,0.020,0.003),rubber);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    pad.position.set(0,-0.033,-0.010);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    pad.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(pad);

    // Declara `hinge` para conservar referencias o estado consumidos por las operaciones siguientes.
    var hinge=mesh(new THREE.CylinderGeometry(0.011,0.011,0.070,18),satin);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    hinge.rotation.x=Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    hinge.position.set(0,-0.041,-0.038);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(hinge);

    // Declara `neck` para conservar referencias o estado consumidos por las operaciones siguientes.
    var neck=mesh(rbox(0.034,0.044,0.022,0.008),dk);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    neck.position.set(0,-0.059,-0.047);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(neck);

    // Declara `counter` para conservar referencias o estado consumidos por las operaciones siguientes.
    var counter=mesh(rbox(0.066,0.070,0.040,0.018),dk);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    counter.position.set(0,-0.096,-0.058);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(counter);

    // Declara `belly` para conservar referencias o estado consumidos por las operaciones siguientes.
    var belly=mesh(new THREE.SphereGeometry(0.032,22,14),dk);
    // Ajusta la escala tridimensional sin reconstruir la geometría.
    belly.scale.set(1.02,1.18,0.68);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    belly.position.set(0,-0.112,-0.057);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(belly);

    // Declara `rearPad` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rearPad=mesh(rbox(0.052,0.006,0.034,0.004),rubber);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    rearPad.position.set(0,-0.083,-0.084);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    rearPad.rotation.x=rad(-8);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    rearPad.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(rearPad);

    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  /* =====================================================================
     REGISTRO de productos procedurales: id 'dsi-*' -> { name, build, scale }
     ===================================================================== */
  // Declara `REGISTRY` para conservar referencias o estado consumidos por las operaciones siguientes.
  var REGISTRY={
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-monitor-arm':   { name:'pArm',       build:bMonArm },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-monitor-stand': { name:'pStandard',  build:bMonStand },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-stand':         { name:'pNotebook',  build:bStand },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-mousepad':      { name:'pMat',       build:bMousepad },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-hub':           { name:'pHub',       build:bHub, scale:1.55 },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-organizer':     { name:'pBox',       build:bCableBox },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-lightbar':      { name:'pGlow',      build:bLightbar },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-keyboard':      { name:'pMechanic',  build:bKeyboard },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-wrist-rest':    { name:'pEase',      build:bWristRest },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-mouse':         { name:'pMouseProV', build:bMouse },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-lumbar':        { name:'pLumbar',    build:bLumbar, draggable:false },
    /* contextuales genericos (no son productos del catalogo a modelar) */
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-monitor':       { name:'monitor (contextual)',  build:bMonitor },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-monitor-base':  { name:'base de monitor (contextual)', build:bMonitorBase, draggable:false },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-laptop':        { name:'notebook (contextual)', build:bLaptop },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-chair':         { name:'silla (contextual)',    build:bChair },
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
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
  // Declara `HOME` para conservar referencias o estado consumidos por las operaciones siguientes.
  var HOME={
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-monitor':       {x: 0.00, y: 0.30,  z:-0.18, rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-monitor-base':  {x: 0.00, y: 0.00,  z:-0.18, rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-monitor-stand': {x: 0.00, y: 0.00,  z:-0.18, rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-monitor-arm':   {x: 0.00, y: 0.00,  z:-0.18, rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-laptop':        {x:-0.46, y: 0.00,  z: 0.05, rx:0, ry:0.16},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-stand':         {x:-0.46, y: 0.00,  z: 0.05, rx:0, ry:0.16},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-keyboard':      {x:-0.02, y: 0.00,  z: 0.15, rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-wrist-rest':    {x:-0.02, y: 0.00,  z: 0.285,rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-mousepad':      {x: 0.03, y: 0.00,  z: 0.12, rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-mouse':         {x: 0.30, y: 0.00,  z: 0.20, rx:0, ry:0},    
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-hub':           {x: 0.53, y: 0.00,  z:-0.035, rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-organizer':     {x: 0.00, y:-0.207, z: 0.21,  rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-lightbar':      {x: 0.00, y: 0.50,  z:-0.12, rx:0, ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-chair':         {x: 0.00, y: 0.00,  z: 0.95, rx:0, ry:0},
    // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
    'dsi-lumbar':        {x: 0.00, y: 0.76,  z: 0.155,rx:-7*Math.PI/180,ry:0},
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    'dsi-context':       {x: 0.00, y: 0.00,  z: 0.00, rx:0, ry:0}
  };

  // Define la rutina `isVisible`: recibe `id` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function isVisible(id){ return objects[id] && objects[id].visible; }
  // Define la rutina `diagnosisValue`: recibe `index` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function diagnosisValue(index){
    // Declara `value` para conservar referencias o estado consumidos por las operaciones siguientes.
    var value=diagnosisAnswers[index];
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return value===0||value===1||value===2?value:0;
  }
  // Define la rutina `visualChairType`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function visualChairType(){return comparisonMode==='primoffice'?0:diagnosisValue(4);}

  // Define la rutina `configureLighting`: recibe `glowOn`, `animated` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function configureLighting(glowOn,animated){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!renderer||!hemiLight||!ambientLight||!keyLight||!rimLight||!fillLight) return;
    // Declara `current` para conservar referencias o estado consumidos por las operaciones siguientes.
    var current=comparisonMode==='current';
    // Declara `target` para conservar referencias o estado consumidos por las operaciones siguientes.
    var target=current
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      ? {hemi:0.82,ambient:0.48,key:1.36,rim:0.09,fill:0.28,exposure:0.96,glow:0,pool:0}
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      : {hemi:1.06,ambient:0.43,key:1.98,rim:0.25,fill:0.56,exposure:glowOn?1.06:1.09,glow:glowOn?3.55:0,pool:glowOn?0.18:0};
    // Declara `from` para conservar referencias o estado consumidos por las operaciones siguientes.
    var from={hemi:hemiLight.intensity,ambient:ambientLight.intensity,key:keyLight.intensity,rim:rimLight.intensity,fill:fillLight.intensity,exposure:renderer.toneMappingExposure,glow:glowSpot?glowSpot.intensity:0,pool:glowPool?glowPool.material.opacity:0};
    // Declara `duration` para conservar referencias o estado consumidos por las operaciones siguientes.
    var duration=animated&&!reduce&&running?520:0;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(glowSpot) glowSpot.visible=target.glow>0||from.glow>0;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(glowPool) glowPool.visible=target.pool>0||from.pool>0;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    addTween(duration,function(e){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      hemiLight.intensity=lerp(from.hemi,target.hemi,e); ambientLight.intensity=lerp(from.ambient,target.ambient,e);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      keyLight.intensity=lerp(from.key,target.key,e); rimLight.intensity=lerp(from.rim,target.rim,e); fillLight.intensity=lerp(from.fill,target.fill,e);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      renderer.toneMappingExposure=lerp(from.exposure,target.exposure,e);
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(glowSpot) glowSpot.intensity=lerp(from.glow,target.glow,e);
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(glowPool) glowPool.material.opacity=lerp(from.pool,target.pool,e);
    // Define una devolución que la API invoca con cada valor o al ocurrir la transición.
    },function(){
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(glowSpot) glowSpot.visible=target.glow>0;
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(glowPool) glowPool.visible=target.pool>0;
    });
  }

  // Define la rutina `setContextOpacity`: recibe `group`, `value` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setContextOpacity(group,value){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!group)return;
    // Recorre el subárbol gráfico para actualizar cada nodo compatible.
    group.traverse(function(node){
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(!node.isMesh||!node.material)return;
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(!node.userData.contextFadeMaterial){node.material=node.material.clone();node.material.transparent=true;node.userData.contextFadeMaterial=true;}
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      node.material.opacity=value;node.material.depthWrite=value>0.98;
    });
  }

  // Define la rutina `configureVisualContext`: recibe `vis`, `animated`, `transition` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function configureVisualContext(vis,animated,transition){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    transition=transition||{};
    // Declara `device` para conservar referencias o estado consumidos por las operaciones siguientes.
    var device=diagnosisValue(2), order=diagnosisValue(3), chairType=visualChairType();
    // Declara `chairNames` para conservar referencias o estado consumidos por las operaciones siguientes.
    var chairNames=['chair-ergonomic','chair-basic','chair-dining'];
    // Declara `chairHolder` para conservar referencias o estado consumidos por las operaciones siguientes.
    var chairHolder=objects['dsi-chair'];
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(chairHolder){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      chairNames.forEach(function(name){ var part=chairHolder.getObjectByName(name); if(part) part.visible=name===chairNames[chairType]; });
    }

    // Declara `monitorBase` para conservar referencias o estado consumidos por las operaciones siguientes.
    var monitorBase=objects['dsi-monitor-base'];
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(monitorBase){
      // Ajusta la escala tridimensional sin reconstruir la geometría.
      monitorBase.scale.set(1,device===1?0.78:1.18,1);
    }

    // Declara `contextualScreen` para conservar referencias o estado consumidos por las operaciones siguientes.
    var contextualScreen=screenMat(comparisonMode==='current'?'current':'primoffice');
    // Define una devolución que la API invoca con cada valor o al ocurrir la transición.
    ['dsi-monitor','dsi-laptop'].forEach(function(id){
      // Declara `holder` para conservar referencias o estado consumidos por las operaciones siguientes.
      var holder=objects[id]; if(!holder)return;
      // Recorre el subárbol gráfico para actualizar cada nodo compatible.
      holder.traverse(function(node){if(node.isMesh&&node.name==='screen-contextual')node.material=contextualScreen;});
    });

    // Declara `contextHolder` para conservar referencias o estado consumidos por las operaciones siguientes.
    var contextHolder=objects['dsi-context'];
    // Declara `cableCount` para conservar referencias o estado consumidos por las operaciones siguientes.
    var cableCount=0;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(contextHolder){
      // Declara `currentBase` para conservar referencias o estado consumidos por las operaciones siguientes.
      var currentBase=contextHolder.getObjectByName('context-current-base');
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(currentBase){currentBase.visible=comparisonMode==='current';setContextOpacity(currentBase,1);}
      // Declara `contextNames` para conservar referencias o estado consumidos por las operaciones siguientes.
      var contextNames=['context-clean','context-medium','context-messy','context-tidy'];
      // Declara `targetContext` para conservar referencias o estado consumidos por las operaciones siguientes.
      var targetContext='context-tidy';
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(comparisonMode==='current'){
        // Declara `currentNames` para conservar referencias o estado consumidos por las operaciones siguientes.
        var currentNames=['context-clean','context-medium','context-messy'];
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        targetContext=currentNames[order];
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        cableCount=0;
      // Ejecuta la alternativa cuando la condición anterior no se cumple.
      }else{
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        targetContext='';
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        cableCount=0;
      }
      // Declara `previousGroups` para conservar referencias o estado consumidos por las operaciones siguientes.
      var previousGroups=contextNames.map(function(name){return contextHolder.getObjectByName(name);}).filter(function(group){return group&&group.visible&&group.name!==targetContext;});
      // Declara `targetGroup` para conservar referencias o estado consumidos por las operaciones siguientes.
      var targetGroup=contextHolder.getObjectByName(targetContext);
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(animated&&!reduce&&running&&!transition.bulk&&previousGroups.length&&targetGroup){
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        targetGroup.visible=true; setContextOpacity(targetGroup,0);
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        addTween(480,function(e){
          // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
          setContextOpacity(targetGroup,e);
          // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
          previousGroups.forEach(function(group){setContextOpacity(group,1-e);});
        // Define una devolución que la API invoca con cada valor o al ocurrir la transición.
        },function(){
          // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
          setContextOpacity(targetGroup,1);
          // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
          previousGroups.forEach(function(group){group.visible=false;setContextOpacity(group,1);});
        });
      // Ejecuta la alternativa cuando la condición anterior no se cumple.
      }else{
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        contextNames.forEach(function(name){var group=contextHolder.getObjectByName(name);if(group){group.visible=name===targetContext;setContextOpacity(group,1);}});
      }
    }

    // Declara `glowOn` para conservar referencias o estado consumidos por las operaciones siguientes.
    var glowOn=comparisonMode==='primoffice'&&!!vis['dsi-lightbar'];
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    configureLighting(glowOn,animated);

    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(stageEl){
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-device',['laptop-low','monitor-low','monitor-correct'][device]);
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-monitor-position',vis['dsi-monitor-arm']?'elevated-arm':(vis['dsi-monitor']?(device===1?'low-base':'correct-base'):'hidden'));
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-laptop-position',vis['dsi-stand']?'elevated-stand':(vis['dsi-laptop']?'flat':'hidden'));
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-order',['clean','medium','messy'][order]);
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-chair',['ergonomic','basic','dining'][chairType]);
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-diagnosed-chair',['ergonomic','basic','dining'][diagnosisValue(4)]);
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-cables',String(cableCount));
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-context-props',comparisonMode==='current'?'improvised-office':'balanced-office');
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-box',vis['dsi-organizer']?'true':'false');
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-hub',vis['dsi-hub']?'true':'false');
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-glow',glowOn?'true':'false');
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-lighting',comparisonMode==='current'?'neutral-flat':(glowOn?'clean-warm-focus':'clean-balanced'));
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-ease',vis['dsi-wrist-rest']?'true':'false');
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-lumbar',vis['dsi-lumbar']?'true':'false');
    }
  }

  /* Resuelve la posición/rotación canónica de un objeto según el contexto
     actual de visibilidad (apoyos dependientes). */
  // Define la rutina `computeHome`: recibe `id` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function computeHome(id){
    // Declara `b` para conservar referencias o estado consumidos por las operaciones siguientes.
    var b=HOME[id]||{x:0,y:0,z:0,rx:0,ry:0};
    // Declara `x` para conservar referencias o estado consumidos por las operaciones siguientes.
    var x=b.x, y=b.y, z=b.z, rx=b.rx||0, ry=b.ry||0;

    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(id==='dsi-monitor'){
      // Declara `arm` para conservar referencias o estado consumidos por las operaciones siguientes.
      var arm=isVisible('dsi-monitor-arm'), stand=isVisible('dsi-monitor-stand');
      // Declara `device` para conservar referencias o estado consumidos por las operaciones siguientes.
      var device=diagnosisValue(2);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      y = arm ? 0.44 : (stand ? 0.30 : (device===1?0.20:0.32));
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      z = arm ? -0.18 : (device===1?-0.08:-0.18);
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    } else if(id==='dsi-monitor-base'){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      z=diagnosisValue(2)===1?-0.08:-0.18;
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    } else if(id==='dsi-lightbar'){
      // Declara `t` para conservar referencias o estado consumidos por las operaciones siguientes.
      var t=computeHome('dsi-monitor');
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      x=t.x; y=t.y+0.18+0.036; z=t.z+0.035;   /* apoyada sobre el borde superior del monitor */
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    } else if(id==='dsi-laptop'){
      // Declara `onStand` para conservar referencias o estado consumidos por las operaciones siguientes.
      var onStand=isVisible('dsi-stand');
      /* Notebook y pNotebook deben compartir la MISMA inclinación.
         Antes estaban inclinados en sentidos opuestos y se atravesaban. */
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      y = onStand ? 0.142 : 0.0;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      rx = onStand ? rad(13) : 0;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      x = onStand ? -0.46 : 0;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      z = onStand ? 0.05 : 0.015;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ry = onStand ? 0.16 : 0;
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    } else if(id==='dsi-keyboard'){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      y = isVisible('dsi-mousepad') ? MAT_TOP : 0.0;
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    } else if(id==='dsi-wrist-rest'){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      y = isVisible('dsi-mousepad') ? MAT_TOP : 0.0;
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    } else if(id==='dsi-mouse'){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      y = isVisible('dsi-mousepad') ? MAT_TOP : 0.0;
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    } else if(id==='dsi-chair'){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      x = comparisonMode==='current'?0.06:-0.52;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      z = comparisonMode==='current'?0.98:1.10;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ry = comparisonMode==='current'?rad(-2):rad(14);
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    } else if(id==='dsi-lumbar'){
      // Declara `chair` para conservar referencias o estado consumidos por las operaciones siguientes.
      var chair=visualChairType();
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      y = chair===0?0.79:(chair===1?0.76:0.75);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      z = chair===0?0.155:(chair===1?0.145:0.14);
    }
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return {x:x,y:y,z:z,rx:rx,ry:ry};
  }

  /* Coloca TODOS los objetos en su posición predeterminada.
     instant=true -> inmediato (cambios de carrito); false -> animado (reiniciar). */
  // Define la rutina `placeAll`: recibe `animated` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function placeAll(animated){
    // Declara `anim` para conservar referencias o estado consumidos por las operaciones siguientes.
    var anim = animated && !reduce && running;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    DSI.forEach(function(id){
      // Declara `h` para conservar referencias o estado consumidos por las operaciones siguientes.
      var h=objects[id]; if(!h) return;
      // Declara `t` para conservar referencias o estado consumidos por las operaciones siguientes.
      var t=computeHome(id);
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(!anim){
        // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
        h.position.set(t.x,t.y,t.z); h.rotation.x=t.rx; h.rotation.y=t.ry;
      // Ejecuta la alternativa cuando la condición anterior no se cumple.
      } else {
        // Declara `p0` para conservar referencias o estado consumidos por las operaciones siguientes.
        var p0=h.position.clone(), rx0=h.rotation.x, ry0=h.rotation.y;
        // Encapsula el adaptador en un ámbito privado para no exponer auxiliares globales.
        (function(node,from,frx,fry,to){
          // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
          addTween(640,function(e){
            // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
            node.position.set(lerp(from.x,to.x,e),lerp(from.y,to.y,e),lerp(from.z,to.z,e));
            // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
            node.rotation.x=lerp(frx,to.rx,e);
            // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
            node.rotation.y=lerp(fry,to.ry,e);
          });
        // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
        })(h,p0,rx0,ry0,t);
      }
    });
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!anim) render1();
  }

  // Define la rutina `setHolderScale`: recibe `holder`, `factor` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setHolderScale(holder,factor){
    // Declara `rest` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rest=holder.userData.restScale||new THREE.Vector3(1,1,1);
    // Ajusta la escala tridimensional sin reconstruir la geometría.
    holder.scale.set(rest.x*factor,rest.y*factor,rest.z*factor);
  }
  // Define la rutina `productHighlight`: recibe `holder`, `color` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function productHighlight(holder,color){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(reduce||!scene||!holder) return;
    // Declara `helper` para conservar referencias o estado consumidos por las operaciones siguientes.
    var helper=new THREE.BoxHelper(holder,color||0x38bdf8); helper.material.transparent=true; helper.material.opacity=0.48; helper.renderOrder=8; scene.add(helper);
    // Libera el recurso gráfico temporal para no retener memoria de GPU.
    addTween(680,function(e){ helper.material.opacity=lerp(0.48,0,e); },function(){ scene.remove(helper); helper.geometry.dispose(); helper.material.dispose(); });
  }
  // Define la rutina `animateHolder`: recibe `id`, `show`, `duration` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function animateHolder(id,show,duration){
    // Declara `holder` para conservar referencias o estado consumidos por las operaciones siguientes.
    var holder=objects[id]; if(!holder||id==='dsi-context') return;
    // Declara `token` para conservar referencias o estado consumidos por las operaciones siguientes.
    var token=++productTransitionToken; holder.userData.transitionToken=token;
    // Declara `targetScale` para conservar referencias o estado consumidos por las operaciones siguientes.
    var targetScale=id==='dsi-monitor-base'?holder.scale.clone():(holder.userData.restScale||new THREE.Vector3(1,1,1)).clone();
    // Define la rutina `scaleTo`: recibe `factor` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
    function scaleTo(factor){holder.scale.set(targetScale.x*factor,targetScale.y*factor,targetScale.z*factor);}
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(show){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      holder.visible=true; scaleTo(0.88);
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      addTween(duration,function(e){ if(holder.userData.transitionToken!==token)return; scaleTo(lerp(0.88,1,e)); },function(){ if(holder.userData.transitionToken===token)scaleTo(1); });
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(id!=='dsi-monitor'&&id!=='dsi-monitor-base'&&id!=='dsi-laptop'&&id!=='dsi-chair') productHighlight(holder,0x38bdf8);
    // Ejecuta la alternativa cuando la condición anterior no se cumple.
    }else{
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      addTween(duration,function(e){ if(holder.userData.transitionToken!==token)return; scaleTo(lerp(1,0.88,e)); },function(){
        // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
        if(holder.userData.transitionToken!==token)return; holder.visible=false; scaleTo(1); placeAll(true);
      });
    }
  }

  // Define la rutina `applyVisible`: recibe `vis`, `animated`, `transition` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function applyVisible(vis,animated,transition){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    vis=Object.assign({},vis||{});
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    transition=transition||{};

    /* Mantener coherencia sin inventar productos:
       - El monitor solo aparece si fue seleccionado desde el carrito.
       - pArm y pStandard son alternativas; si pArm está activo se oculta
         pStandard para evitar superposición.
       - pGlow solo se renderiza si también está activo un monitor.
       - pNotebook conserva la notebook contextual para poder visualizar
         el soporte elevador. */
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(vis['dsi-monitor-arm']){
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-monitor-stand']=false;
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-monitor-base']=false;
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    }else if(vis['dsi-monitor']&&!vis['dsi-monitor-stand']){
      /* Si pArm se retira, el monitor vuelve a una base coherente incluso
         cuando el diagnostico original era una notebook. */
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-monitor-base']=true;
    }
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!vis['dsi-monitor']){
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-lightbar']=false;
    }
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(vis['dsi-stand']){
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-laptop']=true;
    }
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(vis['dsi-lumbar']){
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-chair']=true;
    }

    // Declara `changed` para conservar referencias o estado consumidos por las operaciones siguientes.
    var changed=DSI.filter(function(id){return !!lastDesiredVisibility[id]!==!!vis[id];});
    // Declara `bulk` para conservar referencias o estado consumidos por las operaciones siguientes.
    var bulk=!!transition.bulk||!animated||reduce||!running;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(bulk){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      DSI.forEach(function(id){ if(objects[id]){objects[id].visible=!!vis[id];setHolderScale(objects[id],1);} });
    // Ejecuta la alternativa cuando la condición anterior no se cumple.
    }else{
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      DSI.forEach(function(id){
        // Declara `holder` para conservar referencias o estado consumidos por las operaciones siguientes.
        var holder=objects[id]; if(!holder)return;
        // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
        if(vis[id]) holder.visible=true;
        // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
        else if(changed.indexOf(id)===-1) holder.visible=false;
      });
    }
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    configureVisualContext(vis,animated,transition);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    placeAll(!bulk&&changed.length>0);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!bulk){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      changed.forEach(function(id){animateHolder(id,!!vis[id],vis[id]?560:430);});
    }
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    lastDesiredVisibility=Object.assign({},vis);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(stageEl&&transition.productIds&&transition.productIds.length)stageEl.setAttribute('data-s3d-last-products',transition.productIds.join(','));
  }

  // Define la rutina `makeWoodFloorMaterial`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function makeWoodFloorMaterial(){
    // Declara `canvas` para conservar referencias o estado consumidos por las operaciones siguientes.
    var canvas=document.createElement('canvas');
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    canvas.width=512; canvas.height=512;
    // Declara `ctx` para conservar referencias o estado consumidos por las operaciones siguientes.
    var ctx=canvas.getContext('2d');
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    ctx.fillStyle='#c8ad83';
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    ctx.fillRect(0,0,512,512);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var y=0;y<512;y+=64){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ctx.fillStyle=(y/64)%2 ? 'rgba(255,255,255,.035)' : 'rgba(77,52,30,.028)';
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.fillRect(0,y,512,64);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ctx.strokeStyle='rgba(92,66,39,.16)';
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ctx.lineWidth=1;
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.beginPath(); ctx.moveTo(0,y+.5); ctx.lineTo(512,y+.5); ctx.stroke();
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var x=((y/64)%2)*78;x<512;x+=156){
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        ctx.strokeStyle='rgba(92,66,39,.10)';
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        ctx.beginPath(); ctx.moveTo(x+.5,y+8); ctx.lineTo(x+.5,y+56); ctx.stroke();
      }
    }
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    ctx.strokeStyle='rgba(255,255,255,.08)';
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var yy=18;yy<512;yy+=64){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.beginPath(); ctx.moveTo(0,yy+.5); ctx.lineTo(512,yy+.5); ctx.stroke();
    }
    // Declara `tex` para conservar referencias o estado consumidos por las operaciones siguientes.
    var tex=new THREE.CanvasTexture(canvas);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if('colorSpace' in tex) tex.colorSpace=THREE.SRGBColorSpace;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    tex.wrapS=THREE.RepeatWrapping;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    tex.wrapT=THREE.RepeatWrapping;
    // Copia los valores calculados en el objeto mutable que consumen los pasos siguientes.
    tex.repeat.set(4.85,9.3);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(renderer&&renderer.capabilities) tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return new THREE.MeshStandardMaterial({map:tex,color:0xd0b78b,roughness:0.9,metalness:0});
  }

  // Define la rutina `makePlasterWallMaterial`: recibe `color` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function makePlasterWallMaterial(color){
    // Declara `canvas` para conservar referencias o estado consumidos por las operaciones siguientes.
    var canvas=document.createElement('canvas'); canvas.width=256; canvas.height=256;
    // Declara `ctx` para conservar referencias o estado consumidos por las operaciones siguientes.
    var ctx=canvas.getContext('2d'); ctx.fillStyle='#ebe9e4'; ctx.fillRect(0,0,256,256);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var y=0;y<256;y+=12){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ctx.fillStyle=(y/12)%2?'rgba(255,255,255,.018)':'rgba(79,71,61,.014)';
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.fillRect(0,y,256,12);
    }
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var i=0;i<140;i++){
      // Declara `x` para conservar referencias o estado consumidos por las operaciones siguientes.
      var x=(i*73)%256, py=(i*47)%256;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ctx.fillStyle=i%3?'rgba(77,70,62,.028)':'rgba(255,255,255,.045)';
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.fillRect(x,py,1+(i%2),1);
    }
    // Declara `tex` para conservar referencias o estado consumidos por las operaciones siguientes.
    var tex=new THREE.CanvasTexture(canvas); if('colorSpace' in tex)tex.colorSpace=THREE.SRGBColorSpace;
    // Copia los valores calculados en el objeto mutable que consumen los pasos siguientes.
    tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(3.2,2.4);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(renderer&&renderer.capabilities)tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return new THREE.MeshStandardMaterial({map:tex,color:color,roughness:0.98,metalness:0});
  }

  // Define la rutina `buildAmbientRoom`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function buildAmbientRoom(){
    // Declara `sideX` para conservar referencias o estado consumidos por las operaciones siguientes.
    var sideX=-2.05, roomRight=2.30, roomWidth=roomRight-sideX, roomDepth=18.0, wallHeight=5.2;
    // Declara `roomCenterX` para conservar referencias o estado consumidos por las operaciones siguientes.
    var roomCenterX=(sideX+roomRight)/2, backZ=-1.35, roomCenterZ=backZ+roomDepth/2;

    // Crea una instancia de Three.js que integra la geometría, material o escena.
    roomFloor=new THREE.Mesh(new THREE.PlaneGeometry(roomWidth,roomDepth),makeWoodFloorMaterial());
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomFloor.name='s3d-floor-shadow-receiver';
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    roomFloor.rotation.x=-Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomFloor.position.set(roomCenterX,-0.006,roomCenterZ);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomFloor.receiveShadow=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomFloor.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomFloor);

    // Declara `wallMat` para conservar referencias o estado consumidos por las operaciones siguientes.
    var wallMat=makePlasterWallMaterial(0xe1ddd3);
    // Declara `sideWallMat` para conservar referencias o estado consumidos por las operaciones siguientes.
    var sideWallMat=makePlasterWallMaterial(0xd5d0c6);
    // Declara `rightWallMat` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightWallMat=makePlasterWallMaterial(0xdbd7ce);
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    roomWall=new THREE.Mesh(new THREE.PlaneGeometry(roomWidth,wallHeight),wallMat);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomWall.name='s3d-room-wall';
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomWall.position.set(roomCenterX,wallHeight/2,backZ);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomWall.receiveShadow=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomWall.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomWall);

    // Crea una instancia de Three.js que integra la geometría, material o escena.
    roomSideWall=new THREE.Mesh(new THREE.PlaneGeometry(roomDepth,wallHeight),sideWallMat);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomSideWall.name='s3d-room-side-wall';
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    roomSideWall.rotation.y=Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomSideWall.position.set(sideX,wallHeight/2,roomCenterZ);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomSideWall.receiveShadow=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomSideWall.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomSideWall);

    // Crea una instancia de Three.js que integra la geometría, material o escena.
    roomRightWall=new THREE.Mesh(new THREE.PlaneGeometry(roomDepth,wallHeight),rightWallMat);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightWall.name='s3d-room-right-wall';
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    roomRightWall.rotation.y=-Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomRightWall.position.set(roomRight,wallHeight/2,roomCenterZ);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightWall.receiveShadow=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightWall.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomRightWall);

    // Crea una instancia de Three.js que integra la geometría, material o escena.
    roomCeiling=new THREE.Mesh(
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.PlaneGeometry(roomWidth,roomDepth),
      // Crea una instancia de Three.js que integra la geometría, material o escena.
      new THREE.MeshStandardMaterial({color:0xe5e1d8,roughness:0.98,metalness:0})
    );
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomCeiling.name='s3d-room-ceiling';
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    roomCeiling.rotation.x=Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomCeiling.position.set(roomCenterX,wallHeight,roomCenterZ);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomCeiling.receiveShadow=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomCeiling.castShadow=false;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomCeiling);

    // Declara `baseboardMat` para conservar referencias o estado consumidos por las operaciones siguientes.
    var baseboardMat=mat(0xc4baa7,{r:0.86,m:0.01});
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomBaseboard=mesh(rbox(roomWidth,0.065,0.04,0.006),baseboardMat);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomBaseboard.name='s3d-baseboard';
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomBaseboard.position.set(roomCenterX,0.04,backZ+0.022);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomBaseboard.castShadow=false;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomBaseboard.receiveShadow=true;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomBaseboard);

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomSideBaseboard=mesh(rbox(0.04,0.065,roomDepth,0.006),baseboardMat);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomSideBaseboard.name='s3d-side-baseboard';
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomSideBaseboard.position.set(sideX+0.022,0.04,roomCenterZ);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomSideBaseboard.castShadow=false;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomSideBaseboard.receiveShadow=true;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomSideBaseboard);

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightBaseboard=mesh(rbox(0.04,0.065,roomDepth,0.006),baseboardMat);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightBaseboard.name='s3d-right-baseboard';
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomRightBaseboard.position.set(roomRight-0.022,0.04,roomCenterZ);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightBaseboard.castShadow=false;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightBaseboard.receiveShadow=true;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomRightBaseboard);

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomCornerTrim=mesh(rbox(0.045,wallHeight,0.045,0.006),baseboardMat);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomCornerTrim.name='s3d-room-corner-trim';
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomCornerTrim.position.set(sideX+0.024,wallHeight/2,backZ+0.024);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomCornerTrim.castShadow=false;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomCornerTrim.receiveShadow=true;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomCornerTrim);

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightCornerTrim=mesh(rbox(0.045,wallHeight,0.045,0.006),baseboardMat);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightCornerTrim.name='s3d-room-right-corner-trim';
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomRightCornerTrim.position.set(roomRight-0.024,wallHeight/2,backZ+0.024);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightCornerTrim.castShadow=false;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    roomRightCornerTrim.receiveShadow=true;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(roomRightCornerTrim);

    /* Ventana procedural inspirada en la luz lateral y las cortinas de las referencias. */
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    roomWindow=new THREE.Group(); roomWindow.name='s3d-room-window';
    // Declara `windowFrameM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var windowFrameM=mat(0xe8e5de,{r:0.82,m:0.02});
    // Declara `windowGlassM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var windowGlassM=new THREE.MeshStandardMaterial({color:0xb7ccd3,emissive:0xc9dfe6,emissiveIntensity:0.18,roughness:0.38,metalness:0.02});
    // Declara `glass` para conservar referencias o estado consumidos por las operaciones siguientes.
    var glass=mesh(new THREE.PlaneGeometry(0.88,1.18),windowGlassM); glass.position.z=0.004; glass.castShadow=false; roomWindow.add(glass);
    // Declara `winTop` para conservar referencias o estado consumidos por las operaciones siguientes.
    var winTop=mesh(rbox(1.02,0.052,0.050,0.006),windowFrameM); winTop.position.set(0,0.64,0.020); roomWindow.add(winTop);
    // Declara `winBottom` para conservar referencias o estado consumidos por las operaciones siguientes.
    var winBottom=winTop.clone(); winBottom.position.y=-0.64; roomWindow.add(winBottom);
    // Declara `winLeft` para conservar referencias o estado consumidos por las operaciones siguientes.
    var winLeft=mesh(rbox(0.052,1.33,0.050,0.006),windowFrameM); winLeft.position.set(-0.485,0,0.020); roomWindow.add(winLeft);
    // Declara `winRight` para conservar referencias o estado consumidos por las operaciones siguientes.
    var winRight=winLeft.clone(); winRight.position.x=0.485; roomWindow.add(winRight);
    // Declara `winMidV` para conservar referencias o estado consumidos por las operaciones siguientes.
    var winMidV=mesh(rbox(0.034,1.24,0.040,0.005),windowFrameM); winMidV.position.z=0.025; roomWindow.add(winMidV);
    // Declara `winMidH` para conservar referencias o estado consumidos por las operaciones siguientes.
    var winMidH=mesh(rbox(0.94,0.034,0.040,0.005),windowFrameM); winMidH.position.z=0.025; roomWindow.add(winMidH);
    // Declara `sill` para conservar referencias o estado consumidos por las operaciones siguientes.
    var sill=mesh(rbox(1.10,0.055,0.13,0.010),windowFrameM); sill.position.set(0,-0.685,0.060); roomWindow.add(sill);
    // Declara `curtainM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var curtainM=surfaceMat(0xe4dfd5,'fabric',{r:0.98});
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var ci=0;ci<4;ci++){
      // Declara `curtain` para conservar referencias o estado consumidos por las operaciones siguientes.
      var curtain=mesh(rbox(0.105,1.48,0.030,0.012),curtainM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      curtain.position.set(0.57+ci*0.070,-0.02,0.055+Math.sin(ci)*0.012); curtain.castShadow=false; roomWindow.add(curtain);
    }
    // Declara `windowLight` para conservar referencias o estado consumidos por las operaciones siguientes.
    var windowLight=new THREE.PointLight(0xd9eff6,0.20,3.0,2); windowLight.position.set(0,0,0.42); windowLight.castShadow=false; roomWindow.add(windowLight);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomWindow.position.set(-1.18,1.77,backZ+0.030); scene.add(roomWindow);

    /* Elemento ambiental 1: planta de piso discreta, fuera del escritorio. */
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    roomPlant=new THREE.Group(); roomPlant.name='s3d-room-plant';
    // Declara `potM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var potM=mat(0x8f5f43,{r:0.86,m:0.01}), leafM=mat(0x426b51,{r:0.9,m:0.01}), stemM=mat(0x4d5a3f,{r:0.9});
    // Declara `pot` para conservar referencias o estado consumidos por las operaciones siguientes.
    var pot=mesh(new THREE.CylinderGeometry(0.14,0.11,0.22,24),potM); pot.position.y=0.11; roomPlant.add(pot);
    // Declara `stem` para conservar referencias o estado consumidos por las operaciones siguientes.
    var stem=mesh(new THREE.CylinderGeometry(0.012,0.016,0.52,12),stemM); stem.position.y=0.42; roomPlant.add(stem);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var li=0;li<7;li++){
      // Declara `leaf` para conservar referencias o estado consumidos por las operaciones siguientes.
      var leaf=mesh(new THREE.SphereGeometry(0.12,16,10),leafM); var la=li/7*Math.PI*2;
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      leaf.scale.set(0.48,1,0.30); leaf.rotation.z=rad(-28+li*9); leaf.rotation.y=-la;
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      leaf.position.set(Math.cos(la)*0.10,0.46+(li%3)*0.11,Math.sin(la)*0.07); roomPlant.add(leaf);
    }
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomPlant.position.set(-1.28,0,backZ+0.30); scene.add(roomPlant);

    /* Elemento ambiental 2: cuadro abstracto procedural. */
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    roomArt=new THREE.Group(); roomArt.name='s3d-room-art';
    // Declara `artCanvas` para conservar referencias o estado consumidos por las operaciones siguientes.
    var artCanvas=document.createElement('canvas'); artCanvas.width=384; artCanvas.height=256;
    // Declara `actx` para conservar referencias o estado consumidos por las operaciones siguientes.
    var actx=artCanvas.getContext('2d'); actx.fillStyle='#ebe8e1'; actx.fillRect(0,0,384,256);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    actx.fillStyle='#34383a'; actx.fillRect(30,28,132,196); actx.fillStyle='#a7a39a'; actx.fillRect(184,28,168,82);
    // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
    actx.fillStyle='#676b6b'; actx.beginPath(); actx.arc(252,170,57,0,Math.PI*2); actx.fill();
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    actx.fillStyle='#d0ccc2'; actx.fillRect(190,126,64,92); actx.fillStyle='rgba(255,255,255,.68)'; actx.fillRect(204,52,124,12);
    // Declara `artTex` para conservar referencias o estado consumidos por las operaciones siguientes.
    var artTex=new THREE.CanvasTexture(artCanvas); if('colorSpace' in artTex) artTex.colorSpace=THREE.SRGBColorSpace;
    // Declara `art` para conservar referencias o estado consumidos por las operaciones siguientes.
    var art=mesh(new THREE.PlaneGeometry(0.66,0.44),new THREE.MeshStandardMaterial({map:artTex,roughness:0.88,metalness:0})); art.position.z=0.006; art.castShadow=false; roomArt.add(art);
    // Declara `frameM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frameM=mat(0x313840,{r:0.58,m:0.16});
    // Declara `frameTop` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frameTop=mesh(rbox(0.72,0.035,0.035,0.006),frameM); frameTop.position.set(0,0.237,0); roomArt.add(frameTop);
    // Declara `frameBottom` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frameBottom=frameTop.clone(); frameBottom.position.y=-0.237; roomArt.add(frameBottom);
    // Declara `frameLeft` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frameLeft=mesh(rbox(0.035,0.51,0.035,0.006),frameM); frameLeft.position.set(-0.342,0,0); roomArt.add(frameLeft);
    // Declara `frameRight` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frameRight=frameLeft.clone(); frameRight.position.x=0.342; roomArt.add(frameRight);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomArt.position.set(0.58,1.58,backZ+0.026); scene.add(roomArt);

    /* Segundo cuadro discreto, montado sobre la pared lateral derecha. */
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    roomRightArt=new THREE.Group(); roomRightArt.name='s3d-room-right-art';
    // Declara `rightCanvas` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightCanvas=document.createElement('canvas'); rightCanvas.width=256; rightCanvas.height=320;
    // Declara `rctx` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rctx=rightCanvas.getContext('2d'); rctx.fillStyle='#e8e5de'; rctx.fillRect(0,0,256,320);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    rctx.fillStyle='#3f4445'; rctx.fillRect(34,36,188,74); rctx.fillStyle='#9e9b93'; rctx.fillRect(34,132,82,152);
    // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
    rctx.fillStyle='#666b6b'; rctx.beginPath(); rctx.arc(174,210,48,0,Math.PI*2); rctx.fill();
    // Declara `rightTex` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightTex=new THREE.CanvasTexture(rightCanvas); if('colorSpace' in rightTex)rightTex.colorSpace=THREE.SRGBColorSpace;
    // Declara `rightPrint` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightPrint=mesh(new THREE.PlaneGeometry(0.46,0.60),new THREE.MeshStandardMaterial({map:rightTex,roughness:0.90,metalness:0})); rightPrint.position.z=0.006; rightPrint.castShadow=false; roomRightArt.add(rightPrint);
    // Declara `rightFrameM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightFrameM=mat(0x3a3e40,{r:0.62,m:0.12});
    // Declara `rightTop` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightTop=mesh(rbox(0.51,0.030,0.032,0.005),rightFrameM); rightTop.position.set(0,0.315,0); roomRightArt.add(rightTop);
    // Declara `rightBottom` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightBottom=rightTop.clone(); rightBottom.position.y=-0.315; roomRightArt.add(rightBottom);
    // Declara `rightLeft` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightLeft=mesh(rbox(0.030,0.66,0.032,0.005),rightFrameM); rightLeft.position.set(-0.245,0,0); roomRightArt.add(rightLeft);
    // Declara `rightRight` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightRight=rightLeft.clone(); rightRight.position.x=0.245; roomRightArt.add(rightRight);
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    roomRightArt.rotation.y=-Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    roomRightArt.position.set(roomRight-0.026,1.52,-0.42); scene.add(roomRightArt);
  }

  // Declara `_deskWoodMat` para conservar referencias o estado consumidos por las operaciones siguientes.
  var _deskWoodMat=null;
  // Define la rutina `makeDeskWoodMaterial`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function makeDeskWoodMaterial(){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(_deskWoodMat) return _deskWoodMat;
    // Declara `canvas` para conservar referencias o estado consumidos por las operaciones siguientes.
    var canvas=document.createElement('canvas');
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    canvas.width=512; canvas.height=256;
    // Declara `ctx` para conservar referencias o estado consumidos por las operaciones siguientes.
    var ctx=canvas.getContext('2d');
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    ctx.fillStyle='#c9985f';
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    ctx.fillRect(0,0,512,256);
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var z=0;z<256;z+=42){
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ctx.fillStyle=(z/42)%2 ? 'rgba(255,238,204,.12)' : 'rgba(91,49,22,.055)';
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.fillRect(0,z,512,42);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ctx.strokeStyle='rgba(94,57,29,.18)';
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ctx.lineWidth=1;
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.beginPath(); ctx.moveTo(0,z+.5); ctx.lineTo(512,z+.5); ctx.stroke();
    }
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var x=0;x<512;x+=36){
      // Declara `wave` para conservar referencias o estado consumidos por las operaciones siguientes.
      var wave=Math.sin(x*0.055)*5;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      ctx.strokeStyle='rgba(104,61,29,.09)';
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.beginPath();
      // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
      for(var y=0;y<256;y+=12){
        // Declara `px` para conservar referencias o estado consumidos por las operaciones siguientes.
        var px=x+Math.sin(y*.06+x*.02)*4+wave;
        // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
        if(y===0) ctx.moveTo(px,y); else ctx.lineTo(px,y);
      }
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.stroke();
    }
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    ctx.strokeStyle='rgba(255,246,220,.10)';
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var hi=18;hi<256;hi+=42){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      ctx.beginPath(); ctx.moveTo(0,hi+.5); ctx.lineTo(512,hi+.5); ctx.stroke();
    }
    // Declara `tex` para conservar referencias o estado consumidos por las operaciones siguientes.
    var tex=new THREE.CanvasTexture(canvas);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if('colorSpace' in tex) tex.colorSpace=THREE.SRGBColorSpace;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    tex.wrapS=THREE.RepeatWrapping;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    tex.wrapT=THREE.RepeatWrapping;
    // Copia los valores calculados en el objeto mutable que consumen los pasos siguientes.
    tex.repeat.set(1.35,1.05);
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    _deskWoodMat=new THREE.MeshStandardMaterial({map:tex,color:COL.pWood,roughness:0.78,metalness:0});
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return _deskWoodMat;
  }

  // Define la rutina `makeStandingFrame`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function makeStandingFrame(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `black` para conservar referencias o estado consumidos por las operaciones siguientes.
    var black=mat(COL.pStandBlack,{m:0.62,r:0.34});
    // Declara `gun` para conservar referencias o estado consumidos por las operaciones siguientes.
    var gun=mat(COL.pStandGun,{m:0.62,r:0.36});
    // Declara `rail` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rail=mat(COL.pStandRail,{m:0.56,r:0.38});
    // Declara `woodEdge` para conservar referencias o estado consumidos por las operaciones siguientes.
    var woodEdge=mat(COL.pWoodEdge,{r:0.78,m:0.02});
    // Declara `shell` para conservar referencias o estado consumidos por las operaciones siguientes.
    var shell=mat(0xe9e2d4,{r:0.62,m:0.06});
    // Declara `button` para conservar referencias o estado consumidos por las operaciones siguientes.
    var button=mat(0xe8ecee,{r:0.48,m:0.10});

    // Declara `frontEdge` para conservar referencias o estado consumidos por las operaciones siguientes.
    var frontEdge=mesh(rbox(1.52,0.026,0.018,0.006),woodEdge);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    frontEdge.position.set(0,-0.044,0.365); frontEdge.castShadow=false; g.add(frontEdge);
    // Declara `leftEdge` para conservar referencias o estado consumidos por las operaciones siguientes.
    var leftEdge=mesh(rbox(0.018,0.026,0.70,0.006),woodEdge);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    leftEdge.position.set(-0.755,-0.044,0); leftEdge.castShadow=false; g.add(leftEdge);
    // Declara `rightEdge` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rightEdge=mesh(rbox(0.018,0.026,0.70,0.006),woodEdge);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    rightEdge.position.set(0.755,-0.044,0); rightEdge.castShadow=false; g.add(rightEdge);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sx=-1;sx<=1;sx+=2){
      // Declara `plate` para conservar referencias o estado consumidos por las operaciones siguientes.
      var plate=mesh(rbox(0.30,0.018,0.42,0.006),black);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      plate.position.set(sx*0.62,-0.049,-0.020);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(plate);

      // Declara `cap` para conservar referencias o estado consumidos por las operaciones siguientes.
      var cap=mesh(rbox(0.15,0.032,0.12,0.008),gun);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      cap.position.set(sx*0.62,-0.080,-0.265);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(cap);
    }

    // Declara `railOuter` para conservar referencias o estado consumidos por las operaciones siguientes.
    var railOuter=mesh(rbox(1.18,0.046,0.052,0.008),gun);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    railOuter.position.set(0,-0.112,-0.315);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(railOuter);

    // Declara `railSleeve` para conservar referencias o estado consumidos por las operaciones siguientes.
    var railSleeve=mesh(rbox(0.38,0.056,0.064,0.008),rail);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    railSleeve.position.set(0,-0.111,-0.315);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(railSleeve);

    // Declara `railSeam` para conservar referencias o estado consumidos por las operaciones siguientes.
    var railSeam=box(0.012,0.058,0.068,black);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    railSeam.position.set(0.22,-0.111,-0.315);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(railSeam);

    // Declara `controlBox` para conservar referencias o estado consumidos por las operaciones siguientes.
    var controlBox=mesh(rbox(0.25,0.036,0.095,0.008),black);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    controlBox.position.set(0.16,-0.153,-0.305);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(controlBox);

    // Declara `motor` para conservar referencias o estado consumidos por las operaciones siguientes.
    var motor=mesh(new THREE.CylinderGeometry(0.035,0.038,0.23,18),black);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    motor.position.set(0.58,-0.170,-0.270);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(motor);

    // Declara `motorCase` para conservar referencias o estado consumidos por las operaciones siguientes.
    var motorCase=mesh(rbox(0.070,0.180,0.074,0.012),black);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    motorCase.position.set(0.625,-0.155,-0.270);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(motorCase);

    // Declara `cable` para conservar referencias o estado consumidos por las operaciones siguientes.
    var cable=mesh(new THREE.CylinderGeometry(0.004,0.004,0.76,8),mat(COL.cable,{r:0.68}));
    // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
    cable.rotation.z=Math.PI/2;
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    cable.position.set(-0.12,-0.151,-0.348);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(cable);

    // Declara `cableKnob` para conservar referencias o estado consumidos por las operaciones siguientes.
    var cableKnob=mesh(new THREE.SphereGeometry(0.014,12,8),black);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    cableKnob.position.set(-0.48,-0.151,-0.348);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(cableKnob);

    // Declara `keypadShell` para conservar referencias o estado consumidos por las operaciones siguientes.
    var keypadShell=mesh(rbox(0.150,0.026,0.076,0.008),shell);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    keypadShell.position.set(0.555,-0.064,0.390);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(keypadShell);

    // Declara `keypadFace` para conservar referencias o estado consumidos por las operaciones siguientes.
    var keypadFace=mesh(rbox(0.066,0.024,0.006,0.003),black);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    keypadFace.position.set(0.520,-0.064,0.432);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(keypadFace);

    // Declara `display` para conservar referencias o estado consumidos por las operaciones siguientes.
    var display=box(0.018,0.010,0.004,mat(0x0e1114,{e:0x162d36,ei:0.45,r:0.5}));
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    display.position.set(0.498,-0.064,0.436);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    g.add(display);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var i=0;i<3;i++){
      // Declara `btn` para conservar referencias o estado consumidos por las operaciones siguientes.
      var btn=mesh(new THREE.CylinderGeometry(0.0038,0.0038,0.004,10),button);
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      btn.rotation.x=Math.PI/2;
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      btn.position.set(0.516+i*0.014,-0.064,0.437);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(btn);
    }

    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }

  // Define la rutina `buildScene`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function buildScene(){
    // Declara `w` para conservar referencias o estado consumidos por las operaciones siguientes.
    var w=host.clientWidth||520, h=host.clientHeight||390;
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    renderer.setSize(w,h,false); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if('outputColorSpace' in renderer) renderer.outputColorSpace=THREE.SRGBColorSpace;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    host.appendChild(renderer.domElement);

    // Crea una instancia de Three.js que integra la geometría, material o escena.
    scene=new THREE.Scene();

    /* Entorno de reflejos (acabado moderno sobre aluminio/acero/plásticos) */
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(RoomEnv){
      // Inicia una operación que puede fallar por disponibilidad del navegador y habilita un reemplazo seguro.
      try{
        // Declara `pmrem` para conservar referencias o estado consumidos por las operaciones siguientes.
        var pmrem=new THREE.PMREMGenerator(renderer);
        // Instancia el objeto requerido y conserva su referencia para operaciones posteriores.
        scene.environment=pmrem.fromScene(new RoomEnv(),0.04).texture;
      // Captura el fallo anterior y devuelve el control al modo de respaldo.
      }catch(e){ /* sin entorno: materiales siguen viéndose bien */ }
    }

    // Crea una instancia de Three.js que integra la geometría, material o escena.
    camera=new THREE.PerspectiveCamera(42,w/h,0.1,100);
    // Instancia el objeto requerido y conserva su referencia para operaciones posteriores.
    controls=new OrbitControls(camera,renderer.domElement);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.enableDamping=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.dampingFactor=0.08;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.enablePan=false;
    // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
    controls.addEventListener('start',function(){ if(!camFly) userAdjustedCamera=true; });

    /* Zoom y rotación libres dentro de límites razonables */
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.enableZoom=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.zoomSpeed=0.90;

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.enableRotate=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.rotateSpeed=0.78;

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.minDistance=1.10;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.maxDistance=6.50;

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.minPolarAngle=rad(8);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.maxPolarAngle=rad(88);

    /* Mapeo explícito para evitar comportamientos inconsistentes */
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.mouseButtons.MIDDLE=THREE.MOUSE.DOLLY;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.touches.ONE=THREE.TOUCH.ROTATE;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;

    // Crea una instancia de Three.js que integra la geometría, material o escena.
    hemiLight=new THREE.HemisphereLight(0xf2fbff,0xd8bf98,1.02); scene.add(hemiLight);
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    ambientLight=new THREE.AmbientLight(0xc8d8e5,0.43); scene.add(ambientLight);
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    keyLight=new THREE.DirectionalLight(0xffffff,1.90); keyLight.position.set(4.2,5.0,2.8); keyLight.castShadow=true;
    // Copia los valores calculados en el objeto mutable que consumen los pasos siguientes.
    keyLight.shadow.mapSize.set(2048,2048); keyLight.shadow.bias=-0.00018; keyLight.shadow.normalBias=0.018; keyLight.shadow.radius=9;
    // Declara `sc` para conservar referencias o estado consumidos por las operaciones siguientes.
    var sc=keyLight.shadow.camera; sc.near=0.5; sc.far=13; sc.left=-2.35; sc.right=2.35; sc.top=2.35; sc.bottom=-2.35; sc.updateProjectionMatrix();
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    scene.add(keyLight);
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    rimLight=new THREE.DirectionalLight(0x9fd8ff,0.22); rimLight.position.set(-3,2.1,-2.5); scene.add(rimLight);
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    fillLight=new THREE.DirectionalLight(0xffe0b8,0.48); fillLight.position.set(2.2,2.0,3.4); scene.add(fillLight);

    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    buildAmbientRoom();

    // Crea una instancia de Three.js que integra la geometría, material o escena.
    surfaceAnchor=new THREE.Object3D(); surfaceAnchor.position.y=curTopY; scene.add(surfaceAnchor);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    deskTop=mesh(rbox(1.5,0.04,0.72,0.012),mat(COL.surface,{r:0.6,m:0.04})); deskTop.position.y=-0.02; surfaceAnchor.add(deskTop);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    deskEdge=mesh(rbox(1.52,0.012,0.74,0.012),mat(COL.edge,{r:0.7})); deskEdge.position.y=-0.045; deskEdge.castShadow=false; surfaceAnchor.add(deskEdge);

    /* Iluminacion localizada de pGlow: solo superficie, sin alterar la sala. */
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    glowTarget=new THREE.Object3D(); glowTarget.position.set(0,0,0.05); surfaceAnchor.add(glowTarget);
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    glowSpot=new THREE.SpotLight(0xffd9a6,0,1.45,rad(38),0.72,2);
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    glowSpot.position.set(0,0.52,-0.10); glowSpot.target=glowTarget; glowSpot.visible=false; surfaceAnchor.add(glowSpot);
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    glowPool=mesh(new THREE.CircleGeometry(0.48,48),new THREE.MeshBasicMaterial({color:0xffd49a,transparent:true,opacity:0.16,depthWrite:false}));
    // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
    glowPool.rotation.x=-Math.PI/2; glowPool.scale.set(1.45,0.82,1); glowPool.position.set(0,0.004,0.035); glowPool.visible=false; glowPool.castShadow=false; glowPool.receiveShadow=false; surfaceAnchor.add(glowPool);
    /* Escritorio base limpio: sin viga trasera ni control genérico.
       Esos elementos no pertenecen a ningún producto seleccionado. */
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    deskBeam=null;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    deskControl=null;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    deskButtons=[];
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    standingFrame=makeStandingFrame(); standingFrame.visible=false; surfaceAnchor.add(standingFrame);

    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    legL=makeLeg(); legR=makeLeg(); scene.add(legL,legR); setLegs();

    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    DSI.forEach(function(id){
      // Declara `cfg` para conservar referencias o estado consumidos por las operaciones siguientes.
      var cfg=REGISTRY[id]; if(!cfg) return;
      // Declara `holder` para conservar referencias o estado consumidos por las operaciones siguientes.
      var holder=new THREE.Group();
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      holder.name=id; holder.userData.dsiId=id;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      holder.userData.draggable=cfg.draggable!==false;
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      holder.add(cfg.build());
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(id==='dsi-hub') holder.scale.setScalar(cfg.scale);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      holder.userData.restScale=holder.scale.clone();
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      holder.visible=false; objects[id]=holder;
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(id==='dsi-chair'){ scene.add(holder); }
      // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
      else if(id==='dsi-lumbar'&&objects['dsi-chair']){ objects['dsi-chair'].add(holder); }
      // Ejecuta la alternativa cuando la condición anterior no se cumple.
      else { surfaceAnchor.add(holder); }
    });

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    ready=true;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    placeAll(false);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    setupDrag();
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    setView('perspectiva',false);
    // Declara `ro` para conservar referencias o estado consumidos por las operaciones siguientes.
    var ro=new ResizeObserver(function(){ var cw=host.clientWidth,ch=host.clientHeight; if(cw&&ch){ renderer.setSize(cw,ch,false); camera.aspect=cw/ch; camera.updateProjectionMatrix(); if(ready&&!userAdjustedCamera) autoFrame(false,'resize',activeView); } });
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    ro.observe(host);

    // Declara `vis` para conservar referencias o estado consumidos por las operaciones siguientes.
    var vis=new IntersectionObserver(function(en){ if(en[0].isIntersecting){ running=true; renderer.setAnimationLoop(loop); } else { running=false; renderer.setAnimationLoop(null); } },{threshold:0.01});
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    vis.observe(stageEl);

    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(hasPrimOfficeState) renderComparison(false,{force:true,reason:'initial'});
    // Ejecuta la alternativa cuando la condición anterior no se cumple.
    else refreshFromDOM();
  }

  /* Columna telescopica de escritorio (segmento inferior fijo + superior deslizante) */
  // Define la rutina `makeLeg`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function makeLeg(){
    // Declara `g` para conservar referencias o estado consumidos por las operaciones siguientes.
    var g=new THREE.Group();
    // Declara `dk` para conservar referencias o estado consumidos por las operaciones siguientes.
    var dk=mat(COL.frame,{m:0.6,r:0.4}), ft=mat(COL.frameDark,{m:0.5,r:0.5});
    // Declara `foot` para conservar referencias o estado consumidos por las operaciones siguientes.
    var foot=mesh(rbox(0.10,0.035,0.50,0.01),ft); foot.position.y=0.0175; g.userData.foot=foot; g.add(foot);
    // Declara `lower` para conservar referencias o estado consumidos por las operaciones siguientes.
    var lower=mesh(rbox(0.085,1,0.085,0.012),dk); g.userData.lower=lower; g.add(lower);
    // Declara `upper` para conservar referencias o estado consumidos por las operaciones siguientes.
    var upper=mesh(rbox(0.062,1,0.062,0.01),dk); g.userData.upper=upper; g.add(upper);

    // Declara `standingOnly` para conservar referencias o estado consumidos por las operaciones siguientes.
    var standingOnly=[];
    // Declara `glideM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var glideM=mat(0x0f1012,{m:0.45,r:0.46});
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sz=-1;sz<=1;sz+=2){
      // Declara `glide` para conservar referencias o estado consumidos por las operaciones siguientes.
      var glide=mesh(new THREE.CylinderGeometry(0.028,0.032,0.014,18),glideM);
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      glide.position.set(0,0.007,sz*0.285);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(glide); standingOnly.push(glide);
    }

    // Declara `faceM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var faceM=mat(0x111315,{m:0.52,r:0.42});
    // Declara `lowerFace` para conservar referencias o estado consumidos por las operaciones siguientes.
    var lowerFace=mesh(rbox(0.052,1,0.004,0.002),faceM);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    lowerFace.position.z=0.046; g.add(lowerFace); standingOnly.push(lowerFace);
    // Declara `upperFace` para conservar referencias o estado consumidos por las operaciones siguientes.
    var upperFace=mesh(rbox(0.040,1,0.004,0.002),faceM);
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    upperFace.position.z=0.034; g.add(upperFace); standingOnly.push(upperFace);

    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var sy=0.11;sy<=0.23;sy+=0.12){
      // Declara `screw` para conservar referencias o estado consumidos por las operaciones siguientes.
      var screw=mesh(new THREE.CylinderGeometry(0.005,0.005,0.003,10),mat(0x08090a,{m:0.5,r:0.5}));
      // Orienta el objeto en el eje correspondiente para respetar la composición prevista.
      screw.rotation.x=Math.PI/2;
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      screw.position.set(0.024,sy,0.049);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      g.add(screw); standingOnly.push(screw);
    }

    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    standingOnly.forEach(function(p){ p.visible=false; });
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    g.userData.standingOnly=standingOnly;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    g.userData.lowerFace=lowerFace;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    g.userData.upperFace=upperFace;
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return g;
  }
  // Define la rutina `setLegs`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setLegs(){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!legL||!legR) return;
    // Declara `colH` para conservar referencias o estado consumidos por las operaciones siguientes.
    var colH=Math.max(0.30,curTopY-0.04), xx=0.62, lowerH=deskModeStanding?0.50:0.40;
    // Declara `lowerM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var lowerM=deskModeStanding ? mat(COL.pStandGun,{m:0.62,r:0.36}) : mat(COL.frame,{m:0.6,r:0.4});
    // Declara `upperM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var upperM=deskModeStanding ? mat(COL.pStandRail,{m:0.58,r:0.38}) : mat(COL.frame,{m:0.6,r:0.4});
    // Declara `footM` para conservar referencias o estado consumidos por las operaciones siguientes.
    var footM=deskModeStanding ? mat(COL.pStandBlack,{m:0.62,r:0.34}) : mat(COL.frameDark,{m:0.5,r:0.5});
    // Define una devolución que la API invoca con cada valor o al ocurrir la transición.
    [legL,legR].forEach(function(L,i){
      // Sitúa el objeto en la escena; el encuadre y los apoyos dependen de esta posición.
      L.position.set(i===0?-xx:xx,0,0);
      // Declara `lo` para conservar referencias o estado consumidos por las operaciones siguientes.
      var lo=L.userData.lower, up=L.userData.upper, ft=L.userData.foot;
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(ft){
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        ft.material=footM;
        // Ajusta la escala tridimensional sin reconstruir la geometría.
        ft.scale.set(deskModeStanding?1.18:1,deskModeStanding?1.22:1,deskModeStanding?1.30:1);
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        ft.position.y=deskModeStanding?0.022:0.0175;
      }
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      lo.material=lowerM; up.material=upperM;
      // Ajusta la escala tridimensional sin reconstruir la geometría.
      lo.scale.set(deskModeStanding?1.08:1,lowerH,deskModeStanding?1.04:1);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      lo.position.y=0.02+lowerH/2;
      // Declara `upH` para conservar referencias o estado consumidos por las operaciones siguientes.
      var upH=Math.max(0.05,colH-lowerH);
      // Ajusta la escala tridimensional sin reconstruir la geometría.
      up.scale.set(deskModeStanding?0.96:1,upH,deskModeStanding?0.96:1);
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      up.position.y=0.02+lowerH+upH/2;

      // Declara `details` para conservar referencias o estado consumidos por las operaciones siguientes.
      var details=L.userData.standingOnly||[];
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      details.forEach(function(p){ p.visible=deskModeStanding; });
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(L.userData.lowerFace){
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        L.userData.lowerFace.scale.y=lowerH;
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        L.userData.lowerFace.position.y=0.02+lowerH/2;
      }
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(L.userData.upperFace){
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        L.userData.upperFace.scale.y=upH;
        // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
        L.userData.upperFace.position.y=0.02+lowerH+upH/2;
      }
    });
  }

  // Define la rutina `setDeskVisual`: recibe `standing` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setDeskVisual(standing){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    standing=!!standing;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    deskModeStanding=standing;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(deskTop) deskTop.material=standing ? makeDeskWoodMaterial() : mat(COL.surface,{r:0.6,m:0.04});
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(deskEdge) deskEdge.material=standing ? mat(COL.pWoodEdge,{r:0.78,m:0.02}) : mat(COL.edge,{r:0.7});
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(deskBeam) deskBeam.visible=!standing;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(deskControl) deskControl.visible=!standing;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    deskButtons.forEach(function(b){ b.visible=!standing; });
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(standingFrame) standingFrame.visible=standing;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    setLegs();
  }

  // Define la rutina `setDeskMode`: recibe `standing`, `animated` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setDeskMode(standing,animated){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    standing=!!standing;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    setDeskVisual(standing);
    // Declara `target` para conservar referencias o estado consumidos por las operaciones siguientes.
    var target=standing?DESK_STAND:DESK_SIT; if(target===curTopY)return;
    // Declara `from` para conservar referencias o estado consumidos por las operaciones siguientes.
    var from=curTopY;
    // Actualiza el controlador o recurso antes del próximo fotograma.
    addTween(animated&&!reduce&&running?620:0,function(e){ curTopY=lerp(from,target,e); if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); },function(){ if(controls)controls.update(); });
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(reduce||!animated){ curTopY=target; if(surfaceAnchor)surfaceAnchor.position.y=curTopY; setLegs(); }
  }

  /* ---- camara ---- */
  // Define la rutina `normalizedView`: recibe `v` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function normalizedView(v){ return (v==='frontal'||v==='superior') ? v : 'perspectiva'; }
  // Define la rutina `actuallyVisible`: recibe `node`, `root` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function actuallyVisible(node,root){
    // Declara `current` para conservar referencias o estado consumidos por las operaciones siguientes.
    var current=node;
    // Repite el bloque mientras se mantenga la condición y avanza sobre la estructura enlazada.
    while(current){ if(current.visible===false) return false; if(current===root) break; current=current.parent; }
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return true;
  }
  // Define la rutina `expandVisibleBounds`: recibe `box3`, `root` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function expandVisibleBounds(box3,root){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!root||root.visible===false) return;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    root.updateWorldMatrix(true,true);
    // Recorre el subárbol gráfico para actualizar cada nodo compatible.
    root.traverse(function(node){
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(!node.isMesh||!actuallyVisible(node,root)) return;
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(!node.geometry.boundingBox) return;
      // Declara `local` para conservar referencias o estado consumidos por las operaciones siguientes.
      var local=node.geometry.boundingBox.clone(); local.applyMatrix4(node.matrixWorld); box3.union(local);
    });
  }
  // Define la rutina `contentBounds`: recibe `plannedStanding` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function contentBounds(plannedStanding){
    // Declara `bounds` para conservar referencias o estado consumidos por las operaciones siguientes.
    var bounds=new THREE.Box3(); bounds.makeEmpty();
    // Define una devolución que la API invoca con cada valor o al ocurrir la transición.
    [deskTop,deskEdge,standingFrame,legL,legR].forEach(function(node){ expandVisibleBounds(bounds,node); });
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    DSI.forEach(function(id){ var node=objects[id]; if(node&&node.visible) expandVisibleBounds(bounds,node); });
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(bounds.isEmpty()) bounds.set(new THREE.Vector3(-0.8,0,-0.4),new THREE.Vector3(0.8,1.3,1.35));
    // Declara `plannedY` para conservar referencias o estado consumidos por las operaciones siguientes.
    var plannedY=plannedStanding?DESK_STAND:DESK_SIT, delta=plannedY-curTopY;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(Math.abs(delta)>0.001) bounds.max.y=Math.max(bounds.min.y+0.55,bounds.max.y+delta);
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return bounds;
  }
  // Define la rutina `projectedCoverage`: recibe `bounds`, `probe` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function projectedCoverage(bounds,probe){
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    probe.updateProjectionMatrix(); probe.updateMatrixWorld();
    // Declara `min` para conservar referencias o estado consumidos por las operaciones siguientes.
    var min=bounds.min,max=bounds.max;
    // Declara `corners` para conservar referencias o estado consumidos por las operaciones siguientes.
    var corners=[new THREE.Vector3(min.x,min.y,min.z),new THREE.Vector3(max.x,min.y,min.z),new THREE.Vector3(min.x,max.y,min.z),new THREE.Vector3(max.x,max.y,min.z),new THREE.Vector3(min.x,min.y,max.z),new THREE.Vector3(max.x,min.y,max.z),new THREE.Vector3(min.x,max.y,max.z),new THREE.Vector3(max.x,max.y,max.z)];
    // Declara `minX` para conservar referencias o estado consumidos por las operaciones siguientes.
    var minX=1,maxX=-1,minY=1,maxY=-1;
    // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
    corners.forEach(function(point){ point.project(probe); minX=Math.min(minX,point.x); maxX=Math.max(maxX,point.x); minY=Math.min(minY,point.y); maxY=Math.max(maxY,point.y); });
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return {width:(maxX-minX)/2,height:(maxY-minY)/2};
  }
  // Define la rutina `refineFraming`: recibe `spec` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function refineFraming(spec){
    // Declara `direction` para conservar referencias o estado consumidos por las operaciones siguientes.
    var direction=spec.p.clone().sub(spec.t).normalize();
    // Recorre la colección o rango para construir o actualizar cada elemento de manera uniforme.
    for(var i=0;i<3;i++){
      // Declara `probe` para conservar referencias o estado consumidos por las operaciones siguientes.
      var probe=camera.clone(); probe.aspect=camera.aspect; probe.position.copy(spec.p); probe.lookAt(spec.t);
      // Declara `coverage` para conservar referencias o estado consumidos por las operaciones siguientes.
      var coverage=projectedCoverage(spec.bounds,probe);
      // Declara `targetHeight` para conservar referencias o estado consumidos por las operaciones siguientes.
      var targetHeight=spec.view==='perspectiva'?0.92:0.87;
      // Declara `scale` para conservar referencias o estado consumidos por las operaciones siguientes.
      var scale=Math.max(coverage.width/0.83,coverage.height/targetHeight);
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(Math.abs(scale-1)<0.015) break;
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      spec.distance=clampN(spec.distance*scale*1.015,1.45,5.40);
      // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
      spec.p.copy(spec.t).add(direction.clone().multiplyScalar(spec.distance));
    }
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return spec;
  }
  // Define la rutina `framingSpec`: recibe `view`, `plannedStanding` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function framingSpec(view,plannedStanding){
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    view=normalizedView(view); var bounds=contentBounds(plannedStanding), size=new THREE.Vector3(), center=new THREE.Vector3();
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    bounds.getSize(size); bounds.getCenter(center);
    // Declara `vfov` para conservar referencias o estado consumidos por las operaciones siguientes.
    var vfov=rad(camera.fov), hfov=2*Math.atan(Math.tan(vfov/2)*camera.aspect), useful=0.82;
    // Declara `fitW` para conservar referencias o estado consumidos por las operaciones siguientes.
    var fitW=(size.x*0.5)/(Math.tan(hfov/2)*useful), fitH;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(view==='superior') fitH=(size.z*0.5)/(Math.tan(vfov/2)*0.80);
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    else if(view==='frontal') fitH=(size.y*0.5)/(Math.tan(vfov/2)*0.82);
    // Ejecuta la alternativa cuando la condición anterior no se cumple.
    else fitH=((size.y+size.z*0.16)*0.5)/(Math.tan(vfov/2)*0.82);
    // Declara `distance` para conservar referencias o estado consumidos por las operaciones siguientes.
    var distance=clampN(Math.max(fitW,fitH)+(view==='perspectiva'?size.z*0.10:0.08),1.45,5.40);
    // Declara `direction` para conservar referencias o estado consumidos por las operaciones siguientes.
    var direction;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(view==='superior') direction=new THREE.Vector3(0.001,1,0.001);
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    else if(view==='frontal') direction=new THREE.Vector3(0,0.16,1);
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    else if(comparisonMode==='current') direction=new THREE.Vector3(0.34,0.46,1.75);
    // Ejecuta la alternativa cuando la condición anterior no se cumple.
    else direction=new THREE.Vector3(1.18,0.72,1.46);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    direction.normalize();
    // Declara `target` para conservar referencias o estado consumidos por las operaciones siguientes.
    var target=center.clone();
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(view==='perspectiva') target.y+=comparisonMode==='current'?-0.02:0.04;
    // Declara `position` para conservar referencias o estado consumidos por las operaciones siguientes.
    var position=target.clone().add(direction.multiplyScalar(distance));
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(view==='superior') position.x+=0.001;
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return refineFraming({p:position,t:target,bounds:bounds,distance:distance,view:view});
  }
  // Define la rutina `writeFrameDiagnostics`: recibe `spec` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function writeFrameDiagnostics(spec){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!stageEl||!spec||!spec.bounds) return;
    // Declara `coverage` para conservar referencias o estado consumidos por las operaciones siguientes.
    var coverage=projectedCoverage(spec.bounds,camera);
    // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
    stageEl.setAttribute('data-s3d-projected-width',String(Math.round(coverage.width*100)));
    // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
    stageEl.setAttribute('data-s3d-projected-height',String(Math.round(coverage.height*100)));
    // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
    stageEl.setAttribute('data-s3d-camera-distance',spec.distance.toFixed(2));
  }
  // Define la rutina `animateCamera`: recibe `spec`, `animated`, `reason` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function animateCamera(spec,animated,reason){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    zoomTarget=null; var token=++cameraTweenToken, duration=animated&&!reduce&&running?560:0;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    userAdjustedCamera=false;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!duration){ camera.position.copy(spec.p); controls.target.copy(spec.t); camera.lookAt(spec.t); controls.update(); camFly=false; controls.enabled=true; writeFrameDiagnostics(spec); }
    else{
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      camFly=true; controls.enabled=false; var p0=camera.position.clone(),t0=controls.target.clone();
      // Actualiza el controlador o recurso antes del próximo fotograma.
      addTween(duration,function(e){ if(token!==cameraTweenToken) return; camera.position.lerpVectors(p0,spec.p,e); controls.target.lerpVectors(t0,spec.t,e); camera.lookAt(controls.target); },function(){ if(token!==cameraTweenToken) return; camFly=false; controls.enabled=true; controls.update(); writeFrameDiagnostics(spec); });
    }
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(stageEl){
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-camera',comparisonMode+'-'+spec.view);
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-frame-reason',reason||'manual');
      // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
      stageEl.setAttribute('data-s3d-frame-width','82');
    }
  }
  // Define la rutina `autoFrame`: recibe `animated`, `reason`, `view` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function autoFrame(animated,reason,view){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!ready) return;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    activeView=normalizedView(view||activeView);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    setStageView(activeView); animateCamera(framingSpec(activeView,deskModeStanding),animated,reason); highlight(activeView);
  }
  // Define la rutina `objectOutsideFrame`: recibe `id` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function objectOutsideFrame(id){
    // Declara `object` para conservar referencias o estado consumidos por las operaciones siguientes.
    var object=objects[id]; if(!object||!object.visible) return false;
    // Declara `box3` para conservar referencias o estado consumidos por las operaciones siguientes.
    var box3=new THREE.Box3(); box3.makeEmpty(); expandVisibleBounds(box3,object); if(box3.isEmpty()) return false;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    // Declara `min` para conservar referencias o estado consumidos por las operaciones siguientes.
    var min=box3.min,max=box3.max;
    // Declara `corners` para conservar referencias o estado consumidos por las operaciones siguientes.
    var corners=[new THREE.Vector3(min.x,min.y,min.z),new THREE.Vector3(max.x,min.y,min.z),new THREE.Vector3(min.x,max.y,min.z),new THREE.Vector3(max.x,max.y,min.z),new THREE.Vector3(min.x,min.y,max.z),new THREE.Vector3(max.x,min.y,max.z),new THREE.Vector3(min.x,max.y,max.z),new THREE.Vector3(max.x,max.y,max.z)];
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return corners.some(function(point){ point.project(camera); return Math.abs(point.x)>0.90||Math.abs(point.y)>0.88||point.z<-1||point.z>1; });
  }
  // Define la rutina `importantChangeOutsideFrame`: recibe `changedIds` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function importantChangeOutsideFrame(changedIds){
    // Declara `important` para conservar referencias o estado consumidos por las operaciones siguientes.
    var important={'dsi-monitor-arm':1,'dsi-stand':1,'dsi-laptop':1,'dsi-lumbar':1,'dsi-chair':1};
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return (changedIds||[]).some(function(id){ return important[id]&&objectOutsideFrame(id); });
  }
  // Define la rutina `setStageView`: recibe `v` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setStageView(v){
    // Declara `nv` para conservar referencias o estado consumidos por las operaciones siguientes.
    var nv=normalizedView(v);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(stageEl) stageEl.setAttribute('data-s3d-view',nv);
    // Declara `showWall` para conservar referencias o estado consumidos por las operaciones siguientes.
    var showWall=nv!=='superior';
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomFloor) roomFloor.receiveShadow=true;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomWall) roomWall.visible=showWall;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomSideWall) roomSideWall.visible=showWall;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomRightWall) roomRightWall.visible=showWall;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomCeiling) roomCeiling.visible=showWall;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomBaseboard) roomBaseboard.visible=showWall;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomSideBaseboard) roomSideBaseboard.visible=showWall;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomRightBaseboard) roomRightBaseboard.visible=showWall;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomCornerTrim) roomCornerTrim.visible=showWall;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomRightCornerTrim) roomRightCornerTrim.visible=showWall;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomArt) roomArt.visible=false;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomRightArt) roomRightArt.visible=false;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(roomWindow) roomWindow.visible=showWall;
  }
  // Define la rutina `setView`: recibe `v`, `animated` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setView(v,animated){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!ready)return;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    activeView=normalizedView(v); autoFrame(animated,'toolbar',activeView);
  }
  // Define la rutina `highlight`: recibe `v` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function highlight(v){ if(!toolbar)return; var hv=v==='reset'?'perspectiva':v; toolbar.querySelectorAll('[data-view]').forEach(function(b){ var on=b.getAttribute('data-view')===hv; b.classList.toggle('is-active',on); b.setAttribute('aria-pressed',on?'true':'false'); }); }

  // Define la rutina `loop`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function loop(){
    // Declara `now` para conservar referencias o estado consumidos por las operaciones siguientes.
    var now=performance.now();

    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    stepTweens(now);

    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!camFly && controls && !dragObj){
      // Actualiza el controlador o recurso antes del próximo fotograma.
      controls.update();
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      stepSmoothZoom();
    }

    // Dibuja el estado actual de la escena y produce el fotograma visible.
    renderer.render(scene,camera);
  }  
  // Define la rutina `render1`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function render1(){ if(renderer&&scene&&camera) renderer.render(scene,camera); }

  /* =====================================================================
     MODO LIBRE — arrastrar objetos sobre la superficie (raycasting + plano)
     ===================================================================== */
  // Declara `freeMode` para conservar referencias o estado consumidos por las operaciones siguientes.
  var freeMode=false, dragObj=null, raycaster=null, ndc=null, dragPlane=null, dragOffset=null, freeBtn=null;
  /* Zoom suave y continuo:
   normaliza la rueda para evitar saltos bruscos al mínimo o máximo. */
// Declara `zoomTarget` para conservar referencias o estado consumidos por las operaciones siguientes.
var zoomTarget=null;

// Define la rutina `cameraDistance`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
function cameraDistance(){
  // Devuelve este resultado al llamador y finaliza aquí la rutina.
  return (camera && controls)
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    ? camera.position.distanceTo(controls.target)
    // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
    : 0;
}

// Define la rutina `onWheelZoom`: recibe `ev` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
function onWheelZoom(ev){
  // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
  if(!ready || !camera || !controls || camFly) return;

  // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
  ev.preventDefault();
  // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
  ev.stopImmediatePropagation();

  // Declara `delta` para conservar referencias o estado consumidos por las operaciones siguientes.
  var delta=ev.deltaY;

  /* Normalización entre mouse tradicional, touchpad y navegadores */
  // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
  if(ev.deltaMode===1) delta*=16;
  // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
  else if(ev.deltaMode===2) delta*=window.innerHeight;

  /* Un gesto nunca debe disparar un salto gigante */
  // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
  delta=clampN(delta,-120,120);

  // Declara `base` para conservar referencias o estado consumidos por las operaciones siguientes.
  var base=zoomTarget!=null
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    ? zoomTarget
    // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
    : cameraDistance();

  // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
  zoomTarget=clampN(
    // Calcula el valor numérico que alimenta la geometría, interpolación o límite.
    base*Math.exp(delta*0.0012),
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    0.95,
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    7.50
  );
}

// Define la rutina `stepSmoothZoom`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
function stepSmoothZoom(){
  // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
  if(zoomTarget==null || !camera || !controls) return;

  // Declara `offset` para conservar referencias o estado consumidos por las operaciones siguientes.
  var offset=camera.position.clone().sub(controls.target);
  // Declara `dist` para conservar referencias o estado consumidos por las operaciones siguientes.
  var dist=offset.length();

  // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
  if(dist<0.0001){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    zoomTarget=null;
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return;
  }

  // Declara `next` para conservar referencias o estado consumidos por las operaciones siguientes.
  var next=lerp(dist,zoomTarget,0.18);

  // Continúa la construcción o actualización del adaptador con la operación de esta línea.
  camera.position
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    .copy(controls.target)
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    .add(offset.multiplyScalar(next/dist));

  // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
  if(Math.abs(next-zoomTarget)<0.002){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    zoomTarget=null;
  }
}
  // Define la rutina `setupDrag`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setupDrag(){
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    raycaster=new THREE.Raycaster();
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    ndc=new THREE.Vector2();
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    dragPlane=new THREE.Plane();
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    dragOffset=new THREE.Vector3();
    // Declara `el` para conservar referencias o estado consumidos por las operaciones siguientes.
    var el=renderer.domElement;
    // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
    el.addEventListener('pointerdown', onPointerDown, true);   /* captura: antes que OrbitControls */
    // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
    el.addEventListener('wheel', onWheelZoom, {
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    capture:true,
    // Continúa la construcción o actualización del adaptador con la operación de esta línea.
    passive:false
  });

    // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
    window.addEventListener('pointermove', onPointerMove, true);
    // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
    window.addEventListener('pointerup', onPointerUp, true);
    // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
    window.addEventListener('pointercancel', onPointerUp, true);
    // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
    el.addEventListener('pointermove', onHover);
  }
  // Define la rutina `ndcFrom`: recibe `ev` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function ndcFrom(ev){
    // Declara `r` para conservar referencias o estado consumidos por las operaciones siguientes.
    var r=renderer.domElement.getBoundingClientRect();
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    ndc.x=((ev.clientX-r.left)/r.width)*2-1;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    ndc.y=-((ev.clientY-r.top)/r.height)*2+1;
  }
  // Define la rutina `visibleHolders`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function visibleHolders(){
    // Declara `out` para conservar referencias o estado consumidos por las operaciones siguientes.
    var out=[]; DSI.forEach(function(id){ var o=objects[id]; if(o&&o.visible&&o.userData.draggable!==false) out.push(o); }); return out;
  }
  // Define la rutina `topHolder`: recibe `o` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function topHolder(o){ while(o){ if(o.userData && o.userData.dsiId) return o; o=o.parent; } return null; }
  // Define la rutina `pickHolder`: recibe `ev` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function pickHolder(ev){
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    ndcFrom(ev); raycaster.setFromCamera(ndc,camera);
    // Declara `hits` para conservar referencias o estado consumidos por las operaciones siguientes.
    var hits=raycaster.intersectObjects(visibleHolders(),true);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!hits.length) return null;
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return { holder: topHolder(hits[0].object), point: hits[0].point };
  }
  /* límites coherentes por objeto (espacio local del padre) */
  // Define la rutina `clampLocal`: recibe `h`, `local` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function clampLocal(h,local){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(h.userData.dsiId==='dsi-chair'){ local.x=clampN(local.x,-0.62,0.62); local.z=clampN(local.z,0.5,1.55); }
    // Ejecuta la alternativa cuando la condición anterior no se cumple.
    else { local.x=clampN(local.x,-0.66,0.66); local.z=clampN(local.z,-0.30,0.30); }
  }
  // Define la rutina `onPointerDown`: recibe `ev` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function onPointerDown(ev){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!freeMode || !ready) return;
    // Declara `pick` para conservar referencias o estado consumidos por las operaciones siguientes.
    var pick=pickHolder(ev);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!pick || !pick.holder){ return; }   /* clic en vacío -> deja orbitar */
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    dragObj=pick.holder;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    controls.enabled=false;
    // Declara `wp` para conservar referencias o estado consumidos por las operaciones siguientes.
    var wp=new THREE.Vector3(); dragObj.getWorldPosition(wp);
    // Crea una instancia de Three.js que integra la geometría, material o escena.
    dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0), wp);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    dragOffset.copy(wp).sub(pick.point);  /* mantener el punto de agarre bajo el cursor */
    // Ajusta una propiedad visual en línea para reflejar de inmediato el estado calculado.
    renderer.domElement.style.cursor='grabbing';
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    ev.preventDefault();
  }
  // Define la rutina `onPointerMove`: recibe `ev` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function onPointerMove(ev){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!dragObj) return;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    ndcFrom(ev); raycaster.setFromCamera(ndc,camera);
    // Declara `pt` para conservar referencias o estado consumidos por las operaciones siguientes.
    var pt=new THREE.Vector3();
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!raycaster.ray.intersectPlane(dragPlane,pt)) return;
    // Añade el hijo al grupo o escena; desde aquí hereda transformaciones y visibilidad.
    pt.add(dragOffset);
    // Declara `parent` para conservar referencias o estado consumidos por las operaciones siguientes.
    var parent=dragObj.parent;
    // Declara `local` para conservar referencias o estado consumidos por las operaciones siguientes.
    var local=parent.worldToLocal(pt.clone());
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    local.y=dragObj.position.y;            /* no se mueve en vertical: queda apoyado */
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    clampLocal(dragObj,local);
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    dragObj.position.x=local.x; dragObj.position.z=local.z;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    render1();
  }
  // Define la rutina `onPointerUp`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function onPointerUp(){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(dragObj) dragObj=null;

    /* Recuperación defensiva:
      nunca dejar OrbitControls bloqueado tras finalizar un gesto */
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!camFly && controls) controls.enabled=true;

    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(renderer && renderer.domElement){
      // Ajusta una propiedad visual en línea para reflejar de inmediato el estado calculado.
      renderer.domElement.style.cursor = freeMode ? 'grab' : '';
    }
  }
  // Define la rutina `onHover`: recibe `ev` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function onHover(ev){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!freeMode || dragObj) return;
    // Declara `pick` para conservar referencias o estado consumidos por las operaciones siguientes.
    var pick=pickHolder(ev);
    // Ajusta una propiedad visual en línea para reflejar de inmediato el estado calculado.
    renderer.domElement.style.cursor = (pick && pick.holder) ? 'grab' : 'default';
  }

  // Define la rutina `setHint`: recibe `txt` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setHint(txt){ if(hintEl) hintEl.textContent=txt; }
  // Define la rutina `updateFreeUI`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function updateFreeUI(){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(freeBtn){ freeBtn.classList.toggle('is-active',freeMode); freeBtn.setAttribute('aria-pressed',freeMode?'true':'false'); }
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(stageEl) stageEl.classList.toggle('is-free',freeMode);
    // Ajusta una propiedad visual en línea para reflejar de inmediato el estado calculado.
    renderer.domElement.style.cursor = freeMode ? 'grab' : '';
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    setHint(freeMode
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      ? 'Modo libre · agarrá y arrastrá los objetos · rueda para zoom'
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      : 'Arrastra para rotar · rueda o pellizco para acercar');
  }
  // Define la rutina `setFree`: recibe `on` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setFree(on){
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    freeMode=!!on;

    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!freeMode) dragObj=null;

    /* Al salir o entrar del modo Libre, OrbitControls debe seguir operativo */
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!camFly && controls) controls.enabled=true;

    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    updateFreeUI();
  }
  // Define la rutina `toggleFree`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function toggleFree(){ setFree(!freeMode); }

  /* REINICIAR — todo vuelve a su posición predeterminada (+ cámara, + modo) */
  // Define la rutina `resetPositions`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function resetPositions(){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!ready) return;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    zoomTarget=null;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    setFree(false);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    placeAll(true);                 /* animado a HOME */
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    autoFrame(true,'reset','perspectiva');
  }

  /* ---- Comparador: diagnostico actual vs seleccion PrimOffice ---- */
  // Define la rutina `currentSetupVisible`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function currentSetupVisible(){
    // Declara `vis` para conservar referencias o estado consumidos por las operaciones siguientes.
    var vis={'dsi-context':true,'dsi-chair':true};
    // Declara `computer` para conservar referencias o estado consumidos por las operaciones siguientes.
    var computer=diagnosisValue(2);

    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(computer===0){
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-laptop']=true;
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    }else if(computer===1){
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-monitor']=true;
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-monitor-base']=true;
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    }else if(computer===2){
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-monitor']=true;
      // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
      vis['dsi-monitor-base']=true;
    }
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return vis;
  }

  // Define la rutina `comparisonState`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function comparisonState(){
    // Declara `current` para conservar referencias o estado consumidos por las operaciones siguientes.
    var current=currentSetupVisible();
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(comparisonMode==='current') return {vis:current,opts:{standing:false}};
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return {
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      vis:Object.assign({},current,primOfficeState.vis),
      // Continúa la construcción o actualización del adaptador con la operación de esta línea.
      opts:Object.assign({},primOfficeState.opts)
    };
  }

  // Define la rutina `applyFallbackVisible`: recibe `vis`, `standing` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function applyFallbackVisible(vis,standing){
    // Declara `fallbackIds` para conservar referencias o estado consumidos por las operaciones siguientes.
    var fallbackIds=DSI.concat(['dsi-stand-leg','dsi-pens','dsi-standing-badge']);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    fallbackIds.forEach(function(id){
      // Declara `el` para conservar referencias o estado consumidos por las operaciones siguientes.
      var el=$(id); if(!el) return;
      // Declara `show` para conservar referencias o estado consumidos por las operaciones siguientes.
      var show=id==='dsi-standing-badge'?standing:!!vis[id];
      // Sincroniza una clase visual con el estado; las reglas de estilo consumen esta señal.
      el.classList.toggle('hidden-item',!show);
    });
  }

  // Define la rutina `renderComparison`: recibe `animated`, `frameRequest` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function renderComparison(animated,frameRequest){
    // Declara `state` para conservar referencias o estado consumidos por las operaciones siguientes.
    var state=comparisonState();
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(stageEl) stageEl.setAttribute('data-s3d-setup',comparisonMode);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    applyFallbackVisible(state.vis,!!state.opts.standing);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!ready) return;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    frameRequest=frameRequest||{};
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    applyVisible(state.vis,!!animated,frameRequest);
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    setDeskMode(!!state.opts.standing,!!animated);
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(frameRequest.force){ autoFrame(!!animated,frameRequest.reason||'content',activeView); }
    // Prueba una alternativa adicional porque la condición precedente no resolvió el caso.
    else if(comparisonMode==='primoffice'&&importantChangeOutsideFrame(frameRequest.changedIds)){ autoFrame(!!animated,'important-product',activeView); }
  }

  // Define la rutina `setDiagnosis`: recibe `diagnosis` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setDiagnosis(diagnosis){
    // Declara `source` para conservar referencias o estado consumidos por las operaciones siguientes.
    var source=diagnosis&&Array.isArray(diagnosis.answers)?diagnosis.answers:[];
    // Instancia el objeto requerido y conserva su referencia para operaciones posteriores.
    diagnosisAnswers=new Array(6).fill(null).map(function(_,i){
      // Declara `answer` para conservar referencias o estado consumidos por las operaciones siguientes.
      var answer=source[i];
      // Devuelve este resultado al llamador y finaliza aquí la rutina.
      return Number.isInteger(answer)&&answer>=0&&answer<=2?answer:null;
    });
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    pending=!ready;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    renderComparison(false,{force:true,reason:'diagnosis',bulk:true});
  }

  // Define la rutina `setMode`: recibe `mode` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setMode(mode){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(mode!=='current'&&mode!=='primoffice') return false;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(mode===comparisonMode){ renderComparison(false); return true; }
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    comparisonMode=mode;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    pending=!ready;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!ready||reduce||!stageEl){ renderComparison(false,{force:true,reason:'mode',bulk:true}); return true; }
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(modeSwapTimer) window.clearTimeout(modeSwapTimer);
    // Sincroniza una clase visual con el estado; las reglas de estilo consumen esta señal.
    stageEl.classList.add('is-switching');
    // Programa la continuación diferida para coordinar la transición sin bloquear el hilo.
    modeSwapTimer=window.setTimeout(function(){
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      renderComparison(true,{force:true,reason:'mode',bulk:true});
      // Sincroniza una clase visual con el estado; las reglas de estilo consumen esta señal.
      window.requestAnimationFrame(function(){ stageEl.classList.remove('is-switching'); });
      // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
      modeSwapTimer=0;
    // Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
    },90);
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return true;
  }

  /* ---- API publica ---- */
  // Define la rutina `refreshFromDOM`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function refreshFromDOM(){
    // Declara `vis` para conservar referencias o estado consumidos por las operaciones siguientes.
    var vis={}, standing=false;
    // Sincroniza una clase visual con el estado; las reglas de estilo consumen esta señal.
    DSI.forEach(function(id){ var el=$(id); vis[id]=!!(el && !el.classList.contains('hidden-item')); });
    // Declara `sb` para conservar referencias o estado consumidos por las operaciones siguientes.
    var sb=$('dsi-standing-badge'); standing=!!(sb && !sb.classList.contains('hidden-item'));
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    primOfficeState={vis:vis,opts:{standing:standing}};
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    hasPrimOfficeState=true;
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    renderComparison(false,{force:true,reason:'refresh',bulk:true});
  }
  // Define la rutina `setVisible`: recibe `vis`, `opts` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function setVisible(vis,opts){
    // Declara `nextVis` para conservar referencias o estado consumidos por las operaciones siguientes.
    var nextVis=Object.assign({},vis||{}), nextOpts=Object.assign({},opts||{}), previous=primOfficeState;
    // Declara `changedIds` para conservar referencias o estado consumidos por las operaciones siguientes.
    var changedIds=DSI.filter(function(id){ return !!previous.vis[id]!==!!nextVis[id]; });
    // Declara `standingChanged` para conservar referencias o estado consumidos por las operaciones siguientes.
    var standingChanged=!!previous.opts.standing!==!!nextOpts.standing;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    primOfficeState={vis:nextVis,opts:nextOpts};
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    hasPrimOfficeState=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    pending=!ready;
    // Declara `bulkChange` para conservar referencias o estado consumidos por las operaciones siguientes.
    var bulkChange=!!nextOpts.bulk||changedIds.length>=3;
    // Declara `request` para conservar referencias o estado consumidos por las operaciones siguientes.
    var request={force:comparisonMode==='primoffice'&&(standingChanged||bulkChange),reason:standingChanged?'standing':(nextOpts.preset?'preset':(bulkChange?'preset':'cart')),changedIds:changedIds,bulk:bulkChange,productIds:nextOpts.changedProductIds||[],changeType:nextOpts.changeType||''};
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(bulkChange&&comparisonMode==='primoffice'&&ready&&!reduce&&stageEl){
      // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
      if(bulkSwapTimer)window.clearTimeout(bulkSwapTimer);
      // Sincroniza una clase visual con el estado; las reglas de estilo consumen esta señal.
      stageEl.classList.add('is-switching');
      // Sincroniza una clase visual con el estado; las reglas de estilo consumen esta señal.
      bulkSwapTimer=window.setTimeout(function(){renderComparison(true,request);window.requestAnimationFrame(function(){stageEl.classList.remove('is-switching');});bulkSwapTimer=0;},90);
    // Ejecuta la alternativa cuando la condición anterior no se cumple.
    }else renderComparison(true,request);
  }
  // Declara `pending` para conservar referencias o estado consumidos por las operaciones siguientes.
  var pending=false;

  /* ---- arranque diferido ---- */
  // Define la rutina `reveal`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function reveal(){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(deskScene2D) deskScene2D.style.display='none';
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(stageEl) stageEl.removeAttribute('hidden');
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(loaderEl) loaderEl.style.display='none';
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(toolbar) toolbar.style.display='';
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(pending){ renderComparison(false,{force:true,reason:'reveal',bulk:true}); pending=false; }
  }
  // Define la rutina `fallback`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function fallback(){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(stageEl) stageEl.setAttribute('hidden','');
  }

  // Define la rutina `ensureToolbarAction`: recibe `action`, `label`, `title` como entrada; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function ensureToolbarAction(action,label,title){
    // Declara `btn` para conservar referencias o estado consumidos por las operaciones siguientes.
    var btn=toolbar.querySelector('[data-action="'+action+'"]');
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(btn) return btn;

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    btn=document.createElement('button');
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    btn.type='button';
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    btn.className='s3d-cam s3d-action';
    // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
    btn.setAttribute('data-action',action);
    // Publica este estado como atributo para que estilos, accesibilidad o diagnósticos lo consuman.
    btn.setAttribute('aria-pressed','false');
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    btn.title=title;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    btn.innerHTML='<span>'+label+'</span>';
    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    toolbar.appendChild(btn);
    // Devuelve este resultado al llamador y finaliza aquí la rutina.
    return btn;
  }

  // Define la rutina `wireToolbar`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function wireToolbar(){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!toolbar) return;

    /* Compatibilidad con HTML viejo:
       si todavía existe Reset, se elimina para dejar un solo botón Reiniciar. */
    // Declara `legacyReset` para conservar referencias o estado consumidos por las operaciones siguientes.
    var legacyReset=toolbar.querySelector('[data-view="reset"]');
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(legacyReset) legacyReset.remove();

    // Localiza los nodos del DOM; el resto del componente depende de estas referencias.
    toolbar.querySelectorAll('[data-view]').forEach(function(b){
      // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
      b.addEventListener('click',function(){
        // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
        setView(b.getAttribute('data-view'),true);
      });
    });

    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    freeBtn=ensureToolbarAction('libre','Libre','Mover objetos libremente');
    // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
    freeBtn.addEventListener('click',toggleFree);

    // Declara `rb` para conservar referencias o estado consumidos por las operaciones siguientes.
    var rb=ensureToolbarAction('reiniciar','Reiniciar','Reiniciar cámara y objetos');
    // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
    rb.addEventListener('click',resetPositions);

    // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
    updateFreeUI();
  }

  // Define la rutina `init`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  async function init(){
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(initStarted)return; initStarted=true;
    // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
    host=$('s3dHost'); stageEl=$('s3dStage'); toolbar=$('s3dToolbar'); loaderEl=$('s3dLoader'); deskScene2D=$('desk-scene');
    // Localiza los nodos del DOM; el resto del componente depende de estas referencias.
    hintEl=stageEl?stageEl.querySelector('.s3d-hint'):null;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!host||!stageEl){ return; }
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!webglOk()){ fallback(); return; }
    // Inicia una operación que puede fallar por disponibilidad del navegador y habilita un reemplazo seguro.
    try{
      // Solicita de forma diferida la dependencia gráfica; la inicialización consume los módulos resueltos.
      THREE=await import('three');
      // Solicita de forma diferida la dependencia gráfica; la inicialización consume los módulos resueltos.
      OrbitControls=(await import('three/addons/controls/OrbitControls.js')).OrbitControls;
      // Solicita de forma diferida la dependencia gráfica; la inicialización consume los módulos resueltos.
      RoundedBox=(await import('three/addons/geometries/RoundedBoxGeometry.js')).RoundedBoxGeometry;
    // Captura el fallo anterior y devuelve el control al modo de respaldo.
    }catch(err){ console.warn('[setup-3d] No se pudo cargar Three.js; se usa el preview 2D.',err); fallback(); return; }
    // Inicia una operación que puede fallar por disponibilidad del navegador y habilita un reemplazo seguro.
    try{ RoomEnv=(await import('three/addons/environments/RoomEnvironment.js')).RoomEnvironment; }catch(e){ RoomEnv=null; }
    // Inicia una operación que puede fallar por disponibilidad del navegador y habilita un reemplazo seguro.
    try{ buildScene(); reveal(); wireToolbar();
    // Captura el fallo anterior y devuelve el control al modo de respaldo.
    }catch(err){ console.error('[setup-3d] Error al construir la escena 3D.',err); fallback(); }
  }

  // Define la rutina `start`: no recibe argumentos directos; sus consumidores usan su retorno cuando existe y, en otro caso, sus efectos sobre escena o interfaz.
  function start(){
    // Declara `section` para conservar referencias o estado consumidos por las operaciones siguientes.
    var section=$('test')||$('s3dStage');
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if(!$('s3dStage')) return;
    // Evalúa esta condición antes de continuar y protege el flujo frente a estados o capacidades no disponibles.
    if('IntersectionObserver' in window && section){
      // Declara `io` para conservar referencias o estado consumidos por las operaciones siguientes.
      var io=new IntersectionObserver(function(en,o){ if(en.some(function(e){return e.isIntersecting;})){ o.disconnect(); init(); } },{rootMargin:'400px 0px'});
      // Ejecuta la operación con los valores preparados y entrega su efecto al paso siguiente.
      io.observe(section);
    // Ejecuta la alternativa cuando la condición anterior no se cumple.
    } else { init(); }
  }

  // Actualiza esta referencia o estado; las ramas y renderizados posteriores leen el valor.
  window.Setup3D={ setVisible:setVisible, setDiagnosis:setDiagnosis, setMode:setMode, setView:setView, refreshFromDOM:refreshFromDOM, isReady:function(){return ready;}, reset:resetPositions, setFree:setFree };

  // Suscribe el manejador al evento indicado; la interacción depende de conservar esta vinculación.
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
// Ejecuta esta declaración u operación y deja su resultado disponible para las instrucciones siguientes.
})(); /* setup-3d ready */
