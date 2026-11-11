// Pruebas E2E de CLARIA: navegador real + Worker real (proveedor de IA simulado SOLO en test).
// Uso: npm i -D playwright && npx playwright install chromium && node tests/e2e.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startMockProvider } from './mock-provider.mjs';
import { startDevServer } from '../worker/dev-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const serveStatic = (port, apiBase) => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); if (u === '/config.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end(`window.CLARIA_CONFIG={apiBase:${JSON.stringify(apiBase)}};`); }
    const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }); s.listen(port, () => resolve(s));
});

const results = []; let browser;
const ONLY = process.env.ONLY;
const test = async (name, fn) => { if (ONLY && !name.includes(ONLY)) return; try { await fn(); results.push([true, name]); console.log('  ✔', name); } catch (e) { results.push([false, name, e]); console.log('  ✘', name, '\n     ', String(e.message).split('\n')[0], '\n     ', (String(e.stack).match(/e2e\.mjs:\d+/) || [''])[0]); } };

const mock = await startMockProvider(8791);
const api = await startDevServer({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test-SECRET', ANTHROPIC_BASE_URL: 'http://localhost:8791', ALLOWED_ORIGINS: 'http://localhost:8000', RATE_PER_MIN: '50', RATE_PER_DAY: '500', DAILY_CAP: '5000' }, 8787);
const sDemo = await serveStatic(8001, ''), sConn = await serveStatic(8000, 'http://localhost:8787'), sOff = await serveStatic(8002, 'http://localhost:8999');
browser = await chromium.launch();

async function open(port, { width = 1280, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } }); const page = await ctx.newPage();
  const errors = [], reqs = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('request', (r) => reqs.push(r.url()));
  await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => document.getElementById('modeLabel').textContent.length > 0);
  await page.waitForTimeout(400); return { page, ctx, errors, reqs };
}
const EX = 'El agua es indispensable para la vida. Cuando el sol calienta los ríos, una parte del agua se evapora y sube al aire. Luego forma nubes y cae como lluvia.';

console.log('\nModo demo (sin API configurada)');
await test('banner de modo demo, botones de IA desactivados y explicados, sin llamadas a la API', async () => {
  const { page, errors, reqs, ctx } = await open(8001);
  assert.equal((await page.textContent('#modeLabel')).trim(), 'Modo demo');
  await page.click('[data-view="lectura"]'); await page.click('#loadExample');
  for (const b of await page.$$('.ai-action')) assert.equal(await b.isDisabled(), true);
  assert.match(await page.textContent('#aiAvailability'), /desactivados porque no hay una IA/);
  await page.click('#chatFab'); await page.fill('#chatInput', '¿Cómo tramito el DNI?'); await page.press('#chatInput', 'Enter');
  await page.waitForSelector('.bubble.bot:has-text("DNI") .bubble-tag');
  const tags = await page.$$eval('.bubble-tag', (n) => n.map((x) => x.textContent));
  assert.ok(tags.every((t) => /Modo demo/.test(t)), 'las respuestas fijas deben etiquetarse como demo, no como IA: ' + tags);
  assert.ok(!reqs.some((u) => u.includes('/api/')), 'no debe llamar a /api en modo demo'); assert.deepEqual(errors, []); await ctx.close();
});
await test('trámites: se cargan desde la base curada con fecha de consulta y enlace oficial', async () => {
  const { page, errors, ctx } = await open(8001); await page.click('[data-view="tramites"]');
  assert.equal((await page.$$('.proc-item')).length, 3);
  await page.click('[data-proc="dni"]');
  assert.match(await page.textContent('#procedureSource'), /consultada el 10\/11\/2026/); assert.match(await page.textContent('#procedureSource'), /06\/03\/2026/);
  assert.equal(await page.getAttribute('#procedureOfficial', 'href'), 'https://www.argentina.gob.ar/node/41622');
  assert.match(await page.textContent('.eyebrow:has-text("NO ES EL TRÁMITE REAL")'), /NO ES EL TRÁMITE REAL/);
  await page.click('#procedureNext'); assert.match(await page.textContent('#procedureStepCounter'), /Paso 2 de 4/);
  await page.click('[data-proc="cud"]'); assert.match(await page.textContent('#procedureSource'), /gratuito/); assert.deepEqual(errors, []); await ctx.close();
});

console.log('\nModo conectado (navegador → Worker → proveedor simulado)');
await test('banner de IA conectada y botones activos', async () => {
  const { page, ctx } = await open(8000); assert.equal((await page.textContent('#modeLabel')).trim(), 'IA conectada');
  assert.match(await page.textContent('#modeText'), /Anthropic/); await page.click('[data-view="lectura"]'); await page.click('#loadExample');
  assert.equal(await page.isDisabled('[data-task="plain"]'), false); await ctx.close();
});
await test('consentimiento: "Ahora no" no envía nada; "Acepto" envía y muestra resultado de IA separado del original', async () => {
  const before = mock.calls.length; const { page, ctx, errors, reqs } = await open(8000);
  await page.click('[data-view="lectura"]'); await page.fill('#inputText', EX); await page.click('#useText');
  await page.click('[data-task="plain"]'); await page.waitForSelector('#consentDialog[open]');
  assert.match(await page.textContent('#consentBody'), /no guarda/); await page.click('#consentDecline');
  await page.waitForSelector('#consentDialog:not([open])', { state: 'attached' }); await page.waitForFunction(() => /Sin tu permiso/.test(document.getElementById('aiStatus').textContent));
  assert.ok(!reqs.some((u) => u.includes('/api/explain')) && mock.calls.length === before);
  await page.click('[data-task="plain"]'); await page.waitForSelector('#consentDialog[open]'); await page.click('#consentAccept');
  await page.waitForSelector('#aiResult:not([hidden])');
  assert.match(await page.textContent('#aiResultText'), /MOCK: el texto explica/); assert.match(await page.textContent('#aiResultKind'), /Explicación en lenguaje claro \(IA\)/);
  assert.match(await page.textContent('#aiResult .origin-ai'), /Generado por IA: puede tener errores/);
  assert.match(await page.textContent('#aiNoticeList'), /La IA señala:.*MOCK aviso/); assert.match(await page.textContent('#aiKeyPoints'), /MOCK punto uno/);
  assert.equal((await page.textContent('#readingCard')).trim().startsWith('El agua es indispensable'), true, 'el original no se modifica');
  assert.match(await page.textContent('.origin-original'), /Texto original/);
  // la clave de API nunca llega al navegador
  const html = await page.content(); assert.ok(!html.includes('SECRET') && !reqs.join(' ').includes('SECRET'));
  const call = mock.calls.at(-1); assert.equal(call.headers['x-api-key'], 'sk-test-SECRET'); assert.match(call.body.messages[0].content, /<documento>/);
  // no vuelve a pedir permiso en la sesión
  await page.click('[data-task="summary"]'); await page.waitForFunction(() => /Resumen \(IA\)/.test(document.getElementById('aiResultKind').textContent));
  assert.equal(await page.isVisible('#consentDialog[open]'), false); assert.deepEqual(errors, []); await ctx.close();
});
await test('privacidad: DNI/correo/clave se ocultan en el navegador antes de enviar y se avisa', async () => {
  const { page, ctx } = await open(8000); await page.evaluate(() => sessionStorage.setItem('claria.consent', 'yes')); await page.reload(); await page.waitForTimeout(500);
  await page.click('[data-view="lectura"]');
  await page.fill('#inputText', 'Señor titular DNI 12345678, escribanos a ana.perez@correo.com. Clave: perro. Su trámite vence el viernes.'); await page.click('#useText');
  await page.click('[data-task="easy"]'); await page.waitForSelector('#aiResult:not([hidden])');
  const sent = JSON.stringify(mock.calls.at(-1).body); assert.ok(!/12345678|ana\.perez|perro/.test(sent), 'datos personales llegaron al proveedor');
  assert.match(await page.textContent('#aiNoticeList'), /Se ocultaron 3 dato/); await ctx.close();
});
await test('preguntar sobre el texto y OCR/origen: se informa en avisos', async () => {
  const { page, ctx } = await open(8000); await page.evaluate(() => sessionStorage.setItem('claria.consent', 'yes')); await page.reload(); await page.waitForTimeout(500);
  await page.click('[data-view="lectura"]'); await page.fill('#inputText', EX); await page.click('#useText');
  await page.click('#askSubmit'); assert.match(await page.textContent('#aiStatus'), /Escribí tu pregunta/);
  await page.fill('#askInput', '¿Qué pasa con el agua?'); await page.click('#askSubmit'); await page.waitForSelector('#aiResult:not([hidden])');
  assert.match(await page.textContent('#aiResultKind'), /pregunta/); assert.match(mock.calls.at(-1).body.messages[0].content, /Pregunta de la persona: ¿Qué pasa con el agua\?/); await ctx.close();
});
await test('texto largo: se recorta con aviso explícito', async () => {
  const { page, ctx } = await open(8000); await page.evaluate(() => sessionStorage.setItem('claria.consent', 'yes')); await page.reload(); await page.waitForTimeout(500);
  await page.click('[data-view="lectura"]'); await page.fill('#inputText', ('palabra '.repeat(1200)).trim()); await page.click('#useText');
  await page.click('[data-task="summary"]'); await page.waitForSelector('#aiResult:not([hidden])');
  assert.match(await page.textContent('#aiNoticeList'), /se analizaron solo los primeros/); assert.ok(mock.calls.at(-1).body.messages[0].content.length < 6200); await ctx.close();
});
await test('chat conectado: etiqueta de IA, fuente oficial con fecha, sin enlaces inventados', async () => {
  const { page, ctx, errors } = await open(8000); await page.evaluate(() => sessionStorage.setItem('claria.consent', 'yes')); await page.reload(); await page.waitForTimeout(500);
  await page.click('#openChatHome'); await page.waitForSelector('.bubble.bot');
  assert.match(await page.textContent('#chatMode'), /IA conectada/); assert.match(await page.textContent('.bubble.bot .bubble-text'), /asistente de inteligencia artificial/);
  await page.fill('#chatInput', 'Contame del enlace-falso'); await page.press('#chatInput', 'Enter'); await page.waitForSelector('.bubble-source');
  const last = await page.textContent('.bubble.bot:has(.bubble-source)');
  assert.ok(!last.includes('sitio-falso')); assert.match(last, /\[enlace no verificado\]/); assert.match(last, /Respuesta de IA · puede tener errores/);
  assert.match(last, /Fuente oficial: Tramitar un nuevo ejemplar de DNI \(consultada el 10\/11\/2026\)/);
  assert.match(await page.textContent('.bubble:has-text("Se quitó un enlace")'), /Aviso de CLARIA/); assert.deepEqual(errors, []); await ctx.close();
});
await test('chat: datos personales se ocultan antes de enviar; el historial viaja redactado', async () => {
  const { page, ctx } = await open(8000); await page.evaluate(() => sessionStorage.setItem('claria.consent', 'yes')); await page.reload(); await page.waitForTimeout(500);
  await page.click('#openChatHome'); await page.fill('#chatInput', 'mi dni es 30123456 y quiero renovarlo'); await page.press('#chatInput', 'Enter');
  await page.waitForSelector('.bubble-source'); assert.match(await page.textContent('#chatMessages'), /Oculté datos que parecían personales/);
  assert.ok(!JSON.stringify(mock.calls.at(-1).body).includes('30123456')); assert.match(await page.textContent('.bubble.user'), /\[número oculto\]|\[dato oculto\]/); await ctx.close();
});
await test('error del proveedor: se informa sin inventar respuesta', async () => {
  const { page, ctx } = await open(8000); await page.evaluate(() => sessionStorage.setItem('claria.consent', 'yes')); await page.reload(); await page.waitForTimeout(500);
  await page.click('#openChatHome'); await page.fill('#chatInput', 'error500'); await page.press('#chatInput', 'Enter');
  await page.waitForSelector('.bubble.error'); assert.match(await page.textContent('.bubble.error'), /problema|IA/); assert.equal((await page.$$('.bubble.bot:not(.error):not(.pending)')).length, 1, 'solo el saludo inicial'); await ctx.close();
});
await test('límite de consultas por sesión', async () => {
  const { page, ctx } = await open(8000); await page.evaluate(() => { sessionStorage.setItem('claria.consent', 'yes'); sessionStorage.setItem('claria.aiCount', '25'); }); await page.reload(); await page.waitForTimeout(500);
  await page.click('#openChatHome'); await page.fill('#chatInput', 'hola'); await page.press('#chatInput', 'Enter');
  await page.waitForSelector('.bubble.error'); assert.match(await page.textContent('.bubble.error'), /máximo de 25 consultas/); await ctx.close();
});
await test('API: origen no autorizado rechazado; CORS correcto', async () => {
  const bad = await fetch('http://localhost:8787/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://malo.example' }, body: '{"message":"hola"}' });
  assert.equal(bad.status, 403); const ok = await fetch('http://localhost:8787/api/health', { headers: { origin: 'http://localhost:8000' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:8000');
});

console.log('\nSin conexión con la API');
await test('API inalcanzable → "Sin conexión con la IA", chat en demo, nada simulado como IA', async () => {
  const { page, ctx } = await open(8002); assert.equal((await page.textContent('#modeLabel')).trim(), 'Sin conexión con la IA');
  await page.click('#openChatHome'); await page.fill('#chatInput', 'hola'); await page.press('#chatInput', 'Enter'); await page.waitForSelector('.bubble-tag');
  assert.ok((await page.$$eval('.bubble-tag', (n) => n.map((x) => x.textContent))).every((t) => /Modo demo/.test(t))); await ctx.close();
});

console.log('\nAccesibilidad básica y móvil');
await test('móvil 390px: sin desbordamiento horizontal en ninguna vista', async () => {
  const { page, ctx } = await open(8000, { width: 390, height: 800 });
  for (const v of ['inicio', 'lectura', 'tramites', 'acerca']) { await page.click(`.nav-link[data-view="${v}"]`).catch(async () => { await page.evaluate((x) => document.querySelector(`[data-view="${x}"]`).click(), v); });
    if (v === 'lectura') { await page.click('#loadExample'); } if (v === 'tramites') { await page.click('[data-proc="dni"]'); }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(over <= 1, `${v} desborda ${over}px`); }
  await ctx.close();
});
await test('teclado: el diálogo de consentimiento atrapa el foco, Escape equivale a "Ahora no" y devuelve el foco', async () => {
  const { page, ctx } = await open(8000); await page.click('[data-view="lectura"]'); await page.fill('#inputText', EX); await page.click('#useText');
  await page.focus('[data-task="easy"]'); await page.keyboard.press('Enter'); await page.waitForSelector('#consentDialog[open]');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('#consentDialog')), true, 'el foco salió del diálogo hacia el contenido de fondo'); }
  await page.keyboard.press('Escape'); await page.waitForSelector('#consentDialog:not([open])', { state: 'attached' });
  const foc = await page.evaluate(() => document.activeElement.id || document.activeElement.dataset.task || document.activeElement.tagName); assert.equal(foc, 'easy', 'foco tras cerrar: ' + foc); assert.equal(await page.evaluate(() => sessionStorage.getItem('claria.consent')), 'no'); await ctx.close();
});
await test('todos los botones e inputs tienen nombre accesible', async () => {
  const { page, ctx } = await open(8000); await page.click('#openChatHome');
  const bad = await page.evaluate(() => [...document.querySelectorAll('button,input,textarea,a[href]')].filter((e) => !e.closest('[hidden]') && !(e.getAttribute('aria-label') || e.textContent.trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.title)).map((e) => e.outerHTML.slice(0, 80)));
  assert.deepEqual(bad, []); await ctx.close();
});

await browser.close(); [sDemo, sConn, sOff, api, mock.server].forEach((s) => s.close());
const failed = results.filter((r) => !r[0]); console.log(`\n${results.length - failed.length}/${results.length} pruebas OK`); process.exit(failed.length ? 1 : 0);
