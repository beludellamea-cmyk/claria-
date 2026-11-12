/* CLARIA · efectos visuales: partículas, parallax, inclinación 3D de tarjetas, gestos del personaje, chispas.
   Solo presentación: no toca datos ni funciones. Respeta «Reducir animaciones» y prefers-reduced-motion. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const reducido = () => document.body.classList.contains('no-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // ── partículas ──
  const cv = $('cineParticulas'), cx = cv && cv.getContext && cv.getContext('2d');
  let W = 0, H = 0, ps = [], raf = 0, px = 0, py = 0;
  function medir() {
    const d = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
    const n = W < 700 ? 26 : 56; ps = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * .9 + .1, v: Math.random() * .25 + .05, c: Math.random() < .6 ? '25,227,208' : '169,139,255', f: Math.random() * 6.28 }));
  }
  function pintar(t) {
    cx.clearRect(0, 0, W, H);
    for (const p of ps) {
      if (!reducido()) { p.y -= p.v * p.z * 1.4; p.x += Math.sin(t / 1800 + p.f) * .12; if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; } }
      const x = p.x + px * 26 * p.z, y = p.y + py * 16 * p.z, r = 1 + p.z * 2.6;
      const g = cx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, `rgba(${p.c},${.55 * p.z + .15})`); g.addColorStop(1, `rgba(${p.c},0)`); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 4, 0, 6.283); cx.fill();
    }
  }
  function bucle(t) { pintar(t); raf = (reducido() || document.hidden) ? 0 : requestAnimationFrame(bucle); }
  function arrancar() { cancelAnimationFrame(raf); raf = 0; pintar(0); if (!reducido() && !document.hidden) raf = requestAnimationFrame(bucle); }
  if (cx) { medir(); arrancar(); addEventListener('resize', () => { medir(); arrancar(); }); document.addEventListener('visibilitychange', arrancar);
    new MutationObserver(arrancar).observe(document.body, { attributes: true, attributeFilter: ['class'] }); }

  // ── parallax con el puntero ──
  addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; px = (e.clientX / innerWidth - .5) * 2; py = (e.clientY / innerHeight - .5) * 2; root.style.setProperty('--px', px.toFixed(3)); root.style.setProperty('--py', py.toFixed(3)); document.body.style.setProperty('--mx', px.toFixed(3)); }, { passive: true });

  // ── tarjetas: inclinación 3D y brillo que sigue al puntero ──
  document.querySelectorAll('#view-inicio .big-btn').forEach((b, i) => {
    b.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch' || reducido()) return; const r = b.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      b.style.setProperty('--ry', ((x - .5) * 14).toFixed(2) + 'deg'); b.style.setProperty('--rx', ((.5 - y) * 12).toFixed(2) + 'deg'); b.style.setProperty('--lx', (x * 100).toFixed(0) + '%'); b.style.setProperty('--ly', (y * 100).toFixed(0) + '%'); });
    const mira = (v) => { const c = $('claria'); if (c) c.style.setProperty('--inclina', (v * 2.2) + 'deg'); document.body.style.setProperty('--mx', String(v * .6)); };
    const posiciones = [-1, 0, 1, 0];
    b.addEventListener('pointerleave', () => { b.style.setProperty('--rx', '0deg'); b.style.setProperty('--ry', '0deg'); mira(0); });
    b.addEventListener('pointerenter', () => mira(posiciones[i] ?? 0)); b.addEventListener('focus', () => mira(posiciones[i] ?? 0)); b.addEventListener('blur', () => mira(0));
  });

  // ── gestos del personaje ──
  let gt = 0;
  function gesto(n, ms = 1700) { const c = $('claria'); if (!c || reducido()) return; c.dataset.gesto = ''; void c.offsetWidth; c.dataset.gesto = n; clearTimeout(gt); gt = setTimeout(() => { c.dataset.gesto = ''; }, ms); }
  window.ClariaCine = { gesto, chispas };
  setTimeout(() => gesto('saludo'), 900);
  document.addEventListener('click', (e) => { const b = e.target.closest('#view-inicio .big-btn'); if (b) gesto('asiente', 800); });
  new MutationObserver(() => { const c = $('claria'); if (!c || reducido()) return; c.classList.remove('claria-viaja'); void c.offsetWidth; c.classList.add('claria-viaja'); setTimeout(() => c.classList.remove('claria-viaja'), 800); })
    .observe(document.body, { attributes: true, attributeFilter: ['data-vista'] });

  // ── chispas al completar acciones ──
  function chispas(el) {
    if (reducido()) return; const r = (el || document.body).getBoundingClientRect(), x = r.left + r.width / 2, y = Math.min(Math.max(r.top + 40, 80), innerHeight - 80), cols = ['#19e3d0', '#a98bff', '#ffd166', '#ff7ad9'];
    for (let i = 0; i < 16; i++) { const s = document.createElement('span'), a = (i / 16) * 6.283 + Math.random() * .4, d = 50 + Math.random() * 70; s.className = 'cine-chispa'; s.setAttribute('aria-hidden', 'true');
      s.style.cssText = `left:${x}px;top:${y}px;--c:${cols[i % 4]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`; document.body.append(s); setTimeout(() => s.remove(), 1000); }
  }
  const res = $('pcResultado');
  if (res) new MutationObserver(() => { if (!res.hidden) { gesto('celebra', 1000); chispas(res); } }).observe(res, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('click', (e) => { const t = e.target.closest('#pcPng, #pcPdf, #procedureNext'); if (t) chispas(t); });

  // ── pictogramas que aparecen de a uno ──
  function escalonar(ul) { [...ul.children].forEach((li, i) => li.style.setProperty('--i', Math.min(i, 16))); }
  ['pcTablero', 'procedurePictos'].forEach((id) => { const n = $(id); if (n) new MutationObserver(() => n.querySelectorAll('.pc-card').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 16)))).observe(n, { childList: true, subtree: true }); });
})();
