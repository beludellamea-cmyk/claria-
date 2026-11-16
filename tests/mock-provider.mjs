// SOLO PARA PRUEBAS: imita la API de Anthropic con respuestas deterministas. No es parte del producto.
import http from 'node:http';
export function startMockProvider(port = 8791) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); calls.push({ url: req.url, headers: req.headers, body });
    const last = body.messages?.[body.messages.length - 1]?.content || '';
    // ── Visión (formato Anthropic: bloque image; formato Gemini: parts con inlineData) ──
    const gem = /:generateContent/.test(req.url || ''); const partes = gem ? body.contents?.[0]?.parts || [] : Array.isArray(last) ? last : [];
    const imagen = partes.find((p) => p.inlineData || p.type === 'image');
    if (imagen) {
      const sys = String((gem ? body.systemInstruction?.parts?.[0]?.text : body.system) || ''); const txt = partes.filter((p) => typeof p.text === 'string').map((p) => p.text).join('\n');
      const bytes = imagen.inlineData ? Buffer.from(imagen.inlineData.data, 'base64').length : Buffer.from(imagen.source.data, 'base64').length; calls[calls.length - 1].vision = { bytes, mime: imagen.inlineData?.mimeType || imagen.source?.media_type, system: sys, text: txt };
      let v;
      if (/error500v/.test(txt)) { res.writeHead(500); return res.end('{}'); }
      if (/"que_aparece"/.test(sys)) v = { tipo: 'cartel', que_aparece: 'MOCK: un cartel de tránsito con una letra P y una cruz roja.', elementos: ['Letra P: indica estacionamiento', 'Cruz roja: indica prohibición'], texto_visible: ['PROHIBIDO ESTACIONAR', 'Salida de emergencia', 'Línea que solo vio la IA'], dudas: ['MOCK: hay una parte borrosa abajo a la derecha'], legibilidad: 'parcial' };
      else if (/"que_puede_hacer"/.test(sys)) v = { resultado: /url-falsa/.test(txt) ? 'MOCK mirá https://sitio-falso.example/x' : 'MOCK: el cartel indica que no se puede dejar el auto ahí.', que_puede_hacer: ['MOCK: buscar otro lugar para estacionar'], dudas: [] };
      else if (/LECTURA F/.test(sys)) v = { resultado: 'MOCK: Es un cartel.\nNo se puede estacionar acá.', dudas: [] };
      else v = { resultado: /Pregunta de la persona/.test(txt) ? 'MOCK: respuesta sobre la imagen.' : 'MOCK', dudas: [] };
      const out = JSON.stringify(v); res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(gem ? { candidates: [{ content: { parts: [{ text: out }] } }] } : { content: [{ type: 'text', text: out }] }));
    }
    let text;
    if (/"ilegible"/.test(String(body.system || ''))) text = JSON.stringify({ tipo: 'nota escolar', resultado: 'MOCK: aviso de una reunión.', fechas: [{ cita: 'viernes 21 de noviembre', detalle: 'MOCK día' }, { cita: 'lunes 1 de enero', detalle: 'MOCK inventada' }], horarios: [], lugares: [], requisitos: [], acciones: [], ilegible: [], avisos: [] });
    else if (/el_documento_dice/.test(String(body.system || ''))) text = JSON.stringify({ resultado: 'MOCK: nota de la escuela sobre una reunión.', el_documento_dice: ['MOCK: ir a la biblioteca escolar el martes 24 a las 18:00', 'MOCK: llevar el cuaderno de comunicaciones'], sugerencias: ['MOCK: confirmar con la escuela si no podés asistir'], avisos: ['MOCK: revisá la hora, el OCR puede equivocarse'] });
    else if (/<documento>/.test(last)) text = JSON.stringify({ resultado: 'MOCK: el texto explica el ciclo del agua.', puntos_clave: ['MOCK punto uno', 'MOCK punto dos'], avisos: ['MOCK aviso de incertidumbre'] });
    else if (/enlace-falso/.test(last)) text = JSON.stringify({ respuesta: 'MOCK mirá https://sitio-falso.example/dni y https://www.argentina.gob.ar/node/41622', fuentes: ['dni'] });
    else if (/error500/.test(last)) { res.writeHead(500); return res.end('{}'); }
    else text = JSON.stringify({ respuesta: 'MOCK: respuesta de chat.', fuentes: ['dni'] });
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
  });
  return new Promise((r) => server.listen(port, () => r({ server, calls })));
}
