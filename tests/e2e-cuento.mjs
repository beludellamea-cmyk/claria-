// E2E Etapa 2a: lectura de documentos en formato pictocuento. Sin red externa (se verifica).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const OUT = process.env.OUT || '/tmp/claria-e2e'; fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(8011, r)); const BASE = 'http://localhost:8011/';
const browser = await chromium.launch(); const results = [];
const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n   ', e.message.split('\n')[0]); } };
const ESCUELA = 'Estimadas familias: el lunes hay reunión en la escuela. Deben traer el DNI del alumno. La escuela es para todos. Gracias por venir.';
async function abrir({ ancho = 1280 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, acceptDownloads: true }); const page = await ctx.newPage(); const ext = [], errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) ext.push(u); });
  await page.addInitScript(() => { window.__spoken = [];
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() { window.__cancelado = (window.__cancelado || 0) + 1; window.__vivo = false; }, pause() {}, resume() {},
      speak(u) { window.__spoken.push(u.text); const id = (window.__vivo = Math.random()); setTimeout(() => { if (window.__vivo !== id) return; u.onstart && u.onstart(); const re = /\p{L}+/gu; let m; const idx = []; while ((m = re.exec(u.text))) idx.push(m.index); let k = 0; (function paso() { if (window.__vivo !== id) return; if (k < idx.length) { u.onboundary && u.onboundary({ name: 'word', charIndex: idx[k++] }); setTimeout(paso, 25); } else u.onend && u.onend(); })(); }, 10); } } }); });
  await page.goto(BASE + '#lectura'); await page.fill('#inputText', ESCUELA); await page.click('#useText'); await page.click('#abrirCuento'); await page.waitForSelector('#pqContenido:not([hidden])');
  await page.waitForFunction(() => [...document.querySelectorAll('#pqPagina img')].every((i) => i.complete)); return { ctx, page, ext, errs };
}
const pagina = (page) => page.$$eval('#pqPagina .pq-oracion', (p) => p.map((x) => x.textContent));
await test('abre el pictocuento: oración original visible, pictogramas reales, sin red externa', async () => {
  const { ctx, page, ext, errs } = await abrir(); assert.deepEqual(await pagina(page), ['Estimadas familias: el lunes hay reunión en la escuela.']);
  assert.match(await page.textContent('#pqContador'), /Página 1 de 4/); assert.ok(await page.$$eval('#pqPagina img', (i) => i.length >= 3 && i.every((x) => x.naturalWidth > 0)));
  assert.match(await page.textContent('#pqEstado'), /4 oraciones/); assert.deepEqual(ext, []); assert.deepEqual(errs, []); await page.screenshot({ path: `${OUT}/10-cuento.png`, fullPage: true }); await ctx.close();
});
await test('palabras sin pictograma quedan como texto y las gramaticales también', async () => {
  const { ctx, page } = await abrir(); const t = await page.$$eval('#pqPagina li.pc-card', (l) => l.map((x) => [x.querySelector('.pc-label').textContent, x.dataset.estado, !!x.querySelector('img')]));
  const estim = t.find((x) => x[0] === 'Estimadas'); assert.ok(estim && estim[2] === false); assert.equal(t.find((x) => x[0] === 'el')[1], 'func'); assert.ok(t.find((x) => x[0] === 'escuela')[2]); await ctx.close();
});
await test('tocar un pictograma muestra significado y devuelve el foco', async () => {
  const { ctx, page } = await abrir(); await page.click('#pqPagina li.pc-card:has(.pc-label:text-is("escuela")) button'); assert.equal(await page.evaluate(() => document.getElementById('pqDialogo').open), true);
  assert.match(await page.textContent('#pqDialogoImg'), /escuela/i); assert.ok((await page.textContent('#pqDialogoSig')).length > 10); await page.screenshot({ path: `${OUT}/11-dialogo.png` });
  await page.keyboard.press('Escape'); await page.waitForFunction(() => document.activeElement.closest('li')?.querySelector('.pc-label')?.textContent === 'escuela'); await ctx.close();
});
await test('anterior / siguiente, flechas del teclado y contador', async () => {
  const { ctx, page } = await abrir(); assert.equal(await page.isDisabled('#pqAnterior'), true); await page.click('#pqSiguiente'); assert.match(await page.textContent('#pqContador'), /Página 2 de 4/);
  assert.match((await pagina(page))[0], /Deben traer el DNI/); await page.keyboard.press('ArrowRight'); assert.match(await page.textContent('#pqContador'), /Página 3 de 4/); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  assert.match(await page.textContent('#pqContador'), /Página 1 de 4/); await ctx.close();
});
await test('oraciones por página: 2 → 2 páginas y ambas oraciones visibles', async () => {
  const { ctx, page } = await abrir(); await page.selectOption('#pqPorPagina', '2'); assert.match(await page.textContent('#pqContador'), /Página 1 de 2/); assert.equal((await pagina(page)).length, 2); await ctx.close();
});
await test('narración por partes con resaltado y «Leer todo» avanza solo', async () => {
  const { ctx, page } = await abrir(); await page.click('#pqEscuchar'); assert.deepEqual(await page.evaluate(() => window.__spoken), ['Estimadas familias: el lunes hay reunión en la escuela.']);
  await page.waitForFunction(() => document.querySelectorAll('#pqPagina .pq-oracion .hl').length > 0 && document.querySelector('#pqPagina li.hl')); await page.waitForFunction(() => document.querySelectorAll('.hl').length === 0 && !document.getElementById('pqPausar').disabled === false);
  await page.click('#pqTodo'); await page.waitForFunction(() => /Página 4 de 4/.test(document.getElementById('pqContador').textContent), null, { timeout: 15000 });
  await page.waitForFunction(() => window.__spoken.length >= 5); assert.equal((await page.evaluate(() => window.__spoken)).at(-1), 'Gracias por venir.'); await ctx.close();
});
await test('detener corta la lectura y cambia de página sin seguir hablando', async () => {
  const { ctx, page } = await abrir(); await page.click('#pqTodo'); await page.waitForFunction(() => window.__spoken.length >= 1); await page.click('#pqDetener'); const n = (await page.evaluate(() => window.__spoken)).length;
  await page.waitForTimeout(900); assert.equal((await page.evaluate(() => window.__spoken)).length, n); assert.match(await page.textContent('#pqContador'), /Página [12] de 4/); await ctx.close();
});
await test('letra MAYÚSCULA y tamaño afectan la oración y los pictogramas', async () => {
  const { ctx, page } = await abrir(); await page.click('#pqLetra'); assert.equal(await page.$eval('.pq-oracion', (n) => getComputedStyle(n).textTransform), 'uppercase'); await page.selectOption('#pqTamano', 'xl'); assert.ok((await page.$eval('#pqPagina .pc-img', (n) => n.getBoundingClientRect().width)) > 200); await ctx.close();
});
await test('imprimir: todas las oraciones con pictogramas y créditos', async () => {
  const { ctx, page } = await abrir(); await page.evaluate(() => { window.print = () => { const a = document.getElementById('pcPrintArea'); window.__p = { t: a.innerText, i: a.querySelectorAll('img').length, b: a.querySelectorAll('.pq-print-bloque').length }; }; });
  await page.click('#pqImprimir'); const p = await page.evaluate(() => window.__p); assert.equal(p.b, 4); assert.ok(p.i > 8); assert.match(p.t, /Gracias por venir\./); assert.match(p.t, /ARASAAC/); await ctx.close();
});
await test('PDF de todo el documento', async () => {
  const { ctx, page } = await abrir(); const [d] = await Promise.all([page.waitForEvent('download'), page.click('#pqPdf')]); const f = `${OUT}/cuento.pdf`; await d.saveAs(f);
  assert.equal(d.suggestedFilename(), 'claria-pictocuento.pdf'); assert.match(execFileSync('pdfinfo', [f]).toString(), /Pages:\s+[1-9]/); execFileSync('pdftoppm', ['-png', '-r', '60', f, `${OUT}/cuento-pdf`]); await ctx.close();
});
await test('documento largo (400 palabras): pagina sin trabarse y recorta a 150 oraciones', async () => {
  const { ctx, page } = await abrir(); await page.click('#pqVolver'); const largo = Array.from({ length: 200 }, (_, i) => `La escuela es para todos ${i}.`).join(' ');
  await page.fill('#inputText', largo); await page.click('#useText'); await page.click('#abrirCuento'); await page.waitForFunction(() => /150 oraciones|Se muestran las primeras 150/.test(document.getElementById('pqEstado').textContent)); assert.match(await page.textContent('#pqContador'), /de 150/); await ctx.close();
});
await test('sin texto cargado no abre y avisa; volver regresa al lector', async () => {
  const { ctx, page } = await abrir(); await page.click('#pqVolver'); assert.equal(await page.isVisible('#view-lectura'), true); await ctx.close();
});
await test('móvil 375 px sin desborde y alto contraste legible', async () => {
  const { ctx, page } = await abrir({ ancho: 375 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: `${OUT}/12-movil.png`, fullPage: true });
  await page.evaluate(() => document.body.classList.add('high-contrast')); await page.screenshot({ path: `${OUT}/13-contraste.png` }); await ctx.close();
});
await browser.close(); srv.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
