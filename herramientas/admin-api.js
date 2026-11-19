/* API editorial con sesiones, control de versiones y respaldos automáticos. */
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const model = require("../admin/model.js");
const scrypt = promisify(crypto.scrypt);
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const SESSION_MS = 8 * 60 * 60 * 1000;

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(data));
}
async function body(req, limit = 3 * 1024 * 1024, json = true) {
  if (Number(req.headers["content-length"] || 0) > limit)
    throw new ApiError(413, "El archivo es demasiado grande.");
  const parts = [];
  let total = 0;
  for await (const part of req) {
    total += part.length;
    if (total > limit) throw new ApiError(413, "El archivo es demasiado grande.");
    parts.push(part);
  }
  const data = Buffer.concat(parts);
  if (!json) return data;
  try {
    const value = JSON.parse(data.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    return value;
  } catch {
    throw new ApiError(400, "La solicitud no contiene datos válidos.");
  }
}

function createAdminApi(root, options = {}) {
  const dataPath = path.join(root, "contenido", "publicaciones.json");
  const privateDir = path.join(root, ".ceri"),
    credentialsPath = path.join(privateDir, "admin.json");
  const uploadsDir = path.join(root, "assets", "img", "subidas");
  const sessions = new Map(),
    attempts = new Map();
  let writes = Promise.resolve();
  const serialize = work => {
    const result = writes.then(work);
    writes = result.catch(() => {});
    return result;
  };
  async function credentials() {
    try {
      return JSON.parse(await fs.readFile(credentialsPath, "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }
  async function read() {
    const raw = await fs.readFile(dataPath, "utf8");
    const data = JSON.parse(raw);
    return { items: data.items || [], revision: digest(raw), raw };
  }
  function permittedOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return false;
    const host = req.headers.host;
    return (
      origin === `http://${host}` ||
      origin === `https://${host}` ||
      origin === (options.adminOrigin || process.env.CERI_ADMIN_ORIGIN)
    );
  }
  function localSetup(req) {
    try {
      const host = new URL(`http://${req.headers.host}`).hostname;
      const referring = req.headers.origin || req.headers.referer || `http://${req.headers.host}`;
      return (
        ["localhost", "127.0.0.1", "[::1]"].includes(host) &&
        ["localhost", "127.0.0.1", "[::1]"].includes(new URL(referring).hostname) &&
        !req.headers["x-forwarded-for"] &&
        !req.headers.forwarded &&
        !req.headers["x-forwarded-host"]
      );
    } catch {
      return false;
    }
  }
  function currentSession(req) {
    const token = String(req.headers.cookie || "")
      .split(";")
      .map(x => x.trim())
      .find(x => x.startsWith("ceri_admin="))
      ?.slice(11);
    if (!token) return null;
    const key = digest(token),
      session = sessions.get(key);
    if (!session || session.expires < Date.now()) {
      sessions.delete(key);
      return null;
    }
    return { ...session, key };
  }
  function startSession(req, res) {
    for (const [key, value] of sessions) if (value.expires < Date.now()) sessions.delete(key);
    const token = crypto.randomBytes(32).toString("hex"),
      csrfToken = crypto.randomBytes(24).toString("hex");
    sessions.set(digest(token), { csrfToken, expires: Date.now() + SESSION_MS });
    const secure = req.headers["x-forwarded-proto"] === "https";
    res.setHeader(
      "Set-Cookie",
      `ceri_admin=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secure ? "; Secure" : ""}`
    );
    return csrfToken;
  }
  async function atomicWrite(data) {
    const old = await read();
    const backups = path.join(privateDir, "backups");
    await fs.mkdir(backups, { recursive: true });
    await fs.writeFile(
      path.join(backups, `publicaciones-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.json`),
      old.raw,
      { mode: 0o600 }
    );
    const temporary = path.join(privateDir, `publicaciones-${crypto.randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, JSON.stringify({ items: data }, null, 2) + "\n");
      await fs.rename(temporary, dataPath);
    } finally {
      await fs.unlink(temporary).catch(() => {});
    }
    const files = (await fs.readdir(backups))
      .filter(f => /^publicaciones-\d+-[a-f0-9]+\.json$/.test(f))
      .sort()
      .reverse();
    await Promise.all(files.slice(20).map(f => fs.unlink(path.join(backups, f))));
    return read();
  }
  async function existingImages() {
    const list = [];
    async function walk(folder) {
      for (const entry of await fs.readdir(folder, { withFileTypes: true }).catch(() => [])) {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) await walk(file);
        else if (entry.isFile() && /\.(jpe?g|png|webp|gif)$/i.test(entry.name)) {
          const stat = await fs.stat(file);
          list.push({
            path: path.relative(root, file).split(path.sep).join("/"),
            name: entry.name,
            size: stat.size,
            modified: stat.mtime.toISOString()
          });
        }
      }
    }
    await walk(path.join(root, "assets", "img"));
    return list.sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, 500);
  }
  return async function adminApi(req, res, pathname) {
    if (!pathname.startsWith("/api/admin/")) return false;
    res.setHeader("Vary", "Cookie");
    try {
      const route = pathname.slice("/api/admin/".length),
        session = currentSession(req);
      if (req.method === "GET" && route === "session") {
        send(res, 200, {
          configured: !!(await credentials()),
          setupAllowed: localSetup(req),
          authenticated: !!session,
          csrfToken: session?.csrfToken
        });
        return true;
      }
      if (req.method !== "GET" && !permittedOrigin(req))
        throw new ApiError(403, "Esta acción debe realizarse desde el propio panel.");
      if (req.method === "POST" && route === "setup") {
        if (!localSetup(req))
          throw new ApiError(403, "Configura el acceso desde localhost en la computadora del proyecto.");
        const input = await body(req, 4096);
        if (typeof input.password !== "string" || input.password.length < 10 || input.password.length > 128)
          throw new ApiError(422, "Usa una contraseña de 10 a 128 caracteres.");
        const csrfToken = await serialize(async () => {
          if (await credentials()) throw new ApiError(409, "El acceso ya está configurado. Inicia sesión.");
          const salt = crypto.randomBytes(24).toString("hex");
          const hash = (await scrypt(input.password, salt, 64)).toString("hex");
          await fs.mkdir(privateDir, { recursive: true });
          await fs.writeFile(credentialsPath, JSON.stringify({ salt, hash }) + "\n", {
            flag: "wx",
            mode: 0o600
          });
          return startSession(req, res);
        });
        send(res, 201, { authenticated: true, csrfToken });
        return true;
      }
      if (req.method === "POST" && route === "login") {
        const address = req.socket.remoteAddress || "local";
        const now = Date.now();
        const attempt = attempts.get(address) || { count: 0, until: now + 10 * 60 * 1000 };
        if (attempt.until < now) {
          attempt.count = 0;
          attempt.until = now + 10 * 60 * 1000;
        }
        if (attempt.count >= 5)
          throw new ApiError(429, "Demasiados intentos. Vuelve a intentarlo en unos minutos.");
        const input = await body(req, 4096),
          stored = await credentials();
        if (!stored)
          throw new ApiError(409, "Configura primero el acceso desde la computadora del proyecto.");
        const key =
          typeof input.password === "string" && input.password.length <= 128
            ? await scrypt(input.password, stored.salt, 64)
            : Buffer.alloc(64);
        if (!crypto.timingSafeEqual(key, Buffer.from(stored.hash, "hex"))) {
          attempt.count++;
          attempts.set(address, attempt);
          throw new ApiError(401, "La contraseña no es correcta.");
        }
        attempts.delete(address);
        send(res, 200, { authenticated: true, csrfToken: startSession(req, res) });
        return true;
      }
      if (!session) throw new ApiError(401, "Inicia sesión para administrar los informes.");
      if (req.method !== "GET" && req.headers["x-csrf-token"] !== session.csrfToken)
        throw new ApiError(403, "La sesión cambió. Recarga el panel e inicia sesión de nuevo.");
      if (req.method === "POST" && route === "logout") {
        sessions.delete(session.key);
        res.setHeader("Set-Cookie", "ceri_admin=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0");
        send(res, 200, { ok: true });
        return true;
      }
      if (req.method === "GET" && route === "publicaciones") {
        const data = await read();
        send(res, 200, { items: data.items, revision: data.revision });
        return true;
      }
      if (req.method === "POST" && route === "publicaciones") {
        const input = await body(req),
          p = input.publication;
        let result;
        try {
          result = model.validate(p);
        } catch {
          throw new ApiError(422, "La estructura del informe no es válida.");
        }
        if (result.errors.length)
          throw new ApiError(422, "Revisa los campos indicados antes de guardar.", result.errors);
        const data = await serialize(async () => {
          const previous = await read();
          if (input.revision !== previous.revision)
            throw new ApiError(
              409,
              "Otra persona actualizó la biblioteca. Conservamos tu borrador: descarga un respaldo y recarga para comparar los cambios."
            );
          const index = input.originalId ? previous.items.findIndex(x => x.id === input.originalId) : -1;
          if (input.originalId && index < 0)
            throw new ApiError(409, "El informe original ya no está en la biblioteca.");
          if (previous.items.some((x, i) => x.id === p.id && i !== index))
            throw new ApiError(409, "Ya existe un informe con ese enlace. Cambia su identificador.");
          for (const src of model.mediaIn(p))
            if (!/^https:/i.test(src)) {
              const file = path.join(root, src.replace(/^\//, ""));
              try {
                await fs.access(file);
              } catch {
                throw new ApiError(422, "Una imagen del informe ya no está disponible.");
              }
            }
          if (index < 0) previous.items.unshift(p);
          else previous.items[index] = p;
          return atomicWrite(previous.items);
        });
        send(res, 200, { publication: p, revision: data.revision, warnings: result.warnings });
        return true;
      }
      if (req.method === "GET" && route === "media") {
        send(res, 200, { items: await existingImages() });
        return true;
      }
      if (req.method === "POST" && route === "media") {
        const bytes = await body(req, 12 * 1024 * 1024, false);
        let ext = "";
        if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          ext = "png";
        else if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ext = "jpg";
        else if (
          bytes.length > 12 &&
          bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP"
        )
          ext = "webp";
        else if (bytes.length > 6 && /^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) ext = "gif";
        if (!ext) throw new ApiError(415, "Sube una imagen JPG, PNG, WebP o GIF válida.");
        let original;
        try {
          original = decodeURIComponent(req.headers["x-file-name"] || "imagen");
        } catch {
          original = "imagen";
        }
        const name = `${model.slug(path.parse(original).name) || "imagen"}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
        await fs.mkdir(uploadsDir, { recursive: true });
        await fs.writeFile(path.join(uploadsDir, name), bytes, { flag: "wx" });
        send(res, 201, { path: `assets/img/subidas/${name}`, name, size: bytes.length });
        return true;
      }
      if (req.method === "GET" && route === "backup") {
        const data = await read();
        res.setHeader("Content-Disposition", 'attachment; filename="ceri-publicaciones.json"');
        send(res, 200, { items: data.items });
        return true;
      }
      throw new ApiError(404, "Esta opción del panel no existe.");
    } catch (error) {
      send(res, error.status || 500, {
        error: error.status ? error.message : "No se pudo completar la operación. Inténtalo de nuevo.",
        details: error.details
      });
    }
    return true;
  };
}
module.exports = { createAdminApi };
