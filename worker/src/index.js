import { redact } from './privacy.js';
import { buildExplain, buildChat, buildVision, VISION_TASKS, LIMITS, TRAMITE_IDS, TRAMITES, allowedUrls } from './prompts.js';
import { PROVIDERS, VISION, ProviderError, providerName, PROVIDER_LABEL, visionProviderName, visionConfigured, visionPrivacyNote, DEFAULT_VISION_MODEL } from './providers.js';
import { checkLimits } from './ratelimit.js';
import { citaEnTexto } from './entender-core.js';

const SOURCES = new Set(['typed', 'file_txt', 'file_pdf', 'file_ocr']);
const TASK_IDS = new Set(['plain', 'easy', 'summary', 'ask', 'actions', 'extract']);

function allowedOrigin(env, origin) {
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return origin && list.includes(origin) ? origin : null;
}
function corsHeaders(env, origin) {
  const h = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', vary: 'Origin' };
  const ok = allowedOrigin(env, origin);
  if (ok) { h['access-control-allow-origin'] = ok; h['access-control-allow-methods'] = 'GET,POST,OPTIONS'; h['access-control-allow-headers'] = 'content-type'; h['access-control-max-age'] = '600'; }
  return h;
}
const json = (env, origin, status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(env, origin), ...extra } });
const fail = (env, origin, status, code, message, extra) => json(env, origin, status, { ok: false, error: code, message }, extra);

const MESSAGES = {
  bad_request: 'La consulta no tiene el formato esperado.',
  text_too_long: 'El texto es demasiado largo para esta versión de prueba.',
  rate_minute: 'Hiciste varias consultas seguidas. Esperá un minuto y probá de nuevo.',
  rate_day: 'Llegaste al límite diario de consultas de esta demostración. Podés seguir usando el lector y las guías sin IA.',
  daily_cap: 'La demostración alcanzó su límite diario de uso de IA. Probá mañana; el resto de CLARIA sigue disponible.',
  not_configured: 'La IA todavía no está configurada en el servidor.',
  provider_busy: 'El servicio de IA está ocupado. Probá de nuevo en unos minutos.',
  provider_auth: 'El servicio de IA rechazó las credenciales del servidor. Avisale a quien administra CLARIA.',
  provider_model_unavailable: 'El modelo de IA elegido no está disponible en este plan. Avisale a quien administra CLARIA.',
  provider_timeout: 'La IA tardó demasiado en responder. Probá de nuevo.',
  provider_unreachable: 'No se pudo comunicar con el servicio de IA.',
  provider_error: 'El servicio de IA tuvo un problema. Probá de nuevo.',
  bad_model_output: 'La IA devolvió una respuesta que CLARIA no pudo interpretar. Probá de nuevo.',
  forbidden_origin: 'Origen no autorizado.',
  bad_image: 'La imagen no tiene un formato válido (JPG, PNG o WEBP).',
  image_too_big: 'La imagen es demasiado pesada. CLARIA la reduce antes de enviarla; probá con un recorte o con otra foto.',
  vision_blocked: 'El servicio de IA no pudo analizar esta imagen. Probá con otra.'
};

// Extrae un objeto JSON de la salida del modelo (tolera ```json y texto alrededor). Devuelve null si no hay.
export function parseModelJson(raw) {
  const s = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { const o = JSON.parse(s.slice(a, b + 1)); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}
const strList = (v, max, len) => (Array.isArray(v) ? v : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => x.trim().slice(0, len));

// Elimina cualquier URL que no esté en la lista curada (anti-enlaces inventados).
export function scrubUrls(text, allowed = allowedUrls()) {
  let removed = 0;
  const out = String(text).replace(/https?:\/\/[^\s)\]»"'<>]+/gi, (u) => {
    const clean = u.replace(/[.,;:!?]+$/, ''); const tail = u.slice(clean.length);
    if (allowed.has(clean)) return u;
    removed += 1; return '[enlace no verificado]' + tail;
  });
  return { text: out, removed };
}

// «¿Qué hago ahora?»: separa lo que dice el documento de lo que sugiere la IA. Sin respuesta válida no inventa nada.
export function shapeActions(raw) {
  const o = parseModelJson(raw);
  if (!o) throw new ProviderError(502, 'bad_model_output');
  const dice = strList(o.el_documento_dice, 8, 300), sugerencias = strList(o.sugerencias, 5, 300);
  const resultado = typeof o.resultado === 'string' ? o.resultado.trim().slice(0, 400) : '';
  if (!resultado && !dice.length && !sugerencias.length) throw new ProviderError(502, 'bad_model_output');
  return { resultado: resultado || (dice.length ? 'Esto es lo que el documento te pide.' : 'El documento no indica acciones.'), el_documento_dice: dice, sugerencias, puntos_clave: [], avisos: strList(o.avisos, 6, 300) };
}

// «Entender»: datos estructurados del documento. Cada ítem debe traer una cita que EXISTA en el texto; lo que no se pueda comprobar se descarta.
export function shapeExtract(raw, ctx = {}) {
  const o = parseModelJson(raw);
  if (!o) throw new ProviderError(502, 'bad_model_output');
  let descartados = 0; const referencia = String(ctx.texto || '');
  const items = (v) => (Array.isArray(v) ? v : []).slice(0, 10).flatMap((x) => {
    const cita = x && typeof x.cita === 'string' ? x.cita.trim().slice(0, 200) : '';
    if (!cita || !citaEnTexto(cita, referencia)) { descartados += 1; return []; }
    return [{ cita, detalle: typeof x.detalle === 'string' ? x.detalle.trim().slice(0, 300) : '' }];
  });
  const out = { tipo: typeof o.tipo === 'string' ? o.tipo.trim().slice(0, 60) : '', resultado: typeof o.resultado === 'string' ? o.resultado.trim().slice(0, 500) : '',
    fechas: items(o.fechas), horarios: items(o.horarios), lugares: items(o.lugares), requisitos: items(o.requisitos), acciones: items(o.acciones), ilegible: strList(o.ilegible, 6, 200), puntos_clave: [] };
  const avisos = strList(o.avisos, 6, 300); if (descartados) avisos.push(`CLARIA descartó ${descartados} dato(s) de la IA porque no aparecen escritos en el documento.`);
  if (!out.resultado && !['fechas', 'horarios', 'lugares', 'requisitos', 'acciones'].some((k) => out[k].length)) throw new ProviderError(502, 'bad_model_output');
  return { ...out, resultado: out.resultado || 'Estos son los datos que figuran en el documento.', descartados, avisos };
}

export function shapeExplain(raw) {
  const o = parseModelJson(raw);
  if (!o || typeof o.resultado !== 'string' || !o.resultado.trim()) {
    const plain = String(raw || '').trim();
    if (!plain) throw new ProviderError(502, 'bad_model_output');
    return { resultado: plain.slice(0, 3000), puntos_clave: [], avisos: ['La IA no respondió en el formato esperado; el texto se muestra tal como llegó.'] };
  }
  return { resultado: o.resultado.trim().slice(0, 3000), puntos_clave: strList(o.puntos_clave, 6, 300), avisos: strList(o.avisos, 6, 300) };
}

// Visión: normaliza y limita la respuesta. Sin contenido útil no inventa nada.
export function shapeVision(raw, ctx = {}) {
  const o = parseModelJson(raw);
  if (!o) throw new ProviderError(502, 'bad_model_output');
  const task = ctx.task; const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const visible = strList(o.texto_visible, 20, 300);
  // Un enlace solo puede figurar en la interpretación si está escrito en la imagen.
  const permitidas = new Set(visible.flatMap((t) => t.match(/https?:\/\/[^\s)\]»"'<>]+/gi) || []).map((u) => u.replace(/[.,;:!?]+$/, '')));
  const limpio = (t) => scrubUrls(t, permitidas).text;
  const out = { tipo: str(o.tipo, 60), que_aparece: limpio(str(o.que_aparece, 1200)), elementos: strList(o.elementos, 10, 250).map(limpio), texto_visible: visible,
    resultado: limpio(str(o.resultado, 1800)), que_puede_hacer: strList(o.que_puede_hacer, 5, 250).map(limpio), dudas: strList(o.dudas, 6, 250),
    legibilidad: ['buena', 'parcial', 'mala'].includes(o.legibilidad) ? o.legibilidad : '' };
  const tiene = task === 'describe' ? out.que_aparece || out.elementos.length || out.texto_visible.length : out.resultado;
  if (!tiene) throw new ProviderError(502, 'bad_model_output');
  return out;
}

export function shapeChat(raw) {
  const o = parseModelJson(raw);
  let respuesta = o && typeof o.respuesta === 'string' ? o.respuesta : String(raw || '');
  respuesta = respuesta.trim();
  if (!respuesta) throw new ProviderError(502, 'bad_model_output');
  const scrubbed = scrubUrls(respuesta.slice(0, 1500));
  const ids = o && Array.isArray(o.fuentes) ? [...new Set(o.fuentes.filter((x) => TRAMITE_IDS.has(x)))] : [];
  const fuentes = ids.map((id) => { const t = TRAMITES.tramites.find((x) => x.id === id); return { id, titulo: t.fuente.titulo, url: t.fuente.url, consultado: t.fuente.consultado }; });
  return { respuesta: scrubbed.text, fuentes, avisos: scrubbed.removed ? ['Se quitó un enlace que CLARIA no pudo verificar.'] : [] };
}

function visionInfo(env) {
  const n = visionProviderName(env); const enabled = Boolean(n && visionConfigured(env, n));
  return { enabled, provider: enabled ? PROVIDER_LABEL[n] : null, note: enabled ? visionPrivacyNote(env, n) : '', maxImageBytes: IMG_MAX_B64 };
}
const IMG_MAX_B64 = 1_400_000; // ~1 MB de imagen: el navegador ya la redujo; esto es un tope de seguridad

// Comprueba que sea realmente una imagen (tipo declarado + primeros bytes) y devuelve { mime, data }.
export function parseImage(dataUrl, max = IMG_MAX_B64) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl || ''));
  if (!m) return { error: 'bad_image' };
  if (m[2].length > max) return { error: 'image_too_big' };
  let head; try { head = atob(m[2].slice(0, 24)); } catch { return { error: 'bad_image' }; }
  const ok = m[1] === 'image/jpeg' ? head.startsWith('\xff\xd8\xff') : m[1] === 'image/png' ? head.startsWith('\x89PNG') : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP';
  return ok ? { mime: m[1], data: m[2] } : { error: 'bad_image' };
}

async function readJson(request, max = 24000) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) return null;
  const raw = await request.text();
  if (raw.length > max) return 'too_big';
  try { return JSON.parse(raw); } catch { return null; }
}

export default {
  async fetch(request, env, ctx) {
    const started = Date.now();
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const done = (res, route) => { console.log(JSON.stringify({ route, status: res.status, ms: Date.now() - started })); return res; }; // nunca se registran contenidos

    if (request.method === 'OPTIONS') {
      return allowedOrigin(env, origin) ? new Response(null, { status: 204, headers: corsHeaders(env, origin) }) : new Response(null, { status: 403 });
    }
    if (origin && !allowedOrigin(env, origin)) return done(fail(env, origin, 403, 'forbidden_origin', MESSAGES.forbidden_origin), url.pathname);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      const prov = providerName(env);
      const configured = prov === 'workers-ai' ? Boolean(env.AI) : prov === 'anthropic' ? Boolean(env.ANTHROPIC_API_KEY) : prov === 'gemini' ? Boolean(env.GEMINI_API_KEY) : false;
      return done(json(env, origin, 200, { ok: configured, mode: configured ? 'connected' : 'demo', provider: configured ? PROVIDER_LABEL[prov] : null, storesChats: false,
        limits: { perMinute: Number(env.RATE_PER_MIN) || 6, perDay: Number(env.RATE_PER_DAY) || 40 }, maxTextChars: LIMITS.text, vision: visionInfo(env) }), '/api/health');
    }

    if (request.method === 'POST' && url.pathname === '/api/vision') return handleVision(request, env, origin, done);

    if (request.method !== 'POST' || !['/api/explain', '/api/chat'].includes(url.pathname)) {
      return done(fail(env, origin, 404, 'not_found', 'Ruta no encontrada.'), url.pathname);
    }

    const prov = providerName(env);
    if (!prov) return done(fail(env, origin, 503, 'not_configured', MESSAGES.not_configured), url.pathname);

    const body = await readJson(request);
    if (body === 'too_big') return done(fail(env, origin, 413, 'text_too_long', MESSAGES.text_too_long), url.pathname);
    if (!body || typeof body !== 'object') return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), url.pathname);

    let prompt, maxTokens, shape, shapeCtx = {}, redactions = 0;
    if (url.pathname === '/api/explain') {
      const { task, text, question, source } = body;
      if (!TASK_IDS.has(task) || typeof text !== 'string' || text.trim().length < 12) return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), url.pathname);
      if (text.length > LIMITS.text) return done(fail(env, origin, 413, 'text_too_long', MESSAGES.text_too_long), url.pathname);
      if (task === 'ask' && (typeof question !== 'string' || question.trim().length < 3)) return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), url.pathname);
      const t = redact(text), q = redact(String(question || '').slice(0, LIMITS.question));
      redactions = t.count + q.count;
      prompt = buildExplain({ task, text: t.text.trim(), question: q.text.trim(), source: SOURCES.has(source) ? source : 'typed' });
      maxTokens = task === 'extract' ? 1300 : 900; shapeCtx = { texto: t.text }; shape = task === 'actions' ? shapeActions : task === 'extract' ? shapeExtract : shapeExplain;
    } else {
      const { message, history } = body;
      if (typeof message !== 'string' || !message.trim() || message.length > LIMITS.chatMsg) return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), url.pathname);
      const hist = (Array.isArray(history) ? history : []).slice(-LIMITS.history)
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => { const r = redact(m.content.slice(0, 600), { strict: true }); redactions += r.count; return { role: m.role, content: r.text }; });
      const cur = redact(message, { strict: true }); redactions += cur.count;
      prompt = buildChat({ message: cur.text.trim(), history: hist });
      maxTokens = 500; shape = shapeChat;
    }

    const lim = await checkLimits(env, request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '');
    if (!lim.ok) return done(fail(env, origin, 429, lim.code, MESSAGES[lim.code], { 'retry-after': String(lim.retryAfter) }), url.pathname);

    try {
      const { text } = await PROVIDERS[prov]({ ...prompt, env, maxTokens, fetchImpl: env.__fetch || fetch });
      const data = shape(text, shapeCtx);
      return done(json(env, origin, 200, { ok: true, ...data, redactions, generatedBy: 'ia', provider: PROVIDER_LABEL[prov] }), url.pathname);
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'provider_error';
      const status = e instanceof ProviderError ? e.status : 502;
      return done(fail(env, origin, status, code, MESSAGES[code] || MESSAGES.provider_error), url.pathname);
    }
  }
};

// POST /api/vision  { image: "data:image/jpeg;base64,…", task: describe|easy|meaning|ask, question?, ocrText?, parcial? }
// La imagen NO se guarda ni se registra: viaja en memoria hasta el proveedor y se descarta.
async function handleVision(request, env, origin, done) {
  const route = '/api/vision';
  const prov = visionProviderName(env);
  if (!prov || !visionConfigured(env, prov)) return done(fail(env, origin, 503, 'not_configured', MESSAGES.not_configured), route);
  const body = await readJson(request, IMG_MAX_B64 + 6000);
  if (body === 'too_big') return done(fail(env, origin, 413, 'image_too_big', MESSAGES.image_too_big), route);
  if (!body || typeof body !== 'object') return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), route);
  const { task, question, ocrText, parcial } = body;
  if (!VISION_TASKS.has(task)) return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), route);
  if (task === 'ask' && (typeof question !== 'string' || question.trim().length < 3)) return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), route);
  const img = parseImage(body.image);
  if (img.error) return done(fail(env, origin, img.error === 'image_too_big' ? 413 : 400, img.error, MESSAGES[img.error]), route);
  const q = redact(String(question || '').slice(0, LIMITS.question)), o = redact(typeof ocrText === 'string' ? ocrText.slice(0, 3000) : '');
  const lim = await checkLimits(env, request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '', Date.now(), 'v');
  if (!lim.ok) return done(fail(env, origin, 429, lim.code, MESSAGES[lim.code], { 'retry-after': String(lim.retryAfter) }), route);
  try {
    const { system, text } = buildVision({ task, question: q.text.trim(), ocrText: o.text.trim(), parcial: parcial === true });
    const { text: raw } = await VISION[prov]({ system, text, image: img, env, maxTokens: task === 'describe' ? 1500 : 900, fetchImpl: env.__fetch || fetch });
    const data = shapeVision(raw, { task });
    return done(json(env, origin, 200, { ok: true, task, ...data, redactions: q.count + o.count, generatedBy: 'ia', provider: PROVIDER_LABEL[prov], model: env.VISION_MODEL || DEFAULT_VISION_MODEL[prov] }), route);
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : 'provider_error'; const status = e instanceof ProviderError ? e.status : 502;
    return done(fail(env, origin, status, code, MESSAGES[code] || MESSAGES.provider_error), route);
  }
}
