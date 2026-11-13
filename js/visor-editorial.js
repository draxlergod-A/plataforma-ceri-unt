/* =========================================================
   visor-editorial.js — Visor interactivo tipo periódico
   Se activa desde las tarjetas de publicaciones con el
   botón "Ver como periódico".
   ========================================================= */

(function () {
  /* ---- Generar imágenes de las páginas del informe ---- */
  function generarPaginasInforme(pub) {
    // Paleta y tipografía del CERI
    const navy   = "#1f2f49";
    const royal  = "#27446e";
    const sky    = "#597daf";
    const paper  = "#f0efdb";
    const ink    = "#172538";
    const muted  = "#c5d1de";
    const W = 750, H = 915;

    function crearCanvas() {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      return c;
    }

    function fondoPapel(ctx) {
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, W, H);
      // textura sutil
      ctx.fillStyle = "rgba(0,0,0,0.018)";
      for (let i = 0; i < H; i += 4) {
        ctx.fillRect(0, i, W, 1);
      }
    }

    function barraTop(ctx) {
      // línea de colores superior
      ctx.fillStyle = paper; ctx.fillRect(0, 0, W * 0.14, 5);
      ctx.fillStyle = sky;   ctx.fillRect(W * 0.14, 0, W * 0.24, 5);
      ctx.fillStyle = royal; ctx.fillRect(W * 0.38, 0, W * 0.62, 5);
    }

    function sello(ctx, x, y, r) {
      ctx.save();
      ctx.strokeStyle = "rgba(31,47,73,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r - 5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = navy;
      ctx.font = `bold ${Math.round(r * 0.42)}px Georgia, serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("CERI", x, y);
      ctx.restore();
    }

    function wrapText(ctx, text, x, y, maxW, lineH) {
      const words = String(text || "").split(" ");
      let line = "";
      const lines = [];
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
      return lines.length;
    }

    // ---- PÁGINA 1: PORTADA ----
    const c1 = crearCanvas();
    const g1 = c1.getContext("2d");

    // fondo degradado azul
    const grad = g1.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, navy);
    grad.addColorStop(0.6, royal);
    grad.addColorStop(1, navy);
    g1.fillStyle = grad;
    g1.fillRect(0, 0, W, H);

    barraTop(g1);

    // ruido sutil
    g1.fillStyle = "rgba(255,255,255,0.03)";
    for (let y = 0; y < H; y += 3)
      for (let x = 0; x < W; x += 3)
        if (Math.random() > 0.7) g1.fillRect(x, y, 1, 1);

    // cabecera
    sello(g1, 60, 70, 36);
    g1.fillStyle = paper;
    g1.font = "bold 13px 'Segoe UI', Arial, sans-serif";
    g1.textAlign = "left";
    g1.fillText("Círculo de Estudios de Relaciones Internacionales", 108, 60);
    g1.fillStyle = muted;
    g1.font = "11px 'Segoe UI', Arial, sans-serif";
    g1.fillText("Universidad Nacional de Trujillo · Archivo editorial", 108, 78);

    // línea divisoria
    g1.strokeStyle = "rgba(240,239,219,0.18)"; g1.lineWidth = 1;
    g1.beginPath(); g1.moveTo(40, 105); g1.lineTo(W - 40, 105); g1.stroke();

    // tipo/ámbito
    g1.fillStyle = sky;
    g1.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    g1.letterSpacing = "0.15em";
    g1.textAlign = "left";
    g1.fillText((pub.tipo || "Análisis").toUpperCase() + "  ·  " + (pub.ambito || "").toUpperCase(), 44, 130);

    // número gigante decorativo
    g1.fillStyle = "rgba(89,125,175,0.13)";
    g1.font = "bold 220px Georgia, serif";
    g1.textAlign = "right";
    g1.fillText("01", W - 20, 320);

    // título principal
    g1.fillStyle = paper;
    g1.font = `bold ${pub.titulo && pub.titulo.length > 40 ? 36 : 44}px Georgia, serif`;
    g1.textAlign = "left";
    const linsTit = wrapText(g1, pub.titulo, 44, 190, W - 100, 54);

    // subtítulo
    if (pub.subtitulo) {
      g1.fillStyle = "#bdd0e7";
      g1.font = `italic ${pub.subtitulo.length > 60 ? 18 : 22}px Georgia, serif`;
      wrapText(g1, pub.subtitulo, 44, 190 + linsTit * 54 + 20, W - 100, 30);
    }

    // línea azul
    g1.strokeStyle = sky; g1.lineWidth = 2;
    g1.beginPath(); g1.moveTo(44, 400); g1.lineTo(W - 44, 400); g1.stroke();

    // datos
    const fecha = pub.fecha ? new Date(pub.fecha + "T12:00:00").toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" }) : "";
    const datos = [
      ["AUTOR", pub.autor || "Equipo CERI"],
      ["FECHA", fecha],
      ["TEMAS", (pub.temas || []).join(", ") || "—"]
    ];
    datos.forEach(([k, v], i) => {
      g1.fillStyle = sky;
      g1.font = "bold 9px 'Segoe UI', Arial, sans-serif";
      g1.textAlign = "left";
      g1.fillText(k, 44, 435 + i * 48);
      g1.fillStyle = paper;
      g1.font = "14px 'Segoe UI', Arial, sans-serif";
      wrapText(g1, v, 44, 452 + i * 48, (W - 88) / 2, 18);
    });

    // pie de portada
    g1.strokeStyle = "rgba(240,239,219,0.18)"; g1.lineWidth = 1;
    g1.beginPath(); g1.moveTo(40, H - 55); g1.lineTo(W - 40, H - 55); g1.stroke();
    g1.fillStyle = muted;
    g1.font = "10px 'Segoe UI', Arial, sans-serif";
    g1.textAlign = "left";
    g1.fillText("CERI · Edición digital", 44, H - 35);
    g1.textAlign = "right";
    g1.fillText("PORTADA / 01", W - 44, H - 35);

    // ---- PÁGINA 2: CONTENIDO ----
    const c2 = crearCanvas();
    const g2 = c2.getContext("2d");
    fondoPapel(g2);
    barraTop(g2);

    // encabezado
    g2.fillStyle = navy;
    g2.font = "bold 11px 'Segoe UI', Arial, sans-serif";
    g2.textAlign = "left";
    g2.fillText("CERI · " + (pub.tipo || "Análisis").toUpperCase(), 44, 40);
    g2.fillStyle = "#a0b4c8";
    g2.font = "10px 'Segoe UI', Arial, sans-serif";
    g2.textAlign = "right";
    g2.fillText("02 / RESUMEN EJECUTIVO", W - 44, 40);

    g2.strokeStyle = "rgba(31,47,73,0.15)"; g2.lineWidth = 1;
    g2.beginPath(); g2.moveTo(40, 52); g2.lineTo(W - 40, 52); g2.stroke();

    // título compacto
    g2.fillStyle = navy;
    g2.font = "bold 22px Georgia, serif";
    g2.textAlign = "left";
    wrapText(g2, pub.titulo, 44, 85, W - 88, 30);

    // línea decorativa
    g2.strokeStyle = sky; g2.lineWidth = 2;
    g2.beginPath(); g2.moveTo(44, 125); g2.lineTo(180, 125); g2.stroke();

    let curY = 148;

    // RESUMEN
    if (pub.resumen && !pub.resumen.includes("PENDIENTE")) {
      g2.fillStyle = sky;
      g2.font = "bold 9px 'Segoe UI', Arial, sans-serif";
      g2.fillText("RESUMEN", 44, curY);
      curY += 16;
      // barra lateral azul
      g2.strokeStyle = sky; g2.lineWidth = 2;
      g2.beginPath(); g2.moveTo(44, curY); g2.lineTo(44, curY + 100); g2.stroke();
      g2.fillStyle = "#2d3f58";
      g2.font = "14px Georgia, serif";
      const nLines = wrapText(g2, pub.resumen, 56, curY + 4, W - 110, 22);
      curY += Math.max(nLines * 22 + 20, 40);
    }

    // HECHOS VERIFICADOS
    const hechosValidos = (pub.hechos || []).filter(h => !h.includes("PENDIENTE"));
    if (hechosValidos.length) {
      curY += 8;
      g2.fillStyle = sky;
      g2.font = "bold 9px 'Segoe UI', Arial, sans-serif";
      g2.fillText("HECHOS VERIFICADOS", 44, curY);
      curY += 16;
      hechosValidos.slice(0, 4).forEach((h, i) => {
        g2.fillStyle = sky;
        g2.font = "bold 13px 'Segoe UI', Arial, sans-serif";
        g2.fillText("●", 44, curY + 3);
        g2.fillStyle = ink;
        g2.font = "13px 'Segoe UI', Arial, sans-serif";
        const n = wrapText(g2, h, 60, curY, W - 110, 19);
        curY += n * 19 + 8;
      });
      curY += 4;
    }

    // POSTURAS
    const posturasValidas = (pub.posturas || []).filter(p => p.actor && !p.actor.includes("PENDIENTE"));
    if (posturasValidas.length) {
      curY += 8;
      g2.fillStyle = sky;
      g2.font = "bold 9px 'Segoe UI', Arial, sans-serif";
      g2.fillText("POSTURAS DE LOS ACTORES", 44, curY);
      curY += 16;
      posturasValidas.slice(0, 2).forEach(p => {
        const colW = (W - 100) / 2;
        g2.strokeStyle = "rgba(31,47,73,0.1)"; g2.lineWidth = 1;
        g2.strokeRect(44, curY, colW, 70);
        g2.fillStyle = royal;
        g2.font = "bold 11px 'Segoe UI', Arial, sans-serif";
        wrapText(g2, p.actor, 52, curY + 14, colW - 20, 14);
        g2.fillStyle = "#2d3f58";
        g2.font = "11px 'Segoe UI', Arial, sans-serif";
        wrapText(g2, p.postura, 52, curY + 30, colW - 20, 15);
        curY += 80;
      });
    }

    // ESCENARIOS
    const escenariosValidos = (pub.escenarios || []).filter(e => !e.includes("PENDIENTE"));
    if (escenariosValidos.length && curY < H - 120) {
      curY += 8;
      g2.fillStyle = sky;
      g2.font = "bold 9px 'Segoe UI', Arial, sans-serif";
      g2.fillText("ESCENARIOS POSIBLES", 44, curY);
      curY += 16;
      escenariosValidos.slice(0, 3).forEach((e, i) => {
        g2.fillStyle = "rgba(89,125,175,0.12)";
        g2.fillRect(44, curY - 2, W - 88, 36);
        g2.fillStyle = sky;
        g2.font = "bold 10px 'Segoe UI', Arial, sans-serif";
        g2.fillText("0" + (i + 1), 52, curY + 14);
        g2.fillStyle = ink;
        g2.font = "11px 'Segoe UI', Arial, sans-serif";
        wrapText(g2, e, 70, curY + 8, W - 130, 16);
        curY += 42;
      });
    }

    // pie de página 2
    g2.strokeStyle = "rgba(31,47,73,0.15)"; g2.lineWidth = 1;
    g2.beginPath(); g2.moveTo(40, H - 40); g2.lineTo(W - 40, H - 40); g2.stroke();
    g2.fillStyle = "#7a92aa";
    g2.font = "9px 'Segoe UI', Arial, sans-serif";
    g2.textAlign = "left";
    g2.fillText("CERI · Círculo de Estudios de Relaciones Internacionales", 44, H - 22);
    g2.textAlign = "right";
    g2.fillText("02", W - 44, H - 22);

    return [c1.toDataURL("image/jpeg", 0.92), c2.toDataURL("image/jpeg", 0.92)];
  }

  /* ---- Crear el overlay del visor ---- */
  function crearVisor() {
    if (document.getElementById("ceri-visor-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "ceri-visor-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Visor editorial del informe");
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="ceri-visor-inner">
        <div class="ceri-visor-topbar">
          <div class="ceri-visor-brand">
            <span class="ceri-visor-seal">CERI</span>
            <div>
              <div class="ceri-visor-brand-top">Círculo de Estudios</div>
              <div class="ceri-visor-brand-bottom">de Relaciones Internacionales · UNT</div>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <span id="ceri-visor-label" style="font-size:10px;letter-spacing:.19em;text-transform:uppercase;color:#b7c9e0">Archivo editorial</span>
            <button id="ceri-visor-close" type="button" class="ceri-visor-btn-close" aria-label="Cerrar visor">✕ Cerrar</button>
          </div>
        </div>
        <div class="ceri-visor-strip">
          <span id="ceri-visor-rubric" class="ceri-visor-rubric">Informes de análisis</span>
          <span class="ceri-visor-slash">/</span>
          <span id="ceri-visor-ambito">Política latinoamericana</span>
          <span style="margin-left:auto;white-space:nowrap;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8ca5be">CERI · Edición digital</span>
        </div>
        <div class="ceri-visor-body">
          <div class="ceri-visor-intro">
            <div class="ceri-visor-small-label">Colección de informes CERI</div>
            <div class="ceri-visor-kicker" aria-hidden="true">01.</div>
            <h2 id="ceri-visor-titulo" class="ceri-visor-display-title"></h2>
            <p id="ceri-visor-subtitulo" class="ceri-visor-lead"></p>
            <div class="ceri-visor-facts" id="ceri-visor-facts"></div>
            <hr class="ceri-visor-divider">
            <div class="ceri-visor-chapter-label">Contenido de esta edición</div>
            <div class="ceri-visor-chapters" id="ceri-visor-chapters"></div>
          </div>
          <div class="ceri-visor-reader">
            <div class="ceri-visor-readercap">
              <span>El informe · Vista editorial</span>
              <span><i class="ceri-live-dot" aria-hidden="true"></i> Interactivo</span>
            </div>
            <div class="ceri-book-wrap">
              <div class="ceri-book" id="ceri-book" aria-label="Páginas del informe con efecto de cambio de hoja">
                <div class="ceri-under-page"><img id="ceri-under" alt="Página visible del informe" draggable="false"></div>
                <div class="ceri-leaf" id="ceri-leaf">
                  <div class="ceri-face ceri-front"><img id="ceri-front" alt="Página actual" draggable="false"></div>
                  <div class="ceri-face ceri-back"><img id="ceri-back" alt="Página siguiente" draggable="false"></div>
                </div>
                <div class="ceri-page-highlight" aria-hidden="true"></div>
                <div class="ceri-corner" aria-hidden="true"></div>
                <div class="ceri-page-label" id="ceri-page-label">PORTADA / 01</div>
              </div>
            </div>
            <div class="ceri-navpanel" aria-label="Controles de navegación">
              <button class="ceri-navbutton" id="ceri-prev" type="button" aria-label="Página anterior"><span style="font-size:20px;font-family:Georgia,serif;line-height:.55">‹</span> Anterior</button>
              <div class="ceri-counter" aria-live="polite"><span id="ceri-current">01</span> <span style="font-size:12px;color:#96aecb">/ 02</span></div>
              <button class="ceri-navbutton" id="ceri-next" type="button" aria-label="Página siguiente">Siguiente <span style="font-size:20px;font-family:Georgia,serif;line-height:.55">›</span></button>
            </div>
            <div class="ceri-dots" id="ceri-dots" role="group" aria-label="Saltar a página"></div>
            <div class="ceri-tip" id="ceri-hint">⟶ Usa las flechas del teclado o los botones para pasar la hoja</div>
            <div class="ceri-reader-toolbox">
              <span id="ceri-chapter-title" style="font-size:10px;color:#b0c6e1;letter-spacing:.18em;text-transform:uppercase">01 · Portada</span>
              <div style="display:flex;gap:8px">
                <button class="ceri-tool" id="ceri-zoom" type="button">⤢ Ampliar página</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="ceri-viewer-modal" style="display:none;position:fixed;inset:0;z-index:1100;background:rgba(10,18,30,.97);display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:18px">
        <div style="width:min(100%,900px);display:flex;justify-content:space-between;align-items:center;color:#f0efdb;font-size:12px;letter-spacing:.14em;text-transform:uppercase">
          <strong id="ceri-viewer-title">CERI · Página 01</strong>
          <button id="ceri-viewer-close" style="background:#27446e;color:#f0efdb;border:1px solid #597daf;padding:10px 16px;cursor:pointer;font:inherit">✕ Cerrar</button>
        </div>
        <img id="ceri-viewer-img" style="max-height:calc(100vh - 105px);max-width:min(100%,900px);object-fit:contain;box-shadow:0 20px 60px rgba(0,0,0,.5)" alt="">
      </div>`;
    document.body.appendChild(overlay);

    // Eventos del overlay
    document.getElementById("ceri-visor-close").addEventListener("click", cerrarVisor);
    overlay.addEventListener("click", e => { if (e.target === overlay) cerrarVisor(); });
    document.getElementById("ceri-viewer-close").addEventListener("click", () => {
      document.getElementById("ceri-viewer-modal").style.display = "none";
    });
    document.addEventListener("keydown", e => {
      if (!overlay.classList.contains("ceri-open")) return;
      if (e.key === "Escape") cerrarVisor();
      if (e.key === "ArrowRight") irPagina(window._ceriVisor.paginaActual + 1);
      if (e.key === "ArrowLeft") irPagina(window._ceriVisor.paginaActual - 1);
    });
  }

  function cerrarVisor() {
    const ov = document.getElementById("ceri-visor-overlay");
    if (ov) {
      ov.classList.remove("ceri-open");
      ov.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "";
  }

  function irPagina(idx) {
    const v = window._ceriVisor;
    if (!v || idx < 0 || idx >= v.paginas.length) return;
    const anterior = v.paginaActual;
    v.paginaActual = idx;

    const book  = document.getElementById("ceri-book");
    const leaf  = document.getElementById("ceri-leaf");
    const front = document.getElementById("ceri-front");
    const back  = document.getElementById("ceri-back");
    const under = document.getElementById("ceri-under");

    const avanzar = idx > anterior;

    if (avanzar) {
      front.src = v.paginas[anterior];
      back.src  = v.paginas[idx];
      under.src = v.paginas[idx];
      leaf.classList.remove("ceri-backwards", "ceri-forward", "ceri-go");
      book.classList.add("ceri-is-turning");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { leaf.classList.add("ceri-forward"); });
      });
    } else {
      front.src = v.paginas[idx];
      back.src  = v.paginas[anterior];
      under.src = v.paginas[idx];
      leaf.classList.remove("ceri-forward");
      leaf.classList.add("ceri-backwards");
      book.classList.add("ceri-is-turning");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { leaf.classList.add("ceri-go"); });
      });
    }

    setTimeout(() => {
      book.classList.remove("ceri-is-turning");
      front.src = v.paginas[idx];
      leaf.classList.remove("ceri-backwards", "ceri-forward", "ceri-go");
    }, 1380);

    // Actualizar controles
    actualizarControles(idx);
  }

  function actualizarControles(idx) {
    const v = window._ceriVisor;
    const n = v.paginas.length;
    document.getElementById("ceri-current").textContent = String(idx + 1).padStart(2, "0");
    document.getElementById("ceri-prev").disabled = idx === 0;
    document.getElementById("ceri-next").disabled = idx === n - 1;
    document.getElementById("ceri-page-label").textContent = idx === 0 ? "PORTADA / 01" : "RESUMEN / 02";
    document.getElementById("ceri-chapter-title").textContent = idx === 0 ? "01 · Portada" : "02 · Resumen ejecutivo";
    document.querySelectorAll(".ceri-dot").forEach((d, i) => d.setAttribute("aria-current", i === idx ? "page" : "false"));
    document.querySelectorAll(".ceri-chapter-btn").forEach((b, i) => b.setAttribute("aria-current", i === idx ? "page" : "false"));
  }

  /* ---- Abrir el visor con una publicación ---- */
  window.abrirVisorEditorial = function (pub) {
    crearVisor();
    const paginas = generarPaginasInforme(pub);
    window._ceriVisor = { paginas, paginaActual: 0 };

    // Rellenar metadata
    document.getElementById("ceri-visor-titulo").textContent = pub.titulo || "";
    document.getElementById("ceri-visor-subtitulo").textContent = pub.subtitulo || "";
    document.getElementById("ceri-visor-rubric").textContent = pub.tipo || "Informe";
    document.getElementById("ceri-visor-ambito").textContent = pub.ambito || "";

    const facts = document.getElementById("ceri-visor-facts");
    facts.innerHTML = `
      <span><b>01</b> Informe</span>
      <span><b>02</b> Páginas</span>
      <span><b>3D</b> Efecto de hoja</span>`;

    // Índice de capítulos
    const chapters = document.getElementById("ceri-visor-chapters");
    const names = ["Portada · " + (pub.titulo || "Informe").slice(0, 30), "Ideas centrales y resumen ejecutivo"];
    chapters.innerHTML = names.map((name, i) => `
      <button class="ceri-chapter-btn" data-go="${i}" ${i === 0 ? 'aria-current="page"' : ''}>
        <span class="ceri-chap-num">0${i + 1}</span>
        <span class="ceri-chap-name">${name}</span>
        <span style="font-size:15px;color:#597daf">↗</span>
      </button>`).join("");

    // Dots
    const dotsEl = document.getElementById("ceri-dots");
    dotsEl.innerHTML = paginas.map((_, i) => `
      <button class="ceri-dot" data-go="${i}" aria-label="Ir a página ${i + 1}" ${i === 0 ? 'aria-current="page"' : ''}></button>`).join("");

    // Eventos nav
    document.getElementById("ceri-prev").addEventListener("click", () => irPagina(window._ceriVisor.paginaActual - 1));
    document.getElementById("ceri-next").addEventListener("click", () => irPagina(window._ceriVisor.paginaActual + 1));
    document.querySelectorAll(".ceri-dot, .ceri-chapter-btn").forEach(btn => {
      btn.addEventListener("click", () => irPagina(Number(btn.dataset.go)));
    });
    document.getElementById("ceri-zoom").addEventListener("click", () => {
      const idx = window._ceriVisor.paginaActual;
      const modal = document.getElementById("ceri-viewer-modal");
      document.getElementById("ceri-viewer-img").src = paginas[idx];
      document.getElementById("ceri-viewer-title").textContent = "CERI · Página 0" + (idx + 1);
      modal.style.display = "flex";
    });

    // Inicializar libro
    const front = document.getElementById("ceri-front");
    const under = document.getElementById("ceri-under");
    front.src = paginas[0];
    under.src = paginas[0];
    document.getElementById("ceri-back").src = paginas[1] || paginas[0];
    actualizarControles(0);

    // Abrir overlay
    const ov = document.getElementById("ceri-visor-overlay");
    ov.classList.add("ceri-open");
    ov.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };
})();
