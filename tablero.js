/* CLARIA · Hablar con imágenes (etapa 2): tablero de comunicación con pictogramas ARASAAC del diccionario verificado.
   - Solo usa pictogramas de data/pictogramas.json (IDs verificados); no busca en servicios externos ni elige "el primer resultado".
   - Dice en voz alta la FRASE COMPLETA (texto editable), no solo los conceptos. La voz nunca arranca sola.
   - Guardar frases: solo en este dispositivo (localStorage). Compartir imagen: PNG generado en el dispositivo. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const G = () => window.ClariaGuia;
  const KEY = 'claria.frases.v1', MAX_TARJ = 12, MAX_GUARDADAS = 30;
  const el = (t, a = {}, k = []) => { const n = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'text') n.textContent = v; else n.setAttribute(x, v); } [].concat(k).forEach((c) => c && n.append(c)); return n; };
  let datos = null, dic = null, porLema = new Map(), cat = null, frase = [], manual = false, cambiando = -1, listo = null, ctx = null, desdeBtn = null;
  const CC = () => window.ClariaCiudad;
  const tts = 'speechSynthesis' in window;

  const tarjeta = (lema) => { const e = porLema.get(lema); return e ? { lema, id: e.id, src: `assets/picto/${e.id}.png` } : null; };
  // Tarjeta de una frase institucional: {lema,id,estado} del Paquete Maestro. Solo con ID presente en el diccionario local.
  const tarjetaDe = (o) => { const e = typeof o === 'string' ? porLema.get(o) : porLema.get(o.lema); if (!e || (o.id && o.id !== e.id)) return null; return { lema: e.lema, id: e.id, src: `assets/picto/${e.id}.png`, generico: Boolean(o.estado && /GENERICO/.test(o.estado)) }; };
  // Concepto PENDIENTE: solo texto (sin imagen), salvo que un editor haya elegido un pictograma.
  function tarjetaPendiente(texto) {
    const r = ctx && CC() ? CC().revision(ctx.id, texto) : null;
    return r ? { lema: texto, id: r.id, src: CC().URL_IMG(r.id), remoto: true, elegido: r.aprobado ? 'elegido por un editor' : 'elegido en este dispositivo, sin aprobar' } : { lema: texto, id: null, src: null, pendiente: true };
  }
  // Imagen con respaldo: si no carga (sin red, archivo faltante), queda el texto, nunca un hueco.
  function imagen(src, clase) { const i = el('img', { src, alt: '', class: clase || '' }); i.addEventListener('error', () => { const t = el('span', { class: 'tb-sin-img', 'aria-hidden': 'true', text: 'sin imagen' }); i.replaceWith(t); }, { once: true }); return i; }
  let ultimoEstado = ''; const estado = (t) => { $('tbEstado').textContent = t === ultimoEstado ? t + '\u200b' : t; ultimoEstado = $('tbEstado').textContent; };
  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const textoAuto = () => frase.length ? capital(frase.map((f) => f.lema).join(' ')) + '.' : '';

  function cargar() {
    if (listo) return listo;
    listo = Promise.all([fetch('data/tablero.json').then((r) => r.json()), fetch('data/pictogramas.json').then((r) => r.json())]).then(([t, d]) => {
      datos = t; dic = d; d.entradas.forEach((e) => porLema.set(e.lema, e)); pintarCategorias(); pintarGuardadas();
    }).catch(() => { listo = null; $('tbCategoriasLista').replaceChildren(el('p', { class: 'pc-note', text: 'No se pudo cargar el tablero. Revisá tu conexión y volvé a intentar.' })); });
    return listo;
  }

  // ───────── pasos ─────────
  const PASOS = { cat: ['tbCategorias', 'tbTitulo', 'tablero'], lista: ['tbCategoria', 'tbCatTitulo', 'tablerocat'], guardadas: ['tbGuardadas', 'tbGuardTitulo', 'tablerofrases'] };
  function paso(n, silencioso) {
    Object.entries(PASOS).forEach(([k, [id]]) => { $(id).hidden = k !== n; });
    const clave = n === 'lista' && ctx ? (ctx.guia || 'ciudadtablero') : PASOS[n][2];
    $('tbCompo').hidden = !(n === 'lista' || (n === 'cat' && frase.length));
    if (!silencioso) G()?.setPantalla(clave);
    const t = $(PASOS[n][1]); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); window.scrollTo({ top: 0 });
  }
  function entrar(conservar) { if (conservar) return; ctx = null; cat = null; cargar().then(() => paso('cat', true)); G()?.setPantalla('tablero'); }
  // Abre el tablero con el contexto de una institución: {id, nombre, aviso, frases, palabras}. La voz y las demás funciones son las mismas.
  function abrirContexto(c) { ctx = c; cat = { id: c.id, nombre: c.nombre, titulo: c.titulo, contexto: true, aviso: c.aviso, frases: c.frases, palabras: (c.palabras || []).filter((l) => porLema.has(l)) }; frase = []; manual = false; $('tbTexto').value = ''; return cargar().then(() => { pintarCategoria(); pintarFrase(); paso('lista'); }); }
  function irA(n) { cargar().then(() => { if (n !== 'lista') { ctx = null; } if (n === 'lista' && !cat) cat = datos.categorias[0]; if (n === 'lista') pintarCategoria(); paso(n); }); }

  // ───────── categorías, frases rápidas y palabras ─────────
  function miniFila(cards) { const f = el('span', { class: 'tb-mini', 'aria-hidden': 'true' }); cards.forEach((t) => { if (!t) return; f.append(t.src ? imagen(t.src) : el('span', { class: 'tb-pend', text: t.lema })); }); return f; }
  function pintarCategorias() {
    const lista = $('tbCategoriasLista'); lista.replaceChildren();
    datos.categorias.forEach((c) => {
      const b = el('button', { type: 'button', class: 'big-btn tb-cat', 'data-cat': c.id }, [el('span', { class: 'big-ico', 'aria-hidden': 'true', text: c.icono }), el('span', { class: 'big-txt', text: c.nombre })]);
      b.addEventListener('click', () => { ctx = null; cat = c; pintarCategoria(); paso('lista'); }); lista.append(b);
    });
  }
  function tarjetasDeFrase(f) {
    const base = f.tarjetas.map((x) => (typeof x === 'string' ? tarjeta(x) : tarjetaDe(x))).filter(Boolean);
    return base.concat((f.revisar || []).map(tarjetaPendiente));
  }
  function pintarCategoria() {
    $('tbCatTitulo').textContent = cat.titulo || (cat.contexto ? `${cat.nombre}: hablar con imágenes` : cat.nombre);
    $('tbAviso').hidden = !cat.contexto; $('tbAviso').textContent = cat.aviso || '';
    const fr = $('tbFrasesRapidas'); fr.replaceChildren();
    cat.frases.forEach((f) => {
      const cards = tarjetasDeFrase(f); const hablada = cat.contexto ? CC().hablado(f.texto) : f.texto;
      const b = el('button', { type: 'button', class: 'tb-frase-rapida' }, [miniFila(cards), el('span', { text: f.texto })]);
      b.addEventListener('click', () => { frase = cards.map((c) => ({ ...c })); $('tbTexto').value = hablada; manual = true; pintarFrase(); estado(`Frase lista: ${hablada} Tocá «Decir en voz alta» cuando quieras.`); });
      fr.append(el('li', {}, b));
    });
    const pal = $('tbPalabras'); pal.replaceChildren();
    cat.palabras.forEach((l) => {
      const t = tarjeta(l); if (!t) return;
      const b = el('button', { type: 'button', class: 'tb-palabra', 'aria-label': `Agregar ${l}` }, [imagen(t.src), el('span', { text: l })]);
      b.addEventListener('click', () => agregar(t)); pal.append(el('li', {}, b));
    });
  }
  function agregar(t) {
    if (frase.length >= MAX_TARJ) return estado(`Llegaste al máximo de ${MAX_TARJ} tarjetas. Quitá alguna o guardá la frase.`);
    frase.push({ ...t }); cambioTarjetas(); estado(`Agregaste ${t.lema}. Tu frase tiene ${frase.length} tarjeta${frase.length === 1 ? '' : 's'}.`);
  }
  function cambioTarjetas() { if (!manual) $('tbTexto').value = textoAuto(); pintarFrase(); }

  // ───────── frase en construcción ─────────
  function pintarFrase() {
    const ol = $('tbTarjetas'); ol.replaceChildren();
    frase.forEach((f, i) => {
      const bs = el('span', { class: 'tb-acc' });
      const mk = (txt, lab, fn, dis) => { const b = el('button', { type: 'button', 'aria-label': `${lab} ${f.lema}`, text: txt }); if (dis) b.disabled = true; b.addEventListener('click', fn); return b; };
      bs.append(mk('◀', 'Mover antes', () => mover(i, -1), i === 0), mk('▶', 'Mover después', () => mover(i, 1), i === frase.length - 1), mk('Cambiar', 'Cambiar pictograma de', () => abrirCambiar(i)), mk('Quitar', 'Quitar', () => quitar(i)));
      const vis = f.src ? imagen(f.src) : el('span', { class: 'tb-pend tb-pend-grande', text: 'sin pictograma' }); if (f.src) vis.setAttribute('alt', f.lema);
      const marca = f.generico ? el('span', { class: 'tb-chip', text: 'imagen general' }) : f.pendiente ? el('span', { class: 'tb-chip', text: 'por revisar' }) : f.elegido ? el('span', { class: 'tb-chip', text: f.elegido }) : null;
      ol.append(el('li', { class: 'tb-tarjeta' + (f.pendiente ? ' tb-tarjeta-pend' : '') }, [vis, el('span', { class: 'tb-et', text: f.lema }), marca, bs]));
    });
    $('tbVacia').hidden = frase.length > 0;
    ['tbDecir', 'tbMostrar', 'tbGuardar', 'tbCompartir', 'tbVaciar'].forEach((id) => { $(id).disabled = !frase.length && !$('tbTexto').value.trim(); });
    $('tbUsarTarjetas').hidden = !manual || !frase.length || $('tbTexto').value === textoAuto();
    $('tbCompo').hidden = !(frase.length || !$('tbCategoria').hidden);
  }
  function mover(i, d) { const j = i + d; if (j < 0 || j >= frase.length) return; [frase[i], frase[j]] = [frase[j], frase[i]]; cambioTarjetas(); estado(`Moviste ${frase[j].lema}.`); }
  function quitar(i) { const q = frase.splice(i, 1)[0]; cambioTarjetas(); estado(`Quitaste ${q.lema}.`); }
  $('tbTexto').addEventListener('input', () => { manual = true; pintarFrase(); });
  $('tbUsarTarjetas').addEventListener('click', () => { manual = false; $('tbTexto').value = textoAuto(); pintarFrase(); estado('Se usó el texto de las tarjetas.'); });
  $('tbVaciar').addEventListener('click', () => { frase = []; manual = false; $('tbTexto').value = ''; pintarFrase(); estado('Frase vaciada.'); });

  // ───────── cambiar pictograma (solo del diccionario verificado) ─────────
  const norm = (s) => (window.ClariaPictos ? ClariaPictos.normalizar(s) : String(s).toLowerCase());
  function opcionesCambio(termino) {
    const q = norm(termino.trim()); const base = q ? dic.entradas.filter((e) => [e.lema, ...(e.palabras || []), ...(e.formas || [])].some((x) => norm(x).includes(q))) : (cat ? cat.palabras.map((l) => porLema.get(l)).filter(Boolean) : []);
    return base.slice(0, 18);
  }
  function pintarOpciones() {
    const cont = $('tbOpciones'); cont.replaceChildren(); const ops = opcionesCambio($('tbBuscar').value);
    if (!ops.length) cont.append(el('p', { class: 'pc-note', text: 'No hay pictogramas verificados para esa palabra. Probá con otra.' }));
    ops.forEach((e) => { const b = el('button', { type: 'button', class: 'tb-palabra' }, [el('img', { src: `assets/picto/${e.id}.png`, alt: '' }), el('span', { text: e.lema })]); b.addEventListener('click', () => { frase[cambiando] = { lema: e.lema, id: e.id, src: `assets/picto/${e.id}.png` }; $('tbDialogo').close(); cambioTarjetas(); estado(`Cambiaste el pictograma por ${e.lema}.`); }); cont.append(b); });
  }
  function abrirCambiar(i) { cambiando = i; $('tbBuscar').value = ''; $('tbDialogoActual').textContent = `Pictograma actual: ${frase[i].lema}`; pintarOpciones(); $('tbDialogo').showModal(); }
  $('tbBuscar').addEventListener('input', pintarOpciones); $('tbCancelarCambio').addEventListener('click', () => $('tbDialogo').close());

  // ───────── voz (solo cuando la persona lo pide) ─────────
  function voz(t) {
    if (!CC().audio.activo()) { estado('El sonido está desactivado. Podés leer la frase en pantalla o activar el sonido.'); return false; }
    if (!tts) { estado('Este navegador no tiene voz. Podés leer la frase en pantalla o mostrarla a otra persona.'); return false; }
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'es-AR'; u.rate = 0.9;
    const v = (speechSynthesis.getVoices() || []); const es = v.find((x) => x.lang === 'es-AR') || v.find((x) => /^es/i.test(x.lang)); if (es) u.voice = es;
    G()?.estado('hablando'); u.onend = u.onerror = () => G()?.estado('esperando'); speechSynthesis.speak(u); return true;
  }
  $('tbDecir').addEventListener('click', () => { const t = $('tbTexto').value.trim(); if (!t) return estado('Armá una frase primero.'); if (voz(t)) estado('Diciendo la frase en voz alta.'); });

  // ───────── mostrar en pantalla grande / sonido ─────────
  function pintarSonido() { const a = CC().audio.activo(), b = $('tbSonido'); b.textContent = a ? '🔊 Sonido activado' : '🔇 Sonido desactivado'; b.setAttribute('aria-pressed', String(a)); }
  $('tbSonido').addEventListener('click', () => { const a = CC().audio.alternar(); pintarSonido(); estado(a ? 'Sonido activado.' : 'Sonido desactivado: no se dirá nada en voz alta.'); });
  $('tbMostrar').addEventListener('click', () => {
    const t = $('tbTexto').value.trim(); if (!t) return estado('Armá una frase primero.');
    const ol = $('tbMostrarTarjetas'); ol.replaceChildren();
    frase.forEach((f) => ol.append(el('li', {}, [f.src ? imagen(f.src) : el('span', { class: 'tb-pend tb-pend-grande', text: f.lema }), el('span', { class: 'tb-et', text: f.lema })])));
    $('tbMostrarTexto').textContent = t; $('tbMostrarDecir').hidden = !CC().audio.activo(); $('tbMostrarDlg').showModal();
  });
  $('tbMostrarDecir').addEventListener('click', () => voz($('tbTexto').value.trim()));
  $('tbMostrarCerrar').addEventListener('click', () => $('tbMostrarDlg').close());
  pintarSonido();

  // ───────── guardar en el dispositivo ─────────
  function leer() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => x && typeof x.texto === 'string' && Array.isArray(x.tarjetas)) : []; } catch (_) { return []; } }
  function escribir(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch (_) { return false; } }
  $('tbGuardar').addEventListener('click', () => {
    const texto = $('tbTexto').value.trim(); if (!texto) return estado('Armá una frase primero.');
    const a = leer(); const tarjetas = frase.map((f) => f.lema);
    if (a.some((x) => x.texto === texto && x.tarjetas.join('|') === tarjetas.join('|'))) return estado('Esa frase ya estaba guardada.');
    if (a.length >= MAX_GUARDADAS) return estado(`Ya hay ${MAX_GUARDADAS} frases guardadas. Borrá alguna para guardar otra.`);
    a.unshift({ id: Date.now(), texto, tarjetas });
    if (!escribir(a)) return estado('No se pudo guardar en este dispositivo (el navegador lo bloquea). La frase sigue acá para que la uses.');
    pintarGuardadas(); estado('Frase guardada en este dispositivo.');
  });
  function pintarGuardadas() {
    const a = leer(); const ul = $('tbGuardadasLista'); ul.replaceChildren(); $('tbGuardadasVacio').hidden = a.length > 0; $('tbVerGuardadas').textContent = `Mis frases (${a.length})`;
    a.forEach((x) => {
      const li = el('li', { class: 'tb-guardada' }, [miniFila(x.tarjetas), el('p', { class: 'tb-guardada-texto', text: x.texto })]);
      const bs = el('div', { class: 'tb-acc' });
      const mk = (t, lab, fn) => { const b = el('button', { type: 'button', 'aria-label': `${lab}: ${x.texto}`, text: t }); b.addEventListener('click', fn); return b; };
      bs.append(mk('▶ Decir', 'Decir en voz alta', () => voz(x.texto)),
        mk('Usar', 'Usar esta frase', () => { frase = x.tarjetas.map(tarjeta).filter(Boolean); $('tbTexto').value = x.texto; manual = true; if (!cat) cat = datos.categorias[0]; pintarCategoria(); paso('lista'); pintarFrase(); estado('Frase cargada. Podés modificarla.'); }),
        mk('Borrar', 'Borrar', () => { escribir(leer().filter((y) => y.id !== x.id)); pintarGuardadas(); estado('Frase borrada.'); }));
      li.append(bs); ul.append(li);
    });
  }
  $('tbVerGuardadas').addEventListener('click', () => irA('guardadas'));

  // ───────── compartir imagen ─────────
  $('tbCompartir').addEventListener('click', async () => {
    const texto = $('tbTexto').value.trim(); if (!texto) return estado('Armá una frase primero.');
    const b = $('tbCompartir'); b.disabled = true; estado('Preparando la imagen…');
    try {
      const pags = await ClariaExport.dibujarPaginas({ titulo: 'CLARIA · Mi frase', mayus: false, tamano: 200, bloques: [{ texto, fichas: frase.map((f) => ({ orig: f.lema, estado: 'verificado', pic: { src: f.src } })) }] });
      const blob = await ClariaExport.aPNG(pags); const r = await ClariaExport.compartirPNG(blob, 'frase-claria.png', { title: 'Mi frase', text: texto });
      estado(r === 'compartido' ? 'Imagen lista para compartir.' : r === 'cancelado' ? 'Se canceló el envío.' : 'Se descargó la imagen. Revisá que diga lo que querés antes de enviarla.');
    } catch (e) { estado(e && e.name === 'AbortError' ? 'Se canceló el envío.' : 'No se pudo preparar la imagen. Probá de nuevo.'); } finally { b.disabled = false; pintarFrase(); }
  });

  pintarFrase();
  window.ClariaTablero = { entrar, irA, abrirContexto, estado: () => ({ cat: cat && cat.id, tarjetas: frase.map((f) => f.lema), texto: $('tbTexto').value }) };
})();
