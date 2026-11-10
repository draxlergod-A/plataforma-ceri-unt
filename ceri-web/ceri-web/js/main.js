/* =========================================================
   main.js — LÓGICA DE LAS PÁGINAS
   Cada página llama a su función según el atributo
   data-page del <body>.
   ========================================================= */

/* ---------- Utilidades ---------- */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

function formatearFecha(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

function hoyISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

// Evita que texto con < > rompa la página
function esc(txt) {
  return String(txt ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function ordenarPorFecha(lista, desc = true) {
  return [...lista].sort((a, b) => desc ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha));
}

/* ---------- Tarjetas ---------- */
function tarjetaPublicacion(p) {
  return `
    <article class="card">
      <p class="meta"><span class="tag">${esc(p.tipo)}</span> ${esc(p.ambito)} · ${formatearFecha(p.fecha)}</p>
      <h3><a href="articulo.html?id=${encodeURIComponent(p.id)}">${esc(p.titulo)}</a></h3>
      <p>${esc(p.subtitulo)}</p>
      <p class="muted">Por ${esc(p.autor)}</p>
    </article>`;
}

function tarjetaEvento(e) {
  const futuro = e.fecha >= hoyISO();
  return `
    <article class="card evento">
      <div class="evento-fecha">${formatearFecha(e.fecha)}</div>
      <div>
        <p class="meta"><span class="tag ${futuro ? "tag-on" : ""}">${futuro ? "Próximo" : "Realizado"}</span>
          ${esc(e.tipo)} · ${esc(e.modalidad)}</p>
        <h3>${esc(e.titulo)}</h3>
        <p>${esc(e.descripcion)}</p>
        <p class="muted">${e.hora ? esc(e.hora) + " h · " : ""}${esc(e.lugar)}</p>
      </div>
    </article>`;
}

/* ---------- Páginas ---------- */
function paginaInicio() {
  document.getElementById("ultimas").innerHTML =
    ordenarPorFecha(PUBLICACIONES).slice(0, 3).map(tarjetaPublicacion).join("");

  const proximos = ordenarPorFecha(EVENTOS.filter(e => e.fecha >= hoyISO()), false);
  document.getElementById("proximos").innerHTML = proximos.length
    ? proximos.slice(0, 3).map(tarjetaEvento).join("")
    : `<p class="vacio">No hay eventos programados por ahora. Síguenos en
       <a href="${SITIO.instagram}" target="_blank" rel="noopener">Instagram</a> para enterarte.</p>`;

  const aviso = document.getElementById("aviso-convocatoria");
  if (CONVOCATORIA.abierta) {
    aviso.hidden = false;
    aviso.innerHTML = `Convocatoria ${esc(CONVOCATORIA.periodo)} abierta hasta el
      ${formatearFecha(CONVOCATORIA.cierre)}. <a href="convocatoria.html">Postula aquí</a>.`;
  }
}

function paginaAnalisis() {
  const fTipo = document.getElementById("f-tipo");
  const fAmbito = document.getElementById("f-ambito");
  const fBuscar = document.getElementById("f-buscar");
  const cont = document.getElementById("lista-publicaciones");

  const unicos = campo => [...new Set(PUBLICACIONES.map(p => p[campo]))];
  unicos("tipo").forEach(t => fTipo.insertAdjacentHTML("beforeend", `<option>${esc(t)}</option>`));
  unicos("ambito").forEach(a => fAmbito.insertAdjacentHTML("beforeend", `<option>${esc(a)}</option>`));

  function filtrar() {
    const q = fBuscar.value.trim().toLowerCase();
    const res = ordenarPorFecha(PUBLICACIONES).filter(p =>
      (!fTipo.value || p.tipo === fTipo.value) &&
      (!fAmbito.value || p.ambito === fAmbito.value) &&
      (!q || [p.titulo, p.subtitulo, p.autor, ...(p.temas || [])].join(" ").toLowerCase().includes(q))
    );
    cont.innerHTML = res.length ? res.map(tarjetaPublicacion).join("")
      : `<p class="vacio">No se encontraron publicaciones con esos filtros.</p>`;
  }
  [fTipo, fAmbito].forEach(el => el.addEventListener("change", filtrar));
  fBuscar.addEventListener("input", filtrar);
  filtrar();
}

function paginaArticulo() {
  const id = new URLSearchParams(location.search).get("id");
  const p = PUBLICACIONES.find(x => x.id === id);
  const cont = document.getElementById("articulo");

  if (!p) {
    cont.innerHTML = `<h1>Publicación no encontrada</h1>
      <p><a href="analisis.html">Volver a análisis e informes</a></p>`;
    return;
  }
  document.title = `${p.titulo} | CERI`;

  const lista = arr => (arr || []).map(x => `<li>${esc(x)}</li>`).join("");
  cont.innerHTML = `
    <p class="meta"><span class="tag">${esc(p.tipo)}</span> ${esc(p.ambito)}</p>
    <h1>${esc(p.titulo)}</h1>
    <p class="lead">${esc(p.subtitulo)}</p>
    <p class="muted">Por ${esc(p.autor)} · Publicado: ${formatearFecha(p.fecha)}
      ${p.actualizado && p.actualizado !== p.fecha ? " · Actualizado: " + formatearFecha(p.actualizado) : ""}</p>
    <p class="temas">${(p.temas || []).map(t => `<span class="chip">${esc(t)}</span>`).join("")}</p>

    <section><h2>Resumen</h2><p>${esc(p.resumen)}</p></section>
    <section><h2>Hechos verificados</h2><ul>${lista(p.hechos)}</ul></section>
    <section><h2>Posturas de los actores</h2>
      ${(p.posturas || []).map(x => `<div class="postura"><strong>${esc(x.actor)}</strong><p>${esc(x.postura)}</p></div>`).join("")}
    </section>
    <section><h2>Escenarios posibles</h2><ul>${lista(p.escenarios)}</ul></section>
    <section><h2>Fuentes</h2><ol>
      ${(p.fuentes || []).map(f => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)}</a></li>`).join("")}
    </ol></section>

    <aside class="nota-editorial">
      Este contenido presenta hechos y posturas de distintos actores sin tomar partido.
      ¿Encontraste un error? Escríbenos a <a href="mailto:${SITIO.correo}">${SITIO.correo}</a>
      y lo corregiremos indicando la fecha de actualización.
    </aside>
    <p><a href="analisis.html">← Volver a análisis e informes</a></p>`;
}

function paginaEventos() {
  const hoy = hoyISO();
  const prox = ordenarPorFecha(EVENTOS.filter(e => e.fecha >= hoy), false);
  const pas = ordenarPorFecha(EVENTOS.filter(e => e.fecha < hoy));
  document.getElementById("eventos-proximos").innerHTML = prox.length
    ? prox.map(tarjetaEvento).join("") : `<p class="vacio">No hay eventos programados por ahora.</p>`;
  document.getElementById("eventos-pasados").innerHTML = pas.map(tarjetaEvento).join("");
}

function paginaParticipacion() {
  document.getElementById("lista-participacion").innerHTML =
    ordenarPorFecha(PARTICIPACION).map(x => `
      <li class="timeline-item">
        <span class="muted">${formatearFecha(x.fecha)}</span>
        <h3>${esc(x.titulo)}</h3>
        <p>${esc(x.descripcion)}</p>
      </li>`).join("");
}

function paginaAlianzas() {
  document.getElementById("lista-alianzas").innerHTML = ALIANZAS.map(a => `
    <article class="card">
      <!-- Para poner el logo de cada organización: <img src="assets/img/alianzas/NOMBRE.png" alt="..."> -->
      <h3>${esc(a.nombre)}</h3>
      <p class="muted">${esc(a.area)}</p>
      ${a.instagram ? `<a href="https://www.instagram.com/${esc(a.instagram)}/" target="_blank" rel="noopener">@${esc(a.instagram)}</a>` : ""}
    </article>`).join("");
}

function paginaNosotros() {
  const [a, m, d] = SITIO.fundacion.split("-").map(Number);
  document.getElementById("dato-fundacion").textContent = formatearFecha(SITIO.fundacion);
  document.getElementById("dato-reconocimiento").textContent = SITIO.reconocimiento;
  const h = new Date();
  let anios = h.getFullYear() - a;
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) anios--;
  document.getElementById("dato-anios").textContent = anios;
}

function paginaConvocatoria() {
  const c = CONVOCATORIA;
  document.getElementById("conv-periodo").textContent = c.periodo;
  document.getElementById("conv-fechas").textContent =
    `Del ${formatearFecha(c.inicio)} al ${formatearFecha(c.cierre)}`;
  document.getElementById("conv-requisitos").innerHTML = c.requisitos.map(r => `<li>${esc(r)}</li>`).join("");
  document.getElementById("conv-estado").innerHTML = c.abierta
    ? `<a class="btn" href="${esc(c.formulario)}" target="_blank" rel="noopener">Postular ahora</a>`
    : `<p class="estado-cerrado">La convocatoria ${esc(c.periodo)} está cerrada.
       Anunciaremos la siguiente en nuestras redes.</p>`;
}

/* ---------- Arranque ---------- */
const PAGINAS = {
  inicio: paginaInicio,
  analisis: paginaAnalisis,
  articulo: paginaArticulo,
  eventos: paginaEventos,
  participacion: paginaParticipacion,
  alianzas: paginaAlianzas,
  nosotros: paginaNosotros,
  convocatoria: paginaConvocatoria
};

document.addEventListener("DOMContentLoaded", () => {
  const fn = PAGINAS[document.body.dataset.page];
  if (fn) fn();
});
