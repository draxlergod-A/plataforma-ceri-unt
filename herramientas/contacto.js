/* Formulario de contacto público: valida, limita envíos y guarda los mensajes
   en el almacén privado para que edición y administración los lean en el estudio. */
const crypto = require("node:crypto");
const { crearLimitador } = require("./usuarios.js");
const { leerCuerpo, send, ApiError } = require("./admin-api.js");

const MOTIVOS = ["Consulta", "Propuesta de alianza o evento", "Corrección de una publicación", "Otro"];
const MAX_MENSAJES = 2000;

function crearContacto(almacen, red) {
  const mensajes = almacen.archivoPrivado("mensajes.json", { mensajes: [] });
  const porIp = crearLimitador({ maximo: 5, ventanaMs: 60 * 60 * 1000 });
  const global = crearLimitador({ maximo: 300, ventanaMs: 24 * 60 * 60 * 1000 });

  return async function contacto(req, res) {
    try {
      if (req.method !== "POST") throw new ApiError(405, "Método no permitido.");
      if (!red.origenPermitido(req))
        throw new ApiError(403, "Envía el mensaje desde el formulario de la web.");
      const direccion = red.ip(req);
      if (porIp.bloqueado(direccion) || global.bloqueado("todos"))
        throw new ApiError(429, "Recibimos varios mensajes seguidos. Inténtalo de nuevo más tarde.");
      const input = await leerCuerpo(req, 16 * 1024);
      // Campo trampa: las personas no lo ven; los robots suelen completarlo.
      if (input.empresa) return send(res, 200, { ok: true });
      const texto = (valor, max) => (typeof valor === "string" ? valor.trim().slice(0, max + 1) : "");
      const nombre = texto(input.nombre, 80);
      const correo = texto(input.correo, 120);
      const mensaje = texto(input.mensaje, 2000);
      const motivo = MOTIVOS.includes(input.motivo) ? input.motivo : "Otro";
      const errores = [];
      if (nombre.length < 2 || nombre.length > 80) errores.push("Escribe tu nombre.");
      if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(correo) || correo.length > 120)
        errores.push("Escribe un correo válido.");
      if (mensaje.length < 10 || mensaje.length > 2000)
        errores.push("El mensaje debe tener entre 10 y 2000 caracteres.");
      if (errores.length) throw new ApiError(422, errores.join(" "));
      porIp.fallo(direccion);
      global.fallo("todos");
      await mensajes.actualizar(async datos => {
        datos.mensajes ||= [];
        datos.mensajes.unshift({
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          nombre,
          correo,
          motivo,
          mensaje,
          leido: false
        });
        if (datos.mensajes.length > MAX_MENSAJES) datos.mensajes = datos.mensajes.slice(0, MAX_MENSAJES);
      });
      send(res, 201, { ok: true });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      if (status === 500) console.error(error);
      send(res, status, {
        error: status === 500 ? "No pudimos registrar tu mensaje. Inténtalo más tarde." : error.message
      });
    }
  };
}

module.exports = { crearContacto, MOTIVOS };
