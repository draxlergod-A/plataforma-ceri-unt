# Web del CERI – UNT

Sitio web del **Círculo de Estudios de Relaciones Internacionales (CERI)** de la Universidad Nacional de Trujillo.
Objetivo: publicar informes y análisis de la política actual de forma **imparcial**, además de eventos, participación, alianzas y convocatorias.

Es una web **estática** (solo HTML, CSS y JavaScript). No necesita servidor ni base de datos por ahora.

## Cómo verla

Abre `index.html` con doble clic en el navegador. Para trabajar mejor, usa la extensión **Live Server** de VS Code.

## Estructura

```
ceri-web/
├── index.html          Inicio
├── analisis.html       Lista de análisis e informes (con filtros y buscador)
├── articulo.html       Plantilla que muestra una publicación (articulo.html?id=...)
├── eventos.html        Próximos y realizados (se separan solos según la fecha)
├── participacion.html  Línea de tiempo de participación
├── alianzas.html       Organizaciones aliadas
├── nosotros.html       Quiénes somos y principios editoriales
├── convocatoria.html   Requisitos y botón para postular
├── css/styles.css      Todos los estilos (colores en :root)
├── js/data.js          TODO EL CONTENIDO se edita aquí
├── js/layout.js        Menú y pie de página (comunes a todas las páginas)
├── js/main.js          Lógica de cada página
└── assets/img/         Logo, favicon y fotos
```

## Cómo editar el contenido

Todo está en `js/data.js`:

| Quiero...                  | Edito en `data.js`                                |
|----------------------------|---------------------------------------------------|
| Publicar un análisis       | Copiar un bloque de `PUBLICACIONES` y cambiarlo  |
| Agregar un evento          | Agregar un bloque en `EVENTOS`                    |
| Abrir/cerrar convocatoria  | `CONVOCATORIA.abierta: true / false`              |
| Cambiar correo o redes     | Objeto `SITIO`                                    |

Cada publicación debe seguir la estructura imparcial: **resumen → hechos → posturas → escenarios → fuentes**.
El `id` de cada publicación debe ser único, en minúsculas y con guiones (ej. `elecciones-peru-2026`).

## Dónde poner el logo y las imágenes

- **Logo:** guardar en `assets/img/logo.png`. En `js/layout.js`, buscar el comentario `LOGO` y reemplazar
  `<span class="brand-mark">CERI</span>` por `<img src="assets/img/logo.png" alt="Logo CERI" class="brand-logo">`.
- **Favicon:** `assets/img/favicon.png`, y quitar el comentario en el `<head>` de cada HTML.
- **Foto del equipo:** `assets/img/equipo.jpg`, ver comentario en `nosotros.html`.
- **Logos de alianzas:** `assets/img/alianzas/`, ver comentario en `js/main.js` → `paginaAlianzas`.

## Pendientes (TODO)

### Contenido (lo da el CERI)
- [ ] Logo oficial y favicon
- [ ] Correo y link de Facebook reales (`SITIO` en `data.js`)
- [ ] Texto completo del análisis de Brasil (hoy tiene campos `TODO`)
- [ ] Borrar la publicación `plantilla-ejemplo` cuando haya contenido real
- [ ] Fecha real del ciclo de conferencias de geopolítica
- [ ] Directiva / equipo (nombres, cargos, fotos)
- [ ] Confirmar cuáles organizaciones son alianzas formales
- [ ] Link del Google Form de la próxima convocatoria
- [ ] Fotos de eventos (con permiso de las personas que aparecen)

### Funcionalidades por implementar
- [ ] Páginas por autor (perfil de cada miembro con sus publicaciones)
- [ ] Descarga de informes en PDF
- [ ] Boletín por correo (Mailchimp, Brevo o similar)
- [ ] Formulario de contacto (Formspree o Google Forms)
- [ ] Botones para compartir en WhatsApp / X / Facebook en cada publicación
- [ ] Paginación cuando haya muchas publicaciones
- [ ] Galería de fotos por evento
- [ ] Sección "Vuelta al Mundo CERI" (mapa con fichas de países)
- [ ] SEO: etiquetas Open Graph para que se vea bien al compartir el link
- [ ] Panel de administración (CMS) para que el equipo publique sin tocar código
      (opciones: Decap CMS, migrar a Astro/Next.js o WordPress)

### Técnico
- [ ] Publicar en GitHub Pages o Netlify
- [ ] Dominio propio (ej. ceri-unt.org)
- [ ] Revisar accesibilidad y velocidad (Lighthouse en Chrome)
- [ ] El menú y el pie se generan con JavaScript; si se migra a un framework, convertirlos en componentes

## Publicar en GitHub Pages

1. Crear repositorio y subir los archivos (la carpeta con `index.html` en la raíz).
2. Settings → Pages → Branch `main` → carpeta `/ (root)` → Save.
3. En 1–2 minutos estará en `https://USUARIO.github.io/NOMBRE-REPO/`.

## Reglas para colaboradores

1. Crear una rama por cambio: `git checkout -b feature/nombre-del-cambio`.
2. Mensajes de commit claros: `Agrega análisis sobre elecciones`, `Corrige menú en celular`.
3. Abrir un Pull Request y pedir revisión antes de unir a `main`.
4. El contenido político debe respetar los **principios editoriales** de `nosotros.html`:
   independencia, imparcialidad, fuentes verificables y separación entre hechos y opinión.
5. No subir fotos de personas sin su permiso.
