// Servidor local para probar el Worker con Node (sin wrangler). Lee variables de process.env.
// Ejemplo:  AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... ALLOWED_ORIGINS=http://localhost:8000 node dev-server.mjs
import http from 'node:http';
import worker from './src/index.js';

export function startDevServer(env, port = 8787) {
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const out = await worker.fetch(request, env, {});
    res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer()));
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = { ...process.env, ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:8000,http://127.0.0.1:8000' };
  await startDevServer(env, Number(process.env.PORT) || 8787);
  console.log(`CLARIA API local en http://localhost:${process.env.PORT || 8787} · proveedor: ${env.AI_PROVIDER || '(sin configurar → modo demo)'}`);
}
