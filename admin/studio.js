/* Estudio editorial CERI: crear, revisar y publicar sin editar código. */
(() => {
  "use strict";
  const M = window.CeriAdminModel,
    $ = id => document.getElementById(id),
    E = esc;
  const state = {
    items: [],
    revision: "",
    media: [],
    csrf: "",
    view: "library",
    status: "",
    query: "",
    report: null,
    originalId: null,
    step: 0,
    page: 1,
    dirty: false,
    saving: false,
    setup: false,
    mediaTarget: null
  };
  const labels = { borrador: "Borrador", revision: "En revisión", publicado: "Publicado" };
  const blockLabels = {
    parrafo: "Párrafo",
    destacado: "Idea destacada",
    imagen: "Imagen",
    cronologia: "Cronología",
    fichas: "Fichas de análisis",
    fuentes: "Fuentes y referencias"
  };
  let autosaveTimer, toastTimer, coverTimer;
  const deepGet = (object, route) => route.split(".").reduce((value, key) => value?.[key], object);
  function deepSet(object, route, value) {
    const keys = route.split(".");
    if (keys.some(k => ["__proto__", "constructor", "prototype"].includes(k))) return;
    let target = object;
    keys.slice(0, -1).forEach(k => {
      if (target[k] === undefined) target[k] = {};
      target = target[k];
    });
    target[keys.at(-1)] = value;
  }
  const pagePath = () => `editorial.paginas.${state.page}`;
  const currentPage = () => state.report.editorial.paginas[state.page];
  const draftKey = () => `ceri:editorial:draft:${state.originalId || "new"}`;
  const publicLink = p =>
    new URL(`analisis.html?edicion=${encodeURIComponent(p.id)}#sala-de-lectura`, document.baseURI).href;
  function toast(message) {
    clearTimeout(toastTimer);
    $("studio-toast").textContent = message;
    $("studio-toast").hidden = false;
    toastTimer = setTimeout(() => {
      $("studio-toast").hidden = true;
    }, 5000);
  }
  function connected(value) {
    const badge = document.querySelector(".studio-connection");
    badge.innerHTML = `<i></i> ${value ? "Conectado" : "Sin conexión"}`;
  }
  async function api(route, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof Blob)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    if (options.method && options.method !== "GET") headers["X-CSRF-Token"] = state.csrf;
    let response;
    try {
      response = await fetch(new URL(`api/admin/${route}`, document.baseURI), {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
        headers
      });
    } catch {
      connected(false);
      throw Error(
        "No se pudo conectar con el estudio. Comprueba que el servidor del proyecto siga encendido."
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw Error("Abre este panel con el servidor del CERI para poder guardar y publicar.");
    }
    connected(true);
    if (!response.ok) {
      const error = Error(data.error || "No se pudo completar la operación.");
      error.status = response.status;
      error.details = data.details;
      throw error;
    }
    return data;
  }
  function confirmAction(title, message, accept = "Continuar", cancel = "Cancelar") {
    return new Promise(resolve => {
      const dialog = $("confirm-dialog");
      $("confirm-title").textContent = title;
      $("confirm-message").textContent = message;
      $("confirm-accept").textContent = accept;
      dialog.querySelector('[value="cancel"]').textContent = cancel;
      dialog.returnValue = "cancel";
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "accept"), { once: true });
      dialog.showModal();
    });
  }
  function errorMessage(error) {
    $("editor-error").textContent = error.message;
    $("editor-error").hidden = false;
    if (error.details?.length)
      $("editor-error").textContent += "\n" + error.details.map(x => "• " + x.message).join("\n");
    toast(error.message);
  }
  function field(label, route, options = {}) {
    const value = deepGet(state.report, route),
      type = options.type || "text";
    const attributes = `data-bind="${E(route)}"${options.array ? ' data-array="true"' : ""}${options.rerender ? ' data-rerender="true"' : ""}${options.max ? ' maxlength="' + options.max + '"' : ""}`;
    const shown = options.array ? (value || []).join(", ") : (value ?? "");
    let control;
    if (type === "textarea")
      control = `<textarea ${attributes} rows="${options.rows || 4}" placeholder="${E(options.placeholder || "")}">${E(shown)}</textarea>`;
    else if (type === "select")
      control = `<select ${attributes}>${options.options
        .map(x => {
          const key = typeof x === "string" ? x : x.value;
          return `<option value="${E(key)}"${value === key ? " selected" : ""}>${E(typeof x === "string" ? x : x.label)}</option>`;
        })
        .join("")}</select>`;
    else
      control = `<input ${attributes} type="${type}" value="${E(shown)}" placeholder="${E(options.placeholder || "")}"${options.min !== undefined ? ' min="' + options.min + '"' : ""}>`;
    return `<label class="studio-field${options.wide ? " studio-field--wide" : ""}">${E(label)}${control}${options.hint ? `<small>${E(options.hint)}</small>` : ""}</label>`;
  }
  function imageWell(route, key = "imagen") {
    const object = deepGet(state.report, route),
      src = object?.[key];
    return `<button type="button" class="image-well" data-pick="${E(route)}" data-image-key="${key}">${src ? `<img src="${E(rutaImagen(src))}" alt="${E(object.alt || "Imagen seleccionada")}">` : ""}<strong>${src ? "Cambiar imagen" : "+ Elegir o subir imagen"}</strong><small>${src ? "Se conserva el encuadre original hasta que cambies esta imagen." : "JPG, PNG, WebP o GIF · desde tu dispositivo o la biblioteca"}</small></button>${src ? `<button type="button" class="studio-link" data-remove-image="${E(route)}" data-image-key="${key}">Quitar imagen</button>` : ""}`;
  }
  function renderStats() {
    const count = status => state.items.filter(x => x.estado === status).length;
    $("dashboard-stats").innerHTML = [
      [state.items.length, "Informes en tu biblioteca"],
      [count("publicado"), "Publicados en la web"],
      [count("borrador"), "Borradores en preparación"],
      [count("revision"), "Ediciones en revisión"]
    ]
      .map(
        ([number, label]) =>
          `<div class="dashboard-stat"><strong>${String(number).padStart(2, "0")}</strong><span>${E(label)}</span></div>`
      )
      .join("");
  }
  function renderLibrary() {
    renderStats();
    const q = state.query.toLocaleLowerCase("es");
    const items = state.items
      .filter(
        p =>
          (!state.status || p.estado === state.status) &&
          (!q || [p.titulo, p.autor, ...(p.temas || [])].join(" ").toLocaleLowerCase("es").includes(q))
      )
      .sort((a, b) => String(b.actualizado || b.fecha).localeCompare(String(a.actualizado || a.fecha)));
    $("library-status").textContent =
      `${items.length} ${items.length === 1 ? "informe" : "informes"} · Los borradores se conservan en el estudio.`;
    $("report-list").innerHTML = items.length
      ? items
          .map(
            p =>
              `<article class="report-card"><button type="button" class="report-card__cover" data-edit="${E(p.id)}" aria-label="Editar ${E(p.titulo)}">${p.editorial?.paginas?.length ? CeriEditorial.cover(p) : '<span class="report-card__empty">CERI</span>'}</button><div><div class="report-card__meta"><span class="studio-badge studio-badge--${E(p.estado)}">${E(labels[p.estado] || p.estado)}</span><span>${E(p.ambito)}</span><span>${p.editorial?.paginas?.length || 0} páginas</span></div><h3>${E(p.titulo)}</h3><p>${E(p.autor || "Autor por completar")} · ${formatearFecha(p.actualizado || p.fecha)}</p></div><div class="report-card__actions"><button type="button" class="studio-button" data-edit="${E(p.id)}">Editar informe →</button>${p.estado === "publicado" ? `<a class="studio-button studio-button--quiet" href="${E(publicLink(p))}" target="_blank" rel="noopener">Ver en la web ↗</a>` : ""}<button type="button" class="studio-button studio-button--quiet" data-duplicate="${E(p.id)}">Duplicar</button>${p.estado === "publicado" ? `<button type="button" class="studio-button studio-button--quiet" data-withdraw="${E(p.id)}">Retirar a borrador</button>` : ""}</div></article>`
          )
          .join("")
      : '<div class="studio-empty"><h3>Una nueva edición comienza aquí.</h3><p>No hay informes que coincidan con esta búsqueda.</p><button type="button" class="studio-button studio-button--primary" data-action="new">+ Crear un informe</button></div>';
  }
  async function loadLibrary() {
    const data = await api("publicaciones");
    state.items = data.items;
    state.revision = data.revision;
    renderLibrary();
  }
  async function activate() {
    $("access-screen").hidden = true;
    $("studio-shell").hidden = false;
    try {
      await loadLibrary();
    } catch (error) {
      toast(error.message);
    }
  }
  async function access() {
    try {
      const session = await api("session");
      state.csrf = session.csrfToken || "";
      if (session.authenticated) {
        await activate();
        return;
      }
      state.setup = !session.configured;
      $("access-title").textContent = state.setup ? "Configura tu estudio." : "Bienvenido de nuevo.";
      $("access-description").textContent = state.setup
        ? "Crea una contraseña para el equipo editorial. Podrás guardar informes y publicarlos desde este panel."
        : "Ingresa la contraseña del equipo para continuar trabajando en las ediciones del CERI.";
      if (state.setup && !session.setupAllowed) {
        $("access-description").textContent =
          "El responsable debe crear primero la contraseña desde http://localhost:5500/admin/ en la computadora del proyecto.";
        return;
      }
      $("access-form").hidden = false;
      $("password-confirm-label").hidden = !state.setup;
      $("access-password").autocomplete = state.setup ? "new-password" : "current-password";
      $("access-submit").textContent = state.setup ? "Crear acceso y entrar →" : "Entrar al estudio →";
    } catch (error) {
      $("access-title").textContent = "Conectemos tu estudio.";
      $("access-description").textContent =
        "Para editar y publicar, inicia el servidor del proyecto con npm.cmd run sitio y abre http://localhost:5500/admin/.";
      $("access-error").textContent = error.message;
    }
  }
  $("access-form").addEventListener("submit", async e => {
    e.preventDefault();
    $("access-error").textContent = "";
    const password = $("access-password").value;
    if (state.setup && password !== $("access-confirm").value) {
      $("access-error").textContent = "Las contraseñas no coinciden.";
      return;
    }
    $("access-submit").disabled = true;
    try {
      const data = await api(state.setup ? "setup" : "login", { method: "POST", body: { password } });
      state.csrf = data.csrfToken;
      $("access-password").value = $("access-confirm").value = "";
      await activate();
    } catch (error) {
      $("access-error").textContent = error.message;
    } finally {
      $("access-submit").disabled = false;
    }
  });
  function cacheDraft() {
    if (!state.report || !state.dirty) return;
    try {
      localStorage.setItem(
        draftKey(),
        JSON.stringify({ publication: state.report, savedAt: new Date().toISOString() })
      );
      $("save-status").textContent = "Cambios recuperables en este navegador · sin guardar en el servidor";
    } catch {
      $("save-status").textContent = "Cambios sin guardar · descarga un respaldo o guarda el informe";
    }
  }
  function changed() {
    state.dirty = true;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(cacheDraft, 700);
    $("save-status").textContent = "Cambios sin guardar";
    $("editor-title").textContent = state.report.titulo || "Nuevo informe";
    $("editor-page-count").textContent =
      `${state.report.editorial.paginas.length} páginas · ${labels[state.report.estado]}`;
  }
  async function leaveEditor() {
    if (state.saving || state.uploading) {
      toast("Espera a que termine el guardado o la subida de imágenes.");
      return false;
    }
    if (state.view !== "editor" || !state.dirty) return true;
    cacheDraft();
    return confirmAction(
      "¿Volver a la biblioteca?",
      "Tus cambios quedan recuperables en este navegador. Guárdalos en el servidor para que el equipo pueda continuar desde otro dispositivo.",
      "Volver a la biblioteca"
    );
  }
  async function showView(view) {
    if (view !== "editor" && !(await leaveEditor())) return;
    state.view = view;
    ["library", "media", "guide", "editor"].forEach(name => {
      $(`${name}-view`).hidden = name !== view;
    });
    document
      .querySelectorAll("[data-view]")
      .forEach(b => b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false"));
    $("workspace-label").textContent = {
      library: "Biblioteca editorial",
      media: "Biblioteca de imágenes",
      guide: "Guía del estudio",
      editor: "Editor de informes"
    }[view];
    if (view === "library") renderLibrary();
    if (view === "media") await loadMedia();
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function ensureBook(pub) {
    const p = M.clone(pub);
    if (p.editorial?.paginas?.length) return p;
    const initial = M.createReport();
    p.editorial = {
      ...initial.editorial,
      paginas: [
        {
          ...initial.editorial.paginas[0],
          titulo: p.titulo,
          bajada: p.subtitulo || "",
          imagen: p.imagen || "",
          alt: ""
        },
        { tipo: "interior", titulo: "Análisis", diseno: "texto", contenido: p.desarrollo || p.resumen || "" }
      ]
    };
    if (p.fuentes?.length)
      p.editorial.paginas.push({
        tipo: "interior",
        titulo: "Fuentes y referencias",
        diseno: "referencias",
        bloques: [{ tipo: "fuentes", items: M.clone(p.fuentes) }]
      });
    return p;
  }
  function nextEdition() {
    return String(Math.max(0, ...state.items.map(p => parseInt(p.editorial?.edicion, 10) || 0)) + 1).padStart(
      2,
      "0"
    );
  }
  function uniqueSlug(value) {
    const base = M.slug(value) || "nuevo-informe";
    let id = base,
      n = 2;
    while (state.items.some(p => p.id === id && p.id !== state.originalId)) id = base + "-" + n++;
    return id;
  }
  async function openReport(pub = null, duplicate = false) {
    if (!(await leaveEditor())) return;
    state.originalId = duplicate ? null : pub?.id || null;
    let report = pub ? ensureBook(pub) : M.createReport(nextEdition());
    if (duplicate) {
      report.titulo += " — Copia";
      report.estado = "borrador";
      report.id = uniqueSlug(report.titulo);
      report.fecha = M.today();
      report.actualizado = "";
      report.editorial.edicion = nextEdition();
      report.editorial.paginas[0].titulo = report.titulo;
    }
    let recovered = false;
    if (!duplicate) {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey()) || "null");
        if (
          draft?.publication &&
          JSON.stringify(draft.publication) !== JSON.stringify(report) &&
          (await confirmAction(
            "Encontramos un borrador recuperable.",
            "Hay cambios guardados en este navegador. ¿Quieres continuar desde esa copia? Los datos del servidor se conservarán hasta que guardes.",
            "Recuperar cambios",
            "Usar versión del servidor"
          ))
        ) {
          report = ensureBook(draft.publication);
          recovered = true;
        }
      } catch {}
    }
    state.report = report;
    state.step = 0;
    state.page = 1;
    state.dirty = recovered;
    state.idCustom = !!pub && !duplicate;
    await showView("editor");
    renderEditor();
    if (recovered)
      $("save-status").textContent = "Borrador recuperado · guarda para conservarlo en el servidor";
  }
  function renderEditor() {
    $("editor-title").textContent = state.report.titulo || "Nuevo informe";
    $("save-report").textContent =
      state.report.estado === "publicado"
        ? "Guardar cambios en la web"
        : state.report.estado === "revision"
          ? "Guardar revisión"
          : "Guardar borrador";
    $("save-status").textContent = state.dirty
      ? "Cambios sin guardar"
      : state.originalId
        ? "Versión guardada en el servidor"
        : "Nuevo borrador · sin guardar";
    document
      .querySelectorAll("[data-step]")
      .forEach(b => b.setAttribute("aria-current", Number(b.dataset.step) === state.step ? "step" : "false"));
    $("previous-step").hidden = state.step === 0;
    $("next-step").hidden = state.step === 3;
    $("editor-page-count").textContent =
      `${state.report.editorial.paginas.length} páginas · ${labels[state.report.estado]}`;
    $("editor-error").hidden = true;
    $("editor-panel").innerHTML = [renderInfo, renderCover, renderPages, renderReview][state.step]();
    if (state.step === 1) updateCover();
  }
  function renderInfo() {
    return `<div class="editor-split"><section class="editor-panel-card"><h2>La identidad del informe</h2><p>Estos datos aparecerán junto a la edición en la biblioteca pública.</p><div class="studio-fields">${field("Título del informe", "titulo", { wide: true, placeholder: "¿Qué tema analiza esta edición?", max: 220 })}${field("Subtítulo", "subtitulo", { wide: true, placeholder: "Una línea que amplíe el título", max: 400 })}${field("Autor o equipo responsable", "autor", { placeholder: "Nombre del autor o Equipo CERI" })}${field("Revisado por (opcional)", "revisadoPor", { placeholder: "Nombre de quien revisó la edición" })}${field("Fecha de publicación", "fecha", { type: "date" })}${field("Número de edición", "editorial.edicion", { placeholder: "Ej. 02" })}${field("Ámbito", "ambito", { type: "select", options: ["Nacional", "América Latina", "Internacional"] })}${field("Tipo de publicación", "tipo", { type: "select", options: ["Informe", "Análisis", "Nota de coyuntura", "Explicador"] })}${field("Temas", "temas", { array: true, wide: true, placeholder: "Geopolítica, elecciones, América Latina", hint: "Separa los temas con comas. Ayudan a encontrar el informe en la biblioteca." })}${field("Resumen de la edición", "resumen", { type: "textarea", wide: true, rows: 4, hint: "Presenta en 2 o 3 frases qué encontrará el lector." })}${field("Nota de edición (opcional)", "editorial.nota", { wide: true, placeholder: "Ej. Fecha de corte: 15 de noviembre de 2026" })}<label class="studio-field studio-field--wide studio-field--check"><input type="checkbox" data-bind="destacado"${state.report.destacado ? " checked" : ""}> Destacar este informe en el inicio</label>${field("Identificador del enlace", "id", { wide: true, hint: "Se genera a partir del título. Cambiarlo después de publicar modifica el enlace del informe." })}</div></section><aside><div class="editor-tip"><p class="eyebrow">Una edición con criterio</p><h3>Claridad desde el inicio.</h3><ul><li>Usa un título que describa el tema.</li><li>Indica quién escribió y revisó el informe.</li><li>Señala la fecha de corte cuando analices una coyuntura.</li><li>Reserva una página para las fuentes.</li></ul></div><div class="editor-tip"><h3>Tu libro se construye aquí.</h3><p>La portada y las páginas que prepares se convertirán en una edición navegable. Puedes comprobar el resultado con “Vista previa” en cualquier momento.</p></div></aside></div>`;
  }
  function renderCover() {
    return `<div class="editor-split"><section class="editor-panel-card"><h2>La primera impresión</h2><p>Elige una portada editorial o conserva un diseño de página completo.</p><div class="studio-fields">${field(
      "Estilo de portada",
      "editorial.paginas.0.diseno",
      {
        type: "select",
        wide: true,
        rerender: true,
        options: [
          { value: "texto", label: "Portada editorial: título y foto" },
          { value: "lamina", label: "Diseño completo: una imagen de portada" }
        ]
      }
    )}<div class="studio-field studio-field--wide">Imagen de portada${imageWell("editorial.paginas.0")}</div>${field("Título en la portada", "editorial.paginas.0.titulo", { wide: true })}${field("Subtítulo en la portada", "editorial.paginas.0.bajada", { type: "textarea", wide: true, rows: 3 })}${field("Descripción de la imagen", "editorial.paginas.0.alt", { type: "textarea", wide: true, rows: 2, hint: "Describe lo que aparece. Permite comprender la imagen a quienes usan un lector de pantalla." })}${field("Crédito o pie de foto (opcional)", "editorial.paginas.0.pie", { wide: true })}</div></section><aside class="cover-preview"><p>Portada de tu edición</p><div id="cover-preview-art"></div><p>Vista previa en tiempo real</p></aside></div>`;
  }
  function updateCover() {
    if ($("cover-preview-art")) $("cover-preview-art").innerHTML = CeriEditorial.cover(previewData());
  }
  function renderPages() {
    const pages = state.report.editorial.paginas;
    state.page = Math.max(1, Math.min(state.page, pages.length - 1));
    const list = pages
      .map(
        (p, i) =>
          `<div class="page-row"${i ? ' draggable="true"' : ""} data-page-row="${i}"${i === state.page ? ' aria-current="page"' : ""}><button type="button" class="page-row__select" data-select-page="${i}"><span class="page-row__number">${String(i + 1).padStart(2, "0")}</span><span>${E(i ? p.titulo || "Página sin título" : "Portada")}</span></button>${i ? `<div class="page-row__moves"><button type="button" class="icon-button" data-page-move="${i}" data-direction="-1" aria-label="Subir página ${i + 1}"${i === 1 ? " disabled" : ""}>↑</button><button type="button" class="icon-button" data-page-move="${i}" data-direction="1" aria-label="Bajar página ${i + 1}"${i === pages.length - 1 ? " disabled" : ""}>↓</button></div>` : ""}</div>`
      )
      .join("");
    return `<div class="pages-editor"><aside class="pages-sidebar"><p class="eyebrow">Páginas de la edición</p><div class="pages-list">${list}</div><button type="button" class="studio-button studio-button--primary" data-page-action="add">+ Añadir página</button><button type="button" class="studio-button" data-page-action="bulk">Subir páginas diseñadas</button><p class="studio-caption" style="margin:14px 0 0">Reordena con las flechas o arrastra las páginas.</p></aside><section class="editor-panel-card">${pages.length < 2 ? '<div class="studio-empty"><h3>El informe continúa aquí.</h3><p>Agrega una página de texto, fotos o fuentes.</p><button type="button" class="studio-button" data-page-action="add">+ Primera página interior</button></div>' : renderPageEditor()}</section></div>`;
  }
  function renderPageEditor() {
    const p = currentPage(),
      route = pagePath();
    let content = `<div class="page-editor-head"><div><p class="eyebrow">Página ${state.page + 1} de ${state.report.editorial.paginas.length}</p><h2>${E(p.titulo || "Página sin título")}</h2></div><div><button type="button" class="studio-button studio-button--quiet" data-page-action="duplicate">Duplicar</button><button type="button" class="studio-button studio-button--quiet" data-page-action="remove">Quitar</button></div></div><div class="studio-fields">${field("Título de página", route + ".titulo", { wide: true })}${field("Sección o capítulo (opcional)", route + ".seccion")}${field(
      "Composición",
      route + ".diseno",
      {
        type: "select",
        rerender: true,
        options: [
          { value: "texto", label: "Una columna" },
          { value: "columnas", label: "Dos columnas" },
          { value: "referencias", label: "Referencias" },
          { value: "lamina", label: "Diseño de página completo" }
        ]
      }
    )}</div>`;
    if (p.diseno === "lamina")
      return (
        content +
        `<div class="studio-fields" style="margin-top:22px"><div class="studio-field studio-field--wide">Diseño de la página${imageWell(route)}</div>${field("Descripción de la página", route + ".alt", { wide: true, type: "textarea", rows: 3 })}${field("Crédito (opcional)", route + ".pie", { wide: true })}</div><p class="studio-caption">La imagen se mostrará completa dentro del libro. Para texto seleccionable, usa una página de bloques.</p>`
      );
    if (!p.bloques?.length && (p.contenido || p.imagen))
      content += `<div class="studio-fields" style="margin-top:22px">${field("Contenido de la página", route + ".contenido", { type: "textarea", wide: true, rows: 8, hint: "Separa los párrafos con una línea en blanco. Usa **negrita** para destacar." })}<div class="studio-field studio-field--wide">Imagen de esta página${imageWell(route)}</div>${field("Descripción de la imagen", route + ".alt", { wide: true })}${field("Colocar imagen después del párrafo", route + ".imagenDespuesDe", { type: "number", min: 0 })}</div>`;
    content += `<div class="blocks-list">${(p.bloques || []).map((b, i) => renderBlock(b, i)).join("")}</div><div class="block-toolbar" aria-label="Añadir contenido">${Object.keys(
      blockLabels
    )
      .map(
        type =>
          `<button type="button" class="studio-button" data-add-block="${type}">+ ${E(blockLabels[type])}</button>`
      )
      .join("")}</div>`;
    return content;
  }
  function renderBlock(block, index) {
    const route = pagePath() + `.bloques.${index}`;
    let body = "";
    if (["parrafo", "destacado"].includes(block.tipo))
      body =
        field(block.tipo === "parrafo" ? "Texto del párrafo" : "Idea principal", route + ".texto", {
          type: "textarea",
          rows: block.tipo === "parrafo" ? 5 : 3
        }) +
        `<div class="text-tools"><button type="button" data-bold="${E(route + ".texto")}" aria-label="Aplicar negrita">B</button><span>Selecciona un fragmento y pulsa B para destacarlo.</span></div>`;
    else if (block.tipo === "imagen")
      body =
        imageWell(route, "src") +
        field("Descripción de la imagen", route + ".alt", { hint: "Explica lo que aparece en la foto." }) +
        field("Pie de foto o crédito (opcional)", route + ".pie");
    else
      body = `<div class="block-items">${(block.items || [])
        .map((item, j) => {
          const itemRoute = route + `.items.${j}`;
          return `<div class="block-item"><div class="block-item__head"><strong>Elemento ${j + 1}</strong><div><button type="button" class="icon-button" data-item-move="${index}:${j}" data-direction="-1" aria-label="Subir elemento"${j === 0 ? " disabled" : ""}>↑</button><button type="button" class="icon-button" data-item-move="${index}:${j}" data-direction="1" aria-label="Bajar elemento"${j === block.items.length - 1 ? " disabled" : ""}>↓</button><button type="button" class="icon-button" data-remove-item="${index}:${j}" aria-label="Quitar elemento">✕</button></div></div>${block.tipo === "fuentes" ? field("Fuente", itemRoute + ".nombre") + field("Enlace", itemRoute + ".url", { type: "url", placeholder: "https://…" }) : (block.tipo === "cronologia" ? field("Año o etiqueta", itemRoute + ".etiqueta", { placeholder: "Ej. 2026" }) : "") + field("Título", itemRoute + ".titulo") + field("Explicación", itemRoute + ".texto", { type: "textarea", rows: 3 })}</div>`;
        })
        .join(
          ""
        )}</div><button type="button" class="studio-button" data-add-item="${index}">+ ${block.tipo === "fuentes" ? "Añadir fuente" : "Añadir elemento"}</button>`;
    return `<article class="block-editor"><header class="block-editor__header"><strong>${String(index + 1).padStart(2, "0")} / ${E(blockLabels[block.tipo] || block.tipo)}</strong><div><button type="button" class="icon-button" data-block-move="${index}" data-direction="-1" aria-label="Subir bloque"${index === 0 ? " disabled" : ""}>↑</button><button type="button" class="icon-button" data-block-move="${index}" data-direction="1" aria-label="Bajar bloque"${index === currentPage().bloques.length - 1 ? " disabled" : ""}>↓</button><button type="button" class="icon-button" data-block-duplicate="${index}" aria-label="Duplicar bloque">⧉</button><button type="button" class="icon-button" data-block-remove="${index}" aria-label="Quitar bloque">✕</button></div></header><div class="block-editor__body">${body}</div></article>`;
  }
  function publishCheck() {
    return M.validate(state.report, true);
  }
  function renderReview() {
    const check = publishCheck(),
      p = state.report;
    return `<div class="review-grid"><section class="editor-panel-card"><p class="eyebrow">Última lectura</p><h2>Una edición lista para compartir.</h2><p>Comprueba el libro completo antes de publicarlo.</p><button type="button" class="studio-button" data-editor-action="preview">Abrir vista previa del libro ↗</button><div class="review-ready"><b>${check.errors.length ? "○" : "✓"}</b><p>${check.errors.length ? `${check.errors.length} ${check.errors.length === 1 ? "detalle pendiente" : "detalles pendientes"} antes de publicar.` : "La edición tiene los datos, la portada y el contenido necesarios para publicarse."}</p></div>${check.errors.length ? `<ul class="review-list">${check.errors.map((issue, i) => `<li><button type="button" data-fix="${i}"><span>→</span>${E(issue.message)}</button></li>`).join("")}</ul>` : ""}${check.warnings.map(w => `<p class="studio-caption">${E(w)}</p>`).join("")}<div class="publish-actions"><button type="button" class="studio-button studio-button--primary" data-editor-action="publish"${check.errors.length ? " disabled" : ""}>${p.estado === "publicado" ? "Actualizar publicación" : "Publicar en la biblioteca"} ↗</button>${p.estado !== "publicado" ? '<button type="button" class="studio-button" data-editor-action="review">Guardar para revisión</button>' : ""}</div><p class="studio-caption" style="margin-top:16px">Al publicar, la edición aparecerá como libro en la biblioteca pública. Guardar un borrador no la hace pública.</p><div id="publish-result"></div></section><aside><div class="cover-preview"><p>Tu próxima edición</p>${CeriEditorial.cover(previewData())}<p>${p.editorial.paginas.length} páginas · Edición ${E(p.editorial.edicion || "por asignar")}</p></div><div class="editor-tip" style="margin-top:20px"><h3>Antes de compartir</h3><ul><li>Comprueba nombres, fechas y fuentes.</li><li>Revisa que las fotos tengan permiso y crédito cuando corresponda.</li><li>Recorre todas las páginas y prueba el modo texto.</li></ul></div></aside></div>`;
  }
  function previewData() {
    const pub = M.clone(state.report);
    pub.titulo ||= "Título del informe";
    pub.autor ||= "Equipo autor";
    pub.editorial.paginas = pub.editorial.paginas.map((p, i) => ({
      ...p,
      titulo: p.titulo || (i ? `Página ${i + 1}` : pub.titulo)
    }));
    return pub;
  }
  function preview() {
    const dialog = $("preview-dialog");
    dialog.showModal();
    CeriEditorial.mount($("admin-preview"), previewData());
  }
  async function save(status = null) {
    if (state.saving) return false;
    const candidate = M.clone(state.report);
    candidate.estado = status || candidate.estado;
    candidate.actualizado = M.today();
    if (!candidate.id) candidate.id = uniqueSlug(candidate.titulo);
    const sources = candidate.editorial.paginas.flatMap(p =>
      (p.bloques || []).filter(b => b.tipo === "fuentes").flatMap(b => b.items || [])
    );
    if (sources.length)
      candidate.fuentes = sources
        .filter((s, i, a) => a.findIndex(x => x.url === s.url && x.nombre === s.nombre) === i)
        .map(x => ({ nombre: x.nombre || "", url: x.url || "" }));
    const validation = M.validate(candidate);
    if (validation.errors.length) {
      state.step = candidate.estado === "publicado" ? 3 : validation.errors[0].step;
      renderEditor();
      errorMessage({ message: "Completa los datos indicados antes de guardar.", details: validation.errors });
      return false;
    }
    state.saving = true;
    $("editor-panel").inert = true;
    $("editor-steps").inert = true;
    $("save-report").disabled = true;
    $("save-status").textContent = "Guardando en el servidor…";
    const previousKey = draftKey();
    try {
      const data = await api("publicaciones", {
        method: "POST",
        body: { publication: candidate, originalId: state.originalId, revision: state.revision }
      });
      const index = state.items.findIndex(p => p.id === state.originalId);
      if (index < 0) state.items.unshift(data.publication);
      else state.items[index] = data.publication;
      state.report = data.publication;
      state.originalId = data.publication.id;
      state.revision = data.revision;
      state.dirty = false;
      clearTimeout(autosaveTimer);
      try {
        localStorage.removeItem(previousKey);
        localStorage.removeItem(draftKey());
      } catch {}
      renderEditor();
      $("save-status").textContent =
        `Guardado en el servidor · ${new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;
      if (candidate.estado === "publicado" && state.step === 3)
        $("publish-result").innerHTML =
          `<div class="published-result"><p class="eyebrow">Edición publicada</p><h3>El informe ya está en la biblioteca.</h3><a class="studio-button studio-button--primary" href="${E(publicLink(candidate))}" target="_blank" rel="noopener">Ver en la web ↗</a><button type="button" class="studio-button" data-editor-action="copy-link">Copiar enlace</button></div>`;
      toast(
        candidate.estado === "publicado"
          ? "Edición publicada. Ya puedes verla en la biblioteca."
          : "Informe guardado en el servidor."
      );
      return true;
    } catch (error) {
      cacheDraft();
      errorMessage(error);
      return false;
    } finally {
      state.saving = false;
      $("editor-panel").inert = false;
      $("editor-steps").inert = false;
      $("save-report").disabled = false;
    }
  }
  function downloadJSON(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function loadMedia() {
    try {
      const data = await api("media");
      state.media = data.items;
      renderMedia();
    } catch (error) {
      toast(error.message);
    }
  }
  function renderMedia() {
    const q = $("media-search").value.toLowerCase();
    const tiles = (items, picker) =>
      items
        .map(m =>
          picker
            ? `<button type="button" class="media-tile" data-media="${E(m.path)}"><img src="${E(rutaImagen(m.path))}" alt="" loading="lazy"><span>${E(m.name)}</span></button>`
            : `<a class="media-tile" href="${E(rutaImagen(m.path))}" target="_blank" rel="noopener"><img src="${E(rutaImagen(m.path))}" alt="" loading="lazy"><span>${E(m.name)}</span></a>`
        )
        .join("");
    $("media-library").innerHTML = state.media.length
      ? tiles(state.media, false)
      : '<p class="studio-caption">Todavía no hay imágenes. Sube los primeros recursos de tu edición.</p>';
    const filtered = state.media.filter(m => !q || m.name.toLowerCase().includes(q));
    $("media-picker-grid").innerHTML = filtered.length
      ? tiles(filtered, true)
      : '<p class="studio-caption">No encontramos imágenes con ese nombre.</p>';
  }
  async function openMedia(target = null) {
    state.mediaTarget = target;
    $("media-search").value = "";
    $("upload-status").textContent = "";
    $("media-dialog").showModal();
    await loadMedia();
  }
  function useImage(path) {
    if (!state.mediaTarget) {
      toast("Puedes seleccionar esta imagen al editar una portada o un bloque de foto.");
      return;
    }
    const object = deepGet(state.report, state.mediaTarget.route),
      key = state.mediaTarget.key || "imagen";
    if (object[key] !== path) {
      object[key] = path;
      delete object.recorte;
      delete object.original;
    }
    $("media-dialog").close();
    changed();
    renderEditor();
  }
  async function optimized(file) {
    if (file.size > 12 * 1024 * 1024) throw Error(`“${file.name}” supera los 12 MB.`);
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))
      throw Error("Selecciona imágenes JPG, PNG, WebP o GIF.");
    if (file.type === "image/gif") return { blob: file, name: file.name };
    try {
      const image = await createImageBitmap(file),
        scale = Math.min(1, 1800 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.9));
      if (blob && blob.size < file.size)
        return {
          blob,
          name: file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/webp" ? ".webp" : ".png")
        };
    } catch {}
    return { blob: file, name: file.name };
  }
  async function uploadOne(file) {
    const image = await optimized(file);
    return api("media", {
      method: "POST",
      headers: { "Content-Type": image.blob.type, "X-File-Name": encodeURIComponent(image.name) },
      body: image.blob
    });
  }
  async function uploadSelection(files) {
    if (!files.length || state.uploading) return;
    state.uploading = true;
    $("media-upload").disabled = true;
    try {
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        $("upload-status").textContent = `Subiendo imagen ${i + 1} de ${files.length}…`;
        uploaded.push(await uploadOne(files[i]));
      }
      $("upload-status").textContent =
        `${uploaded.length} ${uploaded.length === 1 ? "imagen lista" : "imágenes listas"}.`;
      await loadMedia();
      if (uploaded.length === 1 && state.mediaTarget) useImage(uploaded[0].path);
      else toast("Imágenes subidas. Selecciona la que quieres usar.");
    } catch (error) {
      $("upload-status").textContent = error.message;
    } finally {
      state.uploading = false;
      $("media-upload").disabled = false;
      $("media-upload").value = "";
    }
  }
  function emptyPage(p) {
    return (
      !p.imagen &&
      !String(p.contenido || "").trim() &&
      !(p.bloques || []).some(b => b.src || String(b.texto || "").trim() || b.items?.length)
    );
  }
  async function bulkPages(files) {
    if (!files.length) return;
    if (files.length + state.report.editorial.paginas.length > 100) {
      toast("Cada edición puede tener hasta 100 páginas.");
      return;
    }
    const filesArray = [...files];
    if (
      !(await confirmAction(
        "¿Añadir páginas diseñadas?",
        `Se subirán ${filesArray.length} imágenes en el orden seleccionado. Cada una será una página completa del libro. Puedes reordenarlas después.`,
        "Subir páginas"
      ))
    )
      return;
    const cover = state.report.editorial.paginas[0],
      useCover = !cover.imagen && state.report.editorial.paginas.slice(1).every(emptyPage);
    state.saving = true;
    $("save-report").disabled = true;
    $("editor-panel").inert = true;
    $("editor-steps").inert = true;
    $("previous-step").disabled = true;
    $("next-step").disabled = true;
    try {
      const uploaded = [];
      for (let i = 0; i < filesArray.length; i++) {
        $("save-status").textContent = `Subiendo página ${i + 1} de ${filesArray.length}…`;
        uploaded.push(await uploadOne(filesArray[i]));
      }
      if (useCover) {
        cover.imagen = uploaded.shift().path;
        cover.diseno = "lamina";
        cover.alt = `Portada de ${state.report.titulo || "la edición"}`;
        state.report.editorial.paginas = [cover];
      }
      for (const image of uploaded) {
        const p = M.createPage("lamina");
        p.titulo = `Página ${state.report.editorial.paginas.length + 1}`;
        p.imagen = image.path;
        p.miniatura = image.path;
        p.alt = `Página de ${state.report.titulo || "la edición"}`;
        state.report.editorial.paginas.push(p);
      }
      state.page = Math.max(1, state.report.editorial.paginas.length - uploaded.length);
      changed();
      renderEditor();
      toast("Páginas añadidas. Revisa sus títulos y descripciones antes de publicar.");
    } catch (error) {
      errorMessage(error);
    } finally {
      state.saving = false;
      $("save-report").disabled = false;
      $("editor-panel").inert = false;
      $("editor-steps").inert = false;
      $("previous-step").disabled = false;
      $("next-step").disabled = false;
      $("bulk-pages-input").value = "";
    }
  }
  function move(array, index, direction, min = 0) {
    const target = index + direction;
    if (target < min || target >= array.length) return false;
    [array[index], array[target]] = [array[target], array[index]];
    return true;
  }
  function migrateSimplePage() {
    const p = currentPage();
    if (p.bloques?.length) return;
    if (p.contenido || p.imagen) {
      p.bloques = String(p.contenido || "")
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map(texto => ({ tipo: "parrafo", texto }));
      if (p.imagen)
        p.bloques.splice(Number.isInteger(p.imagenDespuesDe) ? p.imagenDespuesDe : p.bloques.length, 0, {
          tipo: "imagen",
          src: p.imagen,
          alt: p.alt || "",
          pie: p.pie || "",
          ...(p.recorte ? { recorte: p.recorte, original: p.original } : {})
        });
      delete p.contenido;
      delete p.imagen;
      delete p.recorte;
      delete p.original;
    } else p.bloques = [];
  }
  $("editor-form").addEventListener("submit", e => e.preventDefault());
  function onField(e) {
    const input = e.target.closest("[data-bind]");
    if (!input || !state.report) return;
    const path = input.dataset.bind,
      old = deepGet(state.report, path);
    const value =
      input.type === "checkbox"
        ? input.checked
        : input.dataset.array
          ? input.value
              .split(",")
              .map(v => v.trim())
              .filter(Boolean)
          : input.type === "number"
            ? input.value === ""
              ? undefined
              : Number(input.value)
            : input.value;
    deepSet(state.report, path, value);
    if (path === "id") state.idCustom = true;
    if (path === "titulo") {
      if (!state.idCustom) state.report.id = uniqueSlug(value);
      if (!state.report.editorial.paginas[0].titulo || state.report.editorial.paginas[0].titulo === old)
        state.report.editorial.paginas[0].titulo = value;
      const slugInput = $("editor-panel").querySelector('[data-bind="id"]');
      if (slugInput) slugInput.value = state.report.id;
    }
    if (
      path === "subtitulo" &&
      (!state.report.editorial.paginas[0].bajada || state.report.editorial.paginas[0].bajada === old)
    )
      state.report.editorial.paginas[0].bajada = value;
    changed();
    if (state.step === 1) {
      clearTimeout(coverTimer);
      coverTimer = setTimeout(updateCover, 180);
    }
    if (e.type === "change" && input.dataset.rerender) {
      if (
        path.endsWith(".diseno") &&
        value === "lamina" &&
        !deepGet(state.report, path.replace(/\.diseno$/, ".imagen"))
      ) {
        const selected = deepGet(state.report, path.replace(/\.diseno$/, "")).bloques?.find(
          b => b.tipo === "imagen"
        );
        if (selected) {
          const page = deepGet(state.report, path.replace(/\.diseno$/, ""));
          page.imagen = selected.src;
          page.alt = selected.alt;
        }
      }
      renderEditor();
    }
  }
  $("editor-panel").addEventListener("input", onField);
  $("editor-panel").addEventListener("change", onField);
  document.addEventListener("click", async e => {
    const view = e.target.closest("[data-view]");
    if (view) {
      await showView(view.dataset.view);
      return;
    }
    const close = e.target.closest("[data-close]");
    if (close) {
      $(close.dataset.close).close();
      return;
    }
    const fresh = e.target.closest('[data-action="new"]');
    if (fresh) {
      await openReport();
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      await openReport(state.items.find(p => p.id === edit.dataset.edit));
      return;
    }
    const dupe = e.target.closest("[data-duplicate]");
    if (dupe) {
      await openReport(
        state.items.find(p => p.id === dupe.dataset.duplicate),
        true
      );
      return;
    }
    const withdraw = e.target.closest("[data-withdraw]");
    if (withdraw) {
      const p = state.items.find(p => p.id === withdraw.dataset.withdraw);
      if (
        await confirmAction(
          "¿Retirar esta edición de la biblioteca?",
          "El informe volverá a borrador. Sus páginas e imágenes se conservarán en el panel y podrás publicarlo de nuevo.",
          "Retirar a borrador"
        )
      ) {
        try {
          const candidate = M.clone(p);
          candidate.estado = "borrador";
          const data = await api("publicaciones", {
            method: "POST",
            body: { publication: candidate, originalId: p.id, revision: state.revision }
          });
          state.revision = data.revision;
          state.items[state.items.findIndex(x => x.id === p.id)] = data.publication;
          renderLibrary();
          toast("Edición conservada como borrador.");
        } catch (error) {
          toast(error.message);
        }
      }
      return;
    }
    const status = e.target.closest("[data-status]");
    if (status) {
      state.status = status.dataset.status;
      document
        .querySelectorAll("[data-status]")
        .forEach(b => b.setAttribute("aria-pressed", String(b === status)));
      renderLibrary();
      return;
    }
    const step = e.target.closest("[data-step]");
    if (step) {
      state.step = Number(step.dataset.step);
      renderEditor();
      return;
    }
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      await openMedia({ route: pick.dataset.pick, key: pick.dataset.imageKey });
      return;
    }
    const chosen = e.target.closest("[data-media]");
    if (chosen) {
      useImage(chosen.dataset.media);
      return;
    }
    const removeImage = e.target.closest("[data-remove-image]");
    if (removeImage) {
      const object = deepGet(state.report, removeImage.dataset.removeImage);
      object[removeImage.dataset.imageKey || "imagen"] = "";
      delete object.recorte;
      delete object.original;
      changed();
      renderEditor();
      return;
    }
    const selected = e.target.closest("[data-select-page]");
    if (selected) {
      const i = Number(selected.dataset.selectPage);
      if (!i) state.step = 1;
      else state.page = i;
      renderEditor();
      return;
    }
    const pageMove = e.target.closest("[data-page-move]");
    if (pageMove) {
      const i = Number(pageMove.dataset.pageMove),
        d = Number(pageMove.dataset.direction);
      if (move(state.report.editorial.paginas, i, d, 1)) {
        state.page = i + d;
        changed();
        renderEditor();
      }
      return;
    }
    const pageAction = e.target.closest("[data-page-action]");
    if (pageAction) {
      const a = pageAction.dataset.pageAction;
      if (a === "add") $("template-dialog").showModal();
      if (a === "bulk") $("bulk-pages-input").click();
      if (a === "duplicate") {
        state.report.editorial.paginas.splice(state.page + 1, 0, M.clone(currentPage()));
        state.page++;
        changed();
        renderEditor();
      }
      if (
        a === "remove" &&
        (await confirmAction(
          "¿Quitar esta página?",
          "La página se quitará de este borrador. El informe guardado no cambia hasta que guardes los cambios.",
          "Quitar página"
        ))
      ) {
        state.report.editorial.paginas.splice(state.page, 1);
        state.page = Math.max(1, state.page - 1);
        changed();
        renderEditor();
      }
      return;
    }
    const template = e.target.closest("[data-template]");
    if (template) {
      if (state.report.editorial.paginas.length >= 100) {
        toast("La edición ya tiene 100 páginas.");
        return;
      }
      state.report.editorial.paginas.push(M.createPage(template.dataset.template));
      state.page = state.report.editorial.paginas.length - 1;
      $("template-dialog").close();
      changed();
      renderEditor();
      return;
    }
    const addBlock = e.target.closest("[data-add-block]");
    if (addBlock) {
      migrateSimplePage();
      currentPage().bloques.push(M.createBlock(addBlock.dataset.addBlock));
      changed();
      renderEditor();
      return;
    }
    const blockMove = e.target.closest("[data-block-move]");
    if (blockMove) {
      if (
        move(currentPage().bloques, Number(blockMove.dataset.blockMove), Number(blockMove.dataset.direction))
      ) {
        changed();
        renderEditor();
      }
      return;
    }
    const blockDupe = e.target.closest("[data-block-duplicate]");
    if (blockDupe) {
      const i = Number(blockDupe.dataset.blockDuplicate);
      currentPage().bloques.splice(i + 1, 0, M.clone(currentPage().bloques[i]));
      changed();
      renderEditor();
      return;
    }
    const blockRemove = e.target.closest("[data-block-remove]");
    if (blockRemove) {
      const i = Number(blockRemove.dataset.blockRemove);
      if (
        await confirmAction(
          "¿Quitar este bloque?",
          "Se quitará de la página actual. Guarda los cambios cuando termines de revisar la edición.",
          "Quitar bloque"
        )
      ) {
        currentPage().bloques.splice(i, 1);
        changed();
        renderEditor();
      }
      return;
    }
    const addItem = e.target.closest("[data-add-item]");
    if (addItem) {
      const b = currentPage().bloques[Number(addItem.dataset.addItem)];
      b.items ||= [];
      b.items.push(
        b.tipo === "fuentes"
          ? { nombre: "", url: "" }
          : { titulo: "", texto: "", ...(b.tipo === "cronologia" ? { etiqueta: "" } : {}) }
      );
      changed();
      renderEditor();
      return;
    }
    const itemMove = e.target.closest("[data-item-move]");
    if (itemMove) {
      const [b, i] = itemMove.dataset.itemMove.split(":").map(Number);
      if (move(currentPage().bloques[b].items, i, Number(itemMove.dataset.direction))) {
        changed();
        renderEditor();
      }
      return;
    }
    const itemRemove = e.target.closest("[data-remove-item]");
    if (itemRemove) {
      const [b, i] = itemRemove.dataset.removeItem.split(":").map(Number);
      currentPage().bloques[b].items.splice(i, 1);
      changed();
      renderEditor();
      return;
    }
    const bold = e.target.closest("[data-bold]");
    if (bold) {
      const input = [...$("editor-panel").querySelectorAll("textarea[data-bind]")].find(
        el => el.dataset.bind === bold.dataset.bold
      );
      const start = input.selectionStart,
        end = input.selectionEnd;
      if (start === end) {
        toast("Selecciona primero el texto que quieres destacar.");
        input.focus();
        return;
      }
      input.value =
        input.value.slice(0, start) + "**" + input.value.slice(start, end) + "**" + input.value.slice(end);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      input.setSelectionRange(start + 2, end + 2);
      return;
    }
    const fix = e.target.closest("[data-fix]");
    if (fix) {
      const issue = publishCheck().errors[Number(fix.dataset.fix)];
      state.step = issue.step;
      if (issue.page > 0) state.page = issue.page;
      renderEditor();
      return;
    }
    const action = e.target.closest("[data-editor-action]");
    if (action) {
      const a = action.dataset.editorAction;
      if (a === "preview") preview();
      if (a === "publish") await save("publicado");
      if (a === "review") await save("revision");
      if (a === "copy-link") {
        try {
          await navigator.clipboard.writeText(publicLink(state.report));
          toast("Enlace copiado.");
        } catch {
          toast("Abre la edición y copia su dirección desde el navegador.");
        }
      }
    }
  });
  $("editor-panel").addEventListener("dragstart", e => {
    const row = e.target.closest("[data-page-row]");
    if (!row || Number(row.dataset.pageRow) === 0) return;
    e.dataTransfer.setData("text/x-ceri-page", row.dataset.pageRow);
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  });
  $("editor-panel").addEventListener("dragend", () =>
    document.querySelectorAll(".page-row.dragging").forEach(row => row.classList.remove("dragging"))
  );
  $("editor-panel").addEventListener("dragover", e => {
    if (e.target.closest("[data-page-row]") && e.dataTransfer.types.includes("text/x-ceri-page"))
      e.preventDefault();
  });
  $("editor-panel").addEventListener("drop", e => {
    const row = e.target.closest("[data-page-row]");
    if (!row) return;
    const raw = e.dataTransfer.getData("text/x-ceri-page");
    if (!raw) return;
    e.preventDefault();
    const from = Number(raw),
      to = Number(row.dataset.pageRow);
    if (from < 1 || to < 1 || from === to) return;
    const pages = state.report.editorial.paginas;
    pages.splice(to, 0, pages.splice(from, 1)[0]);
    state.page = to;
    changed();
    renderEditor();
  });
  $("previous-step").addEventListener("click", () => {
    state.step = Math.max(0, state.step - 1);
    renderEditor();
  });
  $("next-step").addEventListener("click", () => {
    state.step = Math.min(3, state.step + 1);
    renderEditor();
  });
  $("back-library").addEventListener("click", () => showView("library"));
  $("save-report").addEventListener("click", () => save());
  $("preview-report").addEventListener("click", preview);
  $("export-report").addEventListener("click", () =>
    downloadJSON(state.report, (state.report.id || "informe-ceri") + ".json")
  );
  $("report-search").addEventListener("input", e => {
    state.query = e.target.value;
    renderLibrary();
  });
  $("refresh-library").addEventListener("click", async () => {
    try {
      await loadLibrary();
      toast("Biblioteca actualizada.");
    } catch (error) {
      toast(error.message);
    }
  });
  $("download-backup").addEventListener("click", async () => {
    try {
      const data = await api("backup");
      downloadJSON(data, "ceri-publicaciones-" + M.today() + ".json");
    } catch (error) {
      toast(error.message);
    }
  });
  $("upload-library").addEventListener("click", () => openMedia());
  $("media-search").addEventListener("input", renderMedia);
  $("media-upload").addEventListener("change", e => uploadSelection([...e.target.files]));
  $("bulk-pages-input").addEventListener("change", e => bulkPages([...e.target.files]));
  $("media-drop").addEventListener("dragover", e => {
    e.preventDefault();
    $("media-drop").classList.add("drag-over");
  });
  $("media-drop").addEventListener("dragleave", () => $("media-drop").classList.remove("drag-over"));
  $("media-drop").addEventListener("drop", e => {
    e.preventDefault();
    $("media-drop").classList.remove("drag-over");
    if (!$("media-upload").disabled) uploadSelection([...e.dataTransfer.files]);
  });
  $("preview-dialog").addEventListener("close", () => {
    const host = $("admin-preview");
    host._reader?.destroy();
    host._reader = null;
  });
  $("media-dialog").addEventListener("close", () => {
    state.mediaTarget = null;
  });
  $("logout").addEventListener("click", async () => {
    if (!(await leaveEditor())) return;
    try {
      await api("logout", { method: "POST", body: {} });
      location.reload();
    } catch (error) {
      toast(error.message);
    }
  });
  window.addEventListener("beforeunload", e => {
    if (state.dirty) {
      cacheDraft();
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cacheDraft();
  });
  access();
})();
