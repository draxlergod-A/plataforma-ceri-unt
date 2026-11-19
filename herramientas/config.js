/* Configuración del servidor a partir de variables de entorno.
   En la computadora del proyecto no hace falta definir ninguna. */
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function leerConfig(opciones = {}) {
  const env = opciones.env || process.env;
  const root = path.resolve(opciones.root || ROOT);
  const publicUrl = String(opciones.publicUrl ?? env.CERI_PUBLIC_URL ?? "").replace(/\/+$/, "");
  if (publicUrl && !/^https?:\/\/[^/\s]+$/i.test(publicUrl))
    throw new Error("CERI_PUBLIC_URL debe ser solo el origen, por ejemplo https://ceri-unt.org");
  const produccion = (opciones.produccion ?? env.NODE_ENV === "production") === true;
  return {
    root,
    // Carpeta con los datos que cambian (contenido, imágenes subidas y archivos privados).
    // En un alojamiento debe apuntar a un disco persistente.
    dataDir: path.resolve(opciones.dataDir || env.CERI_DATA_DIR || root),
    publicUrl,
    produccion,
    // Solo detrás de un proxy de confianza (Render, Railway, Nginx…): usar X-Forwarded-For/Proto.
    trustProxy: opciones.trustProxy ?? env.CERI_TRUST_PROXY === "1",
    adminOrigin: opciones.adminOrigin ?? env.CERI_ADMIN_ORIGIN ?? "",
    port: Number(opciones.port ?? env.PORT) || 5500,
    host: opciones.host || env.HOST || "127.0.0.1",
    sessionHours: Number(env.CERI_SESSION_HOURS) || 8
  };
}

module.exports = { leerConfig, ROOT };
