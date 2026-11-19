# Arquitectura

El código fuente usa módulos nativos de JavaScript, sin dependencias de ejecución. `src/app.js` conecta los eventos de usuario con las vistas, los cálculos y los servicios. `index.html` carga `assets/app.bundle.js`, una copia preparada como script clásico para funcionar al abrir archivos locales con doble clic.

`tools/build.mjs` prepara ese archivo recorriendo los imports nombrados y encerrando cada módulo en su propio ámbito. Detecta dependencias circulares y rechaza sintaxis de módulos no admitida. No necesita paquetes externos. Tras modificar el código fuente se debe ejecutar `node tools/build.mjs`.

## Organización

`src/core/constants.js` centraliza la clave del almacenamiento y los nombres de días y meses. `src/core/utils.js` contiene conversiones numéricas, formato de horas, identificadores y escape de texto para HTML. `src/core/store.js` conserva el estado, carga la copia local y notifica a la sincronización cuando se guarda un cambio.

`src/domain/grades.js` calcula el acumulado, la nota necesaria y el estado de cada materia. `src/domain/attendance.js` cuenta las clases del semestre y calcula el máximo de faltas. Ambos módulos contienen funciones puras que pueden probarse sin navegador. `src/domain/subjects.js` adapta materias importadas y les asigna identificadores nuevos.

`src/ui/subjects-view.js` construye las tarjetas y actualiza los resultados mientras se editan las notas. `src/ui/motion.js` concentra las animaciones y respeta la preferencia del sistema de reducir movimiento. `src/features/schedule.js` administra el alta manual del horario, la edición de horarios, la vista semanal, el formulario de conexión y la lectura de imágenes. `src/features/onboarding.js` gestiona la bienvenida inicial con la foto del horario y la conexión con un proveedor de IA. `src/features/qr-transfer.js` y `src/services/qr.js` implementan la transferencia por QR: paquetes, vista de códigos, cámara y restauración. `src/services/ai.js` encapsula los proveedores de IA: configuración, compresión de la imagen, solicitud de visión y lectura del JSON. `src/services/sync.js` encapsula la integración opcional con la cuenta y la base de datos del entorno Claude.

`styles/main.css` carga las hojas en orden. `styles/base.css` define estructura y distribución; `styles/components.css` define el aspecto final de componentes, horarios y diálogos. Se conserva el orden de la cascada original para mantener el diseño adaptable.

## Estado y persistencia

Los datos persistentes residen en `state`: `subjects`, `absences`, `sem` y `updatedAt`. Las tarjetas abiertas, los modos de diálogo, las animaciones y la reordenación son estado temporal de interfaz. Los servicios reciben referencias y callbacks explícitos para evitar dependencias circulares.

La clave local sigue siendo `calc-notas-v2`. Una materia mantiene `id`, `name`, `min`, `max`, `rows`, `days`, `blocks` y, cuando corresponde, `archived`. Cada evaluación usa `p` para porcentaje, `g` para nota obtenida y `pred` para una predicción fijada por el usuario. Los bloques usan `d` como día, `s` como hora inicial y `e` como hora final. Domingo corresponde a 0; lunes a 1.

La conexión de IA se guarda aparte, en `calc-notas-ai`, para que la exportación de materias y faltas nunca incluya la clave. Contiene `provider`, `apiKey`, `baseUrl`, `model` y `remember`. Si el usuario desmarca «Guardar la conexión en este navegador», la configuración se conserva en `sessionStorage` y desaparece al cerrar la pestaña. La exportación de texto solo escribe `subjects`, `absences` y `sem`; la exportación por QR incluye además la configuración de IA. Al cargar, si no existe `calc-notas-ai` se lee la antigua `calc-notas-deepseek` y se normaliza como proveedor DeepSeek; la siguiente vez que se guarda se escribe la clave nueva.

`removeSubject(id)` en `src/core/store.js` concentra la eliminación: quita la materia de `subjects`, retira su identificador de todas las ausencias y descarta las ausencias que quedan sin materias. Lo usan tanto el botón «Eliminar materia» de la tarjeta como la lista de horarios. Después se guarda y se vuelve a dibujar la interfaz; no quedan referencias huérfanas en las faltas ni en la sincronización.

El botón de papelera (`wipeAll`) vacía `subjects` y `absences`, restablece `sem`, llama a `clearAIConfig`, elimina `ONBOARD_KEY`, limpia el estado temporal de la interfaz y guarda la copia vacía. La acción se confirma en un diálogo y no tiene recuperación automática; por eso conviene exportar antes.

Las ausencias mantienen `id`, `date` e `ids`, donde `ids` referencia las materias afectadas. Al importar, se crean nuevos identificadores y se adaptan esas referencias. La importación agrega materias; no reemplaza las existentes. Las fechas de ausencia se conservan como `AAAA-MM-DD` y se interpretan en hora local.

## Transferencia por QR

La exportación por QR crea una copia completa con `subjects`, `absences`, `sem` y la configuración de IA (incluida la clave si existe), la serializa con `JSON.stringify` y la comprime con LZString (`LZ1:`). El texto comprimido se divide en trozos de 600 caracteres. Cada QR lleva `CCQR1|id|parte|total|datos`; si no cabe en un solo código, la vista muestra un paginador para escanearlos en orden.

La importación abre la cámara con `getUserMedia`, decodifica con `BarcodeDetector` cuando existe y usa `jsQR` como respaldo. También acepta una captura de imagen del QR, útil cuando no hay cámara o el navegador no la permite. Los fragmentos se agrupan por el identificador del paquete y, cuando están todos, se descomprimen y se revisan. Al confirmar, `applySubjectSnapshot` reemplaza el estado académico: crea identificadores nuevos para las materias, remapea las faltas, descarta faltas vacías o duplicadas y reemplaza el semestre. La configuración de IA se restaura con `saveAIConfig` si el QR la incluye. La cámara exige un contexto seguro (`https` o `localhost`).

Las librerías `qrcode.js` (qrcode-generator, MIT), `lz-string.min.js` (MIT) y `jsQR.js` (Apache-2.0) se sirven desde `assets`; no hay llamadas a CDN ni a un backend.

## Alta de materias desde el horario

Las materias no se crean con un botón genérico de «Añadir materia». Se crean al definir un horario: desde la foto con IA, desde el formulario «Agregar horario a mano» o al importar datos. Así no quedan materias vacías sin días ni horas.

`openAddSched` y `applyAddSched`, en `src/features/schedule.js`, manejan el formulario manual. El usuario escribe el nombre, elige días y horas; si el nombre coincide con una materia activa, se actualiza su horario y se conservan sus notas; si no coincide, se crea la materia con ese horario y tres evaluaciones vacías. La bienvenida reutiliza `openAddSched` al pulsar «Agregar horario a mano» después de cerrarse.

La lista de «Editar horario» incluye un botón «Agregar materia» que abre el mismo formulario y, al guardar, vuelve a la lista para seguir agregando o editando. El formulario ofrece además «Guardar y agregar otra materia», que guarda la materia actual y reabre un formulario vacío sin cerrar el diálogo.

## Cálculo de notas

El acumulado suma `porcentaje × nota / 100` de las evaluaciones calificadas. Las predicciones fijadas reservan puntos antes de calcular la nota necesaria en los pendientes sin predicción. Cuando no hay pendientes definidos sin predicción, el cálculo utiliza el porcentaje aún no asignado. Se mantiene esta política del código original. Una suma de porcentajes superior a 100 produce una advertencia visual.

El máximo de faltas es la parte entera de `clases × porcentaje permitido / 100`. Se cuentan los días de clase entre el inicio y el fin del semestre, incluidos ambos extremos. No se descuentan festivos ni cancelaciones. Cada fecha registrada cuenta una falta por materia afectada; varios bloques de una misma materia en un día no multiplican esa falta. Un porcentaje permitido de cero admite cero faltas.

## Integraciones opcionales

La lectura de la foto tiene dos caminos. El asistente de bienvenida (`onboarding.js`) y la tarjeta de horario usan `src/services/ai.js`: comprime la imagen en el navegador (máximo 1800 px de lado, JPEG al 90 %), la envía como base64 y entrega el arreglo `materias` al flujo de revisión. El prompt pide días y horas en formato de 24 horas y reutiliza los nombres de materias existentes. Si no hay conexión de IA, se conserva la alternativa de `window.claude.use('sample')`; si tampoco existe, se abre el formulario de conexión.

`ai.js` normaliza la configuración con un `provider` entre `deepseek`, `openai`, `openrouter`, `anthropic`, `google` y `custom`. Para los proveedores compatibles con OpenAI usa `POST {baseUrl}/chat/completions` con un bloque `image_url` que contiene un data URL; para Anthropic usa `POST {baseUrl}/v1/messages` con un bloque `image` y `source.type = 'base64'`. DeepSeek recibe además `thinking: disabled` y `temperature: 0`; DeepSeek, OpenAI y OpenRouter reciben `response_format: json_object`. Los proveedores personalizados no envían `response_format` para no romper implementaciones locales; el prompt y `extractJson` siguen exigiendo un JSON válido. Si un proveedor rechaza el modo JSON con un error 400, se reintenta una vez sin `response_format`.

La clave viaja directamente desde el navegador al proveedor. En los formatos OpenAI se envía como `Authorization: Bearer`; en Anthropic como `x-api-key`, junto con `anthropic-version` y `anthropic-dangerous-direct-browser-access: true`, necesario para las peticiones directas desde el navegador. No se registra en la consola ni se incluye en las exportaciones. La API debe permitir CORS para el origen desde el que se abre la aplicación. Si el navegador bloquea la petición, conviene servir la app desde `http://localhost`. «Probar conexión» consulta `GET {baseUrl}/models` y no consume tokens de generación; si el proveedor no expone esa ruta, la interfaz avisa y permite guardar la configuración para probarla con una foto. Los servidores locales compatibles con OpenAI pueden funcionar sin clave.

La sincronización con una cuenta sigue requiriendo las capacidades `user` y `db` del SDK de Claude. Fuera de ese entorno, la edición manual, la lectura con IA y el almacenamiento local siguen disponibles. No se incluyen credenciales de API en el proyecto.

La sincronización conserva la estrategia original: se utiliza la copia con `updatedAt` más reciente. No fusiona ediciones simultáneas de distintos dispositivos ni resuelve conflictos por campo. La consulta remota ocurre al iniciar y al volver a mostrar la pestaña. Las escrituras se agrupan durante 900 ms. Una exportación manual permite conservar una copia independiente.

## Limpieza realizada

Se retiraron los constructores de horarios antiguos `dayChips`, `fmtSched`, `schedList` y `fmtBlock`, sus manejadores sin controles activos, el campo sin uso `maxF` en nuevas materias y estilos de componentes que no se renderizaban. Se redujo la especificidad redundante de `:root` y se eliminaron declaraciones CSS sustituidas por reglas posteriores del mismo selector. Se conserva el contenido visual activo y la compatibilidad del formato de exportación.

Se corrigió la recuperación del botón principal al abrir importar o exportar después del editor de horarios. También se evita interpretar un límite de asistencia de cero como un límite sin configurar. Un error al guardar localmente deja un aviso en lugar de ocultarse por completo.

Se retiró el alta genérica de materias vacías: el botón superior y la acción `add` ya no existen. La bienvenida y el estado vacío ofrecen «Agregar horario a mano», que abre el formulario de horario; la única forma de crear una materia es definir su horario (foto, formulario o importación).

## Validación y límites

Las pruebas usan el ejecutor integrado de Node.js. Verifican cálculos, predicciones, porcentajes, asistencia, adaptación de materias importadas, restauración de copias completas, paquetes QR, el alta manual del horario y el arranque del script distribuido mediante un DOM simulado. También comprueban que el HTML carga ese script sin `type="module"`, la normalización de la conexión de IA, la extracción de JSON y las solicitudes de visión de los formatos OpenAI y Anthropic con `fetch` simulado. Ese DOM no reproduce el motor de renderizado, el foco, las animaciones ni la disposición móvil de un navegador. La verificación visual automática no pudo completarse porque el navegador de comprobación no alcanzó el servidor local. Las integraciones con Claude necesitan verificarse dentro de un entorno que suministre ese SDK. Las llamadas reales a los proveedores requieren una clave y saldo, por lo que las pruebas automatizadas simulan la red.
