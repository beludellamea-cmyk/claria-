// Importa fichas institucionales COMPLETADAS (CSV con las columnas de 03_INSTITUCIONES_PLANTILLA.csv) a data/ciudad.json.
// Uso: node scripts/importar-fichas.mjs fichas.csv [--publicar]
// Reglas (CLARIA no inventa ni publica sola):
//  - Un dato cuenta como confirmado solo si la fila tiene fuente_oficial_url (https), fecha_verificacion (AAAA-MM-DD) y revisado_y_aprobado=SI.
//  - Una fila incompleta o sin aprobar se importa como «borrador» y la app no muestra nada de ella.
//  - El estado «publicado» solo se asigna con --publicar Y fila completa y aprobada. Sin esa bandera queda «revisado».
//  - Instituciones desconocidas se rechazan: no se crean nuevas desde un CSV.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { parseCSV } from './csv.mjs';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export function evaluarFila(f) {
  const p = [];
  if (!/^https?:\/\//.test(f.fuente_oficial_url || '')) p.push('falta fuente_oficial_url (https)');
  if (!FECHA.test(f.fecha_verificacion || '')) p.push('falta fecha_verificacion (AAAA-MM-DD)');
  if (String(f.revisado_y_aprobado || '').toUpperCase() !== 'SI') p.push('revisado_y_aprobado distinto de SI');
  return p;
}
export function aplicarFichas(ciudad, filas, { publicar = false, hoy = new Date().toISOString().slice(0, 10) } = {}) {
  const informe = [];
  for (const f of filas) {
    const inst = ciudad.instituciones.find((i) => i.nombre === f.institucion || i.id === f.institucion);
    if (!inst) { informe.push({ institucion: f.institucion, resultado: 'RECHAZADA: institución desconocida' }); continue; }
    const { institucion, ...ficha } = f; const faltas = evaluarFila(f);
    inst.ficha = { ...inst.ficha, ...ficha, revisado_y_aprobado: faltas.length ? 'NO' : 'SI' };
    inst.revision = { responsable: f.contacto_responsable || inst.revision.responsable, fecha: f.fecha_verificacion || '', fuente: f.fuente_oficial_url || '', ultima_revision: hoy };
    inst.estado = faltas.length ? 'borrador' : publicar ? 'publicado' : 'revisado';
    informe.push({ institucion: inst.nombre, resultado: faltas.length ? `BORRADOR (${faltas.join('; ')})` : inst.estado.toUpperCase() });
  }
  return informe;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , archivo, ...flags] = process.argv; if (!archivo) { console.error('Uso: node scripts/importar-fichas.mjs fichas.csv [--publicar]'); process.exit(1); }
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const destino = path.join(ROOT, 'data/ciudad.json');
  const ciudad = JSON.parse(fs.readFileSync(destino, 'utf8')); const informe = aplicarFichas(ciudad, parseCSV(fs.readFileSync(archivo, 'utf8')), { publicar: flags.includes('--publicar') });
  fs.writeFileSync(destino, JSON.stringify(ciudad, null, 1) + '\n'); informe.forEach((r) => console.log(`${r.institucion}: ${r.resultado}`));
  console.log('Revisá el cambio con git diff antes de publicar.');
}
