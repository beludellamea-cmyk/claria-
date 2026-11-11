/* CLARIA · Exportación a PNG y PDF con los pictogramas reales (se dibuja en <canvas>; sin servicios externos).
   Las imágenes locales son del mismo origen; las elegidas en ARASAAC se cargan con CORS (crossOrigin=anonymous). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClariaExport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 1240, H = 1754, M = 80;
  const FUENTE = 'Verdana, Arial, sans-serif';
  const CREDITO = ['Pictogramas: ARASAAC (arasaac.org) · Autor: Sergio Palao · Origen: ARASAAC, Gobierno de Aragón.',
    'Licencia CC BY-NC-SA 4.0 (uso no comercial) · Generado con CLARIA, proyecto educativo; no es una página oficial.'];

  function cargarImagen(src) {
    return new Promise((res) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
    });
  }
  function partirLineas(ctx, texto, ancho) {
    const pal = texto.split(/\s+/).filter(Boolean); const out = []; let l = '';
    for (const p of pal) { const t = l ? l + ' ' + p : p; if (ctx.measureText(t).width > ancho && l) { out.push(l); l = p; } else l = t; }
    if (l) out.push(l); return out;
  }
  function rect(ctx, x, y, w, h, r, trazo, relleno, discontinuo) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    ctx.setLineDash(discontinuo ? [10, 8] : []); ctx.strokeStyle = trazo; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
  }

  /** opciones: { titulo?, mayus, tamano, bloques:[{texto, fichas:[{orig, estado, pic:{src}|null}]}] }  (o texto+fichas = un solo bloque)
      → Promise<HTMLCanvasElement[]> (páginas A4 a 150 ppp) */
  async function dibujarPaginas(op) {
    const mayus = Boolean(op.mayus), IMG = op.tamano || 200, CARD = IMG + 34; const unico = !op.bloques;
    const bloques = op.bloques || [{ texto: op.texto, fichas: op.fichas }];
    const pag = []; let c, ctx, y; const limite = H - M - 70; const altoCard = IMG + 30 + 56;
    const cache = new Map(); const img = (src) => { if (!cache.has(src)) cache.set(src, cargarImagen(src)); return cache.get(src); };
    const nueva = (primera) => {
      c = document.createElement('canvas'); c.width = W; c.height = H; ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#555'; ctx.font = `20px ${FUENTE}`; CREDITO.forEach((t, i) => ctx.fillText(t, M, H - M + 6 + i * 26));
      y = M; pag.push(c);
      if (primera) { ctx.fillStyle = '#3f2a94'; ctx.font = `bold 30px ${FUENTE}`; ctx.fillText(op.titulo || 'CLARIA · Texto con pictogramas', M, y + 30); y += 70; }
    };
    nueva(true);
    for (const b of bloques) {
      const tam = unico ? 40 : 34, lh = unico ? 56 : 48;
      ctx.font = `bold ${tam}px ${FUENTE}`; const lineas = partirLineas(ctx, mayus ? b.texto.toUpperCase() : b.texto, W - 2 * M);
      if (y + lineas.length * lh + altoCard > limite) nueva(false);
      ctx.fillStyle = '#000'; ctx.font = `bold ${tam}px ${FUENTE}`; for (const l of lineas) { ctx.fillText(l, M, y + tam); y += lh; }
      y += 16;
      if (unico) { ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); y += 30; }
      const imgs = await Promise.all(b.fichas.map((f) => (f.pic ? img(f.pic.src) : null)));
      ctx.font = 'bold 32px ' + FUENTE;
      const tarjetas = b.fichas.map((f, i) => {
        const etiqueta = mayus ? f.orig.toUpperCase() : f.orig; const soloTexto = !f.pic || (!imgs[i] && f.estado === 'func');
        const w = soloTexto ? Math.max(70, Math.ceil(ctx.measureText(etiqueta).width) + 36) : CARD;
        return { f, im: imgs[i], etiqueta, w, soloTexto };
      });
      let x = M, fila = [];
      const volcar = () => {
        if (!fila.length) return; if (y + altoCard > limite) nueva(false);
        fila.forEach((t) => {
          const yy = t.soloTexto ? y + altoCard - 70 : y; const hh = t.soloTexto ? 70 : altoCard;
          rect(ctx, t.x, yy, t.w, hh, 18, t.f.estado === 'elegido' ? '#7a62dc' : '#bbb', '#fff', t.soloTexto || t.f.estado === 'sin' || t.f.estado === 'texto');
          if (!t.soloTexto) {
            if (t.im) { const e = Math.min(IMG / t.im.width, IMG / t.im.height); const w = t.im.width * e, h = t.im.height * e; ctx.drawImage(t.im, t.x + (t.w - w) / 2, yy + 14 + (IMG - h) / 2, w, h); }
            else { ctx.fillStyle = '#888'; ctx.font = `20px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText('sin imagen', t.x + t.w / 2, yy + 14 + IMG / 2); ctx.textAlign = 'left'; }
          }
          ctx.fillStyle = '#000'; ctx.font = `bold 32px ${FUENTE}`; ctx.textAlign = 'center';
          let tm = 32; while (ctx.measureText(t.etiqueta).width > t.w - 12 && tm > 16) { tm -= 2; ctx.font = `bold ${tm}px ${FUENTE}`; }
          ctx.fillText(t.etiqueta, t.x + t.w / 2, t.soloTexto ? yy + 46 : yy + IMG + 52); ctx.textAlign = 'left';
        });
        y += altoCard + 24; fila = []; x = M;
      };
      for (const t of tarjetas) { if (x + t.w > W - M && fila.length) volcar(); t.x = x; fila.push(t); x += t.w + 20; }
      volcar(); y += unico ? 0 : 16;
    }
    return pag;
  }

  function blobDe(canvas, tipo, calidad) { return new Promise((res) => canvas.toBlob(res, tipo, calidad)); }
  async function aPNG(paginas) {
    if (paginas.length === 1) return blobDe(paginas[0], 'image/png');
    const t = document.createElement('canvas'); t.width = W; t.height = H * paginas.length; const x = t.getContext('2d');
    paginas.forEach((p, i) => x.drawImage(p, 0, i * H)); return blobDe(t, 'image/png');
  }
  function b64(dataUrl) { const s = atob(dataUrl.split(',')[1]); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

  /** armarPDF([{jpeg:Uint8Array, w, h}]) → Uint8Array. PDF mínimo A4 con una imagen JPEG por página. */
  function armarPDF(paginas) {
    const enc = new TextEncoder(); const partes = []; const offs = []; let largo = 0;
    const push = (d) => { const u = typeof d === 'string' ? enc.encode(d) : d; partes.push(u); largo += u.length; };
    const obj = (n, cuerpo) => { offs[n] = largo; push(`${n} 0 obj\n`); cuerpo(); push('\nendobj\n'); };
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'.replace(/[\u0080-￿]/g, '?'));
    const n = paginas.length; const kids = paginas.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
    paginas.forEach((p, i) => {
      const pg = 3 + i * 3, ct = pg + 1, im = pg + 2;
      obj(pg, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`));
      const flujo = `q 595.28 0 0 841.89 0 0 cm /Im0 Do Q`;
      obj(ct, () => push(`<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`));
      obj(im, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`); push(p.jpeg); push('\nendstream'); });
    });
    const total = 3 + n * 3; const xref = largo;
    push(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let i = 1; i < total; i++) push(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    push(`trailer\n<< /Size ${total} /Root 1 0 R /Info << /Title (CLARIA - Texto con pictogramas) /Producer (CLARIA) >> >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(largo); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; } return out;
  }
  function aPDF(paginas) {
    const js = paginas.map((c) => ({ jpeg: b64(c.toDataURL('image/jpeg', 0.92)), w: c.width, h: c.height }));
    return new Blob([armarPDF(js)], { type: 'application/pdf' });
  }
  function descargar(blob, nombre) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  return { dibujarPaginas, aPNG, aPDF, armarPDF, descargar, CREDITO, cargarImagen };
});
