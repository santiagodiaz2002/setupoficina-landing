# `config/tiendanube-catalog.json`

## Responsabilidad y límites

**HECHO VERIFICADO:** define 11 correspondencias comerciales mínimas que la herramienta `tools/tiendanube-sync-catalog.mjs` resuelve contra productos reales por SKU. No contiene `product_id`, `variant_id`, precio, stock ni token.

Cada objeto tiene exactamente:

| Propiedad | Función |
|---|---|
| `internal_id` | ID estable que usa la landing y los payloads del puente |
| `sku` | SKU exacto esperado al consultar la API de Tiendanube |
| `name` | etiqueta legible que se persiste como `display_name` durante la sincronización |

## Entradas versionadas

| `internal_id` | `sku` | Producto nombrado |
|---|---|---|
| `soporte_notebook` | `PNOTEBOOKGE` | pNotebook |
| `mouse_vertical` | `PMOUSEPROV` | pMouseProV |
| `mousepad_xxl` | `PMATN` | pMat |
| `soporte_monitor` | `PARM` | pArm |
| `teclado_mec` | `PMECHANIC` | pMechanic |
| `hub_usb` | `PHUB-7-1` | pHub |
| `organizador_prem` | `PBOX` | pBox |
| `luz_led` | `PGLOW` | pGlow |
| `reposamuñecas` | `PEASEB` | pEase |
| `almohadilla` | `PLUMBAR` | pLumbar |
| `standing_desk` | `PSTANDINGN-TIENDA` | pStanding |

Recorrido local comprobado:

1. la herramienta lee y valida este array;
2. consulta productos por SKU mediante `TiendanubeClient`;
3. exige una única variante coincidente;
4. produce SQL de UPSERT para `tiendanube_catalog` con IDs resueltos;
5. los handlers de transferencia consultan esa tabla por `internal_id`.

**INFORMACIÓN NO IDENTIFICADA:** el JSON no demuestra los IDs vigentes, precios, stock ni disponibilidad de una tienda real. La auditoría no llamó a la API externa.
