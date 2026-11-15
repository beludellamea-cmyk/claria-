// E2E de «Hablar con imágenes» (etapa 2). Sin red externa. Uso: node tests/e2e-tablero.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); if (u === '/config.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end('window.CLARIA_CONFIG={apiBase:""};'); }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(8016, r)); const BASE = 'http://localhost:8016/';
const browser = await chromium.launch(); const results = [];
const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n   ', e.message.split('\n')[0], (String(e.stack).match(/e2e-tablero\.mjs:\d+/) || [''])[0]); } };
async function abrir({ ancho = 1280, alto = 900, voz = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, acceptDownloads: true, serviceWorkers: 'allow' }); const page = await ctx.newPage(); const ext = [], errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) ext.push(u); });
  await page.addInitScript(({ voz }) => { window.__spoken = []; if (voz) { window.SpeechSynthesisUtterance = function (t) { this.text = t; }; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() {}, pause() {}, resume() {}, speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 20); } } }); } else { delete window.speechSynthesis; } }, { voz });
  await page.goto(BASE); await page.waitForSelector('#claria'); return { ctx, page, ext, errs };
}
const spoken = (p) => p.evaluate(() => window.__spoken);
const ir = async (page, cat) => { await page.click('#view-inicio [data-view="tablero"]'); await page.waitForSelector('#tbCategoriasLista .tb-cat'); if (cat) { await page.click(`[data-cat="${cat}"]`); await page.waitForSelector('#tbCategoria:not([hidden])'); } };
const tarj = (page) => page.$$eval('#tbTarjetas .tb-et', (n) => n.map((x) => x.textContent));

console.log('\nHablar con imágenes');
await test('inicio: tarjeta «Hablar con imágenes» y 6 categorías del kit, una pregunta por pantalla', async () => {
  const { page, errs, ctx } = await abrir(); assert.ok((await page.$$eval('#view-inicio .big-txt', (n) => n.map((x) => x.textContent))).includes('Hablar con imágenes'));
  await ir(page); assert.match(await page.textContent('#tbTitulo'), /¿Qué necesitás decir\?/);
  assert.deepEqual(await page.$$eval('.tb-cat .big-txt', (n) => n.map((x) => x.textContent)), ['Ayuda', 'Salud', 'Escuela', 'Transporte', 'Compras', 'Necesidades básicas']);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'tbTitulo'); assert.deepEqual(errs, []); await ctx.close();
});
await test('todo pictograma usado existe en el diccionario verificado y tiene su archivo local (nada inventado)', async () => {
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tablero.json'), 'utf8')), d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pictogramas.json'), 'utf8')); const map = new Map(d.entradas.map((e) => [e.lema, e.id]));
  for (const c of t.categorias) for (const l of [...c.palabras, ...c.frases.flatMap((f) => f.tarjetas)]) { assert.ok(map.has(l), `lema sin verificar: ${l}`); assert.ok(fs.existsSync(path.join(ROOT, `assets/picto/${map.get(l)}.png`)), `falta imagen de ${l}`); }
});
await test('frase rápida → tarjetas visibles y texto COMPLETO; «Decir en voz alta» pronuncia la frase entera y no arranca sola', async () => {
  const { page, errs, ctx } = await abrir(); await ir(page, 'salud'); assert.equal((await spoken(page)).length, 0);
  await page.click('.tb-frase-rapida >> text=Necesito un médico.'); assert.deepEqual(await tarj(page), ['necesitar', 'médico']); assert.equal(await page.inputValue('#tbTexto'), 'Necesito un médico.');
  assert.equal((await spoken(page)).length, 0, 'no habla antes de pedirlo'); await page.click('#tbDecir'); assert.deepEqual(await spoken(page), ['Necesito un médico.']);
  assert.ok(await page.$eval('#tbTarjetas img', (i) => i.complete && i.naturalWidth > 0)); assert.deepEqual(errs, []); await ctx.close();
});
await test('armar con palabras: agregar, reordenar, quitar; el texto se actualiza solo hasta que la persona lo edita', async () => {
  const { page, ctx } = await abrir(); await ir(page, 'basicas');
  await page.click('.tb-palabra >> text=agua'); await page.click('.tb-palabra >> text=sed'); assert.deepEqual(await tarj(page), ['agua', 'sed']); assert.equal(await page.inputValue('#tbTexto'), 'Agua sed.');
  await page.click('button[aria-label="Mover antes sed"]'); assert.deepEqual(await tarj(page), ['sed', 'agua']); await page.click('button[aria-label="Quitar agua"]'); assert.deepEqual(await tarj(page), ['sed']);
  await page.fill('#tbTexto', 'Tengo mucha sed.'); await page.click('.tb-palabra >> text=agua'); assert.equal(await page.inputValue('#tbTexto'), 'Tengo mucha sed.', 'no pisa lo que escribió la persona');
  await page.click('#tbUsarTarjetas'); assert.equal(await page.inputValue('#tbTexto'), 'Sed agua.'); await ctx.close();
});
await test('cambiar pictograma: solo ofrece pictogramas verificados y reemplaza la tarjeta', async () => {
  const { page, ctx } = await abrir(); await ir(page, 'compras'); await page.click('.tb-palabra >> text=pan'); await page.click('button[aria-label="Cambiar pictograma de pan"]'); await page.waitForSelector('#tbDialogo[open]');
  await page.fill('#tbBuscar', 'leche'); await page.click('#tbOpciones .tb-palabra >> text=leche'); assert.deepEqual(await tarj(page), ['leche']);
  await page.click('button[aria-label="Cambiar pictograma de leche"]'); await page.fill('#tbBuscar', 'zzzxx'); assert.match(await page.textContent('#tbOpciones'), /No hay pictogramas verificados/); await page.click('#tbCancelarCambio'); await ctx.close();
});
await test('guardar frase en el dispositivo → Mis frases (decir, usar, borrar); sobrevive a recargar; sin red', async () => {
  const { page, ext, ctx } = await abrir(); await ir(page, 'escuela'); await page.click('.tb-frase-rapida >> text=Quiero ir al baño.'); await page.click('#tbGuardar'); assert.match(await page.textContent('#tbEstado'), /guardada en este dispositivo/);
  await page.click('#tbGuardar'); assert.match(await page.textContent('#tbEstado'), /ya estaba guardada/);
  await page.goto(BASE); await page.waitForSelector('#claria'); await page.click('#view-inicio [data-view="tablero"]'); await page.waitForFunction(() => /Mis frases \(1\)/.test(document.getElementById('tbVerGuardadas').textContent));
  await page.click('#tbVerGuardadas'); await page.waitForSelector('#tbGuardadas:not([hidden])'); assert.match(await page.textContent('#tbGuardadasLista'), /Quiero ir al baño\./);
  await page.click('button[aria-label^="Decir en voz alta: Quiero ir al baño"]'); assert.deepEqual(await spoken(page), ['Quiero ir al baño.']);
  await page.click('button[aria-label^="Usar esta frase"]'); await page.waitForSelector('#tbCategoria:not([hidden])'); assert.deepEqual(await tarj(page), ['querer', 'ir', 'baño']);
  await page.click('#view-tablero [data-back]'); await page.click('#tbVerGuardadas'); await page.click('button[aria-label^="Borrar"]'); assert.match(await page.textContent('#tbGuardadasVacio'), /Todavía no guardaste/);
  assert.deepEqual(ext, [], 'sin llamadas externas'); await ctx.close();
});
await test('compartir imagen: genera un PNG real con las tarjetas (descarga cuando no hay Web Share)', async () => {
  const { page, ctx } = await abrir(); await ir(page, 'ayuda'); await page.click('.tb-frase-rapida >> text=No entiendo.');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#tbCompartir')]); assert.equal(dl.suggestedFilename(), 'frase-claria.png');
  const buf = fs.readFileSync(await dl.path()); assert.equal(buf.slice(1, 4).toString(), 'PNG'); assert.ok(buf.length > 20000, 'imagen con contenido'); assert.match(await page.textContent('#tbEstado'), /Revisá que diga lo que querés/); await ctx.close();
});
await test('sin voz en el navegador: lo dice claramente y no se rompe', async () => {
  const { page, errs, ctx } = await abrir({ voz: false }); await ir(page, 'ayuda'); await page.click('.tb-frase-rapida >> text=Gracias.'); await page.click('#tbDecir'); assert.match(await page.textContent('#tbEstado'), /no tiene voz/); assert.deepEqual(errs, []); await ctx.close();
});
await test('navegación: volver paso a paso y la guía conoce cada pantalla; enfoque en el título', async () => {
  const { page, errs, ctx } = await abrir(); await ir(page, 'compras'); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'tablerocat'); assert.equal(await page.evaluate(() => document.activeElement.id), 'tbCatTitulo');
  await page.click('#view-tablero .back-btn'); await page.waitForSelector('#tbCategorias:not([hidden])'); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'tablero');
  await page.click('#view-tablero .back-btn'); await page.waitForSelector('#view-inicio:not([hidden])'); assert.deepEqual(errs, []); await ctx.close();
});
await test('sin conexión: tras la primera visita el tablero funciona con el service worker', async () => {
  const { page, ctx } = await abrir(); await page.evaluate(() => navigator.serviceWorker.ready); await page.goto(BASE); await page.waitForSelector('#claria');
  await page.waitForFunction(() => navigator.serviceWorker.controller); await page.evaluate(async () => { const rs = [...document.querySelectorAll('img')]; await new Promise((r) => setTimeout(r, 300)); });
  await ir(page, 'basicas'); await page.click('.tb-frase-rapida >> text=Tengo hambre.'); await page.waitForTimeout(500);
  await ctx.setOffline(true); await page.goto(BASE); await page.waitForSelector('#claria'); await page.click('#view-inicio [data-view="tablero"]'); await page.waitForSelector('#tbCategoriasLista .tb-cat');
  await page.click('[data-cat="basicas"]'); await page.click('.tb-frase-rapida >> text=Tengo hambre.'); assert.deepEqual(await tarj(page), ['tener', 'hambre']);
  assert.ok(await page.$eval('#tbTarjetas img', (i) => i.complete && i.naturalWidth > 0), 'las imágenes se ven sin conexión'); await page.click('#tbDecir'); assert.deepEqual(await spoken(page), ['Tengo hambre.']); await ctx.close();
});
await test('móvil 390 px: sin desbordamiento en categorías, tablero y frase', async () => {
  const { page, ctx } = await abrir({ ancho: 390, alto: 800 }); const over = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(await over(), false, 'inicio'); await ir(page); assert.equal(await over(), false, 'categorías'); await page.click('[data-cat="transporte"]'); assert.equal(await over(), false, 'tablero');
  await page.click('.tb-frase-rapida >> text=Quiero ir a mi casa.'); assert.equal(await over(), false, 'frase'); await ctx.close();
});
await test('accesibilidad: botones con nombre accesible y etiquetas en los campos', async () => {
  const { page, ctx } = await abrir(); await ir(page, 'ayuda'); await page.click('.tb-frase-rapida >> text=No entiendo.');
  const bad = await page.evaluate(() => [...document.querySelectorAll('#view-tablero button,#view-tablero textarea,#view-tablero input')].filter((e) => !e.closest('[hidden]') && !e.closest('dialog:not([open])') && !(e.getAttribute('aria-label') || e.textContent.trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)))).map((e) => e.outerHTML.slice(0, 80))); assert.deepEqual(bad, []); await ctx.close();
});
srv.close(); await browser.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
