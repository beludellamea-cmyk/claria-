// E2E de «Mi ciudad, más accesible» (etapa 3). Sin red externa; la cámara es el dispositivo falso de Chromium. Uso: node tests/e2e-lugares.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const FX = (n) => path.join(ROOT, 'tests/fixtures', n);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); if (u === '/config.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end('window.CLARIA_CONFIG={apiBase:""};'); }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(8017, r)); const BASE = 'http://localhost:8017/';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }); const results = [];
const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n   ', e.message.split('\n')[0], (String(e.stack).match(/e2e-lugares\.mjs:\d+/) || [''])[0]); } };
async function abrir({ ancho = 1280, alto = 900, camara = 'real', lugaresJson } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, acceptDownloads: true, serviceWorkers: 'allow', permissions: camara === 'real' ? ['camera'] : [] }); const page = await ctx.newPage(); const ext = [], errs = [];
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

console.log('\nEn un espacio público');
await test('inicio: las 4 tarjetas del kit + acceso a hablar; «Crear con pictogramas» sigue accesible desde Hablar con imágenes', async () => {
  const { page, errs, ctx } = await abrir(); assert.deepEqual(await page.$$eval('#view-inicio .big-txt', (n) => n.map((x) => x.textContent)), ['Entender', 'Hablar con imágenes', 'Mi ciudad, más accesible', 'Entender un trámite', 'O hablá conmigo']);
  await page.click('#view-inicio [data-view="tablero"]'); await page.click('#tbCategorias [data-view="escribir"]'); assert.equal(await page.isVisible('#view-escribir'), true); assert.deepEqual(errs, []); await ctx.close();
});
await test('¿Dónde estás?: tres formas de elegir; la cámara NO se enciende ni se pide la ubicación', async () => {
  const { page, errs, ctx } = await abrir(); await aLugares(page); assert.match(await page.textContent('#lgTitulo'), /Mi ciudad, más accesible/);
  assert.deepEqual(await page.$$eval('#lgInicio .big-choices.three .big-txt', (n) => n.map((x) => x.textContent)), ['Escanear QR', 'Subir foto del QR', 'Otros lugares']);
  await page.waitForTimeout(400); assert.equal(await page.evaluate(() => window.__gum || 0), 0); assert.equal(await page.evaluate(() => window.__geo), 0); assert.equal(await page.evaluate(() => document.activeElement.id), 'lgTitulo'); assert.deepEqual(errs, []); await ctx.close();
});
await test('QR de la biblioteca de demostración → «¿Qué necesitás?» con Inscribirme / Consultar horario / Pedir ayuda, rotulado como ficticio con responsable y fecha', async () => {
  const { page, ext, errs, ctx } = await abrir(); await aMenu(page); assert.match(await page.textContent('#lgMenuTitulo'), /¿Qué necesitás\?/);
  assert.deepEqual(await page.$$eval('#lgOpciones .big-txt', (n) => n.map((x) => x.textContent)), ['Inscribirme', 'Consultar horario', 'Pedir ayuda']);
  assert.equal(await page.isVisible('#lgDemo'), true); assert.match(await page.textContent('#lgDemo'), /EJEMPLO FICTICIO/); assert.match(await page.textContent('#lgOrigen'), /Información proporcionada por: Ejemplo ficticio de CLARIA.*Actualizada: 14\/11\/2026/);
  assert.match(await page.textContent('#lgMenu'), /responsabilidad de la institución/); assert.deepEqual(ext, []); assert.deepEqual(errs, []); await ctx.close();
});
await test('QR que NO es de un lugar verificado: no se abre nada, se explica y se ofrece la lista', async () => {
  const { page, ext, errs, ctx } = await abrir(); await aLugares(page); await porQR(page, 'qr-desconocido.png');
  await page.waitForFunction(() => /no es de un lugar verificado/.test(document.getElementById('lgEstado').textContent)); assert.equal(await page.isVisible('#lgInicio'), true); assert.equal(await page.evaluate(() => location.hash), '#lugares');
  assert.deepEqual(ext, [], 'no navegó ni pidió el enlace del QR'); assert.deepEqual(errs, []); await ctx.close();
});
await test('imagen sin QR: mensaje claro y sin romperse', async () => {
  const { page, errs, ctx } = await abrir(); await aLugares(page); await porQR(page, 'nota-escolar.png'); await page.waitForFunction(() => /No encontré un código QR/.test(document.getElementById('lgEstado').textContent)); assert.deepEqual(errs, []); await ctx.close();
});
await test('elegir de la lista (sin cámara ni QR) lleva al mismo menú', async () => {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lugares.json'), 'utf8')); const { page, ctx } = await abrir({ lugaresJson: { lugares: base.lugares.map((l) => ({ ...l, oculto: false })) } }); await aLugares(page); await page.click('#lgLista'); await page.click('#lgListaLugares .lg-lugar'); await page.waitForSelector('#lgMenu:not([hidden])'); assert.match(await page.textContent('#lgNombre'), /Biblioteca de demostración/); await ctx.close();
});
await test('Inscribirme: un paso por pantalla, con pictograma y voz solo si la persona la pide; vuelve al menú', async () => {
  const { page, errs, ctx } = await abrir(); await aMenu(page); await page.click('#lgOpciones >> text=Inscribirme'); await page.waitForSelector('#lgPaso:not([hidden])');
  assert.equal((await spoken(page)).length, 0); assert.match(await page.textContent('#lgPasoContenido'), /Paso 1 de 4/); assert.match(await page.textContent('#lgPasoContenido'), /Acercate al mostrador de atención\./);
  await page.waitForFunction(() => { const i = document.querySelector('#lgPasoContenido img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }); await page.click('#lgEscuchar'); assert.deepEqual(await spoken(page), ['Acercate al mostrador de atención.']);
  for (let i = 2; i <= 4; i++) { await page.click('#lgSiguiente'); assert.match(await page.textContent('#lgPasoContenido'), new RegExp(`Paso ${i} de 4`)); }
  assert.equal((await page.textContent('#lgSiguiente')).trim(), 'Listo'); await page.click('#lgSiguiente'); await page.waitForSelector('#lgMenu:not([hidden])'); assert.match(await page.textContent('#lgNombre'), /Biblioteca/); assert.deepEqual(errs, []); await ctx.close();
});
await test('Consultar horario: muestra solo el dato cargado por la institución, con su aclaración', async () => {
  const { page, ctx } = await abrir(); await aMenu(page); await page.click('#lgOpciones >> text=Consultar horario'); await page.waitForSelector('#lgPaso:not([hidden])');
  const t = await page.textContent('#lgPasoContenido'); const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lugares.json'), 'utf8')).lugares[0].opciones.find((o) => o.id === 'horario');
  assert.ok(t.includes(d.texto) && t.includes(d.aclaracion)); assert.ok(!/\d{1,2}:\d{2}/.test(t.replace(d.texto, '')), 'no hay otros horarios'); assert.match(await page.textContent('#lgPasoOrigen'), /EJEMPLO FICTICIO/); await ctx.close();
});
await test('Pedir ayuda: frases para el personal; Decir en voz alta y Mostrar en pantalla grande', async () => {
  const { page, errs, ctx } = await abrir(); await aMenu(page); await page.click('#lgOpciones >> text=Pedir ayuda'); await page.waitForSelector('#lgPaso:not([hidden])');
  await page.click('button[aria-label="Decir en voz alta: ¿Dónde está el baño?"]'); assert.deepEqual(await spoken(page), ['¿Dónde está el baño?']);
  await page.click('button[aria-label^="Mostrar en pantalla grande: Necesito ayuda"]'); await page.waitForSelector('#lgMostrarDlg[open]'); assert.equal((await page.textContent('#lgMostrarTexto')).trim(), 'Necesito ayuda, por favor.'); assert.ok((await page.$$('#lgMostrarPictos img')).length >= 2);
  const fs_ = await page.$eval('#lgMostrarTexto', (e) => parseFloat(getComputedStyle(e).fontSize)); assert.ok(fs_ >= 28, 'texto grande'); await page.click('#lgMostrarCerrar'); assert.equal(await page.isVisible('#lgMostrarDlg'), false); assert.deepEqual(errs, []); await ctx.close();
});
await test('volver: paso → menú (conserva el lugar) → ¿Dónde estás? → inicio; la guía conoce cada pantalla', async () => {
  const { page, errs, ctx } = await abrir(); await aMenu(page); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'lugarmenu');
  await page.click('#lgOpciones >> text=Pedir ayuda'); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'lugarpaso');
  await page.click('#view-lugares .back-btn'); await page.waitForSelector('#lgMenu:not([hidden])'); assert.match(await page.textContent('#lgNombre'), /Biblioteca/);
  await page.click('#view-lugares .back-btn'); await page.waitForSelector('#lgInicio:not([hidden])'); await page.click('#view-lugares .back-btn'); await page.waitForSelector('#view-inicio:not([hidden])'); assert.deepEqual(errs, []); await ctx.close();
});
await test('cámara: se enciende solo al tocar «Escanear QR», no inventa un lugar si no ve QR, y se apaga al apagarla y al salir', async () => {
  const { page, errs, ctx } = await abrir(); await aLugares(page); await page.click('#lgEscanear'); await page.waitForSelector('#lgScan:not([hidden])'); assert.equal(await page.evaluate(() => window.__gum), 1);
  assert.ok(await page.evaluate(() => window.__streams[0].getTracks().every((t) => t.readyState === 'live'))); assert.match(await page.textContent('#lgEstado'), /Apuntá la cámara/); await page.waitForTimeout(1200); assert.equal(await page.isVisible('#lgMenu'), false, 'sin QR no entra a ningún lugar');
  await page.click('#lgCerrarCamara'); assert.ok(await page.evaluate(() => window.__streams[0].getTracks().every((t) => t.readyState === 'ended')), 'apagada');
  await page.click('#lgEscanear'); await page.waitForSelector('#lgScan:not([hidden])'); await page.click('#view-lugares .back-btn'); await page.waitForSelector('#view-inicio:not([hidden])'); assert.ok(await page.evaluate(() => window.__streams[1].getTracks().every((t) => t.readyState === 'ended')), 'al salir se apaga');
  assert.deepEqual(errs, []); await ctx.close();
});
await test('cámara negada: lo explica y deja subir foto o elegir de la lista', async () => {
  const { page, errs, ctx } = await abrir({ camara: 'negada' }); await aLugares(page); await page.click('#lgEscanear'); await page.waitForFunction(() => /No se pudo usar la cámara/.test(document.getElementById('lgEstado').textContent));
  assert.equal(await page.isVisible('#lgScan'), false); assert.equal(await page.isEnabled('#lgSubir'), true); assert.deepEqual(errs, []); await ctx.close();
});
await test('un lugar sin responsable o sin fecha de actualización NO se muestra (no se inventan datos)', async () => {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lugares.json'), 'utf8')); const ok = { ...base.lugares[0], oculto: false };
  const { page, ctx } = await abrir({ lugaresJson: { lugares: [ok, { ...ok, id: 'sin-resp', nombre: 'Sin responsable', responsable: '' }, { ...ok, id: 'sin-fecha', nombre: 'Sin fecha', actualizado: '' }] } });
  await aLugares(page); await page.click('#lgLista'); assert.deepEqual(await page.$$eval('#lgListaLugares .big-txt', (n) => n.map((x) => x.textContent)), ['Biblioteca de demostración']); await ctx.close();
});
await test('sin conexión: tras una primera visita se puede elegir el lugar y pedir ayuda', async () => {
  const { page, ctx } = await abrir(); await page.evaluate(() => navigator.serviceWorker.ready); await page.goto(BASE); await page.waitForFunction(() => navigator.serviceWorker.controller); await page.waitForTimeout(1500);
  await ctx.setOffline(true); await page.goto(BASE); await page.waitForSelector('#claria'); await aLugares(page); await porQR(page, 'qr-biblioteca-demo.png'); await page.waitForSelector('#lgMenu:not([hidden])'); await page.click('#lgOpciones >> text=Pedir ayuda'); await page.waitForSelector('#lgPaso:not([hidden])');
  await page.waitForFunction(() => { const i = document.querySelector('#lgPasoContenido img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }); await ctx.close();
});
await test('móvil 390 px: sin desbordamiento en ninguna pantalla', async () => {
  const { page, ctx } = await abrir({ ancho: 390, alto: 800 }); const over = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(await over(), false, 'inicio'); await aLugares(page); assert.equal(await over(), false, 'dónde'); await porQR(page, 'qr-biblioteca-demo.png'); await page.waitForSelector('#lgMenu:not([hidden])'); assert.equal(await over(), false, 'menú');
  await page.click('#lgOpciones >> text=Inscribirme'); assert.equal(await over(), false, 'paso'); await page.click('#view-lugares .back-btn'); await page.click('#lgOpciones >> text=Pedir ayuda'); assert.equal(await over(), false, 'ayuda'); await ctx.close();
});
await test('accesibilidad: nombres accesibles y foco en el título de cada pantalla', async () => {
  const { page, ctx } = await abrir(); await aMenu(page); assert.equal(await page.evaluate(() => document.activeElement.id), 'lgMenuTitulo');
  const bad = await page.evaluate(() => [...document.querySelectorAll('#view-lugares button,#view-lugares input')].filter((e) => !e.closest('[hidden]') && !(e.getAttribute('aria-label') || e.textContent.trim())).map((e) => e.outerHTML.slice(0, 80))); assert.deepEqual(bad, []); await ctx.close();
});
srv.close(); await browser.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
