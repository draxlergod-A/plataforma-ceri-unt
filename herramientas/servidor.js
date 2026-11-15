/* Vista previa local, sin instalaciones ni dependencias adicionales. */
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createAdminApi } = require("./admin-api.js");
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".json":"application/json", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png", ".webp":"image/webp", ".gif":"image/gif", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".yml":"text/yaml" };

function createServer(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const adminApi = createAdminApi(root, options);
  return http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (await adminApi(req, res, pathname)) return;
      if (!["GET","HEAD"].includes(req.method)) { res.writeHead(405); res.end(); return; }
      if (pathname.split(/[\\/]/).some(segment => segment.startsWith(".") || segment.includes(":"))) {
        res.writeHead(403); res.end("Ruta no disponible"); return;
      }
      let file = path.resolve(root, "." + pathname);
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      // Windows acepta diferencias de mayúsculas y separadores: filtrar por archivo resuelto.
      if (file.toLowerCase() === path.join(root, "contenido", "publicaciones.json").toLowerCase()) {
        const data = JSON.parse(await fs.readFile(path.join(root, "contenido", "publicaciones.json"), "utf8"));
        res.writeHead(200, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify({items:(data.items || []).filter(p=>p.estado === "publicado")}));
        return;
      }
      if (["/admin/", "/admin/index.html", "/admin"].includes(pathname)) {
        res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
        res.setHeader("Referrer-Policy", "same-origin");
      }
      const stat = await fs.stat(file);
      if (stat.isDirectory()) file = path.join(file, "index.html");
      const bytes = await fs.readFile(file);
      const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type + (/^(text\/|application\/json)/.test(type) ? "; charset=utf-8" : ""), "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (err) {
      res.writeHead(err instanceof URIError ? 400 : 404, { "Content-Type":"text/plain; charset=utf-8" });
      res.end("No se encontró el archivo solicitado.");
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 5500;
  const server = createServer();
  server.on("error", err => {
    console.error(err.code === "EADDRINUSE"
      ? `El puerto ${port} ya está en uso. Abre http://localhost:${port} o detén la vista previa anterior.`
      : err.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => console.log(`CERI · Vista previa en http://localhost:${port}\nBiblioteca: http://localhost:${port}/analisis.html\nPanel editorial: http://localhost:${port}/admin/\nCtrl + C para detener.`));
}
module.exports = { createServer };
