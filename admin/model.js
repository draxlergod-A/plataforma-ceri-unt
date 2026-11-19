/* Modelo editorial compartido por el panel y su API. */
((root, factory) => {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CeriAdminModel = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const slug = value =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  function createBlock(tipo = "parrafo") {
    if (tipo === "imagen") return { tipo, src: "", alt: "", pie: "" };
    if (["fichas", "cronologia", "fuentes"].includes(tipo)) return { tipo, items: [] };
    return { tipo, texto: "" };
  }
  function createPage(template = "texto") {
    const p = { tipo: "interior", titulo: "", seccion: "", diseno: "texto", bloques: [] };
    if (template === "lamina") return { ...p, diseno: "lamina", imagen: "", alt: "" };
    if (template === "resumen")
      return { ...p, titulo: "Resumen ejecutivo", bloques: [createBlock(), createBlock("destacado")] };
    if (template === "cronologia")
      return { ...p, titulo: "Antecedentes y evolución", bloques: [createBlock("cronologia")] };
    if (template === "referencias")
      return {
        ...p,
        titulo: "Fuentes y referencias",
        diseno: "referencias",
        bloques: [createBlock("fuentes")]
      };
    return { ...p, bloques: [createBlock()] };
  }
  function createReport(number = "01") {
    return {
      id: "",
      titulo: "",
      subtitulo: "",
      tipo: "Informe",
      ambito: "Internacional",
      temas: [],
      autor: "",
      revisadoPor: "",
      fecha: today(),
      actualizado: "",
      estado: "borrador",
      destacado: false,
      imagen: "",
      resumen: "",
      hechos: [],
      posturas: [],
      desarrollo: "",
      escenarios: [],
      fuentes: [],
      correcciones: [],
      editorial: {
        edicion: number,
        nota: "",
        paginas: [{ tipo: "portada", titulo: "", bajada: "", imagen: "", alt: "" }, createPage("resumen")]
      }
    };
  }
  /* Nota o artículo: texto continuo, sin páginas de libro. */
  function createNote() {
    const p = createReport();
    delete p.editorial;
    return { ...p, formato: "nota", tipo: "Nota de coyuntura", imagenAlt: "" };
  }
  // Las publicaciones antiguas sin páginas de edición también se tratan como notas.
  const isNote = p => !!p && (p.formato === "nota" || (p.formato === undefined && !p.editorial));
  function mediaIn(p) {
    const paths = [];
    if (p.imagen) paths.push(p.imagen);
    for (const page of p.editorial?.paginas || []) {
      if (!page || typeof page !== "object") continue;
      if (page.imagen) paths.push(page.imagen);
      if (page.miniatura) paths.push(page.miniatura);
      for (const b of Array.isArray(page.bloques) ? page.bloques : [])
        if (b?.tipo === "imagen" && b.src) paths.push(b.src);
    }
    return [...new Set(paths)];
  }
  function validImage(path) {
    return (
      typeof path === "string" &&
      ((/^\/?assets\/img\/[a-zA-Z0-9_./() -]+\.(png|jpe?g|webp|gif)$/i.test(path) && !path.includes("..")) ||
        /^https:\/\//i.test(path))
    );
  }
  function validate(p, publishing = p?.estado === "publicado") {
    const errors = [],
      warnings = [];
    const add = (message, step = 0, page = null) => errors.push({ message, step, page });
    if (!p || typeof p !== "object" || Array.isArray(p))
      return { errors: [{ message: "El informe no es válido.", step: 0 }], warnings };
    if (typeof p.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id) || p.id.length > 120)
      add("Escribe un identificador válido para el enlace.");
    if (typeof p.titulo !== "string" || p.titulo.trim().length < 4)
      add("Añade un título de al menos 4 caracteres.");
    if (!["borrador", "revision", "publicado"].includes(p.estado)) add("Selecciona un estado válido.");
    for (const key of [
      "autor",
      "subtitulo",
      "resumen",
      "revisadoPor",
      "ambito",
      "tipo",
      "imagen",
      "desarrollo"
    ])
      if (p[key] !== undefined && typeof p[key] !== "string") add(`El campo ${key} debe contener texto.`);
    if (
      p.temas !== undefined &&
      (!Array.isArray(p.temas) || p.temas.length > 100 || p.temas.some(x => typeof x !== "string"))
    )
      add("Revisa la lista de temas.");
    for (const key of ["fuentes", "hechos", "posturas", "escenarios", "correcciones"])
      if (p[key] !== undefined && !Array.isArray(p[key])) add(`Revisa la lista de ${key}.`);
    if (
      typeof p.fecha !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha) ||
      !Number.isFinite(Date.parse(p.fecha + "T12:00:00Z")) ||
      new Date(p.fecha + "T12:00:00Z").toISOString().slice(0, 10) !== p.fecha
    )
      add("Indica una fecha de publicación válida.");
    for (const f of Array.isArray(p.fuentes) ? p.fuentes : [])
      if (
        !f ||
        typeof f !== "object" ||
        typeof (f.nombre ?? "") !== "string" ||
        typeof (f.url ?? "") !== "string"
      )
        add("Revisa la lista de fuentes.", 2);
      else if (f.url && !/^https?:\/\//i.test(f.url))
        add("Los enlaces de las fuentes deben empezar por https://.", 2);
    for (const key of ["hechos", "escenarios"])
      if (Array.isArray(p[key]) && (p[key].length > 100 || p[key].some(x => typeof x !== "string")))
        add(`Revisa la lista de ${key}.`, 2);
    if (
      Array.isArray(p.posturas) &&
      p.posturas.some(
        x =>
          !x ||
          typeof x !== "object" ||
          typeof (x.actor ?? "") !== "string" ||
          typeof (x.postura ?? "") !== "string"
      )
    )
      add("Revisa la lista de posturas.", 2);
    if (p.formato !== undefined && !["edicion", "nota"].includes(p.formato))
      add("Selecciona un formato válido.");
    if (isNote(p)) return validateNote(p, publishing, errors, warnings, add);
    const pages = p.editorial?.paginas;
    if (!Array.isArray(pages) || pages.length < 1 || pages.length > 100) {
      add("La edición necesita entre 1 y 100 páginas.", 2);
      return { errors, warnings };
    }
    if (pages[0]?.tipo !== "portada") add("La primera página debe ser la portada.", 1, 0);
    for (const src of mediaIn(p))
      if (!validImage(src)) add("Hay una imagen con una ruta o formato no permitido.", 2);
    pages.forEach((page, i) => {
      if (!page || !["portada", "interior"].includes(page.tipo) || (i > 0 && page.tipo === "portada")) {
        add(`Revisa el tipo de la página ${i + 1}.`, i ? 2 : 1, i);
        return;
      }
      if (page.diseno && !["texto", "columnas", "referencias", "lamina"].includes(page.diseno))
        add(`Revisa la composición de la página ${i + 1}.`, i ? 2 : 1, i);
      if (page.bloques && (!Array.isArray(page.bloques) || page.bloques.length > 100)) {
        add(`La página ${i + 1} tiene demasiados bloques.`, 2, i);
        return;
      }
      (page.bloques || []).forEach(b => {
        if (!b || !["parrafo", "destacado", "imagen", "cronologia", "fichas", "fuentes"].includes(b.tipo))
          add(`Revisa un bloque de la página ${i + 1}.`, 2, i);
        else if (b.items && (!Array.isArray(b.items) || b.items.length > 100))
          add(`Revisa la lista de la página ${i + 1}.`, 2, i);
      });
    });
    if (errors.length) return { errors, warnings };
    if (!publishing) return { errors, warnings };
    if (!String(p.autor || "").trim()) add("Indica el autor o equipo responsable.");
    if (String(p.resumen || "").trim().length < 20) add("Escribe un resumen de al menos 20 caracteres.");
    if (!String(p.editorial.edicion || "").trim()) add("Indica el número de edición.");
    if (pages.length < 2) add("Agrega al menos una página interior.", 2);
    if (!pages[0]?.imagen) add("Sube la imagen de portada.", 1, 0);
    pages.forEach((page, i) => {
      if (!String(page.titulo || "").trim()) add(`La página ${i + 1} necesita un título.`, i ? 2 : 1, i);
      if (page.imagen && !String(page.alt || "").trim())
        add(`Describe la imagen de la página ${i + 1}.`, i ? 2 : 1, i);
      if (i && page.diseno === "lamina" && !page.imagen) add(`Sube el diseño de la página ${i + 1}.`, 2, i);
      if (
        i &&
        page.diseno !== "lamina" &&
        !String(page.contenido || "").trim() &&
        !(page.bloques || []).some(b => String(b.texto || "").trim() || b.src || b.items?.length)
      )
        add(`Completa el contenido de la página ${i + 1}.`, 2, i);
      (page.bloques || []).forEach(b => {
        if (b.tipo === "imagen" && (!b.src || !String(b.alt || "").trim()))
          add(`Completa la foto y su descripción en la página ${i + 1}.`, 2, i);
        if (["parrafo", "destacado"].includes(b.tipo) && !String(b.texto || "").trim())
          add(`Hay un bloque de texto vacío en la página ${i + 1}.`, 2, i);
        if (["fichas", "cronologia", "fuentes"].includes(b.tipo) && !b.items?.length)
          add(`Completa la lista de la página ${i + 1}.`, 2, i);
        if (["fichas", "cronologia", "fuentes"].includes(b.tipo))
          for (const item of b.items || []) {
            if (b.tipo === "fuentes" && (!item?.nombre || !/^https?:\/\//i.test(item.url || "")))
              add(`Completa el nombre y el enlace de una fuente en la página ${i + 1}.`, 2, i);
            if (b.tipo !== "fuentes" && (!item?.titulo || !item?.texto))
              add(`Completa el título y la explicación de una ficha en la página ${i + 1}.`, 2, i);
          }
      });
    });
    const sources = [
      ...(p.fuentes || []),
      ...pages.flatMap(page =>
        (page.bloques || []).filter(b => b.tipo === "fuentes").flatMap(b => b.items || [])
      )
    ];
    if (!sources.some(f => f.nombre && /^https?:\/\//i.test(f.url || "")))
      add("Incluye al menos una fuente con nombre y enlace en el informe.", 2);
    if (!p.revisadoPor) warnings.push("Aún no has indicado quién revisó el informe.");
    return { errors, warnings };
  }
  function validateNote(p, publishing, errors, warnings, add) {
    if (p.editorial !== undefined) add("Una nota no lleva páginas de edición.");
    if (p.imagen && !validImage(p.imagen)) add("Hay una imagen con una ruta o formato no permitido.", 1);
    if (String(p.desarrollo || "").length > 60000) add("El texto de la nota es demasiado largo.", 2);
    if (errors.length || !publishing) return { errors, warnings };
    if (!String(p.autor || "").trim()) add("Indica el autor o equipo responsable.");
    if (String(p.resumen || "").trim().length < 20) add("Escribe un resumen de al menos 20 caracteres.");
    if (String(p.desarrollo || "").trim().length < 200)
      add("Desarrolla el análisis con al menos 200 caracteres.", 2);
    if (p.imagen && !String(p.imagenAlt || "").trim()) add("Describe la imagen principal.", 1);
    if (!(p.fuentes || []).some(f => f.nombre && /^https?:\/\//i.test(f.url || "")))
      add("Incluye al menos una fuente con nombre y enlace.", 2);
    if (!p.revisadoPor) warnings.push("Aún no has indicado quién revisó la nota.");
    return { errors, warnings };
  }
  return {
    clone,
    slug,
    today,
    createBlock,
    createPage,
    createReport,
    createNote,
    isNote,
    mediaIn,
    validImage,
    validate
  };
});
