# CLARIA · La información, más clara para todos

Plataforma inclusiva que fusiona «Te lo leo, te lo digo» y «Compañero de trámites». Coloquio Final 2026 · Auxiliar en Inteligencia Artificial · ISFDyT «República Federal de Alemania», El Colorado, Formosa.

**Versión 0.2 · IA conversacional real mediante API segura.** Funciona en dos modos, siempre visibles en pantalla:
- **Modo demo** (sin API): lector, voz, guías de trámites y chat con textos preparados, etiquetados «no es IA». Los botones de IA están desactivados y lo explican.
- **IA conectada** (Worker desplegado): explicación en lenguaje claro, lectura fácil, resumen y preguntas sobre el texto; chat con base curada de trámites. Pide permiso antes del primer envío, oculta datos personales, no guarda nada y limita el uso.

## Estructura
```
index.html · styles.css · app.js · config.js · privacy.js   Frontend estático (GitHub Pages)
data/tramites.json        Base curada de trámites (fuente, fecha de consulta, enlaces)
assets/                   Emblema y avatar (sin cambios)
worker/                   API segura (Cloudflare Worker): proveedores, límites, privacidad
tests/                    Pruebas E2E (Playwright) con proveedor de IA simulado
docs/PUBLICACION.md       Cómo desplegar y decidir costos
docs/CHECKLIST.md         Qué funciona, qué falta, límites
docs/GUION_DEMO.md        Guion de 3 minutos
```

## Empezar
- Probar sin IA: `python3 -m http.server 8000` → http://localhost:8000
- Probar con IA y publicar: seguí `docs/PUBLICACION.md`
- Tests: `npm install && npx playwright install chromium && npm test`

## Reglas del proyecto
Ninguna clave en el navegador ni en GitHub · respuestas fijas nunca se presentan como IA · CLARIA no es una página oficial ni gestiona trámites · no inventar requisitos, costos, enlaces ni turnos · no afirmar sincronización labial ni video en tiempo real.

## Fuentes oficiales de la base de trámites (consultadas el 10/11/2026)
- Tramitar un nuevo ejemplar de DNI: https://www.argentina.gob.ar/node/41622
- Cómo obtener el CUD: https://www.argentina.gob.ar/servicio/como-obtener-el-certificado-unico-de-discapacidad-cud
- Mi Argentina: https://www.argentina.gob.ar/miargentina · Validá tu identidad: https://www.argentina.gob.ar/miargentina/validar-identidad


## Novedad (rama `etapa-1-pictogramas`)
Convertidor de texto a pictogramas ARASAAC con exportación PNG/PDF. Ver `docs/ETAPAS.md` (plan por etapas, límites y cómo probar). Pictogramas: ARASAAC (Gobierno de Aragón, autor Sergio Palao), CC BY-NC-SA 4.0.

## Rediseño guiado (rama `rediseno-guia`)
Bienvenida con 4 botones, una pregunta por pantalla y CLARIA acompañando con 4 estados. Ver `docs/REDISENO.md`.
