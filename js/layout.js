/* Encabezado y pie institucional compartidos por todas las páginas. */
const MENU = [
  { href: "index.html", texto: "Inicio", id: "inicio" },
  { href: "analisis.html", texto: "Informes y análisis", id: "analisis" },
  { href: "eventos.html", texto: "Eventos", id: "eventos" },
  { href: "participacion.html", texto: "Participación", id: "participacion" },
  { href: "alianzas.html", texto: "Alianzas", id: "alianzas" },
  { href: "nosotros.html", texto: "Nosotros", id: "nosotros" },
  { href: "convocatoria.html", texto: "Convocatoria", id: "convocatoria" },
  { href: "contacto.html", texto: "Contacto", id: "contacto" }
];
function renderHeader(sitio) {
  const actual = document.body.dataset.page;
  const links = MENU.map(
    m =>
      `<li><a href="${m.href}" ${m.id === actual || (actual === "articulo" && m.id === "analisis") ? 'aria-current="page"' : ""}>${m.texto}</a></li>`
  ).join("");
  const logo = sitio.logo
    ? `<img src="${esc(rutaImagen(sitio.logo))}" alt="Logo CERI" class="brand-logo">`
    : '<span class="brand-mark" aria-hidden="true">CERI</span>';
  document.getElementById("site-header").innerHTML =
    `<div class="container header-inner"><a class="brand" href="index.html" aria-label="CERI, inicio">${logo}<span class="brand-text"><strong>Círculo de Estudios de<br>Relaciones Internacionales</strong><small>${esc(sitio.universidad || "Universidad Nacional de Trujillo")}</small></span></a><button type="button" class="menu-toggle" aria-expanded="false" aria-controls="menu">☰ Menú</button><nav id="menu" aria-label="Navegación principal"><ul>${links}</ul></nav></div>`;
  const button = document.querySelector(".menu-toggle"),
    nav = document.getElementById("menu");
  const close = () => {
    nav.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      close();
      button.focus();
    }
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#site-header")) close();
  });
}
function renderFooter(sitio) {
  const redes = [
    sitio.instagram &&
      `<a href="${esc(urlSegura(sitio.instagram))}" target="_blank" rel="noopener">Instagram ↗</a>`,
    sitio.facebook &&
      `<a href="${esc(urlSegura(sitio.facebook))}" target="_blank" rel="noopener">Facebook ↗</a>`
  ]
    .filter(Boolean)
    .join(" · ");
  const correo = sitio.correo && !/^correo@/.test(sitio.correo) ? sitio.correo : "";
  document.getElementById("site-footer").innerHTML =
    `<div class="container"><div class="footer-heading">CERI<span>Entender el mundo.<br>Construir perspectivas.</span></div><div class="footer-grid"><div><strong>${esc(sitio.nombreCompleto || "Círculo de Estudios de Relaciones Internacionales")}</strong><p>${esc(sitio.facultad || "")}<br>${esc(sitio.universidad || "Universidad Nacional de Trujillo")}</p>${sitio.reconocimiento ? `<p class="muted">${esc(sitio.reconocimiento)}</p>` : ""}</div><div><strong>Conecta con el CERI</strong><p>${redes}</p>${correo ? `<p><a href="mailto:${esc(correo)}">${esc(correo)}</a></p>` : ""}<p><a href="contacto.html">Contacto y colaboraciones →</a></p></div><div><strong>Investigación con criterio</strong><p>Hechos, contexto y diversas perspectivas para comprender la política nacional e internacional.</p><p><a href="nosotros.html#principios">Nuestros principios editoriales →</a></p></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} CERI · Universidad Nacional de Trujillo</span><span>Trujillo, Perú · Desde 2024</span></div></div>`;
}
