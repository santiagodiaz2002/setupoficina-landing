# Integración de leads con Odoo CRM

Este documento define el **contrato** entre la landing (sitio estático) y el
sistema que PrimOffice usará para **almacenar los leads** del test ergonómico
en **Odoo CRM**.

La landing ya está preparada con una **capa desacoplada**:

- `js/config/app-config.js` → parámetros configurables (modo demo, endpoint, origen, timeout, flags de integración, WhatsApp).
- `js/services/leads-service.js` → único punto que envía el lead: `submitLead(payload)`.
- `js/test-diagnostico.js` → arma el `payload` (esquema de la sección 4) y llama a `submitLead`.

> **Estado actual:** `DEMO_MODE: true`. No hay endpoint, credenciales ni
> instancia de Odoo confirmados. El servicio guarda en `localStorage` y deja la
> integración real **pendiente**. **TODO: validar con PrimOffice.**

---

## 0. Regla de oro de seguridad

**Nunca** se conecta Odoo directamente desde el JavaScript público de la landing.
Cualquier valor que llegue al navegador (URL, API key, usuario, contraseña, base
de datos) es **visible para cualquiera**. Por eso la arquitectura es:

```
Landing (browser)  ──POST JSON──►  Backend propio de PrimOffice  ──►  Odoo CRM
  submitLead()                     (valida, autentica, mapea)         (XML-RPC / JSON-RPC
  sin credenciales                 con credenciales del servidor        / módulo /api)
```

El backend propio (una Function/serverless, un endpoint en el sitio de
PrimOffice, o un microservicio) es el único que conoce las credenciales de Odoo.

---

## 1. Resumen del contrato (landing → backend propio)

| Aspecto | Valor |
|--------|-------|
| Método | `POST` |
| URL | `APP_CONFIG.LEADS_API_URL` (vacío = modo demo) |
| Formato | `application/json` (UTF-8) |
| Autenticación | Opcional, `Authorization: Bearer <token>` (no hardcodear el token) |
| Timeout | `APP_CONFIG.LEADS_TIMEOUT_MS` (10 s por defecto) |
| Respuesta esperada | `2xx` con JSON `{ "ok": true, "id": "<odoo_lead_id>" }` |

---

## 2. Cómo activar el envío real (pasos exactos)

1. Levantar el **backend propio** que reciba el `POST` de la sección 4 y cree el
   lead en Odoo (sección 5).
2. Habilitar **CORS** para el origen del sitio
   (`https://setupoficina.com.ar` y, en desarrollo, `http://127.0.0.1:5500` /
   `http://localhost:5500` de Live Server).
3. En `js/config/app-config.js`:

   ```js
   DEMO_MODE: false,
   LEADS_API_URL: 'https://api.primoffice.com.ar/leads', // ← endpoint propio
   INTEGRATION: { crm: 'odoo', odooEnabled: true, payloadSchema: 'v1' }
   ```

   > Alternativa sin tocar el archivo: definir
   > `window.PrimOfficeConfig = { DEMO_MODE:false, LEADS_API_URL:'...' }`
   > **antes** de cargar los scripts (inyectado por el hosting).

4. Si el endpoint propio requiere token, **no** lo escribas en el repositorio.
   Inyectalo en runtime desde un entorno seguro.
5. Probar el flujo completo (sección 8).

Cuando `DEMO_MODE` es `false` y `LEADS_API_URL` tiene valor, el modo demo se
desactiva automáticamente.

---

## 3. Datos que PrimOffice debe entregar para cerrar la integración

- [ ] **URL** del endpoint propio (no la de Odoo).
- [ ] **Autenticación** del endpoint propio (token / firma / IP allowlist).
- [ ] **Instancia de Odoo**: URL, base de datos, usuario de API, API key (sólo en el servidor).
- [ ] **Mapeo de campos** definitivo (sección 5) y campos personalizados (`x_*`) si los hubiera.
- [ ] **Reglas de validación** (sección 6).
- [ ] **Tratamiento de duplicados** (sección 7).
- [ ] **Política de privacidad / retención** y texto legal del consentimiento.

---

## 4. Esquema del payload (request body landing → backend)

Esquema `v1` (ver `INTEGRATION.payloadSchema`). Estructura anidada:

```jsonc
{
  "leadId": "lead_1718900712000_a1b2c3",   // id local (idempotencia / trazabilidad)
  "createdAt": "2026-06-08T13:45:12.000Z",  // ISO 8601 (UTC)
  "source": "landing-primoffice",            // APP_CONFIG.LEAD_ORIGIN
  "utm": {                                    // sólo las claves presentes en la URL
    "utm_source": "instagram",
    "utm_medium": "social",
    "utm_campaign": "test-ergonomico"
  },

  "contact": {
    "name": "Ana Pérez",
    "preferredChannel": "whatsapp",          // "email" | "whatsapp"
    "email": "",                              // presente sólo si preferredChannel = "email"
    "whatsapp": "+54 9 11 5555 5555",         // presente sólo si preferredChannel = "whatsapp"
    "consent": true                           // checkbox obligatorio en el formulario
  },

  "diagnosis": {
    "rawAnswers": {                           // respuestas crudas (claves = id de pregunta)
      "horas": "6a8",
      "dolor": "frecuente",
      "modo": "notebook_monitor",
      "escritorio": "saturado",
      "silla": "comedor",
      "queja": "cuello_espalda"
    },
    "totalScore": 14,                         // puntaje total (entero)
    "scoresByCategory": {                     // desglose por categoría (informativo)
      "ergonomia": 8, "orden": 3, "conectividad": 1,
      "iluminacion": 0, "superficieTrabajo": 1, "mobiliario": 1, "usoCorporativo": 0
    },
    "recommendedTier": "Pro",                 // etiqueta legible
    "recommendedPreset": "pro"                // "basica" | "pro" | "premium"
  },

  "configuration": {
    "recommendedProducts": ["silla","brazo","luz","hub"],   // a sumar (excluye lo que ya tiene)
    "selectedProducts": ["silla","monitor","brazo","luz","teclado","mouse","hub","celular","pad","cables"],
    "selectedExtras": ["cargador"],
    "estimatedTotal": 941000,                 // total ESTIMADO de referencia (ver nota)
    "currency": "ARS",
    "pricesConfirmed": false                  // false = precios de referencia, no confirmados
  }
}
```

### Notas sobre los campos

- `email` y `whatsapp` son **mutuamente excluyentes** según `preferredChannel`. El
  campo no elegido viaja como cadena vacía.
- `recommendedProducts` = productos **a adquirir** (ya se descontó lo que el
  usuario declaró tener, si aplica).
- `selectedProducts` / `selectedExtras` = configuración del carrito 3D al momento
  del envío. El usuario puede seguir editándola luego (eso viaja por WhatsApp).
- `estimatedTotal` se calcula con **precios de referencia** de
  `js/config/catalogo-precios.js`. Mientras `pricesConfirmed` sea `false`, **no**
  debe tratarse como precio final. **TODO: cargar precios reales y poner
  `PRECIOS_CONFIRMADOS:true`.**

---

## 5. Mapeo a Odoo CRM (`crm.lead`)

Realizado por el **backend propio** (no por la landing). Sugerido:

| Campo del payload | Campo en Odoo `crm.lead` | Notas |
|---|---|---|
| `contact.name` | `contact_name` y `name` | `name` = título del lead, ej. `"Setup Pro — Ana Pérez"` |
| `contact.email` | `email_from` | sólo si `preferredChannel = email` |
| `contact.whatsapp` | `phone` / `mobile` | sólo si `preferredChannel = whatsapp` |
| `contact.preferredChannel` | `x_canal_preferido` (custom) o en `description` | |
| `contact.consent` | `x_consentimiento` (custom) + fecha | registrar consentimiento (GDPR/LOPD) |
| `diagnosis.recommendedTier` | `x_nivel_recomendado` (custom) o etiqueta | |
| `diagnosis.totalScore` | `x_score` (custom) | |
| `configuration.estimatedTotal` | `expected_revenue` | marcar como estimado mientras `pricesConfirmed=false` |
| `source` / `utm.*` | `source_id`, `medium_id`, `campaign_id` (modelo `utm.*`) | crear/mapear registros UTM |
| `diagnosis` + `configuration` (completo) | `description` | volcar un resumen legible para el vendedor |
| `leadId` | `x_external_id` (custom) | idempotencia / evitar duplicados |

**Crear el lead** (ejemplo conceptual XML-RPC; se ejecuta en el **servidor**):

```python
# PSEUDOCÓDIGO de servidor — NUNCA en el navegador
models.execute_kw(DB, uid, API_KEY,
  'crm.lead', 'create', [{
    'name': f"Setup {p['diagnosis']['recommendedTier']} — {p['contact']['name']}",
    'contact_name': p['contact']['name'],
    'email_from': p['contact'].get('email') or False,
    'phone': p['contact'].get('whatsapp') or False,
    'type': 'lead',
    'description': resumen_legible(p),
    'expected_revenue': p['configuration']['estimatedTotal'],
    # 'source_id'/'medium_id'/'campaign_id' → resolver de utm.*
    # campos x_* personalizados según configuración de PrimOffice
  }])
```

---

## 6. Validaciones recomendadas (lado backend)

- `contact.name`: requerido, 1–120 caracteres.
- `contact.preferredChannel`: requerido, `email` | `whatsapp`.
- `contact.email`: requerido si `preferredChannel = email`; formato válido.
- `contact.whatsapp`: requerido si `preferredChannel = whatsapp`; 8–15 dígitos (con `+` opcional).
- `contact.consent`: debe ser `true` (la landing lo exige; el backend lo **registra** con fecha/origen).
- Sanitizar todos los strings; rechazar payloads mayores a un tamaño razonable.

---

## 7. Tratamiento de duplicados

- Usar `leadId` (`x_external_id`) como clave de **idempotencia**: si llega dos
  veces, actualizar en lugar de crear.
- Alternativa: deduplicar por `email`/`whatsapp` + ventana temporal.
- Aprovechar la deduplicación nativa de Odoo (`crm.lead` → “Leads similares”).

---

## 8. Respuesta esperada y manejo de errores

### Éxito (`200`/`201`)

```json
{ "ok": true, "id": "<odoo_lead_id>" }
```

### Error

| HTTP | Significado | Acción de la landing |
|------|-------------|----------------------|
| `400` | Validación fallida | Loguea el detalle; el usuario igual ve su diagnóstico y sigue por WhatsApp |
| `401` / `403` | Auth inválida | Loguea error; revisar token/config |
| `429` | Rate limit | Loguea error; reintentar manualmente |
| `5xx` | Error del servidor | Loguea error; el usuario continúa por WhatsApp |
| timeout / red | Sin respuesta en `LEADS_TIMEOUT_MS` | Loguea `timeout`/`network`; el usuario continúa |

> **La landing nunca bloquea** al usuario por un fallo de persistencia: siempre
> puede ver su resultado y contactar por WhatsApp. En modo demo o ante error,
> **no** se muestra una confirmación de guardado real.

---

## 9. Privacidad

- Se recopilan **datos personales** (nombre + email **o** WhatsApp) con
  **consentimiento explícito** (checkbox obligatorio).
- Usarlos **sólo** para enviar el diagnóstico y la recomendación.
- Almacenar de forma segura (HTTPS en tránsito; cifrado en reposo según política).
- Prever baja/borrado a pedido del titular.
- **TODO: validar con PrimOffice** retención, texto legal y enlace a privacidad.

---

## 10. Checklist de puesta en marcha

- [ ] Backend propio `POST` creado y accesible por HTTPS.
- [ ] CORS habilitado para producción y desarrollo (Live Server).
- [ ] `DEMO_MODE:false` + `LEADS_API_URL` configurado + `odooEnabled:true`.
- [ ] Credenciales de Odoo **sólo** en el servidor.
- [ ] Mapeo `crm.lead` y campos `x_*` confirmados.
- [ ] Validaciones del backend implementadas (sección 6).
- [ ] Idempotencia por `leadId` (sección 7).
- [ ] Precios reales cargados (`PRECIOS_CONFIRMADOS:true`).
- [ ] Registro del consentimiento.
- [ ] Prueba end-to-end: test → lead → verificar en Odoo.
- [ ] Política de privacidad/retención confirmada.
