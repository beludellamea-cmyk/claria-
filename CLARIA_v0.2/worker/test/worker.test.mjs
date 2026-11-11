import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { parseModelJson, scrubUrls, shapeChat } from '../src/index.js';
import { _resetForTests } from '../src/ratelimit.js';
import Privacy from '../../privacy.js';

const ORIGIN = 'https://demo.github.io';
const baseEnv = (over = {}) => ({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test-SECRET', ALLOWED_ORIGINS: ORIGIN, RATE_PER_MIN: '100', RATE_PER_DAY: '100', DAILY_CAP: '1000', ...over });
const post = (path, body, headers = {}) => new Request('http://x' + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, 'cf-connecting-ip': '1.2.3.4', ...headers }, body: JSON.stringify(body) });
const anthropicReply = (text) => async (url, init) => { anthropicReply.last = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 }); };
test.beforeEach(() => _resetForTests());

test('health: configurado vs sin clave', async () => {
  let r = await worker.fetch(new Request('http://x/api/health', { headers: { origin: ORIGIN } }), baseEnv());
  let j = await r.json(); assert.equal(j.mode, 'connected'); assert.equal(j.storesChats, false);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  r = await worker.fetch(new Request('http://x/api/health'), baseEnv({ ANTHROPIC_API_KEY: '' }));
  j = await r.json(); assert.equal(j.mode, 'demo'); assert.equal(j.ok, false);
});

test('origen no autorizado → 403 y preflight bloqueado', async () => {
  const r = await worker.fetch(post('/api/chat', { message: 'hola' }, { origin: 'https://malo.example' }), baseEnv());
  assert.equal(r.status, 403);
  const p = await worker.fetch(new Request('http://x/api/chat', { method: 'OPTIONS', headers: { origin: 'https://malo.example' } }), baseEnv());
  assert.equal(p.status, 403);
});

test('explain: redacta datos personales ANTES de llamar al proveedor y la clave solo va en el encabezado', async () => {
  const env = baseEnv({ __fetch: anthropicReply('{"resultado":"Es un aviso de vencimiento.","puntos_clave":["Vence pronto"],"avisos":["No dice el monto"]}') });
  const r = await worker.fetch(post('/api/explain', { task: 'plain', source: 'file_ocr', text: 'Estimado titular, su DNI 12345678 y correo ana@correo.com. Su cuenta vence el viernes. Clave: perro' }), env);
  const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.generatedBy, 'ia');
  assert.equal(j.resultado, 'Es un aviso de vencimiento.'); assert.deepEqual(j.avisos, ['No dice el monto']);
  assert.ok(j.redactions >= 2);
  const sent = JSON.stringify(anthropicReply.last.body);
  assert.ok(!sent.includes('12345678') && !sent.includes('ana@correo.com') && !sent.includes('perro'), 'datos personales no deben llegar al proveedor');
  assert.ok(sent.includes('<documento>') && sent.includes('OCR'));
  assert.equal(anthropicReply.last.init.headers['x-api-key'], 'sk-test-SECRET');
  assert.ok(!JSON.stringify(j).includes('SECRET'));
});

test('explain: validaciones (corto, tarea inválida, larguísimo, ask sin pregunta)', async () => {
  const env = baseEnv({ __fetch: anthropicReply('{}') });
  for (const [body, status] of [[{ task: 'plain', text: 'corto' }, 400], [{ task: 'otra', text: 'x'.repeat(50) }, 400], [{ task: 'plain', text: 'x'.repeat(8001) }, 413], [{ task: 'ask', text: 'x'.repeat(50) }, 400]]) {
    assert.equal((await worker.fetch(post('/api/explain', body), env)).status, status);
  }
});

test('explain: salida no JSON → se muestra tal cual con aviso; salida vacía → error', async () => {
  let env = baseEnv({ __fetch: anthropicReply('Esto es texto suelto sin formato.') });
  let j = await (await worker.fetch(post('/api/explain', { task: 'summary', text: 'Un texto de prueba suficientemente largo.' }), env)).json();
  assert.equal(j.resultado, 'Esto es texto suelto sin formato.'); assert.ok(j.avisos[0].includes('formato'));
  env = baseEnv({ __fetch: anthropicReply('   ') });
  const r = await worker.fetch(post('/api/explain', { task: 'summary', text: 'Un texto de prueba suficientemente largo.' }), env);
  assert.equal(r.status, 502); assert.equal((await r.json()).error, 'bad_model_output');
});

test('chat: enlaces inventados se eliminan; ids de fuente se validan contra la base', async () => {
  const env = baseEnv({ __fetch: anthropicReply(JSON.stringify({ respuesta: 'Pedí turno en https://www.inventado.gob.ar/turno y mirá https://www.argentina.gob.ar/node/41622.', fuentes: ['dni', 'noexiste'] })) });
  const j = await (await worker.fetch(post('/api/chat', { message: '¿Cómo renuevo el DNI?', history: [] }), env)).json();
  assert.ok(!j.respuesta.includes('inventado')); assert.ok(j.respuesta.includes('[enlace no verificado]'));
  assert.ok(j.respuesta.includes('https://www.argentina.gob.ar/node/41622'));
  assert.deepEqual(j.fuentes.map((f) => f.id), ['dni']); assert.equal(j.fuentes[0].consultado, '2026-11-10');
  assert.ok(j.avisos.length === 1);
});

test('chat: el prompt contiene la base curada; historial y mensaje se redactan en modo estricto', async () => {
  const env = baseEnv({ __fetch: anthropicReply('{"respuesta":"ok","fuentes":[]}') });
  await worker.fetch(post('/api/chat', { message: 'mi dni es 30123456', history: [{ role: 'assistant', content: 'Hola' }, { role: 'user', content: 'cuil 20-12345678-3' }] }), env);
  const b = anthropicReply.last.body;
  assert.ok(b.system.includes('FUENTES CURADAS') && b.system.includes('mitramite.renaper.gob.ar'));
  assert.equal(b.messages[0].role, 'user'); // normalizado: empieza con user
  assert.ok(!JSON.stringify(b.messages).includes('30123456') && !JSON.stringify(b.messages).includes('12345678'));
});

test('límites: por minuto y tope diario global', async () => {
  const env = baseEnv({ RATE_PER_MIN: '2', __fetch: anthropicReply('{"respuesta":"ok","fuentes":[]}') });
  const call = () => worker.fetch(post('/api/chat', { message: 'hola' }), env);
  assert.equal((await call()).status, 200); assert.equal((await call()).status, 200);
  const r = await call(); assert.equal(r.status, 429); assert.equal((await r.json()).error, 'rate_minute'); assert.ok(r.headers.get('retry-after'));
  _resetForTests();
  const env2 = baseEnv({ DAILY_CAP: '1', __fetch: anthropicReply('{"respuesta":"ok","fuentes":[]}') });
  assert.equal((await worker.fetch(post('/api/chat', { message: 'hola' }), env2)).status, 200);
  assert.equal((await (await worker.fetch(post('/api/chat', { message: 'hola' }, { 'cf-connecting-ip': '9.9.9.9' }), env2)).json()).error, 'daily_cap');
});

test('errores del proveedor no filtran detalles', async () => {
  const mk = (status) => baseEnv({ __fetch: async () => new Response('{"error":"detalle interno sk-test-SECRET"}', { status }) });
  for (const [st, code, http] of [[429, 'provider_busy', 429], [401, 'provider_auth', 502], [500, 'provider_error', 502]]) {
    const r = await worker.fetch(post('/api/chat', { message: 'hola' }), mk(st)); const j = await r.json();
    assert.equal(r.status, http); assert.equal(j.error, code); assert.ok(!JSON.stringify(j).includes('SECRET'));
  }
});

test('gemini: mapea roles, JSON mode y clave en encabezado', async () => {
  let seen;
  const env = baseEnv({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g-key', AI_MODEL: 'modelo-x', __fetch: async (u, i) => { seen = { u, i, b: JSON.parse(i.body) }; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"respuesta":"hola","fuentes":[]}' }] } }] }), { status: 200 }); } });
  const j = await (await worker.fetch(post('/api/chat', { message: 'hola', history: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }), env)).json();
  assert.equal(j.respuesta, 'hola'); assert.ok(seen.u.includes('modelo-x:generateContent') && !seen.u.includes('g-key'));
  assert.equal(seen.i.headers['x-goog-api-key'], 'g-key'); assert.equal(seen.b.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(seen.b.contents.map((c) => c.role), ['user', 'model', 'user']);
});

test('workers-ai: usa el binding AI (respuesta como texto o ya parseada)', async () => {
  for (const out of [{ response: '{"respuesta":"desde workers ai","fuentes":[]}' }, { response: { respuesta: 'desde workers ai', fuentes: [] } }]) {
    const env = { AI_PROVIDER: 'workers-ai', ALLOWED_ORIGINS: ORIGIN, AI: { run: async () => out } };
    _resetForTests();
    const j = await (await worker.fetch(post('/api/chat', { message: 'hola' }), env)).json();
    assert.equal(j.respuesta, 'desde workers ai'); assert.equal(j.provider, 'Cloudflare Workers AI');
  }
  const bad = { AI_PROVIDER: 'workers-ai', ALLOWED_ORIGINS: ORIGIN, AI: { run: async () => { throw new Error('5035: upgrade to paid'); } } };
  assert.equal((await (await worker.fetch(post('/api/chat', { message: 'hola' }), bad)).json()).error, 'provider_model_unavailable');
});

test('sin proveedor configurado → 503 not_configured (no inventa respuestas)', async () => {
  const r = await worker.fetch(post('/api/chat', { message: 'hola' }), { ALLOWED_ORIGINS: ORIGIN });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'not_configured');
});

test('utilidades: parseModelJson / scrubUrls / privacidad', () => {
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 }); assert.equal(parseModelJson('nada'), null);
  assert.equal(scrubUrls('ver https://sitio-falso.example/x.').removed, 1); assert.equal(scrubUrls('ver https://mi.argentina.gob.ar/.').removed, 0);
  assert.equal(shapeChat('{"respuesta":"x","fuentes":["dni","cud"]}').fuentes.length, 2);
  assert.equal(Privacy.redact('Pagué $1.500.000').count, 0);
});
