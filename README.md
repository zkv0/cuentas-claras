# Cuentas Claras

Aplicación web para guardar materias, registrar notas con sus porcentajes, calcular la nota necesaria para aprobar y gestionar horarios y faltas. Conserva el diseño oscuro y el formato de datos de la versión original.

## Ejecutar

Extrae todo el ZIP y abre `index.html` con doble clic. Mantén las carpetas junto al HTML: el archivo carga el JavaScript preparado en `assets/app.bundle.js`, las librerías de QR incluidas en `assets` y los estilos de `styles`.

También puedes abrirlo mediante un servidor local. Abre una terminal en esta carpeta y ejecuta:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Después abre `http://localhost:8000`. También puedes usar Live Server de Visual Studio Code. Para detener el servidor pulsa `Ctrl+C`. El servidor es opcional: la distribución incluida usa un script clásico que evita el bloqueo de módulos ES al abrir archivos locales.

No necesitas instalar paquetes ni compilar para usar el proyecto. Se requiere un navegador moderno. Python se usa únicamente para el servidor de desarrollo opcional; cualquier servidor de archivos estáticos puede sustituirlo. La tipografía Roboto se carga desde Google Fonts y tiene fuentes del sistema como alternativa.

## Uso y conservación de datos

Agrega tu horario con una foto o a mano; las materias se crean a partir de ese horario, no como fichas vacías. Después ajusta la nota mínima y la nota máxima e introduce los porcentajes y las notas disponibles. Deja vacía una nota que todavía no hayas recibido. Los campos «Debes sacar» se actualizan con el resultado; escribir en ellos fija una predicción que interviene en los demás pendientes.

Al eliminar una materia, ya sea desde su tarjeta o desde la lista de horarios, desaparece también del horario y de todas las faltas registradas; las faltas que se quedan sin materias se borran.

Para mover todo a otro dispositivo sin backend, abre **Exportar datos** y pulsa el botón con el icono de QR. En el otro dispositivo abre **Importar datos** y pulsa el botón de la cámara. El QR incluye materias, faltas, semestre y la configuración de IA (también la clave, si la tienes configurada); trátalo como información privada. La importación por QR **reemplaza** los datos actuales, a diferencia de pegar el texto de exportación, que agrega materias.

En «Horario y faltas de asistencia» puedes agregar un horario a mano, editarlo y configurar las fechas del semestre y el porcentaje máximo de faltas. La foto del horario se puede leer con la API de IA que elijas; la sincronización con una cuenta sigue requiriendo el SDK de Claude que utilizaba el código original. Sin ninguna de las dos integraciones puedes editar los horarios manualmente y conservar los datos en el navegador.

## Asistente de bienvenida y foto de horario

Al entrar por primera vez sin materias registradas, se abre automáticamente una ventana que te permite:
- **Subir la foto de tu horario** (arrastrando o seleccionando una imagen).
- **Conectar tu API de IA** en la columna contigua (DeepSeek, OpenAI, OpenRouter, Anthropic, Gemini o una API compatible) para extraer las materias y horas automáticamente.
- Al confirmar el horario detectado, entras directamente a la página con todas tus materias ya creadas.
- O bien pulsar «Agregar horario a mano» para escribir el horario de una materia sin usar una foto.

## Agregar horario a mano

1. En «Horario y faltas de asistencia» pulsa «Agregar horario a mano».
2. Escribe el nombre de la materia, elige los días y las horas de clase.
3. Pulsa «Guardar horario». Si el nombre coincide con una materia existente, se actualiza su horario; si no, se crea la materia con ese horario.

Dentro de «Editar horario» también aparece «Agregar materia» para crear otra sin salir de la ventana. En el formulario manual, «Guardar y agregar otra materia» guarda la materia actual y deja el formulario listo para la siguiente.

No hay un botón para añadir una materia vacía: para que exista una materia primero hay que definir su horario, tomarlo de una foto o importarlo.

## Transferir por QR

1. En el dispositivo de origen abre **Exportar datos** y pulsa el botón con el icono de QR.
2. Si la copia no cabe en un solo código, aparecerán varios: escanea uno y pulsa **›** para pasar al siguiente.
3. En el dispositivo de destino abre **Importar datos** y pulsa el botón con el icono de cámara.
4. Escanea todos los códigos. Cuando estén completos, revisa el resumen y pulsa **Restaurar todo**.

La cámara requiere HTTPS o `http://localhost` y permiso del navegador. Si no está disponible, el escáner permite **Subir captura** con una imagen del QR. El QR se genera y se lee en el propio navegador; no se envía a ningún servidor. Incluye la configuración de IA y la clave de API cuando existe, así que no lo compartas ni lo publiques.

## Leer el horario con IA

La lectura de la foto usa el proveedor de IA que elijas. Hay opciones preparadas para DeepSeek, OpenAI, OpenRouter, Anthropic (Claude), Google Gemini y cualquier API compatible con OpenAI. El modelo debe aceptar imágenes y devolver texto; por ejemplo, `deepseek-flash`, `gpt-4o-mini` o un modelo con visión de OpenRouter.

1. Consigue una clave en el panel de tu proveedor.
2. Abre «Horario y faltas de asistencia» y pulsa **«Conectar IA»**.
3. Elige el proveedor: se rellenan la URL base y un modelo de ejemplo, y puedes cambiarlos.
4. Pega la clave, ajusta el modelo si hace falta y pulsa **«Guardar»**. «Probar conexión» consulta la lista de modelos del proveedor.
5. Pulsa **«Subir foto del horario»**, elige una foto o captura legible y revisa el resultado antes de aplicar.

La configuración se guarda en el almacenamiento local de este navegador bajo `calc-notas-ai`; si existe una conexión anterior de DeepSeek en `calc-notas-deepseek`, se sigue leyendo y se migra al guardar. La clave no se incluye al exportar los datos y puedes borrarla con **«Quitar clave»**.

La imagen se envía al proveedor que elijas y cada lectura consume tokens de tu cuenta; la aplicación no envía nada si no configuras la conexión. La petición sale directamente del navegador, así que el proveedor debe permitir CORS desde el origen de la app. Si el navegador bloquea la petición al abrir el archivo con doble clic, abre la aplicación desde `http://localhost:8000` con las instrucciones de arriba.

Para un servidor local compatible con OpenAI, como Ollama o LM Studio, elige **«Otra API compatible con OpenAI»**, usa una URL como `http://localhost:11434/v1` (Ollama) o `http://localhost:1234/v1` (LM Studio), escribe el modelo con visión y deja la clave vacía. El servidor local debe permitir CORS y ser accesible desde el navegador. Los modelos y las URL de ejemplo pueden cambiar; ajústalos a la documentación de tu proveedor.

Los datos de materias y faltas se guardan en `localStorage` bajo la clave `calc-notas-v2`. La compatibilidad se mantiene cuando la aplicación se abre en el mismo origen y perfil del navegador. Cambiar de dominio, puerto o navegador no traslada automáticamente esos datos. Exporta los datos desde la versión anterior e impórtalos en la nueva si cambias de origen. Conserva una exportación antes de borrar datos del navegador.

## Organización y mantenimiento

`index.html` contiene la estructura inicial; `src/app.js` conecta los eventos y módulos. Los directorios `core`, `domain`, `features`, `services` y `ui`, dentro de `src`, separan almacenamiento, cálculos, horarios, integraciones y presentación. `src/features/onboarding.js` gestiona la bienvenida con la foto del horario. `src/features/qr-transfer.js` y `src/services/qr.js` implementan la exportación e importación por QR. `src/services/ai.js` encapsula la conexión con los proveedores de IA, el envío de la imagen y la lectura del JSON. `styles` contiene las hojas de estilo y `tests` contiene las comprobaciones automatizadas.

Las librerías de QR están incluidas en `assets` para funcionar sin conexión: `qrcode.js` (qrcode-generator, MIT), `lz-string.min.js` (MIT) y `jsQR.js` (Apache-2.0). No se cargan desde una CDN. Las licencias están en [assets/THIRD_PARTY.md](assets/THIRD_PARTY.md).

Después de modificar archivos de `src`, ejecuta `node tools/build.mjs` para actualizar `assets/app.bundle.js`. El empaquetador está incluido y no necesita paquetes adicionales. Edita los módulos originales; el archivo preparado se genera automáticamente a partir de ellos.

La descripción de cada módulo, el formato de los datos, las decisiones de cálculo y las limitaciones están en [docs/architecture.md](docs/architecture.md).

## Comprobar

Con Node.js 20 o posterior instalado, ejecuta:

```powershell
node --test
```

Las pruebas no necesitan paquetes adicionales. El archivo `package.json` también define `npm test` y `npm start` para sistemas con npm; el comando directo de Node.js permite probar sin npm.
