/* =========================================================
   main.js — LÓGICA DE CADA PÁGINA
   Cada página HTML tiene <body data-page="..."> y aquí se
   ejecuta la función que le corresponde.
   ========================================================= */

const POR_PAGINA = 9; // publicaciones que se muestran antes de "Cargar más"

/* ---------- Tarjetas reutilizables ---------- */
function tarjetaPublicacion(p) {
  const img = p.imagen
    ? `<img class="card-img" src="${esc(rutaImagen(p.imagen))}" alt="" loading="lazy">` : "";
  return `
    <article class="card">
      ${img}
      <p class="meta"><span class="tag">${esc(p.tipo)}</span> ${esc(p.ambito)} · ${formatearFecha(p.fecha)}</p>
      <h3><a href="articulo.html?id=${encodeURIComponent(p.id)}">${esc(p.titulo)}</a></h3>
      <p>${esc(p.subtitulo)}</p>
      <p class="muted">Por ${esc(p.autor)} · ${minutosLectura(p)} min de lectura</p>
    </article>`;
}

function tarjetaEvento(e) {
  const futuro = String(e.fecha) >= hoyISO();
  const enlace = urlSegura(e.enlace);
  return `
    <article class="card evento">
      <div class="evento-fecha">${formatearFecha(e.fecha)}</div>
      <div>
        <p class="meta"><span class="tag ${futuro ? "tag-on" : ""}">${futuro ? "Próximo" : "Realizado"}</span>
          ${esc(e.tipo)} · ${esc(e.modalidad)}</p>
        <h3>${esc(e.titulo)}</h3>
        <p>${esc(e.descripcion)}</p>
        <p class="muted">${e.hora ? esc(e.hora) + " h · " : ""}${esc(e.lugar)}</p>
        ${enlace ? `<p><a href="${esc(enlace)}" target="_blank" rel="noopener">${futuro ? "Inscribirse / más información" : "Ver grabación o fotos"}</a></p>` : ""}
      </div>
      ${e.imagen ? `<img class="evento-img" src="${esc(rutaImagen(e.imagen))}" alt="" loading="lazy">` : ""}
    </article>`;
}

/* ---------- INICIO ---------- */
function paginaInicio(D) {
  const ordenadas = ordenarPorFecha(D.publicaciones);
  const destacada = ordenadas.find(p => p.destacado);
  const resto = ordenadas.filter(p => p !== destacada).slice(0, 3);

  document.getElementById("hero-titulo").textContent = D.sitio.lema || "";

  const cajaDest = document.getElementById("destacada");
  if (destacada) {
    cajaDest.innerHTML = `
      <p class="meta">Destacado · <span class="tag">${esc(destacada.tipo)}</span> ${formatearFecha(destacada.fecha)}</p>
      <h2><a href="articulo.html?id=${encodeURIComponent(destacada.id)}">${esc(destacada.titulo)}</a></h2>
      <p class="lead">${esc(destacada.subtitulo)}</p>
      <p>${esc(destacada.resumen)}</p>
      <a href="articulo.html?id=${encodeURIComponent(destacada.id)}">Leer completo →</a>`;
  } else {
    cajaDest.remove();
  }

  document.getElementById("ultimas").innerHTML = resto.length
    ? resto.map(tarjetaPublicacion).join("")
    : `<p class="vacio">Pronto publicaremos nuestros primeros análisis.</p>`;

  const proximos = ordenarPorFecha(D.eventos.filter(e => String(e.fecha) >= hoyISO()), false);
  document.getElementById("proximos").innerHTML = proximos.length
    ? proximos.slice(0, 3).map(tarjetaEvento).join("")
    : `<p class="vacio">No hay eventos programados por ahora. Síguenos en
       <a href="${esc(urlSegura(D.sitio.instagram))}" target="_blank" rel="noopener">Instagram</a> para enterarte.</p>`;

  const c = D.convocatoria;
  if (c.abierta) {
    const aviso = document.getElementById("aviso-convocatoria");
    aviso.hidden = false;
    aviso.innerHTML = `Convocatoria ${esc(c.periodo)} abierta hasta el ${formatearFecha(c.cierre)}.
      <a href="convocatoria.html">Postula aquí</a>.`;
  }
}

/* ---------- ANÁLISIS E INFORMES ---------- */
function paginaAnalisis(D) {
  const fTipo = document.getElementById("f-tipo");
  const fAmbito = document.getElementById("f-ambito");
  const fTema = document.getElementById("f-tema");
  const fBuscar = document.getElementById("f-buscar");
  const cont = document.getElementById("lista-publicaciones");
  const btnMas = document.getElementById("cargar-mas");
  const contador = document.getElementById("contador");
  let mostrar = POR_PAGINA;

  const unicos = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const opciones = (sel, valores) =>
    valores.forEach(v => sel.insertAdjacentHTML("beforeend", `<option>${esc(v)}</option>`));
  opciones(fTipo, unicos(D.publicaciones.map(p => p.tipo)));
  opciones(fAmbito, unicos(D.publicaciones.map(p => p.ambito)));
  opciones(fTema, unicos(D.publicaciones.flatMap(p => p.temas || [])));

  // Filtros desde la dirección, ej: analisis.html?tema=Brasil
  const params = new URLSearchParams(location.search);
  if (params.get("tipo")) fTipo.value = params.get("tipo");
  if (params.get("ambito")) fAmbito.value = params.get("ambito");
  if (params.get("tema")) fTema.value = params.get("tema");
  if (params.get("q")) fBuscar.value = params.get("q");

  function filtrar() {
    const q = fBuscar.value.trim().toLowerCase();
    const res = ordenarPorFecha(D.publicaciones).filter(p =>
      (!fTipo.value || p.tipo === fTipo.value) &&
      (!fAmbito.value || p.ambito === fAmbito.value) &&
      (!fTema.value || (p.temas || []).includes(fTema.value)) &&
      (!q || [p.titulo, p.subtitulo, p.autor, p.resumen, ...(p.temas || [])].join(" ").toLowerCase().includes(q))
    );
    cont.innerHTML = res.length ? res.slice(0, mostrar).map(tarjetaPublicacion).join("")
      : `<p class="vacio">No se encontraron publicaciones con esos filtros.</p>`;
    contador.textContent = `${res.length} ${res.length === 1 ? "publicación" : "publicaciones"}`;
    btnMas.hidden = res.length <= mostrar;
  }

  [fTipo, fAmbito, fTema].forEach(el => el.addEventListener("change", () => { mostrar = POR_PAGINA; filtrar(); }));
  fBuscar.addEventListener("input", () => { mostrar = POR_PAGINA; filtrar(); });
  btnMas.addEventListener("click", () => { mostrar += POR_PAGINA; filtrar(); });
  document.getElementById("limpiar").addEventListener("click", () => {
    fTipo.value = fAmbito.value = fTema.value = fBuscar.value = "";
    mostrar = POR_PAGINA; filtrar();
  });
  filtrar();
}

/* ---------- UNA PUBLICACIÓN ---------- */
function paginaArticulo(D) {
  const id = new URLSearchParams(location.search).get("id");
  const p = D.publicaciones.find(x => x.id === id);
  const cont = document.getElementById("articulo");

  if (!p) {
    cont.innerHTML = `<h1>Publicación no encontrada</h1>
      <p>Puede que el enlace esté mal o que la publicación aún no haya sido publicada.</p>
      <p><a href="analisis.html">Volver a análisis e informes</a></p>`;
    return;
  }
  document.title = `${p.titulo} | ${D.sitio.nombre}`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", p.resumen || p.subtitulo || "");

  const lista = arr => (arr || []).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join("");
  const seccion = (titulo, html) => html ? `<section><h2>${titulo}</h2>${html}</section>` : "";

  const posturas = (p.posturas || []).map(x =>
    `<div class="postura"><strong>${esc(x.actor)}</strong><p>${esc(x.postura)}</p></div>`).join("");
  const fuentes = (p.fuentes || []).map(f => {
    const u = urlSegura(f.url);
    return `<li>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(f.nombre)}</a>` : esc(f.nombre)}</li>`;
  }).join("");
  const correcciones = (p.correcciones || []).map(c =>
    `<li><strong>${formatearFecha(c.fecha)}:</strong> ${esc(c.detalle)}</li>`).join("");

  const relacionadas = D.publicaciones
    .filter(x => x.id !== p.id && (x.temas || []).some(t => (p.temas || []).includes(t)))
    .slice(0, 3);

  cont.innerHTML = `
    <p class="meta"><span class="tag">${esc(p.tipo)}</span> ${esc(p.ambito)}</p>
    <h1>${esc(p.titulo)}</h1>
    <p class="lead">${esc(p.subtitulo)}</p>
    <p class="muted">Por ${esc(p.autor)}${p.revisadoPor ? ` · Revisado por ${esc(p.revisadoPor)}` : ""}
      · Publicado: ${formatearFecha(p.fecha)}
      ${p.actualizado && p.actualizado !== p.fecha ? " · Actualizado: " + formatearFecha(p.actualizado) : ""}
      · ${minutosLectura(p)} min de lectura</p>
    <p class="temas">${(p.temas || []).map(t =>
      `<a class="chip" href="analisis.html?tema=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</p>
    ${p.imagen ? `<img class="articulo-img" src="${esc(rutaImagen(p.imagen))}" alt="">` : ""}

    ${seccion("Resumen", p.resumen ? `<p>${esc(p.resumen)}</p>` : "")}
    ${seccion("Hechos verificados", lista(p.hechos) && `<ul>${lista(p.hechos)}</ul>`)}
    ${seccion("Posturas de los actores", posturas)}
    ${seccion("Análisis", markdown(p.desarrollo))}
    ${seccion("Escenarios posibles", lista(p.escenarios) && `<ul>${lista(p.escenarios)}</ul>`)}
    ${seccion("Fuentes", fuentes && `<ol>${fuentes}</ol>`)}
    ${seccion("Correcciones", correcciones && `<ul>${correcciones}</ul>`)}

    ${botonesCompartir(p.titulo)}

    <aside class="nota-editorial">
      Este contenido presenta hechos y posturas de distintos actores sin tomar partido.
      ¿Encontraste un error? <a href="contacto.html">Escríbenos</a> y lo corregiremos
      indicando la fecha de la corrección.
    </aside>

    ${relacionadas.length ? `<h2>Publicaciones relacionadas</h2>
      <div class="grid">${relacionadas.map(tarjetaPublicacion).join("")}</div>` : ""}
    <p><a href="analisis.html">← Volver a análisis e informes</a></p>`;
  activarCopiar();
}

/* ---------- EVENTOS ---------- */
function paginaEventos(D) {
  const hoy = hoyISO();
  const prox = ordenarPorFecha(D.eventos.filter(e => String(e.fecha) >= hoy), false);
  const pas = ordenarPorFecha(D.eventos.filter(e => String(e.fecha) < hoy));
  document.getElementById("eventos-proximos").innerHTML = prox.length
    ? prox.map(tarjetaEvento).join("") : `<p class="vacio">No hay eventos programados por ahora.</p>`;
  document.getElementById("eventos-pasados").innerHTML = pas.length
    ? pas.map(tarjetaEvento).join("") : `<p class="vacio">Aún no hay eventos registrados.</p>`;
}

/* ---------- PARTICIPACIÓN ---------- */
function paginaParticipacion(D) {
  const items = ordenarPorFecha(D.participacion);
  document.getElementById("lista-participacion").innerHTML = items.length
    ? items.map(x => `
      <li class="timeline-item">
        <span class="muted">${formatearFecha(x.fecha)}</span>
        <h3>${esc(x.titulo)}</h3>
        <p>${esc(x.descripcion)}</p>
        ${x.imagen ? `<img class="timeline-img" src="${esc(rutaImagen(x.imagen))}" alt="" loading="lazy">` : ""}
      </li>`).join("")
    : `<p class="vacio">Aún no hay actividades registradas.</p>`;
}

/* ---------- ALIANZAS ---------- */
function paginaAlianzas(D) {
  document.getElementById("lista-alianzas").innerHTML = D.alianzas.map(a => `
    <article class="card alianza">
      ${a.logo ? `<img class="alianza-logo" src="${esc(rutaImagen(a.logo))}" alt="Logo ${esc(a.nombre)}" loading="lazy">` : ""}
      <h3>${esc(a.nombre)}</h3>
      <p class="muted">${esc(a.area)}</p>
      ${a.instagram ? `<a href="https://www.instagram.com/${encodeURIComponent(a.instagram.replace(/^@/, ""))}/"
          target="_blank" rel="noopener">@${esc(a.instagram.replace(/^@/, ""))}</a>` : ""}
    </article>`).join("");
}

/* ---------- NOSOTROS ---------- */
function paginaNosotros(D) {
  const s = D.sitio;
  document.getElementById("descripcion").textContent = s.descripcion || "";
  document.getElementById("dato-fundacion").textContent = formatearFecha(s.fundacion);
  document.getElementById("dato-reconocimiento").textContent = s.reconocimiento || "—";

  if (s.fundacion) {
    const [a, m, d] = s.fundacion.split("-").map(Number);
    const h = new Date();
    let anios = h.getFullYear() - a;
    if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) anios--;
    document.getElementById("dato-anios").textContent = anios < 1 ? "Menos de 1" : anios;
  }

  document.getElementById("dato-publicaciones").textContent = D.publicaciones.length;
  document.getElementById("dato-eventos").textContent = D.eventos.length;

  document.getElementById("lista-equipo").innerHTML = D.equipo.length
    ? D.equipo.map(m => `
      <article class="card miembro">
        ${m.foto ? `<img class="miembro-foto" src="${esc(rutaImagen(m.foto))}" alt="${esc(m.nombre)}" loading="lazy">`
                 : `<div class="miembro-foto sin-foto" aria-hidden="true">${esc((m.nombre || "?").trim()[0])}</div>`}
        <h3>${esc(m.nombre)}</h3>
        <p class="muted">${esc(m.cargo)}${m.carrera ? " · " + esc(m.carrera) : ""}</p>
      </article>`).join("")
    : `<p class="vacio">Directiva por publicar.</p>`;
}

/* ---------- CONVOCATORIA ---------- */
function paginaConvocatoria(D) {
  const c = D.convocatoria;
  document.getElementById("conv-periodo").textContent = c.periodo || "";
  document.getElementById("conv-fechas").textContent =
    c.inicio && c.cierre ? `Del ${formatearFecha(c.inicio)} al ${formatearFecha(c.cierre)}` : "";
  document.getElementById("conv-requisitos").innerHTML = (c.requisitos || []).map(r => `<li>${esc(r)}</li>`).join("");
  document.getElementById("conv-proceso").innerHTML = (c.proceso || []).map(r => `<li>${esc(r)}</li>`).join("");

  const form = urlSegura(c.formulario);
  document.getElementById("conv-estado").innerHTML = c.abierta && form
    ? `<a class="btn" href="${esc(form)}" target="_blank" rel="noopener">Postular ahora</a>`
    : c.abierta
      ? `<p class="estado-cerrado">La convocatoria está abierta. El formulario estará disponible pronto.</p>`
      : `<p class="estado-cerrado">La convocatoria ${esc(c.periodo)} está cerrada.
         Anunciaremos la siguiente en nuestras redes.</p>`;
}

/* ---------- CONTACTO ---------- */
function paginaContacto(D) {
  const s = D.sitio;
  document.getElementById("contacto-correo").innerHTML = s.correo
    ? `<a href="mailto:${esc(s.correo)}">${esc(s.correo)}</a>` : "Por definir";
  document.getElementById("contacto-redes").innerHTML = [
    s.instagram && `<a href="${esc(urlSegura(s.instagram))}" target="_blank" rel="noopener">Instagram</a>`,
    s.facebook && `<a href="${esc(urlSegura(s.facebook))}" target="_blank" rel="noopener">Facebook</a>`,
    s.whatsapp && `<a href="https://wa.me/${esc(String(s.whatsapp).replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a>`
  ].filter(Boolean).join(" · ");

  /* Por ahora el formulario abre el correo del visitante con el mensaje listo.
     TODO (cuando se publique): conectar con Formspree para recibirlo sin abrir el correo. */
  document.getElementById("form-contacto").addEventListener("submit", ev => {
    ev.preventDefault();
    const f = ev.target;
    if (!f.reportValidity()) return;
    const asunto = `[Web CERI] ${f.motivo.value} – ${f.nombre.value}`;
    const cuerpo = `${f.mensaje.value}\n\n—\nNombre: ${f.nombre.value}\nCorreo: ${f.correo.value}`;
    location.href = `mailto:${s.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  });
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
  convocatoria: paginaConvocatoria,
  contacto: paginaContacto
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const D = await cargarDatos();
    renderHeader(D.sitio);
    renderFooter(D.sitio);
    const fn = PAGINAS[document.body.dataset.page];
    if (fn) fn(D);
  } catch (err) {
    renderHeader({ nombre: "CERI", universidad: "Universidad Nacional de Trujillo" });
    mostrarErrorCarga(err);
  }
});
