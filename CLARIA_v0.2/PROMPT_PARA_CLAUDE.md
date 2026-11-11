# Prompt para continuar CLARIA en Claude

Estoy preparando el Coloquio Final 2026 de Auxiliar en Inteligencia Artificial del ISFDyT «República Federal de Alemania», El Colorado, Formosa. Mi proyecto se llama **CLARIA — La información, más clara para todos.** Fusiona las categorías «Te lo leo, te lo digo» y «Compañero de trámites».

Te adjunto la carpeta completa **claria-web** y su README. Revisá el código real antes de proponer cambios. Conservá el estilo elegido: humano digital CLARIA protagonista en la pantalla inicial, identidad de puente/camino/C/IA, experiencia cálida tecnológica e inclusiva. Conservá el emblema y el avatar en assets; no los reemplaces sin pedírmelo. No modifiques otros repositorios.

**Tu primer objetivo es convertir este prototipo en una aplicación plenamente funcional con IA conversacional real**, no un chat simulado. Implementá una API segura mediante backend o función serverless (jamás expongas claves de API en el código del navegador ni en GitHub). Elegí una solución viable para alojar el frontend en GitHub Pages. Si se requieren servicios externos y claves, explicame los pasos y las decisiones antes de habilitar costos. El usuario no debe necesitar su propia clave para probar la demo.

### Prioridades

1. Integrar IA generativa para que CLARIA comprenda y explique el texto aportado por el usuario en lenguaje claro, con opciones de lectura fácil y respuestas sobre ese texto. Distinguir contenido original, resumen y explicación de IA; reconocer incertidumbre y errores de extracción.
2. Conectar el chat de CLARIA a la misma IA, con límites de consulta, protección de privacidad y avisos claros sobre el tratamiento de datos. Evitar recopilar DNI, CUIL, credenciales y datos sensibles. No almacenar chats sin consentimiento.
3. Para trámites, disponer de una pequeña base curada de sitios oficiales, fecha de consulta y enlace directo. Nunca inventar requisitos, enlaces, costos ni turnos; distinguir orientación de trámite real.
4. Refinar el avatar para que parezca un humano digital expresivo: animación y voz con control de reproducción, sin exigir video en tiempo real. No afirmar sincronización labial auténtica si no existe.
5. Añadir pictogramas ARASAAC solo cuando correspondan semánticamente, respetando créditos y licencia; ofrecer alternativas textuales, no cubrir todo el texto con iconos decorativos.
6. Asegurar WCAG 2.2 AA donde sea verificable, navegación por teclado, contraste, foco, títulos, lectura móvil, tamaños, aria-live, control de animaciones y audio opcional. Considerar DUA como marco educativo, no como garantía técnica de accesibilidad.
7. Probar rutas y funciones reales con Playwright o equivalente; entregar checklist con lo que funciona, lo pendiente y los límites.

### Reglas de trabajo

- No sustituir acciones reales por botones de decoración. Cada botón debe funcionar o estar claramente deshabilitado y explicado.
- No usar respuestas fijas presentándolas como IA; diferenciar modo demo de modo conectado.
- No mostrar interfaz de organismos como si CLARIA fuera una página oficial.
- GitHub Pages aloja archivos estáticos: usar un servicio adecuado para la lógica segura del servidor.
- Producí los archivos completos y editables, con instrucciones de publicación, pruebas y un guion de 3 minutos para la demostración del coloquio.

Primero decime qué ya funciona, qué depende de servicios externos y el orden exacto de implementación recomendado. Después hacé la primera integración y mostrame cómo probarla.
