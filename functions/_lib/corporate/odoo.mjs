// Patrón XML-RPC de SetupOficina, commit fa324fac660cbc79283d272994d85c950f116a68.
// Sin lógica del test ni payloads comerciales de SetupOficina. Errores sin datos sensibles.
function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlValue(value) {
  if (Array.isArray(value)) {
    return `<value><array><data>${value.map(xmlValue).join('')}</data></array></value>`;
  }

  if (value && typeof value === 'object') {
    const members = Object.entries(value).map(([key, val]) => {
      return `<member><name>${xmlEscape(key)}</name>${xmlValue(val)}</member>`;
    }).join('');
    return `<value><struct>${members}</struct></value>`;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return `<value><int>${value}</int></value>`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<value><double>${value}</double></value>`;
  }

  if (typeof value === 'boolean') {
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
  }

  return `<value><string>${xmlEscape(value ?? '')}</string></value>`;
}

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? match[1] : '';
}

function findXmlElement(xml, tag, fromIndex = 0) {
  const source = String(xml || '');
  const pattern = new RegExp(`<\\/?${tag}(?:\\s[^>]*)?>`, 'ig');
  pattern.lastIndex = fromIndex;

  let match;
  while ((match = pattern.exec(source))) {
    if (match[0][1] === '/') continue;

    const start = match.index;
    const openEnd = pattern.lastIndex;
    let depth = 1;

    while ((match = pattern.exec(source))) {
      depth += match[0][1] === '/' ? -1 : 1;

      if (depth === 0) {
        return {
          start,
          end: pattern.lastIndex,
          inner: source.slice(openEnd, match.index),
          whole: source.slice(start, pattern.lastIndex)
        };
      }
    }

    return null;
  }

  return null;
}

function getXmlElements(xml, tag) {
  const elements = [];
  let cursor = 0;
  let element;

  while ((element = findXmlElement(xml, tag, cursor))) {
    elements.push(element);
    cursor = element.end;
  }

  return elements;
}

function isWholeXmlElement(element, xml) {
  return Boolean(element && element.whole.trim() === String(xml || '').trim());
}

function parseXmlRpcTypedValue(xml) {
  const trimmed = String(xml || '').trim();
  const valueElement = findXmlElement(trimmed, 'value');
  if (isWholeXmlElement(valueElement, trimmed)) return parseXmlRpcTypedValue(valueElement.inner);

  const arrayElement = findXmlElement(trimmed, 'array');
  if (isWholeXmlElement(arrayElement, trimmed)) {
    const dataElement = findXmlElement(arrayElement.inner, 'data');
    const dataXml = dataElement ? dataElement.inner : arrayElement.inner;
    return getXmlElements(dataXml, 'value').map((item) => parseXmlRpcTypedValue(item.whole));
  }

  const structElement = findXmlElement(trimmed, 'struct');
  if (isWholeXmlElement(structElement, trimmed)) {
    const out = {};

    getXmlElements(structElement.inner, 'member').forEach((member) => {
      const nameElement = findXmlElement(member.inner, 'name');
      const memberValue = findXmlElement(member.inner, 'value');
      if (!nameElement) return;
      out[decodeXml(nameElement.inner)] = memberValue ? parseXmlRpcTypedValue(memberValue.whole) : '';
    });

    return out;
  }

  const intElement = findXmlElement(trimmed, 'int') || findXmlElement(trimmed, 'i4');
  if (isWholeXmlElement(intElement, trimmed)) return Number(intElement.inner);

  const doubleElement = findXmlElement(trimmed, 'double');
  if (isWholeXmlElement(doubleElement, trimmed)) return Number(doubleElement.inner);

  const boolElement = findXmlElement(trimmed, 'boolean');
  if (isWholeXmlElement(boolElement, trimmed)) return boolElement.inner === '1';

  const stringElement = findXmlElement(trimmed, 'string');
  if (isWholeXmlElement(stringElement, trimmed)) return decodeXml(stringElement.inner);

  if (/^<nil\s*\/>$/i.test(trimmed)) return null;

  const raw = trimmed.replace(/<[^>]+>/g, '').trim();
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return decodeXml(raw);
}

function parseXmlRpcValue(xml) {
  const valueElement = findXmlElement(xml, 'value');
  return parseXmlRpcTypedValue(valueElement ? valueElement.whole : xml);
}

async function xmlRpcCall(endpoint, methodName, params, timeoutMs = 15000) {
  const body = `<?xml version="1.0"?>\n<methodCall><methodName>${xmlEscape(methodName)}</methodName><params>${params.map((param) => `<param>${xmlValue(param)}</param>`).join('')}</params></methodCall>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body,
      signal: controller.signal
    });

    const reader = resp.body?.getReader();
    if (!reader) throw new Error('Empty Odoo response');
    const decoder = new TextDecoder();
    let text = '';
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1048576) {
          await reader.cancel();
          throw new Error('Odoo response too large');
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    if (!resp.ok) throw new Error(`Odoo HTTP ${resp.status}`);

    if (/<fault>/i.test(text)) {
      throw new Error('Odoo RPC fault');
    }

    return parseXmlRpcValue(getTag(text, 'param') || text);
  } finally {
    clearTimeout(timeout);
  }
}


export async function getOdooSession(env) {
  if (String(env.ODOO_ENABLED).toLowerCase() !== 'true') throw new Error('Odoo disabled');
  for (const name of ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_API_KEY']) {
    if (typeof env[name] !== 'string' || !env[name].trim()) throw new Error('Odoo not configured');
  }
  const url = env.ODOO_URL.trim().replace(/\/+$/, '');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Invalid Odoo URL');
  const session = { url, db: env.ODOO_DB.trim(), apiKey: env.ODOO_API_KEY.trim(), deadline: Date.now() + 25000 };
  session.uid = await xmlRpcCall(url + '/xmlrpc/2/common', 'authenticate', [session.db, env.ODOO_USERNAME.trim(), session.apiKey, {}], 10000);
  if (!Number.isInteger(session.uid) || session.uid <= 0) throw new Error('Odoo authentication failed');
  return session;
}

export async function odooExecuteKw(session, model, method, args = [], kwargs = {}) {
  const remaining = session.deadline - Date.now();
  if (remaining <= 0) throw new Error('Odoo deadline exceeded');
  return xmlRpcCall(session.url + '/xmlrpc/2/object', 'execute_kw', [session.db, session.uid, session.apiKey, model, method, args, kwargs], Math.min(10000, remaining));
}
