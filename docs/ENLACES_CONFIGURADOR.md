# Enlaces directos al configurador 3D

Mejora **opcional y acotada**: permite abrir la landing con el configurador 3D
ya preconfigurado mediante parámetros de URL, **sin alterar el flujo principal**.

> El comportamiento predeterminado sigue siendo:
> **test diagnóstico → teaser → captura del lead → resultado completo →
> configurador 3D precargado.**
> Si la URL no trae parámetros válidos, no cambia absolutamente nada.

La lógica vive en `js/configurador-3d.js` (función `applyDirectLink()`), que se
ejecuta al cargar y aplica los valores **sólo** si pertenecen a la lista
permitida. Los valores inválidos se ignoran en silencio.

---

## Parámetros aceptados (todos opcionales)

| Parámetro | Valores permitidos | Efecto |
|-----------|--------------------|--------|
| `preset`  | `basica`, `pro`, `premium`, `personalizada` | Configuración base del configurador |
| `tamano`  | `compacto`, `estandar`, `amplio` | Tamaño del escritorio |
| `modo`    | `sentado`, `standing` | Modo de uso del escritorio |

Reglas:

- Se aplican **sólo** los valores de la lista (no distingue mayúsculas; se
  normalizan a minúsculas).
- Cualquier valor fuera de la lista se **ignora en silencio** y se usa el valor
  predeterminado de ese campo.
- Si **ningún** parámetro es válido, el configurador queda con su configuración
  por defecto y el flujo del test no se ve afectado.
- `preset=personalizada` mantiene los productos actuales y sólo marca el preset
  como "Personalizada" (útil combinado con `tamano`/`modo`).
- Combinables entre sí y con el ancla `#configurador` para que el navegador
  además desplace la vista hasta esa sección.

---

## Parámetros UTM (analítica + lead)

Se conservan los UTM estándar presentes en la URL:

`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`

- Quedan en la URL, por lo que el **payload del lead** ya los captura cuando el
  usuario completa el test (`utm` dentro del payload).
- Además se incluyen en el evento analítico de entrada directa (ver abajo).

---

## Evento analítico

Cuando se aplica al menos un parámetro válido, se emite:

```
configurador_precargado_directo
```

con datos: `{ fuente: 'url', preset, tamano, modo, utm, ...configuración }`.

Se entrega por `window.trackEvent` → `window.dataLayer` y
`CustomEvent('primoffice:track')` (igual que el resto de los eventos).

---

## Ejemplos

### Local (Live Server, puerto 5500 por defecto)

```
http://127.0.0.1:5500/index.html?preset=pro#configurador
http://127.0.0.1:5500/index.html?preset=premium&tamano=amplio&modo=standing#configurador
http://127.0.0.1:5500/index.html?tamano=compacto&modo=sentado#configurador
http://127.0.0.1:5500/index.html?preset=basica&utm_source=instagram&utm_medium=social&utm_campaign=setup-oficina#configurador
```

> Si tu Live Server sirve desde la raíz del repo, la ruta puede ser
> `http://127.0.0.1:5500/setupoficina-landing/index.html?preset=pro#configurador`.

### GitHub Pages

Reemplazá `<usuario>` por el usuario u organización donde se publica el repo
`setupoficina-landing`:

```
https://<usuario>.github.io/setupoficina-landing/?preset=pro#configurador
https://<usuario>.github.io/setupoficina-landing/?preset=premium&tamano=amplio&modo=standing#configurador
https://<usuario>.github.io/setupoficina-landing/?preset=personalizada&tamano=estandar#configurador
https://<usuario>.github.io/setupoficina-landing/?preset=basica&utm_source=newsletter&utm_medium=email&utm_campaign=lanzamiento#configurador
```

### Ejemplos de valores inválidos (se ignoran)

```
?preset=gamer            → ignorado (preset no permitido) → queda el default
?tamano=enorme           → ignorado → tamaño default
?modo=acostado&preset=pro → modo ignorado; se aplica sólo preset=pro
```

---

## Notas

- Esta entrada directa **no** abre ni salta el test: es un atajo paralelo para
  campañas o enlaces compartidos.
- Si el usuario llega por un enlace directo y además completa el test, la
  recomendación del test **sobrescribe** la configuración del enlace (se aplica
  después, al ver el resultado).
- El ancla `#configurador` usa el desplazamiento nativo del navegador; no se
  agregó scroll por JavaScript para no interferir con el flujo principal.
