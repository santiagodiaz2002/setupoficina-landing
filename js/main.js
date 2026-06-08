const hamburger=document.getElementById('hamburger'),mobileNav=document.getElementById('mobileNav'),mobileClose=document.getElementById('mobileClose');

function openMobileNav(){
  if(!mobileNav)return;
  mobileNav.classList.add('open');
  hamburger&&hamburger.setAttribute('aria-expanded','true');
  mobileClose&&mobileClose.focus();
}
function closeMobileNav(){
  if(!mobileNav)return;
  mobileNav.classList.remove('open');
  hamburger&&hamburger.setAttribute('aria-expanded','false');
}
hamburger&&hamburger.addEventListener('click',openMobileNav);
mobileClose&&mobileClose.addEventListener('click',()=>{closeMobileNav();hamburger&&hamburger.focus();});
mobileNav&&mobileNav.addEventListener('click',e=>{if(e.target===mobileNav)closeMobileNav();});
document.querySelectorAll('.ml').forEach(l=>l.addEventListener('click',closeMobileNav));
// Cerrar el menu movil con la tecla Escape (accesibilidad teclado)
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&mobileNav&&mobileNav.classList.contains('open')){closeMobileNav();hamburger&&hamburger.focus();}
});

// Sombra del header al hacer scroll: alterna una clase con requestAnimationFrame
// (evita escribir estilos inline en cada evento y reduce el trabajo en el hilo principal).
const header=document.getElementById('header');
if(header){
  let ticking=false;
  const onScroll=()=>{
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(()=>{header.classList.toggle('scrolled',window.scrollY>20);ticking=false;});
  };
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();
}

// CONFIGURADOR
// La logica del configurador se movio a js/configurador-3d.js (visualizador 3D con Three.js).
// Este archivo conserva solo la navegacion y el envio del formulario de contacto.

function handleLead(event){
  event.preventDefault();
  const data=new FormData(event.target);
  const nombre=data.get('nombre')||'';
  const contacto=data.get('contacto')||'';
  const setup=data.get('setup')||'';
  const comentario=data.get('comentario')||'';
  const lines=['Hola PrimOffice, quiero asesoramiento para armar mi setup.','',`Nombre: ${nombre}`,`Contacto: ${contacto}`,`Interes: ${setup}`,comentario?`Comentario: ${comentario}`:''].filter(Boolean);
  window.open(`https://wa.me/5491139149688?text=${encodeURIComponent(lines.join('\n'))}`,'_blank');
}
