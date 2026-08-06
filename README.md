# Landing PrimOffice

Landing comercial estática con test ergonómico, recomendación personalizada,
configurador fotográfico 2D por capas, carrito dinámico, WhatsApp e integración
de leads.

## Arquitectura activa

- `index.html`: catálogo, presets, estado comercial, carrito y flujo del test.
- `js/setup-visual-config.js`: manifiesto de capas y posiciones finales por tipo de escritorio.
- `js/setup-visual-hybrid.js`: compositor fotográfico 2D.
- `js/setup-visual-calibration.js`: modo temporal de calibración.
- `css/setup-visual-hybrid.css`: layout, interacción y responsive.
- `functions/api/leads.js`: endpoint de leads y sincronización CRM.
- `assets/setup-layers/runtime/`: PNG que utiliza el navegador.

`js/setup-3d.js` se conserva como archivo legacy, pero no se carga en el runtime
actual.

## Ejecutar localmente

```bash
python -m http.server 8000
```

Abrir `http://localhost:8000/`.

Para habilitar el modo de calibración temporal:

```text
http://localhost:8000/?calibrate=1
```

## Pruebas

```bash
node --test tests/*.test.mjs
```

La base del puente al carrito nativo de Tiendanube y sus pasos operativos estan
documentados en [`docs/tiendanube-cart-bridge.md`](docs/tiendanube-cart-bridge.md).
El mismo documento describe el alta OAuth Authorization Code, el cifrado del
token en D1, los callbacks de produccion y Preview y el endpoint de estado
sanitizado.

Las posiciones no dependen del preset. Toda selección con escritorio estándar usa
el mismo layout; toda selección con standing desk usa el layout alto calibrado.
