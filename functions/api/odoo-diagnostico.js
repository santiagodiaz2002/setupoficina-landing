function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function cleanOdooUrl(rawUrl) {
  if (!rawUrl) return "";

  return String(rawUrl)
    .trim()
    .replace(/\/web.*$/i, "")
    .replace(/\/jsonrpc.*$/i, "")
    .replace(/\/xmlrpc.*$/i, "")
    .replace(/\/+$/g, "");
}

async function safeReadBody(response) {
  try {
    const text = await response.text();
    return text.slice(0, 1000);
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
      params: {
        service,
        method,
        args
      },
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

export async function onRequestGet(context) {
  const env = context.env;

  const baseUrl = cleanOdooUrl(env.ODOO_URL || "");
  const db = env.ODOO_DB || "";
  const username = env.ODOO_USERNAME || env.ODOO_USER || "";
  const userAlt = env.ODOO_USER || "";
  const keyOrPassword = env.ODOO_API_KEY || "";

  const result = {
    ok: true,
    service: "PrimOffice Odoo diagnostic v2",
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
      userAltPresent: Boolean(userAlt)
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

  if (db && username && keyOrPassword) {
    const authTest = await jsonRpc(
      baseUrl,
      "POST /jsonrpc common.authenticate",
      "common",
      "authenticate",
      [db, username, keyOrPassword, {}]
    );

    const authResult = authTest.parsed && Object.prototype.hasOwnProperty.call(authTest.parsed, "result")
      ? authTest.parsed.result
      : null;

    result.tests.jsonrpc_authenticate = {
      label: authTest.label,
      url: authTest.url,
      ok: authTest.ok,
      status: authTest.status,
      statusText: authTest.statusText,
      elapsedMs: authTest.elapsedMs,
      contentType: authTest.contentType,
      bodyPreview: authTest.bodyPreview,
      authAccepted: typeof authResult === "number" && authResult > 0,
      uidType: typeof authResult,
      uidPresent: Boolean(authResult)
    };

    const sessionTest = await webRoute(
      baseUrl,
      "POST /web/session/authenticate",
      "/web/session/authenticate",
      {
        db,
        login: username,
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

    result.tests.web_session_authenticate = {
      label: sessionTest.label,
      url: sessionTest.url,
      ok: sessionTest.ok,
      status: sessionTest.status,
      statusText: sessionTest.statusText,
      elapsedMs: sessionTest.elapsedMs,
      contentType: sessionTest.contentType,
      sessionAccepted: typeof sessionUid === "number" && sessionUid > 0,
      uidPresent: Boolean(sessionUid),
      errorMessage: sessionError,
      bodyPreview: sessionTest.bodyPreview
    };
  } else {
    result.tests.jsonrpc_authenticate = {
      skipped: true,
      reason: "Faltan ODOO_DB, ODOO_USERNAME/ODOO_USER u ODOO_API_KEY"
    };

    result.tests.web_session_authenticate = {
      skipped: true,
      reason: "Faltan ODOO_DB, ODOO_USERNAME/ODOO_USER u ODOO_API_KEY"
    };
  }

  return jsonResponse(result);
}