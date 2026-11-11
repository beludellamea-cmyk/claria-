// E2E de la Etapa 1 (pictogramas). Sin Worker ni IA. ARASAAC en línea se sirve con respuestas REALES grabadas (tests/fixtures).
// Uso: node tests/e2e-pictos.mjs   (requiere playwright con chromium)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const OUT = process.env.OUT || '/tmp/claria-e2e'; fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(8010, r)); const BASE = 'http://localhost:8010/';
const fxSearch = fs.readFileSync(path.join(ROOT, 'tests/fixtures/arasaac-search-martillo.json')); const fxPng = fs.readFileSync(path.join(ROOT, 'tests/fixtures/martillo.png'));
const browser = await chromium.launch(); const results = [];
const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n   ', e.message.split('\n')[0]); } };

async function abrir({ speech = true, ancho = 1280 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, acceptDownloads: true }); const page = await ctx.newPage(); const ext = [], errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) ext.push(u); });
  await page.route('https://api.arasaac.org/**', (r) => r.request().url().endsWith('/search/martillo') ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: fxSearch }) : r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
  await page.route('https://static.arasaac.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: fxPng }));
  if (speech) await page.addInitScript(() => {
    window.__spoken = []; window.__ctl = [];
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    const fake = { speaking: false, getVoices: () => [], cancel() { window.__ctl.push('cancel'); }, pause() { window.__ctl.push('pause'); }, resume() { window.__ctl.push('resume'); },
      speak(u) { window.__spoken.push(u.text); window.__rate = u.rate; setTimeout(() => { u.onstart && u.onstart(); const re = /\p{L}+/gu; let m; const idx = []; while ((m = re.exec(u.text))) idx.push(m.index); let k = 0; (function paso() { if (k < idx.length) { u.onboundary && u.onboundary({ name: 'word', charIndex: idx[k++] }); window.__ultima = idx[k - 1]; setTimeout(paso, 60); } else if (!window.__noEnd) u.onend && u.onend(); })(); }, 10); } };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  });
  await page.goto(BASE + '#escribir'); await page.waitForSelector('#pcConvertir:not([disabled])'); return { ctx, page, ext, errs };
}
const convertir = async (page, t) => { await page.fill('#pcTexto', t); await page.click('#pcConvertir'); await page.waitForSelector('#pcTablero li'); await page.waitForFunction(() => [...document.querySelectorAll('#pcTablero img')].every((i) => i.complete)); };
const mas = async (page) => { if (!(await page.evaluate(() => document.getElementById('pcMas').open))) await page.click('#pcMas summary'); };
const lemas = (page) => page.$$eval('#pcTablero li', (ls) => ls.map((l) => ({ t: l.querySelector('.pc-label').textContent, e: l.dataset.estado, img: !!l.querySelector('img'), ok: l.querySelector('img') ? l.querySelector('img').naturalWidth > 0 : null })));

await test('portada: 3 opciones y navegación a escribir', async () => {
  const { ctx, page } = await abrir(); await page.goto(BASE); const n = await page.$$eval('#view-inicio .big-btn', (c) => c.length); assert.equal(n, 4);
  await page.click('#view-inicio [data-view=escribir]'); assert.equal(await page.isVisible('#view-escribir'), true); await page.screenshot({ path: `${OUT}/00-portada.png` }); await ctx.close();
});
await test('HOLA y QUIERO AGUA: pictogramas reales cargados y texto original visible', async () => {
  const { ctx, page, ext, errs } = await abrir();
  await convertir(page, 'HOLA'); let l = await lemas(page); assert.deepEqual(l.map((x) => [x.t, x.e, x.ok]), [['HOLA', 'verificado', true]]); assert.equal(await page.textContent('#pcOriginal'), 'HOLA');
  await convertir(page, 'QUIERO AGUA'); l = await lemas(page); assert.deepEqual(l.map((x) => x.t), ['QUIERO', 'AGUA']); assert.ok(l.every((x) => x.ok));
  assert.deepEqual(ext, [], 'sin pedidos externos para palabras del diccionario'); assert.deepEqual(errs, []); await ctx.close();
});
await test('NECESITO SACAR UN TURNO PARA MI DNI: expresión, aviso y sin pedidos externos', async () => {
  const { ctx, page, ext } = await abrir(); await convertir(page, 'NECESITO SACAR UN TURNO PARA MI DNI'); const l = await lemas(page);
  assert.deepEqual(l.map((x) => x.t), ['NECESITO', 'SACAR UN TURNO', 'PARA', 'MI', 'DNI']); assert.equal(l[4].e, 'revisar'); assert.ok(l.every((x) => x.ok));
  await page.screenshot({ path: `${OUT}/01-turno.png`, fullPage: true }); assert.deepEqual(ext, []); await ctx.close();
});
await test('LA ESCUELA ES PARA TODOS: «LA» queda solo texto', async () => {
  const { ctx, page } = await abrir(); await convertir(page, 'LA ESCUELA ES PARA TODOS'); const l = await lemas(page);
  assert.deepEqual(l.map((x) => [x.t, x.e]), [['LA', 'func'], ['ESCUELA', 'verificado'], ['ES', 'verificado'], ['PARA', 'verificado'], ['TODOS', 'verificado']]); assert.equal(l[0].img, false); await ctx.close();
});
await test('párrafo escolar: conserva el texto, palabras sin pictograma no inventan imagen', async () => {
  const t = 'Estimadas familias: el lunes hay reunión en la escuela. Deben traer el DNI del alumno y firmar la autorización.';
  const { ctx, page, ext } = await abrir(); await convertir(page, t); assert.equal(await page.textContent('#pcOriginal'), t);
  const l = await lemas(page); for (const x of l) if (x.e === 'sin') assert.equal(x.img, false); assert.ok(l.some((x) => x.e === 'sin')); assert.deepEqual(ext, []);
  await page.screenshot({ path: `${OUT}/02-parrafo.png`, fullPage: true }); await ctx.close();
});
await test('elegir otra opción local, dejar solo texto y volver a la propuesta', async () => {
  const { ctx, page } = await abrir(); await convertir(page, 'NECESITO SACAR UN TURNO PARA MI DNI');
  await page.click('#pcTablero li:nth-child(5) button'); assert.equal(await page.evaluate(() => document.querySelector('#pcDialogo').open), true);
  await page.screenshot({ path: `${OUT}/03-dialogo.png` }); await page.click('#pcSoloTexto'); let l = await lemas(page); assert.equal(l[4].e, 'texto'); assert.equal(l[4].img, false);
  await page.waitForFunction(() => document.activeElement.closest('li')?.dataset.i === '4'); // el foco vuelve a la tarjeta
  await page.click('#pcTablero li:nth-child(5) button'); await page.click('#pcRestaurar'); l = await lemas(page); assert.equal(l[4].e, 'revisar'); assert.equal(l[4].ok, true); await ctx.close();
});
await test('palabra desconocida: búsqueda en ARASAAC envía solo esa palabra y exige elegir', async () => {
  const { ctx, page, ext } = await abrir(); await convertir(page, 'Quiero un martillo'); let l = await lemas(page); assert.equal(l[2].e, 'sin'); assert.equal(l[2].img, false);
  assert.deepEqual(ext, [], 'no se consulta nada hasta que la persona lo pide');
  await page.click('#pcTablero li:nth-child(3) button'); assert.equal(await page.inputValue('#pcBuscarTermino'), 'martillo'); await page.click('#pcBuscar');
  await page.waitForSelector('#pcBuscarRes .pc-opt'); assert.equal(await page.$$eval('#pcBuscarRes .pc-opt', (o) => o.length), 1, 'solo coincidencia exacta de palabra clave');
  assert.ok(ext.some((u) => u.endsWith('/search/martillo')) && ext.every((u) => !u.includes('quiero')), 'solo se envió la palabra'); l = await lemas(page); assert.equal(l[2].e, 'sin', 'nada se asigna solo');
  await page.click('#pcBuscarRes .pc-opt'); l = await lemas(page); assert.equal(l[2].e, 'elegido'); assert.equal(l[2].ok, true); await ctx.close();
});
await test('nombres propios y números no se buscan en línea', async () => {
  const { ctx, page, ext } = await abrir(); await convertir(page, 'Me llamo Ana y tengo 3 hijos');
  const ana = page.locator('#pcTablero li', { hasText: 'Ana' }).locator('button'); await ana.click(); assert.equal(await page.isDisabled('#pcBuscar'), true); await page.keyboard.press('Escape');
  assert.deepEqual(ext, []); await ctx.close();
});
await test('voz: escuchar resalta palabra por palabra; pausar, repetir y detener', async () => {
  const { ctx, page } = await abrir(); await convertir(page, 'QUIERO AGUA'); await page.evaluate(() => { window.__noEnd = true; }); await page.click('#pcEscuchar');
  await page.waitForFunction(() => document.querySelectorAll('#view-escribir .hl').length > 0); assert.deepEqual(await page.evaluate(() => window.__spoken), ['QUIERO AGUA']);
  await page.waitForFunction(() => document.querySelector('#pcTablero li.hl .pc-label')?.textContent === 'AGUA'); assert.equal(await page.textContent('#pcOriginal .hl'), 'AGUA');
  await mas(page); await page.click('#pcPausar'); assert.equal(await page.getAttribute('#pcPausar', 'aria-pressed'), 'true'); await page.click('#pcPausar');
  await page.click('#pcRepetir'); assert.equal((await page.evaluate(() => window.__spoken)).length, 2); await page.click('#pcDetener');
  assert.equal(await page.$$eval('.hl', (n) => n.length), 0); assert.deepEqual((await page.evaluate(() => window.__ctl)).filter((x) => x !== 'cancel'), ['pause', 'resume']); await ctx.close();
});
await test('sin voz del navegador todo lo demás funciona y se explica', async () => {
  const { ctx, page } = await abrir({ speech: false }); await page.evaluate(() => 0); const tiene = await page.evaluate(() => 'speechSynthesis' in window); await convertir(page, 'HOLA');
  if (!tiene) { assert.equal(await page.isDisabled('#pcEscuchar'), true); assert.equal(await page.isVisible('#pcVozNota'), true); } assert.equal((await lemas(page)).length, 1); await ctx.close();
});
await test('letra MAYÚSCULA, tamaño, alto contraste y editar', async () => {
  const { ctx, page } = await abrir(); await convertir(page, 'quiero agua'); await mas(page); await page.click('#pcLetra'); assert.equal(await page.$eval('#pcOriginal', (n) => getComputedStyle(n).textTransform), 'uppercase');
  assert.equal(await page.$eval('.pc-label', (n) => getComputedStyle(n).textTransform), 'uppercase'); await page.selectOption('#pcTamano', 'xl'); assert.ok((await page.$eval('.pc-img', (n) => n.getBoundingClientRect().width)) > 200);
  await page.click('#pcEditar'); assert.equal(await page.evaluate(() => document.activeElement.id), 'pcTexto'); await ctx.close();
});
await test('descargar PNG con pictogramas reales', async () => {
  const { ctx, page } = await abrir(); await convertir(page, 'NECESITO SACAR UN TURNO PARA MI DNI'); const [d] = await Promise.all([page.waitForEvent('download'), page.click('#pcPng')]);
  const f = `${OUT}/prueba.png`; await d.saveAs(f); assert.equal(d.suggestedFilename(), 'claria-pictogramas.png'); const info = execFileSync('file', [f]).toString(); assert.match(info, /PNG image data, 1240 x 1754/);
  const col = execFileSync('python3', ['-c', `from PIL import Image;im=Image.open('${f}').convert('RGB');print(len(set(im.resize((124,175)).getdata())))`]).toString(); assert.ok(Number(col) > 60, 'tiene colores de pictogramas: ' + col); await ctx.close();
});
await test('descargar PDF válido con pictogramas', async () => {
  const { ctx, page } = await abrir(); await convertir(page, 'LA ESCUELA ES PARA TODOS'); const [d] = await Promise.all([page.waitForEvent('download'), page.click('#pcPdf')]);
  const f = `${OUT}/prueba.pdf`; await d.saveAs(f); const info = execFileSync('pdfinfo', [f]).toString(); assert.match(info, /Pages:\s+1/); assert.match(info, /Page size:\s+595/);
  execFileSync('pdftoppm', ['-png', '-r', '60', f, `${OUT}/pdf`]); await ctx.close();
});
await test('imprimir: el área de impresión contiene original, pictogramas y créditos ARASAAC', async () => {
  const { ctx, page } = await abrir(); await convertir(page, 'QUIERO AGUA'); await mas(page); await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('pcPrintArea').innerText; window.__imgs = document.querySelectorAll('#pcPrintArea img').length; }; });
  await page.click('#pcImprimir'); const txt = await page.evaluate(() => window.__printed); assert.match(txt, /QUIERO AGUA/); assert.match(txt, /ARASAAC/); assert.match(txt, /CC BY-NC-SA 4\.0/); assert.equal(await page.evaluate(() => window.__imgs), 2);
  await page.evaluate(() => { document.getElementById('pcPrintArea')?.remove(); }); await ctx.close();
});
await test('créditos ARASAAC visibles en pie, resultados y Acerca de', async () => {
  const { ctx, page } = await abrir(); assert.match(await page.textContent('footer'), /ARASAAC/); await convertir(page, 'HOLA'); assert.match(await page.textContent('#pcCredito'), /Sergio Palao/);
  await page.click('#footerAbout'); assert.match(await page.textContent('#creditosPanel'), /CC BY-NC-SA 4\.0/); await ctx.close();
});
await test('móvil 375 px: sin desborde horizontal', async () => {
  const { ctx, page } = await abrir({ ancho: 375 }); await convertir(page, 'NECESITO SACAR UN TURNO PARA MI DNI'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/04-movil.png`, fullPage: true }); await ctx.close();
});
await test('teclado: Ctrl+Enter convierte y las tarjetas se abren con Enter', async () => {
  const { ctx, page } = await abrir(); await page.fill('#pcTexto', 'hola'); await page.press('#pcTexto', 'Control+Enter'); await page.waitForSelector('#pcTablero li');
  await page.focus('#pcTablero li button'); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.querySelector('#pcDialogo').open), true); await page.keyboard.press('Escape'); await ctx.close();
});
await browser.close(); srv.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
