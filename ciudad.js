/* CLARIA · Mi ciudad, más accesible: datos compartidos (tablero, lugares y editor).
   - data/ciudad.json viene del Paquete Maestro (npm run importar). Nada institucional se muestra salvo que la ficha esté
     APROBADA, con fuente y fecha, y en estado «publicado» (confirmada()). Si no: «Información por confirmar».
   - Una elección de pictograma para un concepto pendiente solo vale si la hizo un editor: las aprobadas viven en
     data/ciudad-revisiones.json; las hechas en este dispositivo se marcan «sin aprobar». Nunca se elige un pictograma automáticamente.
   - Preferencia de sonido (sessionStorage): con el sonido desactivado, nada se pronuncia. La voz nunca arranca sola. */
(function () {
  'use strict';
  const LOCAL = 'claria.pictos.revisados.v1', SIN_AUDIO = 'claria.sinaudio';
  let datos = null, aprobadas = [], promesa = null;
  const rd = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (_) { return {}; } };
  const sgl = (txt) => String(txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function cargar() {
    if (promesa) return promesa;
    promesa = Promise.all([fetch('data/ciudad.json').then((r) => r.json()), fetch('data/ciudad-revisiones.json').then((r) => r.json()).catch(() => ({ revisiones: [] }))])
      .then(([d, r]) => { datos = d; aprobadas = (r.revisiones || []).filter((x) => x && x.id && x.concepto && x.revisado_por && x.fecha); return datos; })
      .catch(() => { promesa = null; throw new Error('ciudad'); });
    return promesa;
  }
  const URL_IMG = (id) => `https://static.arasaac.org/pictograms/${id}/${id}_300.png`;
  // Dos procedencias distintas: fuentes públicas revisadas documentalmente y datos aprobados por una institución.
  // «fuente_publica» NUNCA implica que la institución haya revisado o avalado CLARIA.
  function confirmada(i) {
    const f = (i && i.ficha) || {};
    const fuente = /^https:\/\//.test(f.fuente_oficial_url || '');
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(f.fecha_verificacion || '');
    if (!i || !fuente || !fecha) return false;
    if (i.estado === 'fuente_publica') return f.procedencia === 'fuentes_publicas';
    return i.estado === 'publicado' && String(f.revisado_y_aprobado).toUpperCase() === 'SI';
  }
  // Pictograma elegido por un editor para un concepto pendiente (aprobado en el repo o local sin aprobar).
  function revision(institucionId, concepto) {
    const k = sgl(concepto); const ap = aprobadas.find((x) => sgl(x.concepto) === k && (!x.institucion || x.institucion === institucionId));
    if (ap) return { id: ap.id, aprobado: true, por: ap.revisado_por, fecha: ap.fecha };
    const loc = rd(LOCAL); const l = loc[`${institucionId}|${k}`] || loc[`*|${k}`]; return l ? { id: l.id, aprobado: false, por: l.editor || '', fecha: l.fecha } : null;
  }
  function guardarLocal(institucionId, concepto, eleccion) { const o = rd(LOCAL); const k = `${institucionId}|${sgl(concepto)}`; if (eleccion) o[k] = eleccion; else delete o[k]; try { localStorage.setItem(LOCAL, JSON.stringify(o)); return true; } catch (_) { return false; } }
  const locales = () => rd(LOCAL);
  const ACRONIMOS = ['DNI', 'PAMI', 'CUD', 'CUIL', 'CUIT'];
  function hablado(t) { // «NECESITO UN PASAJE.» → «Necesito un pasaje.» (las mayúsculas seguidas se leen letra por letra en algunas voces)
    let s = String(t).toLocaleLowerCase('es'); ACRONIMOS.forEach((a) => { s = s.replace(new RegExp(`\\b${a.toLowerCase()}\\b`, 'g'), a); }); return s.replace(/(^|[¿¡]\s*)([a-záéíóúñ])/u, (m, p, c) => p + c.toLocaleUpperCase('es'));
  }
  const audio = { activo: () => { try { return sessionStorage.getItem(SIN_AUDIO) !== '1'; } catch (_) { return true; } }, alternar() { const n = !this.activo(); try { n ? sessionStorage.removeItem(SIN_AUDIO) : sessionStorage.setItem(SIN_AUDIO, '1'); } catch (_) {} return n; } };
  window.ClariaCiudad = { cargar, datos: () => datos, confirmada, revision, guardarLocal, locales, hablado, audio, URL_IMG, sgl };
})();
