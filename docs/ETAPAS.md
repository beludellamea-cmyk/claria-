# CLARIA · Plan por etapas (pictogramas, lectura accesible y humano digital)

Estado: **Etapa 1 completa y verificada** en la rama `etapa-1-pictogramas` (pendiente de revisión; no está en `main`).

| Etapa | Contenido | Estado |
|---|---|---|
| **1** | Portada con 3 opciones · convertidor texto → pictogramas (diccionario ARASAAC verificado, búsqueda puntual en línea con elección manual) · voz con resaltado · letra habitual / MAYÚSCULA · imprimir · PNG y PDF reales · créditos y licencia ARASAAC | ✅ |
| 2 | Lectura de documentos estilo pictocuento: oraciones, pictograma por concepto, narración por partes, tocar pictograma = significado + audio, anterior/siguiente, versión imprimible. Detección de conceptos con IA (modo conectado, sin enviar el documento completo: solo conceptos) | ⏳ |
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
