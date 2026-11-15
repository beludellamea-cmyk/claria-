# CLARIA — PAQUETE MAESTRO DE PICTOGRAMAS PARA 6 INSTITUCIONES

Fecha: 15 de noviembre de 2026 · El Colorado, Formosa, Argentina

**Objetivo:** ampliar la sección «Mi ciudad, más accesible» de la **CLARIA existente**, sin crear otra web.

## Lo que incluye

- `01_TABLA_MAESTRA_PICTOGRAMAS.csv`: 118 necesidades visuales catalogadas por institución y función.
- `02_TABLEROS_FRASES.csv`: 48 frases de comunicación rápida, diferenciadas de instrucciones de trámites.
- `03_INSTITUCIONES_PLANTILLA.csv`: fichas vacías para cargar datos locales confirmados.
- `04_MANIFIESTO_PARA_INTEGRAR.json`: datos estructurados para que Claude implemente tableros y guías.
- `05_CATALOGO_VISUAL.html`: vista previa navegable de los pictogramas y sus estados.
- `06_NORMATIVA_Y_ARASAAC.md`: normativa, guía oficial y créditos de licencia.
- `07_PROMPT_LISTO_PARA_CLAUDE.md`: instrucciones de integración.

Instituciones: Registro Civil, Hospital y centros de salud, Municipalidad, PAMI, Correo Argentino, Terminal de Ómnibus.

## Qué está validado y qué no

- Referencias incluidas: **89 conceptos mapeados directamente** al diccionario existente y **10 usos genéricos**, que requieren contexto visual/textual.
- **19 conceptos** todavía requieren selección manual de pictograma adecuado (por ejemplo, nombres institucionales, partida, vacunación, andén).
- Los ID corresponden a conceptos que figuran en `data/pictogramas.json` del repositorio de CLARIA. **Eso no significa que cada aplicación institucional esté validada por usuarios.**
- **Este paquete NO duplica los PNG:** las imágenes **ya están en la aplicación** en `assets/picto/`. Las URL de ARASAAC son de vista previa y requieren conexión. Claude debe reutilizar archivos existentes y descargar/verificar nuevas imágenes únicamente para conceptos pendientes.
- Los tableros de frases son **ayudas de comunicación, no guías oficiales de trámites**.
- La plantilla institucional deja en blanco horarios, trámites y requisitos: deben confirmarse antes de publicarlos.

## Primera tarea para Claude

1. Abrir el repo existente y el diccionario local.
2. Usar el manifiesto y la tabla sin rehacer ni duplicar los pictogramas.
3. Construir tableros de comunicación contextual para las 6 instituciones.
4. Mostrar como texto cualquier concepto no validado, sin reemplazarlo por una imagen arbitraria.
5. Permitir seleccionar manualmente pictogramas pendientes en ARASAAC y conservar la elección revisada.
6. Preparar las guías de trámites solo cuando exista documentación oficial del procedimiento.

**Importante:** no interpretar el uso de un pictograma genérico como confirmación de que la institución ofrece ese servicio.
