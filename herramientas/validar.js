/* =========================================================
   validar.js — REVISA QUE EL CONTENIDO ESTÉ BIEN
   Uso:  npm run validar
   Usa las mismas reglas que el estudio y el servidor: el modelo de
   publicaciones (admin/model.js) y los esquemas del sitio (admin/colecciones.js).
   Si existe el almacén privado (.ceri/publicaciones.json), revisa también los borradores.
   ========================================================= */
const fs = require("fs");
const path = require("path");
const model = require("../admin/model.js");
const Colecciones = require("../admin/colecciones.js");

const RAIZ = path.join(__dirname, "..");
const DATOS = path.resolve(process.env.CERI_DATA_DIR || RAIZ);
const errores = [];
const avisos = [];

function leer(archivo, etiqueta) {
  try {
    return JSON.parse(fs.readFileSync(archivo, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    errores.push(`${etiqueta} no es un JSON válido: ${e.message}`);
    return null;
  }
}

function existeImagen(ruta) {
  const limpia = String(ruta || "").replace(/^\//, "");
  if (!limpia.startsWith("assets/")) return true;
  const base = limpia.startsWith("assets/img/subidas/") ? DATOS : RAIZ;
  return fs.existsSync(path.join(base, limpia));
}

function revisarRecorte(ref, media) {
  const { recorte, original } = media || {};
  if (!Array.isArray(recorte) || !recorte.length) return;
  if (
    recorte.length !== 4 ||
    recorte.some(n => !Number.isFinite(n) || n < 0) ||
    recorte[2] <= 0 ||
    recorte[3] <= 0
  )
    errores.push(`${ref}: el recorte requiere x, y, ancho y alto válidos.`);
  else if (
    !Array.isArray(original) ||
    original.length !== 2 ||
    recorte[0] + recorte[2] > original[0] ||
    recorte[1] + recorte[3] > original[1]
  )
    errores.push(`${ref}: el recorte no coincide con las dimensiones originales.`);
}

function revisarPublicaciones(items, origen) {
  const ids = new Set();
  items.forEach((p, i) => {
    const ref = `${origen} ${i + 1} ("${p?.titulo || "sin título"}")`;
    if (ids.has(p?.id)) errores.push(`${ref}: el id "${p.id}" está repetido.`);
    ids.add(p?.id);
    const { errors, warnings } = model.validate(p);
    errors.forEach(e => errores.push(`${ref}: ${e.message}`));
    for (const src of model.mediaIn(p || {}))
      if (!existeImagen(src)) errores.push(`${ref}: no existe la imagen ${src}.`);
    for (const page of p?.editorial?.paginas || []) {
      revisarRecorte(ref, page);
      for (const b of page?.bloques || []) revisarRecorte(ref, b);
    }
    if (p?.estado === "publicado") {
      warnings.forEach(w => avisos.push(`${ref}: ${w}`));
      if ((p.posturas || []).length === 1)
        avisos.push(`${ref}: solo presenta una postura; revisar imparcialidad.`);
      if (JSON.stringify(p).includes("PENDIENTE"))
        avisos.push(`${ref}: tiene textos "PENDIENTE" sin completar.`);
    }
  });
}

const publico = leer(path.join(DATOS, "contenido", "publicaciones.json"), "contenido/publicaciones.json");
if (publico) {
  const items = publico.items || [];
  if (items.some(p => p.estado !== "publicado"))
    errores.push(
      "contenido/publicaciones.json contiene borradores: deben quedar solo en el almacén privado."
    );
  if (JSON.stringify(items).includes('"meta"'))
    avisos.push(
      "contenido/publicaciones.json incluye datos internos (meta); el servidor los quita al publicar."
    );
  revisarPublicaciones(items, "Publicación");
}
const privado = leer(path.join(DATOS, ".ceri", "publicaciones.json"), ".ceri/publicaciones.json");
if (privado)
  revisarPublicaciones(
    (privado.items || []).filter(p => p.estado !== "publicado"),
    "Borrador"
  );

for (const nombre of Object.keys(Colecciones.COLECCIONES)) {
  const datos = leer(path.join(DATOS, "contenido", nombre + ".json"), `contenido/${nombre}.json`);
  if (!datos) continue;
  const { errores: problemas } = Colecciones.validar(nombre, datos);
  problemas.forEach(e => errores.push(`contenido/${nombre}.json: ${e}`));
  for (const src of Colecciones.imagenesEn(nombre, datos))
    if (!existeImagen(src)) errores.push(`contenido/${nombre}.json: no existe la imagen ${src}.`);
}

const sitio = leer(path.join(DATOS, "contenido", "sitio.json"), "sitio.json") || {};
if (!sitio.correo || /^correo@/i.test(sitio.correo))
  avisos.push("sitio.json: falta el correo institucional real.");
const equipo = leer(path.join(DATOS, "contenido", "equipo.json"), "equipo.json") || {};
if (!(equipo.items || []).some(m => m.nombre && !/PENDIENTE/i.test(m.nombre)))
  avisos.push("equipo.json: la directiva aún no está publicada (nombres PENDIENTE).");
const conv = leer(path.join(DATOS, "contenido", "convocatoria.json"), "convocatoria.json") || {};
if (conv.abierta && !conv.formulario)
  avisos.push("convocatoria.json: está abierta pero no tiene enlace al formulario.");

console.log("\n=== Revisión del contenido ===\n");
errores.forEach(e => console.log("✗ ERROR:", e));
avisos.forEach(a => console.log("! AVISO:", a));
if (!errores.length && !avisos.length) console.log("✓ Todo está en orden.");
console.log(`\n${errores.length} error(es), ${avisos.length} aviso(s).\n`);
process.exit(errores.length ? 1 : 0);
