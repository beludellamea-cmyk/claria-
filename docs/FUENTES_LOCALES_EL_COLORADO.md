# CLARIA · Fuentes para las fichas de El Colorado
Consulta documental: **15/11/2026**. Cambios propuestos en la rama `fichas-reales-el-colorado-2026-11-15`.

## Alcance y responsabilidades

- Son **datos recopilados de fuentes públicas**; no fueron remitidos, confirmados ni aprobados directamente por las seis instituciones.
- No deben etiquetarse «información aprobada por la institución» ni transformarse en requisitos o protocolos oficiales. Las orientaciones paso a paso son sugerencias generales de consulta.
- Mostrar los campos que cuentan con fuente y omitir los que no cuentan con información fiable. No reemplazar campos vacíos por «falta verificar» en la experiencia de los vecinos.
- Mostrar enlace a la fuente consultada y fecha, y ofrecer una vía de corrección cuando se establezca contacto institucional.
- No usar fotografías de otras sedes ni números telefónicos de otras oficinas como si fueran locales.

## Datos incorporados

### Registro Civil, seccional 1490
- **Santa Fe y San Juan**, El Colorado, Formosa.
- **Lunes a viernes, 07:30 a 12:30**, según horario publicado por el Gobierno de Formosa.
- Fuentes: Gobierno de Formosa (apartado de oficinas del Registro Civil): https://m.formosa.gob.ar/tramite/171/pasaporte ; Formosa Digital: https://fd.formosa.gob.ar/puntosconectados
- Consultas ofrecidas: documentación, DNI, partidas y orientación general. No se especificaron requisitos de cada trámite.

### Hospital de El Colorado
- **Santa Fe 273**, El Colorado, Formosa. Figura en el directorio oficial provincial.
- Fuente: https://fd.formosa.gob.ar/puntosconectados
- Se indica atención de salud pública y orientación general, sin prometer especialidades, guardias u horarios específicos.

### Municipalidad de El Colorado
- **Av. 25 de Mayo 651**, publicada por el directorio local OpenAlfa. No figura como dirección expresa en el sitio municipal consultado.
- Portal oficial: https://www.elcolorado.gob.ar/index.php
- Correo publicado en el portal municipal: **portal@elcolorado.gob.ar**
- Referencia secundaria de domicilio: https://callejero-argentina.openalfa.com/formosa/servicios
- Servicios descritos a nivel general: orientación y consultas sobre servicios municipales. No se inventaron oficinas internas ni requisitos.

### PAMI · Agencia El Colorado
- La agencia existe en documentación institucional de PAMI. Los documentos de PAMI de 2018–2021 la ubican en **Santa Fe 148**, mientras un directorio de mapas más reciente publica **Santa Fe 155**. Por esta discrepancia, CLARIA muestra **«Calle Santa Fe, El Colorado» sin número**, en vez de arriesgar una localización precisa errónea.
- Documentación PAMI: https://institucional.pami.org.ar/files/boletines_inssjp/RESOL-2021-927-INSSJP-DE-INSSJP.pdf
- Canal oficial: **138, PAMI Escucha y Responde, atención nacional 24 horas**. Fuente: https://www.pami.org.ar/contacto
- La línea 138 NO es el teléfono exclusivo de la agencia local.

### Correo Argentino · El Colorado
- **Corrientes 100**, El Colorado, Formosa.
- Dirección en directorios: https://www.cylex.com.ar/el-colorado/correo-argentino---sucursal-el-colorado-11243740.html ; https://postmapia.com/es/argentina/formosa/el-colorado/correo-argentino-el-colorado
- Línea oficial **0810-777-7787**, de lunes a viernes de 8 a 20 (atención al cliente de Correo Argentino, **no horario de sucursal**). Fuente: https://www.correoargentino.com.ar/atencion-al-cliente/centros-de-atencion-al-cliente
- **No se publicó horario local**: las fuentes públicas consultadas presentan franjas de atención contradictorias.

### Terminal de Ómnibus de El Colorado
- **Av. Néstor Kirchner 1150, esquina Nicolás Barrios**, El Colorado, Formosa, según el listado de puntos de venta de la empresa Rutamar.
- Fuente: https://rutamar.com.ar/puntos-de-venta/
- Contexto de prestadores locales de transporte: https://www.formosahermosa.gob.ar/transportes/
- No se inventaron salidas, tarifas ni horarios de empresas.

## Uso con pictogramas

- Las orientaciones de «Mi ciudad» reutilizan pictogramas ya incluidos en `data/pictogramas.json` y `assets/picto/`.
- Los mensajes y guías son recursos para comunicar y comprender, no constancias de atención ni recomendaciones médicas.
- Crédito ARASAAC (Gobierno de Aragón, autor Sergio Palao, licencia CC BY-NC-SA 4.0); consultar condiciones para señalética física en espacios públicos: https://arasaac.org

## Próximo paso

Cuando una institución aporte datos propios o corrija los públicos, reemplazar la procedencia `fuentes_publicas` por un registro de aprobación institucional con responsable y fecha. Nunca fijar `revisado_y_aprobado: "SI"` basándose solo en investigación web.
