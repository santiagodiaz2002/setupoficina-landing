// Esta suite carga módulos del repositorio y aísla la API de leads con dobles de DOM, D1, reloj y XML RPC.
// Los casos fijan normalización, validación, experiencia ante errores y sincronización defensiva con Odoo.
// Sin estos escenarios sería fácil reintroducir datos incoherentes, actualizar el lead equivocado o filtrar fallos externos al usuario.
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import assert from 'node:assert/strict';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { readFile } from 'node:fs/promises';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import path from 'node:path';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import test from 'node:test';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import vm from 'node:vm';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { fileURLToPath } from 'node:url';

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
async function readRepoFile(relativePath) {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  return readFile(path.join(ROOT, relativePath), 'utf8');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Reserva estado mutable para registrar llamadas o simular una transición.
let moduleCounter = 0;
// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
async function importRepoModule(relativePath) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const source = await readRepoFile(relativePath);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#test-${moduleCounter++}`;
// Importa dinámicamente la unidad aislada para que el caso controle su entorno.
  return import(url);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
async function flushPromises() {
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await Promise.resolve();
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await Promise.resolve();
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function extractFunction(source, name) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(match, `No se encontro ${name}`);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const start = match.index;

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const braceStart = source.indexOf('{', start);
// Reserva estado mutable para registrar llamadas o simular una transición.
  let depth = 0;

// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (let i = braceStart; i < source.length; i += 1) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (source[i] === '{') depth += 1;
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (source[i] === '}') depth -= 1;
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (depth === 0) return source.slice(start, i + 1);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
  throw new Error(`No se pudo extraer ${name}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function extractVarLiteral(source, name) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const marker = `var ${name}=`;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const start = source.indexOf(marker);
// Comprueba el efecto observable relevante de esta preparación.
  assert.notEqual(start, -1, `No se encontro ${name}`);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const equals = source.indexOf('=', start);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const rest = source.slice(equals + 1);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const firstLiteral = rest.search(/[\[{]/);
// Comprueba el efecto observable relevante de esta preparación.
  assert.notEqual(firstLiteral, -1, `No se encontro literal para ${name}`);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const openStart = equals + 1 + firstLiteral;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const open = source[openStart];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const close = open === '[' ? ']' : '}';
// Reserva estado mutable para registrar llamadas o simular una transición.
  let depth = 0;

// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (let i = openStart; i < source.length; i += 1) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (source[i] === open) depth += 1;
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (source[i] === close) depth -= 1;
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (depth === 0) return source.slice(start, i + 2);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
  throw new Error(`No se pudo extraer ${name}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function createStorage() {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const values = new Map();
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    getItem(key) {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return values.has(key) ? values.get(key) : null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    setItem(key, value) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      values.set(key, String(value));
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    removeItem(key) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      values.delete(key);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    clear() {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      values.clear();
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function createSubmitHarness({ submitLead }) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const html = createSubmitHarness.html;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const button = { disabled: false, innerHTML: 'Enviar' };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const submitError = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    textContent: '',
// Define un campo del fixture que representa una entrada o respuesta específica.
    hidden: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
    focused: false,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    setAttribute(name) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (name === 'hidden') this.hidden = true;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    removeAttribute(name) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (name === 'hidden') this.hidden = false;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    focus() {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      this.focused = true;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const pqLead = { hidden: false };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const calls = { hide: 0, showResult: 0 };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const payload = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    leadId: 'lead_front_1',
// Define un campo del fixture que representa una entrada o respuesta específica.
    contact: { name: 'Santi', preferredChannel: 'email', email: 'santi@example.com', consent: true },
// Define un campo del fixture que representa una entrada o respuesta específica.
    diagnosis: { totalScore: 10, recommendedTier: 'Setup Pro', recommendedPreset: 'pro' },
// Define un campo del fixture que representa una entrada o respuesta específica.
    configuration: { selectedProducts: ['silla'], selectedExtras: [], estimatedTotal: 180000, currency: 'ARS' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const context = {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    console,
// Define un campo del fixture que representa una entrada o respuesta específica.
    localStorage: createStorage(),
// Define un campo del fixture que representa una entrada o respuesta específica.
    window: { PrimOfficeLeads: { submitLead } },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    pqLead,
// Define un campo del fixture que representa una entrada o respuesta específica.
    pqLeadSession: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      basePayload: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
      leadId: '',
// Define un campo del fixture que representa una entrada o respuesta específica.
      odooLeadId: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
      cartUpdateTimer: 0,
// Define un campo del fixture que representa una entrada o respuesta específica.
      lastUpdateAt: '',
// Define un campo del fixture que representa una entrada o respuesta específica.
      lastCartSignature: ''
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Define un campo del fixture que representa una entrada o respuesta específica.
    document: {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      querySelector(selector) {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
        return selector === '#pqLeadForm [type=submit]' ? button : null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      getElementById(id) {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
        return id === 'pqSubmitError' ? submitError : null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    pqValidate() {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return true;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    pqPayload() {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return payload;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    pqHide(el) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      calls.hide += 1;
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (el) el.hidden = true;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    showResult() {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      calls.showResult += 1;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  vm.createContext(context);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  vm.runInContext([
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'clonePayload'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'readOdooLeadId'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'storeLeadSession'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'pqClearSubmitErr'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'pqSubmitErr'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'pqLeadSubmitError'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'pqSubmit'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'this.pqSubmit = pqSubmit;'
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ].join('\n'), context);

// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { button, calls, context, payload, pqLead, submitError };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function createTimerHarness() {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const html = createTimerHarness.html;
// Reserva estado mutable para registrar llamadas o simular una transición.
  let nextTimerId = 1;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const timers = new Map();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const calls = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    clearTimeout: [],
// Define un campo del fixture que representa una entrada o respuesta específica.
    presets: [],
// Define un campo del fixture que representa una entrada o respuesta específica.
    setCart: [],
// Define un campo del fixture que representa una entrada o respuesta específica.
    updateLead: [],
// Define un campo del fixture que representa una entrada o respuesta específica.
    updatePreview: 0,
// Define un campo del fixture que representa una entrada o respuesta específica.
    updateTotal: 0,
// Define un campo del fixture que representa una entrada o respuesta específica.
    updatePresetButtons: []
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const cartState = {};
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const context = {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    console,
// Define un campo del fixture que representa una entrada o respuesta específica.
    window: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      PrimOfficeLeads: {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        updateLead(payload) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          calls.updateLead.push(payload);
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
          return Promise.resolve({ ok: true, data: { odoo: { id: payload.odooLeadId || 222 } } });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Define un campo del fixture que representa una entrada o respuesta específica.
    pqLeadSession: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      basePayload: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
      leadId: '',
// Define un campo del fixture que representa una entrada o respuesta específica.
      odooLeadId: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
      cartUpdateTimer: 0,
// Define un campo del fixture que representa una entrada o respuesta específica.
      lastUpdateAt: '',
// Define un campo del fixture que representa una entrada o respuesta específica.
      lastCartSignature: ''
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    cartState,
// Define un campo del fixture que representa una entrada o respuesta específica.
    extrasState: {},
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    setTimeout(fn, delay) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const id = nextTimerId++;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      timers.set(id, { fn, delay, cleared: false });
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return id;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    clearTimeout(id) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      calls.clearTimeout.push(id);
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (timers.has(id)) timers.get(id).cleared = true;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    getCurrentCartConfiguration() {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const selectedProducts = Object.keys(cartState).filter((id) => cartState[id]);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const estimatedTotal = selectedProducts.length * 1000;
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        selectedProducts,
// Define un campo del fixture que representa una entrada o respuesta específica.
        selectedProductNames: selectedProducts,
// Define un campo del fixture que representa una entrada o respuesta específica.
        selectedExtras: [],
// Define un campo del fixture que representa una entrada o respuesta específica.
        selectedExtraNames: [],
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        estimatedTotal,
// Define un campo del fixture que representa una entrada o respuesta específica.
        currency: 'ARS'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    setCartRowState(id, on) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      cartState[id] = !!on;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      calls.setCart.push({ id, on: !!on });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    updateTotal() {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      calls.updateTotal += 1;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    updatePreview() {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      calls.updatePreview += 1;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    updatePresetButtons(name) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      calls.updatePresetButtons.push(name);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  vm.createContext(context);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  vm.runInContext([
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractVarLiteral(html, 'CONFIGURATOR_PRODUCT_IDS'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractVarLiteral(html, 'ADDITIONAL_PRODUCT_IDS'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractVarLiteral(html, 'FULL_CART_IDS'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractVarLiteral(html, 'COMBO_PRESETS'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'clonePayload'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'readOdooLeadId'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'storeLeadSession'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'buildLeadUpdatePayload'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'getCartUpdateSignature'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'submitLeadUpdate'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'scheduleLeadCartUpdate'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    extractFunction(html, 'applyComboPreset'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'this.storeLeadSession = storeLeadSession;',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'this.scheduleLeadCartUpdate = scheduleLeadCartUpdate;',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'this.applyComboPreset = applyComboPreset;'
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ].join('\n'), context);

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
  async function runActiveTimers() {
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
    for (const timer of timers.values()) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (!timer.cleared) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        timer.cleared = true;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        timer.fn();
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
    await Promise.resolve();
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { calls, context, runActiveTimers, timers };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Construye una respuesta simulada con la forma exacta que espera la unidad bajo prueba.
function xmlResponse(valueXml) {
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
  return new Response(`<?xml version="1.0"?><methodResponse><params><param><value>${valueXml}</value></param></params></methodResponse>`, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    status: 200,
// Define un campo del fixture que representa una entrada o respuesta específica.
    headers: { 'Content-Type': 'text/xml' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function xmlArrayInts(ids) {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
  return `<array><data>${ids.map((id) => `<value><int>${id}</int></value>`).join('')}</data></array>`;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function xmlArrayStructTagIds(ids) {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
  return `<array><data><value><struct><member><name>tag_ids</name><value>${xmlArrayInts(ids)}</value></member></struct></value></data></array>`;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function createPatchD1(existing) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const calls = [];
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    calls,
// Imita la preparación de D1 y conserva la sentencia para decidir qué operación simular.
    prepare(sql) {
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return {
// Imita la vinculación posicional y conserva los valores para la ejecución posterior.
        bind(...args) {
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
          return {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
            async first() {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
              calls.push({ type: 'first', sql, args });
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
              return existing;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
            },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
            async run() {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
              calls.push({ type: 'run', sql, args });
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
              return { success: true };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
            }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
          };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function patchPayload(overrides = {}) {
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return {
// Define un campo del fixture que representa una entrada o respuesta específica.
    leadId: 'lead_patch_1',
// Define un campo del fixture que representa una entrada o respuesta específica.
    odooLeadId: 999,
// Define un campo del fixture que representa una entrada o respuesta específica.
    updatedAt: '2026-06-23T12:00:00.000Z',
// Define un campo del fixture que representa una entrada o respuesta específica.
    contact: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      name: 'Santi',
// Define un campo del fixture que representa una entrada o respuesta específica.
      preferredChannel: 'email',
// Define un campo del fixture que representa una entrada o respuesta específica.
      email: 'santi@example.com',
// Define un campo del fixture que representa una entrada o respuesta específica.
      whatsapp: '',
// Define un campo del fixture que representa una entrada o respuesta específica.
      consent: true
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Define un campo del fixture que representa una entrada o respuesta específica.
    diagnosis: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      totalScore: 10,
// Define un campo del fixture que representa una entrada o respuesta específica.
      recommendedTier: 'Setup Pro',
// Define un campo del fixture que representa una entrada o respuesta específica.
      recommendedPreset: 'pro'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Define un campo del fixture que representa una entrada o respuesta específica.
    configuration: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      recommendedProducts: ['soporte_notebook'],
// Define un campo del fixture que representa una entrada o respuesta específica.
      selectedProducts: ['silla', 'monitor_27'],
// Define un campo del fixture que representa una entrada o respuesta específica.
      selectedExtras: ['hub_usb_pro'],
// Define un campo del fixture que representa una entrada o respuesta específica.
      estimatedTotal: 321000,
// Define un campo del fixture que representa una entrada o respuesta específica.
      currency: 'ARS'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Copia el fixture base y sobrescribe únicamente lo necesario para esta variante.
    ...overrides
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Construye una petición local con encabezados y cuerpo controlados para el handler.
async function patchRequest(payload) {
// Construye una petición simulada; no sale del proceso de pruebas.
  return new Request('https://setupoficina.com.ar/api/leads', {
// Define un campo del fixture que representa una entrada o respuesta específica.
    method: 'PATCH',
// Define un campo del fixture que representa una entrada o respuesta específica.
    headers: { 'Content-Type': 'application/json' },
// Define un campo del fixture que representa una entrada o respuesta específica.
    body: JSON.stringify(payload)
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
createSubmitHarness.html = await readRepoFile('index.html');
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
createTimerHarness.html = createSubmitHarness.html;

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('POST exitoso inicial guarda sesion y muestra resultado', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = createSubmitHarness({
// Define un campo del fixture que representa una entrada o respuesta específica.
    submitLead: async () => ({ ok: true, data: { odoo: { id: 333 } } })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.pqSubmit({ preventDefault() {} });
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await flushPromises();

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.showResult, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.hide, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.pqLead.hidden, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.context.pqLeadSession.leadId, harness.payload.leadId);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.context.pqLeadSession.odooLeadId, 333);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.button.disabled, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.submitError.hidden, true);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('POST fallido o con excepcion no crea sesion falsa ni oculta el formulario', async () => {
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const submitLead of [
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    async () => ({ ok: false, error: 'HTTP 500' }),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    async () => { throw new Error('network'); }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ]) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const harness = createSubmitHarness({ submitLead });

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    harness.context.pqSubmit({ preventDefault() {} });
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
    await flushPromises();

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(harness.calls.showResult, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(harness.calls.hide, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(harness.pqLead.hidden, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(harness.context.pqLeadSession.leadId, '');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(harness.context.pqLeadSession.basePayload, null);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(harness.button.disabled, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(harness.submitError.hidden, false);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
    assert.match(harness.submitError.textContent, /No pudimos guardar/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('despues de POST exitoso, un cambio de carrito genera PATCH con el mismo lead', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = createTimerHarness();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const basePayload = patchPayload({ leadId: 'lead_cart_1', odooLeadId: null });

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.storeLeadSession(basePayload, { ok: true, data: { odoo: { id: 222 } } });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.cartState.silla = true;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.scheduleLeadCartUpdate('cart_change');
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await harness.runActiveTimers();

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.updateLead.length, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.updateLead[0].leadId, 'lead_cart_1');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.updateLead[0].odooLeadId, 222);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.updateLead[0].eventType, 'cart_change');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(harness.calls.updateLead[0].configuration.selectedProducts, ['silla']);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('varios clics rapidos conservan debounce de 1000 ms y disparan un solo PATCH', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = createTimerHarness();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const basePayload = patchPayload({ leadId: 'lead_debounce_1' });

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.storeLeadSession(basePayload, { ok: true, data: { odoo: { id: 222 } } });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.cartState.silla = true;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.scheduleLeadCartUpdate('cart_change');
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.cartState.monitor_27 = true;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.scheduleLeadCartUpdate('cart_change');
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.cartState.hub_usb_pro = true;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.scheduleLeadCartUpdate('cart_change');

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual([...harness.timers.values()].map((timer) => timer.delay), [1000, 1000, 1000]);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.clearTimeout.length, 3);

// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await harness.runActiveTimers();

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.updateLead.length, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(harness.calls.updateLead[0].configuration.selectedProducts.sort(), ['hub_usb_pro', 'monitor_27', 'silla']);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('presets Starter, Pro y Epic siguen llamando actualizacion', () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = createTimerHarness();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  harness.context.pqLeadSession.leadId = 'lead_presets_1';

// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const name of ['starter', 'pro', 'epic']) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    harness.context.applyComboPreset(name);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.updateTotal, 3);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.updatePreview, 3);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(harness.calls.updatePresetButtons, ['starter', 'pro', 'epic']);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual([...harness.timers.values()].map((timer) => timer.delay), [1000, 1000, 1000]);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('PATCH usa odoo_lead_id de D1, actualiza productos y total', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const mod = await importRepoModule('functions/api/leads.js');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const d1 = createPatchD1({ odoo_lead_id: 111 });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const objectResponses = [
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    xmlArrayInts([10]),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    xmlArrayInts([20]),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    xmlArrayInts([30]),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    xmlArrayStructTagIds([900, 44, 10]),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    xmlArrayInts([11]),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    xmlArrayInts([33]),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    xmlArrayInts([44]),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    '<boolean>1</boolean>'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  ];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const fetchCalls = [];
// Reserva estado mutable para registrar llamadas o simular una transición.
  let objectIndex = 0;

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  globalThis.fetch = async (url, options) => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    fetchCalls.push({ url, body: options.body });
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (String(url).includes('/xmlrpc/2/common')) return xmlResponse('<int>42</int>');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const response = objectResponses[objectIndex++];
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
    assert.ok(response, `Respuesta XML mock faltante para llamada ${objectIndex}`);
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return xmlResponse(response);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await mod.onRequestPatch({
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
    request: await patchRequest(patchPayload()),
// Define un campo del fixture que representa una entrada o respuesta específica.
    env: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      LEADS_DB: d1,
// Define un campo del fixture que representa una entrada o respuesta específica.
      ODOO_ENABLED: 'true',
// Define un campo del fixture que representa una entrada o respuesta específica.
      ODOO_URL: 'https://odoo.invalid',
// Define un campo del fixture que representa una entrada o respuesta específica.
      ODOO_DB: 'primoffice',
// Define un campo del fixture que representa una entrada o respuesta específica.
      ODOO_USERNAME: 'user@example.com',
// Define un campo del fixture que representa una entrada o respuesta específica.
      ODOO_API_KEY: 'secret'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const body = await response.json();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const updateCall = d1.calls.find((call) => call.type === 'run' && /UPDATE leads/.test(call.sql));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const writeCall = fetchCalls.find((call) => call.body.includes('<string>write</string>'));

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 200);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(body.ok, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(body.odoo.synced, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(body.odoo.id, 111);
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(writeCall.body.includes('<int>111</int>'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(!writeCall.body.includes('<int>999</int>'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(writeCall.body.includes('<name>expected_revenue</name>'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(writeCall.body.includes('<int>321000</int>'));
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(updateCall.args[7], 321000);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(updateCall.args[12], 111);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(JSON.parse(updateCall.args[9]), {
// Define un campo del fixture que representa una entrada o respuesta específica.
    selected: ['silla', 'monitor_27'],
// Define un campo del fixture que representa una entrada o respuesta específica.
    extras: ['hub_usb_pro'],
// Define un campo del fixture que representa una entrada o respuesta específica.
    recommended: ['soporte_notebook']
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('Odoo skipped conserva el ID existente', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const mod = await importRepoModule('functions/api/leads.js');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const d1 = createPatchD1({ odoo_lead_id: 555 });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  globalThis.fetch = async () => {
// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
    throw new Error('No deberia llamarse Odoo cuando esta desactivado');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await mod.onRequestPatch({
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
    request: await patchRequest(patchPayload({ odooLeadId: 999 })),
// Define un campo del fixture que representa una entrada o respuesta específica.
    env: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      LEADS_DB: d1,
// Define un campo del fixture que representa una entrada o respuesta específica.
      ODOO_ENABLED: 'false'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const body = await response.json();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const updateCall = d1.calls.find((call) => call.type === 'run' && /UPDATE leads/.test(call.sql));

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 200);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(body.odoo.id, 555);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(body.odoo.synced, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(updateCall.args[11], 'pending');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(updateCall.args[12], 555);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('DEMO_MODE false usa /api/leads para POST y PATCH', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const mod = await importRepoModule('js/services/leads-service.js');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const fetchCalls = [];
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  globalThis.localStorage = createStorage();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  globalThis.window = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    PrimOfficeConfig: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      DEMO_MODE: false,
// Define un campo del fixture que representa una entrada o respuesta específica.
      LEADS_API_URL: '/api/leads',
// Define un campo del fixture que representa una entrada o respuesta específica.
      LEADS_TIMEOUT_MS: 1000
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  globalThis.fetch = async (url, options) => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    fetchCalls.push({ url, method: options.method });
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
    return new Response(JSON.stringify({ ok: true }), {
// Define un campo del fixture que representa una entrada o respuesta específica.
      status: 200,
// Define un campo del fixture que representa una entrada o respuesta específica.
      headers: { 'Content-Type': 'application/json' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const post = await mod.submitLead(patchPayload());
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const patch = await mod.updateLead(patchPayload());

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(post.ok, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(patch.ok, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(fetchCalls, [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { url: '/api/leads', method: 'POST' },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { url: '/api/leads', method: 'PATCH' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  ]);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('DEMO_MODE true guarda local y no realiza fetch', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const mod = await importRepoModule('js/services/leads-service.js');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const storage = createStorage();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  globalThis.localStorage = storage;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  globalThis.window = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    PrimOfficeConfig: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      DEMO_MODE: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
      LEADS_API_URL: '/api/leads',
// Define un campo del fixture que representa una entrada o respuesta específica.
      LEADS_STORAGE_KEY: 'primoffice_test_leads'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  globalThis.fetch = async () => {
// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
    throw new Error('fetch no debe ejecutarse en DEMO_MODE');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const post = await mod.submitLead(patchPayload());
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const patch = await mod.updateLead(patchPayload());
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const stored = JSON.parse(storage.getItem('primoffice_test_leads'));

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(post.mode, 'demo');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(patch.mode, 'demo');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(stored.length, 2);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(stored[1].updateOnly, true);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});
