/* =========================================================
   validar.js — REVISA QUE EL CONTENIDO ESTÉ BIEN
   Uso:  npm run validar
   Revisa: JSON válido, ids únicos, fechas correctas,
   publicaciones sin fuentes, campos PENDIENTE, etc.
   ========================================================= */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "contenido");
const errores = [];
const avisos = [];
const fechaOK = f => !f || /^\d{4}-\d{2}-\d{2}$/.test(f);

function revisarImagen(imagen, ref, recorte, original) {
  const ruta = String(imagen || "").replace(/^\//, "");
  if (ruta.startsWith("assets/") && !fs.existsSync(path.join(__dirname, "..", ruta)))
    errores.push(`${ref}: no existe la imagen ${ruta}.`);
  if (Array.isArray(recorte) && recorte.length) {
    if (recorte.length !== 4 || recorte.some(n => !Number.isFinite(n) || n < 0) || recorte[2] <= 0 || recorte[3] <= 0)
      errores.push(`${ref}: el recorte requiere x, y, ancho y alto válidos.`);
    else if (!Array.isArray(original) || original.length !== 2 || recorte[0] + recorte[2] > original[0] || recorte[1] + recorte[3] > original[1])
      errores.push(`${ref}: el recorte no coincide con las dimensiones originales.`);
  }
}

function leer(nombre) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, nombre + ".json"), "utf8"));
  } catch (e) {
    errores.push(`contenido/${nombre}.json no es un JSON válido: ${e.message}`);
    return null;
  }
}

const pub = leer("publicaciones");
if (pub) {
  const ids = new Set();
  (pub.items || []).forEach((p, i) => {
    const ref = `Publicación ${i + 1} ("${p.titulo || "sin título"}")`;
    if (!p.id) errores.push(`${ref}: falta el identificador (id).`);
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) errores.push(`${ref}: el id "${p.id}" solo puede tener minúsculas, números y guiones.`);
    else if (ids.has(p.id)) errores.push(`${ref}: el id "${p.id}" está repetido.`);
    ids.add(p.id);
    if (p.editorial) {
      const paginas = p.editorial.paginas;
      if (!Array.isArray(paginas) || !paginas.length) errores.push(`${ref}: la edición interactiva necesita al menos una página.`);
      else paginas.forEach((pagina, j) => {
        const lugar = `${ref}, página ${j + 1}`;
        if (!["portada", "interior"].includes(pagina.tipo)) errores.push(`${lugar}: diseño inválido.`);
        if (!pagina.titulo) errores.push(`${lugar}: falta el título.`);
        revisarImagen(pagina.imagen, lugar, pagina.recorte, pagina.original);
        revisarImagen(pagina.miniatura, lugar);
        (pagina.bloques || []).forEach((bloque, k) => {
          const bloqueRef = `${lugar}, bloque ${k + 1}`;
          if (!["parrafo", "imagen", "destacado", "cronologia", "fichas", "fuentes"].includes(bloque.tipo))
            errores.push(`${bloqueRef}: tipo de bloque inválido.`);
          if (bloque.tipo === "imagen") {
            if (!bloque.src) errores.push(`${bloqueRef}: falta la imagen.`);
            revisarImagen(bloque.src, bloqueRef, bloque.recorte, bloque.original);
            if (!bloque.alt) avisos.push(`${bloqueRef}: falta la descripción de la imagen.`);
          }
        });
      });
    }
    if (!fechaOK(p.fecha) || !p.fecha) errores.push(`${ref}: fecha inválida (usar AAAA-MM-DD).`);
    if (p.estado === "publicado") {
      if (!(p.fuentes || []).length) avisos.push(`${ref}: está publicada pero no tiene fuentes.`);
      if ((p.posturas || []).length === 1) avisos.push(`${ref}: solo presenta una postura; revisar imparcialidad.`);
      if (!p.revisadoPor) avisos.push(`${ref}: está publicada sin indicar quién la revisó.`);
      if (JSON.stringify(p).includes("PENDIENTE")) avisos.push(`${ref}: tiene textos "PENDIENTE" sin completar.`);
    }
  });
}

["eventos", "participacion"].forEach(n => {
  const d = leer(n);
  if (d) (d.items || []).forEach((x, i) => {
    if (!x.fecha || !fechaOK(x.fecha)) errores.push(`${n} ${i + 1} ("${x.titulo}"): fecha inválida.`);
  });
});

["alianzas", "equipo"].forEach(leer);
const sitio = leer("sitio");
if (sitio && /ceri-unt\.org$/.test(sitio.correo || "")) avisos.push("sitio.json: el correo parece ser el de ejemplo.");
const conv = leer("convocatoria");
if (conv && conv.abierta && !conv.formulario) avisos.push("convocatoria.json: está abierta pero no tiene enlace al formulario.");

console.log("\n=== Revisión del contenido ===\n");
errores.forEach(e => console.log("✗ ERROR:", e));
avisos.forEach(a => console.log("! AVISO:", a));
if (!errores.length && !avisos.length) console.log("✓ Todo está en orden.");
console.log(`\n${errores.length} error(es), ${avisos.length} aviso(s).\n`);
process.exit(errores.length ? 1 : 0);
