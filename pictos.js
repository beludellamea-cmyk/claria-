/* CLARIA · Motor de conceptos y pictogramas (navegador + Node).
   Convierte texto libre en una secuencia de "fichas": cada palabra conserva su texto original y, si corresponde,
   un pictograma ARASAAC de un diccionario local con IDs verificados. NUNCA se inventan IDs ni se elige un resultado
   sin comprobar que la palabra clave coincide. Estados de cada ficha:
     verificado  → diccionario local, sin ambigüedad
     revisar     → diccionario local, pero la palabra tiene varios sentidos / formas ambiguas
     elegido     → la persona eligió el pictograma (otra opción local o un resultado de ARASAAC en línea con palabra clave exacta)
     sin         → sin pictograma: queda la palabra escrita (se puede buscar o elegir otro)
     texto       → la persona eligió dejar solo la palabra
     func        → palabra gramatical (artículo, preposición…) que se muestra solo como texto                       */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClariaPictos = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const strip = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const normalizar = (s) => strip(String(s).toLowerCase());
  const tieneAcento = (s) => /[áéíóúü]/i.test(s);

  // ───────── Tokenización (conserva posiciones para resaltar sobre el texto original) ─────────
  function tokenizar(texto) {
    const re = /[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu; const out = []; let m;
    while ((m = re.exec(texto))) out.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
    return out;
  }

  // ───────── Conjugación (formas regulares + irregulares frecuentes, incluido voseo rioplatense) ─────────
  const FIN = {
    ar: { pres: ['o', 'as', 'ás', 'a', 'amos', 'áis', 'an'], pret: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], imp: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], subj: ['e', 'es', 'és', 'e', 'emos', 'éis', 'en'], imper: ['a', 'á', 'e', 'emos', 'ad', 'en'], ger: ['ando'], part: ['ado', 'ada', 'ados', 'adas'] },
    er: { pres: ['o', 'es', 'és', 'e', 'emos', 'éis', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], imp: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], subj: ['a', 'as', 'ás', 'a', 'amos', 'áis', 'an'], imper: ['e', 'é', 'a', 'amos', 'ed', 'an'], ger: ['iendo'], part: ['ido', 'ida', 'idos', 'idas'] },
    ir: { pres: ['o', 'es', 'ís', 'e', 'imos', 'ís', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], imp: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], subj: ['a', 'as', 'ás', 'a', 'amos', 'áis', 'an'], imper: ['e', 'í', 'a', 'amos', 'id', 'an'], ger: ['iendo'], part: ['ido', 'ida', 'idos', 'idas'] }
  };
  const FUT = ['é', 'ás', 'á', 'emos', 'éis', 'án'], CON = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'];
  const PRET_IRR = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'];
  const replaceLast = (s, a, b) => { const i = s.lastIndexOf(a); return i < 0 ? s : s.slice(0, i) + b + s.slice(i + a.length); };
  const CAMBIO = { ie: (s) => replaceLast(s, 'e', 'ie'), ue: (s) => replaceLast(s, 'o', 'ue'), i: (s) => replaceLast(s, 'e', 'i'), u: (s) => replaceLast(s, 'o', 'u'), jue: (s) => replaceLast(s, 'u', 'ue'), sint: (s) => replaceLast(s, 'e', 'i') };
  // Configuración por verbo: cambio vocálico fuerte (c), vocal de 3.ª persona en -ir (t), irregularidades.
  const IRREG = {
    querer: { c: 'ie', pret: 'quis', fut: 'querr' }, entender: { c: 'ie' }, cerrar: { c: 'ie' }, empezar: { c: 'ie' }, pensar: { c: 'ie' }, sentar: { c: 'ie' }, sentarse: { base: 'sentar', c: 'ie' },
    sentir: { c: 'ie', t: 'i' }, poder: { c: 'ue', pret: 'pud', fut: 'podr', extra: ['pudiendo'] }, encontrar: { c: 'ue' }, contar: { c: 'ue' }, volver: { c: 'ue', extra: ['vuelto', 'vuelta'] }, jugar: { c: 'jue' },
    dormir: { c: 'ue', t: 'u' }, pedir: { c: 'i', t: 'i' }, elegir: { c: 'i', t: 'i' },
    tener: { c: 'ie', yo: 'tengo', pret: 'tuv', fut: 'tendr', extra: ['ten', 'tené', 'tengamos'] }, venir: { c: 'ie', yo: 'vengo', pret: 'vin', fut: 'vendr', extra: ['ven', 'vení', 'viniendo', 'vengamos'] },
    hacer: { yo: 'hago', pret: 'hic', fut: 'har', extra: ['hizo', 'haz', 'hacé', 'hecho', 'hecha', 'hechos', 'hechas', 'hagamos'], subjStem: 'hag' },
    decir: { c: 'i', yo: 'digo', pret: 'dij', fut: 'dir', extra: ['di', 'decí', 'dicho', 'dicha', 'diciendo', 'dijeron', 'digamos'], subjStem: 'dig' },
    saber: { yo: 'sé', pret: 'sup', fut: 'sabr', subjStem: 'sep' }, traer: { yo: 'traigo', pret: 'traj', extra: ['trajo', 'trajeron', 'trayendo', 'traído', 'traída', 'trajiste'], subjStem: 'traig' },
    salir: { yo: 'salgo', fut: 'saldr', extra: ['sal', 'salí'], subjStem: 'salg' }, conocer: { yo: 'conozco', subjStem: 'conozc' },
    leer: { extra: ['leyó', 'leyeron', 'leyendo', 'leído', 'leída', 'leídos', 'leídas', 'leí', 'leíste', 'leímos'] }, enviar: { extra: ['envío', 'envías', 'enviás', 'envía', 'envían', 'envíe', 'envíes', 'envíen'] },
    abrir: { extra: ['abierto', 'abierta', 'abiertos', 'abiertas'] }, escribir: { extra: ['escrito', 'escrita', 'escritos', 'escritas'] },
    ver: { soloExtra: true, extra: ['veo', 'ves', 've', 'vemos', 'ven', 'vi', 'viste', 'vio', 'vimos', 'vieron', 'veía', 'veías', 'veíamos', 'veían', 'veré', 'verás', 'verá', 'veremos', 'verán', 'vería', 'visto', 'vista', 'viendo', 'vé', 'mirá', 'vea', 'veas', 'veamos', 'vean'] },
    dar: { soloExtra: true, extra: ['doy', 'das', 'da', 'damos', 'dan', 'di', 'diste', 'dio', 'dimos', 'dieron', 'daba', 'dabas', 'dábamos', 'daban', 'daré', 'darás', 'dará', 'daremos', 'darán', 'daría', 'dado', 'dada', 'dando', 'dé', 'des', 'demos', 'den', 'dá', 'dame', 'dale'] },
    ir: { soloExtra: true, extra: ['voy', 'vas', 'va', 'vamos', 'vais', 'van', 'fui', 'fuiste', 'fue', 'fuimos', 'fueron', 'iba', 'ibas', 'íbamos', 'iban', 'iré', 'irás', 'irá', 'iremos', 'irán', 'iría', 'ido', 'yendo', 'vaya', 'vayas', 'vayamos', 'vayan', 'andá', 've', 'andate'] },
    ser: { soloExtra: true, extra: ['soy', 'eres', 'sos', 'es', 'somos', 'sois', 'son', 'fui', 'fuiste', 'fue', 'fuimos', 'fueron', 'era', 'eras', 'éramos', 'eran', 'seré', 'serás', 'será', 'seremos', 'serán', 'sería', 'sido', 'siendo', 'sea', 'seas', 'seamos', 'sean', 'sé'] },
    estar: { soloExtra: true, extra: ['estoy', 'estás', 'estas', 'está', 'estamos', 'estáis', 'están', 'estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvieron', 'estaba', 'estabas', 'estábamos', 'estaban', 'estaré', 'estará', 'estarán', 'estaría', 'estado', 'estando', 'esté', 'estés', 'estemos', 'estén', 'estate'] }
  };
  function ajustar(inf, stem, fin) { // cambios ortográficos por la desinencia
    const e0 = fin[0];
    if (/car$/.test(inf) && /^[eé]/.test(fin)) return stem.replace(/c$/, 'qu') + fin;
    if (/gar$/.test(inf) && /^[eé]/.test(fin)) return stem.replace(/g$/, 'gu') + fin;
    if (/zar$/.test(inf) && /^[eé]/.test(fin)) return stem.replace(/z$/, 'c') + fin;
    if (/[gj]e?r$|gir$/.test(inf) && /^[oaá]/.test(e0)) return stem.replace(/g$/, 'j') + fin;
    return stem + fin;
  }
  function conjugar(infinitivo) {
    const inf0 = infinitivo.toLowerCase(), cfg = IRREG[inf0] || {}, inf = cfg.base || inf0;
    const tipo = inf.slice(-2); const F = FIN[tipo]; const out = new Set([inf0, inf]);
    if (cfg.soloExtra) { (cfg.extra || []).forEach((x) => out.add(x)); return out; }
    if (!F) return out;
    const stem = inf.slice(0, -2), strong = cfg.c ? CAMBIO[cfg.c](stem) : stem, third = cfg.t ? (cfg.t === 'u' ? CAMBIO.u(stem) : CAMBIO.sint(stem)) : stem;
    const add = (s, fin) => out.add(ajustar(inf, s, fin));
    F.pres.forEach((f, i) => add([0, 1, 3, 6].includes(i) ? strong : (cfg.t && [4, 5].includes(i) && false ? third : stem), f));
    F.subj.forEach((f, i) => add([0, 1, 3, 6].includes(i) ? (cfg.subjStem ? cfg.subjStem : strong) : (cfg.t && [4, 5].includes(i) ? third : stem), f));
    F.imper.forEach((f, i) => add([0, 2, 5].includes(i) ? strong : stem, f));
    F.imp.forEach((f) => add(stem, f)); F.part.forEach((f) => add(stem, f));
    F.ger.forEach((f) => add(cfg.t ? third : stem, f));
    F.pret.forEach((f, i) => { if (cfg.pret) PRET_IRR.forEach((e) => out.add(cfg.pret + e)); add(cfg.t && [2, 5].includes(i) ? third : stem, f); });
    FUT.forEach((f) => out.add((cfg.fut || inf) + f)); CON.forEach((f) => out.add((cfg.fut || inf) + f));
    if (cfg.yo) out.add(cfg.yo); (cfg.extra || []).forEach((x) => out.add(x));
    if (cfg.subjStem) ['e', 'es', 'a', 'as', 'an', 'amos'].forEach((e) => out.add(cfg.subjStem + e));
    return out;
  }

  // ───────── Palabras gramaticales (solo texto) ─────────
  const FUNC = new Set('el la los las un una unos unas de del al a ante bajo contra desde entre hacia hasta por segun sobre tras durante mediante y e o u ni pero que si como cuando donde me te se lo le les nos os mas ya aun tan pues'.split(' '));
  const CLITICOS = ['me', 'te', 'se', 'lo', 'la', 'le', 'nos', 'les', 'los', 'las'];

  // ───────── Plurales y géneros para sustantivos/adjetivos ─────────
  function pluralizar(f) {
    const l = f.toLowerCase(); const out = [];
    if (/[aeiouáéó]$/.test(l)) out.push(l + 's'); else if (/z$/.test(l)) out.push(l.replace(/z$/, 'ces')); else if (/[íú]$/.test(l)) out.push(l + 'es'); else out.push(l + 'es');
    return out;
  }
  const generos = (f) => (/o$/.test(f) ? [f.replace(/o$/, 'a')] : /a$/.test(f) ? [] : []);

  // ───────── Motor ─────────
  function crearMotor(dic) {
    const raw = new Map(), nrm = new Map(), frases = []; const entradas = dic.entradas || [];
    const add = (map, key, entry, via) => { const a = map.get(key) || []; if (!a.some((x) => x.entry === entry)) a.push({ entry, via }); map.set(key, a); };
    for (const e of entradas) {
      const base = [e.lema, ...(e.formas || [])].map((f) => f.toLowerCase());
      const explicit = new Set(base);
      if (e.tipo === 'n' || e.tipo === 'a') base.slice().forEach((f) => { pluralizar(f).forEach((p) => explicit.add(p)); if (e.tipo === 'a') generos(f).forEach((g) => { explicit.add(g); pluralizar(g).forEach((p) => explicit.add(p)); }); });
      const verbales = e.tipo === 'v' ? conjugar(e.lema) : new Set();
      const todas = [...explicit].map((f) => [f, 'dic']).concat([...verbales].filter((f) => !explicit.has(f)).map((f) => [f, 'verbo']));
      for (const [f, via] of todas) {
        if (/\s/.test(f)) { frases.push({ tokens: tokenizar(f).map((t) => normalizar(t.raw)), entry: e, texto: f }); continue; }
        add(raw, f, e, via); if (!e.soloAcento) add(nrm, strip(f), e, via);
      }
    }
    frases.sort((a, b) => b.tokens.length - a.tokens.length);
    const lemaPorEntrada = new Map(entradas.map((e) => [e.lema, e]));
    const orden = (a, b) => (a.via === b.via ? 0 : a.via === 'dic' ? -1 : 1);

    function buscar(tokenRaw, ctx) {
      const low = tokenRaw.toLowerCase(); let hits = (raw.get(low) || []).slice();
      if (!hits.length) hits = (nrm.get(strip(low)) || []).slice();
      if (!tieneAcento(low)) hits = hits.filter((h) => !(h.entry.interrogativo && !ctx.pregunta));
      hits.sort(orden);
      if (hits.length > 1 && hits[0].via === hits[1].via) { /* varias entradas igual de probables: se avisa */ }
      return hits;
    }
    function buscarConClitico(tokenRaw, ctx) {
      const low = tokenRaw.toLowerCase();
      for (const c of CLITICOS) {
        if (low.length > c.length + 2 && low.endsWith(c)) {
          const rest = low.slice(0, -c.length); const restN = strip(rest);
          if (/(ar|er|ir|ndo)$/.test(restN) || /[aeiou]$/.test(restN)) { const h = (raw.get(rest) || nrm.get(restN) || []).filter((x) => x.entry.tipo === 'v'); if (h.length) return { hits: h, clitico: c }; }
          const rest2 = rest.slice(0, -2); const c2 = CLITICOS.find((k) => rest.endsWith(k));
          if (c2) { const h = (raw.get(rest.slice(0, -c2.length)) || nrm.get(strip(rest.slice(0, -c2.length))) || []).filter((x) => x.entry.tipo === 'v'); if (h.length) return { hits: h, clitico: c2 + c }; }
        }
      }
      return null;
    }

    /** analizar(texto) → { tokens, pregunta } ; cada token: ver documentación del encabezado */
    function analizar(texto) {
      const toks = tokenizar(texto); const pregunta = /[¿?]/.test(texto); const ctx = { pregunta };
      const res = []; let i = 0;
      const mixto = /[a-záéíóúñ]/.test(texto) && /[A-ZÁÉÍÓÚÑ]/.test(texto);
      while (i < toks.length) {
        // 1) frases de varias palabras ("por favor", "buenos días")
        let usada = false;
        for (const fr of frases) {
          const n = fr.tokens.length; if (i + n > toks.length) continue;
          if (fr.tokens.every((w, k) => normalizar(toks[i + k].raw) === w) && !(fr.entry.interrogativo && !pregunta && !tieneAcento(texto.slice(toks[i].start, toks[i + n - 1].end)))) {
            res.push(ficha(texto, toks[i], toks[i + n - 1], fr.entry, 'dic', [], {})); i += n; usada = true; break;
          }
        }
        if (usada) continue;
        const t = toks[i]; const n = normalizar(t.raw);
        if (/\d/.test(t.raw)) { res.push({ ...base(texto, t, t), estado: 'sin', rol: 'dato', aviso: 'Contiene números: se deja como texto y no se busca en ningún servicio.' }); i++; continue; }
        let hits = buscar(t.raw, ctx), clitico = null;
        if (!hits.length) { const c = buscarConClitico(t.raw, ctx); if (c) { hits = c.hits; clitico = c.clitico; } }
        if (hits.length) {
          const principal = hits[0], otras = hits.slice(1).filter((h) => h.entry !== principal.entry).map((h) => h.entry);
          const homografo = FUNC.has(n) && principal.via === 'verbo';
          res.push(ficha(texto, t, t, principal.entry, principal.via, otras, { homografo, clitico }));
        } else if (FUNC.has(n)) {
          res.push({ ...base(texto, t, t), estado: 'func', rol: 'func' });
        } else {
          const nombrePropio = mixto && /^[A-ZÁÉÍÓÚÑ]/.test(t.raw) && i > 0;
          res.push({ ...base(texto, t, t), estado: 'sin', rol: 'concepto', aviso: nombrePropio ? 'Parece un nombre propio: se deja como texto y no se busca en ningún servicio.' : undefined, nombrePropio, candidatosLema: candidatosLema(t.raw) });
        }
        i++;
      }
      // marcar palabras que no se deben buscar en línea tras «me llamo / mi nombre es / soy»
      for (let k = 0; k < res.length; k++) {
        const prev = res[k - 1]?.norm, prev2 = res[k - 2]?.norm;
        if (res[k].estado === 'sin' && (prev === 'llamo' || prev === 'soy' || (prev === 'es' && prev2 === 'nombre'))) { res[k].nombrePropio = true; res[k].aviso = 'Parece un nombre propio: se deja como texto y no se busca en ningún servicio.'; }
      }
      return { tokens: aplicarExpresiones(res, texto), pregunta };
    }
    function base(texto, a, b) { return { orig: texto.slice(a.start, b.end), norm: normalizar(a.raw), start: a.start, end: b.end }; }
    function ficha(texto, a, b, e, via, otras, opt) {
      const revisar = Boolean(e.aviso) || otras.length > 0 || opt.homografo;
      const avisos = [e.aviso, otras.length ? `También podría ser: ${otras.map((o) => '«' + o.lema + '»').join(', ')}.` : null, opt.homografo ? `La palabra «${texto.slice(a.start, a.end)}» también puede ser gramatical (no un verbo).` : null].filter(Boolean);
      return { ...base(texto, a, b), lema: e.lema, tipoPalabra: e.tipo, rol: e.rol === 'func' ? 'func' : 'concepto', estado: revisar ? 'revisar' : 'verificado', aviso: avisos.join(' ') || undefined,
        pic: { id: e.id, src: `assets/picto/${e.id}.png`, palabras: e.palabras, significado: e.significado || null, origen: 'local' }, alternativas: otras.map((o) => ({ lema: o.lema, id: o.id, src: `assets/picto/${o.id}.png`, palabras: o.palabras, significado: o.significado || null, origen: 'local' })) };
    }
    function aplicarExpresiones(tokens, texto) {
      const exps = dic.expresiones || []; const saltables = (t) => t.estado === 'func' || ['mi', 'tu', 'su'].includes(t.lema);
      for (const ex of exps) {
        for (let i = 0; i < tokens.length; i++) {
          if (!ex.lemas[0].includes(tokens[i].lema)) continue;
          let j = i + 1; while (j < tokens.length && saltables(tokens[j])) j++;
          if (j < tokens.length && ex.lemas[1].includes(tokens[j].lema)) {
            const nuevo = { orig: texto.slice(tokens[i].start, tokens[j].end), norm: tokens.slice(i, j + 1).map((t) => t.norm).join(' '), start: tokens[i].start, end: tokens[j].end, lema: ex.etiqueta, tipoPalabra: 'x', rol: 'concepto', estado: 'verificado', expresion: true,
              aviso: ex.aviso, pic: { id: ex.id, src: `assets/picto/${ex.id}.png`, palabras: ex.palabras, significado: ex.significado, origen: 'local' }, alternativas: [], partes: tokens.slice(i, j + 1) };
            tokens.splice(i, j - i + 1, nuevo);
          }
        }
      }
      return tokens;
    }
    return { analizar, buscar, entrada: (lema) => lemaPorEntrada.get(lema), tamano: entradas.length };
  }

  // ───────── Candidatos de lema para palabras desconocidas (se usan SOLO como términos de búsqueda, nunca como resultado) ─────────
  function candidatosLema(palabra) {
    const w = palabra.toLowerCase(); const out = [w]; const push = (x) => { if (x && x.length > 2 && !out.includes(x)) out.push(x); };
    if (/ces$/.test(w)) push(w.replace(/ces$/, 'z')); if (/es$/.test(w)) push(w.slice(0, -2)); if (/s$/.test(w)) push(w.slice(0, -1));
    const s = w.replace(/(aron|amos|aban|aba|ando|ado|ada|ó|é|as|an|a|o)$/, '');
    if (s !== w && s.length > 2) { push(s + 'ar'); }
    const s2 = w.replace(/(ieron|imos|ían|ía|iendo|ido|ida|ió|í|es|en|e)$/, '');
    if (s2 !== w && s2.length > 2) { push(s2 + 'er'); push(s2 + 'ir'); }
    if (/(a|o)$/.test(w)) { const m = w.replace(/a$/, 'o'); push(m); }
    return out.slice(0, 5);
  }

  return { normalizar, strip, tokenizar, conjugar, crearMotor, candidatosLema };
});
