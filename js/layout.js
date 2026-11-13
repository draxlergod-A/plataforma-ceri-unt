/* =========================================================
   layout.js — ENCABEZADO Y PIE DE PÁGINA
   Se escriben una sola vez aquí y aparecen en todas las páginas.
   Para agregar una página al menú, añádela a la lista MENU.
   ========================================================= */

const MENU = [
  { href: "index.html", texto: "Inicio", id: "inicio" },
  { href: "analisis.html", texto: "Análisis", id: "analisis" },
  { href: "eventos.html", texto: "Eventos", id: "eventos" },
  { href: "participacion.html", texto: "Participación", id: "participacion" },
  { href: "alianzas.html", texto: "Alianzas", id: "alianzas" },
  { href: "nosotros.html", texto: "Nosotros", id: "nosotros" },
  { href: "convocatoria.html", texto: "Convocatoria", id: "convocatoria" },
  { href: "contacto.html", texto: "Contacto", id: "contacto" }
];

function renderHeader(sitio) {
  const actual = document.body.dataset.page;
  const links = MENU.map(m =>
    `<li><a href="${m.href}" ${m.id === actual ? 'aria-current="page"' : ""}>${m.texto}</a></li>`
  ).join("");

  /* ============ LOGO ============
     Opción 1 (panel): Panel → Configuración del sitio → Logo.
     Opción 2 (manual): guarda el archivo en assets/img/logo.png y en
     contenido/sitio.json escribe:  "logo": "assets/img/logo.png"
     Si no hay logo, se muestra el círculo azul con el texto CERI.
     ================================ */
  const logo = sitio.logo
    ? `<img src="${esc(rutaImagen(sitio.logo))}" alt="Logo ${esc(sitio.nombre)}" class="brand-logo">`
    : `<span class="brand-mark" aria-hidden="true">${esc(sitio.nombre || "CERI")}</span>`;

  document.getElementById("site-header").innerHTML = `
    <div class="container header-inner">
      <a class="brand" href="index.html">
        ${logo}
        <span class="brand-text">
          <strong>${esc(sitio.nombre)}</strong>
          <small>${esc(sitio.universidad)}</small>
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

function renderFooter(sitio) {
  const anio = new Date().getFullYear();
  const redes = [
    sitio.instagram && `<a href="${esc(urlSegura(sitio.instagram))}" target="_blank" rel="noopener">Instagram</a>`,
    sitio.facebook && `<a href="${esc(urlSegura(sitio.facebook))}" target="_blank" rel="noopener">Facebook</a>`
  ].filter(Boolean).join(" · ");

  document.getElementById("site-footer").innerHTML = `
    <div class="container footer-grid">
      <div>
        <strong>${esc(sitio.nombreCompleto)}</strong>
        <p>${esc(sitio.facultad)}<br>${esc(sitio.universidad)}</p>
        ${sitio.reconocimiento ? `<p class="muted">Reconocido mediante ${esc(sitio.reconocimiento)}.</p>` : ""}
      </div>
      <div>
        <strong>Contacto</strong>
        ${sitio.correo ? `<p><a href="mailto:${esc(sitio.correo)}">${esc(sitio.correo)}</a></p>` : ""}
        <p>${redes}</p>
      </div>
      <div>
        <strong>Compromiso editorial</strong>
        <p>Publicamos con independencia de partidos y gobiernos.
           <a href="nosotros.html#principios">Ver nuestros principios</a>.</p>
      </div>
    </div>
    <div class="container footer-bottom">© ${anio} ${esc(sitio.nombre)} – ${esc(sitio.universidad)}</div>`;
}
