/* Roles y permisos del estudio editorial.
   Lo usan el navegador (para mostrar u ocultar acciones) y el servidor (que es quien
   realmente decide). Cambiar un permiso aquí lo cambia en ambos lados. */
((root, factory) => {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CeriPermisos = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ROLES = {
    autor: {
      nombre: "Autor/a",
      descripcion: "Crea informes y notas. Edita los suyos mientras sean borradores o estén en revisión."
    },
    revisor: {
      nombre: "Revisor/a",
      descripcion: "Además, revisa y corrige cualquier informe que aún no esté publicado."
    },
    editor: {
      nombre: "Editor/a",
      descripcion:
        "Además, publica y retira informes, los elimina, gestiona imágenes, el contenido del sitio y los mensajes."
    },
    admin: {
      nombre: "Administrador/a",
      descripcion:
        "Control total: cuentas del equipo, datos institucionales, respaldos y registro de actividad."
    }
  };

  const TODOS = ["autor", "revisor", "editor", "admin"];
  const PERMISOS = {
    "informes.crear": TODOS,
    "informes.editarTodos": ["revisor", "editor", "admin"],
    "informes.publicar": ["editor", "admin"],
    "informes.eliminar": ["editor", "admin"],
    "medios.subir": TODOS,
    "medios.eliminar": ["editor", "admin"],
    "contenido.editar": ["editor", "admin"],
    "mensajes.ver": ["editor", "admin"],
    "respaldos.descargar": ["editor", "admin"],
    "sitio.editar": ["admin"],
    "usuarios.gestionar": ["admin"],
    "respaldos.restaurar": ["admin"],
    "auditoria.ver": ["admin"]
  };

  const esRol = rol => Object.prototype.hasOwnProperty.call(ROLES, rol);
  function puede(usuario, permiso) {
    return !!usuario && usuario.activo !== false && (PERMISOS[permiso] || []).includes(usuario.rol);
  }
  function permisosDe(usuario) {
    return Object.keys(PERMISOS).filter(permiso => puede(usuario, permiso));
  }
  /* ¿Puede abrir y guardar cambios en este informe? (informe = versión guardada; null si es nuevo) */
  function puedeEditarInforme(usuario, informe) {
    if (!informe) return puede(usuario, "informes.crear");
    if (informe.estado === "publicado") return puede(usuario, "informes.publicar");
    if (puede(usuario, "informes.editarTodos")) return true;
    return puede(usuario, "informes.crear") && !!informe.meta && informe.meta.creadoPor === usuario.id;
  }
  /* Publicar, retirar o modificar algo publicado exige el permiso de publicación. */
  function puedeCambiarEstado(usuario, anterior, nuevo) {
    if (nuevo === "publicado" || anterior === "publicado") return puede(usuario, "informes.publicar");
    return puede(usuario, "informes.crear");
  }

  return { ROLES, PERMISOS, esRol, puede, permisosDe, puedeEditarInforme, puedeCambiarEstado };
});
