function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function safeString(value, max = 500) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
}

function cleanOdooUrl(rawUrl) {
  return safeString(rawUrl, 300)
    .replace(/\/web.*$/i, "")
    .replace(/\/jsonrpc.*$/i, "")
    .replace(/\/xmlrpc.*$/i, "")
    .replace(/\/+$/g, "");
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlValue(value) {
  if (Array.isArray(value)) {
    return `<value><array><data>${value.map(xmlValue).join("")}</data></array></value>`;
  }

  if (value && typeof value === "object") {
    const members = Object.entries(value).map(([key, val]) => {
      return `<member><name>${xmlEscape(key)}</name>${xmlValue(val)}</member>`;
    }).join("");
    return `<value><struct>${members}</struct></value>`;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return `<value><int>${value}</int></value>`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<value><double>${value}</double></value>`;
  }

  if (typeof value === "boolean") {
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
  }

  return `<value><string>${xmlEscape(value)}</string></value>`;
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function getTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = String(xml || "").match(re);
  return match ? match[1] : "";
}

function parseXmlRpcValue(xml) {
  const valueXml = getTag(xml, "value") || xml;
  const intValue = getTag(valueXml, "int") || getTag(valueXml, "i4");
  if (intValue !== "") return Number(intValue);

  const doubleValue = getTag(valueXml, "double");
  if (doubleValue !== "") return Number(doubleValue);

  const boolValue = getTag(valueXml, "boolean");
  if (boolValue !== "") return boolValue === "1";

  const stringValue = getTag(valueXml, "string");
  if (stringValue !== "") return decodeXml(stringValue);

  const raw = String(valueXml || "").replace(/<[^>]+>/g, "").trim();
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return decodeXml(raw);
}

async function safeReadBody(response) {
  try {
    const text = await response.text();
    return text.slice(0, 1200);
  } catch (error) {
    return `No se pudo leer body: ${error.message}`;
  }
}

async function probeFetch(label, url, options = {}) {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, options);
    const bodyPreview = await safeReadBody(response);

    let parsed = null;
    try {
      parsed = JSON.parse(bodyPreview);
    } catch (_) {
      parsed = null;
    }

    return {
      label,
      url,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      elapsedMs: Date.now() - startedAt,
      contentType: response.headers.get("content-type"),
      server: response.headers.get("server"),
      cfRay: response.headers.get("cf-ray"),
      bodyPreview,
      parsed
    };
  } catch (error) {
    return {
      label,
      url,
      ok: false,
      status: null,
      statusText: null,
      elapsedMs: Date.now() - startedAt,
      error: error.message
    };
  }
}

async function jsonRpc(baseUrl, label, service, method, args = []) {
  return probeFetch(label, `${baseUrl}/jsonrpc`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now()
    })
  });
}

async function webRoute(baseUrl, label, route, params = {}) {
  return probeFetch(label, `${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params,
      id: Date.now()
    })
  });
}

async function xmlRpcCallDetailed(label, endpoint, methodName, params, timeoutMs = 15000) {
  const body = `<?xml version="1.0"?>\n<methodCall><methodName>${xmlEscape(methodName)}</methodName><params>${params.map((param) => `<param>${xmlValue(param)}</param>`).join("")}</params></methodCall>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "text/xml",
        "accept": "text/xml"
      },
      body,
      signal: controller.signal
    });

    const text = await response.text();
    const hasFault = /<fault>/i.test(text);
    const parsedValue = hasFault ? null : parseXmlRpcValue(getTag(text, "param") || text);
    const faultString = hasFault
      ? decodeXml(getTag(text, "string") || text.replace(/<[^>]+>/g, " ").trim()).slice(0, 700)
      : null;

    return {
      label,
      url: endpoint,
      ok: response.ok && !hasFault,
      status: response.status,
      statusText: response.statusText,
      elapsedMs: Date.now() - startedAt,
      contentType: response.headers.get("content-type"),
      server: response.headers.get("server"),
      cfRay: response.headers.get("cf-ray"),
      hasFault,
      faultString,
      valueType: typeof parsedValue,
      valuePresent: Boolean(parsedValue),
      valueIsPositiveNumber: typeof parsedValue === "number" && parsedValue > 0,
      value: parsedValue,
      bodyPreview: text.slice(0, 1200)
    };
  } catch (error) {
    return {
      label,
      url: endpoint,
      ok: false,
      status: null,
      statusText: null,
      elapsedMs: Date.now() - startedAt,
      error: error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueCandidates(items) {
  const out = [];
  const seen = new Set();

  for (const item of items) {
    const value = safeString(item.value, 220);
    if (!value) continue;
    const key = `${item.label}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: item.label, value });
  }

  return out;
}

function secretMeta(secretValue) {
  const raw = String(secretValue ?? "");
  const trimmed = raw.trim();

  return {
    lengthTrimmed: trimmed.length,
    lengthRaw: raw.length,
    hasLeadingOrTrailingWhitespace: raw !== trimmed,
    containsNewline: /\r|\n/.test(raw),
    looksLikeHex: /^[a-f0-9]+$/i.test(trimmed),
    looksLikeUuid: /^[a-f0-9-]+$/i.test(trimmed) && trimmed.includes("-")
  };
}

export async function onRequestGet(context) {
  const env = context.env;

  const baseUrl = cleanOdooUrl(env.ODOO_URL || "");
  const db = safeString(env.ODOO_DB, 140);
  const username = safeString(env.ODOO_USERNAME, 220);
  const userAlt = safeString(env.ODOO_USER, 220);
  const keyOrPasswordRaw = env.ODOO_API_KEY || "";
  const keyOrPassword = safeString(keyOrPasswordRaw, 500);

  const result = {
    ok: true,
    service: "PrimOffice Odoo diagnostic v3",
    warning: "No muestra secretos. No crea leads. Endpoint temporal.",
    configured: {
      hasOdooUrl: Boolean(baseUrl),
      hasDb: Boolean(db),
      hasUsername: Boolean(username),
      hasUserAlt: Boolean(userAlt),
      hasApiKeyOrPassword: Boolean(keyOrPassword),
      enabled: String(env.ODOO_ENABLED || "").toLowerCase() === "true"
    },
    valuesVisible: {
      baseUrl,
      db,
      usernamePresent: Boolean(username),
      userAltPresent: Boolean(userAlt),
      usernameEqualsUserAlt: Boolean(username && userAlt && username === userAlt),
      apiKeyOrPasswordMeta: secretMeta(keyOrPasswordRaw)
    },
    tests: {}
  };

  if (!baseUrl) {
    return jsonResponse({ ...result, ok: false, error: "Falta ODOO_URL" }, 400);
  }

  result.tests.web_get = await probeFetch(
    "GET /web",
    `${baseUrl}/web`,
    {
      method: "GET",
      headers: { "accept": "text/html,application/xhtml+xml" }
    }
  );

  result.tests.jsonrpc_version = await jsonRpc(
    baseUrl,
    "POST /jsonrpc common.version",
    "common",
    "version",
    []
  );

  result.tests.jsonrpc_db_list = await jsonRpc(
    baseUrl,
    "POST /jsonrpc db.list",
    "db",
    "list",
    []
  );

  result.tests.web_database_list = await webRoute(
    baseUrl,
    "POST /web/database/list",
    "/web/database/list",
    {}
  );

  const candidates = uniqueCandidates([
    { label: "ODOO_USERNAME", value: username },
    { label: "ODOO_USER", value: userAlt },
    { label: "ODOO_USERNAME_lowercase", value: username.toLowerCase() },
    { label: "ODOO_USER_lowercase", value: userAlt.toLowerCase() }
  ]);

  result.authCandidates = candidates.map((candidate) => ({
    label: candidate.label,
    present: Boolean(candidate.value),
    sameAsUsername: candidate.value === username,
    sameAsUserAlt: candidate.value === userAlt
  }));

  result.tests.jsonrpc_authenticate_candidates = [];
  result.tests.xmlrpc_authenticate_candidates = [];
  result.tests.web_session_authenticate_candidates = [];

  if (db && keyOrPassword && candidates.length) {
    for (const candidate of candidates) {
      const authTest = await jsonRpc(
        baseUrl,
        `POST /jsonrpc common.authenticate with ${candidate.label}`,
        "common",
        "authenticate",
        [db, candidate.value, keyOrPassword, {}]
      );

      const authResult = authTest.parsed && Object.prototype.hasOwnProperty.call(authTest.parsed, "result")
        ? authTest.parsed.result
        : null;

      result.tests.jsonrpc_authenticate_candidates.push({
        candidate: candidate.label,
        ok: authTest.ok,
        status: authTest.status,
        statusText: authTest.statusText,
        elapsedMs: authTest.elapsedMs,
        authAccepted: typeof authResult === "number" && authResult > 0,
        uidType: typeof authResult,
        uidPresent: Boolean(authResult),
        bodyPreview: authTest.bodyPreview
      });

      const xmlAuthTest = await xmlRpcCallDetailed(
        `POST /xmlrpc/2/common authenticate with ${candidate.label}`,
        `${baseUrl}/xmlrpc/2/common`,
        "authenticate",
        [db, candidate.value, keyOrPassword, {}]
      );

      result.tests.xmlrpc_authenticate_candidates.push({
        candidate: candidate.label,
        ok: xmlAuthTest.ok,
        status: xmlAuthTest.status,
        statusText: xmlAuthTest.statusText,
        elapsedMs: xmlAuthTest.elapsedMs,
        authAccepted: xmlAuthTest.valueIsPositiveNumber,
        uidType: xmlAuthTest.valueType,
        uidPresent: xmlAuthTest.valuePresent,
        hasFault: xmlAuthTest.hasFault,
        faultString: xmlAuthTest.faultString,
        bodyPreview: xmlAuthTest.bodyPreview
      });

      const sessionTest = await webRoute(
        baseUrl,
        `POST /web/session/authenticate with ${candidate.label}`,
        "/web/session/authenticate",
        {
          db,
          login: candidate.value,
          password: keyOrPassword
        }
      );

      let sessionUid = null;
      let sessionError = null;

      if (sessionTest.parsed && sessionTest.parsed.result) {
        sessionUid = sessionTest.parsed.result.uid || null;
      }

      if (sessionTest.parsed && sessionTest.parsed.error) {
        sessionError =
          sessionTest.parsed.error.message ||
          sessionTest.parsed.error.data?.message ||
          "Error sin detalle";
      }

      result.tests.web_session_authenticate_candidates.push({
        candidate: candidate.label,
        ok: sessionTest.ok,
        status: sessionTest.status,
        statusText: sessionTest.statusText,
        elapsedMs: sessionTest.elapsedMs,
        sessionAccepted: typeof sessionUid === "number" && sessionUid > 0,
        uidPresent: Boolean(sessionUid),
        errorMessage: sessionError,
        bodyPreview: sessionTest.bodyPreview
      });
    }

    const successfulXmlAuth = result.tests.xmlrpc_authenticate_candidates.find((test) => test.authAccepted);
    const successfulCandidate = successfulXmlAuth
      ? candidates.find((candidate) => candidate.label === successfulXmlAuth.candidate)
      : null;

    if (successfulXmlAuth && successfulCandidate) {
      const uidText = successfulXmlAuth.bodyPreview || "";
      const uidMatch = uidText.match(/<int>(\d+)<\/int>|<i4>(\d+)<\/i4>/i);
      const uid = uidMatch ? Number(uidMatch[1] || uidMatch[2]) : null;

      if (uid) {
        result.tests.xmlrpc_crm_create_access = await xmlRpcCallDetailed(
          "POST /xmlrpc/2/object crm.lead.check_access_rights(create)",
          `${baseUrl}/xmlrpc/2/object`,
          "execute_kw",
          [
            db,
            uid,
            keyOrPassword,
            "crm.lead",
            "check_access_rights",
            ["create"],
            { raise_exception: false }
          ]
        );
      } else {
        result.tests.xmlrpc_crm_create_access = {
          skipped: true,
          reason: "Autenticó, pero no se pudo extraer uid del body XML."
        };
      }
    } else {
      result.tests.xmlrpc_crm_create_access = {
        skipped: true,
        reason: "Ningún candidato autenticó por XML-RPC."
      };
    }
  } else {
    result.tests.auth = {
      skipped: true,
      reason: "Faltan ODOO_DB, ODOO_USERNAME/ODOO_USER u ODOO_API_KEY."
    };
  }

  return jsonResponse(result);
}
