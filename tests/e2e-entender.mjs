// E2E de «Entender»: foto / imagen / documento → qué dice, lo importante, IA con permiso, voz, pictogramas y respuesta.
// OCR REAL: Tesseract.js (español) y pdf.js corren en el navegador de prueba sobre documentos distintos (nota escolar, WhatsApp, cartel, formulario,
// PDF con texto, PDF escaneado, foto borrosa, imagen sin texto). Las librerías se sirven desde node_modules (npm i --no-save tesseract.js@5.1.1 @tesseract.js-data/spa pdfjs-dist@3.11.174).
// La IA es el Worker real de CLARIA apuntando a un PROVEEDOR SIMULADO (tests/mock-provider.mjs): prueba el flujo, la privacidad y las salvaguardas, no la calidad del modelo.
// Uso: node tests/e2e-entender.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright'; import { startMockProvider } from './mock-provider.mjs'; import { startDevServer } from '../worker/dev-server.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const FX = (n) => path.join(ROOT, 'tests/fixtures/entender', n);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };
const LIBS = { tesseract: '/node_modules/tesseract.js/dist/tesseract.min.js', tesseractWorker: '/node_modules/tesseract.js/dist/worker.min.js', tesseractCore: '/node_modules/tesseract.js-core', tesseractLang: '/node_modules/@tesseract.js-data/spa/4.0.0_best_int', pdfjs: '/node_modules/pdfjs-dist/build/pdf.min.js', pdfjsWorker: '/node_modules/pdfjs-dist/build/pdf.worker.min.js' };
const serve = (port, apiBase) => new Promise((ok) => { const s = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/config.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end(`window.CLARIA_CONFIG={apiBase:${JSON.stringify(apiBase)},libs:${JSON.stringify(LIBS)}};`); }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(port, () => ok(s)); });
const results = []; const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n    ', String(e.message).split('\n')[0], (String(e.stack).match(/e2e-entender\.mjs:\d+/) || [''])[0]); } };
const mock = await startMockProvider(8795);
const api = await startDevServer({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test-SECRET', ANTHROPIC_BASE_URL: 'http://localhost:8795', ALLOWED_ORIGINS: 'http://localhost:8032', RATE_PER_MIN: '100', RATE_PER_DAY: '500', DAILY_CAP: '5000' }, 8796);
const sDemo = await serve(8033, ''), sConn = await serve(8032, 'http://localhost:8796'); const browser = await chromium.launch();
async function abrir({ conectado = false, ancho = 1280, alto = 900, sw = 'block' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, serviceWorkers: sw }); const page = await ctx.newPage(); const errs = [], reqs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), body: r.postData() || '' }));
  await page.addInitScript(() => { window.__spoken = []; window.SpeechSynthesisUtterance = function (t) { this.text = t; }; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() {}, pause() {}, resume() {}, speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onstart && u.onstart(), 0); setTimeout(() => u.onend && u.onend(), 5); } } }); });
  await page.goto(`http://localhost:${conectado ? 8032 : 8033}/`); await page.waitForFunction(() => document.getElementById('modeLabel').textContent.length > 0); await page.waitForTimeout(300); return { ctx, page, errs, reqs };
}
const aEntender = async (page) => { await page.click('#view-inicio [data-view="entender"]'); await page.waitForSelector('#enInicio:not([hidden])'); };
async function leer(page, entrada, archivo) { await page.setInputFiles(entrada, typeof archivo === 'string' ? FX(archivo) : archivo); await page.waitForSelector('#enResultado:not([hidden])', { timeout: 90000 }); }
const texto = (page, sel) => page.textContent(sel); const spoken = (p) => p.evaluate(() => window.__spoken); const est = (p) => p.evaluate(() => window.ClariaEntender.estado());
const importante = (page) => page.$$eval('#enImportanteLista .en-grupo li b', (n) => n.map((x) => x.textContent));
const consentir = async (page) => { await page.waitForSelector('#consentDialog[open]'); await page.click('#consentForm button[value="accept"]'); };

console.log('\nEntender · inicio y privacidad');
await test('inicio: Sacar foto / Subir imagen / Subir documento, privacidad clara y nada se envía ni se pide cámara/ubicación', async () => {
  const { page, reqs, ctx } = await abrir(); await aEntender(page);
  assert.deepEqual(await page.$$eval('#enInicio .big-choices .big-txt', (n) => n.map((x) => x.textContent)), ['Sacar foto', 'Subir imagen', 'Subir documento']);
  assert.match(await texto(page, '#enInicio .en-privacidad'), /nunca se envían/); assert.equal(await page.getAttribute('#enInFoto', 'capture'), 'environment'); assert.match(await page.getAttribute('#enInDoc', 'accept'), /pdf/);
  assert.deepEqual(reqs.filter((r) => !r.url.startsWith('http://localhost:8033') && !r.url.startsWith('data:')), []); assert.equal(reqs.filter((r) => r.method === 'POST').length, 0); await ctx.close();
});
await test('el tipo de archivo no admitido (Word) se explica con claridad', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await page.setInputFiles('#enInDoc', { name: 'carta.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') });
  await page.waitForFunction(() => /Word.*PDF/.test(document.getElementById('enEstadoInicio').textContent)); assert.equal(await page.isVisible('#enResultado'), false); await ctx.close();
});

console.log('\nEntender · documentos reales (OCR real)');
let nota;
await test('NOTA ESCOLAR (foto): lee el texto real, conserva el original y marca fechas, horarios, dinero, lugar y requisitos', async () => {
  const { page, errs, reqs, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInImagen', 'nota-escolar.jpg');
  const e = await est(page); nota = e.texto; assert.match(e.texto, /reuni[oó]n de padres/i); assert.ok(['buena', 'dudosa'].includes(e.nivel), e.nivel);
  const imp = await importante(page); for (const x of ['viernes 21 de noviembre', 'a las 9:30 hs', '$ 2500']) assert.ok(imp.some((i) => i.replace(/\s+/g, ' ') === x || i.includes(x.replace('$ ', '$ '))), `${x} ∈ ${imp.join(' | ')}`);
  assert.ok(imp.some((i) => /19\/11/.test(i)), 'fecha límite'); assert.ok((await texto(page, '#enImportanteLista')).match(/fotocopia/i), 'requisito');
  assert.equal(await page.isVisible('#enOriginal img'), true); assert.match(await page.getAttribute('#enOriginal img', 'alt'), /Imagen original/); assert.match(await texto(page, '#enOrigTit'), /ORIGINAL/); assert.match(await texto(page, '#enImpTit'), /SIN IA/);
  assert.equal(reqs.filter((r) => r.method === 'POST').length, 0, 'sin envíos'); assert.deepEqual(errs, []); await ctx.close();
});
await test('CAPTURA DE WHATSAPP (png): «lunes 24», hora y qué llevar', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInImagen', 'whatsapp.png'); const e = await est(page); assert.match(e.texto, /acto/i); const t = await texto(page, '#enImportanteLista');
  assert.match(t, /lunes 24/); assert.match(t, /8:15/); assert.match(t, /Llevar vianda/i); await ctx.close();
});
await test('CARTEL (foto con fondo de color): fecha, horario y lugar', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInFoto', 'cartel.jpg'); const t = await texto(page, '#enImportanteLista');
  assert.match(t, /29 de noviembre/i); assert.match(t, /9 ?a 13 hs/); assert.match(t, /Mitre 450/); await ctx.close();
});
await test('FORMULARIO (png): fecha de entrega, horario de atención y requisito de firma', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInImagen', 'formulario.png'); const t = await texto(page, '#enImportanteLista');
  assert.match(t, /5 de diciembre/); assert.match(t, /8 a 12 hs/); assert.match(t, /firma/i); await ctx.close();
});
await test('PDF CON TEXTO: se lee directo (sin OCR), con miniaturas de las páginas originales', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInDoc', 'comunicado.pdf'); const e = await est(page);
  assert.equal(e.tipo, 'pdf'); assert.equal(e.nivel, 'buena'); assert.match(await texto(page, '#enCalidad'), /directamente/); assert.match(e.texto, /bolsones/); const t = await texto(page, '#enImportanteLista'); assert.match(t, /2 de diciembre/); assert.match(t, /10:00 hs/); assert.match(t, /San Mart[ií]n 1200/); assert.match(t, /28\/11/);
  assert.equal(await page.locator('#enOriginal img').count(), 1); assert.match(await page.getAttribute('#enOriginal img', 'alt'), /Página 1/); await ctx.close();
});
await test('PDF ESCANEADO (solo imagen): lo reconoce con OCR y lo avisa', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInDoc', 'comunicado-escaneado.pdf'); const e = await est(page);
  assert.equal(e.tipo, 'pdf'); assert.match(await texto(page, '#enCalidad'), /escaneada/); assert.match(e.texto, /bolsones/i); assert.match(await texto(page, '#enImportanteLista'), /2 de diciembre/); await ctx.close();
});

console.log('\nEntender · lo que NO se puede leer');
await test('FOTO BORROSA Y OSCURA: avisa, pide otra foto, no muestra datos inventados y no habilita la IA', async () => {
  const { page, ctx } = await abrir({ conectado: true }); await aEntender(page); await leer(page, '#enInImagen', 'borrosa.jpg'); const e = await est(page);
  assert.ok(['mala', 'sin_texto'].includes(e.nivel), e.nivel); assert.match(await texto(page, '#enCalidad'), /otra foto/i); assert.equal(await page.isVisible('#enReintentar'), true); assert.equal(await page.isVisible('#enImportante'), false);
  assert.equal(await page.isDisabled('#enFacil'), true); assert.equal(await page.isDisabled('#enQueHacer'), true); assert.match(await texto(page, '#enDisponibilidad'), /no es confiable/); assert.equal(await page.isVisible('#enOriginal img'), true); await ctx.close();
});
await test('IMAGEN SIN TEXTO (paisaje): dice que no encontró texto', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInImagen', 'sin-texto.png'); assert.equal((await est(page)).nivel, 'sin_texto'); assert.match(await texto(page, '#enCalidad'), /No encontré texto/); await ctx.close();
});
await test('lectura mala: corregir el texto a mano habilita seguir y deja el original intacto', async () => {
  const { page, ctx } = await abrir({ conectado: true }); await aEntender(page); await leer(page, '#enInImagen', 'borrosa.jpg'); await page.click('#enCorregir'); await page.waitForSelector('#enTextoEditar:not([hidden])');
  await page.fill('#enTextoEditar', 'Reunión de padres el viernes 21 de noviembre a las 9:30 hs en el aula. Traer fotocopia.'); await page.click('#enGuardarEdicion'); const e = await est(page);
  assert.equal(e.editado, true); assert.equal(e.nivel, 'buena'); assert.equal(await page.isVisible('#enImportante'), true); assert.match(await texto(page, '#enImportanteLista'), /viernes 21 de noviembre/); assert.equal(await page.isDisabled('#enFacil'), false); assert.equal(await page.isVisible('#enOriginal img'), true); await ctx.close();
});

console.log('\nEntender · opciones (modo demo, sin IA)');
await test('«Qué dice exactamente»: transcripción con lo dudoso marcado y botón de copiar/escuchar; las opciones de IA avisan que no hay IA', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInImagen', 'nota-escolar.jpg'); await page.click('#enQueDice'); await page.waitForSelector('#enPanelTexto:not([hidden])');
  assert.match(await texto(page, '#enTranscripcion'), /Comunicado a las familias/i); assert.equal(await page.isDisabled('#enFacil'), true); assert.equal(await page.isDisabled('#enPreguntar'), true); assert.match(await texto(page, '#enDisponibilidad'), /modo demo|no la hay/i);
  assert.deepEqual(await spoken(page), [], 'no habla sola'); await page.click('#enLeerOriginal'); assert.equal((await spoken(page)).length, 1); await ctx.close();
});
await test('«Escuchar la explicación» sin explicación lee el original y lo dice; nunca arranca sola', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInImagen', 'whatsapp.png'); assert.deepEqual(await spoken(page), []); await page.click('#enEscuchar'); assert.equal((await spoken(page)).length, 1); assert.match(await texto(page, '#enEstado'), /documento original/); await ctx.close();
});
await test('«Ver con pictogramas» abre pictogramas ARASAAC del documento y «Volver» regresa al resultado', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInImagen', 'whatsapp.png'); await page.click('#enPictos'); await page.waitForSelector('#view-cuento:not([hidden])'); await page.waitForSelector('#pqPagina .pc-card'); assert.ok((await page.locator('#pqPagina .pc-card').count()) > 3);
  await page.click('#pqVolver'); await page.waitForSelector('#enResultado:not([hidden])'); assert.match(await texto(page, '#enImportanteLista'), /lunes 24/, 'el documento sigue ahí'); await ctx.close();
});
await test('«Responder con pictogramas» conecta con el comunicador: elegir, decir en voz alta y volver al documento', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInImagen', 'cartel.jpg'); await page.click('#enResponder'); await page.waitForSelector('#tbCategoria:not([hidden])'); assert.match(await texto(page, '#tbCatTitulo'), /Responder con pictogramas/);
  assert.equal(await page.locator('#tbFrasesRapidas li').count(), 10); await page.click('#tbFrasesRapidas li:nth-child(4) button'); assert.equal(await page.inputValue('#tbTexto'), 'No entiendo.'); assert.deepEqual(await spoken(page), []); await page.click('#tbDecir'); assert.deepEqual(await spoken(page), ['No entiendo.']);
  await page.click('#view-tablero .back-btn'); await page.waitForSelector('#enResultado:not([hidden])'); await ctx.close();
});
await test('privacidad: nada del documento queda en el almacenamiento y «Borrar todo» y salir limpian la pantalla', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await leer(page, '#enInImagen', 'nota-escolar.jpg');
  const alm = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } })); assert.doesNotMatch(alm, /reuni|viernes|fotocopia/i);
  await page.click('#enBorrar'); await page.waitForSelector('#enInicio:not([hidden])'); assert.equal((await page.textContent('#enOriginal')).trim(), ''); assert.equal(await est(page), null);
  await leer(page, '#enInImagen', 'whatsapp.png'); await page.click('#view-entender .back-btn >> visible=true'); await page.waitForSelector('#enInicio:not([hidden])'); await page.click('#view-entender .back-btn >> visible=true'); await page.waitForSelector('#view-inicio:not([hidden])'); assert.equal(await est(page), null); await ctx.close();
});
await test('cancelar la lectura vuelve al inicio y no deja nada', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await page.setInputFiles('#enInImagen', FX('nota-escolar.jpg')); await page.waitForSelector('#enTrabajo:not([hidden])'); await page.click('#enCancelar');
  await page.waitForSelector('#enInicio:not([hidden])'); assert.match(await texto(page, '#enEstadoInicio'), /cancelada/); await page.waitForTimeout(1500); assert.equal(await page.isVisible('#enResultado'), false); assert.equal(await est(page), null); await ctx.close();
});
await test('sin acceso a las bibliotecas de lectura (sin internet): lo explica y no se rompe', async () => {
  const { page, errs, ctx } = await abrir(); await page.route('**/tesseract.min.js', (r) => r.abort()); await aEntender(page); await page.setInputFiles('#enInImagen', FX('nota-escolar.jpg'));
  await page.waitForFunction(() => /hace falta internet/.test(document.getElementById('enEstadoInicio').textContent)); assert.equal(await page.isVisible('#enInicio'), true); assert.deepEqual(errs.filter((e) => !/Failed to load/.test(e)), []); await ctx.close();
});
await test('texto pegado: «Entender este texto» también funciona (sin imagen) y el original es el texto', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); await page.click('#enInicio .en-texto summary'); await page.fill('#enTextoManual', 'Mañana jueves 27 de noviembre a las 8:00 hs hay reunión en la escuela. Traer el cuaderno.'); await page.click('#enUsarTexto'); await page.waitForSelector('#enResultado:not([hidden])');
  assert.match(await texto(page, '#enImportanteLista'), /jueves 27 de noviembre/); assert.match(await texto(page, '#enOriginal'), /Traer el cuaderno/); await ctx.close();
});

console.log('\nEntender · con IA conectada (Worker real + proveedor simulado)');
await test('permiso antes de enviar: rechazar no manda nada; aceptar envía SOLO texto (sin imagen) y la respuesta se muestra aparte, marcada como IA', async () => {
  const { page, reqs, ctx } = await abrir({ conectado: true }); await aEntender(page); await leer(page, '#enInImagen', 'nota-escolar.jpg'); assert.equal(await page.isDisabled('#enFacil'), false);
  await page.click('#enFacil'); await page.waitForSelector('#consentDialog[open]'); await page.click('#consentForm button[value="decline"]'); await page.waitForFunction(() => /Sin tu permiso/.test(document.getElementById('enEstado').textContent));
  assert.equal(reqs.filter((r) => r.url.includes('/api/explain')).length, 0, 'sin permiso no se envía nada');
  await page.click('#enFacil'); await consentir(page); await page.waitForSelector('#enPanelIA:not([hidden])'); const env = reqs.filter((r) => r.url.includes('/api/explain'));
  assert.equal(env.length, 1); const b = JSON.parse(env[0].body); assert.equal(b.task, 'easy'); assert.equal(b.source, 'file_ocr'); assert.match(b.text, /reuni[oó]n/i); assert.ok(!/data:image|base64/.test(env[0].body), 'no viaja la imagen'); assert.ok(env[0].body.length < 3000);
  assert.match(await texto(page, '#enIATit'), /GENERADO POR IA/); assert.match(await texto(page, '#enIATexto'), /MOCK/); assert.equal(await page.isVisible('#enOriginal img'), true, 'el original sigue visible'); assert.match(await texto(page, '#enOrigTit'), /ORIGINAL/); await ctx.close();
});
await test('datos personales: se ocultan antes de enviar y se avisa; lo ilegible viaja como [ilegible]', async () => {
  const { page, reqs, ctx } = await abrir({ conectado: true }); await aEntender(page); await page.click('#enInicio .en-texto summary'); await page.fill('#enTextoManual', 'Estimado titular: su DNI 12345678 y correo ana@correo.com. Debe presentarse el viernes 21 de noviembre a las 9:30 hs.'); await page.click('#enUsarTexto'); await page.waitForSelector('#enResultado:not([hidden])');
  await page.click('#enQueHacer'); await consentir(page); await page.waitForSelector('#enPanelIA:not([hidden])'); const b = JSON.parse(reqs.find((r) => r.url.includes('/api/explain')).body); assert.doesNotMatch(b.text, /12345678|ana@correo/); assert.match(b.text, /oculto/); assert.match(await texto(page, '#enIAAvisosLista'), /Se ocultaron/);
  assert.equal(await page.isVisible('#enIADice'), true); assert.equal(await page.isVisible('#enIASug'), true); assert.match(await texto(page, '#enIASug h3'), /no figura en el documento/); await ctx.close();
});
await test('«Pedir a la IA que lo revise»: muestra solo datos con cita escrita en el documento y descarta lo inventado', async () => {
  const { page, ctx } = await abrir({ conectado: true }); await aEntender(page); await leer(page, '#enInImagen', 'nota-escolar.jpg'); await page.click('#enRevisarIA'); await consentir(page); await page.waitForFunction(() => document.querySelector('#enImportanteIA .en-bloque'));
  const t = await texto(page, '#enImportanteIA'); assert.match(t, /viernes 21 de noviembre/); assert.doesNotMatch(t, /1 de enero/); assert.match(t, /descartó 1 dato/); assert.match(t, /VERIFICADO CONTRA EL TEXTO/); await ctx.close();
});
await test('«Hacer preguntas»: responde con IA aparte del documento y «Escuchar la explicación» lee la respuesta (solo al tocar)', async () => {
  const { page, ctx } = await abrir({ conectado: true }); await aEntender(page); await leer(page, '#enInImagen', 'whatsapp.png'); await page.click('#enPreguntar'); await page.waitForSelector('#enPanelPregunta:not([hidden])'); await page.fill('#enPregInput', '¿A qué hora es el acto?'); await page.click('#enPregEnviar'); await consentir(page);
  await page.waitForSelector('#enPanelIA:not([hidden])'); assert.match(await texto(page, '#enIAKind'), /Respuesta a tu pregunta/); assert.deepEqual(await spoken(page), []); await page.click('#enEscuchar'); const s = await spoken(page); assert.equal(s.length, 1); assert.match(s[0], /MOCK/); await ctx.close();
});
await test('al corregir el texto, la explicación anterior se borra (no queda desactualizada)', async () => {
  const { page, ctx } = await abrir({ conectado: true }); await aEntender(page); await leer(page, '#enInImagen', 'formulario.png'); await page.click('#enFacil'); await consentir(page); await page.waitForSelector('#enPanelIA:not([hidden])');
  await page.click('#enQueDice'); await page.click('#enEditar'); await page.fill('#enTextoEditar', 'Entregar el formulario el 9 de diciembre en secretaría de 8 a 12 hs.'); await page.click('#enGuardarEdicion'); assert.equal(await page.isVisible('#enPanelIA'), false); assert.equal((await est(page)).ai, ''); assert.match(await texto(page, '#enImportanteLista'), /9 de diciembre/); await ctx.close();
});

console.log('\nEntender · accesibilidad y móvil');
await test('móvil 390 px: sin desbordamiento en inicio y resultado; botones grandes con nombre accesible', async () => {
  const { page, ctx } = await abrir({ ancho: 390, alto: 800 }); const ok = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); await aEntender(page); assert.ok(await ok(), 'inicio');
  await leer(page, '#enInImagen', 'whatsapp.png'); assert.ok(await ok(), 'resultado'); await page.click('#enQueDice'); assert.ok(await ok(), 'transcripción');
  const chicos = await page.$$eval('#enResultado .en-botones button', (b) => b.filter((x) => x.getBoundingClientRect().height < 44).length); assert.equal(chicos, 0);
  const sinNombre = await page.$$eval('#view-entender button, #view-entender input, #view-entender textarea', (n) => n.filter((e) => !e.closest('[hidden]') && !(e.getAttribute('aria-label') || (e.textContent || '').trim() || (e.labels && e.labels.length))).length); assert.equal(sinNombre, 0); await ctx.close();
});
await test('foco y guía: cada pantalla enfoca su título y CLARIA acompaña con su explicación', async () => {
  const { page, ctx } = await abrir(); await aEntender(page); assert.equal(await page.evaluate(() => document.activeElement.id), 'enTitulo'); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'entender1');
  await leer(page, '#enInImagen', 'whatsapp.png'); assert.equal(await page.evaluate(() => document.activeElement.id), 'enResTitulo'); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'entenderres');
  await page.click('#claria-btn'); assert.match(await page.textContent('#claria-menu, #claria-bubble'), /./); await ctx.close();
});
srv();
function srv() {}
sDemo.close(); sConn.close(); mock.server.close(); api.close && api.close(); await browser.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
