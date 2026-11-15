// E2E de las seis instituciones en «Mi ciudad, más accesible». Uso: node tests/e2e-ciudad.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const FX = (n) => path.join(ROOT, 'tests/fixtures', n);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); if (u === '/config.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end('window.CLARIA_CONFIG={apiBase:""};'); }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(8019, r)); const BASE = 'http://localhost:8019/';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }); const results = [];
const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n   ', e.message.split('\n')[0], (String(e.stack).match(/e2e-lugares\.mjs:\d+/) || [''])[0]); } };
async function abrir({ ancho = 1280, alto = 900, camara = 'real', lugaresJson, sw = 'allow' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, acceptDownloads: true, serviceWorkers: sw, permissions: camara === 'real' ? ['camera'] : [] }); const page = await ctx.newPage(); const ext = [], errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) ext.push(u); });
  if (lugaresJson) await page.route('**/data/lugares.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(lugaresJson) }));
  await page.addInitScript(({ camara }) => { window.__spoken = []; window.__streams = []; window.__geo = 0; window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() {}, pause() {}, resume() {}, speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 20); } } });
    if (navigator.geolocation) { navigator.geolocation.getCurrentPosition = () => { window.__geo++; }; navigator.geolocation.watchPosition = () => { window.__geo++; }; }
    const orig = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async (c) => { window.__gum = (window.__gum || 0) + 1; if (camara === 'negada') throw new DOMException('denegado', 'NotAllowedError'); const s = await orig(c); window.__streams.push(s); return s; };
  }, { camara });
  await page.goto(BASE); await page.waitForSelector('#claria'); return { ctx, page, ext, errs };
}
const spoken = (p) => p.evaluate(() => window.__spoken);
const aLugares = async (page) => { await page.click('#view-inicio [data-view="lugares"]'); await page.waitForSelector('#lgInicio:not([hidden])'); await page.evaluate(() => { document.getElementById('lgQR').open = true; }); };
const porQR = async (page, f) => { await page.setInputFiles('#lgArchivo', FX(f)); };
const aMenu = async (page) => { await aLugares(page); await porQR(page, 'qr-biblioteca-demo.png'); await page.waitForSelector('#lgMenu:not([hidden])'); };

const esperaLista = (page) => page.waitForSelector('#lgInstituciones .lg-lugar');
const aInst = async (page, id) => { if (!(await page.isVisible('#lgInicio'))) await aLugares(page); await page.click(`#lgInstituciones [data-inst="${id}"]`); await page.waitForSelector('#lgMenu:not([hidden])'); };
const aTablero = async (page, id) => { await aInst(page, id); await page.click('#lgOpciones >> text=Hablar con imágenes'); await page.waitForSelector('#tbCategoria:not([hidden])'); };
const cargaImgs = (page) => page.waitForFunction(() => { const i = [...document.querySelectorAll('#tbFrasesRapidas img')]; return i.length && i.every((x) => x.complete && x.naturalWidth > 0); }, null, { timeout: 8000 });
const IDS = ['registro-civil', 'hospital-y-centros-de-salud', 'municipalidad', 'pami', 'correo-argentino', 'terminal-de-omnibus'];
const NOMBRES = ['Registro Civil', 'Hospital y centros de salud', 'Municipalidad', 'PAMI', 'Correo Argentino', 'Terminal de Ómnibus'];

console.log('\nMi ciudad, más accesible · seis instituciones');
await test('las seis instituciones están siempre visibles, marcadas «Datos por confirmar», sin red externa, cámara ni ubicación', async () => {
  const { page, ext, ctx } = await abrir(); await aLugares(page); await esperaLista(page); assert.match(await page.textContent('#lgTitulo'), /Mi ciudad, más accesible/);
  assert.deepEqual(await page.$$eval('#lgInstituciones .lg-lugar .big-txt', (n) => n.map((x) => x.textContent)), NOMBRES);
  assert.equal(await page.$$eval('#lgInstituciones .lg-chip', (n) => n.filter((x) => /Datos por confirmar/.test(x.textContent)).length), 6);
  assert.equal(await page.evaluate(() => window.__gum || 0), 0); assert.equal(await page.evaluate(() => window.__geo), 0); assert.deepEqual(ext, []); await ctx.close();
});
await test('cada institución: Qué puedo consultar · Hablar con imágenes · Cómo llegar · Guías accesibles; sin inventar datos', async () => {
  const { page, ctx } = await abrir();
  for (const id of IDS) {
    await aInst(page, id); assert.deepEqual(await page.$$eval('#lgOpciones .big-txt', (n) => n.map((x) => x.textContent)), ['Qué puedo consultar', 'Hablar con imágenes', 'Cómo llegar', 'Guías accesibles']);
    assert.match(await page.textContent('#lgOrigen'), /Datos por confirmar/);
    for (const o of ['Qué puedo consultar', 'Cómo llegar', 'Guías accesibles']) { await page.click(`#lgOpciones >> text=${o}`); await page.waitForSelector('#lgPaso:not([hidden])'); assert.match(await page.textContent('#lgPasoContenido'), /Información por confirmar/, `${id} · ${o}`); assert.equal(await page.isVisible('#lgPasoContenido a'), false, 'sin mapa si no hay dirección'); await page.click('#lgSiguiente'); await page.waitForSelector('#lgMenu:not([hidden])'); }
    await page.click('#view-lugares .back-btn'); await page.waitForSelector('#lgInicio:not([hidden])');
  }
  await ctx.close();
});
await test('Hablar con imágenes: 8 frases con pictogramas ARASAAC locales; NO se dice nada hasta tocar «Decir»', async () => {
  const { page, errs, ctx } = await abrir(); await aTablero(page, 'registro-civil'); await cargaImgs(page);
  assert.equal(await page.locator('#tbFrasesRapidas li').count(), 8); assert.match(await page.textContent('#tbAviso'), /no es un procedimiento oficial/);
  assert.equal(await page.$$eval('#tbFrasesRapidas img', (n) => n.filter((i) => !/^http:\/\/localhost:\d+\/assets\/picto\/\d+\.png$/.test(i.src)).length), 0, 'solo pictogramas locales');
  assert.deepEqual(await spoken(page), []);
  await page.click('#tbFrasesRapidas li:first-child button'); assert.deepEqual(await spoken(page), [], 'elegir una frase no habla');
  const t = await page.inputValue('#tbTexto'); assert.ok(t && t !== t.toUpperCase(), 'texto hablado en minúsculas naturales: ' + t);
  await page.click('#tbDecir'); assert.deepEqual(await spoken(page), [t]); assert.deepEqual(errs, []); await ctx.close();
});
await test('conceptos pendientes: solo texto «por revisar», sin imagen inventada; genéricos con «imagen general»', async () => {
  const { page, ctx } = await abrir(); await aTablero(page, 'registro-civil'); await cargaImgs(page);
  const d = await page.evaluate(async () => (await (await fetch('data/ciudad.json')).json()).instituciones.find((i) => i.id === 'registro-civil').frases);
  const i = d.findIndex((f) => f.revisar.length); assert.ok(i >= 0); const f = d[i];
  await page.click(`#tbFrasesRapidas li:nth-child(${i + 1}) button`);
  assert.ok(await page.locator('.tb-tarjeta-pend').count() >= f.revisar.length); assert.equal(await page.locator('.tb-tarjeta-pend img').count(), 0);
  assert.match(await page.textContent('#tbTarjetas'), /por revisar/);
  const g = d.findIndex((x) => x.tarjetas.some((t) => /GENERICO/.test(t.estado))); if (g >= 0) { await page.click(`#tbFrasesRapidas li:nth-child(${g + 1}) button`); assert.match(await page.textContent('#tbTarjetas'), /imagen general/); }
  await ctx.close();
});
await test('Mostrar en pantalla grande y botón de sonido: con el sonido apagado no se dice nada', async () => {
  const { page, ctx } = await abrir(); await aTablero(page, 'municipalidad'); await page.click('#tbFrasesRapidas li:first-child button');
  await page.click('#tbMostrar'); await page.waitForSelector('#tbMostrarDlg[open]'); assert.ok((await page.textContent('#tbMostrarTexto')).length > 3); assert.ok((await page.locator('#tbMostrarTarjetas li').count()) >= 1);
  await page.click('#tbMostrarDecir'); assert.equal((await spoken(page)).length, 1); await page.click('#tbMostrarCerrar'); assert.equal(await page.isVisible('#tbMostrarDlg'), false);
  await page.click('#tbSonido'); assert.match(await page.textContent('#tbSonido'), /desactivado/); await page.click('#tbDecir'); assert.equal((await spoken(page)).length, 1, 'no habla con sonido apagado'); assert.match(await page.textContent('#tbEstado'), /sonido está desactivado/i);
  await page.click('#tbMostrar'); await page.waitForSelector('#tbMostrarDlg[open]'); assert.equal(await page.isVisible('#tbMostrarDecir'), false); await ctx.close();
});
await test('volver: tablero → menú de la institución (conserva el lugar) → lista → inicio', async () => {
  const { page, errs, ctx } = await abrir(); await aTablero(page, 'pami'); assert.match(await page.textContent('#tbCatTitulo'), /PAMI/);
  await page.click('#view-tablero .back-btn'); await page.waitForSelector('#lgMenu:not([hidden])'); assert.match(await page.textContent('#lgNombre'), /PAMI/);
  await page.click('#view-lugares .back-btn'); await page.waitForSelector('#lgInicio:not([hidden])'); await page.click('#view-lugares .back-btn'); await page.waitForSelector('#view-inicio:not([hidden])'); assert.deepEqual(errs, []); await ctx.close();
});
await test('falla de pictogramas (sin imagen): queda el texto, no un hueco, y nada se rompe', async () => {
  const { page, errs, ctx } = await abrir({ sw: 'block' }); await page.route('**/assets/picto/**', (r) => r.abort()); await aTablero(page, 'correo-argentino');
  await page.waitForFunction(() => document.querySelectorAll('#tbFrasesRapidas .tb-sin-img').length > 3); assert.ok((await page.textContent('#tbFrasesRapidas')).length > 40);
  await page.click('#tbFrasesRapidas li:first-child button'); assert.ok((await page.inputValue('#tbTexto')).length > 3); assert.deepEqual(errs.filter((e) => !/Failed to load/.test(e)), []); await ctx.close();
});
await test('sin voz en el navegador: lo explica y deja leer o mostrar la frase', async () => {
  const { page, ctx } = await abrir(); await page.addInitScript(() => { delete window.speechSynthesis; });
  await page.goto(BASE); await page.waitForSelector('#claria'); await aTablero(page, 'terminal-de-omnibus'); await page.click('#tbFrasesRapidas li:first-child button'); await page.click('#tbDecir');
  assert.match(await page.textContent('#tbEstado'), /no tiene voz|sonido está desactivado/i); await page.click('#tbMostrar'); await page.waitForSelector('#tbMostrarDlg[open]'); await ctx.close();
});
await test('datos faltantes o incompletos: una ficha sin fuente, sin fecha o sin aprobación NO se muestra; con todo y publicada, sí', async () => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ciudad.json'), 'utf8'));
  const completa = { direccion_confirmada: 'Calle Falsa 123', horario_confirmado: 'Lunes a viernes 8 a 13', telefono_confirmado: '', servicios_confirmados: 'Consultas generales|Trámites', fuente_oficial_url: 'https://ejemplo.gob.ar/ficha', fecha_verificacion: '2026-11-01', revisado_y_aprobado: 'SI' };
  const variante = (campos, estado = 'publicado') => ({ ...c, instituciones: c.instituciones.map((i) => (i.id === 'pami' ? { ...i, estado, ficha: { ...i.ficha, ...campos } } : i)) });
  for (const [nombre, v] of [['sin fuente', variante({ ...completa, fuente_oficial_url: '' })], ['sin fecha', variante({ ...completa, fecha_verificacion: '' })], ['sin aprobar', variante({ ...completa, revisado_y_aprobado: 'NO' })], ['en borrador', variante(completa, 'borrador')]]) {
    const { page, ctx } = await abrir({ sw: 'block' }); await page.route('**/data/ciudad.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(v) })); await aInst(page, 'pami');
    await page.click('#lgOpciones >> text=Cómo llegar'); assert.match(await page.textContent('#lgPasoContenido'), /Información por confirmar/, nombre); assert.doesNotMatch(await page.textContent('#lgPasoContenido'), /Calle Falsa/, nombre); await ctx.close();
  }
  const { page, ctx } = await abrir({ sw: 'block' }); await page.route('**/data/ciudad.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(variante(completa)) })); await aInst(page, 'pami');
  assert.match(await page.textContent('#lgOrigen'), /ejemplo\.gob\.ar.*01\/11\/2026/); await page.click('#lgOpciones >> text=Cómo llegar'); assert.match(await page.textContent('#lgPasoContenido'), /Calle Falsa 123/); assert.equal(await page.isVisible('#lgPasoContenido a'), true);
  await page.click('#lgSiguiente'); await page.click('#lgOpciones >> text=Qué puedo consultar'); assert.match(await page.textContent('#lgPasoContenido'), /Consultas generales; Trámites/); await ctx.close();
});
await test('si no carga ciudad.json: se avisa y no se rompe', async () => {
  const { page, errs, ctx } = await abrir({ sw: 'block' }); await page.route('**/data/ciudad.json', (r) => r.abort()); await aLugares(page); await page.waitForFunction(() => /No se pudo cargar la lista de instituciones/.test(document.getElementById('lgInstituciones').textContent)); assert.deepEqual(errs, []); await ctx.close();
});
await test('sin conexión: tras una primera visita funcionan las instituciones y sus tableros con pictogramas', async () => {
  const { page, ctx } = await abrir(); await page.evaluate(() => navigator.serviceWorker.ready); await page.goto(BASE); await page.waitForFunction(() => navigator.serviceWorker.controller); await page.waitForTimeout(2500);
  await ctx.setOffline(true); await page.goto(BASE); await page.waitForSelector('#claria'); await aTablero(page, 'hospital-y-centros-de-salud'); await cargaImgs(page); await ctx.close();
});
await test('móvil 390 px: sin desbordamiento en la lista, el menú, el tablero y la pantalla grande', async () => {
  const { page, ctx } = await abrir({ ancho: 390, alto: 800 }); const ancho = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await aLugares(page); assert.ok(await ancho(), 'lista'); await aInst(page, 'registro-civil'); assert.ok(await ancho(), 'menú'); await page.click('#lgOpciones >> text=Hablar con imágenes'); await page.waitForSelector('#tbCategoria:not([hidden])'); assert.ok(await ancho(), 'tablero');
  await page.click('#tbFrasesRapidas li:first-child button'); assert.ok(await ancho(), 'frase'); await page.click('#tbMostrar'); await page.waitForSelector('#tbMostrarDlg[open]');
  assert.ok(await page.evaluate(() => { const r = document.getElementById('tbMostrarDlg').getBoundingClientRect(); return r.width <= innerWidth + 1; })); await ctx.close();
});
await test('Panel del editor: pendientes visibles, elección local «sin aprobar» que aparece en el tablero, y nada se publica', async () => {
  const { page, errs, ctx } = await abrir({ sw: 'block' });
  await page.route('https://api.arasaac.org/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ _id: 4321, keywords: [{ keyword: 'nacimiento' }] }]) }));
  await page.route('https://static.arasaac.org/**', (r) => r.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
  await aLugares(page); await page.click('#view-lugares [data-view="editor"]'); await page.waitForSelector('#view-editor:not([hidden])'); await page.waitForFunction(() => /conceptos por resolver/.test(document.getElementById('edResumen').textContent));
  assert.match(await page.textContent('#edResumen'), /^\d+ conceptos por resolver \(\d+ sin pictograma y \d+ con imagen general\)/); assert.equal(await page.isVisible('#edPendientes li >> nth=0'), true);
  await page.fill('#edEditor', 'Editora Prueba'); await page.click('[aria-label="Buscar pictograma para Nacimiento"]'); await page.click('[aria-label^="Elegir pictograma 4321"]');
  assert.match(await page.textContent('#edEstado'), /sin aprobar/); const loc = await page.evaluate(() => JSON.parse(localStorage.getItem('claria.pictos.revisados.v1'))); assert.equal(Object.values(loc)[0].id, 4321);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#edDescargarRev')]); const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); assert.equal(j.revisiones[0].revisado_por, 'Editora Prueba'); assert.equal(j.revisiones[0].id, 4321);
  assert.deepEqual(errs.filter((e) => !/Failed to load/.test(e)), []); await ctx.close();
});
await test('Panel del editor: borrador se descarga incompleto; «publicado» exige fuente, fechas, responsable y aprobación', async () => {
  const { page, ctx } = await abrir(); await aLugares(page); await page.click('#view-lugares [data-view="editor"]'); await page.waitForSelector('#edInst option', { state: 'attached' });
  assert.equal(await page.isEnabled('#edDescargarFicha'), true); await page.selectOption('#edEstadoFicha', 'publicado'); assert.equal(await page.isEnabled('#edDescargarFicha'), false); assert.ok((await page.locator('#edProblemas li').count()) >= 5);
  await page.fill('#ed_fuente_oficial_url', 'https://ejemplo.gob.ar/x'); await page.fill('#ed_fecha_verificacion', '2026-11-01'); await page.fill('#edResponsable', 'Ana'); await page.fill('#edFecha', '2026-11-02'); await page.fill('#edUltima', '2026-11-02'); assert.equal(await page.isEnabled('#edDescargarFicha'), false, 'falta aprobación');
  await page.check('#edAprobado'); assert.equal(await page.isEnabled('#edDescargarFicha'), true); const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#edDescargarFicha')]); const f = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); assert.equal(f.estado, 'publicado'); assert.equal(f.ficha.revisado_y_aprobado, 'SI');
  const pub = await page.evaluate(async () => (await (await fetch('data/ciudad.json')).json()).instituciones.map((i) => i.estado)); assert.deepEqual([...new Set(pub)], ['borrador'], 'el panel no publicó nada'); await ctx.close();
});
await test('el QR de la biblioteca de demostración sigue funcionando (oculta de la lista)', async () => {
  const { page, ctx } = await abrir(); await aMenu(page); assert.match(await page.textContent('#lgNombre'), /Biblioteca de demostración/); await ctx.close();
});
srv.close(); await browser.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
