/* Servidor del CERI: sitio público, estudio editorial y API.
   Sin dependencias externas. Funciona igual en la computadora del proyecto y en un alojamiento. */
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { leerConfig } = require("./config.js");
const { crearAlmacen } = require("./almacen.js");
const { crearAdminApi, crearRed, send } = require("./admin-api.js");
const { crearContacto } = require("./contacto.js");

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json"
};
const COMPRIMIBLE = /^(text\/|application\/(json|manifest\+json)|image\/svg\+xml)/;
const PAGINAS_SITEMAP = [
  "index.html",
  "analisis.html",
  "eventos.html",
  "participacion.html",
  "alianzas.html",
  "nosotros.html",
  "convocatoria.html",
  "contacto.html"
];

const CSP_PUBLICA =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; " +
  "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
const CSP_ADMIN =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; " +
  "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

const escAttr = v =>
  String(v ?? "").replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
const escXml = escAttr;

function createServer(options = {}) {
  const cfg = leerConfig(options);
  const almacen = crearAlmacen(cfg);
  const red = crearRed(cfg);
  const adminApi = crearAdminApi(cfg, almacen);
  const contacto = crearContacto(almacen, red);
  const listo = almacen.iniciar();

  /* Solo se sirven estas rutas. El código del servidor, los archivos privados y la configuración no. */
  const REGLAS = [
    [/^\/[a-z0-9-]+\.html$/, cfg.root],
    [/^\/(favicon\.svg|favicon\.ico|apple-touch-icon\.png|site\.webmanifest)$/, cfg.root],
    [/^\/css\/[a-z0-9-]+\.css$/, cfg.root],
    [/^\/js\/[a-z0-9-]+\.js$/, cfg.root],
    [/^\/admin\/(index\.html|[a-z0-9-]+\.(js|css))$/, cfg.root],
    [/^\/contenido\/[a-z]+\.json$/, cfg.dataDir],
    [/^\/assets\/img\/subidas\/[a-z0-9-]+\.(png|jpg|webp|gif)$/, cfg.dataDir],
    [/^\/assets\/(?!img\/subidas\/)[a-zA-Z0-9_\/() .-]+\.(png|jpe?g|webp|gif|svg|ico)$/, cfg.root]
  ];
  function resolver(pathname) {
    if (pathname === "/") pathname = "/index.html";
    if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin/index.html";
    if (/\.\.|\\|\0|\/\//.test(pathname)) return null;
    const regla = REGLAS.find(([patron]) => patron.test(pathname));
    if (!regla) return null;
    const base = regla[1];
    const file = path.resolve(base, "." + pathname);
    if (!file.startsWith(path.resolve(base) + path.sep)) return null;
    return { file, pathname };
  }

  const baseUrl = req =>
    cfg.publicUrl || `${red.esHttps(req) ? "https" : "http"}://${req.headers.host || "localhost"}`;
  const absoluta = (req, ruta) =>
    /^https:\/\//i.test(ruta) ? ruta : `${baseUrl(req)}/${String(ruta).replace(/^\//, "")}`;

  /* Etiquetas para buscadores y para la vista previa al compartir en WhatsApp, Facebook o X. */
  async function aplicarMeta(req, html, pathname, params) {
    const pagina = pathname.slice(1);
    let titulo = (/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "CERI · UNT";
    let descripcion = (/<meta name="description" content="([^"]*)"/i.exec(html) || [])[1] || "";
    let canonica = `${baseUrl(req)}/${pagina === "index.html" ? "" : pagina}`;
    let imagen = absoluta(req, "assets/img/og-ceri.png");
    let imagenAlt = "Círculo de Estudios de Relaciones Internacionales · UNT";
    let tipo = "website";
    let jsonLd = "";
    const id =
      pagina === "articulo.html"
        ? params.get("id")
        : pagina === "analisis.html"
          ? params.get("edicion")
          : null;
    if (id) {
      const p = (await almacen.publicaciones.publicas()).find(x => x.id === id);
      if (p) {
        titulo = `${escAttr(p.titulo)} | CERI · UNT`;
        descripcion = escAttr(p.resumen || p.subtitulo || "");
        canonica = `${baseUrl(req)}/articulo.html?id=${encodeURIComponent(p.id)}`;
        const portada = p.editorial?.paginas?.[0]?.imagen || p.imagen;
        if (portada) {
          imagen = absoluta(req, portada);
          imagenAlt = p.editorial?.paginas?.[0]?.alt || p.imagenAlt || p.titulo;
        }
        tipo = "article";
        const datos = {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: p.titulo,
          description: p.resumen || p.subtitulo || "",
          datePublished: p.fecha,
          dateModified: p.actualizado || p.fecha,
          author: { "@type": "Organization", name: p.autor || "CERI · UNT" },
          publisher: {
            "@type": "Organization",
            name: "Círculo de Estudios de Relaciones Internacionales · UNT"
          },
          image: imagen,
          mainEntityOfPage: canonica,
          inLanguage: "es"
        };
        jsonLd = `<script type="application/ld+json">${JSON.stringify(datos).replace(/</g, "\\u003c")}</script>`;
      }
    }
    const etiquetas = [
      `<link rel="canonical" href="${escAttr(canonica)}">`,
      `<meta name="description" content="${descripcion}">`,
      `<meta property="og:type" content="${tipo}">`,
      `<meta property="og:site_name" content="CERI · Universidad Nacional de Trujillo">`,
      `<meta property="og:locale" content="es_PE">`,
      `<meta property="og:title" content="${titulo.replace(/ \| .*$/, "")}">`,
      `<meta property="og:description" content="${descripcion}">`,
      `<meta property="og:url" content="${escAttr(canonica)}">`,
      `<meta property="og:image" content="${escAttr(imagen)}">`,
      `<meta property="og:image:alt" content="${escAttr(imagenAlt)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      jsonLd
    ].join("\n  ");
    return html
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${titulo}</title>`)
      .replace(/\s*<meta (name="description"|property="og:[a-z:_]+"|name="twitter:[a-z]+")[^>]*>/gi, "")
      .replace(/\s*<link rel="canonical"[^>]*>/gi, "")
      .replace(/<\/head>/i, `  ${etiquetas}\n</head>`);
  }

  async function sitemap(req) {
    const urls = PAGINAS_SITEMAP.map(p => ({ loc: `${baseUrl(req)}/${p === "index.html" ? "" : p}` }));
    for (const p of await almacen.publicaciones.publicas())
      urls.push({
        loc: `${baseUrl(req)}/articulo.html?id=${encodeURIComponent(p.id)}`,
        lastmod: p.actualizado || p.fecha
      });
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls
        .map(
          u =>
            `  <url><loc>${escXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${escXml(u.lastmod)}</lastmod>` : ""}</url>`
        )
        .join("\n") +
      "\n</urlset>\n"
    );
  }

  function seguridad(req, res, tipo, esAdmin) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", esAdmin ? "same-origin" : "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (tipo === "text/html") res.setHeader("Content-Security-Policy", esAdmin ? CSP_ADMIN : CSP_PUBLICA);
    if (esAdmin) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (red.esHttps(req)) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  function responder(req, res, status, tipo, cuerpo, cache = "no-cache") {
    const etag = `"${crypto.createHash("sha1").update(cuerpo).digest("base64url")}"`;
    const cabeceras = {
      "Content-Type":
        tipo + (/^(text\/|application\/(json|manifest)|image\/svg)/.test(tipo) ? "; charset=utf-8" : ""),
      "Cache-Control": cache,
      ETag: etag,
      Vary: "Accept-Encoding"
    };
    if (status === 200 && req.headers["if-none-match"] === etag) {
      res.writeHead(304, cabeceras);
      return res.end();
    }
    if (
      cuerpo.length > 1024 &&
      COMPRIMIBLE.test(tipo) &&
      /\bgzip\b/.test(req.headers["accept-encoding"] || "")
    ) {
      cuerpo = zlib.gzipSync(cuerpo);
      cabeceras["Content-Encoding"] = "gzip";
    }
    cabeceras["Content-Length"] = cuerpo.length;
    res.writeHead(status, cabeceras);
    res.end(req.method === "HEAD" ? undefined : cuerpo);
  }

  async function noEncontrado(req, res) {
    seguridad(req, res, "text/html", false);
    const html = await fs
      .readFile(path.join(cfg.root, "404.html"))
      .catch(() => Buffer.from("No se encontró la página."));
    responder(req, res, 404, "text/html", html);
  }

  const server = http.createServer(async (req, res) => {
    try {
      await listo;
      let url;
      try {
        url = new URL(req.url, "http://localhost");
        url.pathname = decodeURIComponent(url.pathname);
      } catch {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Solicitud no válida.");
      }
      const pathname = url.pathname;
      if (pathname.startsWith("/api/")) {
        if (await adminApi(req, res, pathname)) return;
        if (pathname === "/api/contacto") return contacto(req, res);
        if (pathname === "/api/salud" && req.method === "GET") return send(res, 200, { ok: true });
        return send(res, 404, { error: "Esta ruta no existe." });
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, HEAD" });
        return res.end();
      }
      if (pathname === "/robots.txt") {
        seguridad(req, res, "text/plain", false);
        const texto = `User-agent: *\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`;
        return responder(req, res, 200, "text/plain", Buffer.from(texto));
      }
      if (pathname === "/sitemap.xml") {
        seguridad(req, res, "application/xml", false);
        return responder(req, res, 200, "application/xml", Buffer.from(await sitemap(req)));
      }
      const destino = resolver(pathname);
      if (!destino) return noEncontrado(req, res);
      let cuerpo;
      try {
        if (!(await fs.stat(destino.file)).isFile()) return noEncontrado(req, res);
        cuerpo = await fs.readFile(destino.file);
      } catch {
        return noEncontrado(req, res);
      }
      const tipo = MIME[path.extname(destino.file).toLowerCase()] || "application/octet-stream";
      const esAdmin = destino.pathname.startsWith("/admin/");
      seguridad(req, res, tipo, esAdmin);
      if (tipo === "text/html" && !esAdmin)
        cuerpo = Buffer.from(
          await aplicarMeta(req, cuerpo.toString("utf8"), destino.pathname, url.searchParams)
        );
      if (destino.pathname === "/contenido/publicaciones.json") {
        // Defensa adicional: aunque el archivo público ya solo contiene lo publicado.
        const datos = JSON.parse(cuerpo.toString("utf8"));
        cuerpo = Buffer.from(
          JSON.stringify({ items: (datos.items || []).filter(p => p.estado === "publicado") })
        );
      }
      const cache = destino.pathname.startsWith("/assets/img/subidas/")
        ? "public, max-age=31536000, immutable"
        : /^\/(assets\/|favicon|apple-touch)/.test(destino.pathname)
          ? "public, max-age=86400"
          : "no-cache";
      responder(req, res, 200, tipo, cuerpo, cache);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Ocurrió un error en el servidor.");
      }
    }
  });
  server.listo = listo;
  server.config = cfg;
  return server;
}

if (require.main === module) {
  const cfg = leerConfig();
  const server = createServer();
  server.on("error", err => {
    console.error(
      err.code === "EADDRINUSE"
        ? `El puerto ${cfg.port} ya está en uso. Abre http://localhost:${cfg.port} o detén la vista previa anterior.`
        : err.message
    );
    process.exitCode = 1;
  });
  server.listo
    .then(() => {
      server.listen(cfg.port, cfg.host, () => {
        const local = `http://localhost:${cfg.port}`;
        console.log(
          `CERI · Servidor en ${cfg.publicUrl || local}\nBiblioteca: ${local}/analisis.html\nEstudio editorial: ${local}/admin/\nCtrl + C para detener.`
        );
        if (cfg.produccion && !cfg.publicUrl)
          console.warn("AVISO: define CERI_PUBLIC_URL con la dirección pública (https://…).");
        if (cfg.produccion && !cfg.trustProxy)
          console.warn("AVISO: si hay un proxy HTTPS delante, define CERI_TRUST_PROXY=1.");
      });
    })
    .catch(error => {
      console.error("No se pudo preparar el almacenamiento:", error.message);
      process.exit(1);
    });
  const cerrar = () => server.close(() => process.exit(0));
  process.on("SIGTERM", cerrar);
  process.on("SIGINT", cerrar);
}

module.exports = { createServer };
