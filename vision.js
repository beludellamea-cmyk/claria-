/* CLARIA · Mirar la imagen con IA (visión multimodal).
   A diferencia del OCR (que se hace en el dispositivo), esto ENVÍA la imagen a un servicio de IA. Por eso:
   - se pide permiso explícito antes de enviar, con el nombre del proveedor y lo que hace con la imagen;
   - la imagen se reduce (máx. 1280 px), se vuelve a codificar como JPEG (así se pierden los metadatos: ubicación, cámara, fecha)
     y se pueden elegir una parte o tapar zonas privadas ANTES de enviar. Lo tapado nunca sale del dispositivo;
   - no se guarda nada: ni la imagen ni las respuestas (solo en memoria mientras la pantalla está abierta);
   - la respuesta se muestra en bloques separados: ORIGINAL · TEXTO TRANSCRIPTO (local) · OBSERVACIÓN VISUAL (IA) · INTERPRETACIÓN (IA).
   - las líneas de texto que la IA dice ver se comparan con la lectura local (OCR) y se marca cuáles solo vio la IA. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const UI = () => window.ClariaUI, E = () => window.ClariaEntender, G = () => window.ClariaGuia, K = () => window.ClariaEntenderCore;
  const el = (t, a = {}, k = []) => { const n = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'text') n.textContent = v; else n.setAttribute(x, v); } [].concat(k).forEach((c) => c && n.append(c)); return n; };
  const MAX_LADO = 1280, MAX_B64 = 1_300_000;
  let V = null; // estado de la imagen en pantalla (solo en memoria)

  const estadoEd = (t) => { $('viEstadoEd').textContent = t; UI() && UI().announce(t); };
  const estado = (t) => { $('viEstado').textContent = t; UI() && UI().announce(t); };

  // ───────── preparar la imagen ─────────
  async function abrirBitmap(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) { return new Promise((ok, mal) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); mal(new Error('imagen')); }; i.src = u; }); }
  }
  async function abrir() {
    const im = E() && E().imagen(); if (!im) return;
    limpiar(); V = { im, tapados: [], region: null, modo: 'todo', drag: null, consentKey: '', res: {}, ultimo: '', ocupado: false };
    E().irA('vision'); $('viEditar').hidden = false; $('viResultado').hidden = true; setModo('todo');
    try {
      const bmp = await abrirBitmap(im.file); const k = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height); V.base = c;
      const cv = $('viCanvas'); cv.width = c.width; cv.height = c.height; pintar(); info();
    } catch (_) { estadoEd('No pude abrir esa imagen. Si es una foto HEIC, sacala de nuevo o guardala como JPG.'); $('viAnalizar').disabled = true; }
  }
  function limpiar() {
    V = null; if (!$('viCanvas')) return;
    const cv = $('viCanvas'); cv.width = 1; cv.height = 1;
    ['viQueAparece', 'viTipo', 'viInterpTexto', 'viTextoLocal', 'viEstadoEd', 'viEstado', 'viEnviado', 'viInfo', 'viAyuda'].forEach((id) => { $(id).textContent = ''; });
    ['viElementos', 'viTextoIA', 'viDudas', 'viSug', 'viInterpDudas'].forEach((id) => { $(id).textContent = ''; });
    ['viSecVisto', 'viSecInterp', 'viSecTexto', 'viPanelPregunta', 'viResultado'].forEach((id) => { $(id).hidden = true; });
    $('viEditar').hidden = false; $('viPregInput').value = ''; $('viOrigImg').removeAttribute('src'); $('viAnalizar').disabled = false;
  }

  // ───────── vista previa: parte elegida y zonas tapadas ─────────
  function pintar(arrastre) {
    if (!V || !V.base) return; const cv = $('viCanvas'), x = cv.getContext('2d'), w = cv.width, h = cv.height;
    x.drawImage(V.base, 0, 0); x.fillStyle = '#000'; V.tapados.forEach((t) => x.fillRect(t.x, t.y, t.w, t.h));
    const r = arrastre && V.modo === 'parte' ? arrastre : V.region;
    if (r) { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, w, r.y); x.fillRect(0, r.y + r.h, w, h - r.y - r.h); x.fillRect(0, r.y, r.x, r.h); x.fillRect(r.x + r.w, r.y, w - r.x - r.w, r.h);
      x.lineWidth = Math.max(3, w / 200); x.strokeStyle = '#ffd400'; x.strokeRect(r.x, r.y, r.w, r.h); }
    if (arrastre && V.modo === 'tapar') { x.fillStyle = 'rgba(0,0,0,.8)'; x.fillRect(arrastre.x, arrastre.y, arrastre.w, arrastre.h); x.strokeStyle = '#ffd400'; x.lineWidth = Math.max(2, w / 300); x.strokeRect(arrastre.x, arrastre.y, arrastre.w, arrastre.h); }
    $('viDeshacer').disabled = !(V.tapados.length || V.region);
  }
  function tamanoSalida() { const r = V.region || { w: V.base.width, h: V.base.height }; const k = Math.min(1, MAX_LADO / Math.max(r.w, r.h)); return [Math.max(1, Math.round(r.w * k)), Math.max(1, Math.round(r.h * k))]; }
  function info() {
    if (!V || !V.base) return; const [w, h] = tamanoSalida();
    $('viInfo').textContent = `Se enviará ${V.region ? 'solo la parte marcada' : 'toda la imagen'}${V.tapados.length ? `, con ${V.tapados.length} zona${V.tapados.length === 1 ? '' : 's'} tapada${V.tapados.length === 1 ? '' : 's'} en negro` : ''}, a ${w}×${h} px, sin metadatos.`;
  }
  const AYUDAS = { todo: 'Se envía toda la imagen. Podés elegir una parte o tapar lo privado.', parte: 'Arrastrá con el dedo o el mouse para marcar la parte que querés analizar, o usá los botones de mitad.', tapar: 'Arrastrá sobre lo que querés tapar (rostros, nombres, documentos, direcciones). Se tapa antes de enviar.' };
  function setModo(m) {
    if (!V) return; V.modo = m; ['todo', 'parte', 'tapar'].forEach((k) => $('vi' + k[0].toUpperCase() + k.slice(1)).setAttribute('aria-pressed', String(k === m)));
    $('viMitades').hidden = m !== 'parte'; $('viAyuda').textContent = AYUDAS[m]; $('viCanvas').style.touchAction = m === 'todo' ? 'auto' : 'none'; $('viCanvas').dataset.modo = m;
    if (m === 'todo') { V.region = null; pintar(); info(); }
  }
  function punto(e) { const cv = $('viCanvas'), b = cv.getBoundingClientRect(); return { x: Math.max(0, Math.min(cv.width, (e.clientX - b.left) * cv.width / b.width)), y: Math.max(0, Math.min(cv.height, (e.clientY - b.top) * cv.height / b.height)) }; }
  const rect = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  const cv0 = $('viCanvas');
  cv0.addEventListener('pointerdown', (e) => { if (!V || !V.base || V.modo === 'todo') return; cv0.setPointerCapture(e.pointerId); V.drag = punto(e); e.preventDefault(); });
  cv0.addEventListener('pointermove', (e) => { if (!V || !V.drag) return; pintar(rect(V.drag, punto(e))); });
  const soltar = (e) => {
    if (!V || !V.drag) return; const r = rect(V.drag, punto(e)); V.drag = null; const min = Math.max(12, V.base.width / 40);
    if (r.w < min || r.h < min) { pintar(); return; }
    if (V.modo === 'parte') { V.region = r; estadoEd('Parte marcada. Si ya está bien, tocá «Enviar esta imagen y analizarla».'); } else { V.tapados.push(r); estadoEd('Zona tapada.'); }
    V.consentKey = ''; pintar(); info();
  };
  cv0.addEventListener('pointerup', soltar); cv0.addEventListener('pointercancel', () => { if (V) { V.drag = null; pintar(); } });
  $('viTodo').addEventListener('click', () => setModo('todo')); $('viParte').addEventListener('click', () => setModo('parte')); $('viTapar').addEventListener('click', () => setModo('tapar'));
  $('viDeshacer').addEventListener('click', () => { if (!V) return; if (V.modo === 'parte' && V.region) V.region = null; else if (V.tapados.length) V.tapados.pop(); else V.region = null; V.consentKey = ''; pintar(); info(); estadoEd('Deshecho.'); });
  $('viMitades').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mitad]'); if (!V || !b) return; const w = V.base.width, h = V.base.height;
    V.region = { arriba: { x: 0, y: 0, w, h: h / 2 }, abajo: { x: 0, y: h / 2, w, h: h / 2 }, izquierda: { x: 0, y: 0, w: w / 2, h }, derecha: { x: w / 2, y: 0, w: w / 2, h } }[b.dataset.mitad]; V.consentKey = ''; pintar(); info(); estadoEd(`Se enviará ${b.textContent.toLowerCase()}.`);
  });

  // ───────── construir lo que se envía ─────────
  async function construir() {
    const w0 = V.base.width, h0 = V.base.height; const c = document.createElement('canvas'); c.width = w0; c.height = h0; const x = c.getContext('2d');
    x.drawImage(V.base, 0, 0); x.fillStyle = '#000'; V.tapados.forEach((t) => x.fillRect(t.x, t.y, t.w, t.h)); // lo tapado se pinta sobre los píxeles: no hay forma de recuperarlo
    const r = V.region || { x: 0, y: 0, w: w0, h: h0 }; let [w, h] = tamanoSalida(); const o = document.createElement('canvas');
    for (let q = 0.82; q >= 0.4; q -= 0.14) {
      o.width = w; o.height = h; const ox = o.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, w, h); ox.drawImage(c, r.x, r.y, r.w, r.h, 0, 0, w, h);
      const url = o.toDataURL('image/jpeg', q); if (url.length - 23 <= MAX_B64) return { url, w, h, kb: Math.round((url.length * 3 / 4) / 1024) };
      w = Math.max(1, Math.round(w * 0.85)); h = Math.max(1, Math.round(h * 0.85));
    }
    throw new Error('peso');
  }

  // ───────── permiso explícito ─────────
  function pedirPermiso() {
    const vi = UI().ia.vision() || {}; $('visionDialogProv').textContent = vi.provider || 'un servicio de IA'; $('visionDialogNota').textContent = vi.note || 'La imagen se envía solo para generar la respuesta.';
    const dlg = $('visionDialog');
    return new Promise((resolve) => {
      const fin = () => { dlg.removeEventListener('close', fin); resolve(dlg.returnValue === 'accept'); };
      dlg.returnValue = ''; dlg.addEventListener('close', fin);
      if (typeof dlg.showModal === 'function') dlg.showModal(); else { dlg.returnValue = window.confirm('CLARIA enviará esta imagen a un servicio de IA externo. ¿Aceptás?') ? 'accept' : 'decline'; fin(); }
    });
  }

  // ───────── llamada al Worker ─────────
  const TAREA = { describe: 'la descripción', easy: 'la explicación fácil', meaning: 'el significado', ask: 'la respuesta' };
  async function pedir(task, pregunta, escribir) {
    const u = UI(); if (!V || V.ocupado) return null; const out = escribir || estado; const vi = u.ia.vision();
    if (u.ia.modo() !== 'connected' || !vi || !vi.enabled) { out('Ahora no hay una IA con visión conectada. Podés seguir con la lectura del texto.'); return null; }
    if (task === 'ask' && (pregunta || '').trim().length < 3) { out('Escribí tu pregunta sobre la imagen.'); $('viPregInput').focus(); return null; }
    let img; try { img = await construir(); } catch (_) { out('No pude preparar la imagen. Probá con una parte más chica.'); return null; }
    const key = JSON.stringify([V.region, V.tapados]);
    if (key !== V.consentKey) { const ok = await pedirPermiso(); if (!ok) { out('No se envió nada. Tu imagen sigue solo en tu dispositivo.'); return null; } V.consentKey = key; }
    if (!u.ia.cuota()) { out(u.ia.errores.session_limit); return null; }
    const loc = E().imagen(); const sinCambios = !V.region && !V.tapados.length; // el OCR de toda la imagen podría revelar lo que se tapó: solo se manda si no se tapó nada
    V.ocupado = true; G() && G().estado('procesando'); out(`CLARIA está mirando la imagen para darte ${TAREA[task]}…`);
    try {
      const d = await u.ia.llamar('/api/vision', { image: img.url, task, question: pregunta || '', ocrText: sinCambios && loc && loc.ocr && loc.texto ? loc.texto.slice(0, 3000) : '', parcial: Boolean(V.region) }, 55000);
      V.enviado = { w: img.w, h: img.h, kb: img.kb, parte: Boolean(V.region), tapados: V.tapados.length, redactions: d.redactions || 0, provider: d.provider };
      return d;
    } catch (err) { out(err.code === 'vision_blocked' ? 'La IA no pudo analizar esta imagen. Probá con otra o con una parte.' : (u.ia.errores[err.code] || err.message)); return null; }
    finally { V.ocupado = false; G() && G().estado('esperando'); }
  }

  // ───────── mostrar resultados, siempre separados ─────────
  const lista = (id, items) => { const ul = $(id); ul.textContent = ''; items.forEach((t) => ul.append(typeof t === 'string' ? el('li', { text: t }) : t)); };
  function mostrarResultado() {
    $('viEditar').hidden = true; $('viResultado').hidden = false; const loc = E().imagen();
    if (loc && loc.original) { $('viOrigImg').src = loc.original; }
    const e = V.enviado; $('viEnviado').textContent = e ? `A la IA se le envió una copia reducida (${e.w}×${e.h} px, unos ${e.kb} KB), sin metadatos${e.parte ? ', solo de la parte que marcaste' : ''}${e.tapados ? `, con ${e.tapados} zona${e.tapados === 1 ? '' : 's'} tapada${e.tapados === 1 ? '' : 's'}` : ''}. Esta imagen original no se envió ni se guarda.` : '';
    const sinCambios = !V.region && !V.tapados.length; const hayLocal = Boolean(loc && loc.ocr && loc.texto && loc.texto.trim());
    $('viSecTexto').hidden = !(hayLocal && sinCambios); if (hayLocal && sinCambios) $('viTextoLocal').textContent = loc.texto;
  }
  function pintarVisto(d) {
    const loc = E().imagen(); const sinCambios = !V.region && !V.tapados.length; const ref = loc && loc.ocr && sinCambios ? (loc.texto || '') : '';
    $('viTipo').textContent = d.tipo ? `Tipo de imagen: ${d.tipo}${d.legibilidad ? ' · legibilidad: ' + d.legibilidad : ''}` : '';
    $('viQueAparece').textContent = d.que_aparece || '';
    $('viElementosBox').hidden = !d.elementos.length; lista('viElementos', d.elementos);
    $('viTextoIABox').hidden = !d.texto_visible.length;
    lista('viTextoIA', d.texto_visible.map((t) => { const li = el('li', {}, [el('span', { text: t, lang: 'es' })]); if (ref) { const ok = K().citaEnTexto(t, ref); li.append(' ', el('small', { class: ok ? 'vi-ok' : 'vi-solo', text: ok ? '✓ coincide con la lectura en tu dispositivo' : '⚠ solo lo vio la IA: comprobalo en la imagen' })); } return li; }));
    $('viDudasBox').hidden = !d.dudas.length; lista('viDudas', d.dudas);
    $('viSecVisto').hidden = false; V.res.describe = d; V.ultimo = [d.que_aparece, ...d.elementos].filter(Boolean).join('. ');
  }
  const KIND = { easy: 'Explicámelo fácil', meaning: '¿Qué significa esto?', ask: 'Respuesta a tu pregunta' };
  function pintarInterp(task, d) {
    $('viInterpKind').textContent = KIND[task]; $('viInterpTexto').textContent = d.resultado || '';
    $('viSugBox').hidden = !(d.que_puede_hacer && d.que_puede_hacer.length); lista('viSug', d.que_puede_hacer || []);
    $('viInterpDudasBox').hidden = !d.dudas.length; lista('viInterpDudas', d.dudas); $('viSecInterp').hidden = false; V.res[task] = d;
    V.ultimo = [d.resultado, ...(d.que_puede_hacer || [])].filter(Boolean).join('\n'); $('viSecInterp').focus({ preventScroll: false }); $('viSecInterp').scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  // ───────── acciones ─────────
  async function analizar() {
    if (!V) return; const d = await pedir('describe', '', estadoEd); if (!d) return;
    mostrarResultado(); pintarVisto(d); estado('Listo. Esto es lo que la IA vio; puede equivocarse. Tu imagen original está arriba.');
    $('viSecVisto').focus({ preventScroll: false }); $('viSecVisto').scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  async function tarea(task, pregunta) {
    if (!V) return; if (task !== 'ask' && V.res[task]) { pintarInterp(task, V.res[task]); estado('Esta es la respuesta que ya tenías.'); return; }
    const d = await pedir(task, pregunta); if (d) { pintarInterp(task, d); estado('Listo. La interpretación de la IA está separada de lo que se ve en la imagen.'); }
  }
  function escuchar(t, aviso) { if (!t) return; estado(UI().speak(t) ? aviso : 'Este navegador no puede leer en voz alta.'); }
  $('enVision').addEventListener('click', () => abrir());
  $('viAnalizar').addEventListener('click', analizar);
  $('viCancelar').addEventListener('click', () => { limpiar(); E().irA('res'); });
  $('viBtnQue').addEventListener('click', () => { if (V && V.res.describe) { $('viSecVisto').hidden = false; $('viSecVisto').focus(); $('viSecVisto').scrollIntoView({ block: 'start', behavior: 'auto' }); estado('Esto fue lo que la IA vio en tu imagen.'); } });
  $('viBtnFacil').addEventListener('click', () => tarea('easy')); $('viBtnSignifica').addEventListener('click', () => tarea('meaning'));
  $('viBtnPreguntar').addEventListener('click', () => { if (!V) return; $('viPanelPregunta').hidden = false; $('viPanelPregunta').focus(); $('viPregInput').focus(); });
  $('viPregForm').addEventListener('submit', (e) => { e.preventDefault(); tarea('ask', $('viPregInput').value); });
  $('viBtnEscuchar').addEventListener('click', () => V && escuchar(V.ultimo, 'Leyendo la última respuesta de la IA.'));
  $('viBtnPictos').addEventListener('click', () => { if (!V || !V.ultimo) return; G() && G().desviar('cuento', 'entendervision'); window.ClariaCuento.abrir(V.ultimo.slice(0, 3000)); });
  $('viOtraParte').addEventListener('click', () => { if (!V) return; V.consentKey = ''; $('viResultado').hidden = true; $('viEditar').hidden = false; V.res = {}; ['viSecVisto', 'viSecInterp', 'viPanelPregunta'].forEach((id) => { $(id).hidden = true; }); setModo('parte'); $('viEstadoEd').textContent = ''; $('viEnviado').textContent = ''; E().irA('vision'); });
  $('viBorrar').addEventListener('click', () => { limpiar(); E().irA('res'); UI().announce('Se borró el análisis de la imagen de la pantalla.'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) try { speechSynthesis.cancel(); } catch (_) {} });

  window.ClariaVision = { abrir, limpiar, estado: () => (V ? { modo: V.modo, region: V.region, tapados: V.tapados.length, res: Object.keys(V.res), enviado: V.enviado || null } : null) };
})();
