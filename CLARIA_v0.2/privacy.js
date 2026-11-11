/* CLARIA · Protección de datos personales (compartido navegador + Worker).
   Oculta patrones que parecen DNI, CUIL/CUIT, correos, claves, números largos (tarjetas/CBU/teléfonos).
   LÍMITES: es una red de seguridad por patrones, no un detector perfecto. No reconoce nombres, direcciones
   ni teléfonos escritos con espacios. La advertencia al usuario sigue siendo necesaria. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClariaPrivacy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function redact(input, opts) {
    const strict = Boolean(opts && opts.strict);
    let text = String(input == null ? '' : input);
    const kinds = new Set();
    let count = 0;
    const apply = (kind, re, replacer) => {
      text = text.replace(re, (...args) => { kinds.add(kind); count += 1; return replacer(...args); });
    };
    apply('correo', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => '[correo oculto]');
    apply('cuil', /\b(?:20|23|24|25|26|27|30|33|34)[-\s]?\d{8}[-\s]?\d\b/g, () => '[CUIL/CUIT oculto]');
    apply('credencial', /\b(clave|contraseña|contrasena|password|pin|token)(\s*(?:es|:|=)\s*)(\S+)/gi, (m, k, sep) => `${k}${sep}[dato oculto]`);
    apply('identificador', /\b(dni|d\.n\.i\.?|documento|cuil|cuit|cbu|cvu|tarjeta|código|codigo)(\s*(?:n[º°o]\.?|número|numero|#)?\s*[:=]?\s*)((?=[A-Za-z0-9.\-]*\d)[A-Za-z0-9][A-Za-z0-9.\-]{3,})/gi, (m, k, sep) => `${k}${sep}[dato oculto]`);
    apply('numero', /\b\d{9,22}\b/g, () => '[número oculto]');
    if (strict) {
      apply('dni', /\b\d{1,2}\.\d{3}\.\d{3}\b/g, () => '[número oculto]');
      apply('dni', /\b\d{7,8}\b/g, () => '[número oculto]');
    }
    return { text, count, kinds: Array.from(kinds) };
  }
  return { redact };
});
