# Importación de capas

Colocá en esta carpeta las 14 exportaciones PNG indicadas en
[`docs/setup-assets.md`](../../../docs/setup-assets.md) y ejecutá:

```bash
python tools/import_setup_assets.py
```

Los PNG de esta carpeta son archivos de entrada temporales. El importador valida
las dimensiones y la transparencia antes de actualizar `source`, `runtime`,
`references` y `manifest.json`.
