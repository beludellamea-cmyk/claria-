// E2E del creador de guías de trámite (etapa 4). Sin red externa. Uso: node tests/e2e-creador.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import os from 'node:os';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); if (u === '/config.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end('window.CLARIA_CONFIG={apiBase:""};'); }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(8018, r)); const BASE = 'http://localhost:8018/';
const browser = await chromium.launch(); const results = [];
const test = async (n, fn) => { try { await fn(); results.push(1); console.log('  ✔', n); } catch (e) { results.push(0); console.log('  ✘', n, '\n   ', e.message.split('\n')[0], (String(e.stack).match(/e2e-creador\.mjs:\d+/) || [''])[0]); } };
async function abrir({ ancho = 1280, alto = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, acceptDownloads: true }); const page = await ctx.newPage(); const ext = [], errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) ext.push(u); });
  await page.goto(BASE); await page.waitForSelector('#claria'); return { ctx, page, ext, errs };
}
const aCreador = async (page) => { await page.click('#view-inicio [data-view="tramites"]'); await page.click('#tramPaso1 [data-view="creador"]'); await page.waitForSelector('#crPaso1:not([hidden])'); };
const armar = async (page, titulo, texto) => { await page.fill('#crTitulo', titulo); await page.fill('#crTexto', texto); await page.click('#crArmar'); await page.waitForSelector('#crPaso2:not([hidden])'); };
const pasosTxt = (page) => page.$$eval('#crLista .cr-input', (n) => n.map((x) => x.value));
const pend = (page) => page.$$eval('#crLista .cr-paso .cr-badge:first-of-type', (n) => n.map((x) => x.textContent));
const resolver = async (page) => { // elige un pictograma verificado para cada ficha pendiente
  for (let g = 0; g < 40; g++) { const b = await page.$('#crLista .cr-pend .cr-mini'); if (!b) break; const pal = await b.getAttribute('aria-label'); await b.click(); await page.waitForSelector('#crDialogo[open]');
    const ok = await page.$('#crDialogoActual button'); if (ok) await ok.click(); else { await page.fill('#crBuscar', 'ir'); await page.click('#crOpciones .tb-palabra >> nth=0'); } await page.waitForFunction(() => !document.getElementById('crDialogo').open); }
};

console.log('\nCreador de guías de trámite');
await test('se llega desde «Entender un trámite» y pide el texto del organismo; no hay nada generado por IA', async () => {
  const { page, ext, errs, ctx } = await abrir(); await aCreador(page); assert.match(await page.textContent('#crTitulo1'), /¿Qué trámite querés explicar\?/); assert.match(await page.textContent('#crPaso1'), /CLARIA no lo escribe ni lo inventa/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'crTitulo1'); assert.deepEqual(ext, []); assert.deepEqual(errs, []); await ctx.close();
});
await test('el ejemplo del formato (REALIZAR UNA CONSULTA) se arma en mayúsculas, numerado y con un paso por renglón', async () => {
  const { page, ctx } = await abrir(); await aCreador(page); await page.click('#crEjemplo'); await page.click('#crArmar'); await page.waitForSelector('#crPaso2:not([hidden])');
  assert.deepEqual(await pasosTxt(page), ['REALIZAR UNA CONSULTA', 'ACERCATE AL MOSTRADOR', 'DECÍ QUÉ NECESITÁS', 'ESCUCHÁ LA RESPUESTA']); assert.match(await page.textContent('#crLista'), /PASO 1/); assert.match(await page.textContent('#crLista'), /PASO 3/); await ctx.close();
});
await test('un pictograma dudoso o faltante deja el paso PENDIENTE y no se acepta solo; sin resolverlo no hay PDF final', async () => {
  const { page, errs, ctx } = await abrir(); await aCreador(page); await armar(page, 'Presentar documentación', 'Presentá el DNI.\nEsperá tu turno.');
  assert.match(await page.textContent('#crResumen'), /Quedan \d+ pictograma/); assert.equal(await page.isDisabled('#crPdf'), true); assert.match(await page.textContent('#crMotivo'), /No se puede descargar el PDF final/);
  assert.ok((await page.$$('#crLista .cr-ficha.cr-pend')).length >= 1); const dni = page.locator('.cr-ficha', { hasText: 'DNI' }); assert.match(await dni.textContent(), /revisar/i);
  await dni.locator('button').click(); await page.waitForSelector('#crDialogo[open]'); assert.match(await page.textContent('#crDialogoActual'), /Propuesta de CLARIA/); await page.click('#crDialogoActual button'); assert.equal(await page.locator('.cr-ficha', { hasText: 'DNI' }).locator('.cr-badge').textContent(), 'listo'); assert.deepEqual(errs, []); await ctx.close();
});
await test('avisos de la guía oficial: imperativo, una sola acción y objeto concreto (orientativos)', async () => {
  const { page, ctx } = await abrir(); await aCreador(page); await armar(page, 'Sacar turno', 'Turno para presentar el formulario y pagar.\nImprimilo.\nCompletá el formulario.');
  const av = await page.$$eval('#crLista .cr-aviso', (n) => n.map((x) => x.textContent)); assert.ok(av.some((a) => /verbo en imperativo/.test(a))); assert.ok(av.some((a) => /más de una acción/.test(a))); assert.ok(av.some((a) => /IMPRIMILO/.test(a)));
  const ultimo = await page.locator('#crLista > li').last().textContent(); assert.ok(!/imperativo/.test(ultimo), 'un paso correcto no recibe aviso'); await ctx.close();
});
await test('PDF final: solo con todo resuelto + fuente + fecha + responsable + revisión humana; el PDF es real e incluye el crédito', async () => {
  const { page, errs, ctx } = await abrir(); await aCreador(page); await page.fill('#crOrganismo', 'Biblioteca ficticia'); await page.fill('#crFuente', 'Documento de ejemplo'); await page.fill('#crFecha', '2026-11-14'); await page.fill('#crResp', 'Área de comunicación');
  await page.click('#crEjemplo'); await page.click('#crArmar'); await page.waitForSelector('#crPaso2:not([hidden])'); await resolver(page); assert.match(await page.textContent('#crResumen'), /Todos los pictogramas están resueltos/);
  assert.equal(await page.isDisabled('#crPdf'), true); assert.match(await page.textContent('#crMotivo'), /marcá que una persona revisó/); await page.check('#crRevision'); assert.equal(await page.isDisabled('#crPdf'), false);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#crPdf')]); assert.equal(dl.suggestedFilename(), 'guia-tramite.pdf'); const buf = fs.readFileSync(await dl.path()); assert.equal(buf.slice(0, 5).toString(), '%PDF-'); assert.ok(buf.length > 30000);
  fs.writeFileSync(path.join(os.tmpdir(), 'claria-guia-final.pdf'), buf); await page.waitForFunction(() => /no es una guía oficial/.test(document.getElementById('crEstado').textContent)); assert.deepEqual(errs, []); await ctx.close();
});
await test('metadatos incompletos: el PDF final queda bloqueado y dice qué falta; el borrador sale marcado', async () => {
  const { page, ctx } = await abrir(); await aCreador(page); await page.click('#crEjemplo'); await page.click('#crArmar'); await page.waitForSelector('#crPaso2:not([hidden])'); await resolver(page); await page.check('#crRevision');
  assert.equal(await page.isDisabled('#crPdf'), true); assert.match(await page.textContent('#crMotivo'), /organismo, fuente, fecha de verificación, responsable/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#crBorrador')]); assert.equal(dl.suggestedFilename(), 'guia-tramite-BORRADOR.pdf'); const buf = fs.readFileSync(await dl.path()); assert.equal(buf.slice(0, 5).toString(), '%PDF-'); fs.writeFileSync(path.join(os.tmpdir(), 'claria-guia-borrador.pdf'), buf); await ctx.close();
});
await test('editar, mover y quitar pasos; al editar el texto se vuelve a analizar el pictograma', async () => {
  const { page, ctx } = await abrir(); await aCreador(page); await armar(page, 'Consulta', 'Esperá tu turno.\nElegí un lugar.\nFirmá el formulario.');
  await page.click('button[aria-label="Bajar paso 1"]'); assert.deepEqual((await pasosTxt(page)).slice(1), ['ELEGÍ UN LUGAR', 'ESPERÁ TU TURNO', 'FIRMÁ EL FORMULARIO']); await page.click('button[aria-label="Quitar paso 2"]'); assert.equal((await pasosTxt(page)).length, 3);
  await page.fill('#crTxt1', 'comprá el pan'); await page.press('#crTxt1', 'Tab'); assert.equal(await page.inputValue('#crTxt1'), 'COMPRÁ EL PAN'); assert.ok(await page.locator('#crLista > li').nth(1).locator('img').count() >= 1); await ctx.close();
});
await test('validaciones: sin título o sin texto no arma nada; no se guarda nada en el dispositivo', async () => {
  const { page, ctx } = await abrir(); await aCreador(page); await page.click('#crArmar'); assert.match(await page.textContent('#crEstado'), /Escribí el título/); await page.fill('#crTitulo', 'X'); await page.click('#crArmar'); assert.match(await page.textContent('#crEstado'), /Pegá el texto/);
  assert.equal(await page.isVisible('#crPaso2'), false); assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)).includes('trámite') || Object.keys(localStorage).some((k) => /guia|creador|tramite/i.test(k))), false, 'no guarda borradores'); await ctx.close();
});
await test('volver: revisión → datos (conserva los pasos) → trámites; la guía conoce cada pantalla', async () => {
  const { page, errs, ctx } = await abrir(); await aCreador(page); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'creador1'); await armar(page, 'Consulta', 'Esperá tu turno.'); assert.equal(await page.evaluate(() => document.body.dataset.pantalla), 'creador2');
  await page.click('#view-creador .back-btn'); await page.waitForSelector('#crPaso1:not([hidden])'); assert.equal(await page.inputValue('#crTitulo'), 'Consulta'); await page.click('#view-creador .back-btn'); await page.waitForSelector('#tramPaso1:not([hidden])'); assert.deepEqual(errs, []); await ctx.close();
});
await test('móvil 390 px y accesibilidad: sin desbordes, campos con etiqueta, botones con nombre', async () => {
  const { page, ctx } = await abrir({ ancho: 390, alto: 800 }); const over = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await aCreador(page); assert.equal(await over(), false, 'datos'); await page.click('#crEjemplo'); await page.click('#crArmar'); await page.waitForSelector('#crPaso2:not([hidden])'); assert.equal(await over(), false, 'revisión');
  const bad = await page.evaluate(() => [...document.querySelectorAll('#view-creador button,#view-creador input,#view-creador textarea')].filter((e) => !e.closest('[hidden]') && !e.closest('dialog:not([open])') && !(e.getAttribute('aria-label') || e.textContent.trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.closest('label'))).map((e) => e.outerHTML.slice(0, 80))); assert.deepEqual(bad, []); await ctx.close();
});
srv.close(); await browser.close(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} pruebas OK`); process.exit(ok === results.length ? 0 : 1);
