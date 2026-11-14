/* Vista previa local, sin instalaciones ni dependencias adicionales. */
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".json":"application/json", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".yml":"text/yaml" };

function createServer() {
  return http.createServer(async (req, res) => {
    if (!["GET","HEAD"].includes(req.method)) { res.writeHead(405); res.end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (pathname.split(/[\\/]/).some(segment => segment.startsWith(".") || segment.includes(":"))) {
        res.writeHead(403); res.end("Ruta no disponible"); return;
      }
      let file = path.resolve(ROOT, "." + pathname);
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
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
  server.listen(port, "127.0.0.1", () => console.log(`CERI · Vista previa en http://localhost:${port}\nBiblioteca: http://localhost:${port}/analisis.html\nCtrl + C para detener.`));
}
module.exports = { createServer };
