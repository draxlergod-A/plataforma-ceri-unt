/* =========================================================
   layout.js — ENCABEZADO Y PIE DE PÁGINA
   Se escriben una sola vez aquí y aparecen en todas las páginas.
   ========================================================= */

const MENU = [
  { href: "index.html", texto: "Inicio", id: "inicio" },
  { href: "analisis.html", texto: "Análisis e informes", id: "analisis" },
  { href: "eventos.html", texto: "Eventos", id: "eventos" },
  { href: "participacion.html", texto: "Participación", id: "participacion" },
  { href: "alianzas.html", texto: "Alianzas", id: "alianzas" },
  { href: "nosotros.html", texto: "Nosotros", id: "nosotros" },
  { href: "convocatoria.html", texto: "Convocatoria", id: "convocatoria" }
];

function renderHeader() {
  const actual = document.body.dataset.page;
  const links = MENU.map(m =>
    `<li><a href="${m.href}" ${m.id === actual ? 'aria-current="page"' : ""}>${m.texto}</a></li>`
  ).join("");

  document.getElementById("site-header").innerHTML = `
    <div class="container header-inner">
      <a class="brand" href="index.html">
        <!-- ============ LOGO ============
             Guarda el logo en: assets/img/logo.png
             y reemplaza el <span class="brand-mark"> de abajo por:
             <img src="assets/img/logo.png" alt="Logo CERI" class="brand-logo">
             ================================ -->
        <span class="brand-mark" aria-hidden="true">CERI</span>
        <span class="brand-text">
          <strong>${SITIO.nombre}</strong>
          <small>${SITIO.universidad}</small>
        </span>
      </a>
      <button class="menu-toggle" aria-expanded="false" aria-controls="menu">Menú</button>
      <nav id="menu" aria-label="Principal"><ul>${links}</ul></nav>
    </div>`;

  const btn = document.querySelector(".menu-toggle");
  const nav = document.getElementById("menu");
  btn.addEventListener("click", () => {
    const abierto = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", abierto);
  });
}

function renderFooter() {
  const anio = new Date().getFullYear();
  document.getElementById("site-footer").innerHTML = `
    <div class="container footer-grid">
      <div>
        <strong>${SITIO.nombreCompleto}</strong>
        <p>${SITIO.facultad}<br>${SITIO.universidad}</p>
        <p class="muted">Reconocido mediante ${SITIO.reconocimiento}.</p>
      </div>
      <div>
        <strong>Contacto</strong>
        <p><a href="mailto:${SITIO.correo}">${SITIO.correo}</a></p>
        <p><a href="${SITIO.instagram}" target="_blank" rel="noopener">Instagram</a> ·
           <a href="${SITIO.facebook}" target="_blank" rel="noopener">Facebook</a></p>
      </div>
      <div>
        <strong>Compromiso editorial</strong>
        <p>Publicamos con independencia de partidos y gobiernos.
           <a href="nosotros.html#principios">Ver nuestros principios</a>.</p>
      </div>
    </div>
    <div class="container footer-bottom">© ${anio} ${SITIO.nombre} – ${SITIO.universidad}</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
});
