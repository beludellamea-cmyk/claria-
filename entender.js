/* CLARIA · Entender: foto, captura o documento → qué dice, qué es importante y qué hacer.
   - La imagen o el archivo se leen EN EL DISPOSITIVO (OCR con Tesseract.js; PDF con pdf.js). Nunca se envían a ningún servidor.
   - Si la persona pide una explicación con IA, y solo después de su permiso, se envía únicamente el TEXTO leído (con datos personales ocultos).
   - El original queda siempre visible y separado de lo que genera CLARIA. Lo «importante» se copia literal del texto; los datos de la IA se descartan si no figuran escritos en el documento.
   - Si la lectura es mala (borrosa, oscura, ilegible) se avisa y no se sigue como si nada: nunca se completa lo que falta.
   - No se guarda nada: ni en el navegador ni en un servidor. Al salir, todo se borra de la pantalla.
   - Las bibliotecas (Tesseract, pdf.js) se descargan la primera vez desde un CDN; con window.CLARIA_CONFIG.libs se pueden servir desde otro lugar. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const G = () => window.ClariaGuia, UI = () => window.ClariaUI, K = () => window.ClariaEntenderCore;
  const el = (t, a = {}, k = []) => { const n = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'text') n.textContent = v; else n.setAttribute(x, v); } [].concat(k).forEach((c) => c && n.append(c)); return n; };
  const LIBS = { tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', pdfjsWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js' };
  const lib = (k) => ((window.CLARIA_CONFIG && window.CLARIA_CONFIG.libs) || {})[k] || LIBS[k];
  const MAX_BYTES = 15 * 1024 * 1024, MAX_PDF_PAGES = 25, MAX_OCR_PAGES = 6, MAX_TEXTO = 20000;
  const PASOS = { inicio: ['enInicio', 'enTitulo', 'entender1'], trabajo: ['enTrabajo', 'enTrabajoTitulo', 'entenderlee'], res: ['enResultado', 'enResTitulo', 'entenderres'] };
  let S = null, trabajo = null, cargaLibs = {}, iaOcupada = false;
  const dec = (t) => UI() && UI().announce(t);

  // ───────── pasos ─────────
  function irA(n, silencioso) {
    if (n === 'res' && !S) n = 'inicio';
    Object.entries(PASOS).forEach(([k, [id]]) => { $(id).hidden = k !== n; });
    if (!silencioso) G()?.setPantalla(PASOS[n][2]);
    const t = $(PASOS[n][1]); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); window.scrollTo({ top: 0 });
  }
  function entrar(conservar) { if (conservar) return; limpiar(); irA('inicio'); }
  function salir() { cancelar(true); try { UI()?.stopSpeaking && speechSynthesis.cancel(); } catch (_) {} limpiar(); }
  function limpiar() {
    if (S) (S.urls || []).forEach((u) => URL.revokeObjectURL(u));
    S = null; iaOcupada = false;
    ['enOriginal', 'enImportanteLista', 'enImportanteIA', 'enTranscripcion', 'enIATexto', 'enIADiceLista', 'enIASugLista', 'enIAPuntos', 'enIAAvisosLista', 'enCalidad', 'enEstado', 'enEstadoInicio', 'enTrabajoEstado'].forEach((id) => { const n = $(id); if (n) n.textContent = ''; });
    ['enTextoManual', 'enTextoEditar', 'enPregInput'].forEach((id) => { $(id).value = ''; });
    ['enPanelTexto', 'enPanelIA', 'enPanelPregunta'].forEach((id) => { $(id).hidden = true; });
    $('enPreviaImg').removeAttribute('src'); $('enPreviaImg').hidden = true; $('enZoomImg').removeAttribute('src');
  }
  const estado = (t) => { $('enEstado').textContent = t; dec(t); };

  // ───────── bibliotecas externas (se cargan al usarlas) ─────────
  function cargarScript(src) { return cargaLibs[src] || (cargaLibs[src] = new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = () => { delete cargaLibs[src]; mal(new Error('descarga')); }; document.head.append(s); })); }

  // ───────── imagen: preparar (grises + contraste) y medir nitidez ─────────
  async function abrirBitmap(blob) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch (_) { return new Promise((ok, mal) => { const u = URL.createObjectURL(blob), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); mal(new Error('imagen')); }; i.src = u; }); }
  }
  function prepararCanvas(origen, w0, h0) {
    const lado = Math.max(w0, h0); const k = lado > 2000 ? 2000 / lado : lado < 1200 ? Math.min(2.5, 1400 / lado) : 1;
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k)); const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(origen, 0, 0, c.width, c.height);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data, hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = d[i + 1] = d[i + 2] = g; hist[g]++; }
    const total = c.width * c.height, corte = total * 0.02; let lo = 0, hi = 255, a = 0;
    for (let v = 0; v < 256; v++) { a += hist[v]; if (a > corte) { lo = v; break; } } a = 0; for (let v = 255; v >= 0; v--) { a += hist[v]; if (a > corte) { hi = v; break; } }
    const rango = Math.max(1, hi - lo); for (let i = 0; i < d.length; i += 4) { const g = Math.max(0, Math.min(255, ((d[i] - lo) * 255 / rango) | 0)); d[i] = d[i + 1] = d[i + 2] = g; }
    x.putImageData(im, 0, 0); return c;
  }
  function medirNitidez(canvas) {
    const k = Math.min(1, 640 / canvas.width), w = Math.max(3, Math.round(canvas.width * k)), h = Math.max(3, Math.round(canvas.height * k)); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h); for (let i = 0; i < g.length; i++) g[i] = d[i * 4]; return K().nitidez(g, w, h);
  }

  // ───────── OCR ─────────
  async function crearOCR(progreso) {
    await cargarScript(lib('tesseract')); const o = { logger: (m) => { if (m && m.status === 'recognizing text' && typeof m.progress === 'number') progreso(m.progress); } };
    const cfg = (window.CLARIA_CONFIG && window.CLARIA_CONFIG.libs) || {}; if (cfg.tesseractWorker) o.workerPath = cfg.tesseractWorker; if (cfg.tesseractCore) o.corePath = cfg.tesseractCore; if (cfg.tesseractLang) o.langPath = cfg.tesseractLang;
    const w = await window.Tesseract.createWorker('spa', 1, o); trabajo && (trabajo.worker = w); return w;
  }
  const palabrasDe = (lineas) => lineas.flatMap((l) => l.palabras);
  const textoDeLineas = (lineas) => lineas.map((l) => l.palabras.map((w) => w.t).join(' ')).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // ───────── PDF ─────────
  function lineasDeItems(items) {
    const filas = []; let y = null;
    items.forEach((it) => { if (typeof it.str !== 'string') return; const yy = it.transform ? Math.round(it.transform[5]) : 0; if (y === null || Math.abs(yy - y) > 3) { filas.push([]); y = yy; } filas[filas.length - 1].push(it.str); });
    return filas.map((f) => f.join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }
  async function leerPDF(file, prog, ctl) {
    await cargarScript(lib('pdfjs')); window.pdfjsLib.GlobalWorkerOptions.workerSrc = lib('pdfjsWorker');
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`El PDF tiene ${pdf.numPages} páginas. Probá con uno de ${MAX_PDF_PAGES} o menos.`);
    const lineas = [], miniaturas = [], notas = []; let ocrW = null, ocrUsado = 0, confs = [], palabrasOCR = [], nit = [];
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        if (ctl.cancel) throw new Error('cancelado'); prog(`Leyendo la página ${i} de ${pdf.numPages}…`, (i - 1) / pdf.numPages);
        const page = await pdf.getPage(i); const tc = await page.getTextContent(); const filas = lineasDeItems(tc.items); const chars = filas.join('').replace(/\s/g, '').length;
        const v1 = page.getViewport({ scale: 1 }); let canvas = null;
        const render = async (ancho) => { const vp = page.getViewport({ scale: Math.min(3, ancho / v1.width) }); const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; return c; };
        if (chars >= 25) { if (lineas.length) lineas.push({ palabras: [] }); filas.forEach((f) => lineas.push({ palabras: f.split(' ').map((t) => ({ t, c: 100 })) })); }
        else if (ocrUsado >= MAX_OCR_PAGES) { if (!notas.length) notas.push(`Solo se leyeron las primeras ${MAX_OCR_PAGES} páginas escaneadas; el resto no se procesó.`); }
        else {
          canvas = await render(1700); const prep = prepararCanvas(canvas, canvas.width, canvas.height); nit.push(medirNitidez(prep)); if (!ocrW) ocrW = await crearOCR((p) => prog(`Leyendo el texto de la página ${i}… ${Math.round(p * 100)} %`, (i - 1 + p) / pdf.numPages));
          const r = await ocrW.recognize(prep); if (ctl.cancel) throw new Error('cancelado'); ocrUsado++; const ls = K().lineasDeOCR(r.data); if (lineas.length) lineas.push({ palabras: [] }); lineas.push(...ls); confs.push(Number(r.data.confidence) || 0); palabrasOCR.push(...palabrasDe(ls));
        }
        if (miniaturas.length < 3) { const c = canvas || await render(700); const m = document.createElement('canvas'); const k = Math.min(1, 700 / c.width); m.width = Math.round(c.width * k); m.height = Math.round(c.height * k); m.getContext('2d').drawImage(c, 0, 0, m.width, m.height); const blob = await new Promise((ok) => m.toBlob(ok, 'image/png')); if (blob) miniaturas.push({ blob, alt: `Página ${i} del documento original` }); }
      }
    } finally { try { if (ocrW) await ocrW.terminate(); } catch (_) {} if (trabajo) trabajo.worker = null; }
    return { lineas, miniaturas, notas, paginas: pdf.numPages, ocr: ocrUsado > 0, confianza: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 100, palabrasOCR, nitidez: nit.length ? Math.min(...nit) : null };
  }

  // ───────── proceso principal ─────────
  function progreso(txt, frac) { $('enTrabajoEstado').textContent = txt; if (typeof frac === 'number') $('enProgreso').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%'; }
  function cancelar(silencio) {
    if (!trabajo) return; trabajo.cancel = true; try { trabajo.worker && trabajo.worker.terminate(); } catch (_) {} trabajo = null;
    if (!silencio) { irA('inicio'); $('enEstadoInicio').textContent = 'Lectura cancelada. No se guardó nada.'; dec('Lectura cancelada'); }
  }
  function tipoDe(file) { const n = file.name.toLowerCase(); if (file.type.startsWith('image/')) return 'imagen'; if (file.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'; if (file.type === 'text/plain' || n.endsWith('.txt')) return 'txt'; return null; }
  async function procesar(file) {
    if (!file || trabajo) return; $('enEstadoInicio').textContent = '';
    const tipo = tipoDe(file);
    if (!tipo) { $('enEstadoInicio').textContent = /\.(docx?|odt|rtf)$/i.test(file.name) ? 'Los documentos de Word todavía no se pueden leer. Guardalo como PDF y subilo de nuevo.' : 'Ese tipo de archivo no se puede leer. Elegí una imagen (JPG, PNG, WEBP), un PDF o un archivo de texto.'; dec('Tipo de archivo no admitido'); return; }
    if (file.size > MAX_BYTES) { $('enEstadoInicio').textContent = 'El archivo supera los 15 MB. Elegí uno más liviano.'; return; }
    limpiar(); const ctl = trabajo = { cancel: false, worker: null }; const urls = []; S = { urls };
    $('enPreviaNombre').textContent = file.name; $('enProgreso').style.width = '0%'; irA('trabajo');
    if (tipo === 'imagen') { const u = URL.createObjectURL(file); urls.push(u); $('enPreviaImg').src = u; $('enPreviaImg').hidden = false; } else $('enPreviaImg').hidden = true;
    G()?.estado('procesando'); progreso('Preparando la lectura… la primera vez puede tardar porque descarga componentes.', 0.02);
    try {
      let r;
      if (tipo === 'imagen') {
        const bmp = await abrirBitmap(file); if (ctl.cancel) return; const prep = prepararCanvas(bmp, bmp.width, bmp.height); const nit = medirNitidez(prep);
        const w = await crearOCR((p) => progreso(`Leyendo el texto… ${Math.round(p * 100)} %`, 0.1 + p * 0.85)); let data; try { data = (await w.recognize(prep)).data; } finally { try { await w.terminate(); } catch (_) {} if (trabajo) trabajo.worker = null; }
        if (ctl.cancel) return; const lineas = K().lineasDeOCR(data); const palabras = palabrasDe(lineas);
        r = { tipo, lineas, urlsOriginales: [{ url: urls[0], alt: `Imagen original: ${file.name}` }], ocr: true, confianza: Number(data.confidence) || 0, palabras, nitidez: nit, notas: [] };
      } else if (tipo === 'pdf') {
        const p = await leerPDF(file, progreso, ctl); if (ctl.cancel) return; const orig = p.miniaturas.map((m) => { const u = URL.createObjectURL(m.blob); urls.push(u); return { url: u, alt: m.alt }; });
        r = { tipo, lineas: p.lineas, urlsOriginales: orig, ocr: p.ocr, confianza: p.confianza, palabras: p.palabrasOCR, nitidez: p.nitidez, notas: p.notas, paginas: p.paginas };
      } else {
        const t = (await file.text()).slice(0, MAX_TEXTO); r = { tipo, lineas: [], texto: t, ocr: false, confianza: 100, palabras: [], notas: [], textoOriginal: t };
      }
      if (ctl.cancel) return; trabajo = null; mostrarResultado(r, file.name);
    } catch (err) {
      if (ctl.cancel || (err && err.message === 'cancelado')) return; trabajo = null; irA('inicio'); G()?.estado('esperando');
      const m = err && err.message === 'descarga' ? 'No pude descargar los componentes de lectura. La primera vez hace falta internet. Probá de nuevo o escribí el texto.' : err && err.message === 'imagen' ? 'No pude abrir esa imagen. Si es una foto en formato HEIC, sacala de nuevo o guardala como JPG.' : err && /Invalid PDF|password|PDF/i.test(err.message || '') ? 'No pude abrir ese PDF. Puede estar dañado o protegido con contraseña.' : 'No se pudo leer: ' + ((err && err.message) || 'error desconocido') + ' Probá de nuevo, elegí otro archivo o escribí el texto.';
      $('enEstadoInicio').textContent = m; dec(m);
    }
  }
  function usarTextoManual() {
    const t = $('enTextoManual').value.trim(); if (t.length < 12) { $('enEstadoInicio').textContent = 'Escribí al menos 12 caracteres.'; $('enTextoManual').focus(); return; }
    limpiar(); S = { urls: [] }; $('enTextoManual').value = ''; mostrarResultado({ tipo: 'texto', lineas: [], texto: t, textoOriginal: t, ocr: false, confianza: 100, palabras: [], notas: [] }, 'texto');
  }

  // ───────── resultado ─────────
  function mostrarResultado(r, nombre) {
    const urls = S.urls; const lineas = r.lineas || []; const texto = r.texto != null ? r.texto : textoDeLineas(lineas);
    let calidad;
    if (r.ocr) { calidad = K().calidadOCR({ confianza: r.confianza, palabras: r.palabras, texto }); if (calidad.nivel !== 'buena' && r.nitidez != null && r.nitidez < 60) calidad.mensaje += ' La imagen parece movida o desenfocada.'; }
    else calidad = { nivel: 'buena', dudosas: [], confianza: 100, mensaje: r.tipo === 'pdf' ? 'Leí el texto del PDF directamente (sin reconocimiento de imagen). Igual, compará con el original.' : r.tipo === 'txt' ? 'Leí el texto del archivo tal cual.' : 'Este es el texto que escribiste.' };
    if (r.tipo === 'pdf' && r.ocr) calidad.mensaje += ' Parte del PDF era una imagen escaneada: se leyó con reconocimiento de texto.';
    if (r.notas && r.notas.length) calidad.mensaje += ' ' + r.notas.join(' ');
    S = { ...S, tipo: r.tipo, nombre, urls, urlsOriginales: r.urlsOriginales || [], texto, textoOriginal: r.textoOriginal || texto, lineas, ocr: r.ocr, calidad, editado: false, aiTexto: '', aiKind: '', datos: null, imagenOriginal: null };
    S.datos = (calidad.nivel === 'mala' || calidad.nivel === 'sin_texto') ? null : K().extraerDatos(texto);
    $('enCalidad').textContent = calidad.mensaje; $('enCalidad').dataset.nivel = calidad.nivel;
    const mala = calidad.nivel === 'mala' || calidad.nivel === 'sin_texto'; $('enReintentar').hidden = !mala; $('enCorregir').hidden = false;
    pintarOriginal(); pintarImportante(); pintarTranscripcion(); disponibilidad();
    ['enPanelTexto', 'enPanelIA', 'enPanelPregunta'].forEach((id) => { $(id).hidden = true; }); $('enImportanteIA').textContent = ''; $('enEstado').textContent = '';
    G()?.estado('esperando'); irA('res'); dec(calidad.mensaje);
  }
  function pintarOriginal() {
    const c = $('enOriginal'); c.textContent = '';
    if (S.urlsOriginales.length) S.urlsOriginales.forEach((o) => { const b = el('button', { type: 'button', class: 'en-mini', 'aria-label': `Ampliar. ${o.alt}` }); const i = el('img', { src: o.url, alt: o.alt }); b.append(i); b.addEventListener('click', () => { $('enZoomImg').src = o.url; $('enZoomImg').alt = o.alt; $('enZoom').showModal(); }); c.append(b); });
    else c.append(el('pre', { lang: 'es', text: S.textoOriginal }));
    if (S.tipo === 'pdf') c.append(el('p', { class: 'pc-note', text: `${S.urlsOriginales.length < 3 ? '' : 'Se muestran las primeras 3 páginas. '}Tocá una página para verla más grande.` }));
  }
  const GRUPOS = [['fechas', 'Fechas', '📅'], ['horarios', 'Horarios', '🕘'], ['lugares', 'Lugares', '📍'], ['dinero', 'Dinero', '💲'], ['requisitos', 'Requisitos y avisos', '📋'], ['acciones', 'Lo que piden hacer', '✅']];
  function pintarImportante() {
    const c = $('enImportanteLista'); c.textContent = ''; const sec = $('enImportante'); const d = S.datos;
    if (!d) { sec.hidden = true; return; } sec.hidden = false; const dud = new Set((S.calidad.dudosas || []).map((w) => K().norm(w.t)));
    GRUPOS.forEach(([k, tit, ico]) => {
      const l = d[k] || []; if (!l.length) return; const g = el('div', { class: 'en-grupo' }); g.append(el('h3', { text: `${ico} ${tit}` })); const ul = el('ul');
      l.forEach((x) => { const li = el('li'); li.append(el('b', { text: x.texto })); const dudoso = x.texto.split(/\s+/).some((p) => dud.has(K().norm(p))); if (dudoso) li.append(el('small', { text: '⚠ Incluye palabras que no se leyeron bien: comprobalo en el original.' })); else if (x.frase && K().norm(x.frase) !== K().norm(x.texto) && x.frase.length <= 220) li.append(el('small', { text: x.frase })); ul.append(li); });
      g.append(ul); c.append(g);
    });
    $('enImportanteVacio').hidden = K().hayDatos(d);
  }
  function pintarTranscripcion() {
    const c = $('enTranscripcion'); c.textContent = '';
    if (S.lineas && S.lineas.length && !S.editado) K().fichasDeLineas(S.lineas).forEach((l, i, arr) => { l.forEach((f, j) => { if (f.dudosa) c.append(el('mark', { class: 'en-dudosa', title: 'Palabra dudosa', text: f.t })); else c.append(document.createTextNode(f.t)); if (j < l.length - 1) c.append(document.createTextNode(' ')); }); if (i < arr.length - 1) c.append(document.createTextNode('\n')); });
    else c.textContent = S.texto;
  }
  // ───────── qué botones se pueden usar ─────────
  const bloqueadoPorCalidad = () => S && !S.editado && (S.calidad.nivel === 'mala' || S.calidad.nivel === 'sin_texto');
  function disponibilidad() {
    const modo = UI() ? UI().ia.modo() : 'demo'; const conectada = modo === 'connected'; const bloq = bloqueadoPorCalidad();
    document.querySelectorAll('#view-entender .en-ia').forEach((b) => { b.disabled = !conectada || bloq || iaOcupada; });
    $('enDisponibilidad').textContent = bloq ? 'La lectura no es confiable, así que no uso la IA sobre ella. Sacá otra foto o corregí el texto a mano.' : !conectada ? 'Las explicaciones con IA necesitan una IA conectada y ahora no la hay (modo demo o sin conexión). Igual podés ver el texto, lo importante, escucharlo, verlo con pictogramas y responder.' : '';
  }
  function mostrarPanel(id) { ['enPanelTexto', 'enPanelIA', 'enPanelPregunta'].forEach((p) => { $(p).hidden = p !== id; }); const n = $(id); n.hidden = false; n.focus({ preventScroll: false }); n.scrollIntoView({ block: 'start', behavior: 'auto' }); }

  // ───────── IA (solo con permiso; solo texto) ─────────
  const KIND = { easy: 'Explicación fácil', actions: 'Lo que tenés que hacer', ask: 'Respuesta a tu pregunta' };
  const listaHTML = (ul, items) => { ul.textContent = ''; items.forEach((x) => ul.append(el('li', { text: x }))); };
  function textoParaIA() { return S.ocr && !S.editado && S.lineas.length ? K().armarTextoIA(S.lineas) : S.texto; }
  async function pedirIA(task, pregunta) {
    const u = UI(); if (!S || iaOcupada) return null;
    if (u.ia.modo() !== 'connected') { disponibilidad(); estado('No hay IA conectada ahora. Podés seguir sin ella.'); return null; }
    if (bloqueadoPorCalidad()) { disponibilidad(); return null; }
    if (task === 'ask' && (pregunta || '').trim().length < 3) { estado('Escribí tu pregunta sobre el documento.'); $('enPregInput').focus(); return null; }
    if (!(await u.ia.consentimiento())) { estado('Sin tu permiso no se usa la IA. Podés seguir leyendo, escuchando y viendo el documento con pictogramas.'); return null; }
    if (!u.ia.cuota()) { estado(u.ia.errores.session_limit); return null; }
    const avisos = []; const max = u.ia.maxChars(); let body = textoParaIA();
    if (body.length > max) { body = body.slice(0, max).replace(/\s+\S*$/, ''); avisos.push(`El documento tiene ${textoParaIA().length} caracteres y se analizaron solo los primeros ${body.length}.`); }
    const t = window.ClariaPrivacy.redact(body), q = window.ClariaPrivacy.redact(pregunta || ''); if (t.count + q.count) avisos.push(`Se ocultaron ${t.count + q.count} dato(s) que parecían personales (${[...new Set([...t.kinds, ...q.kinds])].join(', ')}) antes de enviar. Revisá que el resultado no dependa de ellos.`);
    if (S.ocr) avisos.push('El texto viene de una imagen leída por reconocimiento óptico y puede tener errores; la IA trabaja sobre ese texto.' + (S.editado ? '' : ' Lo ilegible se le envió como [ilegible].'));
    iaOcupada = true; disponibilidad(); G()?.estado('procesando'); estado('CLARIA está pensando…');
    try { const d = await u.ia.llamar('/api/explain', { task, text: t.text, question: q.text, source: S.ocr ? 'file_ocr' : S.tipo === 'pdf' ? 'file_pdf' : S.tipo === 'txt' ? 'file_txt' : 'typed' }); d.__avisos = avisos; return d; }
    catch (err) { estado(err.code === 'bad_request' && task === 'extract' ? 'Esta función de la IA todavía no está activa en el servidor. Los datos de arriba siguen siendo los del texto.' : (u.ia.errores[err.code] || err.message)); return null; }
    finally { iaOcupada = false; G()?.estado('esperando'); disponibilidad(); }
  }
  function mostrarIA(task, d) {
    $('enIAKind').textContent = KIND[task]; $('enIATexto').textContent = d.resultado;
    const dice = task === 'actions' ? d.el_documento_dice || [] : [], sug = task === 'actions' ? d.sugerencias || [] : [];
    listaHTML($('enIADiceLista'), dice); $('enIADice').hidden = !dice.length; listaHTML($('enIASugLista'), sug); $('enIASug').hidden = !sug.length; listaHTML($('enIAPuntos'), d.puntos_clave || []);
    const notas = [...(d.__avisos || []).map((n) => `CLARIA: ${n}`), ...(d.avisos || []).map((n) => `La IA señala: ${n}`)]; listaHTML($('enIAAvisosLista'), notas); $('enIAAvisos').hidden = !notas.length;
    S.aiKind = task; S.aiTexto = [d.resultado, ...(dice.length ? ['El documento dice:', ...dice] : []), ...(sug.length ? ['Sugerencia de CLARIA, que no figura en el documento:', ...sug] : []), ...(d.puntos_clave || [])].join('\n');
    mostrarPanel('enPanelIA'); estado('Listo. La respuesta de la IA está separada del documento original.');
  }
  async function explicar(task) { const d = await pedirIA(task); if (d) mostrarIA(task, d); }
  async function revisarIA() {
    const d = await pedirIA('extract'); if (!d) return; const c = $('enImportanteIA'); c.textContent = ''; let desc = d.descartados || 0;
    const caja = el('div', { class: 'en-bloque' }); caja.append(el('h3', {}, [el('span', { class: 'en-tag en-tag-ia', text: 'IA · VERIFICADO CONTRA EL TEXTO' })]));
    if (d.resultado) caja.append(el('p', { text: (d.tipo ? `${d.tipo}: ` : '') + d.resultado }));
    GRUPOS.forEach(([k, tit, ico]) => { const l = (d[k] || []).filter((x) => { const ok = K().citaEnTexto(x.cita, S.texto); if (!ok) desc++; return ok; }); if (!l.length) return; const g = el('div', { class: 'en-grupo' }); g.append(el('h3', { text: `${ico} ${tit}` })); const ul = el('ul'); l.forEach((x) => { const li = el('li'); li.append(el('b', { text: x.cita })); if (x.detalle) li.append(el('small', { text: x.detalle })); ul.append(li); }); g.append(ul); caja.append(g); });
    (d.ilegible || []).forEach((t) => caja.append(el('p', { class: 'en-calidad', 'data-nivel': 'dudosa', text: `No se pudo leer: ${t}` })));
    const notas = [...(d.__avisos || []), ...(d.avisos || [])]; if (desc && !(d.avisos || []).some((a) => /descartó/.test(a))) notas.push(`CLARIA descartó ${desc} dato(s) porque no aparecen escritos en el documento.`); notas.forEach((n) => caja.append(el('p', { class: 'pc-note', text: n })));
    c.append(caja); estado('La IA revisó el texto. Cada dato de la lista figura escrito en el documento.'); caja.scrollIntoView({ block: 'nearest' });
  }

  // ───────── acciones ─────────
  function queDice() { pintarTranscripcion(); mostrarPanel('enPanelTexto'); estado(S.lineas.length && !S.editado ? 'Esta es la transcripción del documento. Lo dudoso está marcado.' : 'Este es el texto del documento.'); }
  function editar(abrir) { $('enTextoEditar').hidden = !abrir; $('enTextoEditarLabel').hidden = !abrir; $('enGuardarEdicion').hidden = !abrir; $('enEditar').hidden = abrir; $('enTranscripcion').hidden = abrir; if (abrir) { $('enTextoEditar').value = S.texto; $('enTextoEditar').focus(); } }
  function guardarEdicion() {
    const t = $('enTextoEditar').value.trim(); if (t.length < 12) { estado('Escribí al menos 12 caracteres.'); return; }
    S.texto = t; S.editado = true; S.lineas = []; S.calidad = { nivel: 'buena', dudosas: [], confianza: 100, mensaje: 'Usás el texto que corregiste vos. Revisá que coincida con el original.' }; S.datos = K().extraerDatos(t);
    $('enCalidad').textContent = S.calidad.mensaje; $('enCalidad').dataset.nivel = 'buena'; $('enReintentar').hidden = true; S.aiTexto = ''; $('enPanelIA').hidden = true; $('enImportanteIA').textContent = '';
    pintarImportante(); pintarTranscripcion(); editar(false); disponibilidad(); estado('Listo. Ahora uso tu texto corregido; el original sigue arriba.');
  }
  function escuchar(texto, aviso) { const ok = UI().speak(texto); if (ok) estado(aviso); else estado('Este navegador no puede leer en voz alta. Podés leer la pantalla o mostrársela a otra persona.'); }
  function escucharExplicacion() {
    if (!S) return; if (S.aiTexto) return escuchar(S.aiTexto, 'Leyendo la explicación.');
    queDice(); escuchar(S.texto, 'Todavía no pediste una explicación, así que te leo el documento original. Para una explicación, tocá «Explicámelo fácil».');
  }
  function verPictos() {
    if (!S) return; const texto = (S.aiTexto || S.texto).trim(); if (!texto) return;
    G()?.desviar('cuento', 'entenderres'); window.ClariaCuento.abrir(texto.slice(0, 3000));
  }
  const RESP = [['SÍ.', ['sí']], ['NO.', ['no']], ['ENTIENDO.', ['entender']], ['NO ENTIENDO.', ['no', 'entender']], ['NECESITO AYUDA, POR FAVOR.', ['necesitar', 'ayudar', 'por favor']], ['MÁS DESPACIO, POR FAVOR.', ['más', 'lento', 'por favor']], ['TENGO UNA PREGUNTA.', ['tener', 'pregunta']], ['VOY A IR.', ['ir']], ['NO PUEDO IR.', ['no', 'poder', 'ir']], ['GRACIAS.', ['gracias']]];
  function responder() {
    UI().showView('tablero', { keep: true });
    window.ClariaTablero.abrirContexto({ id: 'entender', nombre: 'Responder', titulo: 'Responder con pictogramas', guia: 'entendertablero', aviso: 'Elegí una frase para responder sobre el documento. Son frases de ayuda: revisalas antes de decirlas o mostrarlas.', frases: RESP.map(([texto, tarjetas]) => ({ texto, tarjetas, revisar: [] })), palabras: ['sí', 'no', 'entender', 'ayudar', 'necesitar', 'querer', 'ir', 'poder', 'tener', 'pregunta', 'gracias', 'por favor'] });
  }
  async function preguntar(e) { e && e.preventDefault(); const q = $('enPregInput').value; const d = await pedirIA('ask', q); if (d) mostrarIA('ask', d); }

  // ───────── conexiones ─────────
  const entradas = [['enFoto', 'enInFoto'], ['enImagen', 'enInImagen'], ['enDoc', 'enInDoc']];
  entradas.forEach(([b, i]) => { $(b).addEventListener('click', () => $(i).click()); $(i).addEventListener('change', () => { const f = $(i).files && $(i).files[0]; $(i).value = ''; procesar(f); }); });
  $('enUsarTexto').addEventListener('click', usarTextoManual);
  $('enCancelar').addEventListener('click', () => cancelar(false));
  $('enOtraFoto').addEventListener('click', () => { irA('inicio'); $('enInFoto').click(); }); $('enOtraImagen').addEventListener('click', () => { irA('inicio'); $('enInImagen').click(); });
  $('enCorregir').addEventListener('click', () => { queDice(); editar(true); });
  $('enQueDice').addEventListener('click', () => { if (S) { queDice(); editar(false); } });
  $('enEditar').addEventListener('click', () => editar(true)); $('enGuardarEdicion').addEventListener('click', guardarEdicion);
  $('enLeerOriginal').addEventListener('click', () => S && escuchar(S.texto, 'Leyendo el texto del documento.'));
  $('enCopiar').addEventListener('click', async () => { try { await navigator.clipboard.writeText(S.texto); estado('Texto copiado.'); } catch (_) { estado('No se pudo copiar automáticamente: seleccioná el texto.'); } });
  $('enFacil').addEventListener('click', () => explicar('easy')); $('enQueHacer').addEventListener('click', () => explicar('actions')); $('enRevisarIA').addEventListener('click', revisarIA);
  $('enEscuchar').addEventListener('click', escucharExplicacion); $('enPictos').addEventListener('click', verPictos); $('enResponder').addEventListener('click', responder);
  $('enPreguntar').addEventListener('click', () => { if (!S) return; mostrarPanel('enPanelPregunta'); $('enPregInput').focus(); }); $('enPregForm').addEventListener('submit', preguntar);
  $('enIAEscuchar').addEventListener('click', () => S && S.aiTexto && escuchar(S.aiTexto, 'Leyendo la respuesta.')); $('enIADetener').addEventListener('click', () => UI().stopSpeaking());
  $('enIACopiar').addEventListener('click', async () => { try { await navigator.clipboard.writeText(S.aiTexto); estado('Respuesta copiada.'); } catch (_) { estado('No se pudo copiar automáticamente.'); } });
  $('enBorrar').addEventListener('click', () => { limpiar(); irA('inicio'); $('enEstadoInicio').textContent = 'Listo: se borró todo de la pantalla.'; });
  $('enZoomCerrar').addEventListener('click', () => $('enZoom').close());
  document.addEventListener('visibilitychange', () => { if (document.hidden && trabajo === null) try { speechSynthesis.cancel(); } catch (_) {} });

  window.ClariaEntender = { entrar, irA, salir, disponibilidad, estado: () => (S && S.calidad ? { tipo: S.tipo, nivel: S.calidad.nivel, texto: S.texto, editado: S.editado, datos: S.datos, ai: S.aiTexto } : null) };
})();
