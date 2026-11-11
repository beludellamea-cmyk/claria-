# Publicar CLARIA con IA real (frontend en GitHub Pages + API en Cloudflare Workers)

GitHub Pages solo aloja archivos estáticos. La IA necesita un servidor que guarde la clave: ese es el **Worker** (`worker/`). El navegador nunca ve ninguna clave.

```
Navegador (GitHub Pages) ──► Worker de Cloudflare ──► Proveedor de IA
   index.html, app.js         límites, privacidad,       (Workers AI, Anthropic o Gemini)
   config.js (URL pública)    base curada de trámites
```

## 1. Decisión previa: ¿qué proveedor de IA? (afecta costos y privacidad)

| Opción | Costo | Clave | Privacidad | Cuándo elegirla |
|---|---|---|---|---|
| **A. Cloudflare Workers AI** (por defecto) | Plan gratuito: 10.000 «Neurons»/día, sin tarjeta (verificado 10/11/2026) | No necesita | Cloudflare declara que no entrena con tus datos (confirmalo en su documentación antes del coloquio) | Para empezar y probar la demo sin gastar |
| **B. Anthropic (Claude)** | De pago por uso (cargás crédito; fijá un tope de gasto) | `ANTHROPIC_API_KEY` | Mejor español y formato JSON más confiable | Si A responde mal en español o falla el formato |
| **C. Google Gemini** | Capa gratuita | `GEMINI_API_KEY` | ⚠️ En la capa gratuita Google puede usar lo que enviás para mejorar sus productos | **No recomendada** para documentos de personas |

Límite de A: el plan gratuito tiene tope diario compartido; si se agota, la IA falla hasta las 00:00 UTC (CLARIA lo informa y el resto sigue andando). Algunos modelos grandes exigen plan pago; elegí uno disponible en tu panel y verificalo con el paso 5.

**No habilites nada con costo sin decidirlo vos.** El Worker arranca en la opción A (gratis).

## 2. Cuenta y herramientas
1. Creá una cuenta gratuita en cloudflare.com (el plan Workers Free no pide tarjeta).
2. Instalá Node.js 20 o superior.
3. En una terminal: `cd worker && npm install && npx wrangler login`.

## 3. Configurar y desplegar
1. Abrí `worker/wrangler.toml` y cambiá en `ALLOWED_ORIGINS` el texto `TU-USUARIO` por tu usuario de GitHub (solo esos orígenes podrán usar tu API).
2. `npx wrangler deploy`. Te muestra la URL, por ejemplo `https://claria-api.TU-SUBDOMINIO.workers.dev`.
3. (Solo si elegís B o C) `npx wrangler secret put ANTHROPIC_API_KEY` (o `GEMINI_API_KEY`), y en `wrangler.toml` cambiá `AI_PROVIDER` (`"anthropic"` o `"gemini"`) y `AI_MODEL` por un modelo vigente de tu cuenta. Volvé a hacer `npx wrangler deploy`.
4. Opcional, recomendado: creá un KV (`npx wrangler kv namespace create RATE_KV`), descomentá el bloque `[[kv_namespaces]]` y pegá el id, para que los límites diarios sean exactos. Además, en el panel de Cloudflare podés agregar una regla de *Rate limiting* sobre `/api/*`.

## 4. Conectar el frontend
1. Editá `config.js` y poné `apiBase: 'https://claria-api.TU-SUBDOMINIO.workers.dev'` (sin barra final). Ese archivo es público: **no pongas claves**.
2. Subí el proyecto a un repositorio **nuevo** `claria` (no reutilices otros): `index.html`, `styles.css`, `app.js`, `config.js`, `privacy.js`, `data/`, `assets/`, `README.md`. La carpeta `worker/`, `tests/` y `docs/` pueden subirse también (no contienen secretos).
3. Settings → Pages → Deploy from a branch → `main` / root.

## 5. Verificar (obligatorio antes del coloquio)
```
cd worker
node smoke.mjs https://claria-api.TU-SUBDOMINIO.workers.dev https://TU-USUARIO.github.io
```
Gasta 2 consultas reales. Mirá que: `health` diga `connected`; `explain` devuelva español claro con `puntos_clave`/`avisos`; `chat` cite el costo y la fuente que figuran en `data/tramites.json`. Si el JSON sale mal con un modelo pequeño, probá otro modelo o la opción B.
Después abrí la URL pública: el cartel debe decir **«IA conectada»**.

## 6. Probar en tu computadora (sin desplegar)
- Solo frontend, modo demo: `python3 -m http.server 8000` y abrí `http://localhost:8000`.
- Con IA real local: `cd worker && AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... node dev-server.mjs` (puerto 8787), y en `config.js` poné `apiBase: 'http://localhost:8787'`. Volvé `config.js` a `''` antes de publicar.
- Tests automáticos (sin gastar IA, usan un proveedor simulado): `npm install && npx playwright install chromium && npm test`.

## 7. Mantenimiento de la base de trámites
`data/tramites.json` es la única fuente de requisitos, costos y enlaces (la usan la pantalla de Trámites y el chat). Antes del coloquio, reabrí las páginas oficiales, actualizá `consultado` y `actualizada` y los datos que hayan cambiado. El chat solo puede citar enlaces de ese archivo; cualquier otro se elimina.

## Privacidad: qué hace y qué no
- No guarda textos ni chats (ni en el navegador ni en el servidor). El Worker solo registra ruta, código de estado y tiempo.
- Pide permiso antes del primer envío a la IA (recordado solo durante la sesión de la pestaña).
- Oculta patrones de DNI, CUIL/CUIT, correo, claves, números largos y datos tras «DNI:», «clave:», etc. **No detecta nombres, direcciones ni teléfonos con espacios.** Por eso se advierte al usuario que no cargue documentos personales.
- Los límites usan una huella irreversible de la IP (hash), no la IP.
