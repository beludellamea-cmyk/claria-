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
  let datos = null, dic = null, porLema = new Map(), cat = null, frase = [], manual = false, cambiando = -1, listo = null;
  const tts = 'speechSynthesis' in window;

  const tarjeta = (lema) => { const e = porLema.get(lema); return e ? { lema, id: e.id, src: `assets/picto/${e.id}.png` } : null; };
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
    $('tbCompo').hidden = !(n === 'lista' || (n === 'cat' && frase.length));
    if (!silencioso) G()?.setPantalla(PASOS[n][2]);
    const t = $(PASOS[n][1]); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); window.scrollTo({ top: 0 });
  }
  function entrar() { cargar().then(() => paso('cat', true)); G()?.setPantalla('tablero'); }
  function irA(n) { cargar().then(() => { if (n === 'lista' && !cat) cat = datos.categorias[0]; if (n === 'lista') pintarCategoria(); paso(n); }); }

  // ───────── categorías, frases rápidas y palabras ─────────
  function miniFila(lemas) { const f = el('span', { class: 'tb-mini', 'aria-hidden': 'true' }); lemas.forEach((l) => { const t = tarjeta(l); if (t) f.append(el('img', { src: t.src, alt: '', loading: 'lazy' })); }); return f; }
  function pintarCategorias() {
    const lista = $('tbCategoriasLista'); lista.replaceChildren();
    datos.categorias.forEach((c) => {
      const b = el('button', { type: 'button', class: 'big-btn tb-cat', 'data-cat': c.id }, [el('span', { class: 'big-ico', 'aria-hidden': 'true', text: c.icono }), el('span', { class: 'big-txt', text: c.nombre })]);
      b.addEventListener('click', () => { cat = c; pintarCategoria(); paso('lista'); }); lista.append(b);
    });
  }
  function pintarCategoria() {
    $('tbCatTitulo').textContent = cat.nombre;
    const fr = $('tbFrasesRapidas'); fr.replaceChildren();
    cat.frases.forEach((f) => {
      const b = el('button', { type: 'button', class: 'tb-frase-rapida' }, [miniFila(f.tarjetas), el('span', { text: f.texto })]);
      b.addEventListener('click', () => { frase = f.tarjetas.map(tarjeta).filter(Boolean); $('tbTexto').value = f.texto; manual = true; pintarFrase(); estado(`Frase lista: ${f.texto} Tocá «Decir en voz alta» cuando quieras.`); });
      fr.append(el('li', {}, b));
    });
    const pal = $('tbPalabras'); pal.replaceChildren();
    cat.palabras.forEach((l) => {
      const t = tarjeta(l); if (!t) return;
      const b = el('button', { type: 'button', class: 'tb-palabra', 'aria-label': `Agregar ${l}` }, [el('img', { src: t.src, alt: '' }), el('span', { text: l })]);
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
      ol.append(el('li', { class: 'tb-tarjeta' }, [el('img', { src: f.src, alt: f.lema }), el('span', { class: 'tb-et', text: f.lema }), bs]));
    });
    $('tbVacia').hidden = frase.length > 0;
    ['tbDecir', 'tbGuardar', 'tbCompartir', 'tbVaciar'].forEach((id) => { $(id).disabled = !frase.length && !$('tbTexto').value.trim(); });
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
    if (!tts) { estado('Este navegador no tiene voz. Podés leer la frase en pantalla o mostrarla a otra persona.'); return false; }
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'es-AR'; u.rate = 0.9;
    const v = (speechSynthesis.getVoices() || []); const es = v.find((x) => x.lang === 'es-AR') || v.find((x) => /^es/i.test(x.lang)); if (es) u.voice = es;
    G()?.estado('hablando'); u.onend = u.onerror = () => G()?.estado('esperando'); speechSynthesis.speak(u); return true;
  }
  $('tbDecir').addEventListener('click', () => { const t = $('tbTexto').value.trim(); if (!t) return estado('Armá una frase primero.'); if (voz(t)) estado('Diciendo la frase en voz alta.'); });

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
      const blob = await ClariaExport.aPNG(pags); const file = new File([blob], 'frase-claria.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Mi frase', text: texto }); estado('Imagen lista para compartir.'); }
      else { ClariaExport.descargar(blob, 'frase-claria.png'); estado('Se descargó la imagen. Revisá que diga lo que querés antes de enviarla.'); }
    } catch (e) { estado(e && e.name === 'AbortError' ? 'Se canceló el envío.' : 'No se pudo preparar la imagen. Probá de nuevo.'); } finally { b.disabled = false; pintarFrase(); }
  });

  pintarFrase();
  window.ClariaTablero = { entrar, irA, estado: () => ({ cat: cat && cat.id, tarjetas: frase.map((f) => f.lema), texto: $('tbTexto').value }) };
})();
