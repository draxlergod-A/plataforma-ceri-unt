# Publicar la web del CERI en internet

Esta guía es para el momento en que el equipo decida publicar el sitio. **Hasta entonces, nada de esto es necesario**: todo funciona en la computadora del proyecto con `npm.cmd run sitio`.

## Qué necesita el sitio

El sitio y el estudio son **un solo servidor Node.js** (versión 20 o posterior) que necesita:

1. **HTTPS**. Sin HTTPS, las contraseñas viajarían sin cifrar.
2. **Un disco persistente** para la carpeta de datos (`CERI_DATA_DIR`). Ahí se guardan las publicaciones, los borradores, las imágenes subidas, las cuentas, las sesiones, los mensajes, los respaldos y el registro de actividad. Si el alojamiento borra los archivos al reiniciar, se pierde todo lo que el equipo cargó.
3. **Un único proceso.** No ejecutes varias copias a la vez sobre la misma carpeta de datos.

Un alojamiento estático (GitHub Pages, Netlify sin funciones, etc.) **no sirve**: no ejecuta el servidor y no permitiría guardar ni iniciar sesión.

## Opciones de alojamiento

| Opción | Cuándo conviene |
|---|---|
| **Plataforma con contenedores y disco persistente** (por ejemplo Render, Railway o Fly.io) | El equipo prefiere no administrar un servidor. Revisa que el plan incluya un **disco o volumen persistente** y cuánto cuesta. |
| **Servidor virtual (VPS) con Docker y Caddy** | Control total y costo fijo. Caddy obtiene y renueva el certificado HTTPS solo. |
| **Servidor de la universidad** | Si la UNT ofrece alojamiento con Node.js, HTTPS y disco persistente. |

El repositorio incluye un `Dockerfile` que sirve para todas.

## Variables de entorno

| Variable | Valor en producción | Para qué sirve |
|---|---|---|
| `NODE_ENV` | `production` | Activa los avisos de configuración. Ya viene en el `Dockerfile`. |
| `HOST` | `0.0.0.0` | Escuchar fuera del contenedor. Ya viene en el `Dockerfile`. |
| `PORT` | `8080` (o el que indique la plataforma) | Puerto interno. |
| `CERI_DATA_DIR` | `/data` | Carpeta del disco persistente. Ya viene en el `Dockerfile`. |
| `CERI_PUBLIC_URL` | `https://tu-dominio` | Dirección pública. Se usa en `sitemap.xml`, en los enlaces canónicos y en la vista previa al compartir. **Obligatoria.** |
| `CERI_TRUST_PROXY` | `1` | Solo si hay un proxy HTTPS delante (Caddy, Nginx o la plataforma). Permite conocer la IP real para el límite de intentos y detectar HTTPS. **No la actives si el servidor recibe conexiones directas.** |
| `CERI_SESSION_HOURS` | `8` (opcional) | Duración de las sesiones. |

## Ejemplo: VPS con Docker y Caddy

En el servidor (con Docker y Caddy instalados y el dominio apuntando a su IP):

```bash
git clone https://github.com/draxlergod-A/plataforma-ceri-unt.git
```

```bash
cd plataforma-ceri-unt && docker build -t ceri-web .
```

```bash
docker run -d --name ceri --restart unless-stopped -p 127.0.0.1:8080:8080 -v ceri-datos:/data -e CERI_PUBLIC_URL=https://tu-dominio -e CERI_TRUST_PROXY=1 ceri-web
```

El puerto queda solo en `127.0.0.1`: únicamente Caddy puede llegar a él. Configuración de Caddy (`/etc/caddy/Caddyfile`):

```
tu-dominio {
  encode gzip
  reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo systemctl reload caddy
```

### Crear la primera cuenta

En un alojamiento no se puede usar "localhost", así que la primera cuenta se crea desde la terminal:

```bash
docker exec -it ceri node herramientas/cuentas.js crear-admin presidencia "Presidencia CERI"
```

El comando muestra una contraseña temporal. Entra en `https://tu-dominio/admin/` con ese usuario; el estudio pedirá crear una contraseña propia. Después, invita al equipo desde **Cuentas y roles**.

### Actualizar a una nueva versión

```bash
git pull && docker build -t ceri-web .
```

```bash
docker stop ceri && docker rm ceri
```

Y vuelve a ejecutar el mismo `docker run`. Los datos siguen en el volumen `ceri-datos`.

**Importante:** una vez publicado, la fuente de verdad del contenido es la carpeta de datos del servidor, no Git. Los cambios en `contenido/*.json` que lleguen por Git **no reemplazan** lo que el equipo editó en el estudio (solo se agregan publicaciones nuevas). Edita el contenido desde el estudio.

## Copias de seguridad fuera del servidor

El estudio guarda respaldos automáticos, pero viven en el mismo disco. Programa una copia externa periódica de la carpeta de datos, por ejemplo cada noche:

```bash
docker run --rm -v ceri-datos:/data -v /ruta/de/respaldos:/respaldo alpine tar czf /respaldo/ceri-$(date +%F).tar.gz -C /data .
```

Guarda esas copias en otro lugar (otra máquina o un almacenamiento en la nube) y prueba restaurarlas al menos una vez. Contienen cuentas y mensajes con datos personales: protégelas.

## Lista de verificación antes de anunciar el sitio

- [ ] El sitio abre con `https://` y redirige desde `http://`.
- [ ] `CERI_PUBLIC_URL` tiene el dominio definitivo; `https://tu-dominio/sitemap.xml` muestra ese dominio.
- [ ] La carpeta de datos está en un disco persistente: reinicia el servicio y comprueba que las cuentas y publicaciones siguen ahí.
- [ ] `https://tu-dominio/.ceri/usuarios.json`, `/package.json` y `/herramientas/servidor.js` responden **404**.
- [ ] Cada persona del equipo tiene su propia cuenta con el rol mínimo que necesita; la cuenta `admin` heredada se desactivó o cambió de contraseña.
- [ ] Solo dos o tres personas tienen rol de administración.
- [ ] En **Contenido del sitio** están el correo institucional real y la directiva (el panel **Pendientes** queda vacío).
- [ ] Un mensaje de prueba enviado desde **Contacto** aparece en **Mensajes**.
- [ ] Al compartir el enlace de un informe en WhatsApp aparece su título e imagen.
- [ ] Hay una copia externa programada de la carpeta de datos y se probó restaurarla.
- [ ] `npm run comprobar` pasa sin errores en la versión publicada.

## Mejoras opcionales para más adelante

- **Avisos por correo** cuando llega un mensaje de contacto o un informe pasa a revisión (requiere un servicio de envío de correos).
- **Verificación en dos pasos** para las cuentas de administración.
- **Postulaciones a la convocatoria** dentro del propio sitio, en lugar de un formulario externo. Implica guardar datos personales de postulantes: definan antes quién puede verlos y por cuánto tiempo.
