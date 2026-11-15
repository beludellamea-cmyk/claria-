# PROMPT PARA CLAUDE — CLARIA EL COLORADO / PAQUETE MAESTRO

Quiero que integres este paquete en el proyecto EXISTENTE CLARIA, no que construyas una segunda app.
Repositorio: https://github.com/beludellamea-cmyk/claria-

## Contexto
La sección «Mi ciudad, más accesible» ayudará a la comunidad de El Colorado (Formosa) a encontrar servicios y a comprender/comunicar información por texto, voz y pictogramas.

He adjuntado archivos CSV/JSON/HTML con **118 necesidades visuales** y **48 frases** para SEIS instituciones: Registro Civil; Hospital y centros de salud; Municipalidad; PAMI; Correo Argentino; Terminal de Ómnibus.

## Obligatorio
1. **Primero inspeccioná el repositorio actual**: `data/pictogramas.json`, `pictos.js`, `convertidor.js`, `pictocuento.js`, `assets/picto`, `index.html`, `styles.css`, `cine.css` y la configuración. Reutilizá el motor de ARASAAC, voz, controles y avatar. No crees otro proyecto ni dupliques imágenes que ya existen.
2. Importá `04_MANIFIESTO_PARA_INTEGRAR.json` o convertí los CSV a datos propios sin perder campos, procedencia ni estado de revisión.
3. Implementá una sección «Mi ciudad, más accesible» con 6 tarjetas institucionales y una plantilla replicable para ampliar a otros lugares. Conservar la estética violeta/turquesa, la marca y el humano digital CLARIA.
4. Cada ficha mostrará «Qué puedo consultar» (solo con servicios confirmados), «Hablar con imágenes», «Cómo llegar» y «Guías accesibles». No inventes ubicaciones, requisitos, horarios, teléfonos, precios ni prestaciones. Si falta un dato, mostrará «Información por confirmar» y no un dato simulado.
5. Las frases de `02_TABLEROS_FRASES.csv` deben poder seleccionarse, escucharse con la voz del navegador y mostrarse a pantalla completa; ofrecer controles grandes, ir atrás y desactivar audio. No iniciar voz o micrófono automáticamente.
6. Presentá pictogramas ARASAAC de `assets/picto/<id>.png` **solo cuando su ID y significado estén verificados** en la tabla. `VERIFICADO_GENERICO_REVISAR_CONTEXTUALMENTE`: acompañar con texto específico y advertencia para la revisión; no asumir equivalencia. `PENDIENTE_SELECCION_MANUAL`: mostrar texto accesible y opción para que el editor seleccione un pictograma comprobado. No inventar IDs.
7. Incorporá un flujo de edición/validación de instituciones y de contenido: responsable, fecha, fuente, última revisión y estado (borrador/revisado/publicado). No permitir publicar automáticamente formularios públicos sin control.
8. Prepará un generador de guías en PDF siguiendo la **Resolución Conjunta 1/2023** y la guía oficial argentina citadas en `06_NORMATIVA_Y_ARASAAC.md`: título y pasos en imprenta mayúscula, una acción por paso, pictograma, número, texto simple en imperativo y disposición consistente. Los procedimientos deben proceder de fuentes oficiales previamente verificadas. La guía no sustituye trámites oficiales.
9. Respetá la licencia ARASAAC **CC BY-NC-SA** (atribución visible, uso no comercial, compartir derivaciones con la misma licencia y reglas para señalización).
10. Mantener accesibilidad: interacción táctil y por teclado, labels legibles, contraste adecuado, tamaño de texto configurable, lector de pantalla, opción sin audio, reducciones de movimiento, buena adaptación a celular.
11. **Trabajá en una rama** y conservá intacta la publicación actual. No publiques cambios sin que los revise.

## Entregables que quiero de vos
- Informe breve de cómo se integrará al código actual y qué archivos modificarás.
- Implementación funcional de la sección comunitaria con tableros para las 6 instituciones.
- Pruebas manuales/automatizadas con estados de carga, sin red, fallo de pictograma, sin TTS y datos faltantes.
- Lista separada de pictogramas pendientes de seleccionar con su palabra clave y captura de opciones, nunca selección automática sin revisión.
- Modo de importar fichas oficiales que aporten las instituciones.

**IMPORTANTE:** los pictogramas del paquete son referencias y recursos de comunicación, no son evidencia de qué trámites ofrece cada institución. No transformar las frases en instrucciones oficiales sin una verificación adicional.
