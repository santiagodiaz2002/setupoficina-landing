# Integración de leads — documento movido

La integración de leads ahora apunta a **Odoo CRM**. El contrato completo
(arquitectura segura, esquema del payload `v1`, mapeo a `crm.lead`,
duplicados, validaciones y privacidad) vive en:

➡️ **[`INTEGRACION_ODOO_CRM.md`](./INTEGRACION_ODOO_CRM.md)**

Resumen rápido:

- La landing nunca habla con Odoo directamente. Llama a `submitLead(payload)`
  (`js/services/leads-service.js`), que hace `POST` a un **backend propio**;
  ese backend —del lado servidor, con credenciales propias— crea el lead en Odoo.
- Mientras `DEMO_MODE: true` (estado actual), el lead se guarda en
  `localStorage` y la integración real queda pendiente. **TODO: validar con PrimOffice.**
