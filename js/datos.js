/* =========================================================
   datos.js — CARGA DEL CONTENIDO
   Lee los archivos de la carpeta contenido/ (los que edita
   el panel de administración) y los deja listos para usar.
   ========================================================= */

const ARCHIVOS = ["sitio", "publicaciones", "eventos", "participacion", "alianzas", "equipo", "convocatoria"];

let _datos = null;

async function cargarDatos() {
  if (_datos) return _datos;

  const respuestas = await Promise.all(ARCHIVOS.map(async nombre => {
    const r = await fetch(`contenido/${nombre}.json`, { cache: "no-store" });
    if (!r.ok) throw new Error(`No se pudo leer contenido/${nombre}.json`);
    return [nombre, await r.json()];
  }));

  const d = Object.fromEntries(respuestas);
  const lista = obj => (obj && Array.isArray(obj.items) ? obj.items : []);

  _datos = {
    sitio: d.sitio || {},
    convocatoria: d.convocatoria || {},
    // Solo se muestran en la web las publicaciones con estado "publicado"
    publicaciones: lista(d.publicaciones).filter(p => p.estado === "publicado" && p.id),
    eventos: lista(d.eventos),
    participacion: lista(d.participacion),
    alianzas: lista(d.alianzas),
    equipo: lista(d.equipo)
  };
  return _datos;
}

/* Mensaje si se abre la web con doble clic (file://) en lugar de un servidor */
function mostrarErrorCarga(err) {
  console.error(err);
  const main = document.getElementById("contenido");
  const porArchivo = location.protocol === "file:";
  main.innerHTML = `
    <div class="container"><div class="error-carga">
      <h1>No se pudo cargar el contenido</h1>
      ${porArchivo
        ? `<p>Abriste la web con doble clic. Como ahora el contenido está en la carpeta <code>contenido/</code>,
           la web necesita un servidor local.</p>
           <p><strong>Solución:</strong> en VS Code, clic derecho en <code>index.html</code> →
           <em>Open with Live Server</em>. O en la terminal: <code>npm run sitio</code>.</p>`
        : `<p>Revisa que los archivos de <code>contenido/</code> existan y no tengan errores.
           Detalle: ${esc(err.message)}</p>`}
    </div></div>`;
}
