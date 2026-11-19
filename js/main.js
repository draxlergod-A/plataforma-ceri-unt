/* =========================================================
   main.js — LÓGICA DE CADA PÁGINA
   Cada página HTML tiene <body data-page="..."> y aquí se
   ejecuta la función que le corresponde.
   ========================================================= */

const POR_PAGINA = 9; // publicaciones que se muestran antes de "Cargar más"

/* ---------- Tarjetas reutilizables ---------- */
// Almacena publicaciones para el visor editorial
window._ceriPublicaciones = window._ceriPublicaciones || {};

function tarjetaPublicacion(p) {
  window._ceriPublicaciones[p.id] = p;
  const edition = !!p.editorial?.paginas?.length;
  const href = edition
    ? "analisis.html?edicion=" + encodeURIComponent(p.id) + "#sala-de-lectura"
    : "articulo.html?id=" + encodeURIComponent(p.id);
  const visual =
    edition && window.CeriEditorial
      ? `<a class="card-edition-preview" href="${href}" tabindex="-1" aria-hidden="true">${CeriEditorial.cover(p)}</a>`
      : p.imagen
        ? `<img class="card-img" src="${esc(rutaImagen(p.imagen))}" alt="" loading="lazy">`
        : "";
  return `<article class="card">${visual}<p class="meta"><span class="tag">${esc(p.tipo)}</span> ${esc(p.ambito)}</p><h3><a href="${href}">${esc(p.titulo)}</a></h3><p>${esc(p.subtitulo)}</p><p class="muted">${formatearFecha(p.fecha)} · ${esc(p.autor)}${edition ? " · " + p.editorial.paginas.length + " páginas" : " · " + minutosLectura(p) + " min"}</p></article>`;
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
  const ordenadas = ordenarPorFecha(D.publicaciones),
    ediciones = ordenadas.filter(p => p.editorial?.paginas?.length);
  const destacada = ordenadas.find(p => p.destacado) || ordenadas[0],
    edicion = ediciones[0];
  document.getElementById("hero-titulo").textContent =
    D.sitio.lema || "Comprender el mundo, ampliar la mirada.";
  document.getElementById("inicio-ediciones").textContent = String(ediciones.length).padStart(2, "0");
  document.getElementById("inicio-paginas").textContent = ediciones.reduce(
    (n, p) => n + p.editorial.paginas.length,
    0
  );
  document.getElementById("inicio-eventos").textContent = String(D.eventos.length).padStart(2, "0");
  document.getElementById("hero-edicion").innerHTML = edicion
    ? `<a class="hero-edition" href="analisis.html?edicion=${encodeURIComponent(edicion.id)}#sala-de-lectura" aria-label="Explorar la edición: ${esc(edicion.titulo)}">${CeriEditorial.cover(edicion)}<span class="hero-edition__caption"><span>Cuadernos CERI / ${esc(edicion.editorial.edicion || "01")}</span><b>Explorar ↗</b></span></a>`
    : "";
  const box = document.getElementById("destacada");
  if (destacada) {
    const href = destacada.editorial?.paginas?.length
      ? "analisis.html?edicion=" + encodeURIComponent(destacada.id) + "#sala-de-lectura"
      : "articulo.html?id=" + encodeURIComponent(destacada.id);
    box.innerHTML = `<div><p class="eyebrow">En foco / ${esc(destacada.ambito)}</p><h2><a href="${href}">${esc(destacada.titulo)}</a></h2><p class="lead">${esc(destacada.subtitulo)}</p><p class="muted">${esc(destacada.resumen || "")}</p><a class="text-link" href="${href}">Recorrer el informe ↗</a></div>${destacada.editorial?.paginas?.length ? `<a class="featured-visual" href="${href}" tabindex="-1" aria-hidden="true">${CeriEditorial.cover(destacada)}</a>` : ""}`;
  } else box.hidden = true;
  document.getElementById("ultimas").innerHTML = ordenadas.length
    ? ordenadas.slice(0, 3).map(tarjetaPublicacion).join("")
    : '<p class="vacio">Pronto compartiremos nuevas publicaciones.</p>';
  const proximos = ordenarPorFecha(
    D.eventos.filter(e => String(e.fecha) >= hoyISO()),
    false
  );
  const agenda = proximos.length ? proximos.slice(0, 2) : ordenarPorFecha(D.eventos).slice(0, 1);
  document.getElementById("proximos").innerHTML = agenda.length
    ? agenda.map(tarjetaEvento).join("")
    : '<p class="vacio">La próxima agenda se anunciará en nuestras redes.</p>';
  if (D.convocatoria.abierta) {
    const aviso = document.getElementById("aviso-convocatoria");
    aviso.hidden = false;
    aviso.innerHTML = `Convocatoria ${esc(D.convocatoria.periodo)} abierta hasta el ${formatearFecha(D.convocatoria.cierre)}. <a href="convocatoria.html">Conoce cómo participar →</a>`;
  }
}

/* ---------- ANÁLISIS E INFORMES ---------- */
function paginaAnalisis(D) {
  const fTipo = document.getElementById("f-tipo"),
    fAmbito = document.getElementById("f-ambito"),
    fTema = document.getElementById("f-tema"),
    fBuscar = document.getElementById("f-buscar");
  const cont = document.getElementById("lista-publicaciones"),
    library = document.getElementById("biblioteca-ediciones"),
    more = document.getElementById("cargar-mas"),
    readerHost = document.getElementById("lector-informes"),
    room = document.getElementById("sala-de-lectura");
  let mostrar = POR_PAGINA,
    selected = "";
  const params = new URLSearchParams(location.search),
    all = ordenarPorFecha(D.publicaciones);
  all.forEach(p => {
    window._ceriPublicaciones[p.id] = p;
  });
  document.getElementById("ediciones-total").textContent = all.filter(
    p => p.editorial?.paginas?.length
  ).length;
  document.getElementById("ediciones-label").textContent =
    all.filter(p => p.editorial?.paginas?.length).length === 1 ? "edición digital" : "ediciones digitales";
  const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  [
    [fTipo, all.map(p => p.tipo)],
    [fAmbito, all.map(p => p.ambito)],
    [fTema, all.flatMap(p => p.temas || [])]
  ].forEach(([select, values]) =>
    unique(values).forEach(v => select.insertAdjacentHTML("beforeend", `<option>${esc(v)}</option>`))
  );
  if (params.get("tipo")) fTipo.value = params.get("tipo");
  if (params.get("ambito")) fAmbito.value = params.get("ambito");
  if (params.get("tema")) fTema.value = params.get("tema");
  if (params.get("q")) fBuscar.value = params.get("q");
  function choose(pub, scroll = false) {
    if (!pub) return;
    selected = pub.id;
    room.hidden = false;
    if (readerHost._reader) {
      if (readerHost._reader.pub.id !== pub.id) readerHost._reader.set(pub);
    } else CeriEditorial.mount(readerHost, pub);
    library
      .querySelectorAll("[data-edicion]")
      .forEach(a => a.setAttribute("aria-current", a.dataset.edicion === selected ? "true" : "false"));
    if (scroll) {
      room.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
      readerHost._reader.root.focus({ preventScroll: true });
    }
  }
  function filter() {
    const q = fBuscar.value.trim().toLocaleLowerCase("es");
    const results = all.filter(
      p =>
        (!fTipo.value || p.tipo === fTipo.value) &&
        (!fAmbito.value || p.ambito === fAmbito.value) &&
        (!fTema.value || (p.temas || []).includes(fTema.value)) &&
        (!q ||
          [p.titulo, p.subtitulo, p.autor, p.resumen, ...(p.temas || [])]
            .join(" ")
            .toLocaleLowerCase("es")
            .includes(q))
    );
    const editions = results.filter(p => p.editorial?.paginas?.length),
      articles = results.filter(p => !p.editorial?.paginas?.length);
    library.innerHTML = editions.length
      ? editions.map(CeriEditorial.card).join("")
      : '<p class="library-empty">No hay ediciones que coincidan con estos filtros. Prueba con otro tema o limpia la búsqueda.</p>';
    cont.innerHTML = articles.length
      ? articles.slice(0, mostrar).map(tarjetaPublicacion).join("")
      : '<p class="archive-empty">Las próximas notas de coyuntura, artículos y explicadores se incorporarán a este archivo.</p>';
    more.hidden = articles.length <= mostrar;
    document.getElementById("contador").textContent =
      `${results.length} ${results.length === 1 ? "publicación" : "publicaciones"} · ${editions.length} ${editions.length === 1 ? "edición digital" : "ediciones digitales"}`;
    if (editions.length)
      choose(
        editions.find(p => p.id === selected) ||
          editions.find(p => p.id === params.get("edicion")) ||
          editions[0]
      );
    else {
      room.hidden = true;
    }
  }
  library.addEventListener("click", e => {
    const card = e.target.closest("[data-edicion]");
    if (!card) return;
    e.preventDefault();
    const pub = all.find(p => p.id === card.dataset.edicion);
    choose(pub, true);
    const url = new URL(location.href);
    url.searchParams.set("edicion", pub.id);
    url.hash = "sala-de-lectura";
    history.replaceState(null, "", url);
  });
  document.querySelector(".filtros").addEventListener("submit", e => e.preventDefault());
  [fTipo, fAmbito, fTema].forEach(el =>
    el.addEventListener("change", () => {
      mostrar = POR_PAGINA;
      filter();
    })
  );
  fBuscar.addEventListener("input", () => {
    mostrar = POR_PAGINA;
    filter();
  });
  more.addEventListener("click", () => {
    mostrar += POR_PAGINA;
    filter();
  });
  document.getElementById("limpiar").addEventListener("click", () => {
    fTipo.value = fAmbito.value = fTema.value = fBuscar.value = "";
    mostrar = POR_PAGINA;
    filter();
  });
  filter();
  if (params.get("edicion") || location.hash === "#sala-de-lectura")
    requestAnimationFrame(() => {
      if (!room.hidden) room.scrollIntoView({ block: "start" });
    });
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
  if (p.editorial?.paginas?.length) {
    window._ceriPublicaciones[p.id] = p;
    document.title = p.titulo + " | CERI · UNT";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", p.resumen || p.subtitulo || "");
    cont.innerHTML = `<div class="article-intro"><a class="article-back" href="analisis.html">← Volver a la biblioteca</a><p class="eyebrow">${esc(p.ambito)} / Cuadernos CERI · ${esc(p.editorial.edicion || "01")}</p><h1>${esc(p.titulo)}</h1><p class="lead">${esc(p.subtitulo)}</p><p class="muted">${esc(p.autor)} · ${formatearFecha(p.fecha)} · ${p.editorial.paginas.length} páginas</p><p class="article-archive-note">${esc(p.editorial.nota || "")}</p></div><div id="lector-articulo"></div>${botonesCompartir(p.titulo)}<p class="nota-editorial">Esta edición forma parte del archivo de investigación del CERI. <a href="contacto.html">Comunica una observación editorial</a>.</p>`;
    CeriEditorial.mount(document.getElementById("lector-articulo"), p);
    activarCopiar();
    return;
  }
  window._ceriPublicaciones[p.id] = p;
  document.title = `${p.titulo} | ${D.sitio.nombre}`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", p.resumen || p.subtitulo || "");

  const lista = arr =>
    (arr || [])
      .filter(Boolean)
      .map(x => `<li>${esc(x)}</li>`)
      .join("");
  const seccion = (titulo, html) => (html ? `<section><h2>${titulo}</h2>${html}</section>` : "");

  const posturas = (p.posturas || [])
    .map(x => `<div class="postura"><strong>${esc(x.actor)}</strong><p>${esc(x.postura)}</p></div>`)
    .join("");
  const fuentes = (p.fuentes || [])
    .map(f => {
      const u = urlSegura(f.url);
      return `<li>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(f.nombre)}</a>` : esc(f.nombre)}</li>`;
    })
    .join("");
  const correcciones = (p.correcciones || [])
    .map(c => `<li><strong>${formatearFecha(c.fecha)}:</strong> ${esc(c.detalle)}</li>`)
    .join("");

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
    <p class="temas">${(p.temas || [])
      .map(t => `<a class="chip" href="analisis.html?tema=${encodeURIComponent(t)}">${esc(t)}</a>`)
      .join("")}</p>
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

    ${
      relacionadas.length
        ? `<h2>Publicaciones relacionadas</h2>
      <div class="grid">${relacionadas.map(tarjetaPublicacion).join("")}</div>`
        : ""
    }
    <p><a href="analisis.html">← Volver a análisis e informes</a></p>`;
  activarCopiar();
}

/* ---------- EVENTOS ---------- */
function paginaEventos(D) {
  const hoy = hoyISO();
  const prox = ordenarPorFecha(
    D.eventos.filter(e => String(e.fecha) >= hoy),
    false
  );
  const pas = ordenarPorFecha(D.eventos.filter(e => String(e.fecha) < hoy));
  document.getElementById("eventos-proximos").innerHTML = prox.length
    ? prox.map(tarjetaEvento).join("")
    : `<p class="vacio">No hay eventos programados por ahora.</p>`;
  document.getElementById("eventos-pasados").innerHTML = pas.length
    ? pas.map(tarjetaEvento).join("")
    : `<p class="vacio">Aún no hay eventos registrados.</p>`;
}

/* ---------- PARTICIPACIÓN ---------- */
function paginaParticipacion(D) {
  const items = ordenarPorFecha(D.participacion);
  document.getElementById("lista-participacion").innerHTML = items.length
    ? items
        .map(
          x => `
      <li class="timeline-item">
        <span class="muted">${formatearFecha(x.fecha)}</span>
        <h3>${esc(x.titulo)}</h3>
        <p>${esc(x.descripcion)}</p>
        ${x.imagen ? `<img class="timeline-img" src="${esc(rutaImagen(x.imagen))}" alt="" loading="lazy">` : ""}
      </li>`
        )
        .join("")
    : `<p class="vacio">Aún no hay actividades registradas.</p>`;
}

/* ---------- ALIANZAS ---------- */
function paginaAlianzas(D) {
  document.getElementById("lista-alianzas").innerHTML = D.alianzas
    .map(
      a => `
    <article class="card alianza">
      ${a.logo ? `<img class="alianza-logo" src="${esc(rutaImagen(a.logo))}" alt="Logo ${esc(a.nombre)}" loading="lazy">` : ""}
      <h3>${esc(a.nombre)}</h3>
      <p class="muted">${esc(a.area)}</p>
      ${
        a.instagram
          ? `<a href="https://www.instagram.com/${encodeURIComponent(a.instagram.replace(/^@/, ""))}/"
          target="_blank" rel="noopener">@${esc(a.instagram.replace(/^@/, ""))}</a>`
          : ""
      }
    </article>`
    )
    .join("");
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

  const equipoVisible = D.equipo.filter(m => m.nombre && !/PENDIENTE/i.test(m.nombre));
  document.getElementById("lista-equipo").innerHTML = equipoVisible.length
    ? equipoVisible
        .map(
          m => `
      <article class="card miembro">
        ${
          m.foto
            ? `<img class="miembro-foto" src="${esc(rutaImagen(m.foto))}" alt="${esc(m.nombre)}" loading="lazy">`
            : `<div class="miembro-foto sin-foto" aria-hidden="true">${esc((m.nombre || "?").trim()[0])}</div>`
        }
        <h3>${esc(m.nombre)}</h3>
        <p class="muted">${esc(m.cargo)}${m.carrera ? " · " + esc(m.carrera) : ""}</p>
      </article>`
        )
        .join("")
    : `<p class="vacio">Directiva por publicar.</p>`;
}

/* ---------- CONVOCATORIA ---------- */
function paginaConvocatoria(D) {
  const c = D.convocatoria;
  document.getElementById("conv-periodo").textContent = c.periodo || "";
  document.getElementById("conv-fechas").textContent =
    c.inicio && c.cierre ? `Del ${formatearFecha(c.inicio)} al ${formatearFecha(c.cierre)}` : "";
  document.getElementById("conv-requisitos").innerHTML = (c.requisitos || [])
    .map(r => `<li>${esc(r)}</li>`)
    .join("");
  document.getElementById("conv-proceso").innerHTML = (c.proceso || [])
    .map(r => `<li>${esc(r)}</li>`)
    .join("");

  const form = urlSegura(c.formulario);
  document.getElementById("conv-estado").innerHTML =
    c.abierta && form
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
    ? `<a href="mailto:${esc(s.correo)}">${esc(s.correo)}</a>`
    : "Por definir";
  document.getElementById("contacto-redes").innerHTML = [
    s.instagram && `<a href="${esc(urlSegura(s.instagram))}" target="_blank" rel="noopener">Instagram</a>`,
    s.facebook && `<a href="${esc(urlSegura(s.facebook))}" target="_blank" rel="noopener">Facebook</a>`,
    s.whatsapp &&
      `<a href="https://wa.me/${esc(String(s.whatsapp).replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a>`
  ]
    .filter(Boolean)
    .join(" · ");

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
