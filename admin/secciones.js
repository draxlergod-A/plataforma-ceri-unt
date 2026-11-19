/* Secciones del estudio fuera del editor de informes: tablero de pendientes, contenido del sitio,
   mensajes, cuentas y roles, respaldos, actividad y la cuenta personal.
   La interfaz solo oculta lo que el rol no permite: el servidor vuelve a comprobarlo todo. */
(() => {
  "use strict";
  const S = window.CeriStudio;
  const P = window.CeriPermisos;
  const C = window.CeriColecciones;
  const { $, E, api, toast, confirmAction, can } = S;

  const TITULOS = {
    contenido: "Contenido del sitio",
    mensajes: "Mensajes de contacto",
    equipo: "Cuentas y roles",
    seguridad: "Respaldos y actividad",
    cuenta: "Mi cuenta"
  };
  const PERMISOS_LEGIBLES = {
    "informes.crear": "Crear informes y notas, y editar los tuyos mientras no estén publicados.",
    "informes.editarTodos": "Revisar, corregir y firmar cualquier publicación no publicada.",
    "informes.publicar": "Publicar, actualizar y retirar publicaciones de la web.",
    "informes.eliminar": "Eliminar publicaciones.",
    "medios.subir": "Subir imágenes.",
    "medios.eliminar": "Eliminar imágenes que no se usan.",
    "contenido.editar": "Editar eventos, participación, alianzas, equipo y convocatoria.",
    "mensajes.ver": "Leer los mensajes del formulario de contacto.",
    "respaldos.descargar": "Descargar una copia de las publicaciones.",
    "sitio.editar": "Editar los datos institucionales (correo, redes, lema).",
    "usuarios.gestionar": "Crear cuentas, cambiar roles y restablecer contraseñas.",
    "respaldos.restaurar": "Restaurar respaldos.",
    "auditoria.ver": "Ver el registro de actividad."
  };
  const ACCIONES = {
    "informe.creado": "creó",
    "informe.guardado": "guardó",
    "informe.enviadoRevision": "envió a revisión",
    "informe.publicado": "publicó",
    "informe.retirado": "retiró de la web",
    "informe.eliminado": "eliminó",
    "imagen.subida": "subió la imagen",
    "imagen.eliminada": "eliminó la imagen",
    "contenido.guardado": "actualizó",
    "mensaje.eliminado": "eliminó un mensaje",
    "usuario.creado": "creó la cuenta",
    "usuario.actualizado": "modificó la cuenta",
    "usuario.passwordRestablecida": "restableció la contraseña de",
    "usuario.eliminado": "eliminó la cuenta",
    "cuenta.password": "cambió su contraseña",
    "cuenta.configurada": "configuró el estudio",
    "cuenta.migrada": "convirtió el acceso anterior",
    "sesion.iniciada": "inició sesión",
    "sesion.cerrada": "cerró sesión",
    "acceso.fallido": "Intento de acceso fallido:",
    "respaldo.restaurado": "restauró el respaldo"
  };
  const fechaHora = iso =>
    iso ? new Date(iso).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const vacio = texto => `<div class="studio-empty"><p>${E(texto)}</p></div>`;

  /* ---------- Tablero: pendientes y mensajes sin leer ---------- */
  async function cargarResumen() {
    try {
      const r = await api("resumen");
      const lista = r.pendientes || [];
      $("pending-panel").hidden = !lista.length;
      $("pending-list").innerHTML = lista
        .map(p => {
          const accion = p.seccion
            ? `data-go-content="${E(p.seccion)}"`
            : p.informe
              ? `data-go-report="${E(p.informe)}"`
              : p.estado
                ? `data-go-status="${E(p.estado)}"`
                : "";
          return `<li><button type="button" class="pending-item" ${accion}><span aria-hidden="true">→</span>${E(p.texto)}</button></li>`;
        })
        .join("");
      const badge = $("unread-badge");
      badge.hidden = !r.mensajesNoLeidos;
      badge.textContent = r.mensajesNoLeidos;
    } catch (error) {
      toast(error.message);
    }
  }

  /* ---------- Contenido del sitio ---------- */
  const edicion = { nombre: null, datos: null, revision: "", sucio: false };
  const permitidas = () => Object.entries(C.COLECCIONES).filter(([, def]) => can(def.permiso));

  async function mostrarContenido() {
    $("content-editor").hidden = true;
    $("content-home").hidden = false;
    const tarjetas = await Promise.all(
      permitidas().map(async ([nombre, def]) => {
        let detalle = "";
        try {
          const { datos } = await api("contenido/" + nombre);
          detalle =
            def.tipo === "lista"
              ? `${datos.items.length} ${datos.items.length === 1 ? def.singular : def.singular + "s"}`
              : "Datos generales";
        } catch {
          detalle = "No disponible";
        }
        return `<article class="collection-card"><p class="eyebrow">${E(detalle)}</p><h2>${E(def.titulo)}</h2><p>${E(def.descripcion)}</p><button type="button" class="studio-button" data-open-collection="${E(nombre)}">Editar →</button></article>`;
      })
    );
    $("content-home").innerHTML =
      tarjetas.join("") || vacio("Tu rol no permite editar el contenido del sitio.");
  }

  async function abrirColeccion(nombre) {
    if (!(await salirDeColeccion())) return;
    const { datos, revision } = await api("contenido/" + nombre);
    Object.assign(edicion, { nombre, datos, revision, sucio: false, abierto: 0 });
    $("content-home").hidden = true;
    $("content-editor").hidden = false;
    pintarColeccion();
    window.scrollTo({ top: 0 });
  }

  function control(campo, ruta, valor) {
    const attrs = `data-c-path="${E(ruta)}" data-c-type="${campo.tipo}"`;
    const ayuda = campo.ayuda ? `<small>${E(campo.ayuda)}</small>` : "";
    const etiqueta = E(campo.etiqueta) + (campo.requerido ? " *" : "");
    if (campo.tipo === "booleano")
      return `<label class="studio-field studio-field--wide studio-field--check"><input type="checkbox" ${attrs}${valor ? " checked" : ""}> ${etiqueta}</label>`;
    if (campo.tipo === "imagen")
      return `<div class="studio-field studio-field--wide">${etiqueta}<button type="button" class="image-well image-well--small" data-c-pick="${E(ruta)}">${valor ? `<img src="${E(rutaImagen(valor))}" alt="">` : ""}<strong>${valor ? "Cambiar imagen" : "+ Elegir o subir imagen"}</strong></button>${valor ? `<button type="button" class="studio-link" data-c-clear="${E(ruta)}">Quitar imagen</button>` : ""}</div>`;
    let input;
    if (campo.tipo === "parrafo" || campo.tipo === "lista")
      input = `<textarea ${attrs} rows="${campo.tipo === "lista" ? 5 : 4}">${E(campo.tipo === "lista" ? (valor || []).join("\n") : valor)}</textarea>`;
    else if (campo.tipo === "opcion")
      input = `<select ${attrs}>${campo.opciones.map(o => `<option${o === valor ? " selected" : ""}>${E(o)}</option>`).join("")}</select>`;
    else {
      const tipo =
        { fecha: "date", hora: "time", url: "url", correo: "email", telefono: "tel" }[campo.tipo] || "text";
      input = `<input type="${tipo}" ${attrs} value="${E(valor)}"${campo.max ? ` maxlength="${campo.max}"` : ""}>`;
    }
    const ancho = ["parrafo", "lista", "url"].includes(campo.tipo) ? " studio-field--wide" : "";
    return `<label class="studio-field${ancho}">${etiqueta}${input}${ayuda}</label>`;
  }

  function pintarColeccion() {
    const def = C.COLECCIONES[edicion.nombre];
    const cabecera = `<header class="editor-heading"><div><button type="button" class="studio-link" data-content-back>← Contenido del sitio</button><h1>${E(def.titulo)}</h1><span class="studio-caption" role="status" id="content-status">${edicion.sucio ? "Cambios sin guardar" : "Sin cambios"}</span></div><div class="editor-actions">${def.tipo === "lista" ? `<button type="button" class="studio-button" data-c-add>+ Añadir ${E(def.singular)}</button>` : ""}<button type="button" class="studio-button studio-button--primary" data-c-save>Guardar y publicar</button></div></header><div id="content-error" class="studio-error" role="alert" hidden></div>`;
    let cuerpo;
    if (def.tipo === "objeto") {
      cuerpo = `<section class="editor-panel-card"><p>${E(def.descripcion)}</p><div class="studio-fields">${def.campos.map(c => control(c, c.clave, edicion.datos[c.clave])).join("")}</div></section>`;
    } else {
      const items = edicion.datos.items;
      cuerpo = items.length
        ? `<div class="collection-items">${items
            .map((item, i) => {
              const [antes, titulo] = def.resumen(item);
              return `<details class="collection-item"${edicion.abierto === i ? " open" : ""} data-c-index="${i}"><summary><span class="studio-caption">${E(antes || "")}</span><strong>${E(titulo || `Nuevo ${def.singular}`)}</strong></summary><div class="studio-fields">${def.campos.map(c => control(c, `items.${i}.${c.clave}`, item[c.clave])).join("")}</div><div class="collection-item__actions"><button type="button" class="icon-button" data-c-move="${i}" data-direction="-1" aria-label="Subir"${i === 0 ? " disabled" : ""}>↑</button><button type="button" class="icon-button" data-c-move="${i}" data-direction="1" aria-label="Bajar"${i === items.length - 1 ? " disabled" : ""}>↓</button><button type="button" class="studio-link studio-link--danger" data-c-remove="${i}">Quitar ${E(def.singular)}</button></div></details>`;
            })
            .join("")}</div>`
        : vacio(`Todavía no hay ${def.titulo.toLowerCase()}. Añade el primero.`);
    }
    $("content-editor").innerHTML = cabecera + cuerpo;
  }

  function asignar(ruta, valor) {
    const claves = ruta.split(".");
    if (claves.some(k => ["__proto__", "constructor", "prototype"].includes(k))) return;
    let destino = edicion.datos;
    claves.slice(0, -1).forEach(k => (destino = destino[k]));
    destino[claves.at(-1)] = valor;
  }
  function marcarSucio() {
    edicion.sucio = true;
    if ($("content-status")) $("content-status").textContent = "Cambios sin guardar";
  }
  async function salirDeColeccion() {
    if (!edicion.sucio) return true;
    const ok = await confirmAction(
      "¿Descartar los cambios?",
      "Hay cambios sin guardar en esta sección.",
      "Descartar cambios"
    );
    if (ok) edicion.sucio = false;
    return ok;
  }
  $("content-editor").addEventListener("input", e => {
    const input = e.target.closest("[data-c-path]");
    if (!input) return;
    const tipo = input.dataset.cType;
    const valor =
      tipo === "booleano"
        ? input.checked
        : tipo === "lista"
          ? input.value
              .split("\n")
              .map(x => x.trim())
              .filter(Boolean)
          : input.value;
    asignar(input.dataset.cPath, valor);
    marcarSucio();
  });
  $("content-editor").addEventListener(
    "toggle",
    e => {
      const item = e.target.closest?.("[data-c-index]");
      if (item && item.open) edicion.abierto = Number(item.dataset.cIndex);
    },
    true
  );

  async function guardarColeccion() {
    const boton = document.querySelector("[data-c-save]");
    boton.disabled = true;
    $("content-error").hidden = true;
    try {
      const r = await api("contenido/" + edicion.nombre, {
        method: "POST",
        body: { datos: edicion.datos, revision: edicion.revision }
      });
      Object.assign(edicion, { datos: r.datos, revision: r.revision, sucio: false });
      pintarColeccion();
      toast("Guardado. Los cambios ya se ven en la web.");
      cargarResumen();
    } catch (error) {
      $("content-error").hidden = false;
      $("content-error").textContent =
        error.message +
        (error.details?.length ? "\n" + error.details.map(d => "• " + d.message).join("\n") : "");
      toast(error.message);
    } finally {
      boton.disabled = false;
    }
  }

  /* ---------- Mensajes ---------- */
  async function mostrarMensajes() {
    const { mensajes } = await api("mensajes");
    $("messages-list").innerHTML = mensajes.length
      ? mensajes
          .map(
            m =>
              `<article class="message-card${m.leido ? "" : " message-card--unread"}"><header><div><strong>${E(m.nombre)}</strong> · <a href="mailto:${E(m.correo)}?subject=${encodeURIComponent("Re: " + m.motivo + " · CERI")}">${E(m.correo)}</a></div><span class="studio-caption">${fechaHora(m.fecha)}</span></header><p class="eyebrow">${E(m.motivo)}</p><p class="message-card__body">${E(m.mensaje)}</p><div class="message-card__actions"><a class="studio-button" href="mailto:${E(m.correo)}?subject=${encodeURIComponent("Re: " + m.motivo + " · CERI")}">Responder por correo</a><button type="button" class="studio-button studio-button--quiet" data-msg-read="${E(m.id)}" data-value="${m.leido ? "false" : "true"}">${m.leido ? "Marcar como no leído" : "Marcar como leído"}</button><button type="button" class="studio-button studio-button--quiet studio-button--danger" data-msg-delete="${E(m.id)}">Eliminar</button></div></article>`
          )
          .join("")
      : vacio("Todavía no hay mensajes. Cuando alguien escriba desde la página de contacto, aparecerá aquí.");
  }

  /* ---------- Cuentas y roles ---------- */
  async function mostrarEquipo() {
    const { usuarios, roles } = await api("usuarios");
    $("roles-help").innerHTML = Object.entries(roles)
      .map(
        ([clave, rol]) =>
          `<article><p class="eyebrow">${E(clave)}</p><h3>${E(rol.nombre)}</h3><p>${E(rol.descripcion)}</p></article>`
      )
      .join("");
    $("user-role-select").innerHTML = Object.entries(roles)
      .map(([clave, rol]) => `<option value="${E(clave)}">${E(rol.nombre)}</option>`)
      .join("");
    const opciones = actual =>
      Object.entries(roles)
        .map(
          ([clave, rol]) =>
            `<option value="${E(clave)}"${clave === actual ? " selected" : ""}>${E(rol.nombre)}</option>`
        )
        .join("");
    $("users-list").innerHTML =
      `<table class="users-table"><thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${usuarios
        .map(u => {
          const yo = u.id === S.state.user.id;
          return `<tr><td><strong>${E(u.nombre)}</strong><br><span class="studio-caption">${E(u.usuario)}${yo ? " · tú" : ""}${u.debeCambiar ? " · contraseña temporal" : ""}</span></td><td><select data-user-role="${E(u.id)}" aria-label="Rol de ${E(u.nombre)}">${opciones(u.rol)}</select></td><td><label class="studio-field--check"><input type="checkbox" data-user-active="${E(u.id)}"${u.activo ? " checked" : ""}${yo ? " disabled" : ""}> Activa</label></td><td class="studio-caption">${fechaHora(u.ultimoAcceso)}</td><td class="users-table__actions"><button type="button" class="studio-button studio-button--quiet" data-user-reset="${E(u.id)}" data-name="${E(u.nombre)}">Restablecer contraseña</button>${yo ? "" : `<button type="button" class="studio-button studio-button--quiet studio-button--danger" data-user-delete="${E(u.id)}" data-name="${E(u.nombre)}">Eliminar</button>`}</td></tr>`;
        })
        .join("")}</tbody></table>`;
  }
  function mostrarClaveTemporal(nombre, clave) {
    $("user-created").innerHTML =
      `<div class="temp-password"><p><strong>Contraseña temporal de ${E(nombre)}</strong></p><code>${E(clave)}</code><button type="button" class="studio-button" data-copy="${E(clave)}">Copiar</button><p class="studio-caption">Se muestra una sola vez. Entrégala en persona o por un canal privado; al entrar, deberá crear su propia contraseña.</p></div>`;
  }
  $("user-form").addEventListener("submit", async e => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    datos.usuario = datos.usuario.trim().toLowerCase();
    try {
      const r = await api("usuarios", { method: "POST", body: datos });
      e.target.reset();
      mostrarClaveTemporal(r.usuario.nombre, r.passwordTemporal);
      await mostrarEquipo();
    } catch (error) {
      toast(error.message);
    }
  });
  async function actualizarUsuario(id, cambios) {
    try {
      await api("usuarios/actualizar", { method: "POST", body: { id, ...cambios } });
      toast("Cuenta actualizada. Si estaba conectada, deberá volver a entrar.");
    } catch (error) {
      toast(error.message);
    }
    await mostrarEquipo();
  }
  document.addEventListener("change", e => {
    const rol = e.target.closest("[data-user-role]");
    if (rol) actualizarUsuario(rol.dataset.userRole, { rol: rol.value });
    const activo = e.target.closest("[data-user-active]");
    if (activo) actualizarUsuario(activo.dataset.userActive, { activo: activo.checked });
    if (e.target.id === "backup-filter") mostrarSeguridad();
  });

  /* ---------- Respaldos y actividad ---------- */
  async function mostrarSeguridad() {
    if (can("respaldos.restaurar")) {
      const { respaldos } = await api("respaldos");
      const filtro = $("backup-filter").value;
      const visibles = respaldos.filter(r => !filtro || r.coleccion === filtro).slice(0, 60);
      const nombre = c =>
        c === "sitio" ? "Datos institucionales" : C.COLECCIONES[c]?.titulo || "Publicaciones";
      $("backups-list").innerHTML = visibles.length
        ? `<ul>${visibles
            .map(
              r =>
                `<li><div><strong>${E(nombre(r.coleccion))}</strong><span class="studio-caption">${fechaHora(r.fecha)} · ${Math.max(1, Math.round(r.tamano / 1024))} KB</span></div><div><a class="studio-button studio-button--quiet" href="api/admin/respaldos/descargar?nombre=${encodeURIComponent(r.nombre)}">Descargar</a><button type="button" class="studio-button studio-button--quiet" data-restore="${E(r.nombre)}" data-label="${E(nombre(r.coleccion))} · ${E(fechaHora(r.fecha))}">Restaurar</button></div></li>`
            )
            .join("")}</ul>`
        : vacio("Todavía no hay respaldos. Se crean automáticamente al guardar.");
    }
    if (can("auditoria.ver")) {
      const { registros } = await api("auditoria?limite=200");
      $("audit-list").innerHTML = registros.length
        ? `<ol>${registros
            .map(r => {
              const fallo = r.accion === "acceso.fallido";
              return `<li${fallo ? ' class="audit--warning"' : ""}><span class="studio-caption">${fechaHora(r.fecha)}</span><p>${fallo ? "" : `<strong>${E(r.nombre)}</strong> `}${E(ACCIONES[r.accion] || r.accion)} ${r.detalle ? `<em>${E(r.detalle)}</em>` : ""}</p></li>`;
            })
            .join("")}</ol>`
        : vacio("Sin actividad registrada.");
    }
  }

  /* ---------- Mi cuenta ---------- */
  function mostrarCuenta() {
    const u = S.state.user;
    $("account-summary").textContent =
      `${u.nombre} · usuario «${u.usuario}» · ${P.ROLES[u.rol]?.nombre}. ${P.ROLES[u.rol]?.descripcion}`;
    $("my-permissions").innerHTML = S.state.permisos
      .map(p => `<li>${E(PERMISOS_LEGIBLES[p] || p)}</li>`)
      .join("");
  }
  $("password-form").addEventListener("submit", async e => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    if (datos.nueva !== datos.repetir) {
      $("password-status").textContent = "Las contraseñas nuevas no coinciden.";
      return;
    }
    try {
      await api("cuenta/password", { method: "POST", body: { actual: datos.actual, nueva: datos.nueva } });
      e.target.reset();
      $("password-status").textContent = "Contraseña actualizada. Tus otras sesiones se cerraron.";
    } catch (error) {
      $("password-status").textContent = error.message;
    }
  });

  /* ---------- Clics ---------- */
  document.addEventListener("click", async e => {
    const t = e.target;
    const ir = t.closest("[data-go-content]");
    if (ir) {
      await S.showView("contenido");
      await abrirColeccion(ir.dataset.goContent);
      return;
    }
    const informe = t.closest("[data-go-report]");
    if (informe) return S.openReportById(informe.dataset.goReport);
    const estado = t.closest("[data-go-status]");
    if (estado) return S.filterStatus(estado.dataset.goStatus);
    const abrir = t.closest("[data-open-collection]");
    if (abrir) return abrirColeccion(abrir.dataset.openCollection).catch(error => toast(error.message));
    if (t.closest("[data-content-back]")) {
      if (await salirDeColeccion()) await mostrarContenido();
      return;
    }
    if (t.closest("[data-c-save]")) return guardarColeccion();
    if (t.closest("[data-c-add]")) {
      edicion.datos.items.unshift(C.nuevoElemento(edicion.nombre));
      edicion.abierto = 0;
      marcarSucio();
      return pintarColeccion();
    }
    const mover = t.closest("[data-c-move]");
    if (mover) {
      const i = Number(mover.dataset.cMove),
        j = i + Number(mover.dataset.direction);
      const items = edicion.datos.items;
      [items[i], items[j]] = [items[j], items[i]];
      edicion.abierto = j;
      marcarSucio();
      return pintarColeccion();
    }
    const quitar = t.closest("[data-c-remove]");
    if (quitar) {
      if (await confirmAction("¿Quitar este elemento?", "Se quitará al guardar la sección.", "Quitar")) {
        edicion.datos.items.splice(Number(quitar.dataset.cRemove), 1);
        marcarSucio();
        pintarColeccion();
      }
      return;
    }
    const elegir = t.closest("[data-c-pick]");
    if (elegir)
      return S.openMedia({
        callback: ruta => {
          asignar(elegir.dataset.cPick, ruta);
          marcarSucio();
          pintarColeccion();
        }
      });
    const limpiar = t.closest("[data-c-clear]");
    if (limpiar) {
      asignar(limpiar.dataset.cClear, "");
      marcarSucio();
      return pintarColeccion();
    }
    const leido = t.closest("[data-msg-read]");
    if (leido) {
      await api("mensajes/estado", {
        method: "POST",
        body: { id: leido.dataset.msgRead, leido: leido.dataset.value === "true" }
      }).catch(error => toast(error.message));
      await mostrarMensajes();
      return cargarResumen();
    }
    const borrarMensaje = t.closest("[data-msg-delete]");
    if (borrarMensaje) {
      if (await confirmAction("¿Eliminar este mensaje?", "No se puede deshacer.", "Eliminar mensaje")) {
        await api("mensajes/eliminar", {
          method: "POST",
          body: { id: borrarMensaje.dataset.msgDelete }
        }).catch(error => toast(error.message));
        await mostrarMensajes();
        cargarResumen();
      }
      return;
    }
    const reset = t.closest("[data-user-reset]");
    if (reset) {
      if (
        await confirmAction(
          `¿Restablecer la contraseña de ${reset.dataset.name}?`,
          "Se generará una contraseña temporal y se cerrarán sus sesiones abiertas.",
          "Restablecer"
        )
      ) {
        try {
          const r = await api("usuarios/restablecer", {
            method: "POST",
            body: { id: reset.dataset.userReset }
          });
          mostrarClaveTemporal(reset.dataset.name, r.passwordTemporal);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
          toast(error.message);
        }
        await mostrarEquipo();
      }
      return;
    }
    const borrarUsuario = t.closest("[data-user-delete]");
    if (borrarUsuario) {
      if (
        await confirmAction(
          `¿Eliminar la cuenta de ${borrarUsuario.dataset.name}?`,
          "Perderá el acceso. Sus publicaciones se conservan. Si solo es temporal, desactívala en su lugar.",
          "Eliminar cuenta"
        )
      ) {
        await api("usuarios/eliminar", {
          method: "POST",
          body: { id: borrarUsuario.dataset.userDelete }
        }).catch(error => toast(error.message));
        await mostrarEquipo();
      }
      return;
    }
    const copiar = t.closest("[data-copy]");
    if (copiar) {
      try {
        await navigator.clipboard.writeText(copiar.dataset.copy);
        toast("Copiado.");
      } catch {
        toast("Selecciona el texto y cópialo manualmente.");
      }
      return;
    }
    const restaurar = t.closest("[data-restore]");
    if (restaurar) {
      if (
        await confirmAction(
          "¿Restaurar este respaldo?",
          `Se reemplazará el contenido actual por: ${restaurar.dataset.label}. El estado actual se respalda antes, así que puedes deshacerlo.`,
          "Restaurar"
        )
      ) {
        try {
          await api("respaldos/restaurar", { method: "POST", body: { nombre: restaurar.dataset.restore } });
          toast("Respaldo restaurado.");
          await S.reload();
        } catch (error) {
          toast(error.message);
        }
        await mostrarSeguridad();
      }
    }
  });
  window.addEventListener("beforeunload", e => {
    if (edicion.sucio) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  const vistas = {
    contenido: mostrarContenido,
    mensajes: mostrarMensajes,
    equipo: mostrarEquipo,
    seguridad: mostrarSeguridad,
    cuenta: mostrarCuenta
  };
  window.CeriSecciones = {
    titulo: vista => TITULOS[vista],
    async mostrar(vista) {
      if (vista === "library") return cargarResumen();
      if (!vistas[vista]) return;
      try {
        await vistas[vista]();
      } catch (error) {
        toast(error.message);
      }
    },
    alActivar: cargarResumen
  };
})();
