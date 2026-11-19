/* Cuentas del equipo, sesiones y límite de intentos de acceso.
   Las contraseñas se guardan con sal y scrypt; las sesiones, como huella SHA-256 del token. */
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const path = require("node:path");
const Permisos = require("../admin/permisos.js");

const scrypt = promisify(crypto.scrypt);
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const USUARIO_VALIDO = /^[a-z0-9][a-z0-9._-]{2,31}$/;

class ErrorUsuario extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validarPassword(password, usuario = "") {
  if (typeof password !== "string" || password.length < 10 || password.length > 128)
    throw new ErrorUsuario(422, "Usa una contraseña de 10 a 128 caracteres.");
  if (usuario && password.toLowerCase().includes(usuario.toLowerCase()))
    throw new ErrorUsuario(422, "La contraseña no debe contener el nombre de usuario.");
  if (/^(.)\1+$/.test(password)) throw new ErrorUsuario(422, "Elige una contraseña menos predecible.");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(24).toString("hex");
  const hash = (await scrypt(password, salt, 64)).toString("hex");
  return { salt, hash };
}

/* Contraseña temporal legible para entregar a una persona nueva del equipo. */
function passwordTemporal() {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(16);
  const texto = [...bytes].map(b => letras[b % letras.length]).join("");
  return `${texto.slice(0, 4)}-${texto.slice(4, 8)}-${texto.slice(8, 12)}-${texto.slice(12, 16)}`;
}

const publico = u =>
  u && {
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    rol: u.rol,
    activo: u.activo !== false,
    debeCambiar: !!u.debeCambiar,
    creadoEn: u.creadoEn,
    ultimoAcceso: u.ultimoAcceso || ""
  };

function crearUsuarios(almacen, { sessionHours = 8 } = {}) {
  // Las cuentas se comparten con el equipo por Git; las sesiones son de cada computadora.
  const archivo = almacen.archivoEquipo("usuarios.json", { usuarios: [] });
  const archivoSesiones = almacen.archivoPrivado("sesiones.json", { sesiones: {} });
  const accesos = almacen.archivoPrivado("accesos.json", {});
  const SESSION_MS = sessionHours * 60 * 60 * 1000;
  let sesiones = null;
  let hashFicticio = null;

  /* Convierte el acceso único de la versión anterior (.ceri/admin.json) en la cuenta «admin». */
  async function migrarLegado() {
    // Versión anterior: cuentas en .ceri/usuarios.json (solo en esta computadora).
    const local = path.join(almacen.rutas.privado, "usuarios.json");
    if (!(await almacen.existe(archivo.file)) && (await almacen.existe(local))) {
      await archivo.escribir(JSON.parse(await fs.readFile(local, "utf8")));
      await fs.rename(local, local + ".migrado");
    }
    const legado = path.join(almacen.rutas.privado, "admin.json");
    if (!(await almacen.existe(legado)) || (await almacen.existe(archivo.file))) return null;
    const anterior = JSON.parse(await fs.readFile(legado, "utf8"));
    if (!anterior.salt || !anterior.hash) return null;
    const admin = {
      id: crypto.randomUUID(),
      usuario: "admin",
      nombre: "Administración CERI",
      rol: "admin",
      activo: true,
      debeCambiar: false,
      salt: anterior.salt,
      hash: anterior.hash,
      creadoEn: new Date().toISOString()
    };
    await archivo.escribir({ usuarios: [admin] });
    await fs.rename(legado, legado + ".migrado");
    await almacen.registro.anotar(
      null,
      "cuenta.migrada",
      "El acceso compartido anterior ahora es la cuenta «admin»."
    );
    return admin;
  }

  async function lista() {
    const vistos = await accesos.leer().catch(() => ({}));
    return ((await archivo.leer()).usuarios || []).map(u => ({ ...u, ultimoAcceso: vistos[u.id] || "" }));
  }
  async function porId(id) {
    return (await lista()).find(u => u.id === id) || null;
  }
  async function configurado() {
    return (await lista()).some(u => u.rol === "admin" && u.activo !== false);
  }

  function normalizar({ usuario, nombre, rol }) {
    usuario = String(usuario || "")
      .trim()
      .toLowerCase();
    nombre = String(nombre || "").trim();
    if (!USUARIO_VALIDO.test(usuario))
      throw new ErrorUsuario(
        422,
        "El usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto o guion."
      );
    if (nombre.length < 2 || nombre.length > 80)
      throw new ErrorUsuario(422, "Escribe el nombre de la persona (2 a 80 caracteres).");
    if (!Permisos.esRol(rol)) throw new ErrorUsuario(422, "Selecciona un rol válido.");
    return { usuario, nombre, rol };
  }

  async function crear(datos, { password, debeCambiar = true } = {}) {
    const limpio = normalizar(datos);
    validarPassword(password, limpio.usuario);
    const credenciales = await hashPassword(password);
    return archivo.actualizar(async contenido => {
      contenido.usuarios ||= [];
      if (contenido.usuarios.some(u => u.usuario === limpio.usuario))
        throw new ErrorUsuario(409, "Ya existe una cuenta con ese usuario.");
      if (contenido.usuarios.length >= 200) throw new ErrorUsuario(422, "Se alcanzó el máximo de cuentas.");
      const nuevo = {
        id: crypto.randomUUID(),
        ...limpio,
        activo: true,
        debeCambiar,
        ...credenciales,
        creadoEn: new Date().toISOString()
      };
      contenido.usuarios.push(nuevo);
      return nuevo;
    });
  }

  /* Cambios de nombre, rol o estado. Impide quedarse sin administradores activos. */
  async function actualizar(id, cambios) {
    return archivo.actualizar(async contenido => {
      const u = (contenido.usuarios || []).find(x => x.id === id);
      if (!u) throw new ErrorUsuario(404, "La cuenta ya no existe.");
      const siguiente = { ...u };
      if (cambios.nombre !== undefined || cambios.rol !== undefined) {
        const limpio = normalizar({
          usuario: u.usuario,
          nombre: cambios.nombre ?? u.nombre,
          rol: cambios.rol ?? u.rol
        });
        siguiente.nombre = limpio.nombre;
        siguiente.rol = limpio.rol;
      }
      if (cambios.activo !== undefined) siguiente.activo = cambios.activo === true;
      const quedanAdmins = contenido.usuarios.some(x =>
        x.id === id ? siguiente.rol === "admin" && siguiente.activo : x.rol === "admin" && x.activo !== false
      );
      if (!quedanAdmins)
        throw new ErrorUsuario(409, "Debe quedar al menos una cuenta de administración activa.");
      Object.assign(u, siguiente);
      return u;
    });
  }

  async function eliminar(id) {
    return archivo.actualizar(async contenido => {
      const u = (contenido.usuarios || []).find(x => x.id === id);
      if (!u) throw new ErrorUsuario(404, "La cuenta ya no existe.");
      if (
        u.rol === "admin" &&
        !contenido.usuarios.some(x => x.id !== id && x.rol === "admin" && x.activo !== false)
      )
        throw new ErrorUsuario(409, "Debe quedar al menos una cuenta de administración activa.");
      contenido.usuarios = contenido.usuarios.filter(x => x.id !== id);
      return u;
    });
  }

  async function cambiarPassword(id, password, { debeCambiar = false } = {}) {
    const u = await porId(id);
    if (!u) throw new ErrorUsuario(404, "La cuenta ya no existe.");
    validarPassword(password, u.usuario);
    const credenciales = await hashPassword(password);
    return archivo.actualizar(async contenido => {
      const actual = contenido.usuarios.find(x => x.id === id);
      if (!actual) throw new ErrorUsuario(404, "La cuenta ya no existe.");
      Object.assign(actual, credenciales, { debeCambiar });
      return actual;
    });
  }

  /* Comprueba usuario y contraseña en tiempo similar aunque la cuenta no exista. */
  async function verificar(usuario, password) {
    usuario = String(usuario || "")
      .trim()
      .toLowerCase();
    const u = (await lista()).find(x => x.usuario === usuario);
    if (typeof password !== "string" || password.length > 128) password = "";
    if (!u) {
      hashFicticio ||= await hashPassword(crypto.randomBytes(16).toString("hex"));
      await scrypt(password, hashFicticio.salt, 64);
      return null;
    }
    const calculado = await scrypt(password, u.salt, 64);
    if (!crypto.timingSafeEqual(calculado, Buffer.from(u.hash, "hex"))) return null;
    if (u.activo === false) return null;
    return u;
  }

  /* El último acceso se guarda solo en esta computadora para no cambiar el archivo compartido en cada inicio de sesión. */
  async function registrarAcceso(id) {
    await accesos.actualizar(async datos => {
      datos[id] = new Date().toISOString();
    });
  }

  /* ---------- Sesiones (persisten al reiniciar el servidor) ---------- */
  async function cargarSesiones() {
    if (!sesiones) {
      const datos = await archivoSesiones.leer().catch(() => ({ sesiones: {} }));
      sesiones = new Map(Object.entries(datos.sesiones || {}));
    }
    return sesiones;
  }
  async function guardarSesiones() {
    const ahora = Date.now();
    for (const [k, s] of sesiones) if (s.expira < ahora) sesiones.delete(k);
    await archivoSesiones.escribir({ sesiones: Object.fromEntries(sesiones) });
  }
  async function iniciarSesion(usuarioId) {
    await cargarSesiones();
    const token = crypto.randomBytes(32).toString("hex");
    const csrf = crypto.randomBytes(24).toString("hex");
    sesiones.set(digest(token), { usuarioId, csrf, expira: Date.now() + SESSION_MS, creada: Date.now() });
    await almacen.enSerie(guardarSesiones);
    return { token, csrf, maxAge: SESSION_MS / 1000 };
  }
  async function sesion(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    await cargarSesiones();
    const clave = digest(token);
    const s = sesiones.get(clave);
    if (!s) return null;
    if (s.expira < Date.now()) {
      sesiones.delete(clave);
      return null;
    }
    const u = await porId(s.usuarioId);
    if (!u || u.activo === false) return null;
    return { clave, csrf: s.csrf, usuario: u };
  }
  async function cerrarSesion(clave) {
    await cargarSesiones();
    sesiones.delete(clave);
    await almacen.enSerie(guardarSesiones);
  }
  /* Cierra todas las sesiones de una persona (al cambiar su rol, desactivarla o cambiar su contraseña). */
  async function cerrarSesionesDe(usuarioId, excepto = null) {
    await cargarSesiones();
    for (const [k, s] of sesiones) if (s.usuarioId === usuarioId && k !== excepto) sesiones.delete(k);
    await almacen.enSerie(guardarSesiones);
  }

  return {
    migrarLegado,
    lista,
    porId,
    configurado,
    crear,
    actualizar,
    eliminar,
    cambiarPassword,
    verificar,
    registrarAcceso,
    iniciarSesion,
    sesion,
    cerrarSesion,
    cerrarSesionesDe,
    publico
  };
}

/* Límite de intentos: por dirección y por cuenta, con ventana deslizante. */
function crearLimitador({ maximo, ventanaMs }) {
  const registros = new Map();
  return {
    bloqueado(clave) {
      const r = registros.get(clave);
      if (!r) return false;
      if (r.hasta < Date.now()) {
        registros.delete(clave);
        return false;
      }
      return r.cuenta >= maximo;
    },
    fallo(clave) {
      const ahora = Date.now();
      const r = registros.get(clave);
      if (!r || r.hasta < ahora) registros.set(clave, { cuenta: 1, hasta: ahora + ventanaMs });
      else r.cuenta++;
      if (registros.size > 10000) for (const [k, v] of registros) if (v.hasta < ahora) registros.delete(k);
    },
    limpiar(clave) {
      registros.delete(clave);
    }
  };
}

module.exports = {
  crearUsuarios,
  crearLimitador,
  validarPassword,
  passwordTemporal,
  ErrorUsuario,
  USUARIO_VALIDO
};
