# Fotos reales de setups (`assets/images/setups/`)

Esta carpeta está **preparada** para incorporar fotografías reales de setups de
PrimOffice. Hoy la landing **no** usa fotos de setups: usa una ilustración
abstracta en el hero (CSS) y el configurador 3D. **No se inventan imágenes ni se
usan fotos genéricas de baja calidad.**

> **Estado actual:** PrimOffice todavía **no** entregó fotos reales.
> **TODO: validar con PrimOffice** y solicitar el material descrito abajo.

---

## Qué fotos solicitar

| Uso | Descripción | Proporción sugerida | Resolución mínima |
|-----|-------------|---------------------|-------------------|
| `hero` horizontal | Setup completo, prolijo, buena luz. Reemplaza/acompaña la ilustración del hero. | 16:9 (o 3:2) | 2400 × 1350 px |
| `home-office` | Puesto en casa (ambiente hogareño, cálido). | 4:3 | 1600 × 1200 px |
| `oficina` | Puesto en oficina/empresa (varios puestos o uno corporativo). | 4:3 | 1600 × 1200 px |
| `setup-premium` | Setup nivel Premium (standing desk, doble monitor, orden total). | 3:2 | 2000 × 1333 px |
| `transicion` (inmersiva) | Foto amplia para banda full-width entre secciones. | 21:9 | 2800 × 1200 px |
| Detalles | Silla, brazo de monitor, hub, organización de cables (close-ups). | 1:1 | 1200 × 1200 px |

### Versiones mobile

Para `hero` y `transicion`, pedir además un **recorte vertical/cuadrado**
(por ejemplo 4:5 o 1:1) para que no se vean “estiradas” en celulares.

---

## Requisitos técnicos

- **Formato:** preferentemente `.webp` (mejor peso) con respaldo `.jpg`.
  Evitar PNG para fotos (pesan de más).
- **Peso objetivo:** hero ≤ 300 KB; resto ≤ 200 KB (optimizadas).
- **Responsive:** entregar 2–3 tamaños por imagen (p. ej. `-480`, `-960`, `-1600`)
  para usar `srcset`.
- **Color/estilo:** luz natural, encuadre prolijo, coherente con la identidad
  (azul `#17aee6` / navy `#07111f`). Sin marcas de agua.
- **Permisos de uso:** confirmar que PrimOffice tiene **derechos** sobre cada foto
  (propias o con licencia) y autorización de personas si aparecen. Documentar la
  fuente.

---

## Convención de nombres sugerida

```
assets/images/setups/
  hero-setup-1600.webp        hero-setup-960.webp        hero-setup-480.webp
  home-office-1600.webp       home-office-960.webp
  oficina-1600.webp           oficina-960.webp
  setup-premium-2000.webp     setup-premium-1000.webp
  transicion-2800.webp        transicion-1400.webp       transicion-mobile-1000.webp
```

---

## Cómo se integran después (sin rehacer la landing)

La estructura ya está pensada para sumar las fotos con cambios mínimos:

1. **Hero:** dentro de `.hero-visual` (en `index.html`) se puede reemplazar la
   ilustración CSS por una `<img>` real con `srcset`/`sizes`, declarando
   `width`/`height` o `aspect-ratio` para evitar saltos de layout (CLS):

   ```html
   <img
     class="hero-photo"
     src="./assets/images/setups/hero-setup-960.webp"
     srcset="./assets/images/setups/hero-setup-480.webp 480w,
             ./assets/images/setups/hero-setup-960.webp 960w,
             ./assets/images/setups/hero-setup-1600.webp 1600w"
     sizes="(max-width: 1024px) 100vw, 50vw"
     width="1600" height="900"
     alt="Setup de oficina PrimOffice: silla ergonómica, monitor y escritorio ordenado"
     loading="eager" decoding="async">
   ```

2. **Banda inmersiva (`transicion`):** agregar una sección full-width con la
   foto como fondo (`background-image`) o `<img>` con `loading="lazy"`.

3. **Detalles:** usar en `Beneficios`/`Setups` como apoyo visual, siempre con
   `alt` descriptivo y `loading="lazy"`.

> Pautas: imágenes con `width`/`height` o `aspect-ratio` (evitar CLS),
> `loading="lazy"` salvo el hero, `alt` significativo (accesibilidad/SEO) y
> formatos modernos (`webp`/`avif`).
