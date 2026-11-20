# Posicionamiento de Cuentas Claras

## Objetivo
Captar estudiantes que buscan calcular notas, saber cuánto necesitan para aprobar y organizar su semestre. La propuesta debe identificar siempre el ámbito académico: el nombre de marca aislado puede confundirse con servicios financieros. Esta es una hipótesis de posicionamiento; no se han medido volúmenes de búsqueda ni dificultad competitiva.

## Base implementada
- Nombre Cuentas Claras en interfaz, configuración, icono y descargas.
- Título: Cuentas Claras | Calculadora de notas y promedio académico.
- Descripción: Calcula tus notas y el promedio del semestre, descubre cuánto necesitas para aprobar y organiza tus horarios y faltas de asistencia con Cuentas Claras.
- H1 con la marca y explicación breve visible.
- Contenido HTML público sobre cálculo, horarios, asistencia, almacenamiento y uso opcional de IA.
- Open Graph y Twitter Cards para compartir; falta una imagen social y su URL pública.
- Datos estructurados WebApplication descriptivos, sin valoraciones ni promesas de resultados enriquecidos.
- robots.txt permite el rastreo. El archivo debe servirse desde la raíz del dominio; en alojamiento por subcarpeta lo controla el propietario del dominio.

## Antes de publicar
1. Confirmar la URL pública de producción. El repositorio GitHub no demuestra qué dominio sirve la aplicación.
2. Añadir canonical absoluto y og:url con esa URL. Añadir url a los datos estructurados.
3. Crear sitemap.xml solo con URLs públicas reales, canónicas, accesibles con HTTP 200; no incluir ventanas, datos locales ni páginas futuras.
4. Añadir la URL absoluta del sitemap al robots.txt de la raíz cuando se controle esa raíz.
5. Configurar redirecciones permanentes si existen URLs antiguas; conservar las exportaciones si cambia el origen porque localStorage depende de él.
6. Comprobar HTTPS, carga móvil, recursos, indexabilidad y ausencia de bloqueos en las cabeceras del alojamiento.

## Primera semana tras publicar
- Verificar la propiedad en Google Search Console.
- Enviar el sitemap e inspeccionar la URL principal; solicitar indexación y comprobar la versión renderizada.
- Registrar una línea base de impresiones, clics, CTR, consultas, posiciones y páginas indexadas. No hay garantía de indexación o primera posición.

## Semanas 2 a 4: contenido y captación
Publicar páginas útiles con herramientas operativas, enlaces HTML desde la aplicación y títulos propios, evitando páginas vacías o duplicadas:

| Página propuesta | Consulta objetivo | Título propuesto | Utilidad mínima |
| --- | --- | --- | --- |
| calculadora-de-notas.html | calculadora de notas por porcentaje | Calculadora de notas por porcentaje — Cuentas Claras | Cálculo utilizable y ejemplo explicado |
| cuanto-necesito-para-pasar.html | cuánto necesito para pasar una materia | ¿Cuánto necesito para pasar una materia? — Cuentas Claras | Cálculo con nota objetivo y porcentaje restante |
| promedio-ponderado.html | calcular promedio ponderado con créditos | Calculadora de promedio ponderado — Cuentas Claras | Cálculo por créditos y notas finales |
| horario-universitario.html | organizar horario universitario | Organiza tu horario universitario — Cuentas Claras | Horario editable y explicación breve |

Priorizar las consultas observadas en Search Console. Compartir la herramienta en grupos universitarios donde sea pertinente y solicitar menciones de recursos estudiantiles. No comprar enlaces ni generar publicaciones masivas sin utilidad.

## Seguimiento quincenal
Comparar impresiones, clics y consultas por página en periodos equivalentes. Cuando haya impresiones con pocos clics, revisar título y descripción según intención de búsqueda. Cuando una página no se indexe, revisar el informe y la inspección antes de cambiar contenido. Medir la activación (primera materia creada) únicamente mediante eventos agregados, sin transmitir notas, horarios, imágenes o claves de API.

## Fuentes
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://support.google.com/webmasters/answer/9012289
