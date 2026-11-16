// E2E de «Decilo con pictogramas»: elección de dos caminos + «Mostrar a otra persona» (pantalla completa) reutilizando convertidor y comunicador.
// ARASAAC (imágenes) se sirve con una imagen grabada; sin Worker ni IA. Uso: node tests/e2e-decilo.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); if (u === '/config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end('window.CLARIA_CONFIG={apiBase:""};'); }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(8040, r)); const BASE = 'http://localhost:8040/'; const fxPng = fs.readFileSync(path.join(ROOT, 'tests/fixtures/martillo.png'));
const browser = await chromium.launch(); const results = [];
const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n    ', String(e.message).split('\n')[0], (String(e.stack).match(/e2e-decilo\.mjs:\d+/) || [''])[0]); } };
async function abrir({ ancho = 1280, alto = 900, share = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, acceptDownloads: true, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [], ext = [], posts = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => { const u = r.url(); if (r.method() === 'POST') posts.push(u); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) ext.push(u); });
  await page.route('https://static.arasaac.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: fxPng }));
  await page.addInitScript((share) => { window.__spoken = []; window.__shared = null; window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() {}, pause() {}, resume() {}, speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onstart && u.onstart(), 0); setTimeout(() => u.onend && u.onend(), 10); } } });
    if (share) { navigator.canShare = (d) => !!(d && d.files && d.files.length); navigator.share = async (d) => { window.__shared = { n: d.files[0].name, t: d.files[0].type, s: d.files[0].size, title: d.title }; }; } }, share);
  await page.goto(BASE); await page.waitForSelector('#claria'); await page.waitForFunction(() => document.getElementById('modeLabel').textContent.length > 0); return { ctx, page, errs, ext, posts };
}
const aEscribir = async (page) => { await page.click('#view-inicio [data-view="decilo"]'); await page.click('#dcEscribir'); await page.waitForSelector('#pcConvertir:not([disabled])'); };
const convertir = async (page, t) => { await page.fill('#pcTexto', t); await page.click('#pcConvertir'); await page.waitForSelector('#pcTablero li'); await page.waitForFunction(() => [...document.querySelectorAll('#pcTablero img')].every((i) => i.complete)); };
const mostrar = async (page) => { await page.click('#pcMostrar'); await page.waitForSelector('#pcMostrarDlg[open]'); await page.waitForFunction(() => [...document.querySelectorAll('#pcMostrarBoard img')].every((i) => i.complete)); };
const spoken = (p) => p.evaluate(() => window.__spoken);

console.log('\nDecilo con pictogramas · elección');
await test('inicio: tarjeta «Decilo con pictogramas» → dos opciones claras, créditos ARASAAC, nada se habla ni se envía', async () => {
  const { page, ext, posts, ctx } = await abrir(); assert.ok((await page.$$eval('#view-inicio .big-txt', (n) => n.map((x) => x.textContent))).includes('Decilo con pictogramas'));
  await page.click('#view-inicio [data-view="decilo"]'); assert.equal(await page.isVisible('#view-decilo'), true); assert.equal(await page.textContent('#dcTitulo'), 'Decilo con pictogramas');
  assert.deepEqual(await page.$$eval('#view-decilo .big-txt', (n) => n.map((x) => x.textContent)), ['Escribir y mostrar', 'Elegir imágenes para hablar']); assert.match(await page.textContent('#view-decilo .pc-credit'), /ARASAAC.*Sergio Palao.*CC BY-NC-SA/s);
  assert.deepEqual(await spoken(page), []); assert.deepEqual(posts, []); assert.deepEqual(ext, []); await ctx.close();
});
await test('«Elegir imágenes para hablar» abre el comunicador existente: armar frase con tarjetas y decirla SOLO al tocar; Volver regresa a la elección', async () => {
  const { page, errs, ctx } = await abrir(); await page.click('#view-inicio [data-view="decilo"]'); await page.click('#dcElegir'); await page.waitForSelector('#tbCategoriasLista .tb-cat'); assert.equal(await page.isVisible('#tbCategorias'), true);
  await page.click('#tbCategoriasLista .tb-cat >> nth=0'); await page.click('#tbFrasesRapidas li:nth-child(1) button'); assert.ok((await page.inputValue('#tbTexto')).length > 3); assert.deepEqual(await spoken(page), []); await page.click('#tbDecir'); assert.equal((await spoken(page)).length, 1);
  await page.click('#view-tablero .back-btn >> visible=true'); await page.waitForSelector('#tbCategorias:not([hidden])'); await page.click('#view-tablero .back-btn >> visible=true'); await page.waitForSelector('#view-decilo:not([hidden])'); assert.deepEqual(errs, []); await ctx.close();
});
await test('«Escribir y mostrar» usa el convertidor existente (no hay otro): escribir → convertir → botón principal MOSTRAR A OTRA PERSONA', async () => {
  const { page, ctx } = await abrir(); await aEscribir(page); assert.equal(await page.locator('textarea').count() > 0, true); assert.equal(await page.isVisible('#pcMostrar'), false, 'sin resultado no aparece');
  await convertir(page, 'QUIERO AGUA'); assert.equal(await page.isVisible('#pcMostrar'), true); assert.match(await page.textContent('#pcMostrar'), /MOSTRAR A OTRA PERSONA/); assert.equal(await page.evaluate(() => document.querySelectorAll('[id=pcConvertir]').length), 1);
  const y = await page.$eval('#pcMostrar', (b) => b.getBoundingClientRect().top), yb = await page.$eval('#pcTablero', (b) => b.getBoundingClientRect().top); assert.ok(y < yb, 'el botón está antes de los pictogramas'); await ctx.close();
});
console.log('\nDecilo con pictogramas · mostrar a otra persona');
await test('MOSTRAR abre el mensaje a pantalla completa: pictogramas grandes, frase legible, crédito ARASAAC y 5 acciones', async () => {
  const { page, ctx } = await abrir({ ancho: 390, alto: 800 }); await aEscribir(page); await convertir(page, 'QUIERO AGUA'); await mostrar(page);
  const r = await page.$eval('#pcMostrarDlg', (d) => { const b = d.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height), innerWidth, innerHeight]; }); assert.deepEqual(r.slice(0, 2), r.slice(2), 'ocupa toda la pantalla');
  const imgs = await page.$$eval('#pcMostrarBoard img', (n) => n.map((i) => i.offsetWidth)); assert.ok(imgs.length >= 2 && imgs.every((w) => w >= 130), 'pictogramas grandes: ' + imgs);
  const fs = await page.$eval('#pcMostrarTexto', (t) => parseFloat(getComputedStyle(t).fontSize)); assert.ok(fs >= 20, 'texto grande ' + fs); assert.match(await page.textContent('#pcMostrarTexto'), /QUIERO AGUA/); assert.match(await page.textContent('#pcMostrarDlg .pc-mostrar-credito'), /ARASAAC.*Sergio Palao.*CC BY-NC-SA/);
  assert.deepEqual(await page.$$eval('#pcMostrarDlg .pc-mostrar-barra button', (b) => b.map((x) => x.textContent.trim())), ['▶ Escuchar', '✎ Cambiar un pictograma', '⬇ Descargar', '↗ Compartir', 'Volver']);
  const chicos = await page.$$eval('#pcMostrarDlg .pc-mostrar-barra button', (b) => b.filter((x) => x.getBoundingClientRect().height < 44).length); assert.equal(chicos, 0); assert.equal(await page.evaluate(() => { const d = document.getElementById('pcMostrarDlg'); return d.scrollWidth <= innerWidth + 1; }), true);
  assert.equal(await page.$$eval('#pcMostrarBoard .pc-badge', (n) => n.filter((b) => getComputedStyle(b).display !== 'none').length), 0, 'sin rótulos técnicos al mostrarlo'); await ctx.close();
});
await test('pocos pasos: inicio → Decilo → Escribir y mostrar → escribir → convertir → Mostrar (5 toques, sin menús intermedios)', async () => {
  const { page, ctx } = await abrir(); let toques = 0; await page.click('#view-inicio [data-view="decilo"]'); toques++; await page.click('#dcEscribir'); toques++; await page.waitForSelector('#pcConvertir:not([disabled])'); await page.fill('#pcTexto', 'NECESITO AYUDA'); await page.click('#pcConvertir'); toques++; await page.waitForSelector('#pcTablero li'); await page.click('#pcMostrar'); toques++;
  await page.waitForSelector('#pcMostrarDlg[open]'); assert.ok(toques <= 5); await ctx.close();
});
await test('Escuchar: dice la frase solo al tocar, una vez', async () => {
  const { page, ctx } = await abrir(); await aEscribir(page); await convertir(page, 'QUIERO AGUA'); await mostrar(page); assert.deepEqual(await spoken(page), []); await page.click('#pcMEscuchar'); assert.deepEqual(await spoken(page), ['QUIERO AGUA']); await ctx.close();
});
await test('Cambiar un pictograma: modo edición, abre el selector existente y «solo la palabra» conserva el texto grande', async () => {
  const { page, ctx } = await abrir(); await aEscribir(page); await convertir(page, 'QUIERO AGUA'); await mostrar(page);
  assert.equal(await page.locator('#pcMostrarBoard .pc-card button').count(), 0, 'en modo mostrar un toque accidental no abre nada'); await page.click('#pcMEditar'); assert.equal(await page.getAttribute('#pcMEditar', 'aria-pressed'), 'true'); assert.match(await page.textContent('#pcMostrarAviso'), /Tocá el pictograma/);
  await page.click('#pcMostrarBoard .pc-card:not(.func) button >> nth=1'); await page.waitForSelector('#pcDialogo[open]'); assert.match(await page.textContent('#pcDialogoTitulo'), /Elegir pictograma para/); await page.click('#pcSoloTexto'); await page.waitForSelector('#pcDialogo:not([open])', { state: 'attached' }); assert.equal(await page.isVisible('#pcMostrarDlg'), true, 'sigue en pantalla completa');
  await page.click('#pcMEditar'); const sin = await page.$$eval('#pcMostrarBoard .pc-card[data-estado=texto]', (n) => n.map((c) => [c.querySelector('img') ? 'img' : 'sin', c.textContent])); assert.equal(sin.length, 1); assert.equal(sin[0][0], 'sin'); assert.match(sin[0][1], /AGUA/i);
  assert.equal(await page.$$eval('#pcTablero .pc-card[data-estado=texto]', (n) => n.length), 1, 'el cambio también quedó en el convertidor'); await ctx.close();
});
await test('palabra sin pictograma confiable: se conserva el texto, se avisa y se puede elegir otra imagen o buscar en ARASAAC', async () => {
  const { page, ctx } = await abrir(); await aEscribir(page); await convertir(page, 'QUIERO XQZWK'); await mostrar(page);
  const c = await page.$$eval('#pcMostrarBoard .pc-card', (n) => n.map((x) => [x.dataset.estado, !!x.querySelector('img'), x.textContent])); const raro = c.find((x) => /XQZWK/i.test(x[2])); assert.ok(raro && !raro[1], 'solo texto'); assert.match(await page.textContent('#pcMostrarAviso'), /palabra.*para revisar/);
  await page.click('#pcMEditar'); await page.click('#pcMostrarBoard .pc-card[data-estado=sin] button'); await page.waitForSelector('#pcDialogo[open]'); assert.equal(await page.isVisible('#pcBuscar'), true); assert.match(await page.textContent('#pcBuscarAviso'), /ARASAAC/); await page.click('#pcCerrar'); await ctx.close();
});
await test('Descargar baja un PNG real; Compartir usa el menú del sistema si existe y si no, descarga', async () => {
  const a = await abrir({ share: true }); await aEscribir(a.page); await convertir(a.page, 'QUIERO AGUA'); await mostrar(a.page);
  const [d] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#pcMDescargar')]); assert.equal(d.suggestedFilename(), 'claria-pictogramas.png'); const buf = fs.readFileSync(await d.path()); assert.equal(buf.subarray(1, 4).toString(), 'PNG'); assert.ok(buf.length > 8000);
  await a.page.click('#pcMCompartir'); await a.page.waitForFunction(() => window.__shared); const sh = await a.page.evaluate(() => window.__shared); assert.deepEqual([sh.n, sh.t], ['mensaje-claria.png', 'image/png']); assert.ok(sh.s > 8000); assert.match(await a.page.textContent('#pcMEstado'), /Listo para enviar/); await a.ctx.close();
  const b = await abrir(); await aEscribir(b.page); await convertir(b.page, 'QUIERO AGUA'); await mostrar(b.page); const [d2] = await Promise.all([b.page.waitForEvent('download'), b.page.click('#pcMCompartir')]); assert.equal(d2.suggestedFilename(), 'mensaje-claria.png'); await b.page.waitForFunction(() => /se descargó/.test(document.getElementById('pcMEstado').textContent)); await b.ctx.close();
});
await test('Volver y Escape cierran y devuelven el foco al botón principal; nada queda hablando; sin errores ni envíos', async () => {
  const { page, errs, posts, ctx } = await abrir(); await aEscribir(page); await convertir(page, 'HOLA'); await mostrar(page); await page.click('#pcMCerrar'); await page.waitForSelector('#pcMostrarDlg:not([open])', { state: 'attached' }); assert.equal(await page.evaluate(() => document.activeElement.id), 'pcMostrar');
  await mostrar(page); await page.keyboard.press('Escape'); await page.waitForSelector('#pcMostrarDlg:not([open])', { state: 'attached' }); assert.deepEqual(errs, []); assert.deepEqual(posts, []); await ctx.close();
});
await test('el resto del convertidor sigue igual: Escuchar, Descargar PDF y Modificar siguen disponibles', async () => {
  const { page, ctx } = await abrir(); await aEscribir(page); await convertir(page, 'QUIERO AGUA'); for (const id of ['pcEscuchar', 'pcEditar', 'pcPng', 'pcPdf']) assert.equal(await page.isVisible('#' + id), true, id); await ctx.close();
});
console.log('\nDecilo con pictogramas · móvil y guía');
await test('móvil 390 px: elección y pantalla del convertidor sin desborde; CLARIA acompaña con su explicación', async () => {
  const { page, ctx } = await abrir({ ancho: 390, alto: 800 }); const ok = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  await page.click('#view-inicio [data-view="decilo"]'); assert.ok(await ok()); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'decilo'); const h = await page.$$eval('#view-decilo .dc-op', (b) => b.map((x) => Math.round(x.getBoundingClientRect().height))); assert.ok(h.every((x) => x >= 120), String(h));
  await page.click('#dcEscribir'); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'escribir'); await page.waitForSelector('#pcConvertir:not([disabled])'); await convertir(page, 'QUIERO AGUA'); assert.ok(await ok()); await page.click('#view-escribir .back-btn >> visible=true'); assert.equal(await page.isVisible('#view-decilo'), true); await ctx.close();
});
srv.close(); await browser.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
