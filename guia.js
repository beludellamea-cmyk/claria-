/* CLARIA · Guía: personaje acompañante (4 estados + menú de ayuda), navegación hacia atrás, dictado opcional y pictogramas de apoyo.
   El personaje es una ilustración con animaciones simples. NO hay sincronía labial real ni video: cuando CLARIA «habla», se anima
   un indicador de voz y se muestra el estado con texto. Ningún audio comienza solo: siempre lo activa la persona. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const UI = () => window.ClariaUI || { announce() {}, showView() {}, irPantalla() {} };
  const tts = 'speechSynthesis' in window;

  const PANT = {
    inicio: { q: '¿Qué querés hacer hoy?', explica: 'Tocá uno de los cuatro botones grandes: escribir una frase, leer un documento, hacer un trámite o hablar conmigo.', ayuda: ['Tocá el botón que quieras.', 'Podés volver acá cuando quieras tocando el logo de CLARIA.'] },
    escribir: { q: '¿Qué querés decir?', explica: 'Escribí una palabra, una frase o una oración, o dictala con el micrófono. Después tocá «Convertir a pictogramas». Vas a poder escucharla, modificarla y descargarla.', ayuda: ['Escribí o dictá lo que querés decir.', 'Tocá «Convertir a pictogramas».', 'Tocá una imagen si querés cambiarla.', 'Usá Escuchar, Modificar o Descargar.'] },
    leer1: { q: '¿Qué querés leer?', explica: 'Podés subir un archivo, sacar una foto de un papel o escribir el texto. Elegí una de las tres opciones.', ayuda: ['Subir archivo: TXT, PDF o imagen.', 'Sacar foto: apuntá a un papel con letra clara.', 'Escribir texto: pegalo o escribilo.'] },
    leer2: { q: '¿Cómo querés que te ayude?', explica: 'Escuchar lee el texto en voz alta por partes. Explicar fácil usa inteligencia artificial, solo si está conectada. Ver con pictogramas muestra cada oración con imágenes.', ayuda: ['Escuchar: te lo leo por partes.', 'Explicar fácil: necesita IA conectada.', 'Ver con pictogramas: funciona sin internet.'] },
    leer3: { q: 'Tu texto', explica: 'Acá podés leer el texto por partes y escucharlo. Con «Anterior» y «Siguiente» te movés. Si elegiste explicar, abajo vas a ver la respuesta de la IA, separada del texto original.', ayuda: ['Tocá Escuchar para oírlo.', 'Usá Pausar o Detener cuando quieras.', 'Anterior y Siguiente cambian de parte.'] },
    cuento: { q: 'Tu texto con pictogramas', explica: 'Cada oración aparece completa y debajo sus palabras con pictogramas. Tocá un pictograma para ver qué significa y escucharlo.', ayuda: ['Tocá un pictograma para ver su significado.', 'Escuchar lee la página.', 'Con las flechas del teclado cambiás de página.'] },
    tramites1: { q: '¿Qué trámite necesitás?', explica: 'Tocá la tarjeta del trámite que necesitás. Te muestro los pasos de a uno, con imágenes y la fuente oficial.', ayuda: ['Tocá una tarjeta.', 'Después avanzás paso a paso.', 'Siempre confirmá en el sitio oficial.'] },
    tramites2: { q: 'Paso a paso', explica: 'Cada paso tiene su texto, pictogramas y audio. Con «Siguiente paso» avanzás. La fuente oficial está abajo: confirmá ahí los requisitos actuales.', ayuda: ['Escuchar paso lee el paso actual.', 'Siguiente paso avanza.', 'Abrí la fuente oficial para confirmar.'] },
    hablar: { q: '¿En qué puedo ayudarte?', explica: 'Escribime tu pregunta o dictala. Si no hay IA conectada, respondo con textos preparados y te lo aviso. No escribas datos personales.', ayuda: ['Escribí tu pregunta.', 'O tocá el micrófono para dictar.', 'No compartas DNI, claves ni datos personales.'] },
    acerca: { q: 'Privacidad y créditos', explica: 'Acá está cómo CLARIA cuida tus datos, el estado de la IA y los créditos de los pictogramas.', ayuda: ['Tocá Volver para seguir.'] }
  };
  const ATRAS = { escribir: 'inicio', leer1: 'inicio', leer2: 'leer1', leer3: 'leer2', cuento: 'leer2', tramites1: 'inicio', tramites2: 'tramites1', hablar: 'inicio', acerca: 'inicio' };
  const ESTADOS = { esperando: 'Esperando', escuchando: 'Escuchando…', procesando: 'Pensando…', hablando: 'Hablando' };
  let pantalla = 'inicio', ultimo = null, anterior = 'inicio', activa = null;
  const c = $('claria');

  function estado(nombre) { if (!ESTADOS[nombre]) return; c.dataset.estado = nombre; $('claria-estado-txt').textContent = ESTADOS[nombre]; }
  function setPantalla(k) { if (!PANT[k]) return; if (k !== pantalla) anterior = pantalla; pantalla = k; ultimo = { texto: PANT[k].q }; document.body.dataset.pantalla = k; cerrarTodo(); guiar(k); }

  // ───────── menú y globo ─────────
  const btn = $('claria-btn'), menu = $('claria-menu'), burbuja = $('claria-bubble');
  function abrirMenu(abrir) { if (abrir) burbuja.hidden = true; menu.hidden = !abrir; btn.setAttribute('aria-expanded', String(abrir)); if (abrir) menu.querySelector('button').focus(); }
  function cerrarTodo() { abrirMenu(false); burbuja.hidden = true; }
  function mostrar(texto, lista, chat) {
    ultimo = { texto, lista, chat }; $('claria-bubble-text').textContent = texto;
    const ul = $('claria-bubble-list'); ul.textContent = ''; (lista || []).forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.append(li); });
    $('claria-bubble-chat').hidden = !chat; $('claria-bubble-listen').hidden = !tts; burbuja.hidden = false; burbuja.focus();
  }
  btn.addEventListener('click', () => abrirMenu(menu.hidden));
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ayuda]'); if (!b) return; const a = b.dataset.ayuda; const P = PANT[pantalla]; abrirMenu(false);
    if (a === 'explicame') mostrar(P.explica);
    else if (a === 'repetir') mostrar(ultimo?.texto || P.q, ultimo?.lista, ultimo?.chat);
    else if (a === 'volver') { burbuja.hidden = true; volver(); }
    else if (a === 'ayuda') mostrar('Te cuento cómo seguir:', P.ayuda, pantalla !== 'hablar');
  });
  $('claria-bubble-close').addEventListener('click', () => { burbuja.hidden = true; btn.focus(); });
  $('claria-bubble-chat').addEventListener('click', () => { burbuja.hidden = true; UI().showView('hablar'); });
  $('claria-bubble-listen').addEventListener('click', () => {
    if (!tts || !ultimo) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance([ultimo.texto, ...(ultimo.lista || [])].join('. '));
    u.lang = 'es-AR'; u.rate = .92; const v = speechSynthesis.getVoices(); const es = v.find((x) => x.lang === 'es-AR') || v.find((x) => x.lang?.startsWith('es')); if (es) u.voice = es;
    u.onstart = () => estado('hablando'); u.onend = u.onerror = () => estado('esperando'); speechSynthesis.speak(u);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (!menu.hidden || !burbuja.hidden) { cerrarTodo(); btn.focus(); e.stopPropagation(); }
  }, true);
  document.addEventListener('click', (e) => { if (!menu.hidden && !c.contains(e.target)) abrirMenu(false); });


  // ───────── CLARIA habla y guía (solo si la persona lo activa; nunca arranca sola) ─────────
  // La voz es la del navegador. El movimiento de la cabeza sigue el ritmo de las palabras: es APROXIMADO, no hay sincronía labial real.
  const GUION = {
    inicio: ['¡Hola! Soy CLARIA, y voy a acompañarte. ¿Qué querés hacer hoy? Podés crear con pictogramas, leer y entender, hacer un trámite, o hablar conmigo.', '¿Qué querés hacer hoy?'],
    escribir: ['¿Qué querés decir? Escribilo, o tocá el micrófono y dictámelo. Después tocá convertir, y te lo muestro con pictogramas.', '¿Qué querés decir?'],
    leer1: ['¿Qué querés leer? Podés subir un archivo, sacar una foto, o escribir el texto.', '¿Qué querés leer?'],
    leer2: ['Ya tengo tu texto. ¿Cómo querés que te ayude? Puedo leértelo, explicártelo fácil, o mostrártelo con pictogramas.', '¿Cómo querés que te ayude?'],
    cuento: ['Este es tu texto con pictogramas. Tocá cualquier imagen y te cuento qué significa. Con siguiente, avanzás.', 'Tocá una imagen para ver qué significa.'],
    tramites1: ['¿Qué trámite necesitás? Tocá la tarjeta que corresponda.', '¿Qué trámite necesitás?'],
    hablar: ['Contame, ¿en qué puedo ayudarte? Podés escribirme o dictarme tu pregunta.', '¿En qué puedo ayudarte?'],
    acerca: ['Acá te cuento cómo cuido tus datos y quién hizo los pictogramas.', 'Privacidad y créditos.']
  };
  const REACC = {
    convertido: 'Listo. Mirá: cada palabra tiene su pictograma. Si alguna no te convence, tocala y elegís otra. Después podés escucharla, modificarla o descargarla.',
    descargado: '¡Listo! Ya tenés tu archivo.'
  };
  const BOTONES = [['escribir', /crear con pictogramas/], ['lectura', /leer y entender/], ['tramites', /hacer un tr[aá]mite/], ['hablar', /hablar conmigo/]];
  let vozOn = false; const visitas = {}; let timerSub = null, t0 = null;
  const sub = $('claria-subtitulo');
  function utt(texto) { const u = new SpeechSynthesisUtterance(texto); u.lang = 'es-AR'; u.rate = .95; const v = speechSynthesis.getVoices(); const es = v.find((x) => x.lang === 'es-AR') || v.find((x) => x.lang?.startsWith('es')); if (es) u.voice = es; return u; }
  function resaltar(i) { document.querySelectorAll('#view-inicio .big-btn').forEach((b, k) => b.classList.toggle('resalta', k === i)); }
  function ocultarSub(ms) { clearTimeout(timerSub); timerSub = setTimeout(() => { sub.hidden = true; }, ms); }
  /** Dice una frase con subtítulo. Solo si la voz está activada (o forzar=true tras un toque directo). */
  function decir(texto, o = {}) {
    if (!tts || !texto || (!vozOn && !o.forzar)) return; speechSynthesis.cancel(); clearTimeout(timerSub);
    sub.textContent = texto; sub.hidden = false; const u = utt(texto); const ini = o.resaltarBotones ? BOTONES.map(([, re]) => { const m = re.exec(texto.toLowerCase()); return m ? [m.index, m.index + m[0].length] : null; }) : null;
    u.onstart = () => estado('hablando');
    u.onboundary = (e) => { if (e.name && e.name !== 'word') return; const img = c.querySelector('.claria-img'); img.classList.remove('pulso'); void img.offsetWidth; img.classList.add('pulso');
      if (ini) { const k = ini.findIndex((r) => r && e.charIndex >= r[0] && e.charIndex < r[1]); if (k >= 0) resaltar(k); } };
    u.onend = u.onerror = () => { estado('esperando'); resaltar(-1); ocultarSub(3500); };
    speechSynthesis.speak(u);
  }
  function guiar(k) {
    if (!vozOn || !GUION[k]) return; const n = (visitas[k] = (visitas[k] || 0) + 1);
    clearTimeout(t0); t0 = setTimeout(() => decir(GUION[k][n > 1 ? 1 : 0], { resaltarBotones: k === 'inicio' && n === 1 }), 300);
  }
  function reaccion(clave, texto) { if (!vozOn) return; clearTimeout(t0); t0 = setTimeout(() => decir(texto || REACC[clave]), 250); }
  const bVoz = $('claria-voz');
  function pintarVoz() { if (!tts) return; bVoz.setAttribute('aria-pressed', String(vozOn)); bVoz.textContent = vozOn ? '🔇 Silenciar a CLARIA' : '🔊 Que CLARIA me hable'; }
  function activarVoz(on) {
    vozOn = Boolean(on) && tts; pintarVoz();
    if (vozOn) { visitas[pantalla] = 0; guiar(pantalla); UI().announce('CLARIA va a hablarte. Podés silenciarla cuando quieras.'); }
    else { clearTimeout(t0); if (tts) speechSynthesis.cancel(); sub.hidden = true; resaltar(-1); estado('esperando'); UI().announce('CLARIA en silencio.'); }
  }
  if (!tts) { bVoz.disabled = true; bVoz.textContent = '🔇 Voz no disponible en este navegador'; } else bVoz.addEventListener('click', () => activarVoz(!vozOn));
  pintarVoz();
  // Órdenes por voz en la bienvenida: «quiero leer un documento», «hacer un trámite»…
  const RUTAS = [[/escrib|frase|pictogram|decir|palabra/, 'escribir', 'Vamos a escribir una frase.'], [/le[eé]r|document|texto|pdf|foto|archivo/, 'lectura', 'Vamos a leer un documento.'], [/tr[aá]mite|dni|cud|turno|certificado/, 'tramites', 'Vamos con tu trámite.'], [/habl|charl|pregunt|ayuda|conversar/, 'hablar', 'Hablemos.']];
  function enrutar(texto) {
    const t = texto.toLowerCase(); const r = RUTAS.find(([re]) => re.test(t));
    if (!r) { const m = 'No te entendí bien. Tocá uno de los cuatro botones, o probá de nuevo.'; sub.textContent = m; sub.hidden = false; ocultarSub(5000); UI().announce(m); decir(m); return; }
    UI().showView(r[1]); decir(r[2]);
  }
  function conPermisoMic(cb) {
    let ok = null; try { ok = sessionStorage.getItem('claria.mic'); } catch (_) {} if (ok === 'yes') return cb();
    const d = $('micDialog'); d.returnValue = ''; d.addEventListener('close', () => { if (d.returnValue === 'accept') { try { sessionStorage.setItem('claria.mic', 'yes'); } catch (_) {} cb(); } }, { once: true }); d.showModal();
  }
  const bOir = $('claria-oir');
  if (!SR_OK()) { bOir.disabled = true; bOir.title = 'El micrófono no está disponible en este navegador. Tocá un botón.'; bOir.textContent = '🎤 Decímelo (no disponible acá)'; }
  else bOir.addEventListener('click', () => { if (activa) { activa.stop(); return; } conPermisoMic(() => {
    const r = new (window.SpeechRecognition || window.webkitSpeechRecognition)(); r.lang = 'es-AR'; r.interimResults = false; r.maxAlternatives = 1; estado('escuchando'); bOir.setAttribute('aria-pressed', 'true'); activa = r;
    r.onresult = (e) => enrutar(e.results[0][0].transcript); r.onerror = () => UI().announce('No te pude escuchar. Podés tocar un botón.');
    r.onend = () => { activa = null; bOir.setAttribute('aria-pressed', 'false'); if (c.dataset.estado === 'escuchando') estado('esperando'); };
    try { r.start(); UI().announce('Te escucho. Decime qué querés hacer.'); } catch (_) { r.onend(); } }); });
  function SR_OK() { return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition); }

  // ───────── navegación ─────────
  function volver() { const dest = pantalla === 'acerca' ? (anterior && anterior !== 'acerca' ? anterior : 'inicio') : (ATRAS[pantalla] || 'inicio'); if (tts) speechSynthesis.cancel(); estado('esperando'); UI().irPantalla(dest); }
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', volver));
  function onView(name) {
    document.body.dataset.vista = name; const destino = name === 'inicio' ? $('welcomeSlot') : $('companionDock'); if (c.parentElement !== destino) destino.append(c); cerrarTodo();
  }

  // ───────── dictado opcional (con permiso explícito antes de usar el micrófono) ─────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function dictar(boton, input) {
    if (activa) { activa.stop(); return; }
    const iniciar = () => {
      const r = new SR(); r.lang = 'es-AR'; r.interimResults = false; r.maxAlternatives = 1; const rotulo = boton.dataset.rotulo || boton.textContent;
      boton.dataset.rotulo = rotulo; boton.setAttribute('aria-pressed', 'true'); boton.textContent = '■ Escuchando… tocá para parar'; estado('escuchando');
      r.onresult = (e) => { const t = e.results[0][0].transcript; input.value = ((input.value ? input.value + ' ' : '') + t).trim(); input.focus(); UI().announce('Dictado listo. Revisalo antes de continuar.'); };
      r.onerror = () => UI().announce('El dictado no se completó. Podés escribir.');
      r.onend = () => { activa = null; boton.setAttribute('aria-pressed', 'false'); boton.textContent = rotulo; estado('esperando'); };
      try { r.start(); activa = r; UI().announce('Escuchando. Hablá ahora.'); } catch (_) { r.onend(); UI().announce('No se pudo activar el micrófono.'); }
    };
    let ok = null; try { ok = sessionStorage.getItem('claria.mic'); } catch (_) {}
    if (ok === 'yes') return iniciar();
    const d = $('micDialog'); d.returnValue = '';
    d.addEventListener('close', () => { if (d.returnValue === 'accept') { try { sessionStorage.setItem('claria.mic', 'yes'); } catch (_) {} iniciar(); } }, { once: true });
    d.showModal();
  }
  [['pcDictar', 'pcTexto'], ['micButton', 'chatInput']].forEach(([b, i]) => {
    const bt = $(b); if (!bt) return;
    if (!SR) { bt.disabled = true; bt.title = 'El dictado no está disponible en este navegador. Podés escribir.'; if (b === 'pcDictar') bt.textContent = '🎤 Dictar (no disponible acá)'; }
    else bt.addEventListener('click', () => dictar(bt, $(i)));
  });

  // ───────── pictogramas de apoyo para texto corto (guías de trámites) ─────────
  let motor = null, ticket = 0;
  async function cargarMotor() { if (!motor) motor = ClariaPictos.crearMotor(await (await fetch('data/pictogramas.json')).json()); return motor; }
  /** Muestra solo conceptos VERIFICADOS (sin ambigüedad), sin repetir y hasta 6. Nada se consulta en línea. */
  async function pictosParaTexto(texto, ul) {
    const mi = ++ticket; ul.textContent = ''; ul.hidden = true;
    try { const m = await cargarMotor(); if (mi !== ticket) return; const vistos = new Set();
      m.analizar(texto).tokens.filter((t) => t.estado === 'verificado' && t.pic && t.rol !== 'func' && !vistos.has(t.pic.id) && vistos.add(t.pic.id)).slice(0, 6).forEach((t) => {
        const li = document.createElement('li'); li.className = 'pc-card'; const im = document.createElement('img'); im.className = 'pc-img'; im.alt = ''; im.src = t.pic.src; const s = document.createElement('span'); s.className = 'pc-label'; s.textContent = t.orig.toLowerCase(); li.append(im, s); ul.append(li); });
      ul.hidden = !ul.children.length;
    } catch (_) {}
  }

  window.ClariaGuia = { estado, setPantalla, onView, volver, pictosParaTexto, decir, reaccion, activarVoz, get vozOn() { return vozOn; }, get pantalla() { return pantalla; } };
})();
