/* API del estudio editorial: cuentas con roles, informes, imágenes, contenido del sitio,
   mensajes, respaldos y registro de actividad. El servidor es quien aplica los permisos. */
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const model = require("../admin/model.js");
const Permisos = require("../admin/permisos.js");
const Colecciones = require("../admin/colecciones.js");
const { crearUsuarios, crearLimitador, passwordTemporal, ErrorUsuario } = require("./usuarios.js");

const COOKIE = "ceri_sesion";
const RUTAS_LIBRES_SI_DEBE_CAMBIAR = new Set(["session", "logout", "cuenta/password"]);

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end(JSON.stringify(data));
}

async function leerCuerpo(req, limite = 3 * 1024 * 1024, json = true) {
  if (Number(req.headers["content-length"] || 0) > limite)
    throw new ApiError(413, "El archivo es demasiado grande.");
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > limite) throw new ApiError(413, "El archivo es demasiado grande.");
    partes.push(parte);
  }
  const datos = Buffer.concat(partes);
  if (!json) return datos;
  try {
    const valor = JSON.parse(datos.toString("utf8") || "{}");
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw Error();
    return valor;
  } catch {
    throw new ApiError(400, "La solicitud no contiene datos válidos.");
  }
}

function tipoImagen(bytes) {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "png";
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (
    bytes.length > 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (bytes.length > 6 && /^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) return "gif";
  return "";
}

/* Utilidades de red compartidas con el servidor y el formulario de contacto. */
function crearRed(cfg) {
  const esHttps = req =>
    !!req.socket.encrypted ||
    (cfg.trustProxy && String(req.headers["x-forwarded-proto"] || "").split(",")[0] === "https");
  const ip = req =>
    (cfg.trustProxy &&
      String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim()) ||
    req.socket.remoteAddress ||
    "local";
  function origenPermitido(req) {
    const origin = req.headers.origin;
    if (!origin) return false;
    const host = req.headers.host;
    const permitidos = [`http://${host}`, `https://${host}`, cfg.publicUrl, cfg.adminOrigin].filter(Boolean);
    return permitidos.includes(origin);
  }
  /* La primera cuenta solo se crea desde la propia computadora (no a través de túneles ni proxys). */
  function configuracionLocal(req) {
    try {
      const locales = ["localhost", "127.0.0.1", "[::1]"];
      const host = new URL(`http://${req.headers.host}`).hostname;
      const referente = req.headers.origin || req.headers.referer || `http://${req.headers.host}`;
      const remota = req.socket.remoteAddress || "";
      return (
        locales.includes(host) &&
        locales.includes(new URL(referente).hostname) &&
        ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remota) &&
        !req.headers["x-forwarded-for"] &&
        !req.headers.forwarded &&
        !req.headers["x-forwarded-host"]
      );
    } catch {
      return false;
    }
  }
  return { esHttps, ip, origenPermitido, configuracionLocal };
}

function crearAdminApi(cfg, almacen) {
  const red = crearRed(cfg);
  const usuarios = crearUsuarios(almacen, { sessionHours: cfg.sessionHours });
  const mensajes = almacen.archivoPrivado("mensajes.json", { mensajes: [] });
  const porIp = crearLimitador({ maximo: 20, ventanaMs: 15 * 60 * 1000 });
  const porCuenta = crearLimitador({ maximo: 5, ventanaMs: 15 * 60 * 1000 });
  const anotar = (u, accion, detalle) => almacen.registro.anotar(u, accion, detalle).catch(() => {});

  function token(req) {
    const par = String(req.headers.cookie || "")
      .split(";")
      .map(x => x.trim())
      .find(x => x.startsWith(COOKIE + "="));
    return par ? par.slice(COOKIE.length + 1) : "";
  }
  function cookie(req, valor, maxAge) {
    const secure = red.esHttps(req) ? "; Secure" : "";
    return `${COOKIE}=${valor}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
  }
  async function entrar(req, res, usuario) {
    const s = await usuarios.iniciarSesion(usuario.id);
    res.setHeader("Set-Cookie", cookie(req, s.token, s.maxAge));
    await usuarios.registrarAcceso(usuario.id);
    return s.csrf;
  }
  function exigir(usuario, permiso) {
    if (!Permisos.puede(usuario, permiso)) throw new ApiError(403, "Tu rol no permite realizar esta acción.");
  }
  const estadoSesion = (usuario, csrf) => ({
    authenticated: true,
    csrfToken: csrf,
    usuario: usuarios.publico(usuario),
    permisos: Permisos.permisosDe(usuario)
  });

  /* ---------- Imágenes ---------- */
  const rutaLocal = src => {
    const limpia = String(src).replace(/^\//, "");
    const base = limpia.startsWith("assets/img/subidas/") ? almacen.rutas.dataDir : almacen.rutas.root;
    return path.join(base, limpia);
  };
  async function imagenesEnUso() {
    const usadas = new Map();
    const marcar = (src, donde) => {
      const clave = String(src).replace(/^\//, "");
      if (!usadas.has(clave)) usadas.set(clave, new Set());
      usadas.get(clave).add(donde);
    };
    for (const p of (await almacen.publicaciones.leer()).items)
      for (const src of model.mediaIn(p)) marcar(src, p.titulo || p.id);
    for (const nombre of almacen.colecciones.nombres) {
      const { datos } = await almacen.colecciones.leer(nombre);
      for (const src of Colecciones.imagenesEn(nombre, datos))
        marcar(src, Colecciones.COLECCIONES[nombre].titulo);
    }
    return usadas;
  }
  async function listarImagenes() {
    const lista = [];
    const usadas = await imagenesEnUso();
    async function recorrer(carpeta, base, excluir) {
      for (const entrada of await fs.readdir(carpeta, { withFileTypes: true }).catch(() => [])) {
        const file = path.join(carpeta, entrada.name);
        if (excluir && file === excluir) continue;
        if (entrada.isDirectory()) await recorrer(file, base, excluir);
        else if (entrada.isFile() && /\.(jpe?g|png|webp|gif|svg)$/i.test(entrada.name)) {
          const stat = await fs.stat(file);
          const ruta = path.relative(base, file).split(path.sep).join("/");
          const uso = [...(usadas.get(ruta) || [])];
          lista.push({
            path: ruta,
            name: entrada.name,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            enUso: uso,
            eliminable: ruta.startsWith("assets/img/subidas/") && !uso.length
          });
        }
      }
    }
    await recorrer(
      path.join(almacen.rutas.root, "assets", "img"),
      almacen.rutas.root,
      path.join(almacen.rutas.root, "assets", "img", "subidas")
    );
    await recorrer(almacen.rutas.subidas, almacen.rutas.dataDir);
    return lista.sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, 1000);
  }
  async function comprobarImagenes(rutas) {
    for (const src of rutas) {
      if (/^https:/i.test(src)) continue;
      if (!(await almacen.existe(rutaLocal(src))))
        throw new ApiError(422, `La imagen «${src}» ya no está disponible.`);
    }
  }

  /* ---------- Resumen para el tablero ---------- */
  async function resumen(usuario) {
    const { items } = await almacen.publicaciones.leer();
    const contar = estado => items.filter(p => p.estado === estado).length;
    const pendientes = [];
    const { datos: sitio } = await almacen.colecciones.leer("sitio");
    const { datos: equipo } = await almacen.colecciones.leer("equipo");
    const { datos: convocatoria } = await almacen.colecciones.leer("convocatoria");
    if (!sitio.correo || /^correo@/i.test(sitio.correo))
      pendientes.push({
        texto:
          "Registra el correo institucional real: hoy el formulario de contacto no puede responder por correo.",
        seccion: "sitio"
      });
    const visibles = (equipo.items || []).filter(m => m.nombre && !/PENDIENTE/i.test(m.nombre));
    if (!visibles.length)
      pendientes.push({
        texto: "Publica la directiva en Equipo: la página Nosotros aún no muestra integrantes.",
        seccion: "equipo"
      });
    if (convocatoria.abierta && !convocatoria.formulario)
      pendientes.push({
        texto: "La convocatoria está abierta, pero no tiene enlace al formulario.",
        seccion: "convocatoria"
      });
    for (const p of items.filter(x => x.estado === "publicado" && !x.revisadoPor))
      pendientes.push({ texto: `«${p.titulo}» está publicado sin indicar quién lo revisó.`, informe: p.id });
    if (Permisos.puede(usuario, "informes.editarTodos") && contar("revision"))
      pendientes.push({
        texto: `${contar("revision")} ${contar("revision") === 1 ? "informe espera" : "informes esperan"} revisión.`,
        estado: "revision"
      });
    let noLeidos = 0;
    if (Permisos.puede(usuario, "mensajes.ver"))
      noLeidos = (await mensajes.leer()).mensajes.filter(m => !m.leido).length;
    return {
      informes: {
        total: items.length,
        borrador: contar("borrador"),
        revision: contar("revision"),
        publicado: contar("publicado"),
        mios: items.filter(p => p.meta?.creadoPor === usuario.id).length
      },
      pendientes: pendientes.filter(
        p => !p.seccion || Permisos.puede(usuario, Colecciones.COLECCIONES[p.seccion].permiso)
      ),
      mensajesNoLeidos: noLeidos
    };
  }

  /* ---------- Rutas ---------- */
  async function guardarPublicacion(usuario, input) {
    const p = input.publication;
    let resultado;
    try {
      resultado = model.validate(p);
    } catch {
      throw new ApiError(422, "La estructura del informe no es válida.");
    }
    if (resultado.errors.length)
      throw new ApiError(422, "Revisa los campos indicados antes de guardar.", resultado.errors);
    if (
      typeof input.revision !== "string" ||
      (input.originalId !== null && input.originalId !== undefined && typeof input.originalId !== "string")
    )
      throw new ApiError(400, "La solicitud no contiene datos válidos.");
    await comprobarImagenes(model.mediaIn(p));
    let anterior = null;
    const datos = await almacen.publicaciones
      .actualizar(input.revision, items => {
        const indice = input.originalId ? items.findIndex(x => x.id === input.originalId) : -1;
        if (input.originalId && indice < 0)
          throw new ApiError(409, "El informe original ya no está en la biblioteca.");
        anterior = indice >= 0 ? items[indice] : null;
        if (!Permisos.puedeEditarInforme(usuario, anterior))
          throw new ApiError(
            403,
            anterior?.estado === "publicado"
              ? "Solo edición o administración puede modificar un informe publicado."
              : "Solo puedes modificar los informes que creaste. Pide a revisión o edición que lo actualice."
          );
        if (!Permisos.puedeCambiarEstado(usuario, anterior?.estado, p.estado))
          throw new ApiError(
            403,
            "Solo edición o administración puede publicar o retirar informes. Envíalo a revisión."
          );
        // Solo revisión, edición o administración pueden firmar como revisores.
        if (!Permisos.puede(usuario, "informes.editarTodos")) p.revisadoPor = anterior?.revisadoPor || "";
        if (items.some((x, i) => x.id === p.id && i !== indice))
          throw new ApiError(409, "Ya existe un informe con ese enlace. Cambia su identificador.");
        const ahora = new Date().toISOString();
        const previo = anterior?.meta || {};
        p.meta = {
          creadoPor: previo.creadoPor || (anterior ? "" : usuario.id),
          creadoPorNombre: previo.creadoPorNombre || (anterior ? "" : usuario.nombre),
          creadoEn: previo.creadoEn || (anterior ? "" : ahora),
          actualizadoPor: usuario.id,
          actualizadoPorNombre: usuario.nombre,
          actualizadoEn: ahora,
          ...(p.estado === "publicado"
            ? anterior?.estado === "publicado"
              ? { publicadoPorNombre: previo.publicadoPorNombre || "", publicadoEn: previo.publicadoEn || "" }
              : { publicadoPorNombre: usuario.nombre, publicadoEn: ahora }
            : {})
        };
        if (indice < 0) items.unshift(p);
        else items[indice] = p;
        return items;
      })
      .catch(error => {
        if (error.conflicto)
          throw new ApiError(
            409,
            "Otra persona actualizó la biblioteca. Conservamos tu borrador: descarga un respaldo y recarga para comparar los cambios."
          );
        throw error;
      });
    const accion = !anterior
      ? "informe.creado"
      : p.estado === "publicado" && anterior.estado !== "publicado"
        ? "informe.publicado"
        : anterior.estado === "publicado" && p.estado !== "publicado"
          ? "informe.retirado"
          : p.estado === "revision" && anterior.estado !== "revision"
            ? "informe.enviadoRevision"
            : "informe.guardado";
    await anotar(usuario, accion, p.titulo);
    return { publication: p, revision: datos.revision, warnings: resultado.warnings };
  }

  async function manejar(req, res, ruta, usuario, sesionActual) {
    const metodo = req.method;
    const query = new URL(req.url, "http://localhost").searchParams;

    if (metodo === "POST" && ruta === "logout") {
      await usuarios.cerrarSesion(sesionActual.clave);
      res.setHeader("Set-Cookie", cookie(req, "", 0));
      await anotar(usuario, "sesion.cerrada");
      return send(res, 200, { ok: true });
    }
    if (metodo === "POST" && ruta === "cuenta/password") {
      const input = await leerCuerpo(req, 4096);
      if (!(await usuarios.verificar(usuario.usuario, input.actual)))
        throw new ApiError(401, "La contraseña actual no es correcta.");
      if (input.actual === input.nueva)
        throw new ApiError(422, "Elige una contraseña distinta de la actual.");
      await usuarios.cambiarPassword(usuario.id, input.nueva, { debeCambiar: false });
      await usuarios.cerrarSesionesDe(usuario.id, sesionActual.clave);
      await anotar(usuario, "cuenta.password");
      const actualizado = await usuarios.porId(usuario.id);
      return send(res, 200, estadoSesion(actualizado, sesionActual.csrf));
    }
    if (usuario.debeCambiar && !RUTAS_LIBRES_SI_DEBE_CAMBIAR.has(ruta))
      throw new ApiError(403, "Cambia tu contraseña temporal para continuar.");

    if (metodo === "GET" && ruta === "resumen") return send(res, 200, await resumen(usuario));

    /* Informes */
    if (metodo === "GET" && ruta === "publicaciones") {
      const datos = await almacen.publicaciones.leer();
      return send(res, 200, { items: datos.items, revision: datos.revision });
    }
    if (metodo === "POST" && ruta === "publicaciones") {
      exigir(usuario, "informes.crear");
      return send(res, 200, await guardarPublicacion(usuario, await leerCuerpo(req)));
    }
    if (metodo === "POST" && ruta === "publicaciones/eliminar") {
      exigir(usuario, "informes.eliminar");
      const input = await leerCuerpo(req, 4096);
      if (typeof input.revision !== "string")
        throw new ApiError(400, "La solicitud no contiene datos válidos.");
      let eliminado = null;
      const datos = await almacen.publicaciones
        .actualizar(input.revision, items => {
          eliminado = items.find(x => x.id === input.id);
          if (!eliminado) throw new ApiError(404, "El informe ya no está en la biblioteca.");
          return items.filter(x => x.id !== input.id);
        })
        .catch(error => {
          if (error.conflicto)
            throw new ApiError(409, "La biblioteca cambió. Actualiza la lista e inténtalo de nuevo.");
          throw error;
        });
      await anotar(usuario, "informe.eliminado", eliminado.titulo);
      return send(res, 200, { revision: datos.revision });
    }
    if (metodo === "GET" && ruta === "backup") {
      exigir(usuario, "respaldos.descargar");
      const datos = await almacen.publicaciones.leer();
      return send(
        res,
        200,
        { items: datos.items },
        { "Content-Disposition": 'attachment; filename="ceri-publicaciones.json"' }
      );
    }

    /* Imágenes */
    if (metodo === "GET" && ruta === "media") return send(res, 200, { items: await listarImagenes() });
    if (metodo === "POST" && ruta === "media") {
      exigir(usuario, "medios.subir");
      const bytes = await leerCuerpo(req, 12 * 1024 * 1024, false);
      const ext = tipoImagen(bytes);
      if (!ext) throw new ApiError(415, "Sube una imagen JPG, PNG, WebP o GIF válida.");
      let original;
      try {
        original = decodeURIComponent(req.headers["x-file-name"] || "imagen");
      } catch {
        original = "imagen";
      }
      const nombre = `${model.slug(path.parse(original).name).slice(0, 60) || "imagen"}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
      await fs.mkdir(almacen.rutas.subidas, { recursive: true });
      await fs.writeFile(path.join(almacen.rutas.subidas, nombre), bytes, { flag: "wx" });
      await anotar(usuario, "imagen.subida", nombre);
      return send(res, 201, { path: `assets/img/subidas/${nombre}`, name: nombre, size: bytes.length });
    }
    if (metodo === "POST" && ruta === "media/eliminar") {
      exigir(usuario, "medios.eliminar");
      const { path: ruta } = await leerCuerpo(req, 4096);
      const m = /^assets\/img\/subidas\/([a-z0-9-]+\.(png|jpg|webp|gif))$/.exec(String(ruta || ""));
      if (!m) throw new ApiError(422, "Solo se pueden eliminar imágenes subidas desde el estudio.");
      const uso = (await imagenesEnUso()).get(ruta);
      if (uso?.size)
        throw new ApiError(
          409,
          `La imagen se usa en: ${[...uso].join(", ")}. Quítala de ahí antes de eliminarla.`
        );
      try {
        await fs.unlink(path.join(almacen.rutas.subidas, m[1]));
      } catch (error) {
        if (error.code === "ENOENT") throw new ApiError(404, "La imagen ya no existe.");
        throw error;
      }
      await anotar(usuario, "imagen.eliminada", m[1]);
      return send(res, 200, { ok: true });
    }

    /* Contenido del sitio */
    const contenido = /^contenido\/([a-z]+)$/.exec(ruta);
    if (contenido) {
      const nombre = contenido[1];
      const def = Colecciones.COLECCIONES[nombre];
      if (!def || !almacen.colecciones.nombres.includes(nombre))
        throw new ApiError(404, "Esta sección no existe.");
      exigir(usuario, def.permiso);
      if (metodo === "GET") {
        const { datos, revision } = await almacen.colecciones.leer(nombre);
        return send(res, 200, { datos, revision });
      }
      if (metodo === "POST") {
        const input = await leerCuerpo(req, 1024 * 1024);
        if (typeof input.revision !== "string")
          throw new ApiError(400, "La solicitud no contiene datos válidos.");
        const { errores, datos } = Colecciones.validar(nombre, input.datos);
        if (errores.length)
          throw new ApiError(
            422,
            "Revisa los campos indicados.",
            errores.map(message => ({ message }))
          );
        await comprobarImagenes(Colecciones.imagenesEn(nombre, datos));
        const guardado = await almacen.colecciones.guardar(nombre, input.revision, datos).catch(error => {
          if (error.conflicto)
            throw new ApiError(
              409,
              "Otra persona modificó esta sección. Recarga para ver la versión actual."
            );
          throw error;
        });
        await anotar(usuario, "contenido.guardado", def.titulo);
        return send(res, 200, { datos: guardado.datos, revision: guardado.revision });
      }
    }

    /* Mensajes del formulario de contacto */
    if (ruta.startsWith("mensajes")) {
      exigir(usuario, "mensajes.ver");
      if (metodo === "GET" && ruta === "mensajes") return send(res, 200, await mensajes.leer());
      if (metodo === "POST" && (ruta === "mensajes/estado" || ruta === "mensajes/eliminar")) {
        const input = await leerCuerpo(req, 4096);
        const datos = await mensajes.actualizar(async contenido => {
          const m = contenido.mensajes.find(x => x.id === input.id);
          if (!m) throw new ApiError(404, "El mensaje ya no existe.");
          if (ruta === "mensajes/estado") m.leido = input.leido === true;
          else contenido.mensajes = contenido.mensajes.filter(x => x.id !== input.id);
          return contenido;
        });
        if (ruta === "mensajes/eliminar") await anotar(usuario, "mensaje.eliminado", input.id);
        return send(res, 200, datos);
      }
    }

    /* Cuentas del equipo */
    if (ruta.startsWith("usuarios")) {
      exigir(usuario, "usuarios.gestionar");
      if (metodo === "GET" && ruta === "usuarios")
        return send(res, 200, {
          usuarios: (await usuarios.lista()).map(usuarios.publico),
          roles: Permisos.ROLES
        });
      if (metodo === "POST") {
        const input = await leerCuerpo(req, 8192);
        if (ruta === "usuarios") {
          const temporal = passwordTemporal();
          const nuevo = await usuarios.crear(input, { password: temporal, debeCambiar: true });
          await anotar(usuario, "usuario.creado", `${nuevo.usuario} (${nuevo.rol})`);
          return send(res, 201, { usuario: usuarios.publico(nuevo), passwordTemporal: temporal });
        }
        const objetivo = await usuarios.porId(String(input.id || ""));
        if (!objetivo) throw new ApiError(404, "La cuenta ya no existe.");
        if (ruta === "usuarios/actualizar") {
          const cambios = { nombre: input.nombre, rol: input.rol, activo: input.activo };
          const actualizado = await usuarios.actualizar(objetivo.id, cambios);
          if (actualizado.rol !== objetivo.rol || actualizado.activo !== (objetivo.activo !== false))
            await usuarios.cerrarSesionesDe(objetivo.id);
          await anotar(
            usuario,
            "usuario.actualizado",
            `${actualizado.usuario}: ${actualizado.rol}${actualizado.activo ? "" : ", desactivada"}`
          );
          return send(res, 200, { usuario: usuarios.publico(actualizado) });
        }
        if (ruta === "usuarios/restablecer") {
          const temporal = passwordTemporal();
          await usuarios.cambiarPassword(objetivo.id, temporal, { debeCambiar: true });
          await usuarios.cerrarSesionesDe(objetivo.id);
          await anotar(usuario, "usuario.passwordRestablecida", objetivo.usuario);
          return send(res, 200, { passwordTemporal: temporal });
        }
        if (ruta === "usuarios/eliminar") {
          if (objetivo.id === usuario.id) throw new ApiError(409, "No puedes eliminar tu propia cuenta.");
          await usuarios.eliminar(objetivo.id);
          await usuarios.cerrarSesionesDe(objetivo.id);
          await anotar(usuario, "usuario.eliminado", objetivo.usuario);
          return send(res, 200, { ok: true });
        }
      }
    }

    /* Respaldos y actividad */
    if (metodo === "GET" && ruta === "respaldos") {
      exigir(usuario, "respaldos.restaurar");
      return send(res, 200, { respaldos: await almacen.copias.listar() });
    }
    if (metodo === "GET" && ruta === "respaldos/descargar") {
      exigir(usuario, "respaldos.restaurar");
      const archivo = almacen.copias.ruta(query.get("nombre") || "");
      if (!archivo || !(await almacen.existe(archivo))) throw new ApiError(404, "El respaldo no existe.");
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${path.basename(archivo)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      return res.end(await fs.readFile(archivo));
    }
    if (metodo === "POST" && ruta === "respaldos/restaurar") {
      exigir(usuario, "respaldos.restaurar");
      const { nombre } = await leerCuerpo(req, 4096);
      try {
        await almacen.copias.restaurar(String(nombre || ""));
      } catch (error) {
        if (error.noExiste) throw new ApiError(404, "El respaldo no existe.");
        if (error.invalido) throw new ApiError(422, "El respaldo no tiene un formato válido.");
        throw error;
      }
      await anotar(usuario, "respaldo.restaurado", nombre);
      return send(res, 200, { ok: true });
    }
    if (metodo === "GET" && ruta === "auditoria") {
      exigir(usuario, "auditoria.ver");
      return send(res, 200, { registros: await almacen.registro.leer(Number(query.get("limite")) || 300) });
    }
    throw new ApiError(404, "Esta opción del panel no existe.");
  }

  let migracion = null;
  return async function adminApi(req, res, pathname) {
    if (!pathname.startsWith("/api/admin/")) return false;
    res.setHeader("Vary", "Cookie");
    try {
      migracion ||= usuarios.migrarLegado();
      await migracion;
      const ruta = pathname.slice("/api/admin/".length);
      const actual = await usuarios.sesion(token(req));
      if (req.method === "GET" && ruta === "session") {
        if (actual) return send(res, 200, estadoSesion(actual.usuario, actual.csrf)), true;
        send(res, 200, {
          configured: await usuarios.configurado(),
          setupAllowed: red.configuracionLocal(req),
          authenticated: false
        });
        return true;
      }
      if (req.method !== "GET" && !red.origenPermitido(req))
        throw new ApiError(403, "Esta acción debe realizarse desde el propio panel.");

      if (req.method === "POST" && ruta === "setup") {
        if (!red.configuracionLocal(req))
          throw new ApiError(
            403,
            "Crea la primera cuenta desde localhost en la computadora del servidor, o con «npm run cuentas»."
          );
        const input = await leerCuerpo(req, 4096);
        if (await usuarios.configurado())
          throw new ApiError(409, "El acceso ya está configurado. Inicia sesión.");
        const admin = await usuarios.crear(
          { usuario: input.usuario, nombre: input.nombre, rol: "admin" },
          { password: input.password, debeCambiar: false }
        );
        await anotar(admin, "cuenta.configurada", admin.usuario);
        const csrf = await entrar(req, res, admin);
        send(res, 201, estadoSesion(admin, csrf));
        return true;
      }
      if (req.method === "POST" && ruta === "login") {
        const input = await leerCuerpo(req, 4096);
        const direccion = red.ip(req);
        const cuenta = String(input.usuario || "")
          .trim()
          .toLowerCase()
          .slice(0, 40);
        if (porIp.bloqueado(direccion) || porCuenta.bloqueado(cuenta))
          throw new ApiError(429, "Demasiados intentos. Vuelve a intentarlo en 15 minutos.");
        if (!(await usuarios.configurado()))
          throw new ApiError(409, "Configura primero el acceso desde la computadora del servidor.");
        const encontrado = await usuarios.verificar(cuenta, input.password);
        if (!encontrado) {
          porIp.fallo(direccion);
          porCuenta.fallo(cuenta);
          await anotar(null, "acceso.fallido", `${cuenta || "(vacío)"} desde ${direccion}`);
          throw new ApiError(401, "El usuario o la contraseña no son correctos.");
        }
        porCuenta.limpiar(cuenta);
        const csrf = await entrar(req, res, encontrado);
        await anotar(encontrado, "sesion.iniciada", direccion);
        send(res, 200, estadoSesion(encontrado, csrf));
        return true;
      }
      if (!actual) throw new ApiError(401, "Inicia sesión para usar el estudio.");
      if (req.method !== "GET" && req.headers["x-csrf-token"] !== actual.csrf)
        throw new ApiError(403, "La sesión cambió. Recarga el panel e inicia sesión de nuevo.");
      await manejar(req, res, ruta, actual.usuario, actual);
    } catch (error) {
      const status = error instanceof ApiError || error instanceof ErrorUsuario ? error.status : 500;
      if (status === 500) console.error(error);
      if (!res.headersSent)
        send(res, status, {
          error: status === 500 ? "No se pudo completar la operación. Inténtalo de nuevo." : error.message,
          details: error.details
        });
    }
    return true;
  };
}

module.exports = { crearAdminApi, crearRed, leerCuerpo, send, ApiError };
