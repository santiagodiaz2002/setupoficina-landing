// Versioned JSON embedded as visible, escaped text in the existing description.
// No schema changes; null amounts remain distinct from a known zero.
export const CORPORATE_RECORD_START = '--- PRIMOFFICE CORPORATE DATA v1 ---';
export const CORPORATE_RECORD_END = '--- END PRIMOFFICE CORPORATE DATA ---';
export const CORPORATE_STATUSES = Object.freeze(['new', 'qualified', 'quoted', 'won', 'lost']);

export function serializeCorporateRecord(record) {
  if (record.schema_version !== 1 || !CORPORATE_STATUSES.includes(record.status)) {
    throw new Error('Invalid corporate record');
  }
  const valueKeys = ['estimated_value', 'quoted_value', 'won_value' in record ? 'won_value' : 'final_sale_value'];
  if ('won_value' in record && 'final_sale_value' in record) valueKeys.push('final_sale_value');
  for (const key of valueKeys) {
    if (record[key] !== null && (typeof record[key] !== 'number' || !Number.isFinite(record[key]) || record[key] < 0)) {
      throw new Error('Invalid corporate value');
    }
  }
  const ordered = Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]]));
  // Prevent user text from imitating a delimiter inside the JSON. JSON.parse
  // restores these characters exactly, including click IDs and literal entities.
  return JSON.stringify(ordered, null, 2).replaceAll('---', '\\u002d\\u002d\\u002d');
}

export function createCorporateRecord(data) {
  return serializeCorporateRecord({
    ...data,
    schema_version: 1,
    lead_id: null,
    created_at: null,
    status: 'new',
    estimated_value: null,
    quoted_value: null,
    won_value: null,
    currency: 'ARS'
  });
}

export function parseCorporateRecord(description) {
  // Read the HTML value returned by crm.lead.read. Strip markup BEFORE decoding
  // entities, so escaped user markup remains part of the JSON, not executable HTML.
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const text = String(description || '').replace(/<[^>]*>/g, '').replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (match, entity) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()];
      const hex = entity[1].toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
  );
  // The authoritative block is appended after the human description, which may
  // itself contain delimiter-looking text supplied by a customer.
  const start = text.lastIndexOf(CORPORATE_RECORD_START);
  if (start === -1) return null;
  const jsonStart = start + CORPORATE_RECORD_START.length;
  const end = text.indexOf(CORPORATE_RECORD_END, jsonStart);
  if (end === -1) throw new Error('Incomplete corporate record');
  const record = JSON.parse(text.slice(jsonStart, end).trim());
  serializeCorporateRecord(record); // Validate version, lifecycle and nullable values.
  // Keep historical fields readable without treating capture time as creation time.
  if (!('won_value' in record)) record.won_value = record.final_sale_value;
  return record;
}
