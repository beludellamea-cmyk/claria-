// Pruebas del importador de fichas y de la integridad de data/ciudad.json. Uso: node --test tests/ciudad.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { parseCSV } from '../scripts/csv.mjs'; import { aplicarFichas, evaluarFila } from '../scripts/importar-fichas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const cargar = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ciudad.json'), 'utf8'));
const completa = { institucion: 'PAMI', nombre_oficial: 'PAMI', direccion_confirmada: 'X 1', horario_confirmado: '', telefono_confirmado: '', servicios_confirmados: 'A|B', fuente_oficial_url: 'https://pami.org.ar', fecha_verificacion: '2026-11-01', contacto_responsable: 'Ana', revisado_y_aprobado: 'SI', foto_autorizada: 'NO', url_ficha_claria: '' };
test('CSV: comillas, comas y saltos de línea', () => { const r = parseCSV('a,b\n"x, y","l1\nl2"\n'); assert.deepEqual(r, [{ a: 'x, y', b: 'l1\nl2' }]); });
test('ciudad.json: 6 instituciones, 48 frases, todas en borrador y sin datos institucionales', () => {
  const c = cargar(); assert.equal(c.instituciones.length, 6); assert.equal(c.instituciones.reduce((n, i) => n + i.frases.length, 0), 48);
  for (const i of c.instituciones) { assert.equal(i.estado, 'borrador'); assert.equal(i.frases.length, 8); for (const k of ['direccion_confirmada', 'horario_confirmado', 'telefono_confirmado', 'servicios_confirmados', 'fuente_oficial_url']) assert.equal(i.ficha[k], '', `${i.id}.${k}`); assert.notEqual(i.ficha.revisado_y_aprobado, 'SI'); }
});
test('ciudad.json: todo ID de tarjeta existe en el diccionario y tiene su PNG local; nunca hay IDs para conceptos pendientes', () => {
  const c = cargar(); const dic = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pictogramas.json'), 'utf8')); const ids = new Set(dic.entradas.map((e) => e.id));
  for (const i of c.instituciones) for (const f of i.frases) for (const t of f.tarjetas) { assert.ok(ids.has(t.id), `${t.lema} ${t.id}`); assert.ok(fs.existsSync(path.join(ROOT, `assets/picto/${t.id}.png`))); }
  for (const p of c.pictogramas.filter((x) => x.estado === 'PENDIENTE_SELECCION_MANUAL')) assert.ok(!p.id_arasaac, `pendiente con ID: ${p.concepto}`);
});
test('importar fichas: completa y aprobada queda «revisado»; solo --publicar la deja «publicado»', () => {
  let c = cargar(); let r = aplicarFichas(c, [completa]); assert.equal(c.instituciones.find((i) => i.id === 'pami').estado, 'revisado'); assert.match(r[0].resultado, /REVISADO/);
  c = cargar(); aplicarFichas(c, [completa], { publicar: true }); assert.equal(c.instituciones.find((i) => i.id === 'pami').estado, 'publicado');
});
test('importar fichas: sin fuente, sin fecha o sin aprobar → borrador y NO aprobada, aun con --publicar', () => {
  for (const mal of [{ fuente_oficial_url: '' }, { fecha_verificacion: '' }, { revisado_y_aprobado: 'NO' }, { fuente_oficial_url: 'javascript:alert(1)' }]) {
    const c = cargar(); aplicarFichas(c, [{ ...completa, ...mal }], { publicar: true }); const i = c.instituciones.find((x) => x.id === 'pami'); assert.equal(i.estado, 'borrador', JSON.stringify(mal)); assert.equal(i.ficha.revisado_y_aprobado, 'NO');
  }
  assert.ok(evaluarFila({}).length === 3);
});
test('importar fichas: una institución desconocida se rechaza y no se crea', () => { const c = cargar(); const r = aplicarFichas(c, [{ ...completa, institucion: 'Banco Inventado' }]); assert.match(r[0].resultado, /RECHAZADA/); assert.equal(c.instituciones.length, 6); });
