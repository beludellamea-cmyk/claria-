// Convierte el Paquete Maestro (CSV + manifiesto) en data/ciudad.json SIN perder campos, procedencia ni estado de revisión.
// Uso: node scripts/importar-paquete.mjs [carpeta-del-paquete]   (por defecto docs/paquete-maestro)
// Reglas: no inventa IDs ni datos institucionales; los datos de la ficha quedan vacíos y la institución en estado «borrador».
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { parseCSV } from './csv.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const SRC = path.resolve(process.argv[2] || path.join(ROOT, 'docs/paquete-maestro'));
const leer = (n) => fs.readFileSync(path.join(SRC, n), 'utf8');
const manifiesto = JSON.parse(leer('04_MANIFIESTO_PARA_INTEGRAR.json')); const frasesCsv = parseCSV(leer('02_TABLEROS_FRASES.csv')); const plantilla = parseCSV(leer('03_INSTITUCIONES_PLANTILLA.csv'));
const dic = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pictogramas.json'), 'utf8')); const porId = new Map(dic.entradas.map((e) => [e.id, e]));
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ICONOS = { 'registro-civil': '📄', 'hospital-y-centros-de-salud': '🏥', 'municipalidad': '🏛️', 'pami': '💙', 'correo-argentino': '📮', 'terminal-de-omnibus': '🚌' };
const RANGO = { PENDIENTE_SELECCION_MANUAL: 3, VERIFICADO_GENERICO_REVISAR_CONTEXTUALMENTE: 2, VERIFICADO_DICCIONARIO_CLARIA: 1 };
const errores = [];
// estado por ID: el más restrictivo entre todas las filas que usan ese ID (conservador)
const estadoPorId = new Map(), conceptoPorId = new Map();
for (const p of manifiesto.pictogramas) { if (!p.estado.startsWith('VERIFICADO')) continue;
  if (!porId.has(p.id_arasaac)) errores.push(`ID ${p.id_arasaac} (${p.concepto}) no está en data/pictogramas.json`);
  else if (porId.get(p.id_arasaac).lema !== p.lema_diccionario) errores.push(`Lema distinto para ${p.id_arasaac}: ${p.lema_diccionario} vs ${porId.get(p.id_arasaac).lema}`);
  if (!fs.existsSync(path.join(ROOT, p.archivo_en_repositorio))) errores.push(`Falta el archivo ${p.archivo_en_repositorio}`);
  if (!estadoPorId.has(p.id_arasaac) || RANGO[p.estado] > RANGO[estadoPorId.get(p.id_arasaac)]) estadoPorId.set(p.id_arasaac, p.estado); if (!conceptoPorId.has(p.id_arasaac)) conceptoPorId.set(p.id_arasaac, p.concepto); }
const instituciones = plantilla.map((fila) => {
  const nombre = fila.institucion; const id = slug(nombre);
  const frases = frasesCsv.filter((r) => r.institucion === nombre).sort((a, b) => Number(a.orden) - Number(b.orden)).map((r) => {
    const lemas = r.lemas_verificados.split('|').map((x) => x.trim()).filter(Boolean), ids = r.ids_verificados.split('|').map((x) => Number(x.trim())).filter(Boolean);
    if (lemas.length !== ids.length) errores.push(`Frase «${r.frase_en_mayusculas}»: lemas e IDs no coinciden`);
    const tarjetas = ids.map((i, k) => { const e = porId.get(i); if (!e) errores.push(`Frase «${r.frase_en_mayusculas}»: ID ${i} fuera del diccionario`); else if (e.lema !== lemas[k]) errores.push(`Frase «${r.frase_en_mayusculas}»: ${lemas[k]} ≠ ${e.lema}`);
      return { lema: lemas[k], id: i, concepto: conceptoPorId.get(i) || lemas[k], estado: estadoPorId.get(i) || 'VERIFICADO_DICCIONARIO_CLARIA' }; });
    return { orden: Number(r.orden), texto: r.frase_en_mayusculas, tarjetas, revisar: r.conceptos_a_revisar.split('|').map((x) => x.trim()).filter(Boolean), nivel: r.nivel, nota: r.nota };
  });
  // Los datos institucionales NO se verifican aquí: se copian tal cual vienen de la plantilla (vacíos) y la institución queda en borrador.
  const { institucion, ...ficha } = fila;
  return { id, nombre, icono: ICONOS[id] || '📍', estado: 'borrador', ficha, revision: { responsable: '', fecha: '', fuente: '', ultima_revision: '' }, frases };
});
if (instituciones.length !== 6) errores.push(`Se esperaban 6 instituciones y hay ${instituciones.length}`);
const salida = { version: 1, generado: manifiesto.fecha_armado, origen: 'CLARIA_Paquete_Maestro (docs/paquete-maestro)', proyecto: manifiesto.proyecto,
  licencia_pictogramas: { licencia: manifiesto.licencia_pictogramas, autor: manifiesto.autor, titular: manifiesto.titular, origen: manifiesto.origen,
    credito: 'Los símbolos pictográficos utilizados son propiedad del Gobierno de Aragón y han sido creados por Sergio Palao para ARASAAC (https://arasaac.org), que los distribuye bajo licencia Creative Commons BY-NC-SA.' },
  aviso: 'Las frases son ayudas de comunicación, NO procedimientos oficiales. Ningún dato institucional está verificado: solo se muestra lo que una ficha aprobada (con fuente y fecha) y publicada confirme.',
  estados_pictograma: { VERIFICADO_DICCIONARIO_CLARIA: 'ID y significado verificados en data/pictogramas.json', VERIFICADO_GENERICO_REVISAR_CONTEXTUALMENTE: 'Pictograma genérico: acompañar con texto específico; no asumir que la institución ofrece ese servicio', PENDIENTE_SELECCION_MANUAL: 'Sin pictograma verificado: mostrar solo texto hasta que un editor elija uno' },
  pictogramas: manifiesto.pictogramas, instituciones };
if (errores.length) { console.error('ERRORES:\n - ' + errores.join('\n - ')); process.exit(1); }
fs.writeFileSync(path.join(ROOT, 'data/ciudad.json'), JSON.stringify(salida, null, 1) + '\n');
const c = (e) => manifiesto.pictogramas.filter((p) => p.estado === e).length;
console.log(`OK data/ciudad.json · ${instituciones.length} instituciones · ${instituciones.reduce((n, i) => n + i.frases.length, 0)} frases · ${manifiesto.pictogramas.length} pictogramas (verificados ${c('VERIFICADO_DICCIONARIO_CLARIA')}, genéricos ${c('VERIFICADO_GENERICO_REVISAR_CONTEXTUALMENTE')}, pendientes ${c('PENDIENTE_SELECCION_MANUAL')})`);
