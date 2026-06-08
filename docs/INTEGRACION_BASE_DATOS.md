# Integración de leads con base de datos

Este documento define el **contrato** entre la landing (sitio estático) y el
backend que PrimOffice usará para **almacenar los leads** del test diagnóstico.

La landing ya está preparada con una **capa desacoplada**:

- `js/config/app-config.js` → parámetros configurables (incluida la URL del endpoint).
- `js/services/leads-service.js` → único punto que envía el lead (`submitLead`).
- `js/test-diagnostico.js` → arma el `payload` y llama a `submitLead`.

Mientras no exista endpoint, el servicio funciona en **modo demo**
(guarda en `localStorage`, registra en consola que la integración real está
pendiente y permite continuar al resultado, sin simular una confirmación de
persistencia real).

> **Estado actual:** PrimOffice confirmó que los leads deben almacenarse en una
> base de datos, pero todavía **no** hay proveedor, endpoint, credenciales,
> autenticación ni esquema definidos. **TODO: validar con PrimOffice.**

---

## 1. Resumen del contrato

| Aspecto | Valor |
|--------|-------|
| Método | `POST` |
| URL | Configurable en `APP_CONFIG.LEADS_API_URL` (vacío = modo demo) |
| Formato | `application/json` (UTF-8) |
| Autenticación | Opcional, `Authorization: Bearer <token>` (no hardcodear el token) |
| Timeout | `APP_CONFIG.LEADS_TIMEOUT_MS` (10 s por defecto) |
| Respuesta esperada | `2xx` con JSON `{ "ok": true, ... }` |

---

## 2. Cómo conectar el backend real (pasos exactos)

1. Crear el endpoint en el backend que acepte `POST` con el body de la sección 4.
2. Habilitar **CORS** para el origen del sitio
   (`https://setupoficina.com.ar` y, en desarrollo, `http://127.0.0.1:5500` /
   `http://localhost:5500` de Live Server).
3. Completar la URL en `js/config/app-config.js`:

   ```js
   export const APP_CONFIG = {
     LEADS_API_URL: 'https://api.tu-backend.com/leads', // ← completar
     // ...
   };
   ```

   > Alternativa sin tocar el archivo: definir
   > `window.PrimOfficeConfig = { LEADS_API_URL: '...' }` **antes** de cargar
   > los scripts (por ejemplo, inyectado por el hosting).

4. Si el endpoint requiere token, **no** lo escribas en el repositorio. Inyectalo
   en runtime desde un entorno seguro:

   ```js
   window.PrimOfficeConfig = { LEADS_API_URL: '...', LEADS_API_TOKEN: '...' };
   ```

   > Aclaración de seguridad: cualquier valor que llegue al navegador es público.
   > Para secretos reales, lo recomendable es un endpoint propio que valide del
   > lado del servidor (idealmente un proxy/Function que reciba el lead y hable
   > con la base de datos con credenciales del servidor).

5. Probar el flujo completo (ver `README` o sección 7) y confirmar que el lead
   llega a la base de datos.

Cuando `LEADS_API_URL` tiene valor, el modo demo se desactiva automáticamente.

---

## 3. Request

### Headers

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>     # sólo si APP_CONFIG.LEADS_API_TOKEN está definido
```

### Body

JSON con el esquema de la sección 4.

---

## 4. Esquema del payload (request body)

```jsonc
{
  "nombre": "Ana Pérez",
  "canalPreferido": "email",          // "email" | "whatsapp"
  "email": "ana@ejemplo.com",         // presente sólo si canalPreferido = "email"
  "whatsapp": "",                      // presente sólo si canalPreferido = "whatsapp"
  "empresa": "",                       // opcional; sólo si el test indicó "varios puestos"
  "tipoUsuario": "personal",          // "personal" | "empresa"

  "respuestasTest": {                  // respuestas crudas del test (claves = id de pregunta)
    "lugar": "casa",
    "horas": "6a8",
    "dispositivos": ["notebook", "monitor"],
    "mejorar": ["postura", "orden"],
    "yaTengo": ["silla", "monitor"],
    "espacio": "estandar",
    "prioridad": "comodidad",
    "paraQuien": "personal"
  },

  "puntajes": {                        // puntaje por categoría (números enteros)
    "ergonomia": 0,
    "conectividad": 0,
    "iluminacion": 0,
    "orden": 0,
    "superficieTrabajo": 0,
    "mobiliario": 0,
    "usoCorporativo": 0
  },

  "categoriasPrioritarias": ["ergonomia", "orden"],
  "presetRecomendado": "pro",         // "basica" | "pro" | "premium"
  "tamanoEscritorio": "estandar",     // "compacto" | "estandar" | "amplio"
  "modoEscritorio": "sentado",        // "sentado" | "standing"

  "productosRecomendados": ["brazo", "luz", "hub"],   // a sumar (excluye lo que ya tiene)
  "productosFinales": ["silla", "monitor", "brazo", "luz", "teclado", "mouse", "hub", "celular", "pad", "cables"],

  "origen": "landing-setup-oficina",
  "utm": {                             // sólo las claves presentes en la URL
    "utm_source": "instagram",
    "utm_medium": "social",
    "utm_campaign": "test-setup"
  },
  "fechaIso": "2026-06-08T13:45:12.000Z"
}
```

### Notas sobre los campos

- `email` y `whatsapp` son **mutuamente excluyentes** según `canalPreferido`. El
  campo no elegido se envía como cadena vacía.
- `empresa` llega con valor sólo cuando `tipoUsuario = "empresa"` (y el usuario lo
  completó; es opcional).
- `productosRecomendados` = productos **a adquirir** (ya se descontó lo que el
  usuario declaró tener).
- `productosFinales` = configuración cargada en el configurador 3D al momento del
  envío. Puede cambiar luego si el usuario edita manualmente (eso viaja por
  WhatsApp, no se re-envía al endpoint en esta versión).

---

## 5. Response

### Éxito (`200`/`201`)

```json
{ "ok": true, "id": "lead_123" }
```

La landing considera exitoso cualquier `2xx`. El `id` es opcional pero
recomendable para trazabilidad.

### Error

| HTTP | Significado | Acción de la landing |
|------|-------------|----------------------|
| `400` | Validación fallida | Loguea el detalle en consola; el usuario igual ve su diagnóstico y puede seguir por WhatsApp |
| `401` / `403` | Auth inválida | Loguea error; revisar token/config |
| `429` | Rate limit | Loguea error; reintentar manualmente |
| `5xx` | Error del servidor | Loguea error; el usuario continúa por WhatsApp |
| timeout / red | Sin respuesta en `LEADS_TIMEOUT_MS` | Loguea `timeout`/`network`; el usuario continúa |

Formato de error sugerido:

```json
{ "ok": false, "error": "VALIDATION_ERROR", "message": "email inválido" }
```

> Importante: la landing **nunca bloquea** al usuario por un fallo de
> persistencia. Siempre puede ver su resultado y contactar por WhatsApp. Si el
> envío falla o está en modo demo, **no** se muestra una confirmación de guardado.

---

## 6. Validaciones recomendadas (lado backend)

- `nombre`: requerido, 1–120 caracteres.
- `canalPreferido`: requerido, `email` | `whatsapp`.
- `email`: requerido si `canalPreferido = email`; formato válido.
- `whatsapp`: requerido si `canalPreferido = whatsapp`; 8–15 dígitos (con `+` opcional).
- `consentimiento`: la landing exige el checkbox antes de enviar; el backend
  debería **registrar** que hubo consentimiento (fecha/origen).
- Sanitizar todos los strings; rechazar payloads mayores a un tamaño razonable.
- Idempotencia opcional por `fechaIso + email/whatsapp` para evitar duplicados.

---

## 7. Consideraciones de privacidad

- Se recopilan **datos personales** (nombre + email **o** WhatsApp) con
  **consentimiento explícito** (checkbox obligatorio en el formulario).
- Usar los datos **sólo** para enviar el diagnóstico y la recomendación, según
  lo informado al usuario.
- Almacenar de forma segura (cifrado en tránsito vía HTTPS y en reposo según
  política de PrimOffice).
- Prever borrado/baja a pedido del titular (derechos del titular de datos).
- **TODO: validar con PrimOffice** la política de retención, el texto legal del
  consentimiento y, si corresponde, enlazar una página de privacidad.

---

## 8. Checklist de puesta en marcha

- [ ] Endpoint `POST` creado y accesible por HTTPS.
- [ ] CORS habilitado para producción y desarrollo (Live Server).
- [ ] `LEADS_API_URL` configurado.
- [ ] Token (si aplica) inyectado en runtime, **no** en el repo.
- [ ] Validaciones del backend implementadas (sección 6).
- [ ] Registro del consentimiento.
- [ ] Prueba end-to-end: completar el test → enviar lead → verificar en la base.
- [ ] Política de privacidad/retención confirmada con PrimOffice.
