/* CLARIA · Entender: reglas puras (sin pantalla, sin red). Compartido por el navegador y las pruebas en Node.
   - Nada de acá usa IA. Lo que se "encuentra" son fragmentos LITERALES del texto leído (fechas, horarios, dinero, lugares, pedidos).
   - Un dato solo se muestra si aparece escrito en el documento; la cita se puede comprobar con citaEnTexto().
   - La calidad de lectura (OCR) se calcula con la confianza que informa el reconocedor; si es baja, CLARIA lo dice y no sigue como si nada. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClariaEntenderCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
  const DIAS = 'lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo';
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  /** ¿La cita (o una versión sin tildes/mayúsculas/saltos de línea) está escrita en el texto? Anti-invento. */
  function citaEnTexto(cita, texto) { const c = norm(cita).replace(/[.,;:¡!¿?"'«»()]/g, '').trim(); if (c.length < 3) return false; return norm(texto).replace(/[.,;:¡!¿?"'«»()]/g, '').includes(c); }

  /** Une las líneas que se cortaron por el ancho de la foto (la siguiente empieza en minúscula y la anterior no terminó la oración). */
  function unidades(texto) {
    const out = [];
    String(texto || '').replace(/\r/g, '').split(/\n\s*\n/).forEach((bloque) => {
      let cur = '';
      bloque.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).forEach((l) => {
        if (cur && !/[.!?…]$/.test(cur) && /^[a-záéíóúñ0-9(]/.test(l)) cur += ' ' + l; else { if (cur) out.push(cur); cur = l; }
      });
      if (cur) out.push(cur);
    });
    return out;
  }
  /** Oraciones del texto, respetando carteles y renglones sueltos. */
  function oraciones(texto) {
    const out = [];
    unidades(texto).forEach((u) => u.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/).forEach((x) => { const t = x.trim(); if (t.length >= 4) out.push(t); }));
    return out;
  }

  function todos(re, texto, tipo) {
    const res = []; const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); let m;
    while ((m = g.exec(texto))) { if (m[0].length === 0) { g.lastIndex++; continue; } res.push({ tipo, texto: m[0].trim().replace(/[.,;]+$/, ''), ini: m.index, fin: m.index + m[0].length }); }
    return res;
  }
  // Se queda con el fragmento más largo cuando dos coinciden en el mismo lugar (p. ej. «viernes 21 de noviembre» y «21 de noviembre»).
  function sinSolapar(lista) {
    const orden = [...lista].sort((a, b) => (b.fin - b.ini) - (a.fin - a.ini) || a.ini - b.ini); const ok = [];
    for (const x of orden) if (!ok.some((y) => x.ini < y.fin && y.ini < x.fin)) ok.push(x);
    return ok.sort((a, b) => a.ini - b.ini);
  }
  const unico = (lista) => { const v = new Set(); return lista.filter((x) => { const k = norm(x.texto); if (v.has(k)) return false; v.add(k); return true; }); };
  const fraseDe = (frag, sents) => { const t = norm(frag); return sents.find((x) => norm(x).includes(t)) || ''; };

  const RE_FECHAS = [
    new RegExp(`\\b(?:${DIAS})\\s+\\d{1,2}\\s?[/\\-.]\\s?\\d{1,2}(?:\\s?[/\\-.]\\s?(?:\\d{4}|\\d{2}))?(?![\\d:])`, 'gi'),
    new RegExp(`\\b(?:(?:${DIAS})\\s+)?(?:\\d{1,2})\\s+de\\s+(?:${MESES})(?:\\s+(?:de|del)\\s+\\d{4})?`, 'gi'),
    /(?<![\d:.])\b(0?[1-9]|[12]\d|3[01])\s?[/\-.]\s?(0?[1-9]|1[0-2])(?:\s?[/\-.]\s?(?:\d{4}|\d{2}))?(?![\d:])\b/g,
    new RegExp(`\\b(?:${DIAS})\\s+\\d{1,2}\\b(?!\\s*(?:de\\s+(?:${MESES})|:|hs|horas|h\\b))`, 'gi'),
    new RegExp(`\\b(?:el|este|pr[oó]ximo|del)\\s+(?:${DIAS})\\b`, 'gi')
  ];
  const RE_HORAS = [
    /\bde\s+\d{1,2}(?:[:.]\d{2})?\s*(?:hs\.?|horas)?\s+a\s+\d{1,2}(?:[:.]\d{2})?\s*(?:hs\.?|horas)\b/gi,
    /\b(?:[01]?\d|2[0-3])\s?:\s?[0-5]\d\s*(?:hs\.?|horas)?/gi,
    /\ba\s+las\s+\d{1,2}(?:[:.][0-5]\d)?\s*(?:hs\.?|horas)?/gi,
    /\b\d{1,2}\s*(?:hs\.?|horas)(?![a-záéíóú])/gi
  ];
  const RE_DINERO = /\$\s?\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\$\s?\d+(?:,\d{1,2})?/g;
  const RE_LUGARES = [
    /\b(?:Av\.?|Avenida|Calle|Ruta|Bv\.?|Boulevard|Barrio)\s+[A-ZÁÉÍÓÚÑ0-9][\wáéíóúñÁÉÍÓÚÑ.]*(?:\s+(?:de\s+|del\s+)?[A-ZÁÉÍÓÚÑ][\wáéíóúñ]*)*(?:\s+(?:N[º°o]\.?\s*)?\d{1,5})?/g,
    /\b(?:lugar|direcci[oó]n|domicilio|sede|ubicaci[oó]n)\s*:\s*[^\n.;]{3,60}/gi,
    /\b(?:en|del|de la|al|a la)\s+(?:el\s+|la\s+)?(?:aula|sal[oó]n|sala|oficina|escuela|colegio|plaza|biblioteca|municipalidad|hospital|sede|patio|gimnasio|centro de salud|centro|secretar[ií]a|direcci[oó]n)(?:\s+(?:de|del|municipal|n[º°o.]*)?\s*[A-ZÁÉÍÓÚÑ0-9][\wáéíóúñ]*){0,4}/g,
    /\b(?:Centro de Salud|Hospital|Escuela|Colegio|Sal[oó]n|Municipalidad|Biblioteca)\s+(?:N[º°o]\.?\s*\d+|[A-ZÁÉÍÓÚÑ][\wáéíóúñ]*(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]*){0,3})/g
  ];
  const RE_REQ = /\b(requisito|documentaci[oó]n|certificado|fotocopia|carnet|carn[eé]|libreta|constancia|autorizaci[oó]n|partida|dni|firma|obligatori[oa]|imprescindible|necesari[oa]|no se (?:acepta|entrega|permite)|no hay)\b/i;
  const RE_ACC = /\b(tra(?:er|igan|ig[ao]|e[nr]?)|lleva(?:r|n)?|present(?:ar|en|e|a[rn]?)|adjunt(?:ar|en|e)|entreg(?:ar|ue[n]?|a[rn]?)|envi(?:ar|en|e|a)|complet(?:ar|en|e|a)|firm(?:ar|en|e|a)|confirm(?:ar|en|e|a)|avis(?:ar|en|e|a)|concurr(?:ir|an|a)|asist(?:ir|an|a)|inscrib(?:ir|irse|an|e)|respond(?:er|an|e)|devolv(?:er|an|e)|abon(?:ar|en|e)|pag(?:ar|uen|ue)|retir(?:ar|en|e)|comunic(?:arse|ar)|escrib(?:ir|an|anme)|deb(?:en|er[aá]n?|e)|record(?:ar|amos)|recuerd(?:en|e))\b/i;

  /** Busca en el texto, sin IA, lo que suele importar. Devuelve fragmentos LITERALES con la oración donde aparecen. */
  function extraerDatos(texto) {
    const t = String(texto || ''); const sents = oraciones(t); const us = unidades(t); const plano = us.join(' '); const lineal = us.join(' | ');
    const grupo = (res, tipo) => unico(sinSolapar(res)).map((x) => ({ tipo, texto: x.texto, frase: fraseDe(x.texto, sents) }));
    const fechas = grupo(RE_FECHAS.flatMap((re) => todos(re, plano, 'fecha')), 'fecha');
    const horarios = grupo(RE_HORAS.flatMap((re) => todos(re, plano, 'horario')).filter((x) => !fechas.some((f) => norm(f.texto) === norm(x.texto))), 'horario');
    const dinero = grupo(todos(RE_DINERO, plano, 'dinero'), 'dinero');
    const lugares = grupo(RE_LUGARES.flatMap((re) => todos(re, lineal, 'lugar')).map((x) => ({ ...x, texto: x.texto.replace(/[,;:]+$/, '').trim() })), 'lugar').filter((x) => x.texto.length >= 6);
    const requisitos = [], acciones = [];
    sents.forEach((s) => { if (RE_REQ.test(s)) requisitos.push({ tipo: 'requisito', texto: s, frase: s }); else if (RE_ACC.test(s)) acciones.push({ tipo: 'accion', texto: s, frase: s }); });
    return { fechas, horarios, dinero, lugares, requisitos: unico(requisitos).slice(0, 8), acciones: unico(acciones).slice(0, 8) };
  }
  const hayDatos = (d) => Object.values(d || {}).some((l) => l && l.length);

  /** Calidad de la lectura según la confianza del OCR. {nivel: buena | dudosa | mala | sin_texto, dudosas, mensaje} */
  function calidadOCR({ confianza = 0, palabras = [], texto = '' } = {}) {
    const letras = (String(texto).match(/\p{L}/gu) || []).length; const n = palabras.length;
    if (n < 3 || letras < 12) return { nivel: 'sin_texto', dudosas: [], confianza, mensaje: 'No encontré texto que se pueda leer en esta imagen. Sacá otra foto: de frente, con buena luz y que el papel ocupe toda la pantalla.' };
    const dudosas = palabras.filter((w) => w.c < 60 && /[\p{L}\d]/u.test(w.t)); const frac = dudosas.length / n;
    if (confianza < 65 || frac > 0.3) return { nivel: 'mala', dudosas, confianza, mensaje: 'La imagen está borrosa, oscura o tiene letra difícil: no pude leerla con seguridad y lo que se leyó puede estar mal. Sacá otra foto (más luz, sin sombras, sin mover el celular) o escribí el texto a mano.' };
    if (confianza < 85 || frac > 0.08) return { nivel: 'dudosa', dudosas, confianza, mensaje: `Algunas palabras no se leyeron bien (${dudosas.length}). Están marcadas: compará con el original antes de confiar en fechas, horarios o números.` };
    return { nivel: 'buena', dudosas, confianza, mensaje: 'La lectura salió clara. Igual, compará con el original: puede haber errores.' };
  }

  /** Nitidez: varianza del laplaciano sobre una imagen en grises (Uint8). Valores bajos = borrosa. */
  function nitidez(gris, w, h) {
    if (!gris || w < 3 || h < 3) return 0; let s = 0, s2 = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; const l = 4 * gris[i] - gris[i - 1] - gris[i + 1] - gris[i - w] - gris[i + w]; s += l; s2 += l * l; n++; }
    const m = s / n; return s2 / n - m * m;
  }

  /** Texto para la IA: si la persona no lo corrigió, las palabras dudosas (< umbral) se reemplazan por [ilegible] para que no las adivine. */
  function armarTextoIA(lineas, umbral = 45) { return (lineas || []).map((l) => (l.palabras || []).map((w) => (w.c < umbral && /[\p{L}\d]/u.test(w.t) ? '[ilegible]' : w.t)).join(' ')).join('\n').trim(); }
  /** Pasa un texto con líneas a fichas {t, dudosa} para marcar lo dudoso en pantalla. */
  function fichasDeLineas(lineas, umbral = 60) { return (lineas || []).map((l) => (l.palabras || []).map((w) => ({ t: w.t, dudosa: w.c < umbral && /[\p{L}\d]/u.test(w.t) }))); }
  /** Tesseract devuelve líneas con palabras y confianza; se simplifica a lo que usa CLARIA. */
  function lineasDeOCR(data) {
    const ls = (data && data.lines && data.lines.length ? data.lines : null);
    if (ls) return ls.map((l) => ({ palabras: (l.words || []).map((w) => ({ t: w.text, c: Number(w.confidence) || 0 })).filter((w) => w.t && w.t.trim()) })).filter((l) => l.palabras.length);
    const ws = (data && data.words) || []; return ws.length ? [{ palabras: ws.map((w) => ({ t: w.text, c: Number(w.confidence) || 0 })) }] : [];
  }
  function limpiarOCR(t) { return String(t || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }

  return { norm, citaEnTexto, unidades, oraciones, extraerDatos, hayDatos, calidadOCR, nitidez, armarTextoIA, fichasDeLineas, lineasDeOCR, limpiarOCR };
});
