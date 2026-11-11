/* CLARIA · Lectura de documentos en formato pictocuento (Etapa 2a). Todo ocurre en el navegador con el diccionario local:
   el texto NO se envía a ningún servicio. Cada oración se muestra completa y, debajo, sus conceptos con pictogramas ARASAAC. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const UI = () => window.ClariaUI || { announce() {}, showView() {}, getText: () => '' };
  const el = (tag, attrs = {}, ...hijos) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); } hijos.forEach((h) => h && e.append(h)); return e; };
  const PX = { s: 150, m: 200, l: 250, xl: 300 };
  const MAX_ORACIONES = 150;
  const ETIQUETA = { verificado: 'Verificado', revisar: 'Revisar', elegido: 'Elegido por vos' };
  const vista = $('view-cuento'), dlg = $('pqDialogo'), tts = 'speechSynthesis' in window;
  let motor = null, oraciones = [], pag = 0, hablando = false, pausado = false, modoTodo = false, abridor = null, tarjetaAbierta = null;
  let pref = { mayus: false, tam: 'm', vel: '0.9', por: 1 };
  try { pref = { ...pref, ...JSON.parse(localStorage.getItem('claria.pq') || '{}') }; } catch (_) {}
  const guardar = () => { try { localStorage.setItem('claria.pq', JSON.stringify(pref)); } catch (_) {} };
  const total = () => Math.max(1, Math.ceil(oraciones.length / pref.por));
  const enPagina = () => oraciones.slice(pag * pref.por, pag * pref.por + pref.por);

  async function cargarMotor() {
    if (motor) return motor; const d = await (await fetch('data/pictogramas.json')).json(); motor = ClariaPictos.crearMotor(d); return motor;
  }
  /** Divide en oraciones (punto, ?, !, saltos de línea); las muy largas se parten cada ~25 palabras. */
  function dividir(texto) {
    const partes = texto.replace(/\r/g, '').split(/\n+|(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean); const out = [];
    for (const p of partes) { const w = p.split(/\s+/); if (w.length <= 30) out.push(p); else for (let i = 0; i < w.length; i += 25) out.push(w.slice(i, i + 25).join(' ')); }
    return out;
  }

  async function abrir() {
    const t = (UI().getText && UI().getText()) || '';
    if (!t.trim()) { UI().announce('Primero cargá un texto en el lector.'); return; }
    UI().showView('cuento'); $('pqContenido').hidden = true; $('pqEstado').textContent = 'Preparando el pictocuento…'; detener(true);
    try { await cargarMotor(); } catch (_) { $('pqEstado').textContent = 'No se pudo cargar el diccionario de pictogramas.'; return; }
    let lista = dividir(t); const recortado = lista.length > MAX_ORACIONES; lista = lista.slice(0, MAX_ORACIONES);
    oraciones = lista.map((s) => ({ texto: s, fichas: motor.analizar(s).tokens.map((x) => ({ ...x })) })); pag = 0;
    const conPic = oraciones.reduce((n, o) => n + o.fichas.filter((f) => f.pic).length, 0), pal = oraciones.reduce((n, o) => n + o.fichas.filter((f) => f.estado !== 'func').length, 0);
    $('pqEstado').textContent = `${oraciones.length} oraciones · ${conPic} de ${pal} palabras con pictograma.` + (recortado ? ` Se muestran las primeras ${MAX_ORACIONES} oraciones.` : '');
    $('pqContenido').hidden = false; aplicarPref(); render(); $('pqPagina').focus();
  }

  function tarjeta(f, oi, fi, estatica) {
    const conPic = f.pic && ['verificado', 'revisar', 'elegido'].includes(f.estado);
    if (!conPic) { const li = el('li', { class: 'pc-card ' + (f.estado === 'func' ? 'func' : 'sin'), 'data-o': oi, 'data-i': fi, 'data-estado': f.estado }, el('span', { class: 'pc-label', text: f.orig })); return li; }
    const li = el('li', { class: 'pc-card', 'data-o': oi, 'data-i': fi, 'data-estado': f.estado });
    const im = el('img', { class: 'pc-img', src: f.pic.src, alt: '', loading: 'lazy' }); im.addEventListener('error', () => im.replaceWith(el('span', { class: 'pc-noimg', text: 'sin imagen' })));
    const partes = [im, el('span', { class: 'pc-label', text: f.orig })]; if (f.estado !== 'verificado') partes.push(el('span', { class: `pc-badge b-${f.estado}`, text: ETIQUETA[f.estado] }));
    if (estatica) { li.append(...partes); return li; }
    const b = el('button', { type: 'button', class: 'pc-card-btn', 'aria-haspopup': 'dialog', 'aria-label': `${f.orig}${f.estado === 'revisar' ? ', para revisar' : ''}. Ver significado y escuchar` }); b.append(...partes);
    b.addEventListener('click', () => abrirPicto(oi, fi, b)); li.append(b); return li;
  }
  function oracionConSpans(o, oi) {
    const p = el('p', { class: 'pq-oracion', lang: 'es' }); let pos = 0;
    o.fichas.forEach((f, i) => { if (f.start > pos) p.append(o.texto.slice(pos, f.start)); p.append(el('span', { class: 'pw', 'data-o': oi, 'data-i': i, text: o.texto.slice(f.start, f.end) })); pos = f.end; });
    if (pos < o.texto.length) p.append(o.texto.slice(pos)); return p;
  }
  function render() {
    const cont = $('pqPagina'); cont.textContent = '';
    enPagina().forEach((o, k) => { const oi = pag * pref.por + k; const li = el('li', { class: 'pq-bloque' }); li.append(oracionConSpans(o, oi)); const tab = el('ol', { class: 'pc-board', 'aria-label': 'Pictogramas de la oración' }); o.fichas.forEach((f, i) => tab.append(tarjeta(f, oi, i))); li.append(tab); cont.append(li); });
    $('pqContador').textContent = `Página ${pag + 1} de ${total()}`; $('pqProgreso').style.width = `${((pag + 1) / total()) * 100}%`;
    $('pqAnterior').disabled = pag === 0; $('pqSiguiente').disabled = pag >= total() - 1; botonesVoz();
  }
  function ir(n, foco = true) { const nuevo = Math.max(0, Math.min(total() - 1, n)); if (nuevo === pag) return; if (!modoTodo) detener(true); pag = nuevo; render(); UI().announce(`Página ${pag + 1} de ${total()}`); if (foco) $('pqPagina').focus(); }
  $('pqAnterior').addEventListener('click', () => ir(pag - 1)); $('pqSiguiente').addEventListener('click', () => ir(pag + 1));
  vista.addEventListener('keydown', (e) => { if (dlg.open || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.ctrlKey || e.altKey || e.metaKey) return; if (e.key === 'ArrowRight') { e.preventDefault(); ir(pag + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(pag - 1); } });
  $('pqVolver').addEventListener('click', () => { detener(true); UI().showView('lectura'); });
  $('abrirCuento').addEventListener('click', abrir);

  // ───────── Tocar un pictograma: significado + audio + otras opciones locales ─────────
  function abrirPicto(oi, fi, boton) {
    tarjetaAbierta = { oi, fi }; abridor = boton; const f = oraciones[oi].fichas[fi];
    $('pqDialogoTitulo').textContent = f.orig;
    const im = $('pqDialogoImg'); im.textContent = ''; im.append(el('img', { src: f.pic.src, alt: '' }), el('span', {}, el('strong', { text: `Pictograma de «${f.pic.palabras || f.lema}»` })));
    $('pqDialogoSig').textContent = f.pic.significado || 'Este pictograma representa la palabra del diccionario de CLARIA.';
    $('pqDialogoAviso').textContent = f.aviso || '';
    const alt = $('pqDialogoAlt'); alt.textContent = '';
    (f.alternativas || []).forEach((a) => { const b = el('button', { type: 'button', class: 'pc-opt', 'aria-label': `Usar pictograma de «${a.palabras || a.lema}»` }, el('img', { src: a.src, alt: '' }), el('small', { text: a.palabras || a.lema })); b.addEventListener('click', () => { f.pic = a; f.estado = 'elegido'; render(); dlg.close(); UI().announce(`Pictograma cambiado para «${f.orig}».`); }); alt.append(b); });
    dlg.showModal(); $('pqDialogoTitulo').setAttribute('tabindex', '-1'); $('pqDialogoTitulo').focus();
  }
  dlg.addEventListener('close', () => { const t = tarjetaAbierta; tarjetaAbierta = null; const b = t && $('pqPagina').querySelector(`li[data-o="${t.oi}"][data-i="${t.fi}"] button`); (b || abridor)?.focus(); });
  $('pqCerrar').addEventListener('click', () => dlg.close());
  $('pqEscucharPal').addEventListener('click', () => { if (!tts || !tarjetaAbierta) return; speechSynthesis.cancel(); const f = oraciones[tarjetaAbierta.oi].fichas[tarjetaAbierta.fi]; const t = [f.orig, f.pic?.significado].filter(Boolean).join('. '); speechSynthesis.speak(crearVoz(t)); });

  // ───────── Voz por partes ─────────
  function crearVoz(t) { const u = new SpeechSynthesisUtterance(t); u.lang = 'es-AR'; u.rate = Number(pref.vel) || .9; const v = speechSynthesis.getVoices(); const es = v.find((x) => x.lang === 'es-AR') || v.find((x) => x.lang?.startsWith('es')); if (es) u.voice = es; return u; }
  function marcar(oi, fi) { vista.querySelectorAll('.hl').forEach((n) => n.classList.remove('hl')); if (oi >= 0) vista.querySelectorAll(`[data-o="${oi}"][data-i="${fi}"]`).forEach((n) => n.classList.add('hl')); }
  function botonesVoz() {
    $('pqPausar').disabled = !hablando; $('pqDetener').disabled = !hablando && !modoTodo; $('pqRepetir').disabled = !tts || !oraciones.length;
    $('pqPausar').setAttribute('aria-pressed', String(pausado)); $('pqPausar').textContent = pausado ? '▶ Seguir' : '⏸ Pausar';
    $('pqTodo').setAttribute('aria-pressed', String(modoTodo)); $('pqTodo').textContent = modoTodo ? '▶▶ Leyendo todo…' : '▶▶ Leer todo';
  }
  function escuchar() {
    if (!tts || !oraciones.length) return; speechSynthesis.cancel(); pausado = false;
    const base = []; let texto = ''; enPagina().forEach((o, k) => { base.push({ oi: pag * pref.por + k, ini: texto.length, o }); texto += (texto ? ' ' : '') + o.texto; });
    const u = crearVoz(texto);
    u.onstart = () => { hablando = true; botonesVoz(); };
    u.onboundary = (e) => { if (e.name && e.name !== 'word') return; const b = [...base].reverse().find((x) => e.charIndex >= x.ini); if (!b) return; const loc = e.charIndex - b.ini; const fi = b.o.fichas.findIndex((f) => loc >= f.start && loc < f.end); marcar(fi < 0 ? -1 : b.oi, fi); };
    u.onend = u.onerror = () => {
      hablando = false; pausado = false; marcar(-1, -1);
      if (modoTodo && pag < total() - 1) { pag++; render(); UI().announce(`Página ${pag + 1} de ${total()}`); setTimeout(() => { if (modoTodo) escuchar(); }, 450); }
      else { modoTodo = false; botonesVoz(); }
    };
    hablando = true; botonesVoz(); speechSynthesis.speak(u);
  }
  function detener(silencio) { modoTodo = false; if (tts) speechSynthesis.cancel(); hablando = false; pausado = false; marcar(-1, -1); botonesVoz(); if (!silencio) UI().announce('Lectura detenida'); }
  $('pqEscuchar').addEventListener('click', () => { modoTodo = false; escuchar(); });
  $('pqRepetir').addEventListener('click', () => { modoTodo = false; escuchar(); });
  $('pqTodo').addEventListener('click', () => { if (modoTodo) { detener(); return; } modoTodo = true; escuchar(); });
  $('pqDetener').addEventListener('click', () => detener());
  $('pqPausar').addEventListener('click', () => { if (!hablando) return; if (pausado) speechSynthesis.resume(); else speechSynthesis.pause(); pausado = !pausado; botonesVoz(); });
  if (!tts) { ['pqEscuchar', 'pqTodo', 'pqPausar', 'pqRepetir', 'pqDetener', 'pqVelocidad'].forEach((id) => { $(id).disabled = true; }); const n = $('pqVozNota'); n.hidden = false; n.textContent = 'Este navegador no ofrece lectura en voz alta. Podés leer, avanzar, imprimir y descargar igual.'; }

  // ───────── Preferencias ─────────
  function aplicarPref() {
    vista.classList.toggle('pc-upper', pref.mayus); vista.dataset.size = pref.tam; $('pqLetra').setAttribute('aria-pressed', String(pref.mayus)); $('pqLetra').textContent = pref.mayus ? 'Letra: MAYÚSCULA' : 'Letra: habitual';
    $('pqTamano').value = pref.tam; $('pqVelocidad').value = pref.vel; $('pqPorPagina').value = String(pref.por);
  }
  $('pqLetra').addEventListener('click', () => { pref.mayus = !pref.mayus; guardar(); aplicarPref(); });
  $('pqTamano').addEventListener('change', (e) => { pref.tam = e.target.value; guardar(); aplicarPref(); });
  $('pqVelocidad').addEventListener('change', (e) => { pref.vel = e.target.value; guardar(); });
  $('pqPorPagina').addEventListener('change', (e) => { const primera = pag * pref.por; pref.por = Number(e.target.value); guardar(); detener(true); pag = Math.min(total() - 1, Math.floor(primera / pref.por)); render(); });

  // ───────── Versión imprimible y PDF (todas las oraciones) ─────────
  function imprimir() {
    let area = $('pcPrintArea'); if (area) area.remove();
    area = el('div', { id: 'pcPrintArea', class: pref.mayus ? 'pc-upper' : '' }); area.dataset.size = pref.tam; area.style.setProperty('--pc-size', { s: '96px', m: '130px', l: '170px', xl: '220px' }[pref.tam]);
    area.append(el('h1', { text: 'CLARIA · Texto con pictogramas' }));
    oraciones.forEach((o, oi) => { const b = el('div', { class: 'pq-print-bloque' }, el('p', { class: 'pc-original-text', text: o.texto })); const t = el('ol', { class: 'pc-board' }); o.fichas.forEach((f, i) => t.append(tarjeta(f, oi, i, true))); b.append(t); area.append(b); });
    area.append(el('p', { class: 'pc-credit', text: ClariaExport.CREDITO.join(' ') })); document.body.append(area); window.print(); setTimeout(() => area.remove(), 500);
  }
  $('pqImprimir').addEventListener('click', imprimir);
  $('pqPdf').addEventListener('click', async () => {
    const b = $('pqPdf'); b.disabled = true; UI().announce('Preparando el PDF…');
    try {
      const bloques = oraciones.map((o) => ({ texto: o.texto, fichas: o.fichas.map((f) => ({ orig: f.orig, estado: f.estado, pic: f.pic && ['verificado', 'revisar', 'elegido'].includes(f.estado) ? f.pic : null })) }));
      const pags = await ClariaExport.dibujarPaginas({ titulo: 'CLARIA · Pictocuento', mayus: pref.mayus, tamano: PX[pref.tam] - 40, bloques });
      ClariaExport.descargar(ClariaExport.aPDF(pags), 'claria-pictocuento.pdf'); UI().announce(`PDF listo: ${pags.length} página${pags.length === 1 ? '' : 's'}.`);
    } catch (_) { UI().announce('No se pudo preparar el PDF. Probá Imprimir.'); } finally { b.disabled = false; }
  });
  window.ClariaCuento = { dividir };
})();
