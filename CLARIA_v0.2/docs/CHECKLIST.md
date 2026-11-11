# CLARIA · Estado de la integración (10/11/2026)

## Funciona y está probado (automático)
Tests: `npm test` → 13 pruebas del Worker + 16 de navegador (Chromium) con el Worker real y un **proveedor de IA simulado** (solo en tests).

| Función | Evidencia |
|---|---|
| Modo demo vs conectado visible (cartel, chat, botones) y sin llamadas a la API en demo | E2E |
| Botones de IA desactivados y explicados cuando no hay IA | E2E |
| Respuestas preparadas etiquetadas «Modo demo · no es IA»; nunca se presentan como IA | E2E |
| Consentimiento antes del primer envío; «Ahora no» no envía nada; Esc = rechazar; foco atrapado y devuelto | E2E |
| Explicar / Lectura fácil / Resumir / Preguntar sobre el texto → Worker → proveedor | E2E + unit |
| Original, resultado de IA y avisos separados y etiquetados; la IA no modifica el original | E2E |
| Datos personales (DNI, CUIL, correo, claves, números largos) ocultos en el navegador **y** de nuevo en el servidor | E2E + unit |
| Texto largo recortado con aviso explícito (6.000 caracteres) | E2E |
| Aviso de posibles errores cuando el texto viene de OCR/PDF | E2E (lógica) |
| Chat conectado con historial acotado, fuente oficial + fecha, enlaces no verificados eliminados | E2E + unit |
| Errores del proveedor/red informados sin inventar respuesta | E2E + unit |
| Límites: por minuto, por día y por persona (servidor); 25 consultas por sesión (navegador); tope diario global | unit + E2E |
| CORS restringido a orígenes autorizados; la clave nunca llega al navegador | E2E + unit |
| Trámites desde base curada (3), con fuente, «consultada el», «actualizada el», costo/tiempo según la fuente | E2E |
| Móvil 390 px sin desbordamiento; todos los controles con nombre accesible | E2E |

## Pendiente o NO verificado
1. **IA real:** no se probó con un modelo real (no tengo tus claves ni acceso a tu cuenta). Falta `npx wrangler deploy` y `node worker/smoke.mjs`. El nombre del modelo de Workers AI por defecto debe confirmarse en tu plan.
2. Calidad del español y del formato JSON de un modelo pequeño: se evalúa en el paso 5 de `PUBLICACION.md`.
3. Voz del navegador, dictado, PDF.js y OCR (Tesseract): código sin cambios; no probados en dispositivos reales.
4. Avatar «humano digital» expresivo con control de reproducción: **sin cambios** (sigue siendo ilustración; sin sincronización labial). Es el próximo paso.
5. Pictogramas ARASAAC: no integrados (no se agregó ninguno para no inventar semántica ni créditos).
6. WCAG 2.2 AA: solo comprobaciones básicas. Falta auditoría de contraste de todo el sitio, prueba con lectores de pantalla (NVDA/TalkBack), zoom 200 %/400 % y revisión de la navegación superior en móvil (se desplaza). DUA es un marco pedagógico, no una garantía técnica.
7. Límites con varias instancias de Cloudflare: sin KV son aproximados. Con KV y una regla de Rate limiting son firmes.
8. El detector de datos personales es por patrones: no reconoce nombres ni direcciones. En el chat (modo estricto) puede ocultar números de 7-8 cifras que no son DNI.
9. Los datos de trámites reflejan lo que decían las páginas el 10/11/2026 (cuyo costo del DNI es $10000.00). Reverificar antes del coloquio.

## Orden recomendado a partir de acá
1. Desplegar el Worker y correr el smoke test (decisión de proveedor).  2. Reverificar `data/tramites.json`.  3. Avatar: estados (escuchando/hablando/pensando), controles de voz y animación, sin prometer lip-sync.  4. Pictogramas ARASAAC con créditos CC BY-NC-SA, solo donde corresponda.  5. Auditoría WCAG (axe + lector de pantalla + zoom).  6. Ensayo del guion de 3 minutos.
