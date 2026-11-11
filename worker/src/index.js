import { redact } from './privacy.js';
import { buildExplain, buildChat, LIMITS, TRAMITE_IDS, TRAMITES, allowedUrls } from './prompts.js';
import { PROVIDERS, ProviderError, providerName, PROVIDER_LABEL } from './providers.js';
import { checkLimits } from './ratelimit.js';

const SOURCES = new Set(['typed', 'file_txt', 'file_pdf', 'file_ocr']);
const TASK_IDS = new Set(['plain', 'easy', 'summary', 'ask']);

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
  forbidden_origin: 'Origen no autorizado.'
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

export function shapeExplain(raw) {
  const o = parseModelJson(raw);
  if (!o || typeof o.resultado !== 'string' || !o.resultado.trim()) {
    const plain = String(raw || '').trim();
    if (!plain) throw new ProviderError(502, 'bad_model_output');
    return { resultado: plain.slice(0, 3000), puntos_clave: [], avisos: ['La IA no respondió en el formato esperado; el texto se muestra tal como llegó.'] };
  }
  return { resultado: o.resultado.trim().slice(0, 3000), puntos_clave: strList(o.puntos_clave, 6, 300), avisos: strList(o.avisos, 6, 300) };
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
        limits: { perMinute: Number(env.RATE_PER_MIN) || 6, perDay: Number(env.RATE_PER_DAY) || 40 }, maxTextChars: LIMITS.text }), '/api/health');
    }

    if (request.method !== 'POST' || !['/api/explain', '/api/chat'].includes(url.pathname)) {
      return done(fail(env, origin, 404, 'not_found', 'Ruta no encontrada.'), url.pathname);
    }

    const prov = providerName(env);
    if (!prov) return done(fail(env, origin, 503, 'not_configured', MESSAGES.not_configured), url.pathname);

    const body = await readJson(request);
    if (body === 'too_big') return done(fail(env, origin, 413, 'text_too_long', MESSAGES.text_too_long), url.pathname);
    if (!body || typeof body !== 'object') return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), url.pathname);

    let prompt, maxTokens, shape, redactions = 0;
    if (url.pathname === '/api/explain') {
      const { task, text, question, source } = body;
      if (!TASK_IDS.has(task) || typeof text !== 'string' || text.trim().length < 12) return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), url.pathname);
      if (text.length > LIMITS.text) return done(fail(env, origin, 413, 'text_too_long', MESSAGES.text_too_long), url.pathname);
      if (task === 'ask' && (typeof question !== 'string' || question.trim().length < 3)) return done(fail(env, origin, 400, 'bad_request', MESSAGES.bad_request), url.pathname);
      const t = redact(text), q = redact(String(question || '').slice(0, LIMITS.question));
      redactions = t.count + q.count;
      prompt = buildExplain({ task, text: t.text.trim(), question: q.text.trim(), source: SOURCES.has(source) ? source : 'typed' });
      maxTokens = 900; shape = shapeExplain;
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
      const data = shape(text);
      return done(json(env, origin, 200, { ok: true, ...data, redactions, generatedBy: 'ia', provider: PROVIDER_LABEL[prov] }), url.pathname);
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'provider_error';
      const status = e instanceof ProviderError ? e.status : 502;
      return done(fail(env, origin, status, code, MESSAGES[code] || MESSAGES.provider_error), url.pathname);
    }
  }
};
