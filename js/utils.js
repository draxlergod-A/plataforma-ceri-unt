/* =========================================================
   utils.js — FUNCIONES DE AYUDA
   Fechas, seguridad del texto, Markdown y botones de compartir.
   Normalmente no hace falta tocar este archivo.
   ========================================================= */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/* "2026-11-10" -> "10 nov 2026" */
function formatearFecha(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return "";
  return `${d} ${MESES[m - 1]} ${a}`;
}

/* Fecha de hoy en formato AAAA-MM-DD (hora local) */
function hoyISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

/* Evita que texto con < > rompa la página o inyecte código */
function esc(txt) {
  return String(txt ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Solo permite enlaces http(s), mailto o rutas relativas */
function urlSegura(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:)/i.test(u) || !/^[a-z]+:/i.test(u)) return u;
  return "";
}

/* Rutas de imágenes subidas desde el panel ("/assets/..." -> "assets/...") */
function rutaImagen(ruta) {
  const r = urlSegura(ruta);
  return r.startsWith("/") ? r.slice(1) : r;
}

function ordenarPorFecha(lista, desc = true) {
  return [...lista].sort((a, b) =>
    desc ? String(b.fecha).localeCompare(String(a.fecha)) : String(a.fecha).localeCompare(String(b.fecha)));
}

/* Minutos de lectura aproximados (200 palabras por minuto) */
function minutosLectura(p) {
  const texto = [p.resumen, ...(p.hechos || []), p.desarrollo,
    ...(p.posturas || []).map(x => x.postura), ...(p.escenarios || [])].join(" ");
  return Math.max(1, Math.round(texto.split(/\s+/).filter(Boolean).length / 200));
}

/* ---------------------------------------------------------
   Markdown básico -> HTML (seguro)
   Soporta: ## títulos, **negrita**, *cursiva*, [enlace](url),
   listas con "-" o "1.", citas con ">" y párrafos.
   --------------------------------------------------------- */
function markdown(md) {
  if (!md) return "";
  const enLinea = t => esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
      const u = urlSegura(url.replace(/&amp;/g, "&"));
      return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${txt}</a>` : txt;
    });

  return String(md).replace(/\r/g, "").split(/\n{2,}/).map(bloque => {
    const lineas = bloque.split("\n").filter(l => l.trim());
    if (!lineas.length) return "";
    const h = lineas[0].match(/^(#{2,4})\s+(.*)/);
    if (h && lineas.length === 1) {
      const n = Math.min(h[1].length + 1, 4); // ## -> h3 (h2 ya se usa en las secciones)
      return `<h${n}>${enLinea(h[2])}</h${n}>`;
    }
    if (lineas.every(l => /^\s*[-*]\s+/.test(l)))
      return `<ul>${lineas.map(l => `<li>${enLinea(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    if (lineas.every(l => /^\s*\d+\.\s+/.test(l)))
      return `<ol>${lineas.map(l => `<li>${enLinea(l.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
    if (lineas.every(l => /^>\s?/.test(l)))
      return `<blockquote>${enLinea(lineas.map(l => l.replace(/^>\s?/, "")).join(" "))}</blockquote>`;
    return `<p>${lineas.map(enLinea).join("<br>")}</p>`;
  }).join("\n");
}

/* Botones para compartir una publicación */
function botonesCompartir(titulo) {
  const url = encodeURIComponent(location.href);
  const t = encodeURIComponent(titulo);
  return `
    <div class="compartir" aria-label="Compartir">
      <span class="muted">Compartir:</span>
      <a href="https://wa.me/?text=${t}%20${url}" target="_blank" rel="noopener">WhatsApp</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener">Facebook</a>
      <a href="https://twitter.com/intent/tweet?text=${t}&url=${url}" target="_blank" rel="noopener">X</a>
      <button type="button" class="btn-link" data-copiar>Copiar enlace</button>
    </div>`;
}

function activarCopiar() {
  document.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      b.textContent = "¡Enlace copiado!";
    } catch {
      b.textContent = "Copia el enlace de la barra";
    }
    setTimeout(() => (b.textContent = "Copiar enlace"), 2500);
  }));
}
