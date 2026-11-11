# CLARIA · Rediseño guiado (rama `rediseno-guia`)

Una pregunta por pantalla, botones grandes con ícono y CLARIA acompañando. Se conservan todas las funciones previas (carga de archivos y OCR, lector por partes, IA con consentimiento y límites, trámites curados, chat, pictogramas ARASAAC, pictocuento, accesibilidad y privacidad).

## Recorridos
| Botón | Pantallas |
|---|---|
| Escribir una frase | «¿Qué querés decir?» → escribir o dictar → pictogramas → Escuchar · Modificar · Descargar (PNG/PDF). Más opciones: repetir, velocidad, letra, tamaño, imprimir |
| Leer un documento | «¿Qué querés leer?» (Subir archivo · Sacar foto · Escribir texto) → «¿Cómo querés que te ayude?» (Escuchar · Explicar fácil · Ver con pictogramas) |
| Hacer un trámite | «¿Qué trámite necesitás?» (tarjetas) → pasos con pictogramas verificados, narración y fuente oficial con fecha |
| Hablar con CLARIA | «¿En qué puedo ayudarte?» → chat (IA conectada o textos preparados, siempre rotulado) con dictado opcional |

## CLARIA acompañante
- Grande en la bienvenida; en el resto, a la izquierda (computadora) o en una barra superior (celular).
- Estados con texto y animación: **Esperando · Escuchando · Pensando · Hablando** (se activan con el dictado, procesos de IA/archivos y la voz real).
- Al tocarla: **Explicame · Repetir · Volver · Necesito ayuda**, según la pantalla. El globo solo suena si tocás «Escuchar».
- **No hay sincronía labial real ni video**: «Hablando» muestra un indicador animado de voz.

## Reglas que se mantienen
- Ningún audio ni micrófono arranca solo. El micrófono pide permiso antes de usarse (el navegador puede enviar el audio a un servicio externo).
- Todo funciona sin voz ni micrófono (se avisa y los botones se desactivan).
- «Explicar fácil» necesita IA conectada; en modo demo lo dice. Nada preparado se presenta como IA.
- Privacidad, estado de la IA (Modo demo / IA conectada / Sin conexión) y créditos ARASAAC quedan en el pie y en «Privacidad y créditos».
- Pictogramas de trámites: solo conceptos verificados del diccionario local (hasta 6 por paso); son orientativos.

## Pruebas
`node tests/e2e-guia.mjs` (15) · `node tests/e2e.mjs` (16) · `node tests/e2e-pictos.mjs` (17) · `node tests/e2e-cuento.mjs` (13) · `node --test tests/pictos.test.mjs` (12) · `cd worker && node --test test/*.test.mjs` (13).
