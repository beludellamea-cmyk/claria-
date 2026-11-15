/* CLARIA · En un espacio público (etapa 3).
   - La información de cada lugar la PROPORCIONA y VALIDA la institución (data/lugares.json). CLARIA no inventa horarios, recorridos ni datos.
   - Un lugar sin 'responsable' y 'actualizado' no se muestra. Los de demostración se rotulan como ficticios.
   - QR: formato CLARIA-LUGAR:<id> (o un enlace con ?lugar=<id>). Solo se acepta un id que exista en el catálogo; nunca se abre el contenido del QR ni se navega a un enlace.
   - La cámara solo se enciende al tocar «Escanear QR», se apaga al terminar o salir. No usa geolocalización. Nada se envía a un servidor.
   - El QR se lee en el dispositivo con jsQR (vendor/jsQR.js, Apache-2.0), que se carga recién al escanear. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const G = () => window.ClariaGuia;
  const el = (t, a = {}, k = []) => { const n = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'text') n.textContent = v; else n.setAttribute(x, v); } [].concat(k).forEach((c) => c && n.append(c)); return n; };
  const tts = 'speechSynthesis' in window;
  let instituciones = [], catalogo = [], porId = new Map(), dic = new Map(), lugar = null, opcion = null, paso = 0, listo = null, stream = null, escaneando = false;
  let ultimo = ''; const estado = (id, t) => { const n = $(id); n.textContent = t === ultimo ? t + '​' : t; ultimo = n.textContent; };
  const fecha = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
  const valido = (l) => l && /^[a-z0-9-]{1,60}$/.test(l.id) && l.nombre && l.responsable && /^\d{4}-\d{2}-\d{2}$/.test(l.actualizado) && Array.isArray(l.opciones) && l.opciones.length;
  const picto = (lema) => { const e = dic.get(lema); return e ? `assets/picto/${e.id}.png` : null; };

  function cargar() {
    if (listo) return listo;
    listo = Promise.all([fetch('data/lugares.json').then((r) => r.json()), fetch('data/pictogramas.json').then((r) => r.json()), window.ClariaCiudad.cargar().catch(() => null)]).then(([l, d, c]) => {
      instituciones = (c && c.instituciones) || [];
      d.entradas.forEach((e) => dic.set(e.lema, e)); catalogo = (l.lugares || []).filter(valido); porId = new Map(catalogo.map((x) => [x.id, x])); pintarInstituciones(); pintarLista();
    }).catch(() => { listo = null; estado('lgEstado', 'No se pudo cargar la lista de lugares. Revisá tu conexión.'); });
    return listo;
  }

  // ───────── pasos ─────────
  const PASOS = { inicio: ['lgInicio', 'lgTitulo', 'lugares'], menu: ['lgMenu', 'lgMenuTitulo', 'lugarmenu'], paso: ['lgPaso', 'lgPasoTitulo', 'lugarpaso'] };
  function ir(n, silencioso) {
    if (n !== 'inicio') detenerCamara();
    Object.entries(PASOS).forEach(([k, [id]]) => { $(id).hidden = k !== n; });
    if (!silencioso) G()?.setPantalla(PASOS[n][2]);
    const t = $(PASOS[n][1]); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); window.scrollTo({ top: 0 });
  }
  function entrar(conservar) { detenerCamara(); $('lgScan').hidden = true; if (conservar) return; lugar = null; opcion = null; $('lgListaBox').hidden = true; $('lgQR').open = false; estado('lgEstado', ''); cargar().then(() => ir('inicio', true)); G()?.setPantalla('lugares'); }
  function irA(n) { cargar().then(() => { if (n !== 'inicio' && !lugar) return ir('inicio'); if (n === 'menu') pintarMenu(); ir(n); }); }
  function salir() { detenerCamara(); if (tts) speechSynthesis.cancel(); }

  // ───────── elegir lugar ─────────
  function pintarLista() {
    const ul = $('lgListaLugares'); ul.replaceChildren();
    const vis = catalogo.filter((l) => !l.oculto); $('lgLista').hidden = !vis.length;
    vis.forEach((l) => { const b = el('button', { type: 'button', class: 'big-btn lg-lugar' }, [el('span', { class: 'big-txt', text: l.nombre }), l.demostracion ? el('span', { class: 'lg-chip', text: 'Ejemplo ficticio' }) : null]); b.addEventListener('click', () => elegir(l)); ul.append(el('li', {}, b)); });
    
  }
  // ───────── las seis instituciones (Paquete Maestro) ─────────
  const CIUDAD = () => window.ClariaCiudad;
  function pintarInstituciones() {
    const ul = $('lgInstituciones'); ul.replaceChildren();
    if (!instituciones.length) { ul.append(el('li', { class: 'pc-note', text: 'No se pudo cargar la lista de instituciones. Revisá tu conexión.' })); return; }
    instituciones.forEach((i) => {
      const ok = CIUDAD().confirmada(i);
      const b = el('button', { type: 'button', class: 'big-btn lg-lugar', 'data-inst': i.id }, [el('span', { class: 'big-ico', 'aria-hidden': 'true', text: i.icono }), el('span', { class: 'big-txt', text: i.nombre }), ok ? null : el('span', { class: 'lg-chip', text: 'Datos por confirmar' })]);
      b.addEventListener('click', () => elegirInstitucion(i)); ul.append(el('li', {}, b));
    });
  }
  function opcionesInstitucion(i) {
    const f = i.ficha || {};
    const servicios = String(f.servicios_confirmados || '').split(/[|;]/).map((x) => x.trim()).filter(Boolean);
    const dir = String(f.direccion_confirmada || '').trim();
    const hor = String(f.horario_confirmado || '').trim();
    const tel = String(f.telefono_confirmado || '').trim();
    const correo = String(f.correo_electronico || '').trim();
    const llegar = [
      dir && `Dirección: ${dir}`,
      hor && `Horario: ${hor}`,
      tel && `Teléfono: ${tel}`,
      correo && `Correo electrónico: ${correo}`,
    ].filter(Boolean).join('. ');
    const orientacion = Array.isArray(f.orientacion_comunitaria) ? f.orientacion_comunitaria : [];
    return [
      { tipo: 'info', titulo: 'Qué puedo consultar',
        picto: 'información',
        texto: servicios.length ? `En ${i.nombre} podés consultar: ${servicios.join('; ')}.` : 'Podés pedir información directamente en la institución.',
        enlace: f.fuente_oficial_url },
      { tipo: 'tablero', titulo: 'Hablar con imágenes' },
      { tipo: 'info', titulo: 'Cómo llegar y contactar',
        picto: 'dirección',
        texto: llegar || `Consultá la ubicación y las formas de contacto en la página de ${i.nombre}.`,
        mapa: i.id === 'pami' ? 'PAMI El Colorado Formosa Argentina' : dir,
        enlace: f.sitio_web || f.fuente_oficial_url },
      { tipo: 'pasos', titulo: 'Orientación paso a paso',
        pasos: orientacion.length ? orientacion : [{ texto: 'Preguntá al personal cómo hacer tu consulta.', picto: 'preguntar' }],
        aclaracion: 'Estos pasos sirven para orientarte y comunicarte: no reemplazan los requisitos oficiales de un trámite.' },
    ];
  }
  function elegirInstitucion(i) { lugar = { id: i.id, nombre: i.nombre, institucion: i, opciones: opcionesInstitucion(i) }; pintarMenu(); ir('menu'); }
  function abrirTablero() {
    const i = lugar.institucion; window.ClariaUI.showView('tablero', { keep: true });
    window.ClariaTablero.abrirContexto({ id: i.id, nombre: i.nombre, aviso: 'Ayuda para comunicarte: no es un procedimiento oficial.', frases: i.frases, palabras: [] });
  }
  function elegir(l) { lugar = l; pintarMenu(); ir('menu'); }
  function lugarDe(texto) {
    const t = String(texto || '').trim(); const m = /^CLARIA-LUGAR:([a-z0-9-]{1,60})$/i.exec(t) || /[?#&]lugar=([a-z0-9-]{1,60})(?:&|$)/i.exec(t);
    return m ? porId.get(m[1].toLowerCase()) || null : null;
  }
  function resultadoQR(texto) {
    const l = lugarDe(texto);
    if (l) { detenerCamara(); $('lgScan').hidden = true; estado('lgEstado', `QR reconocido: ${l.nombre}.`); return elegir(l); }
    estado('lgEstado', 'Ese QR no es de un lugar verificado en CLARIA, así que no lo abrí. Podés elegir el lugar de la lista.');
  }
  $('lgLista').addEventListener('click', () => { const b = $('lgListaBox'); b.hidden = !b.hidden; $('lgLista').setAttribute('aria-expanded', String(!b.hidden)); });

  // ───────── lectura de QR (en el dispositivo) ─────────
  function cargarJsQR() {
    if (window.jsQR) return Promise.resolve();
    return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'vendor/jsQR.js'; s.onload = ok; s.onerror = () => mal(new Error('jsqr')); document.head.append(s); });
  }
  function detenerCamara() { escaneando = false; if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } const v = $('lgVideo'); if (v) v.srcObject = null; }
  $('lgEscanear').addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) return estado('lgEstado', 'Este navegador no puede usar la cámara. Subí una foto del QR o elegí el lugar de la lista.');
    try { await cargarJsQR(); } catch (_) { return estado('lgEstado', 'No se pudo cargar el lector de QR. Elegí el lugar de la lista.'); }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
    catch (_) { return estado('lgEstado', 'No se pudo usar la cámara (permiso denegado o sin cámara). Subí una foto del QR o elegí el lugar de la lista.'); }
    const v = $('lgVideo'); v.srcObject = stream; await v.play().catch(() => {}); $('lgScan').hidden = false; escaneando = true; estado('lgEstado', 'Apuntá la cámara al código QR del lugar.');
    const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
    const vuelta = () => { if (!escaneando) return; if (v.videoWidth) { const k = Math.min(1, 640 / v.videoWidth); c.width = v.videoWidth * k; c.height = v.videoHeight * k; x.drawImage(v, 0, 0, c.width, c.height); const r = window.jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height); if (r && r.data) return resultadoQR(r.data); } setTimeout(vuelta, 250); };
    vuelta();
  });
  $('lgCerrarCamara').addEventListener('click', () => { detenerCamara(); $('lgScan').hidden = true; estado('lgEstado', 'Cámara apagada.'); });
  $('lgSubir').addEventListener('click', () => $('lgArchivo').click());
  $('lgArchivo').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      await cargarJsQR(); const bmp = await createImageBitmap(f); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, c.width, c.height); const r = window.jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      if (!r || !r.data) return estado('lgEstado', 'No encontré un código QR en la imagen. Probá con otra foto más clara o elegí el lugar de la lista.'); resultadoQR(r.data);
    } catch (_) { estado('lgEstado', 'No se pudo leer esa imagen. Probá con otra o elegí el lugar de la lista.'); }
  });

  // ───────── menú del lugar ─────────
  function origen() { if (lugar.institucion) { const i = lugar.institucion, f = i.ficha || {}; return i.estado === 'fuente_publica' ? `Datos recopilados de fuentes públicas · Consultadas: ${fecha(f.fecha_verificacion)} · CLARIA no representa a la institución.` : `Datos aportados por la institución · Fuente: ${f.fuente_oficial_url} · Actualizados: ${fecha(f.fecha_verificacion)}`; } return `Información proporcionada por: ${lugar.responsable} · Actualizada: ${fecha(lugar.actualizado)}`; }
  function pintarMenu() {
    $('lgNombre').textContent = lugar.nombre; $('lgDemo').hidden = !lugar.demostracion; $('lgInstNota').hidden = !lugar.institucion; $('lgOrigen').textContent = origen();
    const ul = $('lgOpciones'); ul.replaceChildren();
    lugar.opciones.slice(0, 4).forEach((o) => { const b = el('button', { type: 'button', class: 'big-btn bb-violet' }, el('span', { class: 'big-txt', text: o.titulo })); b.addEventListener('click', () => { if (o.tipo === 'tablero') return abrirTablero(); opcion = o; paso = 0; pintarPaso(); ir('paso'); }); ul.append(el('li', {}, b)); });
  }

  // ───────── guía de la opción ─────────
  function voz(t) {
    if (!CIUDAD().audio.activo()) { estado('lgEstadoPaso', 'El sonido está desactivado. Podés leer la pantalla o mostrársela al personal.'); return false; }
    if (!tts) { estado('lgEstadoPaso', 'Este navegador no tiene voz. Podés leer la pantalla o mostrársela al personal.'); return false; }
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'es-AR'; u.rate = 0.9; const v = speechSynthesis.getVoices() || []; const es = v.find((x) => x.lang === 'es-AR') || v.find((x) => /^es/i.test(x.lang)); if (es) u.voice = es;
    G()?.estado('hablando'); u.onend = u.onerror = () => G()?.estado('esperando'); speechSynthesis.speak(u); return true;
  }
  const img = (lema) => { const s = picto(lema); return s ? el('img', { src: s, alt: lema, class: 'lg-img' }) : null; };
  function pintarPaso() {
    $('lgPasoTitulo').textContent = opcion.titulo; const cont = $('lgPasoContenido'); cont.replaceChildren(); $('lgPasoNav').hidden = true; $('lgAnterior').hidden = false; estado('lgEstadoPaso', '');
    $('lgPasoOrigen').textContent = origen() + (lugar.demostracion ? ' · EJEMPLO FICTICIO' : '');
    if (opcion.tipo === 'pasos') {
      const p = opcion.pasos[paso]; $('lgPasoNav').hidden = false;
      cont.append(el('p', { class: 'lg-num', text: `Paso ${paso + 1} de ${opcion.pasos.length}` }), el('div', { class: 'lg-paso' }, [img(p.picto), el('p', { class: 'lg-texto', text: p.texto })]));
      if (opcion.aclaracion) cont.append(el('p', { class: 'pc-note', text: opcion.aclaracion }));
      $('lgAnterior').disabled = paso === 0; $('lgSiguiente').textContent = paso === opcion.pasos.length - 1 ? 'Listo' : 'Siguiente paso →'; $('lgEscuchar').onclick = () => { if (voz(p.texto)) estado('lgEstadoPaso', 'Leyendo el paso.'); };
    } else if (opcion.tipo === 'info') {
      $('lgPasoNav').hidden = false; $('lgAnterior').hidden = true; $('lgSiguiente').textContent = 'Listo';
      cont.append(el('div', { class: 'lg-paso' }, [img(opcion.picto), el('p', { class: 'lg-texto', text: opcion.texto })]), opcion.aclaracion ? el('p', { class: 'pc-note', text: opcion.aclaracion }) : null, opcion.mapa ? el('a', { class: 'btn btn-soft', href: 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(opcion.mapa), target: '_blank', rel: 'noopener', text: 'Ver en el mapa (se abre otra página)' }) : null, /^https:\/\//.test(opcion.enlace || '') ? el('a', { class: 'btn btn-soft', href: opcion.enlace, target: '_blank', rel: 'noopener', text: 'Consultar información de la fuente' }) : null);
      $('lgEscuchar').onclick = () => { if (voz(opcion.texto)) estado('lgEstadoPaso', 'Leyendo la información.'); };
    } else if (opcion.tipo === 'frases') {
      cont.append(el('p', { class: 'pc-note', text: 'Tocá «Mostrar» para enseñar la frase en pantalla grande, o «Decir» para que se escuche.' }));
      const ul = el('ul', { class: 'tb-lista' });
      opcion.frases.forEach((f) => {
        const mini = el('span', { class: 'tb-mini', 'aria-hidden': 'true' }); f.tarjetas.forEach((l) => { const s = picto(l); if (s) mini.append(el('img', { src: s, alt: '' })); });
        const bs = el('div', { class: 'tb-acc' }); const d = el('button', { type: 'button', text: '▶ Decir', 'aria-label': `Decir en voz alta: ${f.texto}` }); d.addEventListener('click', () => { if (voz(f.texto)) estado('lgEstadoPaso', 'Diciendo la frase.'); });
        const m = el('button', { type: 'button', text: 'Mostrar', 'aria-label': `Mostrar en pantalla grande: ${f.texto}` }); m.addEventListener('click', () => mostrar(f, m)); bs.append(d, m);
        ul.append(el('li', { class: 'tb-guardada' }, [mini, el('p', { class: 'tb-guardada-texto', text: f.texto }), bs]));
      }); cont.append(ul);
    }
  }
  $('lgAnterior').addEventListener('click', () => { if (paso > 0) { paso--; pintarPaso(); } });
  $('lgSiguiente').addEventListener('click', () => { if (opcion.tipo === 'pasos' && paso < opcion.pasos.length - 1) { paso++; pintarPaso(); $('lgPasoTitulo').focus({ preventScroll: true }); } else irA('menu'); });
  let desde = null;
  function mostrar(f, boton) { desde = boton; $('lgMostrarTexto').textContent = f.texto; const p = $('lgMostrarPictos'); p.replaceChildren(); f.tarjetas.forEach((l) => { const i = img(l); if (i) p.append(i); }); $('lgMostrarDlg').showModal(); }
  $('lgMostrarCerrar').addEventListener('click', () => { $('lgMostrarDlg').close(); desde && desde.focus(); });
  $('lgMostrarDecir').addEventListener('click', () => voz($('lgMostrarTexto').textContent));

  document.addEventListener('visibilitychange', () => { if (document.hidden) detenerCamara(); });
  window.ClariaLugares = { entrar, irA, salir, lugarDe: (t) => { const l = lugarDe(t); return l && l.id; } };
})();
