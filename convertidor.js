/* CLARIA · Interfaz del convertidor de texto a pictogramas (Etapa 1). Usa pictos.js (motor) y exportar.js. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const UI = () => window.ClariaUI || { announce() {}, showView() {} };
  const EJEMPLOS = ['HOLA', 'QUIERO AGUA', 'NECESITO SACAR UN TURNO PARA MI DNI', 'LA ESCUELA ES PARA TODOS',
    'Estimadas familias: el lunes hay reunión en la escuela. Deben traer el DNI del alumno y firmar la autorización.'];
  const PX = { s: 150, m: 200, l: 250, xl: 300 };
  const API = 'https://api.arasaac.org/v1/pictograms/es/search/';
  const IMG = (id) => `https://static.arasaac.org/pictograms/${id}/${id}_300.png`;
  let motor = null, fichas = [], texto = '', mayus = false, hablando = false, pausado = false, abierta = -1, abridor = null;
  const vista = $('view-escribir');
  const norm = (s) => ClariaPictos.normalizar(s);
  const el = (tag, attrs = {}, ...hijos) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); } hijos.forEach((h) => h && e.append(h)); return e; };
  const ETIQUETA = { verificado: 'Verificado', revisar: 'Revisar', elegido: 'Elegido por vos', sin: 'Sin pictograma', texto: 'Solo texto' };

  // ───────── Preferencias propias de este módulo ─────────
  let pref = { mayus: false, tam: 'm', vel: '0.9' };
  try { pref = { ...pref, ...JSON.parse(localStorage.getItem('claria.pc') || '{}') }; } catch (_) {}
  const guardar = () => { try { localStorage.setItem('claria.pc', JSON.stringify(pref)); } catch (_) {} };
  function aplicarPref() {
    mayus = pref.mayus; vista.classList.toggle('pc-upper', mayus); vista.dataset.size = pref.tam;
    $('pcLetra').setAttribute('aria-pressed', String(mayus)); $('pcLetra').textContent = mayus ? 'Letra: MAYÚSCULA' : 'Letra: habitual';
    $('pcTamano').value = pref.tam; $('pcVelocidad').value = pref.vel;
  }

  // ───────── Diccionario local ─────────
  const lista = $('pcEjemplosLista');
  EJEMPLOS.forEach((t) => { const b = el('button', { type: 'button', text: t.length > 40 ? t.slice(0, 38) + '…' : t, title: t }); b.addEventListener('click', () => { $('pcTexto').value = t; convertir(); }); lista.append(b); });
  $('pcConvertir').disabled = true;
  fetch('data/pictogramas.json').then((r) => r.json()).then((d) => { motor = ClariaPictos.crearMotor(d); $('pcConvertir').disabled = false; })
    .catch(() => { $('pcResumen').textContent = 'No se pudo cargar el diccionario de pictogramas.'; $('pcResultado').hidden = false; });

  // ───────── Conversión y dibujo ─────────
  function convertir() {
    detener(true);
    const t = $('pcTexto').value.replace(/\s+/g, ' ').trim();
    if (!t) { UI().announce('Escribí una palabra o una frase para convertir.'); $('pcTexto').focus(); return; }
    if (t.split(' ').length > 120) { UI().announce('El texto tiene más de 120 palabras. Dividilo en partes más cortas.'); return; }
    if (!motor) return;
    texto = t; const r = motor.analizar(t);
    fichas = r.tokens.map((x) => ({ ...x, original: x.pic ? { pic: x.pic, estado: x.estado } : { pic: null, estado: x.estado } }));
    $('pcResultado').hidden = false; dibujar();
    const n = fichas.filter((f) => f.rol !== 'func').length;
    UI().announce(`Listo: ${n} palabra${n === 1 ? '' : 's'} para revisar. ${$('pcResumen').textContent}`);
    $('pcResultado').scrollIntoView({ block: 'start', behavior: document.body.classList.contains('no-motion') ? 'auto' : 'smooth' });
  }
  function dibujarOriginal(cont) {
    cont.textContent = ''; let pos = 0;
    fichas.forEach((f, i) => { if (f.start > pos) cont.append(texto.slice(pos, f.start)); cont.append(el('span', { class: 'pw', 'data-i': i, text: texto.slice(f.start, f.end) })); pos = f.end; });
    if (pos < texto.length) cont.append(texto.slice(pos));
  }
  function tarjeta(f, i, estatica) {
    const li = el('li', { class: 'pc-card' + (f.estado === 'func' ? ' func' : ''), 'data-i': i, 'data-estado': f.estado });
    const mostrarImg = f.pic && !['sin', 'texto', 'func'].includes(f.estado);
    const contenido = [];
    if (f.estado === 'func') contenido.push(el('span', { class: 'pc-label', text: f.orig }));
    else {
      if (mostrarImg) { const im = el('img', { class: 'pc-img', src: f.pic.src, alt: '', loading: 'lazy', crossorigin: 'anonymous' }); im.addEventListener('error', () => im.replaceWith(el('span', { class: 'pc-noimg', text: 'sin imagen' }))); contenido.push(im); }
      else contenido.push(el('span', { class: 'pc-noimg', text: f.estado === 'texto' ? 'solo texto' : 'sin pictograma' }));
      contenido.push(el('span', { class: 'pc-label', text: f.orig }), el('span', { class: `pc-badge b-${f.estado}`, text: ETIQUETA[f.estado] }));
    }
    if (f.estado === 'func' || estatica) { li.append(...contenido); return li; }
    const b = el('button', { type: 'button', class: 'pc-card-btn', 'aria-haspopup': 'dialog', 'aria-label': `${f.orig}. ${ETIQUETA[f.estado]}${f.pic && mostrarImg ? ', pictograma de «' + (f.pic.palabras || f.lema || f.orig) + '»' : ''}. Abrir para elegir otro pictograma` });
    b.append(...contenido); b.addEventListener('click', () => abrir(i, b)); li.append(b); return li;
  }
  function dibujar() {
    dibujarOriginal($('pcOriginal'));
    const tab = $('pcTablero'); tab.textContent = ''; fichas.forEach((f, i) => tab.append(tarjeta(f, i)));
    const c = (e) => fichas.filter((f) => f.estado === e).length;
    $('pcResumen').textContent = `${fichas.filter((f) => f.estado !== 'func').length} palabras: ${c('verificado')} verificadas, ${c('revisar')} para revisar, ${c('elegido')} elegidas por vos, ${c('sin') + c('texto')} solo con texto.`;
  }

  // ───────── Elegir otro pictograma ─────────
  const dlg = $('pcDialogo');
  const opcion = (pic, activo, rotulo) => { const b = el('button', { type: 'button', class: 'pc-opt', 'aria-pressed': String(Boolean(activo)), 'aria-label': `Usar pictograma de «${rotulo}»` }, el('img', { src: pic.src, alt: '', crossorigin: 'anonymous' }), el('small', { text: rotulo })); return b; };
  function abrir(i, boton) {
    abierta = i; abridor = boton; const f = fichas[i];
    $('pcDialogoTitulo').textContent = `Elegir pictograma para «${f.orig}»`;
    $('pcDialogoInfo').textContent = [f.aviso, f.pic?.significado].filter(Boolean).join(' ') || 'Elegí la imagen que mejor represente lo que querés decir.';
    const act = $('pcDialogoActual'); act.textContent = '';
    if (f.pic && !['sin', 'texto'].includes(f.estado)) act.append(el('img', { src: f.pic.src, alt: '', crossorigin: 'anonymous' }), el('span', {}, el('strong', { text: 'Ahora: ' }), `pictograma de «${f.pic.palabras || f.lema}» (${ETIQUETA[f.estado].toLowerCase()})`));
    else act.append(el('span', { text: 'Ahora esta palabra queda solo con texto.' }));
    const alt = $('pcDialogoAlt'); alt.textContent = '';
    (f.alternativas || []).forEach((a) => { const b = opcion(a, false, a.palabras || a.lema); b.addEventListener('click', () => asignar(i, a, 'elegido')); alt.append(b); });
    if (!(f.alternativas || []).length) alt.append(el('span', { class: 'pc-note', text: 'No hay otras opciones guardadas en el diccionario local para esta palabra.' }));
    const bloqueada = f.nombrePropio || f.rol === 'dato';
    $('pcBuscarTermino').value = bloqueada ? '' : (f.lema && f.tipoPalabra !== 'x' ? f.lema : (f.candidatosLema?.[0] || norm(f.orig)));
    $('pcBuscarTermino').disabled = bloqueada; $('pcBuscar').disabled = bloqueada;
    $('pcBuscarAviso').textContent = bloqueada ? 'Los nombres propios y los números no se buscan en ningún servicio: quedan como texto.' : 'Si querés, podés buscar en ARASAAC. Se envía únicamente la palabra que ves acá (nunca el resto del texto) y vos elegís el resultado.';
    $('pcBuscarEstado').textContent = ''; $('pcBuscarRes').textContent = '';
    $('pcRestaurar').disabled = !f.original || (f.original.pic === f.pic && f.original.estado === f.estado);
    dlg.showModal(); $('pcDialogoTitulo').setAttribute('tabindex', '-1'); $('pcDialogoTitulo').focus();
  }
  dlg.addEventListener('close', () => { const i = abierta; abierta = -1; const b = $('pcTablero').querySelector(`[data-i="${i}"] button`); (b || abridor)?.focus(); });
  $('pcCerrar').addEventListener('click', () => dlg.close());
  function asignar(i, pic, estado) {
    const f = fichas[i]; f.pic = pic; f.estado = estado; if (estado === 'texto') f.pic = null; dibujar(); dlg.close();
    UI().announce(estado === 'texto' ? `«${f.orig}» queda solo con texto.` : `Pictograma elegido para «${f.orig}».`);
  }
  $('pcSoloTexto').addEventListener('click', () => asignar(abierta, null, 'texto'));
  $('pcRestaurar').addEventListener('click', () => { const f = fichas[abierta]; asignar(abierta, f.original.pic, f.original.estado); });
  $('pcEscucharPal').addEventListener('click', () => hablarTexto(fichas[abierta].orig));

  $('pcBuscar').addEventListener('click', async () => {
    const termino = $('pcBuscarTermino').value.trim(); const est = $('pcBuscarEstado'), res = $('pcBuscarRes'); res.textContent = '';
    if (!/^[\p{L}][\p{L} ]{0,28}$/u.test(termino) || termino.split(' ').length > 3) { est.textContent = 'Escribí una palabra (solo letras, hasta 3 palabras) para buscar.'; return; }
    est.textContent = `Buscando «${termino}» en ARASAAC…`; $('pcBuscar').disabled = true;
    try {
      const r = await fetch(API + encodeURIComponent(termino.toLowerCase()), { headers: { Accept: 'application/json' } });
      if (r.status === 404) { est.textContent = `ARASAAC no tiene resultados para «${termino}». Probá con otra palabra o dejala como texto.`; return; }
      if (!r.ok) throw new Error(r.status);
      const datos = await r.json(); const t = norm(termino); const vistos = new Set(); const ok = [];
      for (const p of datos) {
        const kw = (p.keywords || []).find((k) => norm(k.keyword || '') === t); // solo coincidencia exacta de palabra clave
        if (!kw || vistos.has(p._id) || p.violence || p.sex) continue; vistos.add(p._id); ok.push({ p, kw });
      }
      if (!ok.length) { est.textContent = `Hubo resultados, pero ninguno coincide exactamente con «${termino}»; no se muestran para evitar errores.`; return; }
      est.textContent = `${ok.length} resultado${ok.length === 1 ? '' : 's'} para «${termino}». Elegí el que corresponda.`;
      ok.slice(0, 12).forEach(({ p, kw }) => { const pic = { id: p._id, src: IMG(p._id), palabras: kw.keyword, significado: kw.meaning || null, origen: 'arasaac' }; const b = opcion(pic, false, kw.keyword); b.title = kw.meaning || ''; b.addEventListener('click', () => asignar(abierta, pic, 'elegido')); res.append(b); });
    } catch (_) { est.textContent = 'No pude conectar con ARASAAC. Podés dejar la palabra como texto o intentar más tarde.'; }
    finally { $('pcBuscar').disabled = false; }
  });

  // ───────── Voz: escuchar, pausar, repetir, detener ─────────
  const tts = 'speechSynthesis' in window;
  function marcar(i) { vista.querySelectorAll('.hl').forEach((n) => n.classList.remove('hl')); if (i >= 0) vista.querySelectorAll(`[data-i="${i}"]`).forEach((n) => n.classList.add('hl')); }
  function botonesVoz() { window.ClariaGuia?.estado(hablando && !pausado ? 'hablando' : 'esperando');
    $('pcPausar').disabled = !hablando; $('pcRepetir').disabled = !tts || !texto; $('pcDetener').disabled = !hablando; $('pcPausar').setAttribute('aria-pressed', String(pausado)); $('pcPausar').textContent = pausado ? '▶ Seguir' : '⏸ Pausar'; }
  function crearVoz(t) { const u = new SpeechSynthesisUtterance(t); u.lang = 'es-AR'; u.rate = Number(pref.vel) || .9; const v = speechSynthesis.getVoices(); const es = v.find((x) => x.lang === 'es-AR') || v.find((x) => x.lang?.startsWith('es')); if (es) u.voice = es; return u; }
  function hablarTexto(t) { if (!tts) return; speechSynthesis.cancel(); const u = crearVoz(t); speechSynthesis.speak(u); }
  function escuchar() {
    if (!tts || !texto) return; speechSynthesis.cancel(); const u = crearVoz(texto); pausado = false;
    u.onstart = () => { hablando = true; botonesVoz(); };
    u.onboundary = (e) => { if (e.name && e.name !== 'word') return; const i = fichas.findIndex((f) => e.charIndex >= f.start && e.charIndex < f.end); marcar(i); };
    u.onend = u.onerror = () => { hablando = false; pausado = false; marcar(-1); botonesVoz(); };
    hablando = true; botonesVoz(); speechSynthesis.speak(u);
  }
  function detener(silencio) { if (tts) speechSynthesis.cancel(); hablando = false; pausado = false; marcar(-1); botonesVoz(); if (!silencio) UI().announce('Lectura detenida'); }
  $('pcEscuchar').addEventListener('click', escuchar); $('pcRepetir').addEventListener('click', escuchar); $('pcDetener').addEventListener('click', () => detener());
  $('pcPausar').addEventListener('click', () => { if (!hablando) return; if (pausado) speechSynthesis.resume(); else speechSynthesis.pause(); pausado = !pausado; botonesVoz(); });
  $('pcVelocidad').addEventListener('change', (e) => { pref.vel = e.target.value; guardar(); });
  if (!tts) { ['pcEscuchar', 'pcPausar', 'pcRepetir', 'pcDetener', 'pcVelocidad'].forEach((id) => { $(id).disabled = true; }); const n = $('pcVozNota'); n.hidden = false; n.textContent = 'Este navegador no ofrece lectura en voz alta. Todo lo demás (ver, editar, imprimir, descargar) funciona igual.'; }

  // ───────── Formato, edición, impresión y descargas ─────────
  $('pcLetra').addEventListener('click', () => { pref.mayus = !pref.mayus; guardar(); aplicarPref(); UI().announce(pref.mayus ? 'Letra en mayúscula de imprenta' : 'Letra habitual'); });
  $('pcTamano').addEventListener('change', (e) => { pref.tam = e.target.value; guardar(); aplicarPref(); });
  $('pcEditar').addEventListener('click', () => { detener(true); $('pcTexto').focus(); $('pcTexto').select(); $('pcTexto').scrollIntoView({ block: 'center' }); UI().announce('Editá el texto y volvé a convertir.'); });
  $('pcConvertir').addEventListener('click', convertir);
  $('pcTexto').addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); convertir(); } });

  function imprimir() {
    let area = $('pcPrintArea'); if (area) area.remove();
    area = el('div', { id: 'pcPrintArea', class: mayus ? 'pc-upper' : '' }); area.dataset.size = pref.tam; area.style.setProperty('--pc-size', pref.tam === 's' ? '96px' : pref.tam === 'l' ? '170px' : pref.tam === 'xl' ? '220px' : '130px');
    const ori = el('p', { class: 'pc-original-text', text: texto });
    const tab = el('ol', { class: 'pc-board' }); fichas.forEach((f, i) => tab.append(tarjeta(f, i, true)));
    area.append(el('h1', { text: 'CLARIA · Texto con pictogramas' }), ori, tab, el('p', { class: 'pc-credit', text: ClariaExport.CREDITO.join(' ') }));
    document.body.append(area); window.print(); setTimeout(() => area.remove(), 500);
  }
  $('pcImprimir').addEventListener('click', imprimir);
  async function exportar(tipo) {
    const b = $(tipo === 'png' ? 'pcPng' : 'pcPdf'); b.disabled = true; UI().announce('Preparando la descarga…');
    try {
      const paginas = await ClariaExport.dibujarPaginas({ texto, mayus, tamano: PX[pref.tam], fichas: fichas.map((f) => ({ orig: f.orig, estado: f.estado, pic: ['sin', 'texto', 'func'].includes(f.estado) ? null : f.pic })) });
      const blob = tipo === 'png' ? await ClariaExport.aPNG(paginas) : ClariaExport.aPDF(paginas);
      ClariaExport.descargar(blob, `claria-pictogramas.${tipo}`); UI().announce(`Descarga lista: claria-pictogramas.${tipo}`);
    } catch (e) { UI().announce('No se pudo preparar el archivo. Probá de nuevo o usá Imprimir.'); }
    finally { b.disabled = false; }
  }
  $('pcPng').addEventListener('click', () => exportar('png')); $('pcPdf').addEventListener('click', () => exportar('pdf'));
  aplicarPref(); botonesVoz();
  window.ClariaConvertidor = { convertir, get fichas() { return fichas; } };
})();
