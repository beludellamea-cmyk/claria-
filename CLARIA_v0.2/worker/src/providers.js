// Adaptadores de proveedor. Todos devuelven { text } o lanzan ProviderError(status, code).
export class ProviderError extends Error {
  constructor(status, code, detail) { super(code); this.status = status; this.code = code; this.detail = detail; }
}

async function postJson(url, headers, body, timeoutMs = 25000, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) {
      const code = res.status === 429 ? 'provider_busy' : (res.status === 401 || res.status === 403) ? 'provider_auth' : 'provider_error';
      throw new ProviderError(res.status === 429 ? 429 : 502, code, `upstream ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e && e.name === 'AbortError') throw new ProviderError(504, 'provider_timeout');
    throw new ProviderError(502, 'provider_unreachable');
  } finally { clearTimeout(timer); }
}

// Anthropic exige roles alternados que empiecen con "user".
function normalizeTurns(messages) {
  const out = [];
  for (const m of messages) {
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += '\n' + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

export const PROVIDERS = {
  async anthropic({ system, messages, env, maxTokens, fetchImpl }) {
    if (!env.ANTHROPIC_API_KEY) throw new ProviderError(503, 'not_configured');
    const base = env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    const data = await postJson(`${base}/v1/messages`, { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      { model: env.AI_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, temperature: 0.2, system, messages: normalizeTurns(messages) }, 25000, fetchImpl);
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { text };
  },

  async gemini({ system, messages, env, maxTokens, fetchImpl }) {
    if (!env.GEMINI_API_KEY) throw new ProviderError(503, 'not_configured');
    const base = env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
    const model = env.AI_MODEL || 'gemini-2.5-flash';
    const data = await postJson(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': env.GEMINI_API_KEY },
      { systemInstruction: { parts: [{ text: system }] },
        contents: normalizeTurns(messages).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature: 0.2 } }, 25000, fetchImpl);
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    return { text };
  },

  async 'workers-ai'({ system, messages, env, maxTokens }) {
    if (!env.AI || typeof env.AI.run !== 'function') throw new ProviderError(503, 'not_configured');
    try {
      const out = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'system', content: system }, ...normalizeTurns(messages)], max_tokens: maxTokens, temperature: 0.2 });
      let text = out?.response ?? out?.choices?.[0]?.message?.content ?? '';
      if (typeof text !== 'string') text = JSON.stringify(text); // algunos modelos devuelven el JSON ya parseado
      return { text };
    } catch (e) {
      const msg = String(e && e.message || '');
      if (/5035|upgrade|paid/i.test(msg)) throw new ProviderError(502, 'provider_model_unavailable');
      if (/limit|quota|capacity|429/i.test(msg)) throw new ProviderError(429, 'provider_busy');
      throw new ProviderError(502, 'provider_error');
    }
  }
};

export function providerName(env) { return PROVIDERS[env.AI_PROVIDER] ? env.AI_PROVIDER : null; }
export const PROVIDER_LABEL = { anthropic: 'Anthropic (Claude)', gemini: 'Google (Gemini)', 'workers-ai': 'Cloudflare Workers AI' };
