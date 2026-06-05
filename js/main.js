const hamburger=document.getElementById('hamburger'),mobileNav=document.getElementById('mobileNav'),mobileClose=document.getElementById('mobileClose');
hamburger?.addEventListener('click',()=>mobileNav.classList.add('open'));
mobileClose?.addEventListener('click',()=>mobileNav.classList.remove('open'));
mobileNav?.addEventListener('click',e=>{if(e.target===mobileNav)mobileNav.classList.remove('open')});
document.querySelectorAll('.ml').forEach(l=>l.addEventListener('click',()=>mobileNav.classList.remove('open')));
const header=document.getElementById('header');
window.addEventListener('scroll',()=>{header.style.boxShadow=window.scrollY>20?'0 8px 32px rgba(7,17,31,.10)':'none'},{passive:true});

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
