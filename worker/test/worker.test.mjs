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

test('explain/actions: separa lo que dice el documento de las sugerencias y no inventa nada', async () => {
  const env = baseEnv({ __fetch: anthropicReply('{"resultado":"Aviso de reunión escolar.","el_documento_dice":["Ir a la biblioteca el martes 24 a las 18:00","Llevar el cuaderno de comunicaciones"],"sugerencias":["Confirmar con la escuela si no podés ir"],"avisos":["La hora puede estar mal leída"]}') });
  const r = await worker.fetch(post('/api/explain', { task: 'actions', source: 'file_ocr', text: 'Estimadas familias: el martes 24 de noviembre habrá una reunión a las 18:00 en la biblioteca escolar. Por favor, asistir con el cuaderno de comunicaciones.' }), env);
  const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, true);
  assert.deepEqual(j.el_documento_dice, ['Ir a la biblioteca el martes 24 a las 18:00', 'Llevar el cuaderno de comunicaciones']);
  assert.deepEqual(j.sugerencias, ['Confirmar con la escuela si no podés ir']);
  assert.deepEqual(j.avisos, ['La hora puede estar mal leída']);
  const sys = anthropicReply.last.body.system;
  assert.ok(/PROHIBIDO inventar autorizaciones, pagos, fechas/.test(sys), 'el prompt debe prohibir inventar autorizaciones, pagos y fechas');
  assert.ok(/OCR/.test(sys) && /el_documento_dice/.test(sys));
});

test('explain/actions: respuesta del modelo sin formato válido → error, no se inventa una respuesta', async () => {
  const env = baseEnv({ __fetch: anthropicReply('Tenés que ir mañana y pagar $500.') });
  const r = await worker.fetch(post('/api/explain', { task: 'actions', source: 'typed', text: 'Texto cualquiera con más de doce caracteres para probar.' }), env);
  const j = await r.json();
  assert.equal(r.status, 502); assert.equal(j.ok, false); assert.equal(j.error, 'bad_model_output');
});

test('explain/extract: conserva solo datos con cita escrita en el documento y descarta lo inventado', async () => {
  const texto = 'Estimadas familias: el viernes 21 de noviembre a las 9:30 hs hay reunión en el aula de 3° grado. Deben traer fotocopia del DNI.';
  const modelo = JSON.stringify({ tipo: 'nota escolar', resultado: 'Aviso de una reunión.', fechas: [{ cita: 'el viernes 21 de noviembre', detalle: 'día de la reunión' }, { cita: 'el lunes 24 de noviembre', detalle: 'inventada' }], horarios: [{ cita: 'a las 9:30 hs', detalle: 'hora' }, { detalle: 'sin cita' }], lugares: [{ cita: 'el aula de 3° grado', detalle: 'lugar' }, { cita: 'la biblioteca', detalle: 'inventada' }], requisitos: [{ cita: 'fotocopia del DNI', detalle: 'hay que traerla' }], acciones: [], ilegible: [], avisos: [] });
  const env = baseEnv({ __fetch: anthropicReply(modelo) });
  const r = await worker.fetch(post('/api/explain', { task: 'extract', source: 'file_ocr', text: texto }), env); const j = await r.json();
  assert.equal(r.status, 200); assert.deepEqual(j.fechas.map((x) => x.cita), ['el viernes 21 de noviembre']); assert.deepEqual(j.horarios.map((x) => x.cita), ['a las 9:30 hs']); assert.deepEqual(j.lugares.map((x) => x.cita), ['el aula de 3° grado']); assert.equal(j.requisitos.length, 1);
  assert.equal(j.descartados, 3); assert.ok(j.avisos.some((a) => /descartó 3/.test(a))); assert.match(anthropicReply.last.body.system, /EXACTO/); assert.match(anthropicReply.last.body.system, /\[ilegible\]/);
});
test('explain/extract: sin JSON válido → error, no se inventa nada', async () => {
  const env = baseEnv({ __fetch: anthropicReply('Claro, acá van los datos: fecha lunes.') });
  const r = await worker.fetch(post('/api/explain', { task: 'extract', source: 'typed', text: 'Texto cualquiera con más de doce caracteres para probar.' }), env); assert.equal(r.status, 502); assert.equal((await r.json()).error, 'bad_model_output');
});

// ───────── Visión (/api/vision) ─────────
const jpg = (n = 200) => 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 7)]).toString('base64');
const geminiEnv = (over = {}) => ({ AI_PROVIDER: 'workers-ai', VISION_PROVIDER: 'gemini', GEMINI_API_KEY: 'gk-test-SECRET', ALLOWED_ORIGINS: ORIGIN, VISION_PER_MIN: '100', VISION_PER_DAY: '1000', VISION_DAILY_CAP: '10000', ...over });
const geminiReply = (obj) => async (url, init) => { geminiReply.last = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }] }), { status: 200 }); };
const DESCRIBE = { tipo: 'cartel', que_aparece: 'Un cartel de prohibido estacionar.', elementos: ['Letra P tachada'], texto_visible: ['PROHIBIDO ESTACIONAR'], dudas: ['Una parte borrosa'], legibilidad: 'parcial' };

test('visión · health informa si está activa, el proveedor y qué hace con la imagen (gratuita vs de pago)', async () => {
  const h = async (env) => (await (await worker.fetch(new Request('http://x/api/health', { headers: { origin: ORIGIN } }), env)).json()).vision;
  let v = await h(geminiEnv()); assert.equal(v.enabled, true); assert.match(v.provider, /Gemini/); assert.match(v.note, /gratuita.*mejorar sus productos/); assert.ok(v.maxImageBytes > 100000);
  v = await h(geminiEnv({ GEMINI_TIER: 'paid' })); assert.match(v.note, /no usa lo enviado/);
  v = await h(geminiEnv({ GEMINI_API_KEY: '' })); assert.equal(v.enabled, false); assert.equal(v.note, '');
  v = await h({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', ALLOWED_ORIGINS: ORIGIN }); assert.equal(v.enabled, true); assert.match(v.provider, /Claude/);
});
test('visión · describe: manda la imagen en inlineData, la clave solo en el encabezado, y devuelve bloques separados sin repetir la imagen', async () => {
  const env = geminiEnv({ __fetch: geminiReply(DESCRIBE) }); const img = jpg();
  const r = await worker.fetch(post('/api/vision', { image: img, task: 'describe', ocrText: 'PROHIBIDO ESTACIONAR' }), env); assert.equal(r.status, 200); const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.tipo, 'cartel'); assert.deepEqual(j.texto_visible, ['PROHIBIDO ESTACIONAR']); assert.deepEqual(j.dudas, ['Una parte borrosa']); assert.equal(j.legibilidad, 'parcial'); assert.match(j.provider, /Gemini/);
  const sent = geminiReply.last; assert.equal(sent.body.contents[0].parts[0].inlineData.mimeType, 'image/jpeg'); assert.equal(sent.body.contents[0].parts[0].inlineData.data, img.split(',')[1]);
  assert.equal(sent.init.headers['x-goog-api-key'], 'gk-test-SECRET'); assert.ok(!sent.url.includes('gk-test')); assert.ok(!JSON.stringify(sent.body).includes('gk-test')); assert.ok(!JSON.stringify(j).includes(img.slice(30, 80)), 'no devuelve la imagen');
  assert.match(sent.body.systemInstruction.parts[0].text, /NO identifiques personas/); assert.match(sent.body.systemInstruction.parts[0].text, /NO hagas diagnósticos/); assert.match(sent.body.contents[0].parts[1].text, /<ocr>/);
});
test('visión · tareas easy / meaning / ask usan su propio formato; ask exige pregunta', async () => {
  for (const [task, obj, campo] of [['easy', { resultado: 'Es un cartel.\nNo estaciones.', dudas: [] }, 'resultado'], ['meaning', { resultado: 'Prohíbe estacionar.', que_puede_hacer: ['Buscar otro lugar'], dudas: [] }, 'que_puede_hacer'], ['ask', { resultado: 'En la imagen no se ve la hora.', dudas: [] }, 'resultado']]) {
    const r = await worker.fetch(post('/api/vision', { image: jpg(), task, question: '¿Hasta qué hora?' }), geminiEnv({ __fetch: geminiReply(obj) })); assert.equal(r.status, 200, task); const j = await r.json(); assert.ok(j[campo].length, task);
  }
  const r = await worker.fetch(post('/api/vision', { image: jpg(), task: 'ask' }), geminiEnv({ __fetch: geminiReply(DESCRIBE) })); assert.equal(r.status, 400);
});
test('visión · rechaza lo que no es una imagen válida o es demasiado grande, y no llama al proveedor', async () => {
  let llamadas = 0; const env = geminiEnv({ __fetch: async () => { llamadas++; return new Response('{}'); } });
  const casos = [['http://malo.example/a.jpg', 400], ['data:image/gif;base64,R0lGODlh', 400], ['data:image/jpeg;base64,' + Buffer.from('esto no es una imagen jpeg').toString('base64'), 400], ['data:image/png;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(50)]).toString('base64'), 400], [jpg(1_200_000), 413]];
  for (const [image, st] of casos) { const r = await worker.fetch(post('/api/vision', { image, task: 'describe' }), env); assert.equal(r.status, st, image.slice(0, 40)); }
  assert.equal((await worker.fetch(post('/api/vision', { image: jpg(), task: 'hackear' }), env)).status, 400); assert.equal((await worker.fetch(post('/api/vision', { image: jpg(), task: 'describe' }, { origin: 'https://malo.example' }), env)).status, 403);
  assert.equal(llamadas, 0);
});
test('visión · sin proveedor/clave de visión → 503 y no se envía nada', async () => {
  const r = await worker.fetch(post('/api/vision', { image: jpg(), task: 'describe' }), geminiEnv({ GEMINI_API_KEY: '' })); assert.equal(r.status, 503);
});
test('visión · redacta datos personales de la pregunta y del OCR antes de enviarlos', async () => {
  const env = geminiEnv({ __fetch: geminiReply({ resultado: 'ok', dudas: [] }) });
  const r = await worker.fetch(post('/api/vision', { image: jpg(), task: 'ask', question: 'Mi DNI 12345678, ¿qué dice?', ocrText: 'Contacto ana@correo.com' }), env); const j = await r.json(); assert.ok(j.redactions >= 2);
  const enviado = JSON.stringify(geminiReply.last.body); assert.ok(!/12345678|ana@correo/.test(enviado));
});
test('visión · límites propios y más estrictos que los del texto', async () => {
  const env = geminiEnv({ __fetch: geminiReply(DESCRIBE), VISION_PER_MIN: '2', RATE_PER_MIN: '100' }); const st = [];
  for (let i = 0; i < 3; i++) st.push((await worker.fetch(post('/api/vision', { image: jpg(), task: 'describe' }), env)).status); assert.deepEqual(st, [200, 200, 429]);
  assert.equal((await worker.fetch(post('/api/explain', { task: 'plain', text: 'Un texto de prueba para explicar.' }, {}), { ...env, AI_PROVIDER: 'gemini' })).status, 200, 'el texto no se ve afectado');
});
test('visión · respuesta del modelo: no se cuelan enlaces inventados; sin contenido útil no se inventa nada; el bloqueo de seguridad se informa', async () => {
  let r = await worker.fetch(post('/api/vision', { image: jpg(), task: 'meaning' }), geminiEnv({ __fetch: geminiReply({ resultado: 'Mirá https://sitio-falso.example/x y https://escrito.example/ok', que_puede_hacer: [], dudas: [] }) }));
  r = await r.json(); assert.ok(!r.resultado.includes('sitio-falso')); assert.match(r.resultado, /enlace no verificado/);
  const ok = await (await worker.fetch(post('/api/vision', { image: jpg(), task: 'describe' }), geminiEnv({ __fetch: geminiReply({ ...DESCRIBE, texto_visible: ['Web: https://escrito.example/ok'], que_aparece: 'Un cartel con https://escrito.example/ok' }) }))).json(); assert.match(ok.que_aparece, /escrito\.example\/ok/);
  assert.equal((await worker.fetch(post('/api/vision', { image: jpg(), task: 'describe' }), geminiEnv({ __fetch: geminiReply('esto no es json') }))).status, 502);
  assert.equal((await worker.fetch(post('/api/vision', { image: jpg(), task: 'describe' }), geminiEnv({ __fetch: geminiReply({ tipo: 'x' }) }))).status, 502);
  const bloq = await worker.fetch(post('/api/vision', { image: jpg(), task: 'describe' }), geminiEnv({ __fetch: async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), { status: 200 }) })); assert.equal(bloq.status, 502); assert.equal((await bloq.json()).error, 'vision_blocked');
});
test('visión · adaptador Anthropic y Workers AI mandan la imagen en su formato', async () => {
  let cuerpo; const env = { AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', ALLOWED_ORIGINS: ORIGIN, __fetch: async (u, i) => { cuerpo = JSON.parse(i.body); return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(DESCRIBE) }] })); } };
  assert.equal((await worker.fetch(post('/api/vision', { image: jpg(), task: 'describe' }), env)).status, 200); assert.equal(cuerpo.messages[0].content[0].type, 'image'); assert.equal(cuerpo.messages[0].content[0].source.media_type, 'image/jpeg');
  let args; const ai = { run: async (m, a) => { args = [m, a]; return { response: JSON.stringify(DESCRIBE) }; } };
  assert.equal((await worker.fetch(post('/api/vision', { image: jpg(), task: 'describe' }), { AI_PROVIDER: 'workers-ai', AI: ai, ALLOWED_ORIGINS: ORIGIN })).status, 200); assert.equal(args[0], '@cf/google/gemma-3-12b-it'); assert.match(args[1].messages[1].content[1].image_url.url, /^data:image\/jpeg;base64,/);
});
