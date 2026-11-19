const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("./servidor");
const model = require("../admin/model");
const Permisos = require("../admin/permisos");
const Colecciones = require("../admin/colecciones");

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1kAAAAASUVORK5CYII=",
  "base64"
);
const CLAVE_ADMIN = "una-clave-de-prueba";

/* Crea un proyecto temporal con contenido mínimo y arranca el servidor en un puerto libre. */
async function proyecto(t, { items = [], dataDir = null, archivos = {} } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ceri-test-"));
  await fs.mkdir(path.join(root, "contenido"), { recursive: true });
  await fs.mkdir(path.join(root, "assets", "img", "editorial"), { recursive: true });
  await fs.mkdir(path.join(root, "herramientas"), { recursive: true });
  await fs.writeFile(path.join(root, "assets", "img", "editorial", "foto.png"), PIXEL);
  await fs.writeFile(path.join(root, "contenido", "publicaciones.json"), JSON.stringify({ items }));
  await fs.writeFile(path.join(root, "contenido", "eventos.json"), JSON.stringify({ items: [] }));
  await fs.writeFile(
    path.join(root, "contenido", "sitio.json"),
    JSON.stringify({ nombre: "CERI", correo: "correo@ceri-unt.org" })
  );
  const html = titulo =>
    `<!DOCTYPE html><html><head><title>${titulo}</title><meta name="description" content="Descripción"></head><body></body></html>`;
  await fs.writeFile(path.join(root, "index.html"), html("Inicio"));
  await fs.writeFile(path.join(root, "articulo.html"), html("Artículo"));
  await fs.writeFile(path.join(root, "404.html"), html("No encontrada"));
  await fs.writeFile(path.join(root, "package.json"), "{}");
  await fs.writeFile(path.join(root, "herramientas", "servidor.js"), "// código");
  for (const [nombre, contenido] of Object.entries(archivos)) {
    await fs.mkdir(path.dirname(path.join(root, nombre)), { recursive: true });
    await fs.writeFile(path.join(root, nombre), contenido);
  }
  let server;
  const ctx = { root, dataDir: dataDir ? path.join(root, dataDir) : root };
  ctx.arrancar = async () => {
    server = createServer({ root, dataDir: ctx.dataDir, publicUrl: "", trustProxy: false, adminOrigin: "" });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    await server.listo;
    ctx.base = "http://127.0.0.1:" + server.address().port;
  };
  ctx.detener = () => new Promise(resolve => server.close(resolve));
  await ctx.arrancar();
  t.after(async () => {
    await ctx.detener();
    await fs.rm(root, { recursive: true, force: true });
  });
  return ctx;
}

/* Cliente con su propia cookie y token CSRF: representa a una persona del equipo. */
function cliente(ctx) {
  const c = { cookie: "", csrf: "" };
  c.pedir = async (ruta, { method = "GET", data, headers = {}, raw } = {}) => {
    const response = await fetch(ctx.base + "/api/admin/" + ruta, {
      method,
      headers: {
        ...(method !== "GET" ? { Origin: ctx.base, "X-CSRF-Token": c.csrf } : {}),
        ...(c.cookie ? { Cookie: c.cookie } : {}),
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      body: raw || (data && JSON.stringify(data))
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) c.cookie = setCookie.split(";")[0];
    const body = await response.json();
    if (body.csrfToken) c.csrf = body.csrfToken;
    return { status: response.status, body, setCookie };
  };
  c.entrar = async (usuario, password) => c.pedir("login", { method: "POST", data: { usuario, password } });
  return c;
}

async function configurarAdmin(ctx) {
  const admin = cliente(ctx);
  const r = await admin.pedir("setup", {
    method: "POST",
    data: { usuario: "presidencia", nombre: "Presidencia", password: CLAVE_ADMIN }
  });
  assert.equal(r.status, 201);
  return admin;
}

/* El admin crea una cuenta; la persona entra con la clave temporal y define la suya. */
async function crearMiembro(ctx, admin, usuario, rol) {
  const creado = await admin.pedir("usuarios", {
    method: "POST",
    data: { usuario, nombre: "Persona " + usuario, rol }
  });
  assert.equal(creado.status, 201, JSON.stringify(creado.body));
  const persona = cliente(ctx);
  const login = await persona.entrar(usuario, creado.body.passwordTemporal);
  assert.equal(login.status, 200);
  assert.equal(login.body.usuario.debeCambiar, true);
  assert.equal(
    (await persona.pedir("publicaciones")).status,
    403,
    "Debe cambiar la clave temporal antes de trabajar."
  );
  const cambio = await persona.pedir("cuenta/password", {
    method: "POST",
    data: { actual: creado.body.passwordTemporal, nueva: "clave-personal-" + usuario.length + "-segura" }
  });
  assert.equal(cambio.status, 200);
  persona.id = creado.body.usuario.id;
  return persona;
}

function informePublicable(id, imagen = "assets/img/editorial/foto.png") {
  const p = model.createReport("02");
  Object.assign(p, {
    id,
    titulo: "Informe " + id,
    autor: "Equipo",
    resumen: "Un resumen suficientemente claro para publicar."
  });
  p.editorial.paginas[0] = { tipo: "portada", titulo: p.titulo, imagen, alt: "Foto de prueba" };
  p.editorial.paginas[1] = {
    tipo: "interior",
    titulo: "Análisis",
    bloques: [
      { tipo: "parrafo", texto: "Texto." },
      { tipo: "fuentes", items: [{ nombre: "Fuente", url: "https://example.org" }] }
    ]
  };
  return p;
}

async function guardar(persona, p, originalId = null) {
  const { body } = await persona.pedir("publicaciones");
  return persona.pedir("publicaciones", {
    method: "POST",
    data: { publication: p, originalId, revision: body.revision }
  });
}

test("Configuración inicial, sesiones persistentes, borradores privados y conflictos", async t => {
  const original = informePublicable("archivo-original");
  original.estado = "publicado";
  const borrador = model.createReport();
  Object.assign(borrador, { id: "borrador-antiguo", titulo: "Borrador antiguo" });
  const ctx = await proyecto(t, { items: [original, borrador] });

  // El archivo público ya no contiene borradores: pasan al almacén privado.
  const publico = JSON.parse(
    await fs.readFile(path.join(ctx.root, "contenido", "publicaciones.json"), "utf8")
  );
  assert.deepEqual(
    publico.items.map(p => p.id),
    ["archivo-original"]
  );

  const anonimo = cliente(ctx);
  assert.equal((await anonimo.pedir("publicaciones")).status, 401);
  assert.equal((await anonimo.pedir("session")).body.configured, false);
  assert.equal(
    (
      await anonimo.pedir("setup", {
        method: "POST",
        data: { usuario: "x", password: CLAVE_ADMIN },
        headers: { Origin: "https://otro.example" }
      })
    ).status,
    403
  );
  assert.equal(
    (
      await anonimo.pedir("setup", {
        method: "POST",
        data: { usuario: "presidencia", nombre: "P", password: "corta" }
      })
    ).status,
    422
  );
  const admin = cliente(ctx);
  const setup = await admin.pedir("setup", {
    method: "POST",
    data: { usuario: "presidencia", nombre: "Presidencia", password: CLAVE_ADMIN }
  });
  assert.equal(setup.status, 201);
  assert.match(setup.setCookie, /HttpOnly/);
  assert.match(setup.setCookie, /SameSite=Strict/);
  assert.equal(setup.body.usuario.rol, "admin");
  assert.equal(
    (
      await anonimo.pedir("setup", {
        method: "POST",
        data: { usuario: "otra", nombre: "Otra", password: "otra-clave-de-prueba" }
      })
    ).status,
    409
  );
  const guardadas = await fs.readFile(path.join(ctx.root, ".ceri", "usuarios.json"), "utf8");
  assert.ok(!guardadas.includes(CLAVE_ADMIN), "La contraseña no se guarda en texto plano.");

  const inicial = await admin.pedir("publicaciones");
  assert.equal(inicial.body.items.length, 2);
  const p = model.createReport("03");
  Object.assign(p, { id: "nuevo-informe", titulo: "Un nuevo informe de prueba" });
  const cuerpo = { publication: p, revision: inicial.body.revision, originalId: null };
  assert.equal(
    (
      await admin.pedir("publicaciones", {
        method: "POST",
        data: cuerpo,
        headers: { "X-CSRF-Token": "incorrecto" }
      })
    ).status,
    403
  );
  assert.equal(
    (
      await admin.pedir("publicaciones", {
        method: "POST",
        data: cuerpo,
        headers: { Origin: "https://otro.example" }
      })
    ).status,
    403
  );
  assert.equal(
    (await admin.pedir("publicaciones", { method: "POST", data: { ...cuerpo, revision: undefined } })).status,
    400
  );
  const guardado = await admin.pedir("publicaciones", { method: "POST", data: cuerpo });
  assert.equal(guardado.status, 200);
  assert.equal(guardado.body.publication.meta.creadoPorNombre, "Presidencia");
  const web = await fetch(ctx.base + "/contenido/publicaciones.json").then(r => r.json());
  assert.equal(web.items.length, 1, "Los borradores no aparecen en los datos públicos.");
  assert.ok(!JSON.stringify(web).includes("creadoPor"), "Los datos internos no se publican.");
  for (const alias of [
    "/contenido//publicaciones.json",
    "/CONTENIDO/PUBLICACIONES.JSON",
    "/contenido%5cpublicaciones.json"
  ]) {
    const r = await fetch(ctx.base + alias);
    if (r.ok) assert.equal((await r.json()).items.length, 1);
    else assert.equal(r.status, 404);
  }
  assert.equal(
    (await admin.pedir("publicaciones", { method: "POST", data: cuerpo })).status,
    409,
    "Una versión antigua no sobrescribe."
  );

  const concurrentes = await Promise.all(
    [1, 2].map(i =>
      admin.pedir("publicaciones", {
        method: "POST",
        data: {
          publication: { ...p, titulo: "Concurrente " + i },
          originalId: p.id,
          revision: guardado.body.revision
        }
      })
    )
  );
  assert.deepEqual(concurrentes.map(x => x.status).sort(), [200, 409]);

  // Las sesiones sobreviven a un reinicio del servidor.
  await ctx.detener();
  await ctx.arrancar();
  assert.equal((await admin.pedir("publicaciones")).status, 200, "La sesión persiste tras reiniciar.");
  await admin.pedir("logout", { method: "POST", data: {} });
  assert.equal((await admin.pedir("publicaciones")).status, 401);
  assert.equal((await admin.entrar("presidencia", "incorrecta")).status, 401);
  assert.equal(
    (await admin.entrar("PRESIDENCIA", CLAVE_ADMIN)).status,
    200,
    "El usuario no distingue mayúsculas."
  );
  assert.ok((await fs.readdir(path.join(ctx.root, ".ceri", "backups"))).length >= 2);
});

test("Roles: autor, revisor, editor y administración tienen permisos distintos", async t => {
  const ctx = await proyecto(t);
  const admin = await configurarAdmin(ctx);
  const autor = await crearMiembro(ctx, admin, "autora", "autor");
  const otroAutor = await crearMiembro(ctx, admin, "autor2", "autor");
  const revisor = await crearMiembro(ctx, admin, "revisor", "revisor");
  const editor = await crearMiembro(ctx, admin, "editora", "editor");

  // Autor: crea un borrador, no puede publicar, sí enviarlo a revisión, no puede firmar como revisor.
  const p = informePublicable("informe-autora");
  p.revisadoPor = "Yo mismo";
  assert.equal((await guardar(autor, p)).status, 200);
  p.estado = "publicado";
  assert.equal((await guardar(autor, p, p.id)).status, 403);
  p.estado = "revision";
  const enRevision = await guardar(autor, p, p.id);
  assert.equal(enRevision.status, 200);
  assert.equal(enRevision.body.publication.revisadoPor, "", "Un autor no puede firmar como revisor.");
  assert.equal(
    (await guardar(otroAutor, { ...p, titulo: "Cambio ajeno" }, p.id)).status,
    403,
    "Un autor no edita lo de otros."
  );

  // Revisor: corrige y firma, pero no publica.
  const revisado = await guardar(revisor, { ...p, revisadoPor: "Persona revisor" }, p.id);
  assert.equal(revisado.status, 200);
  assert.equal(revisado.body.publication.revisadoPor, "Persona revisor");
  assert.equal(
    revisado.body.publication.meta.creadoPorNombre,
    "Persona autora",
    "Se conserva quién lo creó."
  );
  assert.equal(
    (await guardar(revisor, { ...revisado.body.publication, estado: "publicado" }, p.id)).status,
    403
  );

  // Editor: publica. Después, ni el autor ni el revisor pueden modificarlo.
  const publicado = await guardar(editor, { ...revisado.body.publication, estado: "publicado" }, p.id);
  assert.equal(publicado.status, 200);
  assert.equal(publicado.body.publication.meta.publicadoPorNombre, "Persona editora");
  assert.equal((await guardar(autor, { ...publicado.body.publication, titulo: "Otro" }, p.id)).status, 403);
  assert.equal(
    (await guardar(revisor, { ...publicado.body.publication, estado: "borrador" }, p.id)).status,
    403
  );

  // Eliminar: solo edición y administración.
  const { body } = await autor.pedir("publicaciones");
  assert.equal(
    (
      await autor.pedir("publicaciones/eliminar", {
        method: "POST",
        data: { id: p.id, revision: body.revision }
      })
    ).status,
    403
  );
  assert.equal(
    (
      await editor.pedir("publicaciones/eliminar", {
        method: "POST",
        data: { id: p.id, revision: body.revision }
      })
    ).status,
    200
  );

  // Contenido del sitio y cuentas.
  assert.equal((await autor.pedir("contenido/eventos")).status, 403);
  assert.equal((await editor.pedir("contenido/eventos")).status, 200);
  assert.equal(
    (await editor.pedir("contenido/sitio")).status,
    403,
    "Los datos institucionales son de administración."
  );
  assert.equal((await admin.pedir("contenido/sitio")).status, 200);
  assert.equal((await editor.pedir("usuarios")).status, 403);
  assert.equal((await revisor.pedir("auditoria")).status, 403);
  assert.equal((await admin.pedir("auditoria")).status, 200);
  const sesion = await editor.pedir("session");
  assert.deepEqual(sesion.body.permisos, Permisos.permisosDe({ rol: "editor" }));

  // Cambiar el rol o desactivar una cuenta cierra sus sesiones.
  assert.equal(
    (await admin.pedir("usuarios/actualizar", { method: "POST", data: { id: editor.id, activo: false } }))
      .status,
    200
  );
  assert.equal((await editor.pedir("publicaciones")).status, 401);
  assert.equal(
    (await editor.entrar("editora", "clave-personal-7-segura")).status,
    401,
    "Una cuenta desactivada no entra."
  );

  // No se puede dejar el sistema sin administración.
  const yo = (await admin.pedir("session")).body.usuario;
  assert.equal(
    (await admin.pedir("usuarios/actualizar", { method: "POST", data: { id: yo.id, rol: "editor" } })).status,
    409
  );
  assert.equal((await admin.pedir("usuarios/eliminar", { method: "POST", data: { id: yo.id } })).status, 409);

  // Restablecer la contraseña entrega una temporal y obliga a cambiarla.
  const reset = await admin.pedir("usuarios/restablecer", { method: "POST", data: { id: autor.id } });
  assert.equal(reset.status, 200);
  assert.equal((await autor.pedir("publicaciones")).status, 401, "La sesión anterior se cierra.");
  assert.equal((await autor.entrar("autora", reset.body.passwordTemporal)).body.usuario.debeCambiar, true);
  assert.equal(
    (
      await admin.pedir("usuarios", {
        method: "POST",
        data: { usuario: "autora", nombre: "Duplicada", rol: "autor" }
      })
    ).status,
    409
  );
  assert.equal(
    (await admin.pedir("usuarios", { method: "POST", data: { usuario: "x y", nombre: "Mal", rol: "autor" } }))
      .status,
    422
  );
  assert.equal(
    (
      await admin.pedir("usuarios", {
        method: "POST",
        data: { usuario: "nuevo", nombre: "Mal", rol: "dueño" }
      })
    ).status,
    422
  );
});

test("El acceso se bloquea tras varios intentos fallidos", async t => {
  const ctx = await proyecto(t);
  await configurarAdmin(ctx);
  const atacante = cliente(ctx);
  for (let i = 0; i < 5; i++)
    assert.equal((await atacante.entrar("presidencia", "no-es-la-clave")).status, 401);
  assert.equal(
    (await atacante.entrar("presidencia", CLAVE_ADMIN)).status,
    429,
    "La cuenta queda bloqueada temporalmente."
  );
  assert.equal(
    (await atacante.entrar("inexistente", "no-es-la-clave")).status,
    401,
    "No revela si la cuenta existe."
  );
});

test("La cuenta compartida anterior se convierte en la cuenta «admin»", async t => {
  const crypto = require("node:crypto");
  const salt = "abc123";
  const hash = crypto.scryptSync("clave-antigua-123", salt, 64).toString("hex");
  const ctx = await proyecto(t, { archivos: { ".ceri/admin.json": JSON.stringify({ salt, hash }) } });
  const persona = cliente(ctx);
  assert.equal((await persona.pedir("session")).body.configured, true);
  const login = await persona.entrar("admin", "clave-antigua-123");
  assert.equal(login.status, 200);
  assert.equal(login.body.usuario.rol, "admin");
});

test("Contacto: guarda mensajes válidos, rechaza abusos y solo edición los lee", async t => {
  const ctx = await proyecto(t);
  const admin = await configurarAdmin(ctx);
  const autor = await crearMiembro(ctx, admin, "autora", "autor");
  const enviar = (data, origin = ctx.base) =>
    fetch(ctx.base + "/api/contacto", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(data)
    });
  const valido = {
    nombre: "Ana",
    correo: "ana@example.org",
    motivo: "Consulta",
    mensaje: "Hola, quisiera más información."
  };
  assert.equal((await enviar(valido)).status, 201);
  assert.equal((await enviar({ ...valido, correo: "no-es-correo" })).status, 422);
  assert.equal((await enviar(valido, "https://spam.example")).status, 403);
  assert.equal(
    (await enviar({ ...valido, empresa: "robot" })).status,
    200,
    "El campo trampa no guarda nada."
  );
  const lista = await admin.pedir("mensajes");
  assert.equal(lista.body.mensajes.length, 1);
  assert.equal(lista.body.mensajes[0].nombre, "Ana");
  assert.equal((await autor.pedir("mensajes")).status, 403);
  assert.equal((await admin.pedir("resumen")).body.mensajesNoLeidos, 1);
  await admin.pedir("mensajes/estado", {
    method: "POST",
    data: { id: lista.body.mensajes[0].id, leido: true }
  });
  assert.equal((await admin.pedir("resumen")).body.mensajesNoLeidos, 0);
  for (let i = 0; i < 5; i++) await enviar(valido);
  assert.equal((await enviar(valido)).status, 429, "Hay un límite de mensajes por hora.");
});

test("Imágenes: valida el tipo y solo elimina las subidas que no se usan", async t => {
  const ctx = await proyecto(t);
  const admin = await configurarAdmin(ctx);
  const autor = await crearMiembro(ctx, admin, "autora", "autor");
  const subir = (persona, bytes, nombre = "foto.png") =>
    persona.pedir("media", {
      method: "POST",
      raw: bytes,
      headers: { "Content-Type": "image/png", "X-File-Name": encodeURIComponent(nombre) }
    });
  assert.equal((await subir(autor, Buffer.from("<script>alert(1)</script>"))).status, 415);
  const usada = await subir(autor, PIXEL, "../../usada.png");
  assert.equal(usada.status, 201);
  assert.match(usada.body.path, /^assets\/img\/subidas\/usada-[a-f0-9]+\.png$/);
  const r = await fetch(ctx.base + "/" + usada.body.path);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /immutable/);
  const libre = await subir(autor, PIXEL, "libre.png");
  assert.equal((await guardar(admin, informePublicable("con-foto", usada.body.path))).status, 200);
  const media = (await admin.pedir("media")).body.items;
  assert.deepEqual(media.find(m => m.path === usada.body.path).enUso, ["Informe con-foto"]);
  assert.equal(
    (await autor.pedir("media/eliminar", { method: "POST", data: { path: libre.body.path } })).status,
    403
  );
  assert.equal(
    (await admin.pedir("media/eliminar", { method: "POST", data: { path: usada.body.path } })).status,
    409
  );
  assert.equal(
    (await admin.pedir("media/eliminar", { method: "POST", data: { path: "assets/img/editorial/foto.png" } }))
      .status,
    422
  );
  assert.equal(
    (await admin.pedir("media/eliminar", { method: "POST", data: { path: libre.body.path } })).status,
    200
  );
  assert.equal((await fetch(ctx.base + "/" + libre.body.path)).status, 404);
});

test("Contenido del sitio: valida, limpia campos y se puede restaurar desde un respaldo", async t => {
  const ctx = await proyecto(t);
  const admin = await configurarAdmin(ctx);
  const leer = async () => (await admin.pedir("contenido/eventos")).body;
  const evento = {
    ...Colecciones.nuevoElemento("eventos"),
    titulo: "Foro",
    fecha: "2026-12-01",
    campoExtra: "<script>"
  };
  let actual = await leer();
  const malo = await admin.pedir("contenido/eventos", {
    method: "POST",
    data: { revision: actual.revision, datos: { items: [{ ...evento, enlace: "javascript:alert(1)" }] } }
  });
  assert.equal(malo.status, 422);
  const bueno = await admin.pedir("contenido/eventos", {
    method: "POST",
    data: { revision: actual.revision, datos: { items: [evento] } }
  });
  assert.equal(bueno.status, 200);
  assert.equal(bueno.body.datos.items[0].campoExtra, undefined, "Los campos desconocidos se descartan.");
  assert.equal(
    (
      await admin.pedir("contenido/eventos", {
        method: "POST",
        data: { revision: actual.revision, datos: { items: [] } }
      })
    ).status,
    409
  );
  const publico = await fetch(ctx.base + "/contenido/eventos.json").then(r => r.json());
  assert.equal(publico.items[0].titulo, "Foro");
  actual = await leer();
  await admin.pedir("contenido/eventos", {
    method: "POST",
    data: { revision: actual.revision, datos: { items: [] } }
  });
  const respaldos = (await admin.pedir("respaldos")).body.respaldos.filter(r => r.coleccion === "eventos");
  const conForo = respaldos.find(r => r.nombre && r.tamano > 20);
  assert.ok(conForo);
  assert.equal(
    (await admin.pedir("respaldos/restaurar", { method: "POST", data: { nombre: "../../etc" } })).status,
    404
  );
  assert.equal(
    (await admin.pedir("respaldos/restaurar", { method: "POST", data: { nombre: conForo.nombre } })).status,
    200
  );
  assert.equal((await leer()).datos.items[0].titulo, "Foro");
});

test("El servidor solo expone archivos públicos y añade cabeceras de seguridad y metadatos", async t => {
  const p = informePublicable("brasil");
  p.estado = "publicado";
  const ctx = await proyecto(t, { items: [p] });
  for (const ruta of [
    "/herramientas/servidor.js",
    "/package.json",
    "/.ceri/usuarios.json",
    "/README.md",
    "/admin/../package.json"
  ])
    assert.equal((await fetch(ctx.base + ruta)).status, 404, ruta);
  const inicio = await fetch(ctx.base + "/");
  assert.equal(inicio.status, 200);
  assert.match(inicio.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(inicio.headers.get("x-frame-options"), "DENY");
  const articulo = await (await fetch(ctx.base + "/articulo.html?id=brasil")).text();
  assert.match(articulo, /<title>Informe brasil \| CERI · UNT<\/title>/);
  assert.match(articulo, /og:image" content="http:\/\/127\.0\.0\.1:\d+\/assets\/img\/editorial\/foto\.png"/);
  assert.match(articulo, /application\/ld\+json/);
  assert.equal((articulo.match(/name="description"/g) || []).length, 1);
  const robots = await (await fetch(ctx.base + "/robots.txt")).text();
  assert.match(robots, /Disallow: \/admin\//);
  const sitemap = await (await fetch(ctx.base + "/sitemap.xml")).text();
  assert.match(sitemap, /articulo\.html\?id=brasil/);
  const faltante = await fetch(ctx.base + "/no-existe.html");
  assert.equal(faltante.status, 404);
  assert.match(await faltante.text(), /No encontrada/);
  assert.equal((await fetch(ctx.base + "/api/salud")).status, 200);
  const etag = inicio.headers.get("etag");
  assert.equal((await fetch(ctx.base + "/", { headers: { "If-None-Match": etag } })).status, 304);
});

test("Con una carpeta de datos aparte, se copia el contenido inicial", async t => {
  const borrador = model.createReport();
  Object.assign(borrador, { id: "borrador", titulo: "Borrador privado" });
  const ctx = await proyecto(t, { items: [borrador], dataDir: "datos-persistentes" });
  const copia = JSON.parse(await fs.readFile(path.join(ctx.dataDir, "contenido", "eventos.json"), "utf8"));
  assert.deepEqual(copia, { items: [] });
  const privadas = JSON.parse(
    await fs.readFile(path.join(ctx.dataDir, ".ceri", "publicaciones.json"), "utf8")
  );
  assert.equal(privadas.items[0].id, "borrador");
  assert.equal((await fetch(ctx.base + "/contenido/publicaciones.json").then(r => r.json())).items.length, 0);
});

test("El modelo permite borradores, exige páginas completas y admite notas", () => {
  const p = model.createReport();
  Object.assign(p, { id: "borrador-prueba", titulo: "Mi primer informe" });
  assert.equal(model.validate(p, false).errors.length, 0);
  const issues = model.validate(p, true).errors;
  assert.ok(issues.some(x => x.step === 1));
  assert.ok(issues.some(x => x.step === 2));
  assert.ok(issues.some(x => x.message.includes("autor")));
  assert.equal(
    model.validate({ ...p, fuentes: [{ nombre: "X", url: "javascript:alert(1)" }] }, false).errors.length,
    1
  );

  const nota = model.createNote();
  Object.assign(nota, {
    id: "nota",
    titulo: "Una nota breve",
    autor: "Equipo",
    resumen: "Resumen de la nota de coyuntura."
  });
  assert.equal(model.validate(nota, false).errors.length, 0);
  assert.ok(model.validate(nota, true).errors.some(x => x.message.includes("200")));
  nota.desarrollo = "Análisis ".repeat(40);
  nota.fuentes = [{ nombre: "Fuente", url: "https://example.org" }];
  assert.equal(model.validate(nota, true).errors.length, 0);
});

test("Permisos y esquemas son coherentes", () => {
  assert.ok(Permisos.puede({ rol: "admin" }, "usuarios.gestionar"));
  assert.ok(!Permisos.puede({ rol: "editor" }, "usuarios.gestionar"));
  assert.ok(!Permisos.puede({ rol: "admin", activo: false }, "informes.crear"));
  assert.ok(
    !Permisos.puedeEditarInforme({ id: "a", rol: "autor" }, { estado: "borrador", meta: { creadoPor: "b" } })
  );
  assert.ok(
    Permisos.puedeEditarInforme({ id: "a", rol: "autor" }, { estado: "revision", meta: { creadoPor: "a" } })
  );
  for (const def of Object.values(Colecciones.COLECCIONES))
    assert.ok(Permisos.PERMISOS[def.permiso], def.titulo);
  assert.equal(Colecciones.validar("sitio", { nombre: "CERI", correo: "malo" }).errores.length, 1);
  assert.equal(
    Colecciones.validar("equipo", { items: [{ nombre: "Ana", cargo: "Presidenta" }] }).errores.length,
    0
  );
});
