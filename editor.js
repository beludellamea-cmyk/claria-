/* CLARIA · Panel del editor (Mi ciudad, más accesible).
   - Pictogramas pendientes: se buscan en ARASAAC y la persona elige. CLARIA NUNCA elige uno sola. Lo elegido queda en este dispositivo «sin aprobar»;
     para que valga para todos hay que descargar las revisiones y agregarlas a data/ciudad-revisiones.json (con editor y fecha) en el repositorio.
   - Fichas institucionales: se completan y se validan (responsable, fecha, fuente, última revisión, estado). Solo se DESCARGAN: nada se publica solo.
   - No se piden claves ni datos personales. Nada se envía a un servidor propio; la búsqueda consulta api.arasaac.org al tocar «Buscar». */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const G = () => window.ClariaGuia, CC = () => window.ClariaCiudad;
  const el = (t, a = {}, k = []) => { const n = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'text') n.textContent = v; else n.setAttribute(x, v); } [].concat(k).forEach((c) => c && n.append(c)); return n; };
  const API = 'https://api.arasaac.org/v1/pictograms/es/search/';
  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const CAMPOS = [['nombre_oficial', 'Nombre oficial'], ['direccion_confirmada', 'Dirección confirmada'], ['horario_confirmado', 'Horario confirmado'], ['telefono_confirmado', 'Teléfono confirmado'], ['servicios_confirmados', 'Servicios confirmados (separados con |)'], ['fuente_oficial_url', 'Fuente oficial (enlace https://)'], ['fecha_verificacion', 'Fecha de verificación (AAAA-MM-DD)'], ['contacto_responsable', 'Contacto responsable']];
  let datos = null, listo = null, actual = null;
  const nota = (t) => { const n = $('edEstado'); n.textContent = t; };
  function cargar() { if (!listo) listo = CC().cargar().then((d) => { datos = d; pintar(); }).catch(() => { listo = null; nota('No se pudo cargar la información. Revisá tu conexión.'); }); return listo; }
  function entrar() { cargar(); G()?.setPantalla('editor'); }
  const pendientes = () => (datos ? datos.pictogramas.filter((p) => p.estado !== 'VERIFICADO_DICCIONARIO_CLARIA') : []);
  function pintar() {
    const ul = $('edPendientes'); ul.replaceChildren(); const vistos = new Set();
    pendientes().forEach((p) => {
      const k = `${p.institucion}|${p.concepto}`; if (vistos.has(k)) return; vistos.add(k);
      const pend = p.estado === 'PENDIENTE_SELECCION_MANUAL'; const inst = p.institucion === 'COMÚN' ? '*' : slug(p.institucion);
      const r = CC().revision(inst, p.concepto);
      const li = el('li', { class: 'ed-item' }, [el('strong', { text: p.concepto }), el('span', { class: 'lg-chip', text: pend ? 'Sin pictograma' : 'Imagen general: revisar' }), el('span', { class: 'pc-note', text: ` · ${p.institucion}` })]);
      if (r) li.append(el('span', { class: 'pc-note', text: ` · elegido ${r.id} (${r.aprobado ? 'aprobado' : 'sin aprobar'})` }));
      const b = el('button', { type: 'button', class: 'btn btn-soft', text: 'Buscar pictograma', 'aria-label': `Buscar pictograma para ${p.concepto}` }); b.addEventListener('click', () => buscar(p.concepto, inst, li)); li.append(b); ul.append(li);
    });
    $('edResumen').textContent = `${ul.children.length} conceptos por resolver (${pendientes().filter((p) => p.estado === 'PENDIENTE_SELECCION_MANUAL').length} sin pictograma y ${pendientes().filter((p) => p.estado !== 'PENDIENTE_SELECCION_MANUAL').length} con imagen general).`;
    const sel = $('edInst'); if (!sel.options.length) datos.instituciones.forEach((i) => sel.append(el('option', { value: i.id, text: i.nombre }))); formulario();
  }
  async function buscar(concepto, inst, li) {
    let cont = li.querySelector('.ed-res'); if (cont) cont.remove(); cont = el('div', { class: 'ed-res', role: 'group', 'aria-label': `Candidatos para ${concepto}` }); li.append(cont); cont.append(el('p', { class: 'pc-note', text: `Buscando «${concepto}» en ARASAAC…` }));
    try {
      const r = await fetch(API + encodeURIComponent(concepto.toLowerCase()), { headers: { Accept: 'application/json' } });
      if (r.status === 404) { cont.replaceChildren(el('p', { class: 'pc-note', text: 'ARASAAC no devolvió resultados. Probá con una palabra más simple.' })); return; }
      if (!r.ok) throw new Error(r.status); const lista = (await r.json()).filter((p) => !p.violence && !p.sex).slice(0, 12);
      cont.replaceChildren(el('p', { class: 'pc-note', text: lista.length ? 'Tocá el que represente bien el concepto. Se guarda en este dispositivo, sin aprobar.' : 'Sin candidatos.' }));
      lista.forEach((p) => {
        const kw = ((p.keywords || [])[0] || {}).keyword || ''; const b = el('button', { type: 'button', class: 'tb-palabra', 'aria-label': `Elegir pictograma ${p._id} (${kw}) para ${concepto}` }, [el('img', { src: CC().URL_IMG(p._id), alt: '' }), el('span', { text: kw })]);
        b.addEventListener('click', () => { const nombre = $('edEditor').value.trim(); CC().guardarLocal(inst, concepto, { id: p._id, editor: nombre, fecha: new Date().toISOString().slice(0, 10) }); nota(`Elegiste ${p._id} para «${concepto}». Quedó en este dispositivo, sin aprobar.`); pintar(); }); cont.append(b);
      });
    } catch (_) { cont.replaceChildren(el('p', { class: 'pc-note', text: 'No pude conectar con ARASAAC. Probá más tarde; el concepto sigue como texto.' })); }
  }
  $('edDescargarRev').addEventListener('click', () => {
    const nombre = $('edEditor').value.trim(); if (!nombre) return nota('Escribí tu nombre como editor/a antes de descargar las revisiones.');
    const hoy = new Date().toISOString().slice(0, 10); const loc = CC().locales(); const revs = Object.entries(loc).map(([k, v]) => { const [institucion, c] = k.split('|'); const concepto = (datos.pictogramas.find((p) => CC().sgl(p.concepto) === c) || {}).concepto || c; return { id: v.id, concepto, institucion: institucion === '*' ? '' : institucion, revisado_por: nombre, fecha: v.fecha || hoy }; });
    if (!revs.length) return nota('Todavía no elegiste ningún pictograma en este dispositivo.');
    bajar('ciudad-revisiones.json', { version: 1, revisiones: revs }); nota(`Se descargaron ${revs.length} elecciones. Agregalas a data/ciudad-revisiones.json para que valgan para todos.`);
  });
  function bajar(nombre, obj) { const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })), download: nombre }); document.body.append(a); a.click(); a.remove(); }
  // ───────── fichas ─────────
  function formulario() {
    const id = $('edInst').value || datos.instituciones[0].id; actual = datos.instituciones.find((i) => i.id === id); const f = $('edCampos'); f.replaceChildren();
    CAMPOS.forEach(([k, lab]) => { const i = el('input', { type: 'text', id: `ed_${k}`, maxlength: '300' }); i.value = (actual.ficha || {})[k] || ''; f.append(el('label', { for: `ed_${k}`, text: lab }), i); });
    $('edResponsable').value = actual.revision.responsable || ''; $('edFecha').value = actual.revision.fecha || ''; $('edFuente').value = actual.revision.fuente || ''; $('edUltima').value = actual.revision.ultima_revision || ''; $('edAprobado').checked = String((actual.ficha || {}).revisado_y_aprobado).toUpperCase() === 'SI'; $('edEstadoFicha').value = actual.estado || 'borrador'; validar();
  }
  const FECHA = /^\d{4}-\d{2}-\d{2}$/;
  function leerFicha() { const ficha = { ...actual.ficha }; CAMPOS.forEach(([k]) => { ficha[k] = $(`ed_${k}`).value.trim(); }); ficha.revisado_y_aprobado = $('edAprobado').checked ? 'SI' : 'NO'; return { ...actual, estado: $('edEstadoFicha').value, ficha, revision: { responsable: $('edResponsable').value.trim(), fecha: $('edFecha').value.trim(), fuente: $('edFuente').value.trim(), ultima_revision: $('edUltima').value.trim() } }; }
  function problemas(i) {
    const p = [], f = i.ficha || {};
    if (i.estado === 'fuente_publica') {
      if (!/^https:\/\//.test(f.fuente_oficial_url || '')) p.push('Agregá un enlace a la fuente pública.');
      if (!FECHA.test(f.fecha_verificacion || '')) p.push('Agregá la fecha de consulta (AAAA-MM-DD).');
      if (f.procedencia !== 'fuentes_publicas') p.push('Indicá procedencia de fuentes públicas.');
      if (!f.direccion_confirmada && !f.servicios_confirmados) p.push('Incluí al menos dirección o servicios.');
      return p;
    }
    if (!i.revision.responsable) p.push('Falta el responsable de la revisión.');
    if (!FECHA.test(i.revision.fecha)) p.push('Falta la fecha de revisión (AAAA-MM-DD).');
    if (!/^https:\/\//.test(f.fuente_oficial_url || '')) p.push('Falta una fuente (enlace https://).');
    if (!FECHA.test(f.fecha_verificacion || '')) p.push('Falta la fecha de verificación (AAAA-MM-DD).');
    if (!FECHA.test(i.revision.ultima_revision)) p.push('Falta la fecha de la última revisión.');
    if (f.revisado_y_aprobado !== 'SI') p.push('Falta la aprobación de una persona responsable de la institución.');
    return p;
  }
  function validar() {
    const i = leerFicha(), p = problemas(i), quiere = i.estado !== 'borrador', ul = $('edProblemas');
    ul.replaceChildren();
    (quiere ? p : []).forEach((t) => ul.append(el('li', { text: t })));
    $('edValidez').textContent = !quiere
      ? 'Estado: borrador. Se puede guardar incompleto; no se mostrará nada de esta ficha.'
      : p.length ? 'Revisá estos datos antes de descargar la ficha:'
      : i.estado === 'fuente_publica'
        ? 'Ficha con fuentes públicas: no implica aprobación de la institución. Descargala para integrarla al repositorio.'
        : 'Ficha revisada por la institución. Descargala y agregala al repositorio.';
    $('edDescargarFicha').disabled = quiere && p.length > 0;
  }
  ['edCampos', 'edResponsable', 'edFecha', 'edFuente', 'edUltima', 'edAprobado', 'edEstadoFicha'].forEach((id) => $(id).addEventListener('input', validar));
  $('edInst').addEventListener('change', formulario);
  $('edDescargarFicha').addEventListener('click', () => { const i = leerFicha(); if (i.estado !== 'borrador' && problemas(i).length) return; bajar(`ficha-${i.id}.json`, i); nota('Ficha descargada. No se publicó nada: falta que alguien la revise en el repositorio.'); });
  window.ClariaEditor = { entrar };
})();
