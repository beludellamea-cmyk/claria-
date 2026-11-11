// Verifica un Worker YA DESPLEGADO con una consulta real (gasta una consulta de la cuota).
// Uso:  node smoke.mjs https://claria-api.TU-SUBDOMINIO.workers.dev https://TU-USUARIO.github.io
const [base, origin] = process.argv.slice(2);
if (!base || !origin) { console.error('Uso: node smoke.mjs <URL_DEL_WORKER> <ORIGEN_PERMITIDO>'); process.exit(2); }
const headers = { 'content-type': 'application/json', origin };
const show = (t, v) => console.log(`\n== ${t}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 2)}`);
const h = await fetch(`${base}/api/health`, { headers: { origin } }); const hj = await h.json(); show('health', hj);
if (!hj.ok) { console.error('\n✘ El Worker no está configurado con un proveedor (ver docs/PUBLICACION.md).'); process.exit(1); }
const e = await fetch(`${base}/api/explain`, { method: 'POST', headers, body: JSON.stringify({ task: 'plain', source: 'typed', text: 'El agua es indispensable para la vida. Cuando el sol calienta los ríos, una parte del agua se evapora, forma nubes y vuelve como lluvia.' }) });
show(`explain → HTTP ${e.status}`, await e.json());
const c = await fetch(`${base}/api/chat`, { method: 'POST', headers, body: JSON.stringify({ message: '¿Qué dice la fuente oficial sobre el costo del DNI?', history: [] }) });
show(`chat → HTTP ${c.status}`, await c.json());
console.log('\nRevisá: ¿el resultado está en español y en formato correcto? ¿el chat cita la fuente y el costo que figura en data/tramites.json?');
