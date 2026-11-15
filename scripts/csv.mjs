// Lector CSV mínimo (comillas, saltos de línea dentro de comillas, BOM). Sin dependencias.
export function parseCSV(texto) {
  const t = texto.replace(/^﻿/, ''); const filas = []; let f = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; f.push(c); c = ''; if (f.some((x) => x !== '')) filas.push(f); f = []; } else c += ch; }
  if (c !== '' || f.length) { f.push(c); if (f.some((x) => x !== '')) filas.push(f); }
  const [cab, ...resto] = filas; return resto.map((r) => Object.fromEntries(cab.map((k, i) => [k.trim(), (r[i] ?? '').trim()])));
}
