// SOLO PARA PRUEBAS: imita la API de Anthropic con respuestas deterministas. No es parte del producto.
import http from 'node:http';
export function startMockProvider(port = 8791) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); calls.push({ url: req.url, headers: req.headers, body });
    const last = body.messages?.[body.messages.length - 1]?.content || '';
    let text;
    if (/<documento>/.test(last)) text = JSON.stringify({ resultado: 'MOCK: el texto explica el ciclo del agua.', puntos_clave: ['MOCK punto uno', 'MOCK punto dos'], avisos: ['MOCK aviso de incertidumbre'] });
    else if (/enlace-falso/.test(last)) text = JSON.stringify({ respuesta: 'MOCK mirá https://sitio-falso.example/dni y https://www.argentina.gob.ar/node/41622', fuentes: ['dni'] });
    else if (/error500/.test(last)) { res.writeHead(500); return res.end('{}'); }
    else text = JSON.stringify({ respuesta: 'MOCK: respuesta de chat.', fuentes: ['dni'] });
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
  });
  return new Promise((r) => server.listen(port, () => r({ server, calls })));
}
