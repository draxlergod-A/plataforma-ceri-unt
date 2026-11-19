const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("./servidor");
const model = require("../admin/model");

test("El estudio guarda y publica una edición sin perder datos ni permitir escrituras anónimas", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ceri-admin-test-"));
  await fs.mkdir(path.join(root, "contenido"), { recursive: true });
  await fs.mkdir(path.join(root, "assets", "img", "subidas"), { recursive: true });
  const original = model.createReport();
  original.id = "archivo-original";
  original.titulo = "Edición anterior";
  original.estado = "publicado";
  original.autor = "Equipo de prueba";
  original.resumen = "Una edición existente que se debe conservar.";
  await fs.writeFile(
    path.join(root, "contenido", "publicaciones.json"),
    JSON.stringify({ items: [original] })
  );
  let server = createServer({ root });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let base = "http://127.0.0.1:" + server.address().port,
    cookie = "",
    csrf = "";
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  async function request(route, { method = "GET", data, headers = {}, anonymous = false, raw } = {}) {
    const response = await fetch(base + "/api/admin/" + route, {
      method,
      headers: {
        ...(method !== "GET" ? { Origin: base, "X-CSRF-Token": csrf } : {}),
        ...(!anonymous && cookie ? { Cookie: cookie } : {}),
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      body: raw || (data && JSON.stringify(data))
    });
    const body = await response.json();
    return { status: response.status, body, cookie: response.headers.get("set-cookie") };
  }
  assert.equal((await request("publicaciones", { anonymous: true })).status, 401);
  const session = await request("session");
  assert.equal(session.body.configured, false);
  assert.equal(
    (
      await request("setup", {
        method: "POST",
        data: { password: "una-clave-de-prueba" },
        headers: { Origin: "https://otro-sitio.example" }
      })
    ).status,
    403
  );
  const setup = await request("setup", { method: "POST", data: { password: "una-clave-de-prueba" } });
  assert.equal(setup.status, 201);
  assert.match(setup.cookie, /HttpOnly/);
  assert.match(setup.cookie, /SameSite=Strict/);
  cookie = setup.cookie.split(";")[0];
  csrf = setup.body.csrfToken;
  assert.equal(
    (await request("setup", { method: "POST", data: { password: "otra-clave-de-prueba" } })).status,
    409
  );
  const stored = await fs.readFile(path.join(root, ".ceri", "admin.json"), "utf8");
  assert.ok(!stored.includes("una-clave-de-prueba"));
  assert.equal((await fetch(base + "/.ceri/admin.json")).status, 403);
  const initial = await request("publicaciones");
  assert.equal(initial.body.items.length, 1);
  const p = model.createReport("02");
  p.id = "nuevo-informe";
  p.titulo = "Un nuevo informe de prueba";
  const saveBody = { publication: p, revision: initial.body.revision, originalId: null };
  assert.equal(
    (
      await request("publicaciones", {
        method: "POST",
        data: saveBody,
        headers: { "X-CSRF-Token": "incorrecto" }
      })
    ).status,
    403
  );
  assert.equal(
    (
      await request("publicaciones", {
        method: "POST",
        data: saveBody,
        headers: { Origin: "https://otro-sitio.example" }
      })
    ).status,
    403
  );
  const saved = await request("publicaciones", { method: "POST", data: saveBody });
  assert.equal(saved.status, 200);
  assert.equal(
    (await fetch(base + "/contenido/publicaciones.json").then(r => r.json())).items.length,
    1,
    "El borrador no aparece en los datos públicos."
  );
  for (const alias of [
    "/contenido//publicaciones.json",
    "/CONTENIDO/PUBLICACIONES.JSON",
    "/contenido%5cpublicaciones.json"
  ]) {
    const response = await fetch(base + alias);
    if (response.ok)
      assert.equal(
        (await response.json()).items.length,
        1,
        "Una ruta alternativa tampoco expone borradores."
      );
    else assert.equal(response.status, 404);
  }
  assert.equal(
    (await request("publicaciones", { method: "POST", data: saveBody })).status,
    409,
    "Una versión antigua no sobrescribe la colección."
  );
  const picture = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1kAAAAASUVORK5CYII=",
    "base64"
  );
  assert.equal(
    (
      await request("media", {
        method: "POST",
        raw: Buffer.from("<script>alert(1)</script>"),
        headers: { "Content-Type": "image/png" }
      })
    ).status,
    415
  );
  const uploaded = await request("media", {
    method: "POST",
    raw: picture,
    headers: { "Content-Type": "image/png", "X-File-Name": encodeURIComponent("../../imagen.png") }
  });
  assert.equal(uploaded.status, 201);
  assert.match(uploaded.body.path, /^assets\/img\/subidas\/imagen-[a-f0-9]+\.png$/);
  assert.equal((await fetch(base + "/" + uploaded.body.path)).status, 200);
  p.estado = "publicado";
  p.autor = "Equipo de prueba";
  p.resumen = "Un resumen suficientemente claro para publicar esta edición.";
  p.editorial.paginas[0].titulo = p.titulo;
  p.editorial.paginas[0].imagen = uploaded.body.path;
  p.editorial.paginas[0].alt = "Imagen de prueba";
  p.editorial.paginas[1] = {
    tipo: "interior",
    titulo: "Análisis",
    bloques: [
      { tipo: "parrafo", texto: "Texto del informe." },
      { tipo: "fuentes", items: [{ nombre: "Fuente de prueba", url: "https://example.org/referencia" }] }
    ]
  };
  const published = await request("publicaciones", {
    method: "POST",
    data: { publication: p, originalId: p.id, revision: saved.body.revision }
  });
  assert.equal(published.status, 200);
  const publicData = await fetch(base + "/contenido/publicaciones.json").then(r => r.json());
  assert.equal(publicData.items.length, 2);
  assert.equal(publicData.items.find(x => x.id === p.id).editorial.paginas.length, 2);
  const latest = await request("publicaciones");
  assert.deepEqual(
    latest.body.items.find(x => x.id === original.id),
    original,
    "La edición anterior se conserva completa."
  );
  assert.equal((await fs.readdir(path.join(root, ".ceri", "backups"))).length, 2);
  const malformed = { ...p, editorial: { paginas: [null] } };
  assert.equal(
    (
      await request("publicaciones", {
        method: "POST",
        data: { publication: malformed, originalId: p.id, revision: latest.body.revision }
      })
    ).status,
    422
  );
  const conflicts = await Promise.all(
    [1, 2].map(i =>
      request("publicaciones", {
        method: "POST",
        data: {
          publication: { ...p, titulo: "Edición concurrente " + i },
          originalId: p.id,
          revision: latest.body.revision
        }
      })
    )
  );
  assert.deepEqual(
    conflicts.map(x => x.status).sort(),
    [200, 409],
    "Solo una escritura con la misma versión puede prosperar."
  );
  assert.equal((await request("backup")).body.items.length, 2);
  await request("logout", { method: "POST", data: {} });
  assert.equal((await request("publicaciones")).status, 401);
  assert.equal((await request("login", { method: "POST", data: { password: "incorrecta" } })).status, 401);
  await new Promise(resolve => server.close(resolve));
  server = createServer({ root });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  const login = await request("login", { method: "POST", data: { password: "una-clave-de-prueba" } });
  assert.equal(login.status, 200, "La contraseña persiste después de reiniciar.");
});

test("El modelo permite borradores y exige páginas completas antes de publicar", () => {
  const p = model.createReport();
  p.id = "borrador-prueba";
  p.titulo = "Mi primer informe";
  assert.equal(model.validate(p, false).errors.length, 0);
  const issues = model.validate(p, true).errors;
  assert.ok(issues.some(x => x.step === 1));
  assert.ok(issues.some(x => x.step === 2));
  assert.ok(issues.some(x => x.message.includes("autor")));
  const original = model.clone(p);
  const duplicate = model.clone(p);
  duplicate.editorial.paginas[0].titulo = "Otra portada";
  assert.deepEqual(p, original, "Duplicar no cambia la edición original.");
});
