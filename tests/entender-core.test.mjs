// Reglas puras de «Entender»: extracción literal de datos, calidad de lectura y anti-invento. Uso: node --test tests/entender-core.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../entender-core.js');
const NOTA = `Escuela N* 3 - Comunicado a las familias
Señores padres:
Les informamos que el viernes 21 de noviembre
a las 9:30 hs se realizará la reunión de padres
en el aula de 3* grado.
Deben traer fotocopia del DNI del alumno
y el certificado de vacunas.
Es obligatorio confirmar la asistencia
hasta el miércoles 19/11 por el cuaderno.
Cooperadora: cuota de $ 2500.
Gracias, La Dirección.`;
const WSP = `Grupo Familias 3% B
Buenas tardes! Les recuerdo que
mañana lunes 24 hay acto en la
plaza a las 8:15. Llevar vianda
y gorra. No hay clases después
de las 12 hs.
18:42
Gracias seño! Confirmo que voy.
Quién trae las banderas?`;
const CARTEL = `CAMPAÑA DE VACUNACIÓN
Sábado 29 de noviembre
de 9 a 13 hs
Centro de Salud Barrio Norte
Calle Mitre 450
Gratuita - Llevar libreta de vacunación`;
const FORM = `FORMULARIO DE INSCRIPCIÓN
Fecha de nacimiento:
Entregar completo hasta el 5 de diciembre
en secretaría, de lunes a viernes de 8 a 12 hs.
Requisito: firma del padre, madre o tutor.`;
const lista = (d, k) => d[k].map((x) => x.texto);

test('nota escolar: fechas, horarios, dinero, lugar, requisitos y acciones, todo literal', () => {
  const d = C.extraerDatos(NOTA);
  assert.deepEqual(lista(d, 'fechas'), ['viernes 21 de noviembre', 'miércoles 19/11']);
  assert.deepEqual(lista(d, 'horarios'), ['a las 9:30 hs']);
  assert.deepEqual(lista(d, 'dinero'), ['$ 2500']);
  assert.ok(lista(d, 'lugares').some((x) => /aula de 3/.test(x)), JSON.stringify(d.lugares));
  assert.ok(d.requisitos.some((x) => /fotocopia del DNI/.test(x.texto)));
  assert.ok(d.requisitos.some((x) => /obligatorio confirmar/.test(x.texto)));
  for (const k of ['fechas', 'horarios', 'dinero', 'lugares']) d[k].forEach((x) => assert.ok(C.citaEnTexto(x.texto, NOTA), `${k}: ${x.texto}`));
  [...d.requisitos, ...d.acciones].forEach((x) => assert.ok(C.citaEnTexto(x.texto, NOTA), x.texto));
});
test('captura de WhatsApp: «lunes 24», a las 8:15 y 12 hs, llevar vianda; la hora del mensaje (18:42) se trata como horario sin inventar nada', () => {
  const d = C.extraerDatos(WSP);
  assert.ok(lista(d, 'fechas').includes('lunes 24')); const h = lista(d, 'horarios'); assert.ok(h.includes('a las 8:15') && h.includes('12 hs'), h.join('|'));
  assert.ok(d.acciones.concat(d.requisitos).some((x) => /Llevar vianda y gorra/.test(x.texto)));
  Object.values(d).flat().forEach((x) => assert.ok(C.citaEnTexto(x.texto, WSP), x.texto));
});
test('cartel: fecha, rango horario, lugar con dirección y qué llevar', () => {
  const d = C.extraerDatos(CARTEL);
  assert.deepEqual(lista(d, 'fechas'), ['Sábado 29 de noviembre']); assert.deepEqual(lista(d, 'horarios'), ['de 9 a 13 hs']);
  assert.ok(lista(d, 'lugares').some((x) => /Calle Mitre 450/.test(x))); assert.ok(lista(d, 'lugares').some((x) => /Centro de Salud Barrio Norte/.test(x)));
  assert.ok(d.requisitos.concat(d.acciones).some((x) => /libreta/.test(x.texto)));
});
test('formulario: fecha límite, horario de atención y requisito de firma', () => {
  const d = C.extraerDatos(FORM); assert.ok(lista(d, 'fechas').includes('5 de diciembre')); assert.ok(lista(d, 'horarios').includes('de 8 a 12 hs')); assert.ok(d.requisitos.some((x) => /firma/.test(x.texto)));
});
test('un texto sin datos no inventa nada', () => {
  const d = C.extraerDatos('Hola, ¿cómo estás? Hoy el día está lindo y me gusta caminar por el parque.'); assert.equal(C.hayDatos(d), false);
});
test('no confunde precios, teléfonos ni números sueltos con fechas', () => {
  const d = C.extraerDatos('El costo es $ 2.500 y el teléfono 3718-445566. Código 12345 en el aula 4.'); assert.deepEqual(d.fechas, []); assert.deepEqual(lista(d, 'dinero'), ['$ 2.500']);
});
test('citaEnTexto: tolera tildes, mayúsculas y saltos de línea; rechaza lo que no está escrito', () => {
  assert.equal(C.citaEnTexto('MIERCOLES 19/11', NOTA), true); assert.equal(C.citaEnTexto('a las 9:30 hs se realizará la reunión', NOTA), true);
  assert.equal(C.citaEnTexto('jueves 20 de noviembre', NOTA), false); assert.equal(C.citaEnTexto('', NOTA), false); assert.equal(C.citaEnTexto('traer el cuaderno rojo', NOTA), false);
});
test('calidad: buena, dudosa, mala y sin texto', () => {
  const pal = (n, c) => Array.from({ length: n }, (_, i) => ({ t: 'palabra' + i, c })); const txt = 'palabra '.repeat(10);
  assert.equal(C.calidadOCR({ confianza: 93, palabras: pal(20, 93), texto: txt }).nivel, 'buena');
  assert.equal(C.calidadOCR({ confianza: 78, palabras: pal(20, 78), texto: txt }).nivel, 'dudosa');
  assert.equal(C.calidadOCR({ confianza: 52, palabras: [...pal(10, 80), ...pal(10, 30)], texto: txt }).nivel, 'mala');
  assert.equal(C.calidadOCR({ confianza: 90, palabras: [...pal(18, 95), ...pal(2, 20)], texto: txt }).nivel, 'dudosa');
  assert.equal(C.calidadOCR({ confianza: 88, palabras: [{ t: '7N', c: 88 }], texto: '7N' }).nivel, 'sin_texto');
  assert.match(C.calidadOCR({ confianza: 38, palabras: pal(5, 30), texto: txt }).mensaje, /otra foto/);
});
test('nitidez: una imagen con bordes marcados supera ampliamente a una borrosa/uniforme', () => {
  const w = 64, h = 64, n = new Uint8Array(w * h), b = new Uint8Array(w * h).fill(128); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n[y * w + x] = (x >> 2) % 2 ? 255 : 0;
  assert.ok(C.nitidez(n, w, h) > 1000); assert.equal(C.nitidez(b, w, h), 0);
});
test('texto para la IA: las palabras dudosas sin corregir van como [ilegible]; lo seguro queda igual', () => {
  const lineas = [{ palabras: [{ t: 'Traer', c: 95 }, { t: 'x7#', c: 20 }, { t: 'mañana', c: 90 }] }, { palabras: [{ t: '9:30', c: 80 }] }];
  assert.equal(C.armarTextoIA(lineas), 'Traer [ilegible] mañana\n9:30'); assert.deepEqual(C.fichasDeLineas(lineas)[0].map((f) => f.dudosa), [false, true, false]);
});
