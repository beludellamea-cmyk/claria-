/* CLARIA · Creador de guías de trámite con pictogramas (etapa 4, vista para instituciones).
   - Parte de un texto APORTADO por el organismo (no lo genera la IA). Cada paso se edita a mano.
   - Reglas de la guía oficial argentina que se reflejan: título y pasos en MAYÚSCULAS, una acción por paso, pasos numerados,
     verbo en imperativo (voseo), pictograma para cada concepto. Las avisos son orientativos: la revisión es humana.
   - Un pictograma dudoso (estado «revisar»), faltante o dejado «solo texto» deja la pieza PENDIENTE. Nunca se acepta solo.
   - El PDF «final» solo se habilita con todo resuelto, fuente, fecha, responsable y la casilla de revisión humana. Si no, solo un BORRADOR marcado.
   - CLARIA es independiente: la guía no es oficial ni «conforme». No se piden claves, DNI ni datos personales. Nada se envía a un servidor. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const G = () => window.ClariaGuia;
  const el = (t, a = {}, k = []) => { const n = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'text') n.textContent = v; else n.setAttribute(x, v); } [].concat(k).forEach((c) => c && n.append(c)); return n; };
  const MAYUS = (s) => String(s).trim().replace(/\s+/g, ' ').toLocaleUpperCase('es');
  let motor = null, dic = null, listo = null, titulo = null, pasos = [], editando = null;
  let ultimo = ''; const estado = (t) => { const n = $('crEstado'); n.textContent = t === ultimo ? t + '​' : t; ultimo = n.textContent; };

  function cargar() {
    if (listo) return listo;
    listo = fetch('data/pictogramas.json').then((r) => r.json()).then((d) => { dic = d; motor = ClariaPictos.crearMotor(d); }).catch(() => { listo = null; estado('No se pudo cargar el diccionario de pictogramas.'); });
    return listo;
  }

  // ───────── pasos de pantalla ─────────
  const PASOS = { 1: ['crPaso1', 'crTitulo1', 'creador1'], 2: ['crPaso2', 'crTitulo2', 'creador2'] };
  function ir(n, silencioso) {
    Object.entries(PASOS).forEach(([k, [id]]) => { $(id).hidden = String(k) !== String(n); });
    if (!silencioso) G()?.setPantalla(PASOS[n][2]);
    const t = $(PASOS[n][1]); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); window.scrollTo({ top: 0 });
  }
  function entrar(conservar) { cargar(); if (!conservar) { ir(1, true); G()?.setPantalla('creador1'); } }
  function irA(n) { cargar().then(() => { if (n === 2 && !pasos.length) return ir(1); if (n === 2) pintar(); ir(n); }); }

  // ───────── armado de pasos a partir del texto del organismo ─────────
  const analizar = (texto) => motor.analizar(texto).tokens.map((f) => ({ ...f, confirmado: false }));
  const pieza = (texto) => { const t = MAYUS(texto); return { texto: t, fichas: analizar(t) }; };
  function partir(crudo) {
    const lineas = String(crudo).split(/\r?\n/).map((l) => l.replace(/^\s*(?:\d+\s*[.)\-:]|[-•*·])\s*/, '').trim()).filter(Boolean);
    const salida = []; lineas.forEach((l) => { const partes = l.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/).map((x) => x.trim()).filter(Boolean); salida.push(...partes); });
    return salida.map((x) => x.replace(/[.]+$/, '').trim()).filter(Boolean);
  }
  $('crArmar').addEventListener('click', async () => {
    await cargar(); const t = $('crTitulo').value.trim(), crudo = $('crTexto').value; const lista = partir(crudo).slice(0, 25);
    if (!t) return estado('Escribí el título del trámite.'); if (!lista.length) return estado('Pegá el texto del trámite que te dio el organismo.');
    titulo = pieza(t); pasos = lista.map(pieza); pintar(); ir(2); estado(`Se armaron ${pasos.length} pasos. Revisalos uno por uno.`);
  });

  // ───────── revisión ─────────
  const pendiente = (f) => f.rol === 'concepto' && !(f.estado === 'verificado' || f.estado === 'elegido' || f.confirmado);
  const pendientesDe = (p) => p.fichas.filter(pendiente).length;
  function avisos(p, esTitulo) {
    const a = []; const t = p.texto; const pal = t.split(/\s+/);
    if (!esTitulo) {
      if (!/^[A-ZÁÉÍÓÚÜÑ]+(Á|É|Í|ATE|ETE|ITE|ÍTE)(?=\s|$)/.test(pal[0]) ) a.push('Empezá con un verbo en imperativo, por ejemplo «INGRESÁ», «ELEGÍ», «COMPLETÁ».');
      if (/[;]|\s(Y|E|O|U)\s/.test(t) || /[.]\s/.test(t)) a.push('Puede tener más de una acción. Una sola acción por paso: dividilo si hace falta.');
      if (pal.length > 12) a.push('Es largo: cuanto más corto, mejor.');
      if (/(LO|LA|LOS|LAS|LE)$/.test(pal[pal.length - 1]) && pal.length <= 3) a.push('Evitá «IMPRIMILO»: nombrá el objeto, por ejemplo «IMPRIMÍ EL FORMULARIO».');
    }
    return a;
  }
  const total = () => [titulo, ...pasos].reduce((n, p) => n + pendientesDe(p), 0);
  function tarjetaFicha(p, i) {
    const f = p.fichas[i]; const pen = pendiente(f); const txt = f.rol === 'func' ? 'texto' : f.estado === 'verificado' || f.estado === 'elegido' || f.confirmado ? 'listo' : f.estado === 'revisar' ? 'revisar' : f.estado === 'texto' ? 'solo texto' : 'sin pictograma';
    const li = el('li', { class: 'cr-ficha' + (pen ? ' cr-pend' : '') });
    if (f.pic && f.estado !== 'texto') li.append(el('img', { src: f.pic.src, alt: '' })); else if (f.rol === 'concepto') li.append(el('span', { class: 'cr-nada', 'aria-hidden': 'true', text: '?' }));
    li.append(el('span', { class: 'cr-pal', text: f.orig }));
    if (f.rol === 'concepto') {
      li.append(el('span', { class: 'cr-badge', text: txt }));
      const b = el('button', { type: 'button', class: 'cr-mini', text: pen && f.estado === 'revisar' && f.pic ? 'Revisar' : 'Cambiar', 'aria-label': `${pen && f.estado === 'revisar' && f.pic ? 'Revisar' : 'Cambiar'} pictograma de ${f.orig}` }); b.addEventListener('click', () => abrir(p, i, b)); li.append(b);
    }
    return li;
  }
  function filaPaso(p, n, esTitulo) {
    const sec = el('li', { class: 'cr-paso panel' }); const pend = pendientesDe(p);
    const cab = el('div', { class: 'cr-cab' }, [el('span', { class: 'cr-num', text: esTitulo ? 'TÍTULO' : `PASO ${n}` }), el('span', { class: 'cr-badge ' + (pend ? 'cr-b-pend' : 'cr-b-ok'), text: pend ? `${pend} pendiente${pend === 1 ? '' : 's'}` : 'Listo' })]);
    const idn = `crTxt${esTitulo ? 'T' : n}`; const lab = el('label', { for: idn, class: 'sr-only', text: esTitulo ? 'Título' : `Texto del paso ${n}` });
    const inp = el('input', { id: idn, type: 'text', class: 'cr-input', maxlength: '120', value: p.texto, autocomplete: 'off' });
    inp.addEventListener('change', () => { const np = pieza(inp.value || p.texto); p.texto = np.texto; p.fichas = np.fichas; pintar(); estado('Texto actualizado. Revisá los pictogramas del paso.'); });
    sec.append(cab, lab, inp);
    avisos(p, esTitulo).forEach((a) => sec.append(el('p', { class: 'cr-aviso', text: '⚠ ' + a })));
    const ul = el('ul', { class: 'cr-fichas', 'aria-label': 'Pictogramas' }); p.fichas.forEach((_, i) => ul.append(tarjetaFicha(p, i))); sec.append(ul);
    if (!esTitulo) {
      const k = pasos.indexOf(p); const bs = el('div', { class: 'tb-acc' }); const mk = (t, lab2, fn, dis) => { const b = el('button', { type: 'button', text: t, 'aria-label': `${lab2} paso ${n}` }); if (dis) b.disabled = true; b.addEventListener('click', fn); return b; };
      bs.append(mk('◀ Subir', 'Subir', () => { [pasos[k - 1], pasos[k]] = [pasos[k], pasos[k - 1]]; pintar(); }, k === 0), mk('Bajar ▶', 'Bajar', () => { [pasos[k + 1], pasos[k]] = [pasos[k], pasos[k + 1]]; pintar(); }, k === pasos.length - 1), mk('Quitar', 'Quitar', () => { pasos.splice(k, 1); pintar(); estado('Paso quitado.'); }, pasos.length <= 1)); sec.append(bs);
    }
    return sec;
  }
  function pintar() {
    const ol = $('crLista'); ol.replaceChildren(filaPaso(titulo, 0, true)); pasos.forEach((p, i) => ol.append(filaPaso(p, i + 1, false)));
    const n = total(); $('crResumen').textContent = n ? `Quedan ${n} pictograma${n === 1 ? '' : 's'} por resolver. Hasta resolverlos, solo se puede descargar un borrador.` : 'Todos los pictogramas están resueltos.';
    actualizarExport();
  }
  $('crMas').addEventListener('click', () => { pasos.push(pieza('COMPLETÁ ESTE PASO')); pintar(); estado('Se agregó un paso. Editá su texto.'); });

  // ───────── elegir pictograma (solo diccionario verificado o confirmar la propuesta) ─────────
  const norm = (s) => ClariaPictos.normalizar(s);
  function opciones(f, q) {
    q = norm(q.trim()); const vistos = new Set(); const out = [];
    const add = (e) => { if (e && !vistos.has(e.id)) { vistos.add(e.id); out.push(e); } };
    (f.alternativas || []).forEach(add);
    if (q) dic.entradas.filter((e) => [e.lema, ...(e.palabras || []), ...(e.formas || [])].some((x) => norm(x).includes(q))).slice(0, 18).forEach(add);
    return out;
  }
  function pintarOpc() {
    const { p, i } = editando; const f = p.fichas[i]; const c = $('crOpciones'); c.replaceChildren(); const ops = opciones(f, $('crBuscar').value);
    if (!ops.length) c.append(el('p', { class: 'pc-note', text: 'No hay pictogramas verificados para esa palabra. Probá con otra o dejá el paso pendiente.' }));
    ops.forEach((e) => { const b = el('button', { type: 'button', class: 'tb-palabra' }, [el('img', { src: `assets/picto/${e.id}.png`, alt: '' }), el('span', { text: e.lema })]); b.addEventListener('click', () => { f.pic = { id: e.id, src: `assets/picto/${e.id}.png`, origen: 'local' }; f.estado = 'elegido'; f.confirmado = true; $('crDialogo').close(); pintar(); estado(`Elegiste el pictograma «${e.lema}» para ${f.orig}.`); }); c.append(b); });
  }
  function abrir(p, i, boton) {
    editando = { p, i, boton }; const f = p.fichas[i]; $('crDialogoPal').textContent = f.orig; $('crBuscar').value = f.lema && f.tipoPalabra !== 'x' ? f.lema : '';
    const act = $('crDialogoActual'); act.replaceChildren();
    if (f.pic && f.estado !== 'texto') { act.append(el('img', { src: f.pic.src, alt: '', class: 'cr-act' }), el('span', { text: `Propuesta de CLARIA: ${f.lema || f.orig}. ${f.aviso || ''}`.trim() }));
      if (!pendiente(f)) act.append(el('span', { class: 'pc-note', text: ' Ya está resuelto.' })); else { const ok = el('button', { type: 'button', class: 'btn btn-primary', text: 'Sí, este pictograma corresponde' }); ok.addEventListener('click', () => { f.confirmado = true; f.estado = 'elegido'; $('crDialogo').close(); pintar(); estado(`Confirmaste el pictograma de ${f.orig}.`); }); act.append(ok); } }
    else act.append(el('span', { class: 'pc-note', text: 'Todavía no hay un pictograma para esta palabra.' }));
    pintarOpc(); $('crDialogo').showModal();
  }
  $('crBuscar').addEventListener('input', pintarOpc);
  $('crSoloTexto').addEventListener('click', () => { const f = editando.p.fichas[editando.i]; f.estado = 'texto'; f.confirmado = false; $('crDialogo').close(); pintar(); estado(`${f.orig} queda solo con texto y pendiente de pictograma.`); });
  $('crCerrarDlg').addEventListener('click', () => $('crDialogo').close());
  $('crDialogo').addEventListener('close', () => { editando && editando.boton && editando.boton.isConnected && editando.boton.focus(); });

  // ───────── exportar ─────────
  const meta = () => ({ organismo: $('crOrganismo').value.trim(), fuente: $('crFuente').value.trim(), fecha: $('crFecha').value, resp: $('crResp').value.trim() });
  function faltan() { const m = meta(); const f = []; if (!m.organismo) f.push('organismo'); if (!m.fuente) f.push('fuente'); if (!m.fecha) f.push('fecha de verificación'); if (!m.resp) f.push('responsable de la revisión'); return f; }
  function actualizarExport() {
    if (!titulo) return; const n = total(), f = faltan(), rev = $('crRevision').checked;
    $('crPdf').disabled = !(n === 0 && !f.length && rev); $('crBorrador').disabled = !pasos.length;
    $('crMotivo').textContent = n ? `No se puede descargar el PDF final: ${n} pictograma${n === 1 ? '' : 's'} sin resolver.` : f.length ? `Para el PDF final completá: ${f.join(', ')}.` : !rev ? 'Para el PDF final marcá que una persona revisó cada paso y pictograma.' : 'Listo para descargar el PDF final.';
  }
  ['crOrganismo', 'crFuente', 'crFecha', 'crResp'].forEach((id) => $(id).addEventListener('input', actualizarExport)); $('crRevision').addEventListener('change', actualizarExport);
  async function exportar(esBorrador) {
    const b = esBorrador ? $('crBorrador') : $('crPdf'); b.disabled = true; estado('Preparando el PDF…');
    try {
      const m = meta(); const fch = m.fecha ? m.fecha.split('-').reverse().join('/') : 'SIN FECHA';
      const aFichas = (p) => p.fichas.map((f) => ({ orig: f.orig, estado: f.rol === 'func' || f.rol === 'dato' ? 'func' : pendiente(f) || f.estado === 'texto' ? 'sin' : f.estado, pic: f.rol === 'concepto' && f.pic && !pendiente(f) && f.estado !== 'texto' ? f.pic : null }));
      const bloques = [];
      if (esBorrador) bloques.push({ texto: 'BORRADOR · PENDIENTE DE REVISIÓN · NO USAR NI DIFUNDIR', fichas: [] });
      bloques.push({ texto: titulo.texto, fichas: aFichas(titulo) }); pasos.forEach((p, i) => bloques.push({ texto: `${i + 1}. ${p.texto}`, fichas: aFichas(p) }));
      bloques.push({ texto: `FUENTE: ${m.fuente || '—'} (${m.organismo || '—'}). VERIFICADO EL ${fch}. REVISÓ: ${m.resp || '—'}.`, fichas: [] });
      bloques.push({ texto: 'GUÍA ARMADA CON CLARIA, PROYECTO EDUCATIVO INDEPENDIENTE. NO ES UNA GUÍA OFICIAL NI GARANTIZA CUMPLIR NORMAS. CONFIRMÁ SIEMPRE EN LA FUENTE OFICIAL.', fichas: [] });
      const pags = await ClariaExport.dibujarPaginas({ titulo: esBorrador ? 'CLARIA · Guía de trámite (BORRADOR)' : 'CLARIA · Guía de trámite', mayus: true, tamano: 150, bloques });
      ClariaExport.descargar(ClariaExport.aPDF(pags), esBorrador ? 'guia-tramite-BORRADOR.pdf' : 'guia-tramite.pdf'); estado(esBorrador ? 'Se descargó el borrador, marcado como pendiente de revisión.' : 'Se descargó el PDF. Es una guía armada con CLARIA y no es una guía oficial.');
    } catch (_) { estado('No se pudo preparar el PDF. Probá de nuevo.'); } finally { actualizarExport(); }
  }
  $('crPdf').addEventListener('click', () => exportar(false)); $('crBorrador').addEventListener('click', () => exportar(true));
  $('crEjemplo').addEventListener('click', () => { $('crTitulo').value = 'Realizar una consulta'; $('crTexto').value = 'Acercate al mostrador.\nDecí qué necesitás.\nEscuchá la respuesta.'; estado('Se cargó el ejemplo de la guía oficial. Es solo para ver el formato, no es un trámite real.'); });

  window.ClariaCreador = { entrar, irA, partir };
})();
