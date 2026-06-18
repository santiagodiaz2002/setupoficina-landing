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
    return text.slice(0, 700);
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

export async function onRequestGet(context) {
  const env = context.env;

  const rawOdooUrl = env.ODOO_URL || "";
  const baseUrl = cleanOdooUrl(rawOdooUrl);

  const db = env.ODOO_DB || "";
  const username = env.ODOO_USERNAME || env.ODOO_USER || "";
  const apiKey = env.ODOO_API_KEY || "";

  const configured = {
    hasOdooUrl: Boolean(baseUrl),
    hasDb: Boolean(db),
    hasUsername: Boolean(username),
    hasApiKey: Boolean(apiKey),
    enabled: String(env.ODOO_ENABLED || "").toLowerCase() === "true"
  };

  const result = {
    ok: true,
    service: "PrimOffice Odoo diagnostic",
    warning: "No muestra secretos. No crea leads. Endpoint temporal.",
    configured,
    rawUrlReceived: rawOdooUrl ? "[configurada]" : "[vacía]",
    baseUrl,
    tests: {}
  };

  if (!baseUrl) {
    return jsonResponse({
      ...result,
      ok: false,
      error: "Falta ODOO_URL"
    }, 400);
  }

  result.tests.web_get = await probeFetch(
    "GET /web",
    `${baseUrl}/web`,
    {
      method: "GET",
      headers: {
        "accept": "text/html,application/xhtml+xml"
      }
    }
  );

  result.tests.jsonrpc_version = await probeFetch(
    "POST /jsonrpc common.version",
    `${baseUrl}/jsonrpc`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "version",
          args: []
        },
        id: Date.now()
      })
    }
  );

  if (db && username && apiKey) {
    const authTest = await probeFetch(
      "POST /jsonrpc common.authenticate",
      `${baseUrl}/jsonrpc`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "call",
          params: {
            service: "common",
            method: "authenticate",
            args: [db, username, apiKey, {}]
          },
          id: Date.now()
        })
      }
    );

    let authResult = null;

    if (authTest.parsed && Object.prototype.hasOwnProperty.call(authTest.parsed, "result")) {
      authResult = authTest.parsed.result;
    }

    result.tests.jsonrpc_authenticate = {
      ...authTest,
      authAccepted: typeof authResult === "number" && authResult > 0,
      uidType: typeof authResult,
      uidPresent: Boolean(authResult)
    };
  } else {
    result.tests.jsonrpc_authenticate = {
      skipped: true,
      reason: "Faltan ODOO_DB, ODOO_USERNAME/ODOO_USER u ODOO_API_KEY"
    };
  }

  return jsonResponse(result);
}