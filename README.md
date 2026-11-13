# Web del CERI – UNT

Sitio web del **Círculo de Estudios de Relaciones Internacionales (CERI)** de la Universidad Nacional de Trujillo.

**Objetivo:** publicar informes y análisis de la política actual de forma **imparcial**, además de eventos, participación, alianzas y convocatorias.

**Estado:** versión 2, **en construcción y sin publicar**. Por ahora todo funciona solo en la computadora (modo local).

---

## 1. Requisitos

| Programa | Para qué | Dónde se descarga |
|---|---|---|
| **VS Code** | Editar el código | code.visualstudio.com |
| **Node.js** (versión LTS) | Encender la web y el panel | nodejs.org |
| **Git** | Guardar versiones y trabajar en equipo | git-scm.com |
| Extensión **Live Server** (opcional) | Ver la web desde VS Code | Pestaña Extensiones de VS Code |

La primera vez que se usa el panel hace falta **internet**, porque descarga sus herramientas.

---

## 2. Cómo encender la web y el panel

1. Abre la carpeta `ceri-web` en VS Code.
2. Abre la terminal: menú **Terminal → New Terminal**.
3. Escribe:
   ```
   npm run dev
   ```
4. Abre en el navegador:
   - **La web:** http://localhost:5500
   - **El panel:** http://localhost:5500/admin/

Para apagar todo, entra a la terminal y presiona `Ctrl + C`.

> ⚠️ Ya **no** funciona abrir `index.html` con doble clic: el contenido está en la carpeta `contenido/` y la web necesita un servidor local. Si lo intentas, la página te mostrará un aviso.

**Otros comandos:**

| Comando | Qué hace |
|---|---|
| `npm run dev` | Enciende la web y el panel juntos (lo normal) |
| `npm run sitio` | Enciende solo la web |
| `npm run cms` | Enciende solo el conector del panel (útil si usas Live Server) |
| `npm run validar` | Revisa errores en el contenido: ids repetidos, fechas mal escritas, publicaciones sin fuentes, textos PENDIENTE |

---

## 3. Cómo funciona

```
 Panel (/admin)  ──guarda──▶  contenido/*.json  ──lee──▶  Páginas de la web
 (formularios)                (los datos)                 (HTML + CSS + JS)
```

- **El panel** (Decap CMS) es una pantalla con formularios. Al guardar, escribe en los archivos de `contenido/`.
- **La web** lee esos archivos y arma las páginas sola.
- Para publicar algo **no se toca el código**.

### Flujo de una publicación (imparcialidad)

Cada publicación tiene un **Estado**:

| Estado | Quién lo pone | ¿Se ve en la web? |
|---|---|---|
| `Borrador` | El autor mientras escribe | No |
| `En revisión` | El autor cuando termina | No |
| `Publicado` | El editor, después de que el revisor apruebe | **Sí** |

Estructura obligatoria: **Resumen → Hechos verificados → Posturas de los actores → Análisis → Escenarios → Fuentes**. Si después se corrige un error, se registra en **Correcciones**.

---

## 4. Estructura de carpetas

```
ceri-web/
├── index.html            Inicio (publicación destacada, últimas, eventos)
├── analisis.html         Lista de publicaciones con filtros, buscador y "Cargar más"
├── articulo.html         Muestra una publicación (articulo.html?id=...)
├── eventos.html          Próximos y realizados (se separan solos por fecha)
├── participacion.html    Línea de tiempo
├── alianzas.html         Organizaciones aliadas
├── nosotros.html         Quiénes somos, principios editoriales y equipo
├── convocatoria.html     Requisitos, proceso y botón de postulación
├── contacto.html         Formulario de contacto
├── 404.html              Página de error
│
├── css/styles.css        Todos los estilos (colores en :root, al inicio)
│
├── js/utils.js           Ayudas: fechas, seguridad del texto, Markdown, compartir
├── js/datos.js           Carga los archivos de contenido/
├── js/layout.js          Menú y pie de página (comunes a todas las páginas)
├── js/main.js            Lógica de cada página
│
├── contenido/            ◀ EL CONTENIDO (lo edita el panel)
│   ├── sitio.json            Nombre, logo, correo, redes, lema
│   ├── publicaciones.json    Análisis e informes
│   ├── eventos.json
│   ├── participacion.json
│   ├── alianzas.json
│   ├── equipo.json           Directiva
│   └── convocatoria.json
│
├── admin/
│   ├── index.html        El panel
│   └── config.yml        Qué campos tiene el panel
│
├── assets/img/           Logo, favicon e imágenes
│   └── subidas/          Imágenes subidas desde el panel
│
├── herramientas/validar.js   Revisión del contenido (npm run validar)
└── package.json              Comandos (npm run ...)
```

---

## 5. Dónde poner el logo

**Opción A (desde el panel, recomendada):**
1. `npm run dev` → abre http://localhost:5500/admin/
2. Entra a **Configuración → Configuración del sitio → Logo**.
3. Sube la imagen y dale **Publicar / Guardar**.

**Opción B (manual):**
1. Guarda el archivo como `assets/img/logo.png`.
2. Abre `contenido/sitio.json` y cambia `"logo": ""` por `"logo": "assets/img/logo.png"`.

En los dos casos el logo reemplaza al círculo azul que dice "CERI" en el menú. El código está en `js/layout.js`, en el comentario `LOGO`.

**Favicon** (el ícono de la pestaña): guárdalo en `assets/img/favicon.png` y, en el `<head>` de cada archivo `.html`, quita el comentario de la línea `<link rel="icon" ...>`.

---

## 6. Roles del equipo

| Rol | Quién | Qué hace |
|---|---|---|
| Autor | Miembros del CERI | Escribe en estado *Borrador* / *En revisión* |
| Revisor | 1–2 miembros | Revisa imparcialidad y fuentes; escribe su nombre en "Revisado por" |
| Editor | Directiva | Cambia el estado a *Publicado* |
| Admin técnico | Desarrollador | Código, diseño y configuración |

> En modo local el panel **no tiene usuarios ni contraseñas**: lo usa quien tenga la computadora. Los permisos reales por persona se activan cuando se publique (ver Pendientes).

---

## 7. Pendientes

### Contenido (lo entrega el CERI)
- [ ] Logo oficial y favicon
- [ ] Correo, Facebook y WhatsApp reales (Configuración del sitio)
- [ ] Completar el análisis de Brasil (tiene textos `PENDIENTE`)
- [ ] Borrar la publicación de ejemplo `borrador-de-ejemplo`
- [ ] Fecha real del ciclo de conferencias de geopolítica
- [ ] Directiva: nombres, cargos y fotos (con permiso)
- [ ] Confirmar qué alianzas son formales (campo "¿Alianza formal confirmada?")
- [ ] Enlace del Google Form de la próxima convocatoria

### Funciones por implementar
- [ ] Página por autor (perfil con sus publicaciones)
- [ ] Descargar informes en PDF
- [ ] Boletín por correo (Brevo, Mailchimp)
- [ ] Formulario de contacto real con Formspree (hoy abre el correo del visitante)
- [ ] Galería de fotos por evento
- [ ] Sección "Vuelta al Mundo CERI" (mapa con fichas de países)
- [ ] Vista previa del panel con el diseño real de la web (`CMS.registerPreviewTemplate`)
- [ ] Separar cada publicación en su propio archivo cuando haya muchas (carpeta + GitHub Actions para generar el índice)

### Al publicar (todavía no)
- [ ] Subir a GitHub (repositorio privado mientras se construye)
- [ ] Publicar en Netlify o GitHub Pages
- [ ] Cambiar `backend` en `admin/config.yml` y activar los usuarios del panel (Netlify Identity / Git Gateway o GitHub)
- [ ] Activar `publish_mode: editorial_workflow` para que el flujo Borrador → Revisión → Publicado lo controle el panel con permisos
- [ ] Imagen para compartir en redes (`og:image` en cada HTML)
- [ ] Dominio propio (opcional)
- [ ] Revisar velocidad y accesibilidad con Lighthouse (Chrome → F12 → Lighthouse)

---

## 8. Reglas para colaboradores

1. **Nunca trabajar directo en `main`.** Crear una rama:
   `git checkout -b feature/nombre-del-cambio`
2. Commits claros: `Agrega página de autores`, `Corrige menú en celular`.
3. Antes de subir: `npm run validar` sin errores y revisar la web en celular (F12 → modo dispositivo).
4. Abrir un **Pull Request** y esperar la revisión del admin.
5. **El código va en su archivo:** HTML en `.html`, estilos en `css/styles.css`, lógica en `js/`. Nada de estilos o scripts dentro del HTML.
6. **Contenido político:** respetar los principios editoriales (independencia, imparcialidad, fuentes verificables, hecho vs. opinión).
7. No subir fotos de personas sin su permiso.
8. Los datos de postulantes (Google Forms) son de la directiva y no van en el repositorio (Ley N.° 29733).
