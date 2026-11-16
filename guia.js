/* CLARIA · Guía: personaje acompañante (4 estados + menú de ayuda), navegación hacia atrás, dictado opcional y pictogramas de apoyo.
   El personaje es una ilustración con animaciones simples. NO hay sincronía labial real ni video: cuando CLARIA «habla», se anima
   un indicador de voz y se muestra el estado con texto. Ningún audio comienza solo: siempre lo activa la persona. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const UI = () => window.ClariaUI || { announce() {}, showView() {}, irPantalla() {} };
  const tts = 'speechSynthesis' in window;

  const PANT = {
    inicio: { q: '¿Qué querés hacer hoy?', explica: 'Tocá uno de los botones grandes: entender una foto, una captura o un documento, decilo con pictogramas, estoy en un lugar público, entender un trámite o hablar conmigo.', ayuda: ['Tocá el botón que quieras.', 'Podés volver acá cuando quieras tocando el logo de CLARIA.'] },
    decilo: { q: 'Decilo con pictogramas', explica: 'Elegí cómo querés comunicarte. Con «Escribir y mostrar» escribís una frase y yo la muestro con pictogramas para que otra persona la vea. Con «Elegir imágenes para hablar» armás la frase tocando pictogramas y la digo en voz alta.', ayuda: ['Escribir y mostrar: vos escribís, la otra persona mira.', 'Elegir imágenes para hablar: vos elegís imágenes, yo hablo.', 'Podés volver y probar la otra opción.'] },
    escribir: { q: '¿Qué querés decir?', explica: 'Escribí una palabra, una frase o una oración, o dictala con el micrófono. Después tocá «Convertir a pictogramas». Vas a poder escucharla, modificarla y descargarla.', ayuda: ['Escribí o dictá lo que querés decir.', 'Tocá «Convertir a pictogramas».', 'Tocá una imagen si querés cambiarla.', 'Tocá «Mostrar a otra persona» para verla en pantalla grande.'] },
    leer1: { q: '¿Qué querés leer?', explica: 'Podés subir un archivo, sacar una foto de un papel o escribir el texto. Elegí una de las tres opciones.', ayuda: ['Subir archivo: TXT, PDF o imagen.', 'Sacar foto: apuntá a un papel con letra clara.', 'Escribir texto: pegalo o escribilo.'] },
    leerfoto: { q: '¿Esta es la imagen correcta?', explica: 'Mirá la imagen que elegiste. Si es la correcta, tocá «Sí, leer el texto». CLARIA lee el texto en tu dispositivo y la imagen no se envía a ningún servidor.', ayuda: ['Sí, leer el texto: empieza la lectura.', 'Elegir otra imagen: probás con otra foto.', 'Escribir el texto yo: lo tipeás vos.'] },
    leerrevisar: { q: 'Revisá el texto', explica: 'Este es el texto que CLARIA reconoció en la imagen. Puede tener errores, sobre todo en números, fechas y horas. Compará con la imagen, corregilo si hace falta y tocá «Usar este texto».', ayuda: ['Compará el texto con la imagen.', 'Corregí lo que esté mal.', 'Usar este texto: seguís al siguiente paso.', 'Si falló, leé la imagen de nuevo o escribilo vos.'] },
    leer2: { q: '¿Cómo querés que te ayude?', explica: 'Escuchar lee el texto en voz alta por partes. Explicar fácil y ¿Qué hago ahora? usan inteligencia artificial, solo si está conectada. Ver con pictogramas muestra cada oración con imágenes.', ayuda: ['Escuchar: te lo leo por partes.', 'Explicar fácil: necesita IA conectada.', '¿Qué hago ahora?: necesita IA conectada.', 'Ver con pictogramas: funciona sin internet.'] },
    leer3: { q: 'Tu texto', explica: 'Acá podés leer el texto por partes y escucharlo. Con «Anterior» y «Siguiente» te movés. Si elegiste explicar, abajo vas a ver la respuesta de la IA, separada del texto original.', ayuda: ['Tocá Escuchar para oírlo.', 'Usá Pausar o Detener cuando quieras.', 'Anterior y Siguiente cambian de parte.'] },
    cuento: { q: 'Tu texto con pictogramas', explica: 'Cada oración aparece completa y debajo sus palabras con pictogramas. Tocá un pictograma para ver qué significa y escucharlo.', ayuda: ['Tocá un pictograma para ver su significado.', 'Escuchar lee la página.', 'Con las flechas del teclado cambiás de página.'] },
    tramites1: { q: '¿Qué trámite necesitás?', explica: 'Tocá la tarjeta del trámite que necesitás. Te muestro los pasos de a uno, con imágenes y la fuente oficial.', ayuda: ['Tocá una tarjeta.', 'Después avanzás paso a paso.', 'Siempre confirmá en el sitio oficial.'] },
    tramites2: { q: 'Paso a paso', explica: 'Cada paso tiene su texto, pictogramas y audio. Con «Siguiente paso» avanzás. La fuente oficial está abajo: confirmá ahí los requisitos actuales.', ayuda: ['Escuchar paso lee el paso actual.', 'Siguiente paso avanza.', 'Abrí la fuente oficial para confirmar.'] },
    hablar: { q: '¿En qué puedo ayudarte?', explica: 'Escribime tu pregunta o dictala. Si no hay IA conectada, respondo con textos preparados y te lo aviso. No escribas datos personales.', ayuda: ['Escribí tu pregunta.', 'O tocá el micrófono para dictar.', 'No compartas DNI, claves ni datos personales.'] },
    tablero: { q: '¿Qué necesitás decir?', explica: 'Elegí un tema: ayuda, salud, escuela, transporte, compras o necesidades básicas. Después armás tu frase con imágenes y CLARIA la dice en voz alta.', ayuda: ['Tocá un tema.', 'Con Mis frases ves las que guardaste.'] },
    editor: { q: 'Panel del editor', explica: 'Para quienes revisan la información: elegí pictogramas para los conceptos pendientes y completá las fichas de cada institución. Nada se publica solo.', ayuda: ['Buscar pictograma: ARASAAC te muestra candidatos.', 'Lo que elegís queda sin aprobar hasta que se revise.', 'Las fichas se descargan; no se publican desde acá.'] },
    entender1: { q: '¿Qué querés que te explique?', explica: 'Sacá una foto, subí una imagen o un documento (PDF o texto) y CLARIA te cuenta qué dice, qué fechas y lugares aparecen y qué tenés que hacer. La imagen se lee en tu dispositivo y no se envía.', ayuda: ['Sacar foto: de frente, con buena luz.', 'Subir imagen: una foto o captura que ya tengas.', 'Subir documento: un PDF o un archivo de texto.', 'Si no se lee bien, te aviso y no invento nada.'] },
    entenderlee: { q: 'Estoy leyendo tu documento', explica: 'Estoy leyendo el texto en tu dispositivo. Puede tardar un poco la primera vez. Podés cancelar cuando quieras.', ayuda: ['Esperá un momento.', 'Cancelar: no se guarda nada.'] },
    entenderres: { q: 'Esto es lo que encontré', explica: 'Arriba está tu documento original y abajo lo que CLARIA entendió, separado. Elegí una opción: qué dice exactamente, explicarlo fácil, qué tenés que hacer, escucharlo, verlo con pictogramas o hacer preguntas.', ayuda: ['Qué dice exactamente: el texto tal cual, con lo dudoso marcado.', 'Explicámelo fácil y Qué tengo que hacer usan IA, con tu permiso.', 'Escuchar: lee la explicación en voz alta.', 'Responder con pictogramas: armás tu respuesta.'] },
    entendervision: { q: 'Mirar la imagen con IA', explica: 'Acá la IA mira la imagen y te cuenta qué aparece. A diferencia de la lectura del texto, esto envía la imagen, así que antes podés elegir una parte o tapar lo privado, y te pido permiso. La respuesta queda separada de tu imagen original.', ayuda: ['Elegí toda la imagen, una parte, o tapá lo privado.', 'Tocá enviar y aceptá el permiso si querés.', 'Después podés pedir una explicación fácil, escucharla o verla con pictogramas.'] },
    entendertablero: { q: 'Armá tu respuesta', explica: 'Elegí una frase con pictogramas para responder, y tocá Decir en voz alta o Mostrar en pantalla grande cuando quieras.', ayuda: ['Frase rápida: ya viene armada.', 'Decir: se escucha solo si lo tocás.', 'Mostrar: la enseñás a otra persona.'] },
    ciudadtablero: { q: 'Hablar con imágenes', explica: 'Son frases para comunicarte en este lugar. Tocá una frase y después Decir en voz alta o Mostrar en pantalla grande. No son un procedimiento oficial.', ayuda: ['Frase rápida: ya viene armada.', 'Decir: se escucha solo si lo tocás.', 'Mostrar: la enseñás al personal.', 'Sonido: lo podés apagar.'] },
    tablerocat: { q: 'Armá tu frase', explica: 'Tocá una frase rápida o las palabras con imágenes. Abajo ves tu frase: podés mover, cambiar o quitar tarjetas. Tocá Decir en voz alta cuando quieras.', ayuda: ['Frase rápida: ya viene armada.', 'Palabras: tocalas para sumarlas.', 'Decir en voz alta: yo la leo completa.', 'Guardar o compartir imagen, si querés.'] },
    tablerofrases: { q: 'Mis frases', explica: 'Acá están las frases que guardaste en este dispositivo. Podés decirlas, usarlas de nuevo o borrarlas.', ayuda: ['Decir: la leo en voz alta.', 'Usar: la cargo para modificarla.', 'Borrar: la saco de este dispositivo.'] },
    lugares: { q: '¿Dónde estás?', explica: 'Podés escanear el código QR del lugar, subir una foto del QR o elegir el lugar de la lista. Solo aparecen lugares con información cargada y validada por su institución.', ayuda: ['Escanear QR: enciende la cámara solo si lo tocás.', 'Subir foto del QR: si ya tenés la imagen.', 'Elegir de la lista: sin cámara.'] },
    lugarmenu: { q: '¿Qué necesitás?', explica: 'Elegí qué necesitás hacer en este lugar. La información la da la institución: fijate quién la proporciona y cuándo se actualizó.', ayuda: ['Tocá una opción.', 'Si es un ejemplo, lo avisa en pantalla.'] },
    lugarpaso: { q: 'Guía del lugar', explica: 'Seguí un paso por vez. Tocá Escuchar para oírlo y Siguiente paso para avanzar. En Pedir ayuda podés mostrar una frase en pantalla grande o decirla en voz alta.', ayuda: ['Escuchar: lee el paso.', 'Siguiente paso: avanzás.', 'Mostrar: enseñás la frase al personal.'] },
    creador1: { q: '¿Qué trámite querés explicar?', explica: 'Esta parte es para instituciones y docentes. Pegá el texto que te dio el organismo, completá la fuente y la fecha, y CLARIA arma los pasos. No pegues datos personales.', ayuda: ['Pegá el texto del organismo.', 'Completá fuente, fecha y responsable.', 'Armar los pasos: sigue la revisión.'] },
    creador2: { q: 'Revisá cada paso', explica: 'Revisá que cada paso tenga una sola acción y que cada pictograma corresponda. Los dudosos quedan pendientes hasta que los confirmes. Sin pendientes y con la revisión marcada, podés descargar el PDF.', ayuda: ['Un paso, una acción.', 'Revisar o Cambiar: elegís el pictograma.', 'Con pendientes, solo se descarga un borrador.'] },
    acerca: { q: 'Privacidad y créditos', explica: 'Acá está cómo CLARIA cuida tus datos, el estado de la IA y los créditos de los pictogramas.', ayuda: ['Tocá Volver para seguir.'] }
  };
  const ATRAS = { decilo: 'inicio', escribir: 'decilo', leer1: 'inicio', leerfoto: 'leer1', leerrevisar: 'leerfoto', leer2: 'leer1', leer3: 'leer2', cuento: 'leer2', tramites1: 'inicio', tramites2: 'tramites1', hablar: 'inicio', tablero: 'decilo', lugares: 'inicio', editor: 'lugares', entender1: 'inicio', entenderlee: 'entender1', entenderres: 'entender1', entendertablero: 'entenderres', entendervision: 'entenderres', creador1: 'tramites1', creador2: 'creador1', lugarmenu: 'lugares', lugarpaso: 'lugarmenu', tablerocat: 'tablero', ciudadtablero: 'lugarmenu', tablerofrases: 'tablero', acerca: 'inicio' };
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
    inicio: ['¡Hola! Soy CLARIA, y voy a acompañarte. ¿Qué querés hacer hoy? Podés entender una foto, una captura o un documento, decirlo con pictogramas, ver ayuda si estás en un lugar público, entender un trámite, o hablar conmigo.', '¿Qué querés hacer hoy?'],
    decilo: ['¿Cómo querés comunicarte? Podés escribir una frase y mostrarla con pictogramas, o elegir imágenes para que yo hable por vos.', '¿Cómo querés comunicarte?'],
    escribir: ['¿Qué querés decir? Escribilo, o tocá el micrófono y dictámelo. Después tocá convertir, y te lo muestro con pictogramas. Con el botón grande lo mostrás a otra persona.', '¿Qué querés decir?'],
    leer1: ['¿Qué querés leer? Podés subir un archivo, sacar una foto, o escribir el texto.', '¿Qué querés leer?'],
    leerfoto: ['¿Esta es la imagen correcta? Si lo es, tocá leer el texto.', '¿Esta es la imagen correcta?'],
    leerrevisar: ['Revisá el texto. Compará con la imagen y corregí lo que haga falta.', 'Revisá el texto.'],
    leer2: ['Ya tengo tu texto. ¿Cómo querés que te ayude? Puedo leértelo, explicártelo fácil, decirte qué hacer, o mostrártelo con pictogramas.', '¿Cómo querés que te ayude?'],
    tablero: ['¿Qué necesitás decir? Elegí un tema y armamos tu frase con imágenes.', '¿Qué necesitás decir?'],
    editor: ['Panel del editor. Elegí pictogramas pendientes y completá las fichas. Nada se publica solo.', 'Panel del editor.'],
    entender1: ['¿Qué querés que te explique? Podés sacar una foto, subir una imagen o subir un documento.', '¿Qué querés que te explique?'],
    entenderlee: ['Estoy leyendo tu documento. Esperá un momento.', 'Estoy leyendo.'],
    entenderres: ['Ya leí tu documento. Arriba está el original; abajo te cuento qué entendí. Elegí cómo seguir.', 'Ya lo leí. Elegí cómo seguir.'],
    entendervision: ['Acá miro la imagen. Primero elegí si enviás toda la imagen o solo una parte, y tapá lo privado. Después tocá enviar.', 'Elegí qué parte enviar.'],
    entendertablero: ['Armá tu respuesta. Tocá una frase y después decir en voz alta, o mostrala.', 'Armá tu respuesta.'],
    ciudadtablero: ['Hablar con imágenes. Tocá una frase y después decir en voz alta, o mostrala en pantalla grande.', 'Hablar con imágenes.'],
    tablerocat: ['Armá tu frase. Tocá una frase rápida o las palabras, y después tocá decir en voz alta.', 'Armá tu frase.'],
    tablerofrases: ['Estas son las frases que guardaste en este dispositivo.', 'Mis frases.'],
    lugares: ['¿Dónde estás? Podés escanear el código QR del lugar, subir una foto del QR o elegir de la lista.', '¿Dónde estás?'],
    lugarmenu: ['¿Qué necesitás? Elegí una opción. La información la da la institución.', '¿Qué necesitás?'],
    lugarpaso: ['Seguí un paso por vez. Tocá escuchar si querés oírlo.', 'Seguí un paso por vez.'],
    creador1: ['Esta parte es para instituciones. Pegá el texto del organismo y armamos los pasos.', 'Pegá el texto del organismo.'],
    creador2: ['Revisá cada paso. Un paso, una acción, y un pictograma que corresponda.', 'Revisá cada paso.'],
    cuento: ['Este es tu texto con pictogramas. Tocá cualquier imagen y te cuento qué significa. Con siguiente, avanzás.', 'Tocá una imagen para ver qué significa.'],
    tramites1: ['¿Qué trámite necesitás? Tocá la tarjeta que corresponda.', '¿Qué trámite necesitás?'],
    hablar: ['Contame, ¿en qué puedo ayudarte? Podés escribirme o dictarme tu pregunta.', '¿En qué puedo ayudarte?'],
    acerca: ['Acá te cuento cómo cuido tus datos y quién hizo los pictogramas.', 'Privacidad y créditos.']
  };
  const REACC = {
    convertido: 'Listo. Mirá: cada palabra tiene su pictograma. Si alguna no te convence, tocala y elegís otra. Después podés escucharla, modificarla o descargarla.',
    descargado: '¡Listo! Ya tenés tu archivo.'
  };
  const BOTONES = [['decilo', /decilo con pictogramas/], ['escribir', /crear con pictogramas/], ['lectura', /leer y entender/], ['tramites', /hacer un tr[aá]mite/], ['hablar', /hablar conmigo/]];
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
  const RUTAS = [[/escrib|frase|pictogram|decir|palabra|imagen/, 'decilo', 'Vamos a decirlo con pictogramas.'], [/le[eé]r|document|texto|pdf|foto|archivo/, 'lectura', 'Vamos a leer un documento.'], [/tr[aá]mite|dni|cud|turno|certificado/, 'tramites', 'Vamos con tu trámite.'], [/habl|charl|pregunt|ayuda|conversar/, 'hablar', 'Hablemos.']];
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
  const DESVIO = {}; function desviar(k, destino) { if (destino) DESVIO[k] = destino; else delete DESVIO[k]; }
  function volver() { const dest = pantalla === 'acerca' ? (anterior && anterior !== 'acerca' ? anterior : 'inicio') : (DESVIO[pantalla] || ATRAS[pantalla] || 'inicio'); if (tts) speechSynthesis.cancel(); estado('esperando'); UI().irPantalla(dest); }
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

  window.ClariaGuia = { desviar, estado, setPantalla, onView, volver, pictosParaTexto, decir, reaccion, activarVoz, get vozOn() { return vozOn; }, get pantalla() { return pantalla; } };
})();
