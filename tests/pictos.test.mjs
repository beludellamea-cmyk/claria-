import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../pictos.js');
const dic = JSON.parse(fs.readFileSync(new URL('../data/pictogramas.json', import.meta.url), 'utf8'));
const motor = P.crearMotor(dic);
const lemas = (t) => motor.analizar(t).tokens.map((x) => x.lema || '·');
const estados = (t) => motor.analizar(t).tokens.map((x) => x.estado);

test('diccionario: cada ID tiene su imagen local y palabra clave verificada', () => {
  for (const e of dic.entradas) {
    assert.ok(Number.isInteger(e.id), e.lema);
    assert.ok(fs.existsSync(new URL(`../assets/picto/${e.id}.png`, import.meta.url)), `falta imagen ${e.lema} ${e.id}`);
  }
  for (const x of dic.expresiones) assert.ok(fs.existsSync(new URL(`../assets/picto/${x.id}.png`, import.meta.url)));
});
test('HOLA', () => { assert.deepEqual(lemas('HOLA'), ['hola']); assert.equal(estados('HOLA')[0], 'verificado'); });
test('QUIERO AGUA', () => assert.deepEqual(lemas('QUIERO AGUA'), ['querer', 'agua']));
test('NECESITO SACAR UN TURNO PARA MI DNI: expresión y aviso DNI', () => {
  const r = motor.analizar('NECESITO SACAR UN TURNO PARA MI DNI').tokens;
  assert.deepEqual(r.map((x) => x.lema), ['necesitar', 'sacar un turno', 'para', 'mi', 'DNI']);
  assert.equal(r[1].orig, 'SACAR UN TURNO'); assert.equal(r[1].pic.id, 22190);
  assert.equal(r[4].estado, 'revisar');
});
test('LA ESCUELA ES PARA TODOS: artículo queda como texto', () => {
  const r = motor.analizar('LA ESCUELA ES PARA TODOS').tokens;
  assert.equal(r[0].estado, 'func'); assert.equal(r[0].pic, undefined);
  assert.deepEqual(r.slice(1).map((x) => x.lema), ['escuela', 'ser', 'para', 'todo']);
});
test('el texto original se conserva con posiciones exactas', () => {
  const t = 'Quiero   AGUA, por favor.'; const r = motor.analizar(t).tokens;
  for (const x of r) assert.equal(t.slice(x.start, x.end), x.orig);
});
test('verbos: voseo, pretérito, gerundio, clíticos', () => {
  assert.deepEqual(lemas('Querés comer'), ['querer', 'comer']);
  assert.equal(lemas('Fuimos a la escuela')[0], 'ir');
  assert.equal(lemas('estoy comiendo')[1], 'comer');
  assert.equal(lemas('Quiero lavarme')[1], 'lavar');
});
test('plurales y géneros', () => assert.deepEqual(lemas('los niños y las niñas'), ['·', 'niño', '·', '·', 'niña'].map((x, i) => (x === '·' ? '·' : x))));
test('interrogativos sin acento no se asignan fuera de preguntas; con ¿? sí', () => {
  assert.notEqual(lemas('Que bueno')[0], 'qué');
  assert.equal(lemas('¿Qué querés?')[0], 'qué');
});
test('palabras desconocidas, nombres propios y números nunca reciben pictograma', () => {
  const r = motor.analizar('Me llamo Ana y tengo 3 hijos').tokens;
  const ana = r.find((x) => x.orig === 'Ana'); assert.equal(ana.estado, 'sin'); assert.ok(ana.nombrePropio);
  assert.equal(r.find((x) => x.orig === '3').rol, 'dato');
});
test('párrafo escolar: ninguna ficha sin pictograma inventa ID', () => {
  const t = 'Estimadas familias: el lunes habrá reunión en la escuela. Deben traer el DNI del alumno y firmar la autorización.';
  for (const x of motor.analizar(t).tokens) if (['sin', 'func'].includes(x.estado)) assert.equal(x.pic, undefined);
});
test('conjugador no genera formas vacías', () => { for (const v of ['ir', 'ser', 'querer', 'comer', 'dormir']) for (const f of P.conjugar(v)) assert.ok(f.length > 1, v + ':' + f); });
