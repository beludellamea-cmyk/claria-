// Pruebas E2E de «Entender una foto» (etapa 1): vista previa → lectura → texto editable → ayuda / ¿Qué hago ahora?
// IMPORTANTE: Tesseract.js se REEMPLAZA por un doble de prueba (no hay red en CI). Estas pruebas verifican el flujo, la privacidad
// y la separación documento/sugerencia; NO miden la calidad real del OCR (eso se prueba a mano con fotos reales).
// Uso: node tests/e2e-foto.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startMockProvider } from './mock-provider.mjs';
import { startDevServer } from '../worker/dev-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOTO = path.join(ROOT, 'tests/fixtures/nota-escolar.png');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const serveStatic = (port, apiBase) => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); if (u === '/config.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end(`window.CLARIA_CONFIG={apiBase:${JSON.stringify(apiBase)}};`); }
    const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }); s.listen(port, () => resolve(s));
});

const NOTA = 'Estimadas familias: el martes 24 de noviembre habrá una reunión a las 18:00 en la biblioteca escolar. Por favor, asistir con el cuaderno de comunicaciones.';
// Doble de Tesseract.js: devuelve window.__OCR_TEXT (o la nota) o falla si window.__OCR_FALLA está definido.
const STUB = `window.Tesseract={createWorker:async function(l,o,opts){window.__ocr=(window.__ocr||0)+1;if(window.__OCR_FALLA)throw new Error('sin conexión con el CDN de idioma');
  return {recognize:async function(f){window.__ocrArchivo=f&&f.name;if(opts&&opts.logger)opts.logger({status:'recognizing text',progress:.5});return {data:{text:window.__OCR_TEXT!==undefined?window.__OCR_TEXT:${JSON.stringify(NOTA)}}};},terminate:async function(){window.__terminado=(window.__terminado||0)+1;}};}};`;

const results = []; let browser;
const test = async (name, fn) => { try { await fn(); results.push([true, name]); console.log('  ✔', name); } catch (e) { results.push([false, name, e]); console.log('  ✘', name, '\n     ', String(e.message).split('\n')[0], '\n     ', (String(e.stack).match(/e2e-foto\.mjs:\d+/) || [''])[0]); } };

const mock = await startMockProvider(8792);
const api = await startDevServer({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test-SECRET', ANTHROPIC_BASE_URL: 'http://localhost:8792', ALLOWED_ORIGINS: 'http://localhost:8010', RATE_PER_MIN: '50', RATE_PER_DAY: '500', DAILY_CAP: '5000' }, 8788);
const sDemo = await serveStatic(8011, ''), sConn = await serveStatic(8010, 'http://localhost:8788');
browser = await chromium.launch();

async function open(port, { width = 1280, height = 900, ocr } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } }); const page = await ctx.newPage();
  const errors = [], reqs = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), body: r.postData() || '' }));
  await page.route('**/tesseract.min.js', (route) => route.fulfill({ contentType: 'text/javascript', body: STUB }));
  if (ocr) await page.addInitScript((o) => { for (const k of Object.keys(o)) window[k] = o[k]; }, ocr);
  await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => document.getElementById('modeLabel').textContent.length > 0); await page.waitForTimeout(300);
  return { page, ctx, errors, reqs };
}
const aFoto = async (page) => { await page.click('#view-inicio [data-view="lectura"]'); await page.setInputFiles('#photoInput', FOTO); await page.waitForSelector('#leerFoto:not([hidden])'); };
const visible = async (page, sel) => !(await page.$eval(sel, (e) => e.hidden));

console.log('\nEntender una foto · modo demo');
await test('vista previa: pregunta «¿Esta es la imagen correcta?», muestra la imagen y NO lee nada hasta que la persona confirma', async () => {
  const { page, errors, reqs, ctx } = await open(8011); await aFoto(page);
  assert.match(await page.textContent('#fotoTitulo'), /¿Esta es la imagen correcta\?/);
  await page.waitForFunction(() => { const i = document.getElementById('fotoPreviaImg'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 });
  assert.match(await page.getAttribute('#fotoPreviaImg', 'alt'), /Vista previa/);
  assert.equal(await page.evaluate(() => window.__ocr || 0), 0, 'no debe haber OCR antes de confirmar');
  assert.ok(!reqs.some((r) => r.url.includes('tesseract')), 'ni siquiera descarga la biblioteca antes de confirmar');
  assert.match(await page.textContent('#leerFoto'), /no se envía a ningún servidor/);
  assert.deepEqual(errors, []); await ctx.close();
});
await test('confirmar → texto reconocido EDITABLE junto a la imagen original; el original se puede restaurar', async () => {
  const { page, errors, ctx } = await open(8011); await aFoto(page); await page.click('#fotoLeer');
  await page.waitForSelector('#leerRevisar:not([hidden])');
  assert.equal(await page.inputValue('#revisarTexto'), NOTA);
  await page.waitForFunction(() => { const i = document.getElementById('revisarImg'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__ocrArchivo), 'nota-escolar.png');
  assert.equal(await page.evaluate(() => window.__terminado), 1, 'el worker de OCR debe terminarse');
  await page.fill('#revisarTexto', NOTA.replace('18:00', '19:00')); await page.click('#revisarRestaurar');
  assert.equal(await page.inputValue('#revisarTexto'), NOTA, 'restaura el texto tal como lo reconoció');
  assert.match(await page.textContent('#leerRevisar'), /puede equivocarse, sobre todo con números, fechas, horas y letra a mano/);
  assert.deepEqual(errors, []); await ctx.close();
});
await test('«Usar este texto» → cuatro ayudas; ¿Qué hago ahora? en demo se explica y no llama a la API', async () => {
  const { page, errors, reqs, ctx } = await open(8011); await aFoto(page); await page.click('#fotoLeer'); await page.waitForSelector('#leerRevisar:not([hidden])');
  await page.click('#revisarUsar'); await page.waitForSelector('#leerPaso2:not([hidden])');
  assert.deepEqual(await page.$$eval('#leerPaso2 .big-txt', (n) => n.map((x) => x.textContent)), ['Escuchar', 'Explicar fácil', '¿Qué hago ahora?', 'Ver con pictogramas']);
  await page.click('#optAcciones');
  assert.match(await page.textContent('#aiStatus'), /necesito una IA conectada y ahora estás en modo demo/);
  assert.ok(!reqs.some((r) => r.url.includes('/api/')), 'sin IA no debe llamar a /api'); assert.equal(await visible(page, '#aiResult'), false);
  assert.deepEqual(errors, []); await ctx.close();
});
await test('«Ver con pictogramas» sigue funcionando con el texto leído de la foto (sin enviar nada)', async () => {
  const { page, errors, reqs, ctx } = await open(8011); await aFoto(page); await page.click('#fotoLeer'); await page.waitForSelector('#leerRevisar:not([hidden])');
  await page.click('#revisarUsar'); await page.waitForSelector('#leerPaso2:not([hidden])'); await page.click('#abrirCuento');
  await page.waitForSelector('#pqContenido:not([hidden])'); assert.ok((await page.$$('#pqPagina img')).length >= 1, 'debe mostrar pictogramas');
  assert.ok(!reqs.some((r) => r.url.includes('/api/')));
  assert.deepEqual(errors, []); await ctx.close();
});

console.log('\nEntender una foto · fallas y límites');
await test('si el OCR falla: mensaje claro, sin inventar texto, y se puede reintentar o escribir a mano', async () => {
  const { page, errors, ctx } = await open(8011, { ocr: { __OCR_FALLA: true } }); await aFoto(page); await page.click('#fotoLeer');
  await page.waitForFunction(() => /No se pudo leer la imagen/.test(document.getElementById('fotoEstado').textContent));
  assert.equal(await visible(page, '#leerFoto'), true, 'se queda en la vista previa'); assert.equal(await page.isDisabled('#fotoLeer'), false, 'puede reintentar');
  await page.click('#fotoManual'); await page.waitForSelector('#leerRevisar:not([hidden])'); assert.equal(await page.inputValue('#revisarTexto'), '');
  await page.fill('#revisarTexto', 'Reunión el martes en la biblioteca de la escuela.'); await page.click('#revisarUsar'); await page.waitForSelector('#leerPaso2:not([hidden])');
  assert.deepEqual(errors, []); await ctx.close();
});
await test('si no reconoce texto: lo dice y «Usar este texto» no avanza con un texto vacío', async () => {
  const { page, errors, ctx } = await open(8011, { ocr: { __OCR_TEXT: '' } }); await aFoto(page); await page.click('#fotoLeer'); await page.waitForSelector('#leerRevisar:not([hidden])');
  assert.match(await page.textContent('#revisarEstado'), /No se reconoció texto en la imagen/);
  await page.click('#revisarUsar'); assert.match(await page.textContent('#revisarEstado'), /al menos 12 caracteres/); assert.equal(await visible(page, '#leerRevisar'), true);
  assert.deepEqual(errors, []); await ctx.close();
});
await test('volver: revisar → vista previa → elegir origen; y «Elegir otra imagen» vuelve al paso 1', async () => {
  const { page, errors, ctx } = await open(8011); await aFoto(page); await page.click('#fotoLeer'); await page.waitForSelector('#leerRevisar:not([hidden])');
  await page.click('#view-lectura .back-btn'); await page.waitForSelector('#leerFoto:not([hidden])');
  await page.click('#view-lectura .back-btn'); await page.waitForSelector('#leerPaso1:not([hidden])');
  assert.deepEqual(errors, []); await ctx.close();
});
await test('teclado: el título de cada paso recibe el foco y el estado se anuncia (aria-live)', async () => {
  const { page, ctx } = await open(8011); await aFoto(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fotoTitulo');
  assert.equal(await page.getAttribute('#fotoEstado', 'aria-live'), 'polite'); assert.equal(await page.getAttribute('#revisarEstado', 'aria-live'), 'polite');
  await page.click('#fotoLeer'); await page.waitForSelector('#leerRevisar:not([hidden])');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'revisarTexto'); assert.ok(await page.$('label[for="revisarTexto"]'));
  await ctx.close();
});
await test('móvil 390 px: sin desbordamiento horizontal en vista previa, revisión y ayudas', async () => {
  const { page, ctx } = await open(8011, { width: 390, height: 800 }); await aFoto(page);
  const over = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(await over(), false, 'vista previa'); await page.click('#fotoLeer'); await page.waitForSelector('#leerRevisar:not([hidden])'); assert.equal(await over(), false, 'revisión');
  await page.click('#revisarUsar'); await page.waitForSelector('#leerPaso2:not([hidden])'); assert.equal(await over(), false, 'ayudas'); await ctx.close();
});

console.log('\nEntender una foto · IA conectada');
await test('¿Qué hago ahora?: pide consentimiento, separa «El documento dice» de «Sugerencia de CLARIA» y nunca envía la imagen', async () => {
  const { page, errors, reqs, ctx } = await open(8010); await page.waitForFunction(() => document.getElementById('modeLabel').textContent === 'IA conectada');
  await aFoto(page); await page.click('#fotoLeer'); await page.waitForSelector('#leerRevisar:not([hidden])');
  await page.fill('#revisarTexto', NOTA + ' '); // texto corregido por la persona
  await page.click('#revisarUsar'); await page.waitForSelector('#leerPaso2:not([hidden])');
  const antes = mock.calls.length; await page.click('#optAcciones');
  await page.waitForSelector('#consentDialog[open]'); assert.equal(mock.calls.length, antes, 'nada se envía antes de aceptar'); await page.click('#consentAccept');
  await page.waitForSelector('#aiResult:not([hidden])');
  assert.match(await page.textContent('#aiResultKind'), /Qué hacer ahora/);
  const dice = await page.$$eval('#aiDiceList li', (n) => n.map((x) => x.textContent)), sug = await page.$$eval('#aiSugerenciasList li', (n) => n.map((x) => x.textContent));
  assert.equal(dice.length, 2); assert.equal(sug.length, 1);
  assert.match(await page.textContent('#aiDice h3'), /El documento dice/); assert.match(await page.textContent('#aiSugerencias h3'), /Sugerencia de CLARIA/);
  assert.match(await page.textContent('#aiSugerencias h3'), /no figura en el documento/);
  assert.match(await page.textContent('#aiNoticeList'), /foto \(OCR\) y puede tener errores/);
  const post = reqs.filter((r) => r.method === 'POST' && r.url.includes('/api/explain')); assert.equal(post.length, 1);
  const body = JSON.parse(post[0].body); assert.equal(body.task, 'actions'); assert.equal(body.source, 'file_ocr'); assert.ok(body.text.includes('biblioteca escolar'));
  assert.ok(!/data:image|base64|PNG|\\x89/.test(post[0].body), 'la imagen no debe viajar');
  assert.ok(reqs.every((r) => /localhost:(8010|8788)/.test(r.url) || /tesseract/.test(r.url)), 'ninguna otra llamada externa: ' + reqs.map((r) => r.url).filter((u) => !/localhost:(8010|8788)/.test(u)));
  assert.deepEqual(errors, []); await ctx.close();
});
await test('si la persona escribe el texto sin OCR, la fuente es «typed» (no se afirma OCR)', async () => {
  const { page, reqs, ctx } = await open(8010); await page.waitForFunction(() => document.getElementById('modeLabel').textContent === 'IA conectada');
  await aFoto(page); await page.click('#fotoManual'); await page.fill('#revisarTexto', 'El martes hay reunión en la biblioteca escolar a las 18:00.'); await page.click('#revisarUsar');
  await page.waitForSelector('#leerPaso2:not([hidden])'); await page.click('#optAcciones'); await page.waitForSelector('#consentDialog[open]'); await page.click('#consentAccept'); await page.waitForSelector('#aiResult:not([hidden])');
  const body = JSON.parse(reqs.filter((r) => r.url.includes('/api/explain')).pop().body); assert.equal(body.source, 'typed'); await ctx.close();
});

for (const s of [sDemo, sConn, api, mock.server]) { try { s.close(); } catch (_) {} }
await browser.close();
const fallas = results.filter((r) => !r[0]);
console.log(`\n${results.length - fallas.length}/${results.length} pruebas OK`); process.exit(fallas.length ? 1 : 0);
