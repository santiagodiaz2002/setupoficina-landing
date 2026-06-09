/* =====================================================================
   PrimOffice · Precios de referencia del catálogo (estático)
   ---------------------------------------------------------------------
   Punto ÚNICO para los precios usados por el carrito del configurador 3D.

   ┌──────────────────────────────────────────────────────────────────┐
   │  IMPORTANTE · PRECIOS DE REFERENCIA / PENDIENTES DE CONFIRMAR     │
   │  La landing entregada NO contenía precios. Estos valores son      │
   │  PLACEHOLDERS editables para que el carrito y el “total estimado”  │
   │  funcionen de punta a punta. NO son cifras confirmadas por         │
   │  PrimOffice. Reemplazá estos números por el catálogo real y poné   │
   │  PRECIOS_CONFIRMADOS:true para quitar el aviso de “referencia”.    │
   │  TODO: validar precios con PrimOffice.                             │
   └──────────────────────────────────────────────────────────────────┘

   Las claves de PRECIOS coinciden con los `id` de PRODUCTOS en
   js/configurador-3d.js. Si un id no tiene precio, el carrito lo trata
   como $0 (no rompe el total).
   ===================================================================== */

export const CATALOGO = {
  /* Bandera de honestidad: mientras sea false, la UI rotula los importes
     como “estimado / precios de referencia” y el WhatsApp aclara “a
     confirmar”. Poner en true SOLO cuando los precios estén confirmados. */
  PRECIOS_CONFIRMADOS: false,

  MONEDA: 'ARS',
  LOCALE: 'es-AR',

  /* Precio unitario de referencia por producto del configurador (ARS).
     Editar con los precios reales del catálogo. */
  PRECIOS: {
    silla: 320000,
    monitor: 260000,
    soporte: 28000,
    brazo: 75000,
    luz: 42000,
    notebook: 0,      // equipo propio del usuario: no suma al total
    teclado: 85000,
    mouse: 38000,
    hub: 55000,
    celular: 18000,
    cables: 22000,
    pad: 26000
  },

  /* Extras opcionales (no forman parte de los presets base; se agregan
     desde el carrito). Coinciden con categorías reales del catálogo. */
  EXTRAS: [
    { id: 'cargador', nombre: 'Cargador GaN multipuerto', precio: 45000, descripcion: 'Carga varios equipos desde un solo enchufe.' },
    { id: 'standingDesk', nombre: 'Standing desk eléctrico', precio: 380000, descripcion: 'Escritorio regulable para alternar sentado / de pie.' },
    { id: 'anillo', nombre: 'Anillo de luz para videollamadas', precio: 35000, descripcion: 'Mejor imagen en reuniones por video.' }
  ]
};

/* Devuelve el precio de referencia de un producto (0 si no está definido). */
export function precioDe(id) {
  return (CATALOGO.PRECIOS && typeof CATALOGO.PRECIOS[id] === 'number') ? CATALOGO.PRECIOS[id] : 0;
}

/* Devuelve un extra por id (o null). */
export function extraDe(id) {
  return CATALOGO.EXTRAS.find((e) => e.id === id) || null;
}

/* Formatea un importe en pesos argentinos (es-AR), sin decimales.
   Usa figuras tabulares en la UI vía CSS (font-variant-numeric). */
export function formatARS(n) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat(CATALOGO.LOCALE || 'es-AR', {
      style: 'currency', currency: CATALOGO.MONEDA || 'ARS', maximumFractionDigits: 0
    }).format(v);
  } catch (e) {
    return '$' + v.toLocaleString('es-AR');
  }
}

/* Publica en window para depuración / consumidores no-módulo. */
if (typeof window !== 'undefined') {
  window.PrimOfficeCatalogo = { CATALOGO, precioDe, extraDe, formatARS };
}

export default CATALOGO;
