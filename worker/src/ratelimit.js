// Límites por persona anónima (huella de IP con hash) y tope diario global.
// Sin RATE_KV: contadores en memoria de cada instancia (aproximados). Con RATE_KV: diarios compartidos.
const mem = { min: new Map(), day: new Map(), cap: new Map() };

async function fingerprint(ip, salt) {
  const data = new TextEncoder().encode(`${salt || 'claria'}|${ip || 'sin-ip'}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf).slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function bump(env, store, key, ttlSec) {
  if (env.RATE_KV) {
    const cur = Number(await env.RATE_KV.get(key)) || 0;
    await env.RATE_KV.put(key, String(cur + 1), { expirationTtl: Math.max(ttlSec, 60) });
    return cur + 1;
  }
  const n = (store.get(key) || 0) + 1; store.set(key, n);
  if (store.size > 5000) store.clear();
  return n;
}

export async function checkLimits(env, ip, now = Date.now()) {
  const perMin = Number(env.RATE_PER_MIN) || 6, perDay = Number(env.RATE_PER_DAY) || 40, cap = Number(env.DAILY_CAP) || 300;
  const fp = await fingerprint(ip, env.IP_SALT);
  const day = new Date(now).toISOString().slice(0, 10);
  const minute = Math.floor(now / 60000);
  // La ventana por minuto siempre es en memoria (barata); lo diario va a KV si existe.
  const nMin = (mem.min.get(`${fp}:${minute}`) || 0) + 1; mem.min.set(`${fp}:${minute}`, nMin);
  if (mem.min.size > 5000) mem.min.clear();
  if (nMin > perMin) return { ok: false, code: 'rate_minute', retryAfter: 60 };
  if (await bump(env, mem.day, `d:${day}:${fp}`, 90000) > perDay) return { ok: false, code: 'rate_day', retryAfter: 3600 };
  if (await bump(env, mem.cap, `c:${day}`, 90000) > cap) return { ok: false, code: 'daily_cap', retryAfter: 3600 };
  return { ok: true };
}
export function _resetForTests() { mem.min.clear(); mem.day.clear(); mem.cap.clear(); }
