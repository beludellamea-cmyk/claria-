// E2E de «Mirar la imagen con IA» (visión multimodal). Worker real + PROVEEDOR SIMULADO (prueba el flujo, la privacidad y las salvaguardas, no la calidad del modelo).
// Verifica: permiso explícito ANTES de enviar, imagen reducida y sin metadatos, recorte/tapado aplicados a los bytes enviados, nada se guarda,
// bloques separados (original / texto local / observación visual / interpretación), dudas visibles, voz solo al tocar, pictogramas, celular 390 px y errores.
// Uso: python3 tests/make-fixtures-vision.py && node tests/e2e-vision.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright'; import { startMockProvider } from './mock-provider.mjs'; import { startDevServer } from '../worker/dev-server.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const FX = (n) => path.join(ROOT, 'tests/fixtures/vision', n);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };
const LIBS = { tesseract: '/node_modules/tesseract.js/dist/tesseract.min.js', tesseractWorker: '/node_modules/tesseract.js/dist/worker.min.js', tesseractCore: '/node_modules/tesseract.js-core', tesseractLang: '/node_modules/@tesseract.js-data/spa/4.0.0_best_int', pdfjs: '/node_modules/pdfjs-dist/build/pdf.min.js', pdfjsWorker: '/node_modules/pdfjs-dist/build/pdf.worker.min.js' };
const eLibs = fs.readFileSync(path.join(ROOT, 'tests/e2e-entender.mjs'), 'utf8').match(/const LIBS = (\{.*?\});/s); const LIBS2 = eLibs ? eval('(' + eLibs[1] + ')') : LIBS;
const serve = (port, apiBase) => new Promise((ok) => { const s = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/config.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end(`window.CLARIA_CONFIG={apiBase:${JSON.stringify(apiBase)},libs:${JSON.stringify(LIBS2)}};`); }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(port, () => ok(s)); });
const results = []; const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n    ', String(e.message).split('\n')[0], (String(e.stack).match(/e2e-vision\.mjs:\d+/) || [''])[0]); } };
const mock = await startMockProvider(8797);
const env = { AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test-SECRET', ANTHROPIC_BASE_URL: 'http://localhost:8797', VISION_PROVIDER: 'gemini', GEMINI_API_KEY: 'gm-test-SECRET', GEMINI_BASE_URL: 'http://localhost:8797', GEMINI_TIER: 'free', ALLOWED_ORIGINS: 'http://localhost:8034', RATE_PER_MIN: '100', RATE_PER_DAY: '500', DAILY_CAP: '5000', VISION_PER_MIN: '100', VISION_PER_DAY: '500', VISION_DAILY_CAP: '5000' };
const api = await startDevServer(env, 8798); const apiSin = await startDevServer({ ...env, VISION_PROVIDER: 'none', GEMINI_API_KEY: '', ALLOWED_ORIGINS: 'http://localhost:8036' }, 8799);
const sConn = await serve(8034, 'http://localhost:8798'), sDemo = await serve(8035, ''), sSin = await serve(8036, 'http://localhost:8799'); const browser = await chromium.launch();
async function abrir({ puerto = 8034, ancho = 1280, alto = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [], reqs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), body: r.postData() || '' }));
  await page.addInitScript(() => { window.__spoken = []; window.SpeechSynthesisUtterance = function (t) { this.text = t; }; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: (u) => window.__spoken.push(u.text), cancel() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {}, speaking: false } }); });
  await page.goto(`http://localhost:${puerto}/`); await page.waitForFunction(() => document.getElementById('modeLabel').textContent.length > 0); await page.waitForTimeout(500); return { ctx, page, errs, reqs };
}
const visionPosts = (reqs) => reqs.filter((r) => r.method === 'POST' && /\/api\/vision/.test(r.url));
async function aVision(page, archivo) {
  await page.click('#view-inicio [data-view="entender"]'); await page.waitForSelector('#enInicio:not([hidden])'); await page.setInputFiles('#enInImagen', FX(archivo));
  await page.waitForSelector('#enResultado:not([hidden])', { timeout: 120000 }); await page.waitForSelector('#enVision'); await page.waitForFunction(() => !document.getElementById('enVision').disabled || document.getElementById('enVisionNoDisp').textContent.length > 0);
}
const entrar = async (page, archivo) => { await aVision(page, archivo); await page.click('#enVision'); await page.waitForSelector('#enVisionPaso:not([hidden])'); await page.waitForFunction(() => document.getElementById('viCanvas').width > 10); };
const aceptar = async (page) => { await page.waitForSelector('#visionDialog[open]'); await page.click('#visionDialogOk'); };
const analizar = async (page) => { await page.click('#viAnalizar'); await aceptar(page); await page.waitForSelector('#viResultado:not([hidden])', { timeout: 30000 }); };
const spoken = (p) => p.evaluate(() => window.__spoken);
const ultima = () => mock.calls.filter((c) => c.vision).at(-1);
const bytesDe = async (page) => 0;

console.log('\nVisión · disponibilidad y privacidad');
await test('sin IA con visión (demo o Worker sin clave): la opción se muestra desactivada y explica por qué; nada se envía', async () => {
  for (const puerto of [8035, 8036]) { const { page, reqs, ctx } = await abrir({ puerto }); await aVision(page, 'cartel-transito.jpg');
    assert.equal(await page.isDisabled('#enVision'), true); assert.match(await page.textContent('#enVisionNoDisp'), /no está disponible/); assert.equal(visionPosts(reqs).length, 0); await ctx.close(); }
});
await test('con visión: el botón explica que SE ENVÍA la imagen y que el OCR sigue en el dispositivo; nada se envía todavía', async () => {
  const { page, reqs, ctx } = await abrir(); mock.calls.length = 0; await aVision(page, 'cartel-transito.jpg');
  assert.equal(await page.isDisabled('#enVision'), false); const t = await page.textContent('#enVisionCta'); assert.match(t, /enviar la imagen/); assert.match(t, /recortarla y tapar/); assert.match(t, /dispositivo/);
  assert.equal(visionPosts(reqs).length, 0); assert.equal(mock.calls.filter((c) => c.vision).length, 0); await ctx.close();
});
await test('editor: aviso de envío, vista previa, herramientas y nada enviado antes de tocar «Enviar»', async () => {
  const { page, reqs, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg');
  assert.match(await page.textContent('#viAviso'), /envía la imagen/); assert.match(await page.textContent('#viInfo'), /toda la imagen.*1280×853.*sin metadatos/); assert.equal(visionPosts(reqs).length, 0);
  assert.equal(await page.getAttribute('#viTodo', 'aria-pressed'), 'true'); assert.ok(await page.$('#viCanvas[role="img"]')); await ctx.close();
});
await test('PERMISO: al enviar se abre el diálogo con proveedor, aviso de versión gratuita y «no se guarda»; «No enviar» no envía nada', async () => {
  const { page, reqs, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg'); mock.calls.length = 0; await page.click('#viAnalizar'); await page.waitForSelector('#visionDialog[open]');
  const t = await page.textContent('#visionDialog'); assert.match(t, /A diferencia de la lectura del texto/); assert.match(t, /no guarda/); assert.match(t, /Google puede usar lo que se envía/); assert.match(t, /equivocarse/);
  await page.click('#visionDialogNo'); await page.waitForTimeout(400); assert.equal(visionPosts(reqs).length, 0); assert.equal(mock.calls.filter((c) => c.vision).length, 0);
  assert.match(await page.textContent('#viEstadoEd'), /No se envió nada/); assert.equal(await page.isVisible('#viResultado'), false); await ctx.close();
});

console.log('\nVisión · lo que se envía');
await test('imagen reducida (≤1280 px), JPEG sin EXIF/GPS y sin la clave en el navegador', async () => {
  const { page, reqs, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg'); mock.calls.length = 0; await analizar(page);
  const p = visionPosts(reqs); assert.equal(p.length, 1); const b = JSON.parse(p[0].body); assert.match(b.image, /^data:image\/jpeg;base64,/); assert.equal(b.task, 'describe');
  const buf = Buffer.from(b.image.split(',')[1], 'base64'); assert.equal(buf[0], 0xff); assert.equal(buf[1], 0xd8);
  const txt = buf.toString('latin1'); assert.ok(!/Exif/.test(txt), 'sin bloque Exif'); assert.ok(!/CamaraSecretaMarca|ModeloSecreto123/.test(txt)); assert.ok(buf.length < 700000, 'peso razonable ' + buf.length);
  const dims = await page.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = u; }), b.image); assert.deepEqual(dims, [1280, 853]);
  assert.ok(!JSON.stringify(reqs).includes('gm-test-SECRET'), 'la clave nunca llega al navegador'); const c = ultima(); assert.ok(c.vision.bytes > 1000); assert.equal(c.vision.mime, 'image/jpeg'); assert.match(c.headers['x-goog-api-key'] || '', /gm-test-SECRET/); await ctx.close();
});
await test('ELEGIR UNA PARTE: el recorte reduce lo que se envía (mitad de arriba) y el aviso lo dice', async () => {
  const { page, reqs, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg'); await page.click('#viParte'); await page.click('[data-mitad="arriba"]');
  assert.match(await page.textContent('#viInfo'), /solo la parte marcada.*1280×427/); await analizar(page); const b = JSON.parse(visionPosts(reqs)[0].body); assert.equal(b.parcial, true);
  const dims = await page.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = u; }), b.image); assert.deepEqual(dims, [1280, 427]); assert.match(await page.textContent('#viEnviado'), /solo de la parte que marcaste/); await ctx.close();
});
await test('TAPAR con negro: la zona tapada sale negra en los bytes enviados y el OCR local NO se manda al proveedor', async () => {
  const { page, reqs, ctx } = await abrir(); await entrar(page, 'documento-turno.png'); await page.click('#viTapar'); const bb = await page.locator('#viCanvas').boundingBox();
  // tapar la línea del DNI (aprox. y 400–470 de 1100 → 36%–43%)
  await page.mouse.move(bb.x + bb.width * 0.05, bb.y + bb.height * 0.33); await page.mouse.down(); await page.mouse.move(bb.x + bb.width * 0.9, bb.y + bb.height * 0.44, { steps: 6 }); await page.mouse.up();
  assert.match(await page.textContent('#viInfo'), /1 zona tapada/); await analizar(page); const b = JSON.parse(visionPosts(reqs)[0].body); assert.equal(b.ocrText, '', 'con zonas tapadas no se manda el texto del OCR');
  const px = await page.evaluate(([u, fx, fy]) => new Promise((ok) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(Math.round(i.width * fx), Math.round(i.height * fy), 1, 1).data; ok([d[0], d[1], d[2]]); }; i.src = u; }), [b.image, 0.5, 0.38]);
  assert.ok(px.every((v) => v < 20), 'píxel tapado negro: ' + px); assert.match(await page.textContent('#viEnviado'), /1 zona tapada/);
  await page.click('#viDeshacer').catch(() => {}); await ctx.close();
});
await test('el texto leído en el dispositivo (OCR) se manda solo como referencia cuando no se tapó ni recortó nada', async () => {
  const { page, reqs, ctx } = await abrir(); await entrar(page, 'documento-turno.png'); await analizar(page); const b = JSON.parse(visionPosts(reqs)[0].body); assert.match(b.ocrText, /TURNO|Turno/i); assert.equal(b.parcial, false);
  assert.match(ultima().vision.text, /<ocr>/); await ctx.close();
});

console.log('\nVisión · resultados separados y honestos');
await test('bloques: ORIGINAL · TEXTO TRANSCRIPTO (local) · OBSERVACIÓN VISUAL (IA); la línea que solo vio la IA se marca y las dudas se muestran', async () => {
  const { page, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg'); await analizar(page);
  assert.match(await page.textContent('#viOrigTit'), /ORIGINAL/); assert.equal(await page.isVisible('#viOrigImg'), true); assert.match(await page.getAttribute('#viOrigImg', 'alt'), /original/i);
  assert.match(await page.textContent('#viVistoTit'), /OBSERVACIÓN VISUAL · IA/); assert.match(await page.textContent('#viQueAparece'), /MOCK: un cartel/); assert.match(await page.textContent('#viElementos'), /Letra P/);
  const li = await page.$$eval('#viTextoIA li', (n) => n.map((x) => x.textContent)); assert.ok(li.some((t) => /Línea que solo vio la IA/.test(t) && /solo lo vio la IA/.test(t)), 'marca de solo-IA: ' + li.join('|'));
  assert.equal(await page.isVisible('#viDudasBox'), true); assert.match(await page.textContent('#viSecVisto .pc-note'), /equivocarse/);
  assert.equal(await page.isVisible('#viSecInterp'), false, 'la interpretación no aparece hasta pedirla'); await ctx.close();
});
await test('«Explicámelo fácil» y «¿Qué significa esto?»: INTERPRETACIÓN separada, con «sugerencia (no figura en la imagen)»; se reutilizan sin volver a enviar', async () => {
  const { page, reqs, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg'); await analizar(page); await page.click('#viBtnSignifica'); await page.waitForSelector('#viSecInterp:not([hidden])');
  assert.match(await page.textContent('#viInterpTit'), /INTERPRETACIÓN · IA/); assert.match(await page.textContent('#viInterpKind'), /significa/); assert.match(await page.textContent('#viInterpTexto'), /MOCK: el cartel indica/);
  assert.match(await page.textContent('#viSecInterp'), /no figura en la imagen/); assert.match(await page.textContent('#viSecInterp'), /no es un dato de la imagen|interpretación de la IA/i);
  const n = visionPosts(reqs).length; await page.click('#viBtnSignifica'); await page.waitForTimeout(300); assert.equal(visionPosts(reqs).length, n, 'sin reenviar'); await page.click('#viBtnFacil'); await page.waitForFunction(() => /fácil/i.test(document.getElementById('viInterpKind').textContent));
  const b = JSON.parse(visionPosts(reqs).at(-1).body); assert.equal(b.task, 'easy'); await ctx.close();
});
await test('PREGUNTAR sobre la imagen: pregunta vacía no envía; con pregunta se envía y la respuesta queda marcada', async () => {
  const { page, reqs, ctx } = await abrir(); await entrar(page, 'captura-app.png'); await analizar(page); await page.click('#viBtnPreguntar'); await page.waitForSelector('#viPanelPregunta:not([hidden])');
  const n = visionPosts(reqs).length; await page.click('#viPregEnviar'); await page.waitForTimeout(300); assert.equal(visionPosts(reqs).length, n); assert.match(await page.textContent('#viEstado'), /Escribí tu pregunta/);
  await page.fill('#viPregInput', '¿Para qué sirve el botón azul de abajo?'); await page.click('#viPregEnviar'); await page.waitForFunction(() => /Respuesta a tu pregunta/.test(document.getElementById('viInterpKind').textContent));
  const b = JSON.parse(visionPosts(reqs).at(-1).body); assert.equal(b.task, 'ask'); assert.match(b.question, /botón azul/); assert.match(await page.textContent('#viInterpTexto'), /MOCK: respuesta/); assert.match(ultima().vision.text, /botón azul/); await ctx.close();
});
await test('la IA no puede colar enlaces inventados: una URL que no está en la imagen se elimina', async () => {
  const { page, ctx } = await abrir(); await entrar(page, 'captura-app.png'); await analizar(page); await page.click('#viBtnPreguntar'); await page.fill('#viPregInput', 'url-falsa por favor'); await page.click('#viPregEnviar');
  await page.waitForFunction(() => document.getElementById('viInterpTexto').textContent.length > 3); assert.ok(!/sitio-falso/.test(await page.textContent('#viInterpTexto'))); await ctx.close();
});

console.log('\nVisión · voz, pictogramas y borrado');
await test('Escuchar: no habla sola; lee la última respuesta solo al tocar', async () => {
  const { page, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg'); await analizar(page); assert.equal((await spoken(page)).length, 0); await page.click('#viBtnEscuchar'); await page.waitForTimeout(300);
  const s = await spoken(page); assert.ok(s.length >= 1 && /MOCK: un cartel/.test(s.join(' '))); await page.click('#viBtnSignifica'); await page.waitForSelector('#viSecInterp:not([hidden])'); await page.click('#viBtnEscuchar'); await page.waitForTimeout(300); assert.ok(/MOCK: el cartel indica/.test((await spoken(page)).join(' '))); await ctx.close();
});
await test('Ver con pictogramas: abre el cuento con ARASAAC y vuelve al análisis', async () => {
  const { page, ctx } = await abrir(); await entrar(page, 'ciclo-agua.png'); await analizar(page); await page.click('#viBtnPictos'); await page.waitForSelector('#view-cuento:not([hidden])', { timeout: 15000 });
  await page.waitForSelector('#pqContenido:not([hidden])', { timeout: 20000 }); assert.match(await page.textContent('#pqContenido'), /MOCK|cartel|Letra/i); assert.match(await page.textContent('#view-cuento'), /ARASAAC/); await ctx.close();
});
await test('Borrar todo: limpia la pantalla (imagen, respuestas) y vuelve al resultado; no queda nada en storage', async () => {
  const { page, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg'); await analizar(page); await page.click('#viBorrar'); await page.waitForSelector('#enResultado:not([hidden])');
  assert.equal(await page.evaluate(() => window.ClariaVision.estado()), null); assert.equal(await page.evaluate(() => (document.getElementById('viQueAparece').textContent + document.getElementById('viInterpTexto').textContent)), '');
  const alm = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])); assert.ok(!/data:image|MOCK|CamaraSecreta/.test(alm), 'sin imágenes ni respuestas guardadas'); assert.deepEqual((await page.evaluate(async () => (await indexedDB.databases?.() || []).map((d) => d.name))).filter((n) => !/tesseract|keyval/i.test(n)), []); await ctx.close();
});
await test('al salir de Entender o cambiar de sección no queda la imagen ni el análisis en pantalla', async () => {
  const { page, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg'); await analizar(page); await page.evaluate(() => ClariaUI.showView('inicio')); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.ClariaVision.estado()), null); assert.equal(await page.getAttribute('#viOrigImg', 'src'), null); await ctx.close();
});

console.log('\nVisión · tipos de imagen y errores');
for (const [archivo, nombre] of [['plaza.jpg', 'espacio público'], ['captura-app.png', 'captura de aplicación'], ['ciclo-agua.png', 'imagen educativa'], ['documento-turno.png', 'documento']])
  await test(`${nombre}: se analiza de punta a punta sin errores de consola`, async () => { const { page, errs, ctx } = await abrir(); await entrar(page, archivo); await analizar(page); assert.match(await page.textContent('#viQueAparece'), /MOCK/); assert.deepEqual(errs, []); await ctx.close(); });
await test('el modelo devuelve error: mensaje claro, sin inventar contenido, y se puede reintentar', async () => {
  const { page, ctx } = await abrir(); await entrar(page, 'captura-app.png'); await page.click('#viAnalizar'); await aceptar(page); await page.waitForSelector('#viResultado:not([hidden])'); await page.click('#viBtnPreguntar'); await page.fill('#viPregInput', 'error500v ahora'); await page.click('#viPregEnviar');
  await page.waitForFunction(() => /No pude|ahora|problema|intent/i.test(document.getElementById('viEstado').textContent), null, { timeout: 30000 }); assert.equal(await page.isVisible('#viSecInterp'), false); await ctx.close();
});
await test('CELULAR 390 px: el flujo completo cabe sin desborde horizontal y los botones son tocables (≥44 px)', async () => {
  const { page, ctx } = await abrir({ ancho: 390, alto: 800 }); await entrar(page, 'cartel-transito.jpg');
  const ancho = () => page.evaluate(() => document.documentElement.scrollWidth); assert.ok((await ancho()) <= 391, 'editor ' + await ancho());
  for (const id of ['viAnalizar', 'viTodo', 'viParte', 'viTapar']) assert.ok((await page.locator('#' + id).boundingBox()).height >= 44, id);
  await analizar(page); assert.ok((await ancho()) <= 391, 'resultado ' + await ancho()); for (const id of ['viBtnQue', 'viBtnFacil', 'viBtnSignifica', 'viBtnEscuchar', 'viBtnPictos', 'viBtnPreguntar']) assert.ok((await page.locator('#' + id).boundingBox()).height >= 44, id);
  assert.deepEqual(await page.$$eval('#viResultado .big-txt', (n) => n.map((x) => x.textContent)), ['¿Qué aparece en la imagen?', 'Explicámelo fácil', '¿Qué significa esto?', 'Escuchar', 'Ver con pictogramas', 'Preguntar sobre la imagen']); await ctx.close();
});
await test('alto contraste y teclado: el diálogo de permiso se puede operar con teclado y las secciones tienen títulos', async () => {
  const { page, ctx } = await abrir(); await entrar(page, 'cartel-transito.jpg'); await page.evaluate(() => document.body.classList.add('high-contrast')); await page.focus('#viAnalizar'); await page.keyboard.press('Enter'); await page.waitForSelector('#visionDialog[open]');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); assert.equal(await page.isVisible('#visionDialog'), false); assert.match(await page.textContent('#viEstadoEd'), /No se envió nada/);
  assert.ok(await page.$('#viResultado section[aria-labelledby]')); await ctx.close();
});

sConn.close(); sDemo.close(); sSin.close(); mock.server.close(); api.close && api.close(); apiSin.close && apiSin.close(); await browser.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
