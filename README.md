# Web del CERI - UNT

Sitio del **Círculo de Estudios de Relaciones Internacionales de la Universidad Nacional de Trujillo**. Incluye la biblioteca de informes digitales, el lector de libros y el **estudio editorial**: un panel con cuentas por persona y roles para preparar, revisar y publicar todo el contenido sin editar código.

## Iniciar en VS Code

Requisitos: Node.js 20 o posterior, Git y VS Code. Abre la carpeta `plataforma-ceri-unt` y, en **Terminal → Nueva terminal**, ejecuta:

```powershell
npm.cmd run sitio
```

- Web: http://localhost:5500/
- Biblioteca: http://localhost:5500/analisis.html
- Estudio editorial: http://localhost:5500/admin/

Mantén la terminal abierta. Para detener el servidor, pulsa `Ctrl + C`. Si el puerto 5500 está ocupado (por ejemplo, por Live Server), usa otro:

```powershell
$env:PORT = '5501'
npm.cmd run sitio
```

`npm.cmd` evita el bloqueo de `npm.ps1` en PowerShell. También puedes usar **F5** en VS Code con el perfil **CERI: iniciar y abrir el administrador** (puerto 5501).

El sitio no necesita instalar paquetes para funcionar. Abrir el HTML con doble clic o usar solo Live Server no permite guardar ni publicar: hace falta este servidor.

## Cuentas y roles

Cada persona del equipo entra con **su propio usuario y contraseña**. El rol define qué puede hacer, y el servidor lo comprueba en cada acción (ocultar un botón no basta para saltarse un permiso).

| Rol | Puede |
|---|---|
| **Autor/a** | Crear informes y notas, editar los suyos mientras sean borradores o estén en revisión, enviarlos a revisión y subir imágenes. No publica. |
| **Revisor/a** | Lo anterior, y además revisar, corregir y **firmar como revisor** cualquier publicación que aún no esté publicada. No publica. |
| **Editor/a** | Lo anterior, y además **publicar, actualizar, retirar y eliminar** publicaciones, borrar imágenes sin uso, editar eventos, participación, alianzas, equipo y convocatoria, leer los mensajes de contacto y descargar copias. |
| **Administrador/a** | Todo, y además crear cuentas, cambiar roles, restablecer contraseñas, editar los datos institucionales (correo, redes, lema), restaurar respaldos y ver el registro de actividad. |

Los permisos están definidos en un solo lugar: `admin/permisos.js`.

### Cuentas compartidas con todo el equipo

Las cuentas y todas las publicaciones (incluidos los borradores) se guardan en **`datos-equipo/`**, que **sí va a Git**. Así, quien haga `git pull` ve las mismas cuentas, roles y borradores, y entra con su propio usuario. Las contraseñas no se guardan: solo su huella cifrada con scrypt.

1. El repositorio ya trae la cuenta **`admin`**, con una contraseña temporal que el responsable entrega al equipo de forma privada. Al entrar por primera vez, el estudio pide cambiarla.
2. En **Cuentas y roles**, el admin crea la cuenta de cada persona y le entrega su contraseña temporal.
3. **Después de crear cuentas, cambiar contraseñas o editar borradores, haz commit y push de `datos-equipo/`** para que el resto lo reciba con `git pull`.

Si dos personas cambian `datos-equipo/` a la vez, Git puede pedir resolver un conflicto. Para evitarlo, haz `git pull` antes de empezar y sube los cambios al terminar.

Lo que **no** va a Git, porque es de cada computadora, está en `.ceri/`: sesiones, mensajes de contacto, respaldos automáticos y el registro de actividad.

**Recomendación:** mantén el repositorio **privado**. Aunque las contraseñas están cifradas, los borradores y la lista de cuentas no deberían ser públicos.

### Olvidé mi contraseña

Una persona con rol de administración la restablece desde **Cuentas y roles**. Si nadie puede entrar, en la terminal del servidor:

```powershell
npm.cmd run cuentas -- listar
npm.cmd run cuentas -- restablecer <usuario>
npm.cmd run cuentas -- crear-admin <usuario> "<Nombre completo>"
```

### Seguridad del acceso

- Las contraseñas se guardan con sal y scrypt; nunca en texto plano.
- Las sesiones duran 8 horas y sobreviven a un reinicio del servidor. Cambiar la contraseña, el rol o desactivar una cuenta cierra sus sesiones.
- Tras 5 intentos fallidos, la cuenta se bloquea 15 minutos; también hay un límite por dirección. Los intentos fallidos quedan en el registro de actividad.
- Toda escritura exige sesión, origen permitido y token CSRF. La cookie es `HttpOnly`, `SameSite=Strict` y `Secure` con HTTPS.
- No compartas ni subas a Git la carpeta `.ceri/`.

## Flujo editorial

1. **Autor/a**: pulsa **+ Nueva edición** (libro con páginas) o **+ Nueva nota** (texto continuo).
2. Completa los pasos **Información**, **Portada** o **Imagen**, y **Páginas** o **Contenido**. Usa **Vista previa** para leerlo como lo verá el público.
3. En **Revisar y enviar**, pulsa **Enviar a revisión**.
4. **Revisor/a**: abre las publicaciones en revisión (aparecen en **Pendientes**), corrige y pulsa **Firmar como revisor/a**.
5. **Editor/a o administración**: resuelve los puntos pendientes y pulsa **Publicar en la biblioteca**. La publicación exige portada, contenido, descripciones de las fotos y al menos una fuente con nombre y enlace.
6. Pulsa **Ver en la web** o **Copiar enlace**. Al compartir el enlace en WhatsApp, Facebook o X aparece con su título, resumen e imagen.

Para ocultar una publicación sin perderla, usa **Retirar a borrador**. Para borrarla, usa **Eliminar**; queda una copia en los respaldos.

### Imágenes

En un bloque de imagen, elige una foto de la biblioteca o sube JPG, PNG, WebP o GIF (hasta 12 MB). El estudio optimiza las fotos grandes. En **Imágenes** se ve dónde se usa cada una; edición y administración pueden **eliminar las que no se usan**.

Si ya tienes páginas diseñadas como imágenes, usa **Subir páginas diseñadas**. Para contenido nuevo es mejor usar texto y fotos por bloques: el texto se puede seleccionar y es más accesible.

## Contenido del sitio

En **Contenido del sitio** se editan eventos, participación, alianzas, equipo y convocatoria (editor/a y administración), y los **datos institucionales** como el correo, las redes y el lema (solo administración). Al guardar, los cambios se ven de inmediato en la web. Cada campo se valida: fechas, horas, enlaces `https://` y rutas de imagen.

El estudio muestra una lista de **Pendientes** con lo que falta antes de publicar el sitio. Hoy faltan el correo institucional real y los nombres de la directiva.

## Mensajes de contacto

El formulario de **Contacto** guarda los mensajes en el servidor. Editor/a y administración los leen en **Mensajes**, los marcan como leídos y los responden por correo. Para evitar abusos hay un límite de mensajes por hora y un campo trampa para robots. Los mensajes contienen datos personales: trátalos con cuidado y elimina los que ya no sean necesarios.

## Respaldos y actividad

Cada guardado respalda la versión anterior en `.ceri/backups/` y conserva los últimos 30 respaldos por sección. En **Respaldos y actividad**, administración puede descargarlos o **restaurarlos**. Restaurar también respalda el estado actual, así que se puede deshacer. El **registro de actividad** muestra quién creó, publicó, eliminó o cambió algo, y cuándo.

Si dos personas guardan a partir de la misma versión, la segunda recibe un aviso de conflicto y sus cambios no sobrescriben los de la otra. Los cambios sin guardar quedan recuperables en ese navegador.

## Publicar en internet

Todavía no está publicado. Cuando el equipo decida hacerlo, sigue **[DESPLIEGUE.md](DESPLIEGUE.md)**: explica cómo elegir el alojamiento, qué variables configurar, cómo crear la primera cuenta y una lista de verificación de seguridad.

Resumen: el sitio necesita un servidor Node.js con **HTTPS** y un **disco persistente** para la carpeta de datos. Un alojamiento estático como GitHub Pages **no** sirve para el estudio. Aun así, el archivo público ya no contiene borradores.

## Arquitectura

HTML, CSS y JavaScript sin framework. El servidor no tiene dependencias externas; Prettier solo se usa para dar formato al código.

| Ruta | Función |
|---|---|
| `index.html`, `analisis.html`, `articulo.html`… | Páginas públicas |
| `css/`, `js/` | Estilos, lector editorial (`js/visor-editorial.js`) y lógica de cada página |
| `contenido/*.json` | Contenido público (solo lo publicado) |
| `admin/index.html`, `admin/studio.css` | Interfaz del estudio |
| `admin/studio.js` | Biblioteca y editor de publicaciones |
| `admin/secciones.js` | Contenido del sitio, mensajes, cuentas, respaldos y mi cuenta |
| `admin/permisos.js` | Roles y permisos (navegador y servidor) |
| `admin/model.js` | Modelo y validación de ediciones y notas |
| `admin/colecciones.js` | Esquemas del contenido del sitio |
| `herramientas/servidor.js` | Servidor: archivos públicos, seguridad, metadatos, `robots.txt`, `sitemap.xml` |
| `herramientas/admin-api.js` | API del estudio |
| `herramientas/usuarios.js` | Cuentas, sesiones y límite de intentos |
| `herramientas/almacen.js` | Escrituras atómicas, respaldos, almacén privado y registro de actividad |
| `herramientas/contacto.js` | Formulario de contacto |
| `herramientas/cuentas.js` | Gestión de cuentas desde la terminal |
| `herramientas/config.js` | Variables de entorno |
| `assets/img/subidas/` | Imágenes subidas desde el estudio |
| `datos-equipo/` | Cuentas (contraseñas cifradas) y todas las publicaciones con borradores: se comparten por Git |
| `.ceri/` | Sesiones, mensajes, respaldos y registro de esta computadora (fuera de Git) |

El servidor solo entrega archivos de una lista permitida: el código del servidor, `package.json`, el README y `.ceri/` no son accesibles desde el navegador.

Paleta institucional: `#1f2f49`, `#27446e`, `#587eac`, `#f0efda`.

La edición original de Brasil conserva sus 14 páginas (ahora en WebP, con la mitad de peso). Está identificada como archivo con fecha de corte al **13 de octubre de 2026**. La integración técnica no constituye una nueva verificación de sus afirmaciones ni de sus referencias.

## Comprobaciones

```powershell
npm.cmd install
npm.cmd run comprobar
```

`comprobar` ejecuta el validador de contenido, las pruebas y la revisión de formato. Las pruebas usan carpetas temporales y cubren roles y permisos, sesiones, bloqueo por intentos, migración de la cuenta anterior, borradores privados, conflictos, imágenes, contenido del sitio, respaldos, contacto y la protección de archivos. GitHub Actions las ejecuta en cada push y Pull Request.

Para dar formato al código antes de subir cambios: `npm.cmd run formato`.

## Colaboración

Trabaja en una rama, ejecuta `npm.cmd run comprobar` y abre un Pull Request para revisión. No incluyas contraseñas, la carpeta `.ceri/` ni datos de postulantes en el repositorio. Respeta los principios editoriales del CERI: independencia, imparcialidad, fuentes verificables y distinción entre hechos, interpretaciones y escenarios.
