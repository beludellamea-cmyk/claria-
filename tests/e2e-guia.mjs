// E2E del rediseño guiado (bienvenida, personaje acompañante, recorridos). Sin Worker: modo demo. Voz y micrófono simulados; también se prueba SIN ellos.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const OUT = process.env.OUT || '/tmp/claria-e2e'; fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(8015, r)); const BASE = 'http://localhost:8015/';
const browser = await chromium.launch(); const results = [];
const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n   ', e.message.split('\n')[0]); } };
async function abrir({ ancho = 1280, alto = 860, voz = true, mic = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, acceptDownloads: true }); const page = await ctx.newPage(); const ext = [], errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) ext.push(u); });
  await page.addInitScript(({ voz, mic }) => {
    window.__spoken = [];
    if (voz) { window.SpeechSynthesisUtterance = function (t) { this.text = t; };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() { window.__vivo = false; }, pause() {}, resume() {}, speak(u) { window.__spoken.push(u.text); const id = (window.__vivo = Math.random()); setTimeout(() => { if (window.__vivo !== id) return; u.onstart && u.onstart(); if (u.onboundary) { let i = 0; for (const w of u.text.split(' ')) { const ci = i; setTimeout(() => window.__vivo === id && u.onboundary({ name: 'word', charIndex: ci }), 30 + ci); i += w.length + 1; } } setTimeout(() => { if (window.__vivo === id && !window.__noEnd) u.onend && u.onend(); }, 700); }, 10); } } });
    } else { delete window.speechSynthesis; if ('speechSynthesis' in window) throw new Error('no se pudo quitar speechSynthesis'); }
    window.__micIniciado = 0;
    if (mic) { window.SpeechRecognition = function () { this.start = () => { window.__micIniciado++; setTimeout(() => { this.onresult && this.onresult({ results: [[{ transcript: window.__dictado || 'quiero agua' }]] }); setTimeout(() => this.onend && this.onend(), 50); }, 400); }; this.stop = () => this.onend && this.onend(); }; }
    else { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; }
  }, { voz, mic });
  await page.goto(BASE); await page.waitForSelector('#claria'); return { ctx, page, ext, errs };
}
const vis = (page, sel) => page.isVisible(sel);
const spoken = (page) => page.evaluate(() => window.__spoken);
const estado = (page) => page.getAttribute('#claria', 'data-estado');
const caja = (page, sel) => page.$eval(sel, (n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

await test('bienvenida: solo saludo, pregunta y 3 tarjetas + «O hablá conmigo» con ícono y texto; nada suena solo', async () => {
  const { ctx, page, errs } = await abrir(); await page.waitForTimeout(1300); assert.equal((await page.textContent('#inicioTitulo')).trim(), '¡Hola! Soy CLARIA.'); assert.equal((await page.textContent('.welcome-q')).trim(), '¿Qué querés hacer hoy?');
  const bts = await page.$$eval('#view-inicio .big-btn', (b) => b.map((x) => [Boolean(x.querySelector('.big-ico svg')), x.querySelector('.big-txt').textContent.trim()]));
  assert.deepEqual(bts.map((b) => b[1]), ['Crear con pictogramas', 'Leer y entender', 'Hacer un trámite', 'O hablá conmigo']); assert.ok(bts.every((b) => b[0]));
  assert.equal(await page.$$eval('#view-inicio .big-btn small, #view-inicio p:not(.claria-estado)', (n) => n.filter((x) => x.offsetParent !== null).length), 0, 'sin descripciones ni párrafos');
  assert.equal((await caja(page, '#claria-btn')).w >= 190, true, 'personaje grande'); assert.equal((await spoken(page)).length, 0); assert.deepEqual(errs, []);
  await page.screenshot({ path: `${OUT}/20-bienvenida-pc.png` }); await ctx.close();
});
await test('el personaje pasa a un costado al elegir y sigue disponible', async () => {
  const { ctx, page } = await abrir(); await page.click('#view-inicio [data-view=escribir]'); await page.waitForTimeout(900); const c = await caja(page, '#claria-btn'), m = await caja(page, '#view-escribir h1');
  assert.ok(c.w <= 160 && c.x < m.x, `costado izquierdo: ${JSON.stringify(c)} ${m.x}`); assert.equal(await vis(page, '#claria-btn'), true); await page.screenshot({ path: `${OUT}/21-escribir-pc.png` }); await ctx.close();
});
await test('estados visuales: esperando / escuchando / procesando / hablando con texto', async () => {
  const { ctx, page } = await abrir(); assert.equal(await estado(page), 'esperando'); assert.match(await page.textContent('#claria-estado'), /Esperando/);
  for (const [e, t] of [['escuchando', /Escuchando/], ['procesando', /Pensando/], ['hablando', /Hablando/]]) { await page.evaluate((x) => window.ClariaGuia.estado(x), e); assert.equal(await estado(page), e); assert.match(await page.textContent('#claria-estado'), t); }
  const anim = await page.$eval('.claria-bars i', (n) => getComputedStyle(n).animationName); assert.notEqual(anim, 'none');
  await page.evaluate(() => document.body.classList.add('no-motion')); assert.equal(await page.$eval('.claria-bars i', (n) => getComputedStyle(n).animationName), 'none', 'sin movimiento si se reduce'); await ctx.close();
});
await test('menú del personaje: Explicame, Repetir, Volver, Necesito ayuda (según la pantalla)', async () => {
  const { ctx, page } = await abrir(); await page.click('#view-inicio [data-view=escribir]'); await page.click('#claria-btn'); assert.deepEqual(await page.$$eval('#claria-menu button', (b) => b.map((x) => x.textContent.replace(/^\S+\s/, '').trim())), ['Explicame', 'Repetir', 'Volver', 'Necesito ayuda']);
  await page.click('[data-ayuda=explicame]'); assert.match(await page.textContent('#claria-bubble-text'), /Escribí una palabra, una frase/); await page.screenshot({ path: `${OUT}/22-menu.png` });
  await page.click('#claria-btn'); await page.click('[data-ayuda=ayuda]'); assert.ok((await page.$$('#claria-bubble-list li')).length >= 3); assert.equal(await vis(page, '#claria-bubble-chat'), true);
  await page.click('#claria-btn'); await page.click('[data-ayuda=repetir]'); assert.ok((await page.textContent('#claria-bubble-text')).length > 5);
  await page.click('#claria-bubble-close'); await page.click('#claria-btn'); await page.click('[data-ayuda=volver]'); assert.equal(await vis(page, '#view-inicio'), true);
  assert.equal((await spoken(page)).length, 0, 'ningún audio sin tocar Escuchar'); await ctx.close();
});
await test('menú: el audio del globo solo suena al tocar «Escuchar»; Escape cierra y el foco vuelve', async () => {
  const { ctx, page } = await abrir(); await page.click('#view-inicio [data-view=tramites]'); await page.click('#claria-btn'); await page.click('[data-ayuda=explicame]'); assert.equal((await spoken(page)).length, 0);
  await page.click('#claria-bubble-listen'); assert.equal((await spoken(page)).length, 1); await page.waitForFunction(() => document.getElementById('claria').dataset.estado === 'hablando');
  await page.waitForFunction(() => document.getElementById('claria').dataset.estado === 'esperando'); await page.keyboard.press('Escape'); assert.equal(await vis(page, '#claria-bubble'), false); await ctx.close();
});
await test('Escribir una frase: dictado con permiso → pictogramas → escucha la oración COMPLETA → descarga', async () => {
  const { ctx, page, ext } = await abrir(); await page.click('#view-inicio [data-view=escribir]'); assert.match(await page.textContent('#escribirTitulo'), /¿Qué querés decir\?/);
  await page.click('#pcDictar'); assert.equal(await page.evaluate(() => document.getElementById('micDialog').open), true); await page.click('#micDecline'); assert.equal(await page.evaluate(() => window.__micIniciado), 0, 'sin permiso no se activa el micrófono');
  await page.click('#pcDictar'); await page.click('#micAccept'); await page.waitForFunction(() => document.getElementById('pcTexto').value === 'quiero agua'); assert.equal(await page.evaluate(() => window.__micIniciado), 1);
  await page.fill('#pcTexto', 'NECESITO SACAR UN TURNO PARA MI DNI'); await page.click('#pcConvertir'); await page.waitForSelector('#pcTablero img');
  assert.ok((await page.$$('#pcTablero img')).length >= 4); await page.click('#pcEscuchar'); assert.deepEqual(await spoken(page), ['NECESITO SACAR UN TURNO PARA MI DNI']);
  await page.waitForFunction(() => document.getElementById('claria').dataset.estado === 'hablando'); await page.click('#pcDetener'); await page.click('#pcEditar'); assert.equal(await page.evaluate(() => document.activeElement.id), 'pcTexto');
  await page.click('#pcConvertir'); await page.waitForSelector('#pcTablero img');
  const [d1] = await Promise.all([page.waitForEvent('download'), page.click('#pcPng')]); await d1.saveAs(`${OUT}/g.png`); assert.match(execFileSync('file', [`${OUT}/g.png`]).toString(), /PNG image data/);
  const [d2] = await Promise.all([page.waitForEvent('download'), page.click('#pcPdf')]); await d2.saveAs(`${OUT}/g.pdf`); assert.match(execFileSync('pdfinfo', [`${OUT}/g.pdf`]).toString(), /Pages:\s+1/); assert.deepEqual(ext, []); await ctx.close();
});
await test('Leer un documento: ¿Qué querés leer? → ¿Cómo querés que te ayude? → Escuchar / Explicar / Pictogramas', async () => {
  const { ctx, page } = await abrir(); await page.click('#view-inicio [data-view=lectura]'); assert.deepEqual(await page.$$eval('#leerPaso1 .big-btn .big-txt', (n) => n.map((x) => x.textContent)), ['Subir archivo', 'Sacar foto', 'Escribir texto']);
  assert.equal(await page.getAttribute('#photoInput', 'capture'), 'environment'); await page.screenshot({ path: `${OUT}/23-leer1.png` });
  await page.click('#optTexto'); await page.fill('#inputText', 'Estimadas familias: el lunes hay reunión en la escuela. Deben traer el DNI del alumno.'); await page.click('#useText');
  assert.match(await page.textContent('#lecturaTitulo2'), /¿Cómo querés que te ayude\?/); assert.deepEqual(await page.$$eval('#leerPaso2 .big-btn .big-txt', (n) => n.map((x) => x.textContent)), ['Escuchar', 'Explicar fácil', 'Ver con pictogramas']);
  assert.equal((await spoken(page)).length, 0); await page.click('#optEscuchar'); assert.equal((await spoken(page)).length, 1); assert.match((await spoken(page))[0], /^Estimadas familias/);
  await page.click('#view-lectura [data-back]'); assert.equal(await vis(page, '#leerPaso2'), true); await page.click('#optExplicar'); assert.match(await page.textContent('#aiStatus'), /necesito una IA conectada/); assert.equal(await vis(page, '#aiPanel'), true);
  await page.click('#view-lectura [data-back]'); await page.click('#abrirCuento'); await page.waitForSelector('#pqPagina img'); assert.equal(await vis(page, '#view-cuento'), true); await page.click('#pqVolver'); assert.equal(await vis(page, '#leerPaso2'), true); await ctx.close();
});
await test('Leer: subir archivo TXT lleva directo a «¿Cómo querés que te ayude?»', async () => {
  const { ctx, page } = await abrir(); await page.click('#view-inicio [data-view=lectura]'); fs.writeFileSync(`${OUT}/nota.txt`, 'Aviso importante. La escuela cierra el viernes por la tarde.');
  await page.setInputFiles('#fileInput', `${OUT}/nota.txt`); await page.waitForSelector('#leerPaso2:not([hidden])'); assert.match(await page.textContent('#leerResumen'), /Texto listo/); await ctx.close();
});
await test('Hacer un trámite: tarjetas → pasos con pictogramas, narración, fuente oficial → volver', async () => {
  const { ctx, page, ext } = await abrir(); await page.click('#view-inicio [data-view=tramites]'); assert.match(await page.textContent('#tramitesTitulo'), /¿Qué trámite necesitás\?/);
  await page.waitForSelector('.proc-item'); assert.equal((await page.$$('.proc-item')).length, 3); await page.screenshot({ path: `${OUT}/24-tramites1.png` });
  await page.click('[data-proc=dni]'); await page.waitForSelector('#procedurePictos .pc-card'); assert.equal(await vis(page, '#procedureOfficial'), true); assert.match(await page.getAttribute('#procedureOfficial', 'href'), /^https:\/\/www\.argentina\.gob\.ar/);
  await page.click('#procedureSpeak'); assert.equal((await spoken(page)).length, 1); await page.screenshot({ path: `${OUT}/25-tramites2.png`, fullPage: true });
  await page.click('#procedureNext'); assert.match(await page.textContent('#procedureStepCounter'), /Paso 2/); await page.click('#view-tramites [data-back]'); assert.equal(await vis(page, '.proc-item'), true); assert.deepEqual(ext, []); await ctx.close();
});
await test('Hablar con CLARIA: «¿En qué puedo ayudarte?», chat con texto y micrófono opcional; demo no se hace pasar por IA', async () => {
  const { ctx, page } = await abrir(); await page.click('#view-inicio [data-view=hablar]'); assert.match(await page.textContent('#hablarTitulo'), /¿En qué puedo ayudarte\?/); await page.waitForSelector('.bubble.bot');
  await page.fill('#chatInput', '¿Cómo tramito el DNI?'); await page.press('#chatInput', 'Enter'); await page.waitForSelector('.bubble.bot:has-text("DNI") .bubble-tag'); assert.match(await page.textContent('.bubble.bot:has-text("DNI") .bubble-tag'), /Modo demo/);
  await page.click('#micButton'); await page.click('#micAccept'); await page.waitForFunction(() => document.getElementById('chatInput').value.includes('quiero agua')); await page.screenshot({ path: `${OUT}/26-hablar.png` }); await ctx.close();
});
await test('SIN voz y SIN micrófono: todos los recorridos funcionan y se explican', async () => {
  const { ctx, page, errs } = await abrir({ voz: false, mic: false }); assert.equal(await page.isDisabled('#micButton').catch(() => true), true);
  await page.click('#view-inicio [data-view=escribir]'); assert.equal(await page.isDisabled('#pcDictar'), true); await page.fill('#pcTexto', 'HOLA'); await page.click('#pcConvertir'); await page.waitForSelector('#pcTablero img'); assert.equal(await page.isDisabled('#pcEscuchar'), true); assert.equal(await vis(page, '#pcVozNota'), true);
  await page.click('.brand'); await page.click('#view-inicio [data-view=lectura]'); await page.click('#optTexto'); await page.click('#loadExample'); await page.click('#abrirCuento'); await page.waitForSelector('#pqPagina img'); assert.equal(await vis(page, '#pqVozNota'), true); await page.click('#pqSiguiente');
  await page.click('.brand'); await page.click('#view-inicio [data-view=tramites]'); await page.click('[data-proc=dni]'); await page.click('#procedureSpeak'); await page.click('#procedureNext');
  await page.click('#claria-btn'); await page.click('[data-ayuda=explicame]'); assert.equal(await vis(page, '#claria-bubble-listen'), false); assert.deepEqual(errs, []); await ctx.close();
});
await test('celular 390 px: bienvenida y recorridos sin desborde; personaje en barra superior', async () => {
  const { ctx, page } = await abrir({ ancho: 390, alto: 800 }); const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok((await over()) <= 1); await page.screenshot({ path: `${OUT}/27-bienvenida-cel.png` });
  for (const v of ['escribir', 'lectura', 'tramites', 'hablar']) { await page.evaluate(() => document.querySelector('.brand').click()); await page.click(`#view-inicio [data-view=${v}]`); await page.waitForTimeout(900); assert.ok((await over()) <= 1, v);
    const c = await caja(page, '#claria-btn'); assert.ok(c.y < 140 && c.w <= 70, `${v} ${JSON.stringify(c)}`); }
  await page.click('.brand'); await page.click('#view-inicio [data-view=escribir]'); await page.fill('#pcTexto', 'QUIERO AGUA'); await page.click('#pcConvertir'); await page.waitForSelector('#pcTablero img'); await page.screenshot({ path: `${OUT}/28-escribir-cel.png`, fullPage: true }); assert.ok((await over()) <= 1);
  await page.click('#claria-btn'); assert.equal(await vis(page, '#claria-menu'), true); await page.screenshot({ path: `${OUT}/29-menu-cel.png` }); await ctx.close();
});
await test('tablet 820 px y texto al 150 % con alto contraste: sin desborde', async () => {
  const { ctx, page } = await abrir({ ancho: 820, alto: 1000 }); await page.click('#openPrefs'); await page.click('#contrastToggle'); for (let i = 0; i < 5; i++) await page.click('#largerText'); await page.click('#closePrefs');
  for (const v of ['inicio', 'escribir', 'tramites']) { await page.click('.brand'); if (v !== 'inicio') await page.click(`#view-inicio [data-view=${v}]`); assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, v); }
  await page.click('.brand'); await page.screenshot({ path: `${OUT}/30-contraste.png` }); await ctx.close();
});
await test('teclado: Tab llega a las 3 tarjetas, al botón de hablar y al personaje; Enter abre; foco en el título', async () => {
  const { ctx, page } = await abrir(); const orden = []; for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); orden.push(await page.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim().slice(0, 24))); }
  for (const t of ['claria-btn', 'Crear con pictogramas', 'Leer y entender', 'Hacer un trámite', 'O hablá conmigo']) assert.ok(orden.some((o) => o.includes(t)), 'falta ' + t + ' en ' + orden.join('|'));
  await page.focus('#view-inicio [data-view=hablar]'); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.activeElement.id === 'hablarTitulo'); await ctx.close();
});
await test('ningún audio ni micrófono se activa solo al recorrer todas las pantallas', async () => {
  const { ctx, page } = await abrir(); for (const v of ['escribir', 'lectura', 'tramites', 'hablar']) { await page.click('.brand'); await page.click(`#view-inicio [data-view=${v}]`); }
  await page.click('#footerAbout'); assert.equal((await spoken(page)).length, 0); assert.equal(await page.evaluate(() => window.__micIniciado), 0); await ctx.close();
});

await test('CLARIA habla: no suena nada hasta tocar «Que CLARIA me hable»; luego saluda con subtítulo y resalta botones', async () => {
  const { ctx, page } = await abrir(); await page.waitForTimeout(1200); assert.equal((await spoken(page)).length, 0, 'sin autoplay'); assert.equal(await vis(page, '#claria-voz'), true);
  assert.equal(await page.getAttribute('#claria-voz', 'aria-pressed'), 'false'); await page.click('#claria-voz'); await page.waitForFunction(() => window.__spoken.length === 1);
  const dicho = (await spoken(page))[0]; assert.match(dicho, /¡Hola! Soy CLARIA/); assert.match(dicho, /leer y entender/);
  await page.waitForFunction(() => !document.getElementById('claria-subtitulo').hidden); assert.match(await page.textContent('#claria-subtitulo'), /Soy CLARIA/);
  await page.waitForFunction(() => document.querySelectorAll('.big-btn.resalta').length === 1, null, { timeout: 4000 }); await page.screenshot({ path: `${OUT}/40-habla-pc.png` });
  await page.waitForFunction(() => document.getElementById('claria').dataset.estado === 'esperando'); assert.equal(await page.$$eval('.big-btn.resalta', (n) => n.length), 0, 'el resaltado termina con la frase');
  assert.equal(await page.$eval('#claria-voz', (b) => b.textContent.includes('Silenciar')), true); await ctx.close();
});
await test('CLARIA guía: cada pantalla dice su pregunta; al volver usa la versión corta; silenciar corta y oculta subtítulo', async () => {
  const { ctx, page } = await abrir(); await page.click('#claria-voz'); await page.waitForFunction(() => window.__spoken.length === 1);
  await page.click('#view-inicio [data-view=escribir]'); await page.waitForFunction(() => window.__spoken.length === 2); assert.match((await spoken(page))[1], /¿Qué querés decir\?.*convertir/);
  await page.click('.brand'); await page.waitForFunction(() => window.__spoken.length === 3); assert.equal((await spoken(page))[2], '¿Qué querés hacer hoy?', 'versión corta en la segunda visita');
  await page.click('#view-inicio [data-view=tramites]'); await page.waitForFunction(() => window.__spoken.length === 4); assert.match((await spoken(page))[3], /¿Qué trámite necesitás\?/);
  await page.click('#claria-voz'); const n = (await spoken(page)).length; assert.equal(await vis(page, '#claria-subtitulo'), false); assert.equal(await estado(page), 'esperando');
  await page.click('.brand'); await page.click('#view-inicio [data-view=hablar]'); await page.waitForTimeout(900); assert.equal((await spoken(page)).length, n, 'en silencio no habla'); await ctx.close();
});
await test('CLARIA reacciona: convertir y pasos de trámite se narran solo con la voz activada', async () => {
  const { ctx, page } = await abrir(); await page.click('#view-inicio [data-view=escribir]'); await page.fill('#pcTexto', 'QUIERO AGUA'); await page.click('#pcConvertir'); await page.waitForSelector('#pcResultado:not([hidden])');
  await page.waitForTimeout(700); assert.equal((await spoken(page)).length, 0, 'sin voz activada no reacciona'); await page.click('.brand'); await page.click('#claria-voz'); await page.waitForFunction(() => window.__spoken.length >= 1);
  await page.click('#view-inicio [data-view=escribir]'); await page.waitForFunction(() => window.__spoken.length >= 2); await page.fill('#pcTexto', 'HOLA'); await page.click('#pcConvertir');
  await page.waitForFunction(() => window.__spoken.some((t) => /cada palabra tiene su pictograma/.test(t)), null, { timeout: 5000 });
  await page.click('.brand'); await page.click('#view-inicio [data-view=tramites]'); await page.click('[data-proc=dni]'); await page.click('#procedureNext'); await page.waitForFunction(() => window.__spoken.some((t) => /^Paso \d+ de \d+/.test(t)), null, { timeout: 5000 }); await ctx.close();
});
await test('órdenes por voz: «quiero leer un documento» abre Leer; frase desconocida avisa y no navega', async () => {
  const { ctx, page } = await abrir(); assert.equal(await vis(page, '#claria-oir'), true); await page.evaluate(() => { window.__dictado = 'quiero leer un documento'; });
  await page.click('#claria-oir'); await page.click('#micAccept, #micDialog [value=accept]'); await page.waitForFunction(() => document.getElementById('view-lectura') && !document.getElementById('view-lectura').hidden, null, { timeout: 4000 });
  assert.equal(await vis(page, '#claria-oir'), false, 'el botón de voz solo está en la bienvenida');
  await page.click('.brand'); await page.evaluate(() => { window.__dictado = 'bla bla xyz'; }); await page.click('#claria-oir'); await page.waitForFunction(() => /No te entendí/.test(document.getElementById('claria-subtitulo').textContent), null, { timeout: 4000 });
  assert.equal(await vis(page, '#view-inicio'), true); await ctx.close();
});
await test('sin voz ni micrófono: los botones de CLARIA se desactivan y explican', async () => {
  const { ctx, page } = await abrir({ voz: false, mic: false }); assert.equal(await page.isDisabled('#claria-voz'), true); assert.match(await page.textContent('#claria-voz'), /no disponible/i);
  assert.equal(await page.isDisabled('#claria-oir'), true); await page.click('#view-inicio [data-view=escribir]'); assert.equal(await vis(page, '#view-escribir'), true); await ctx.close();
});
await test('celular 390 px con voz activa: subtítulo visible sin desborde ni tapar los botones principales', async () => {
  const { ctx, page } = await abrir({ ancho: 390, alto: 800 }); await page.click('#claria-voz'); await page.waitForFunction(() => !document.getElementById('claria-subtitulo').hidden);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1); const s = await caja(page, '#claria-subtitulo'); assert.ok(s.x >= 0 && s.x + s.w <= 391, JSON.stringify(s));
  await page.screenshot({ path: `${OUT}/41-habla-movil.png` }); await ctx.close();
});
await browser.close(); srv.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
