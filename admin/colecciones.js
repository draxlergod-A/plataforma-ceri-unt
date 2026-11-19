/* Esquemas del contenido institucional (eventos, equipo, convocatoria, etc.).
   El estudio genera sus formularios a partir de estas definiciones y el servidor
   las usa para validar y limpiar los datos antes de guardarlos. */
((root, factory) => {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CeriColecciones = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const COLECCIONES = {
    eventos: {
      titulo: "Eventos",
      singular: "evento",
      descripcion:
        "Conversatorios, foros, talleres y actividades. Los eventos con fecha futura aparecen como próximos.",
      permiso: "contenido.editar",
      tipo: "lista",
      orden: "fecha",
      resumen: item => [item.fecha, item.titulo],
      campos: [
        { clave: "titulo", etiqueta: "Título", tipo: "texto", requerido: true, max: 200 },
        {
          clave: "tipo",
          etiqueta: "Tipo",
          tipo: "opcion",
          opciones: ["Conversatorio", "Conferencia", "Foro", "Taller", "Debate", "Actividad"]
        },
        { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", requerido: true },
        { clave: "hora", etiqueta: "Hora", tipo: "hora" },
        {
          clave: "modalidad",
          etiqueta: "Modalidad",
          tipo: "opcion",
          opciones: ["Presencial", "Virtual", "Híbrido"]
        },
        { clave: "lugar", etiqueta: "Lugar o plataforma", tipo: "texto", max: 200 },
        { clave: "descripcion", etiqueta: "Descripción", tipo: "parrafo", max: 1500 },
        { clave: "enlace", etiqueta: "Enlace (inscripción, transmisión o grabación)", tipo: "url" },
        { clave: "imagen", etiqueta: "Imagen o afiche", tipo: "imagen" }
      ]
    },
    participacion: {
      titulo: "Participación",
      singular: "actividad",
      descripcion: "Reuniones, articulaciones y actividades en las que participó el CERI.",
      permiso: "contenido.editar",
      tipo: "lista",
      orden: "fecha",
      resumen: item => [item.fecha, item.titulo],
      campos: [
        { clave: "titulo", etiqueta: "Título", tipo: "texto", requerido: true, max: 200 },
        { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", requerido: true },
        { clave: "descripcion", etiqueta: "Descripción", tipo: "parrafo", max: 1500 },
        { clave: "imagen", etiqueta: "Imagen", tipo: "imagen" }
      ]
    },
    alianzas: {
      titulo: "Alianzas",
      singular: "alianza",
      descripcion: "Organizaciones con las que el CERI colabora.",
      permiso: "contenido.editar",
      tipo: "lista",
      resumen: item => [item.area, item.nombre],
      campos: [
        { clave: "nombre", etiqueta: "Nombre de la organización", tipo: "texto", requerido: true, max: 200 },
        { clave: "area", etiqueta: "Área", tipo: "texto", max: 120 },
        {
          clave: "instagram",
          etiqueta: "Usuario de Instagram",
          tipo: "usuarioRed",
          ayuda: "Sin @. Ejemplo: cecip.unt"
        },
        { clave: "logo", etiqueta: "Logo", tipo: "imagen" },
        { clave: "confirmada", etiqueta: "Alianza confirmada formalmente", tipo: "booleano" }
      ]
    },
    equipo: {
      titulo: "Equipo",
      singular: "integrante",
      descripcion:
        "Directiva e integrantes que aparecen en Nosotros. Las personas con nombre PENDIENTE no se muestran.",
      permiso: "contenido.editar",
      tipo: "lista",
      resumen: item => [item.cargo, item.nombre],
      campos: [
        { clave: "nombre", etiqueta: "Nombre completo", tipo: "texto", requerido: true, max: 120 },
        { clave: "cargo", etiqueta: "Cargo", tipo: "texto", requerido: true, max: 120 },
        { clave: "carrera", etiqueta: "Carrera", tipo: "texto", max: 120 },
        { clave: "foto", etiqueta: "Foto", tipo: "imagen" }
      ]
    },
    convocatoria: {
      titulo: "Convocatoria",
      descripcion: "Proceso de incorporación de nuevos integrantes.",
      permiso: "contenido.editar",
      tipo: "objeto",
      campos: [
        { clave: "periodo", etiqueta: "Periodo", tipo: "texto", max: 40, ayuda: "Ejemplo: 2027-I" },
        { clave: "abierta", etiqueta: "La convocatoria está abierta", tipo: "booleano" },
        { clave: "inicio", etiqueta: "Fecha de inicio", tipo: "fecha" },
        { clave: "cierre", etiqueta: "Fecha de cierre", tipo: "fecha" },
        { clave: "formulario", etiqueta: "Enlace al formulario de postulación", tipo: "url" },
        { clave: "requisitos", etiqueta: "Requisitos", tipo: "lista", ayuda: "Uno por línea." },
        { clave: "proceso", etiqueta: "Etapas del proceso", tipo: "lista", ayuda: "Una por línea." }
      ]
    },
    sitio: {
      titulo: "Datos institucionales",
      descripcion: "Nombre, correo y redes que aparecen en toda la web.",
      permiso: "sitio.editar",
      tipo: "objeto",
      campos: [
        { clave: "nombre", etiqueta: "Nombre corto", tipo: "texto", requerido: true, max: 40 },
        { clave: "nombreCompleto", etiqueta: "Nombre completo", tipo: "texto", max: 200 },
        { clave: "universidad", etiqueta: "Universidad", tipo: "texto", max: 200 },
        { clave: "facultad", etiqueta: "Facultad", tipo: "texto", max: 200 },
        { clave: "descripcion", etiqueta: "Descripción", tipo: "parrafo", max: 1500 },
        { clave: "lema", etiqueta: "Lema (título del inicio)", tipo: "texto", max: 200 },
        { clave: "fundacion", etiqueta: "Fecha de fundación", tipo: "fecha" },
        { clave: "reconocimiento", etiqueta: "Reconocimiento oficial", tipo: "texto", max: 200 },
        { clave: "logo", etiqueta: "Logo", tipo: "imagen" },
        { clave: "correo", etiqueta: "Correo institucional", tipo: "correo" },
        { clave: "instagram", etiqueta: "Instagram (enlace completo)", tipo: "url" },
        { clave: "facebook", etiqueta: "Facebook (enlace completo)", tipo: "url" },
        {
          clave: "whatsapp",
          etiqueta: "WhatsApp (con código de país)",
          tipo: "telefono",
          ayuda: "Ejemplo: 51987654321"
        }
      ]
    }
  };

  const imagenValida = ruta =>
    typeof ruta === "string" &&
    ((/^\/?assets\/img\/[a-zA-Z0-9_./() -]+\.(png|jpe?g|webp|gif|svg)$/i.test(ruta) &&
      !ruta.includes("..")) ||
      /^https:\/\/[^\s"'<>]+$/i.test(ruta));
  const fechaValida = valor =>
    /^\d{4}-\d{2}-\d{2}$/.test(valor) && new Date(valor + "T12:00:00Z").toISOString().slice(0, 10) === valor;

  function vacio(campo) {
    if (campo.tipo === "booleano") return false;
    if (campo.tipo === "lista") return [];
    return "";
  }

  /* Devuelve el valor limpio o lanza un mensaje de error para el campo. */
  function limpiarCampo(campo, valor) {
    if (valor === undefined || valor === null) valor = vacio(campo);
    if (campo.tipo === "booleano") {
      if (typeof valor !== "boolean") throw "debe ser sí o no";
      return valor;
    }
    if (campo.tipo === "lista") {
      if (
        !Array.isArray(valor) ||
        valor.length > 50 ||
        valor.some(x => typeof x !== "string" || x.length > 500)
      )
        throw "debe ser una lista de textos breves";
      return valor.map(x => x.trim()).filter(Boolean);
    }
    if (typeof valor !== "string") throw "debe ser texto";
    valor = valor.trim();
    const max = campo.max || (campo.tipo === "parrafo" ? 3000 : 500);
    if (valor.length > max) throw `admite como máximo ${max} caracteres`;
    if (!valor) {
      if (campo.requerido) throw "es obligatorio";
      return "";
    }
    switch (campo.tipo) {
      case "fecha":
        if (!fechaValida(valor)) throw "debe ser una fecha válida";
        break;
      case "hora":
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) throw "debe tener el formato HH:MM";
        break;
      case "opcion":
        if (!campo.opciones.includes(valor)) throw "tiene una opción no permitida";
        break;
      case "url":
        if (!/^https?:\/\/[^\s"'<>]+$/i.test(valor)) throw "debe ser un enlace que empiece por https://";
        break;
      case "correo":
        if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(valor)) throw "debe ser un correo válido";
        break;
      case "telefono":
        if (!/^\+?\d{8,15}$/.test(valor.replace(/[\s-]/g, ""))) throw "debe ser un número con código de país";
        return valor.replace(/[\s-]/g, "");
      case "usuarioRed":
        valor = valor.replace(/^@/, "");
        if (!/^[a-zA-Z0-9._]{1,60}$/.test(valor)) throw "debe ser un usuario sin espacios";
        break;
      case "imagen":
        if (!imagenValida(valor)) throw "debe ser una imagen de la biblioteca";
        break;
    }
    return valor;
  }

  function limpiarObjeto(def, objeto, errores, prefijo) {
    if (!objeto || typeof objeto !== "object" || Array.isArray(objeto)) {
      errores.push(`${prefijo}: los datos no son válidos.`);
      return {};
    }
    const limpio = {};
    for (const campo of def.campos) {
      try {
        limpio[campo.clave] = limpiarCampo(campo, objeto[campo.clave]);
      } catch (mensaje) {
        errores.push(`${prefijo}: «${campo.etiqueta}» ${mensaje}.`);
      }
    }
    return limpio;
  }

  /* Valida una colección completa. Devuelve { errores, datos } con solo los campos conocidos. */
  function validar(nombre, datos) {
    const def = COLECCIONES[nombre];
    const errores = [];
    if (!def) return { errores: ["Esta sección no existe."], datos: null };
    if (def.tipo === "objeto") return { errores, datos: limpiarObjeto(def, datos, errores, def.titulo) };
    const items = datos && Array.isArray(datos.items) ? datos.items : null;
    if (!items) return { errores: ["La lista no es válida."], datos: null };
    if (items.length > 300) return { errores: ["La lista admite como máximo 300 elementos."], datos: null };
    const limpios = items.map((item, i) => limpiarObjeto(def, item, errores, `${def.singular} ${i + 1}`));
    return { errores, datos: { items: limpios } };
  }

  function nuevoElemento(nombre) {
    const def = COLECCIONES[nombre];
    return Object.fromEntries(def.campos.map(c => [c.clave, c.opciones ? c.opciones[0] : vacio(c)]));
  }

  /* Rutas de imágenes usadas por una colección (para saber si una imagen está en uso). */
  function imagenesEn(nombre, datos) {
    const def = COLECCIONES[nombre];
    if (!def || !datos) return [];
    const claves = def.campos.filter(c => c.tipo === "imagen").map(c => c.clave);
    const objetos = def.tipo === "lista" ? datos.items || [] : [datos];
    return objetos.flatMap(o => claves.map(k => o && o[k]).filter(Boolean));
  }

  return { COLECCIONES, validar, nuevoElemento, imagenesEn, imagenValida };
});
