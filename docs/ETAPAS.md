# CLARIA · Plan por etapas (pictogramas, lectura accesible y humano digital)

Estado: **Etapa 1 y Etapa 2a completas y verificadas** (ramas `etapa-1-pictogramas` y `etapa-2-lectura-pictocuento`, pendientes de revisión; nada está en `main`).

| Etapa | Contenido | Estado |
|---|---|---|
| **1** | Portada con 3 opciones · convertidor texto → pictogramas (diccionario ARASAAC verificado, búsqueda puntual en línea con elección manual) · voz con resaltado · letra habitual / MAYÚSCULA · imprimir · PNG y PDF reales · créditos y licencia ARASAAC | ✅ |
| **2a** | Lectura de documentos estilo pictocuento (botón «Ver con pictogramas» en Leer y comprender): oraciones, pictograma por concepto, narración por páginas y «Leer todo» con resaltado, tocar pictograma = significado + audio + otras opciones, anterior/siguiente/flechas, tamaño, letra, velocidad, 1–3 oraciones por página, imprimir y PDF de todo el documento. Todo local, sin enviar el texto a ningún servicio | ✅ |
| 2b | Detección de conceptos con IA (solo modo conectado; se enviarían únicamente palabras sueltas pendientes, nunca el documento) y búsqueda en línea de palabras sin pictograma dentro del pictocuento | ⏳ |
| 3 | Guías de trámites con pictogramas y pasos narrados (fuentes oficiales y fecha, sin datos inventados) | ⏳ |
| 4 | Humano digital: estados saludo / escucha / procesamiento / habla (animación por capas sobre el avatar actual), interruptor de voz, sincronía labial aproximada (documentada como aproximada) | ⏳ |
| 5 | Ampliar diccionario, pulido de accesibilidad (WCAG 2.2), prueba con usuarios y ensayo del coloquio | ⏳ |

## Qué hace la Etapa 1
- **Diccionario local** (`data/pictogramas.json`, 261 conceptos, 258 imágenes en `assets/picto/`): cada ID de ARASAAC fue consultado en la API y su imagen revisada a mano. Ningún ID se inventa.
- **Motor** (`pictos.js`): normaliza (acentos), reconoce plurales, género, verbos conjugados (incluido voseo), expresiones («sacar un turno»), palabras gramaticales (quedan solo como texto) y avisa cuando una palabra tiene varios sentidos (DNI, llamar, banco…).
- **Estados de cada ficha**: verificado · revisar · elegido por vos · sin pictograma · solo texto. Nada se asigna solo desde la búsqueda en línea.
- **Búsqueda en ARASAAC** (opcional, por palabra): se envía únicamente la palabra que ves en el cuadro; nunca el texto completo, nombres propios ni números. Solo se muestran resultados cuya palabra clave coincide exacto.
- **Voz**: Escuchar, Pausar, Repetir, Detener; resalta la palabra leída (depende de que el navegador emita eventos de palabra). Sin voz, todo lo demás funciona.
- **Exportar**: PNG (1240×1754) y PDF A4, dibujados con los pictogramas reales y los créditos; Imprimir usa un área de impresión propia.

## Límites conocidos (honestos)
- El diccionario local cubre vocabulario frecuente (261 conceptos); lo demás queda como texto o se busca a mano. No hay todavía detección de conceptos con IA (Etapa 2).
- Algunos pictogramas de ARASAAC reflejan España (p. ej. el DNI muestra el documento español); la tarjeta está marcada «Revisar».
- El resaltado de voz depende del navegador; el humano digital con animación y sincronía labial **no está** en esta etapa. No hay lip-sync real.
- Licencia CC BY-NC-SA 4.0: uso no comercial, con atribución y misma licencia.

## Cómo probar
```
python3 -m http.server 8000      # abrir http://localhost:8000/#escribir
node --test tests/pictos.test.mjs   # motor (12 pruebas)
node tests/e2e-pictos.mjs           # navegador real (17 pruebas; ARASAAC en línea con respuesta real grabada)
node tests/e2e.mjs                  # regresión de la v0.2 (16 pruebas)
```
Textos sugeridos: `HOLA` · `QUIERO AGUA` · `NECESITO SACAR UN TURNO PARA MI DNI` · `LA ESCUELA ES PARA TODOS` · un párrafo de una nota escolar.

## Etapa 2a: límites y pruebas
- Las oraciones se separan por punto, ?, ! y saltos de línea (abreviaturas como «Sr.» pueden cortar de más); las muy largas se parten cada ~25 palabras. Máximo 150 oraciones por documento.
- Sin pictograma en el diccionario (261 conceptos) → la palabra queda escrita. No se consulta ARASAAC ni IA desde el pictocuento (llega en 2b).
- Probar: cargar un texto en «Leer y comprender» → «Ver con pictogramas». `node tests/e2e-cuento.mjs` (13 pruebas de navegador).

## Etapa 1 · Entender una foto (en revisión)

**Flujo:** Leer un documento → Sacar foto / Subir archivo → «¿Esta es la imagen correcta?» → OCR en el dispositivo (Tesseract.js) → «Revisá el texto» (editable, con la imagen original al lado y botón para restaurar) → Escuchar / Explicar fácil / ¿Qué hago ahora? / Ver con pictogramas.

**Funciona (probado con pruebas automáticas):**
- Vista previa y confirmación antes de leer; no se descarga ni ejecuta OCR hasta confirmar.
- Texto reconocido editable; la imagen original se conserva y nunca se envía a ningún servidor.
- Escuchar y pictogramas funcionan sin IA; PDF y TXT siguen igual.
- «¿Qué hago ahora?» usa el Worker (tarea `actions`) solo con IA conectada y consentimiento; separa «El documento dice» de «Sugerencia de CLARIA (no figura en el documento)». En modo demo se explica y no llama a la API.
- Si el OCR falla o no reconoce texto: mensaje claro, reintentar o escribir a mano. Vista a 390 px sin desbordes.

**Límites / no verificado:**
- Las pruebas reemplazan Tesseract por un doble: la **calidad real del OCR** (letra a mano, fotos torcidas o con poca luz) debe probarse a mano con fotos reales.
- Tesseract y su idioma se descargan de un CDN: se necesita internet la primera vez.
- La respuesta real de la IA tampoco se probó (solo con un proveedor simulado); el prompt prohíbe inventar autorizaciones, pagos, fechas y lugares, pero hay que revisar con casos reales del kit.
- Etapas 2 a 4 no empezadas.

**Pruebas:** `npm test` (incluye `tests/e2e-foto.mjs`, 11 pruebas, y 2 pruebas nuevas del Worker).

## Etapa 2 · Hablar con imágenes (en revisión)

**Flujo:** Inicio → «Hablar con imágenes» → «¿Qué necesitás decir?» (Ayuda, Salud, Escuela, Transporte, Compras, Necesidades básicas) → frases rápidas y palabras con pictograma → tu frase (tarjetas visibles) → Decir en voz alta / Guardar frase / Compartir imagen. «Mis frases» lista lo guardado.

**Funciona (probado automáticamente, `tests/e2e-tablero.mjs`, 12 pruebas):**
- Solo pictogramas ARASAAC del diccionario verificado (`data/pictogramas.json`); una prueba comprueba que cada palabra y frase de `data/tablero.json` existe y tiene su imagen local. Para editar categorías, frases o palabras, cambiá `data/tablero.json` (usando solo palabras que estén en el diccionario).
- «Decir en voz alta» pronuncia la **frase completa** (texto editable), no solo los conceptos, y nunca arranca sola. Si el texto se escribió o corrigió a mano, no se pisa al sumar tarjetas.
- Mover, cambiar (solo entre pictogramas verificados) y quitar tarjetas. Guardar frases en el dispositivo (localStorage, máx. 30), usarlas de nuevo o borrarlas.
- Compartir imagen: PNG generado en el dispositivo con las tarjetas y el crédito de ARASAAC; usa el menú de compartir del sistema si existe y si no, descarga el archivo.
- Sin conexión básico: `sw.js` guarda los archivos propios y los pictogramas ya vistos; probado con el navegador sin red después de una primera visita.
- Vista a 390 px sin desbordes; botones con nombre accesible.

**Límites / no verificado:**
- La voz depende del navegador (voces es-AR/es no siempre disponibles); en las pruebas la voz está simulada, no se escuchó audio real.
- Sin conexión: hace falta una primera visita con internet; los pictogramas que nunca se vieron no estarán. Cuando se publique una versión nueva puede tardar una visita en actualizarse.
- La lista de frases y palabras es una selección inicial; conviene revisarla con quienes van a usar el tablero. Las frases habladas están en español rioplatense neutral en género.
- «Compartir imagen» no se probó con el menú de compartir real de un teléfono. No hay búsqueda en línea en ARASAAC dentro de este tablero (solo el diccionario verificado).
- Etapas 3 y 4 no empezadas. El logo de ARASAAC no se agrega a las imágenes: si se imprimen como cartel en un espacio público hay que revisar sus condiciones de uso.

## Etapa 3 · Estoy en un lugar público (en revisión)

**Flujo:** Inicio → «Estoy en un lugar público» → «¿Dónde estás?» (Escanear QR / Subir foto del QR / Elegir de la lista) → «¿Qué necesitás?» (opciones que carga la institución) → guía de un paso por pantalla, con pictograma, Escuchar y «Siguiente paso». «Pedir ayuda» ofrece frases para el personal: Decir en voz alta o Mostrar en pantalla grande.

**Inicio rediseñado según el kit:** 4 tarjetas (Entender una foto, Hablar con imágenes, Estoy en un lugar público, Entender un trámite) + «O hablá conmigo». «Hacer un trámite» pasó a llamarse «Entender un trámite» porque explica, no efectúa. «Crear con pictogramas» (texto → pictogramas) ya no está en el inicio: se llega desde «Hablar con imágenes» → «Escribir mi propia frase con pictogramas». Sigue funcionando igual.

**Funciona (probado automáticamente, `tests/e2e-lugares.mjs`, 16 pruebas):**
- Los datos de cada lugar los carga y valida la institución en `data/lugares.json`. Un lugar sin `responsable` o sin fecha `actualizado` **no se muestra**. Siempre se ve quién da la información, la fecha de actualización y que el contenido es responsabilidad de la institución. Los de demostración se rotulan «EJEMPLO FICTICIO».
- Hay un solo lugar, ficticio: «Biblioteca de demostración» (Inscribirme, Consultar horario, Pedir ayuda). **El horario y los pasos son datos de ejemplo, no reales.** QR para probar: `assets/qr/biblioteca-demo.png` (contenido `CLARIA-LUGAR:biblioteca-demo`).
- Un QR solo se acepta si su id existe en el catálogo. Un QR desconocido no se abre ni se sigue: se avisa y se ofrece la lista.
- La cámara se enciende solo al tocar «Escanear QR» y se apaga al apagarla, al leer un QR o al salir. No se usa geolocalización. El QR se lee en el dispositivo (jsQR, Apache-2.0, en `vendor/`, cargado solo al escanear). Nada se envía a un servidor.
- Sin conexión: el service worker ahora también guarda los pictogramas locales (≈3 MB en la primera visita) y los datos de lugares.

**Cómo sumar un lugar real:** agregar una entrada a `data/lugares.json` (id en minúsculas, nombre, responsable, fecha, opciones de tipo `pasos`, `info` o `frases`), solo con información que la institución haya provisto y validado, y generar su QR con el texto `CLARIA-LUGAR:<id>`. Los pictogramas salen del diccionario verificado; si falta uno, se deja sin imagen.

**Límites / no verificado:**
- La cámara se probó con el dispositivo falso de Chromium (sin QR a la vista): el escaneo en vivo con un QR real frente a un celular no está probado. La lectura del QR sí se probó con imágenes reales (subir foto del QR).
- La voz y el menú de compartir dependen del navegador; en las pruebas la voz está simulada.
- No hay un panel para que una institución cargue sus datos: hoy se edita el JSON. Tampoco hay validación humana ni firma de los datos: la confianza depende de quién publique el catálogo en este repositorio.
- No se agrega el logo de ARASAAC: si algo se imprime como cartel o señalética pública, hay que revisar sus condiciones de uso.
- La Etapa 4 (trámites con pictogramas: generador editable con pasos y PDF) no está empezada; hoy sigue la vista «Entender un trámite» existente.

## Etapa 4 · Trámites con pictogramas: creador de guías (en revisión)

**Dónde está:** «Entender un trámite» → «Soy una institución: crear una guía con pictogramas». La vista ciudadana de trámites (guías de DNI, CUD y Mi Argentina con fuente y fecha) no cambió.

**Flujo:** pegar el texto que dio el organismo + título, organismo, fuente oficial, fecha de verificación y responsable → «Armar los pasos» → revisar cada paso (editar, mover, quitar, agregar) y cada pictograma → casilla de revisión humana → PDF.

**Funciona (probado automáticamente, `tests/e2e-creador.mjs`, 10 pruebas; PDF revisado a ojo):**
- Parte de un texto **aportado por la institución**; la IA no escribe ni inventa pasos. Nada se envía a un servidor ni se guarda en el dispositivo.
- Título y pasos en MAYÚSCULAS, pasos numerados, un paso por renglón u oración.
- Avisos orientativos de la guía oficial: verbo en imperativo (voseo), una sola acción por paso, nombrar el objeto («IMPRIMÍ EL FORMULARIO» y no «IMPRIMILO»), pasos cortos. Son heurísticas simples: la decisión es de la persona.
- Cada concepto lleva su pictograma del diccionario verificado. Un pictograma **dudoso**, **faltante** o dejado «solo texto» deja la pieza **PENDIENTE**: nunca se acepta solo. Hay que confirmarlo o elegir otro.
- **PDF final** solo con: cero pendientes + organismo + fuente + fecha + responsable + casilla de que una persona revisó. Si no, solo se puede bajar un **BORRADOR** marcado «PENDIENTE DE REVISIÓN · NO USAR NI DIFUNDIR».
- El PDF lleva la fuente, la fecha, quién revisó, el crédito de ARASAAC y el aviso de que CLARIA es independiente: **no emite «PDF conforme»** ni afirma cumplir la Resolución Conjunta 1/2023.

**Límites / no verificado:**
- **No cumple automáticamente la guía oficial.** Las palabras gramaticales (artículos, preposiciones: «AL», «UNA», «LA») y los números se muestran como texto sin pictograma; la guía oficial pide pictogramas para todos los textos. Hay que revisarlo a mano y, si hace falta, reformular el paso.
- El diccionario verificado es chico (≈260 palabras). Muchos verbos de trámites («presentá», «acercate», etc.) quedarán pendientes hasta elegir un pictograma parecido, y la búsqueda solo ofrece los del diccionario. No hay búsqueda en línea en ARASAAC en este creador.
- Una persona puede confirmar un pictograma equivocado: CLARIA lo marca como revisado por esa persona, no lo valida. En las pruebas automáticas se eligió un pictograma al azar solo para probar el flujo; esos PDF no son modelo de contenido.
- No se guardan borradores: si se recarga la página, se pierde el trabajo. El PDF es una imagen (no tiene texto seleccionable ni etiquetas de accesibilidad).
- **Diseño del PDF sin contrastar con la guía oficial:** la guía pide el texto a la derecha o debajo de la imagen, siempre en la misma ubicación. Hoy el PDF pone la frase completa **arriba** de las tarjetas (cada pictograma lleva su palabra debajo). Es una diferencia a corregir antes de usarlo como guía institucional.

## Etapa 5 · «Mi ciudad, más accesible»: seis instituciones (rama `mi-ciudad-accesible`)

Se integra el **Paquete Maestro de pictogramas** (copia íntegra en `docs/paquete-maestro/`) dentro de las funciones que ya existían. No hay una página nueva.

**Cómo se integra**
- `scripts/importar-paquete.mjs` convierte el paquete en `data/ciudad.json` (118 pictogramas con su estado, 6 instituciones, 48 frases) y falla si un ID, lema o PNG no coincide con el diccionario verificado. `npm`-free: `node scripts/importar-paquete.mjs`.
- La vista «Mi ciudad, más accesible» (antes «Estoy en un lugar público») muestra siempre las seis instituciones; el QR queda como acceso secundario («Tengo un código QR»). Cada institución tiene **Qué puedo consultar · Hablar con imágenes · Cómo llegar · Guías accesibles**.
- «Hablar con imágenes» reutiliza el **tablero** de la Etapa 2 (`ClariaTablero.abrirContexto`): mismas tarjetas, voz (solo al tocar), guardar y compartir; se agregó **Mostrar en pantalla grande** y un botón de **sonido** que lo apaga por completo.
- Pictogramas: solo los locales verificados (`assets/picto/<id>.png`). Los conceptos **PENDIENTE** se muestran como texto («por revisar»); los **genéricos** llevan la marca «imagen general». Nunca se inventa un ID.
- Datos institucionales: la plantilla viene vacía, así que todo dice **«Información por confirmar»**. Una ficha solo se muestra si está en estado `publicado` **y** tiene aprobación, fuente https y fecha (`ClariaCiudad.confirmada`).
- **Panel del editor** (`editor.js`): busca candidatos en ARASAAC para los conceptos pendientes (la persona elige; queda «sin aprobar» en su dispositivo y se descarga como `ciudad-revisiones.json` para revisarlo en el repositorio) y valida/descarga fichas. **No publica nada.**
- `scripts/importar-fichas.mjs`: importa fichas completadas desde CSV; sin fuente, fecha y aprobación queda en borrador; `publicado` solo con `--publicar`.
- `docs/PICTOGRAMAS_PENDIENTES.md` + `docs/pendientes/*.png`: lista de pendientes con candidatos de ARASAAC (ninguno elegido).

**Pruebas**: `tests/e2e-ciudad.mjs` (15), `tests/ciudad.test.mjs` (6) y todas las suites anteriores. Las suites de pictos, cuento y guía ahora usan un `config.js` vacío para no depender del Worker en vivo.

**Límites**: las frases son ayudas de comunicación, **no procedimientos oficiales**. No hay guías PDF nuevas: falta una fuente oficial verificada por institución. Voz y QR con cámara real no se probaron en teléfono.
