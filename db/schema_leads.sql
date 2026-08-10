-- Este esquema define una base nueva para la API de leads; la ruta de creación y actualización depende de estas columnas.
-- Los campos JSON conservan estructuras completas como texto y los campos de Odoo registran el estado de la sincronización externa.
-- Los índices finales aceleran orden temporal, deduplicación lógica, búsquedas de contacto y relación con Odoo.
-- Crea la tabla principal si aún no existe, permitiendo inicializar una base vacía sin error.
CREATE TABLE IF NOT EXISTS leads (
-- La columna usa una clave numérica autoincremental para ordenar y referenciar filas localmente.
  id INTEGER PRIMARY KEY AUTOINCREMENT,
-- La columna exige un identificador lógico único para evitar duplicar la misma captación.
  lead_id TEXT UNIQUE NOT NULL,
-- La columna conserva el instante de creación que usa el orden cronológico.
  created_at TEXT NOT NULL,
-- La columna registra el origen declarado de la captación cuando está disponible.
  source TEXT,
-- La columna exige el nombre del contacto porque la validación del handler lo considera obligatorio.
  name TEXT NOT NULL,
-- La columna conserva el canal normalizado elegido por la persona.
  preferred_channel TEXT,
-- La columna guarda correo opcional y el índice posterior permite localizarlo con rapidez.
  email TEXT,
-- La columna guarda el teléfono normalizado opcional y admite búsqueda indexada.
  whatsapp TEXT,
-- La columna representa el consentimiento como entero y parte de cero cuando no se indicó.
  consent INTEGER NOT NULL DEFAULT 0,
-- La columna conserva el nivel recomendado después de normalizarlo.
  recommended_tier TEXT,
-- La columna conserva el preset coherente con el nivel recomendado.
  recommended_preset TEXT,
-- La columna guarda el puntaje numérico que fundamenta la recomendación.
  total_score INTEGER,
-- La columna registra la estimación total calculada por la configuración.
  estimated_total INTEGER,
-- La columna identifica la moneda asociada a la estimación.
  currency TEXT,
-- La columna conserva las colecciones de productos serializadas como JSON textual.
  products_json TEXT,
-- La columna conserva atribución de campaña serializada sin imponer un esquema rígido.
  utm_json TEXT,
-- La columna exige una copia serializada del payload normalizado para trazabilidad.
  payload_json TEXT NOT NULL,
-- La columna registra el agente del navegador con la longitud ya limitada por el handler.
  user_agent TEXT,
-- La columna conserva la dirección informada por el borde cuando está disponible.
  ip TEXT,
-- La columna guarda el país aportado por el contexto de Cloudflare.
  country TEXT,

  -- Columnas usadas por la sincronizacion con Odoo.
  -- Este CREATE TABLE documenta bases nuevas; no migra bases D1 existentes.
-- La columna inicia la sincronización externa como pendiente y luego refleja éxito, error u omisión.
  odoo_status TEXT DEFAULT 'pending',
-- La columna enlaza la fila local con el identificador numérico de la oportunidad remota.
  odoo_lead_id INTEGER,
-- La columna guarda un mensaje acotado cuando la sincronización no termina correctamente.
  odoo_error TEXT,
-- La columna registra el instante de la última sincronización confirmada.
  odoo_synced_at TEXT
-- Cierra la definición después de enumerar todas las columnas persistidas por los handlers.
);

-- Este índice acelera listados ordenados desde la captación más reciente.
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
-- Este índice acelera la búsqueda usada antes de una actualización.
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
-- Este índice permite localizar filas por correo sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS idx_leads_contact_email ON leads(email);
-- Este índice permite localizar filas por teléfono sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS idx_leads_contact_whatsapp ON leads(whatsapp);
-- Este índice acelera la relación entre oportunidad remota y registro local.
CREATE INDEX IF NOT EXISTS idx_leads_odoo_lead_id ON leads(odoo_lead_id);
