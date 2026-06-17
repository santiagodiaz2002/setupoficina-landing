CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  source TEXT,
  name TEXT NOT NULL,
  preferred_channel TEXT,
  email TEXT,
  whatsapp TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  recommended_tier TEXT,
  recommended_preset TEXT,
  total_score INTEGER,
  estimated_total INTEGER,
  currency TEXT,
  products_json TEXT,
  utm_json TEXT,
  payload_json TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  country TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_contact_whatsapp ON leads(whatsapp);
