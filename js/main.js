const hamburger=document.getElementById('hamburger'),mobileNav=document.getElementById('mobileNav'),mobileClose=document.getElementById('mobileClose');
hamburger?.addEventListener('click',()=>mobileNav.classList.add('open'));
mobileClose?.addEventListener('click',()=>mobileNav.classList.remove('open'));
mobileNav?.addEventListener('click',e=>{if(e.target===mobileNav)mobileNav.classList.remove('open')});
document.querySelectorAll('.ml').forEach(l=>l.addEventListener('click',()=>mobileNav.classList.remove('open')));
const header=document.getElementById('header');
window.addEventListener('scroll',()=>{header.style.boxShadow=window.scrollY>20?'0 8px 32px rgba(7,17,31,.10)':'none'},{passive:true});

// CONFIGURADOR
const items=document.querySelectorAll('.config-item');
const tagsEl=document.getElementById('configTags');
const selected=new Set(['g-chair']);

function refreshSvg(){
  document.querySelectorAll('[id^="g-"]').forEach(g=>{
    g.style.opacity=selected.has(g.id)?'1':'0';
  });
  // Chair level extras
  const ci=document.querySelector('[data-target="g-chair"]');
  const lvl=ci&&ci.classList.contains('active')?(ci.dataset.level||'basic'):'none';
  const showExtra=lvl==='pro'||lvl==='exec';
  ['ch-head','ch-al','ch-ar'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.style.opacity=showExtra?'1':'0';
  });
  // Tags
  const labels=[...items].filter(i=>i.classList.contains('active')).map(i=>i.dataset.label);
  tagsEl.innerHTML=labels.length===0
    ?'<span style="color:rgba(255,255,255,.4);font-size:13px;font-style:italic">Ningun producto seleccionado aun</span>'
    :labels.map(l=>`<span class="config-tag">${l}</span>`).join('');
}

items.forEach(item=>{
  item.addEventListener('click',()=>{
    const target=item.dataset.target;
    const excludes=item.dataset.excludes;
    const isActive=item.classList.toggle('active');
    const cb=item.querySelector('.config-checkbox');
    if(isActive){
      cb.innerHTML='&#10003;';
      selected.add(target);
      if(excludes){
        document.querySelectorAll('[data-target="'+excludes+'"]').forEach(ex=>{
          ex.classList.remove('active');
          ex.querySelector('.config-checkbox').innerHTML='';
          selected.delete(excludes);
        });
      }
    }else{
      cb.innerHTML='';
      selected.delete(target);
    }
    refreshSvg();
  });
});
refreshSvg();

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
