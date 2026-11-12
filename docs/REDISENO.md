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

## CLARIA protagonista: modo guía hablada

- **Es opcional y nunca arranca sola**: los navegadores bloquean el audio automático y, además, es una regla del proyecto. Con un toque en «🔊 Que CLARIA me hable», CLARIA saluda, resalta los 4 botones a medida que los nombra y guía cada pantalla con su pregunta (la primera vez, explicación completa; después, versión corta).
- **Reacciona** al convertir una frase, al descargar y en cada paso de un trámite. «🔇 Silenciar a CLARIA» corta todo al instante.
- **Subtítulos** siempre visibles mientras habla (también para quien no puede oír).
- **Órdenes por voz** (solo en la bienvenida, con permiso de micrófono): «quiero leer un documento», «hacer un trámite»… Si no entiende, lo dice y no navega.
- **Honestidad técnica**: la voz es la del navegador (su calidad depende del dispositivo). El movimiento de CLARIA al hablar es un pulso al ritmo de las palabras; **no hay sincronización labial real**. La preferencia de voz no se guarda entre visitas.
- Sin voz o sin micrófono en el navegador: los botones se desactivan con una explicación y todo el recorrido sigue funcionando.
- Mejora futura (requiere decisión): audios grabados con voz humana realista (p. ej. ElevenLabs) para las frases fijas.

## Capa cinematográfica (rama `rediseno-cinematografico`)

Solo presentación: `cine.css` + `cine.js` + una bienvenida nueva en `index.html`. No cambia datos ni funciones (lectura, pictogramas, trámites, IA, privacidad).

- **Bienvenida**: fondo noche/violeta con luz turquesa, aurora en movimiento, suelo en perspectiva 3D y partículas (canvas, livianas y pausadas si la pestaña está oculta). Logo CLARIA con entrada animada, CLARIA grande con halo, y solo: «¡Hola! Soy CLARIA.» · «¿Qué querés hacer hoy?» · 3 tarjetas (Crear con pictogramas, Leer y entender, Hacer un trámite) · «O hablá conmigo».
- **Tarjetas** de vidrio con inclinación 3D y brillo que sigue al puntero; CLARIA gira la cabeza hacia la tarjeta que se enfoca.
- **Expresividad**: flotación, saludo inicial, asentimiento al elegir, inclinación al escuchar o pensar, salto al completar, halo distinto para escuchar / procesar / hablar. Movimientos de cabeza con la imagen del personaje: **no hay parpadeo real ni sincronía labial** (requeriría capas o cuadros del rostro).
- **Transiciones** entre pantallas, CLARIA que «viaja» al costado, pictogramas que aparecen de a uno, chispas al convertir, descargar y avanzar un paso de trámite.
- Las demás pantallas se muestran como lámina clara sobre la noche para mantener la legibilidad.
- **Accesibilidad**: «Reducir animaciones» y `prefers-reduced-motion` apagan fondo animado, partículas y transiciones; alto contraste oculta el fondo; teclado y alternativas sin voz intactos.
