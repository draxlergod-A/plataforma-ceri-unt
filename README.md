# Web del CERI - UNT

Sitio del **Círculo de Estudios de Relaciones Internacionales de la Universidad Nacional de Trujillo**. Incluye la biblioteca de informes digitales, el lector de libros y el estudio editorial para prepararlos sin editar código.

## Iniciar en VS Code

Requisitos: Node.js 20 o posterior, Git y VS Code. Abre la carpeta `plataforma-ceri-unt` y, en **Terminal → Nueva terminal**, ejecuta:

```powershell
npm.cmd run sitio
```

- Web: http://localhost:5500/
- Biblioteca: http://localhost:5500/analisis.html
- Estudio editorial: http://localhost:5500/admin/

Mantén la terminal abierta. Para detener el servidor, pulsa `Ctrl + C`. Si ya había una vista previa encendida, detenla y vuelve a iniciarla para cargar la nueva API del panel. Si el puerto 5500 está ocupado por Live Server, detén Live Server o usa otro puerto:

```powershell
$env:PORT = '5501'
npm.cmd run sitio
```

Usa la dirección que indique la terminal. `npm.cmd` evita el bloqueo de `npm.ps1` en PowerShell sin cambiar la política de ejecución. También puedes ejecutar `node herramientas/servidor.js`.

Para abrirlo con **F5**, entra en **Run and Debug** de VS Code y selecciona **CERI: iniciar y abrir el administrador**. Este perfil enciende el servidor en el puerto **5501** y abre `http://localhost:5501/admin/`. El perfil **CERI: iniciar y abrir la web** usa el mismo puerto y abre el inicio. Mantén la ejecución activa mientras utilices el sitio o compartas ese puerto; si el servidor ya está encendido, abre su dirección directamente.

El estudio de informes funciona con Node, sin instalar paquetes ni descargar un CMS. Abrir el HTML con doble clic o usar solo Live Server no permite guardar y publicar mediante este panel.

## Acceso al estudio

La primera vez, abre `/admin/` desde **localhost en la computadora del proyecto** y crea una contraseña de entre 10 y 128 caracteres. Después podrás iniciar y cerrar sesión. No hay una contraseña predeterminada.

La contraseña se guarda con sal y scrypt en `.ceri/admin.json`, fuera de Git; no se guarda en texto plano. Las sesiones caducan a las ocho horas o al reiniciar el servidor. Las escrituras requieren sesión, origen permitido y token CSRF; los intentos de acceso fallidos tienen un límite.

Este panel tiene **un acceso administrativo compartido**. Los campos Autor y Revisado por identifican a los responsables del informe; todavía no son cuentas con permisos separados.

Para restablecer una contraseña olvidada, detén el servidor, elimina **solo** `.ceri/admin.json`, vuelve a iniciarlo y configura el acceso desde localhost. Conserva `.ceri/backups/`. No compartas ni subas a Git los archivos privados de `.ceri/`.

## Crear y publicar un informe

1. Pulsa **Nuevo informe** en la biblioteca del estudio.
2. En **Información**, completa título, autor, resumen, fecha, número de edición, ámbito y temas. El identificador del enlace se genera automáticamente.
3. En **Portada**, sube una foto o selecciónala de la galería. Elige una composición editorial con título y foto o una imagen que contenga el diseño completo. Describe la imagen para quienes usan lectores de pantalla.
4. En **Páginas**, agrega plantillas de texto, resumen ejecutivo, cronología, referencias o página diseñada. Combina párrafos, destacados, fotos, fichas y fuentes. Reordena las páginas con flechas o arrastrándolas; también puedes duplicarlas.
5. Usa **Vista previa** para leer la edición con el mismo lector de la web: hojas animadas, índice, navegación por teclado, vista de texto y adaptación al celular.
6. En **Revisar y publicar**, resuelve los campos pendientes. Guarda como borrador, pasa a revisión o publica. La publicación requiere portada, contenido interior, descripciones de las fotos y al menos una fuente con nombre y enlace.
7. Pulsa **Ver en la web** o **Copiar enlace**. La nueva edición aparece en la biblioteca pública como libro. Las páginas que ya estaban abiertas deben recargarse para mostrar los cambios.

No hace falta crear otro HTML ni modificar el lector. Para preparar informes parecidos, usa **Duplicar** en la biblioteca. Para ocultar una edición publicada sin perder su contenido, usa **Retirar a borrador**.

### Subir fotos y páginas completas

En un bloque de imagen, selecciona una foto existente o sube JPG, PNG, WebP o GIF. El panel optimiza las fotos grandes cuando puede reducir su peso y conserva los GIF. El límite de cada archivo enviado al servidor es 12 MB.

Si ya tienes páginas diseñadas como imágenes, usa **Subir páginas diseñadas** para añadir varias a la vez. Cada imagen se convierte en una hoja del libro, sin recortar su composición. Revisa títulos, orden, descripciones y fuentes antes de publicar. Para contenido nuevo se recomienda usar texto y fotos por bloques: el texto se puede seleccionar y la lectura continua resulta más accesible. La carga directa de PDF no forma parte de este flujo.

### Borradores y respaldos

| Estado | Visibilidad con el servidor del CERI |
|---|---|
| Borrador | Solo en el estudio |
| En revisión | Solo en el estudio |
| Publicado | Biblioteca pública |

**Guardar** escribe el informe en `contenido/publicaciones.json`. Los cambios sin guardar se conservan de forma recuperable en ese navegador; al volver a editar, el estudio ofrece recuperarlos. Usa Guardar o descarga un respaldo para conservarlos fuera del navegador.

Antes de cada escritura, el servidor respalda la colección anterior en `.ceri/backups/` y conserva los últimos 20 respaldos. Puedes descargar el informe actual o un respaldo JSON completo desde el panel. Si dos personas guardan a partir de la misma versión, la segunda recibe un aviso de conflicto y sus cambios no sobrescriben la colección. Descarga su copia antes de recargar y comparar.

La restauración de respaldos se realiza desde los archivos del proyecto; no hay importación automática en el panel.

## Uso compartido y publicación en internet

El servidor escucha en `127.0.0.1`. El panel guarda en los archivos de **esa copia del proyecto**. No envía commits a GitHub ni publica automáticamente un alojamiento externo.

Para un enlace temporal con el reenvío de puertos de VS Code, configura primero la contraseña desde localhost. Comparte el puerto del servidor del CERI, mantén la PC encendida y la terminal abierta. Si el túnel cambia la cabecera Host y el panel rechaza el origen, permite la dirección HTTPS exacta del túnel al reiniciar:

```powershell
$env:CERI_ADMIN_ORIGIN = 'https://direccion-exacta-del-tunel'
npm.cmd run sitio
```

Quien tenga la contraseña y acceso al enlace podrá editar los informes. Compartir solo la biblioteca no requiere dar la contraseña del estudio.

**Un alojamiento estático como GitHub Pages no ejecuta la API de Node.** Para administrar y guardar desde internet de forma permanente, hay que desplegar el backend con almacenamiento persistente y HTTPS, o integrar un servicio de datos y autenticación. Servir los archivos JSON directamente desde un alojamiento estático tampoco aplica el filtrado de borradores que hace este servidor. Revisa ese flujo antes de subir la colección completa a un sitio público.

## Otros contenidos y CMS anterior

Eventos, participación, alianzas, equipo, convocatoria y configuración del sitio conservan sus archivos y formularios anteriores en `/admin/cms.html`. Para ese CMS heredado de Decap se necesita internet y su conector local:

```powershell
npm.cmd run cms
```

Mantén `npm.cmd run sitio` en otra terminal, o usa `npm.cmd run dev` para ambos procesos. El conector local de Decap es una herramienta de la computadora del editor: no tiene el acceso por contraseña del nuevo estudio y no debes compartir su puerto 8081 públicamente. Usa el estudio nuevo para los informes.

Para cambiar el logo manualmente, guarda la imagen en `assets/img/` y actualiza el campo `logo` de `contenido/sitio.json`. El menú y el pie se construyen en `js/layout.js`.

## Arquitectura

El sitio conserva HTML, CSS y JavaScript sin framework. El panel usa los mismos datos y el mismo lector editorial que la biblioteca pública.

| Ruta | Función |
|---|---|
| `index.html` | Inicio institucional |
| `analisis.html` | Biblioteca, filtros y lector integrado |
| `articulo.html` | Vista individual de publicaciones |
| `eventos.html`, `participacion.html`, `alianzas.html` | Secciones institucionales |
| `nosotros.html`, `convocatoria.html`, `contacto.html` | Equipo, convocatoria y contacto |
| `css/styles.css` | Identidad institucional y estilos generales |
| `css/periodico.css` | Portadas, biblioteca y lector |
| `js/visor-editorial.js` | Renderizado compartido y animación de hojas 3D |
| `js/datos.js`, `js/main.js`, `js/layout.js`, `js/utils.js` | Datos, páginas y utilidades públicas |
| `contenido/*.json` | Contenido del sitio |
| `admin/index.html`, `admin/studio.css`, `admin/studio.js` | Interfaz del estudio editorial |
| `admin/model.js` | Plantillas y validación compartidas por navegador y servidor |
| `admin/cms.html`, `admin/config.yml` | CMS anterior para otros contenidos |
| `herramientas/servidor.js`, `herramientas/admin-api.js` | Servidor y API de administración |
| `assets/img/subidas/` | Imágenes cargadas desde el panel |
| `.ceri/` | Credenciales y respaldos locales, ignorados por Git |

Paleta institucional: `#1f2f49`, `#27446e`, `#587eac`, `#f0efda`.

La edición original de Brasil conserva sus 14 páginas e imágenes. Está identificada como archivo con fecha de corte al **13 de octubre de 2026**. La integración técnica no constituye una nueva verificación de sus afirmaciones ni de sus referencias.

## Comprobaciones

```powershell
npm.cmd run validar
npm.cmd run test:admin
```

El validador revisa el contenido existente. Las pruebas del panel utilizan una carpeta temporal: comprueban acceso, sesiones, escrituras, carga de imágenes, borradores privados, publicación, conflictos de versión y conservación de informes anteriores. No cambian los informes del proyecto ni configuran su contraseña real.

La comprobación visual debe cubrir computadora y celular: inicio de sesión, creación, guardado, carga de fotos y páginas, vista previa y apertura de una edición publicada.

## Colaboración y pendientes

Trabaja en una rama, valida antes de subir cambios y abre un Pull Request para revisión. Mantén HTML, estilos y scripts en sus archivos correspondientes. No incluyas contraseñas ni datos de postulantes en el repositorio. Respeta los principios editoriales del CERI: independencia, imparcialidad, fuentes verificables y distinción entre hechos, interpretaciones y escenarios.

Los roles de autor, revisor y editor describen el flujo del equipo; los permisos por persona y un backend permanente para internet siguen pendientes. También quedan la confirmación de datos institucionales, el correo de contacto, las integraciones de formularios y las futuras secciones que acuerde el equipo.
