/* Biblioteca y lector editorial nativos. Sin dependencias externas. */
(() => {
  "use strict";
  const pad = i => String(i + 1).padStart(2, "0");
  const inline = text => esc(text || "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function photo(media) {
    if (!media?.src) return "";
    const src = rutaImagen(media.src);
    if (!src) return "";
    const rect = media.recorte,
      size = media.original;
    let style = "",
      imageStyle = "";
    if (
      Array.isArray(rect) &&
      rect.length === 4 &&
      Array.isArray(size) &&
      rect.every(Number.isFinite) &&
      rect[2] > 0 &&
      rect[3] > 0
    ) {
      const [x, y, w, h] = rect;
      style = `aspect-ratio:${w}/${h}`;
      imageStyle = `position:absolute;width:${(size[0] / w) * 100}%;height:${(size[1] / h) * 100}%;left:${(-x / w) * 100}%;top:${(-y / h) * 100}%;max-width:none;object-fit:fill`;
    }
    return `<figure class="paper-photo" style="${style}"><img src="${esc(src)}" alt="${esc(media.alt || "")}" style="${imageStyle}" decoding="async" draggable="false">${media.pie ? `<figcaption>${esc(media.pie)}</figcaption>` : ""}</figure>`;
  }

  function block(b) {
    if (b.tipo === "imagen") return photo(b);
    if (b.tipo === "destacado") return `<blockquote class="paper-callout">${inline(b.texto)}</blockquote>`;
    if (b.tipo === "cronologia" || b.tipo === "fichas")
      return `<ol class="paper-facts ${b.tipo === "cronologia" ? "paper-facts--timeline" : ""}">${(b.items || []).map((item, i) => `<li><span class="paper-facts__number">${esc(item.etiqueta || pad(i))}</span><div><h4>${esc(item.titulo)}</h4><p>${inline(item.texto)}</p></div></li>`).join("")}</ol>`;
    if (b.tipo === "fuentes")
      return `<ol class="paper-sources">${(b.items || [])
        .map(f => {
          const url = urlSegura(f.url);
          return `<li>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(f.nombre)} <span aria-hidden="true">↗</span></a>` : esc(f.nombre)}</li>`;
        })
        .join("")}</ol>`;
    return `<p>${inline(b.texto)}</p>`;
  }

  function page(pub, p, i) {
    const total = pub.editorial.paginas.length,
      cover = p.tipo === "portada";
    if (p.diseno === "lamina")
      return `<article class="paper paper--plate" aria-label="Página ${i + 1}: ${esc(p.titulo || pub.titulo)}"><img src="${esc(rutaImagen(p.imagen || ""))}" alt="${esc(p.alt || p.titulo || pub.titulo)}" draggable="false"><span class="sr-only">${esc(p.pie || "")}</span></article>`;
    let blocks =
      (p.bloques?.length ? p.bloques : null) ||
      String(p.contenido || "")
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map(texto => ({ tipo: "parrafo", texto }));
    if (!p.bloques?.length && p.imagen && !cover) {
      blocks = [...blocks];
      blocks.splice(Number.isInteger(p.imagenDespuesDe) ? p.imagenDespuesDe : blocks.length, 0, {
        tipo: "imagen",
        src: p.imagen,
        alt: p.alt,
        pie: p.pie,
        recorte: p.recorte,
        original: p.original
      });
    }
    return `<article class="paper ${cover ? "paper--cover" : ""} ${p.diseno === "referencias" ? "paper--references" : ""}" aria-label="Página ${i + 1}: ${esc(p.titulo || pub.titulo)}">
      <header class="paper-head"><span class="paper-mark">CERI</span><span>Cuadernos de<br>relaciones internacionales</span><b>UNT / ${esc(pub.editorial.edicion || "01")}</b></header>
      <div class="paper-main">${
        cover
          ? `<p class="paper-kicker">${esc(pub.ambito)} · Informe de análisis</p><h3 class="paper-cover-title">${esc(p.titulo || pub.titulo)}</h3><p class="paper-cover-deck">${esc(p.bajada || pub.subtitulo)}</p>${photo({ src: p.imagen, alt: p.alt, recorte: p.recorte, original: p.original })}<div class="paper-cover-note"><span>Análisis · Contexto · Perspectivas</span><b>${total} páginas</b></div>`
          : `<p class="paper-kicker">${esc(p.seccion || pub.ambito)}</p><h3 class="paper-title">${esc(p.titulo || "Informe CERI")}</h3><div class="paper-content ${p.diseno === "columnas" ? "paper-content--columns" : ""}">${blocks.map(block).join("")}</div>`
      }</div>
      <footer class="paper-footer"><span>${esc(pub.autor || "Equipo CERI")} · ${formatearFecha(pub.fecha)}</span><b>${pad(i)} / ${pad(total - 1)}</b></footer></article>`;
  }

  function cover(pub) {
    return `<div class="edition-cover" aria-hidden="true">${page(pub, pub.editorial.paginas[0], 0)}</div>`;
  }

  class Reader {
    constructor(host, pub) {
      this.host = host;
      this.abort = new AbortController();
      this.index = 0;
      this.turning = false;
      this.textMode = false;
      this.root = document.createElement("div");
      this.root.className = "editorial-reader";
      this.root.tabIndex = -1;
      this.root.setAttribute("aria-label", "Lector del informe");
      host.replaceChildren(this.root);
      this.root.innerHTML = `<div class="reader-top"><div><span class="eyebrow">Sala de lectura</span><h3 class="reader-issue-title"></h3></div><div class="reader-tools"><div class="reader-mode" aria-label="Modo de lectura"><button type="button" data-action="pages" aria-pressed="true">Páginas</button><button type="button" data-action="text" aria-pressed="false">Texto</button></div><button class="reader-expand" type="button" data-action="expand" aria-label="Ampliar lector">⤢ <span>Ampliar</span></button></div></div>
      <div class="reader-layout"><aside class="reader-sidebar"><p class="eyebrow">En esta edición</p><div class="reader-chapters"></div><p class="reader-archive-note"></p></aside>
      <div class="reader-main"><div class="reader-book"><div class="reader-stage"><div class="reader-side reader-side--left"></div><div class="reader-side reader-side--right"></div><div class="reader-spine" aria-hidden="true"></div></div></div>
      <div class="reader-navigation"><button type="button" data-action="previous" aria-label="Páginas anteriores">← <span>Anterior</span></button><div><label class="sr-only" for="reader-page-${host.id}">Ir a página</label><select id="reader-page-${host.id}" class="reader-page-select"></select><span class="reader-total"></span></div><button type="button" data-action="next" aria-label="Páginas siguientes"><span>Siguiente</span> →</button></div><div class="reader-progress" role="presentation"><span></span></div><div class="reader-bottom"><span>Desliza o usa las teclas ← →</span><span class="reader-live" aria-live="polite" aria-atomic="true"></span></div></div></div>
      <div class="reader-text" hidden></div><div class="reader-thumbnails" aria-label="Vista previa de páginas"></div>`;
      this.stage = this.root.querySelector(".reader-stage");
      this.left = this.root.querySelector(".reader-side--left");
      this.right = this.root.querySelector(".reader-side--right");
      const opts = { signal: this.abort.signal };
      this.root.addEventListener(
        "click",
        e => {
          const button = e.target.closest("[data-action]");
          if (button) {
            const a = button.dataset.action;
            if (a === "next") this.go(this.index + this.step);
            if (a === "previous") this.go(this.index - this.step);
            if (a === "text" || a === "pages") this.mode(a === "text");
            if (a === "expand") this.fullscreen(!this.expanded);
          }
          const jump = e.target.closest("[data-reader-page]");
          if (jump) this.go(Number(jump.dataset.readerPage));
        },
        opts
      );
      this.root
        .querySelector(".reader-page-select")
        .addEventListener("change", e => this.go(Number(e.target.value)), opts);
      this.root.addEventListener(
        "keydown",
        e => {
          if (e.key === "Escape" && this.expanded) {
            this.fullscreen(false);
            return;
          }
          if (e.target.matches("select,input,textarea")) return;
          if (!this.textMode && ["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            this.go(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? this.pages.length - 1
                  : this.index + (e.key === "ArrowRight" ? this.step : -this.step)
            );
          }
          if (e.key === "Tab" && this.expanded) {
            const buttons = [...this.root.querySelectorAll("button:not(:disabled),select,a[href]")].filter(
              el => el.getClientRects().length
            );
            if (e.shiftKey && document.activeElement === buttons[0]) {
              e.preventDefault();
              buttons.at(-1).focus();
            }
            if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
              e.preventDefault();
              buttons[0].focus();
            }
          }
        },
        opts
      );
      let start;
      this.stage.addEventListener(
        "pointerdown",
        e => {
          if (e.pointerType !== "mouse") start = { x: e.clientX, y: e.clientY };
        },
        opts
      );
      this.stage.addEventListener(
        "pointerup",
        e => {
          if (!start) return;
          const dx = e.clientX - start.x,
            dy = e.clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3)
            this.go(this.index + (dx < 0 ? this.step : -this.step));
          start = null;
        },
        opts
      );
      this.stage.addEventListener(
        "pointercancel",
        () => {
          start = null;
        },
        opts
      );
      this.observer = new ResizeObserver(() => {
        const spread = this.root.querySelector(".reader-main").clientWidth >= 680;
        if (spread !== this.spread) {
          this.cancel();
          this.spread = spread;
          this.step = spread ? 2 : 1;
          this.index = this.normal(this.index);
          this.paint();
        }
      });
      this.observer.observe(this.root.querySelector(".reader-main"));
      this.set(pub);
    }
    normal(i) {
      const target = clamp(i, 0, this.pages.length - 1);
      return this.spread ? target - (target % 2) : target;
    }
    set(pub) {
      this.cancel();
      this.pub = pub;
      this.pages = pub.editorial.paginas;
      this.html = this.pages.map((p, i) => page(pub, p, i));
      this.index = 0;
      this.spread = this.root.querySelector(".reader-main").clientWidth >= 680;
      this.step = this.spread ? 2 : 1;
      this.root.querySelector(".reader-issue-title").textContent = pub.titulo;
      this.root.querySelector(".reader-archive-note").textContent =
        pub.editorial.nota || `${pub.autor} · ${formatearFecha(pub.fecha)}`;
      this.root.querySelector(".reader-chapters").innerHTML = this.pages
        .map(
          (p, i) =>
            `<button type="button" data-reader-page="${i}"><span>${pad(i)}</span>${esc(p.tipo === "portada" ? "Portada" : p.titulo)}</button>`
        )
        .join("");
      this.root.querySelector(".reader-page-select").innerHTML = this.pages
        .map((_, i) => `<option value="${i}">${pad(i)}</option>`)
        .join("");
      this.root.querySelector(".reader-total").textContent = ` / ${pad(this.pages.length - 1)}`;
      this.root.querySelector(".reader-thumbnails").innerHTML = this.pages
        .map(
          (p, i) =>
            `<button type="button" data-reader-page="${i}" aria-label="Ir a página ${i + 1}: ${esc(p.titulo)}"><span class="reader-thumb">${p.miniatura || p.imagen ? `<img src="${esc(rutaImagen(p.miniatura || p.imagen))}" alt="" loading="lazy">` : `<span class="reader-thumb__lines">CERI<br>—<br>——<br>——</span>`}</span><span>${pad(i)}</span></button>`
        )
        .join("");
      this.root.querySelector(".reader-text").innerHTML = "";
      if (this.textMode) this.mode(true);
      this.paint();
    }
    paint() {
      this.root.classList.toggle("reader--spread", !!this.spread);
      this.left.innerHTML = this.html[this.index];
      this.right.innerHTML =
        this.html[this.index + 1] ||
        '<div class="paper paper--end"><span>CERI</span><p>Relaciones internacionales<br>Universidad Nacional de Trujillo</p></div>';
      this.right.hidden = !this.spread;
      this.update();
      requestAnimationFrame(() => this.fit());
      const next = this.pages.slice(this.index, this.index + this.step + 2);
      next.forEach(p => {
        const sources = [
          p.imagen,
          ...(p.bloques || []).filter(b => b.tipo === "imagen").map(b => b.src)
        ].filter(Boolean);
        sources.forEach(src => {
          const image = new Image();
          image.src = rutaImagen(src);
        });
      });
    }
    update() {
      const last = Math.min(this.index + this.step, this.pages.length);
      this.root.querySelector('[data-action="previous"]').disabled = this.index === 0 || this.turning;
      this.root.querySelector('[data-action="next"]').disabled =
        this.index + this.step >= this.pages.length || this.turning;
      this.root.querySelector(".reader-page-select").value = this.index;
      this.root.querySelector(".reader-live").textContent = this.spread
        ? `Páginas ${this.index + 1}–${last} de ${this.pages.length}`
        : `Página ${this.index + 1} de ${this.pages.length}`;
      this.root.querySelector(".reader-progress span").style.width = `${(last / this.pages.length) * 100}%`;
      this.root
        .querySelectorAll("[data-reader-page]")
        .forEach(b =>
          b.setAttribute(
            "aria-current",
            Number(b.dataset.readerPage) >= this.index && Number(b.dataset.readerPage) < last
              ? "page"
              : "false"
          )
        );
    }
    fitPaper(paper) {
      const body = paper?.querySelector(".paper-content");
      if (!body) return false;
      const overflowY = body.scrollHeight - body.clientHeight,
        overflowX = body.scrollWidth - body.clientWidth;
      if (overflowY < 3 && overflowX < 3) return false;
      const imageScale = Number(paper.style.getPropertyValue("--image-scale") || 1);
      const typeScale = Number(paper.style.getPropertyValue("--type-scale") || 1);
      const photos = [...body.querySelectorAll(".paper-photo")].reduce(
        (h, p) => h + p.getBoundingClientRect().height,
        0
      );
      const excess = Math.max(overflowY, overflowX) / Math.max(body.scrollHeight, body.clientWidth, 1);
      const nextImage = photos ? Math.max(0.38, imageScale * (1 - Math.min(0.18, excess * 0.9))) : imageScale;
      const nextType = Math.max(0.72, typeScale * (1 - Math.min(0.1, excess * (photos ? 0.3 : 0.8))));
      paper.style.setProperty("--type-scale", String(nextType));
      paper.style.setProperty("--image-scale", String(nextImage));
      return nextImage < imageScale - 0.001 || nextType < typeScale - 0.001;
    }
    fit() {
      const token = (this.fitToken = (this.fitToken || 0) + 1);
      this.root.querySelectorAll(".reader-side .paper").forEach(paper => {
        paper.style.setProperty("--type-scale", "1");
        paper.style.setProperty("--image-scale", "1");
        const step = attempt => {
          if (!paper.isConnected || token !== this.fitToken || attempt > 15) return;
          if (this.fitPaper(paper)) requestAnimationFrame(() => step(attempt + 1));
        };
        requestAnimationFrame(() => step(0));
      });
    }
    sized(index) {
      if (!this.html[index]) return '<div class="paper paper--end">CERI</div>';
      const box = document.createElement("div");
      box.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;width:" +
        this.left.clientWidth +
        "px;height:" +
        this.stage.clientHeight +
        "px";
      box.innerHTML = this.html[index];
      this.stage.append(box);
      this.fitPaper(box.firstElementChild);
      const html = box.innerHTML;
      box.remove();
      return html;
    }
    go(index) {
      const target = this.normal(index);
      if (target === this.index || this.turning) return;
      if (this.textMode || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        this.index = target;
        this.paint();
        return;
      }
      this.flip(target);
    }
    flip(target) {
      this.turning = true;
      this.update();
      this.stage.setAttribute("aria-busy", "true");
      const forward = target > this.index,
        direction = forward ? 1 : -1;
      const w = this.left.clientWidth,
        h = this.stage.clientHeight;
      const count = this.spread ? 12 : 9,
        sw = w / count;
      const current = this.spread
        ? forward
          ? this.right.innerHTML
          : this.left.innerHTML
        : this.left.innerHTML;
      const backside = this.sized(this.spread ? target + (forward ? 0 : 1) : target);
      if (this.spread) {
        this.left.innerHTML = this.html[forward ? this.index : target];
        this.right.innerHTML =
          this.html[forward ? target + 1 : this.index + 1] || '<div class="paper paper--end">CERI</div>';
      } else this.left.innerHTML = this.html[target];
      this.fit();
      const mesh = document.createElement("div");
      mesh.className = "reader-mesh";
      mesh.setAttribute("aria-hidden", "true");
      const strips = [];
      for (let i = 0; i < count; i++) {
        const source = forward ? i : count - 1 - i,
          reversed = count - 1 - source;
        const strip = document.createElement("div");
        strip.className = "reader-strip";
        strip.style.width = sw + 0.6 + "px";
        strip.style.height = h + "px";
        strip.innerHTML = `<div class="reader-strip__front"><div style="width:${w}px;height:${h}px;left:${-source * sw}px">${current}</div></div><div class="reader-strip__back"><div style="width:${w}px;height:${h}px;left:${-reversed * sw}px">${backside}</div></div><span class="reader-strip__shade"></span>`;
        strip.querySelectorAll("a").forEach(a => (a.tabIndex = -1));
        mesh.append(strip);
        strips.push(strip);
      }
      this.stage.append(mesh);
      this.mesh = mesh;
      const hinge = this.spread ? w : forward ? 0 : w;
      let started;
      const tick = now => {
        if (!this.turning) return;
        if (started === undefined) started = now;
        const raw = clamp((now - started) / 760, 0, 1),
          t = raw * raw * (3 - 2 * raw);
        let x = hinge,
          z = 0;
        const curl = 0.72 * Math.sin(Math.PI * t);
        strips.forEach((strip, i) => {
          const theta = direction * (-Math.PI * t + curl * (i / (count - 1) - 0.5));
          const dx = direction * Math.cos(theta) * sw,
            dz = -direction * Math.sin(theta) * sw;
          strip.style.transform = `translate3d(${x + dx / 2 - sw / 2}px,0,${z + dz / 2}px) rotateY(${theta}rad)`;
          strip.style.setProperty(
            "--fold-shade",
            String(Math.sin(Math.PI * t) * (0.16 + (0.22 * i) / count))
          );
          x += dx;
          z += dz;
        });
        this.stage.style.setProperty("--turn-shadow", String(Math.sin(Math.PI * t) * 0.3));
        if (raw < 1) this.frame = requestAnimationFrame(tick);
        else {
          this.cancel();
          this.index = target;
          this.paint();
        }
      };
      this.frame = requestAnimationFrame(tick);
    }
    cancel() {
      cancelAnimationFrame(this.frame);
      this.mesh?.remove();
      this.mesh = null;
      this.turning = false;
      this.stage?.removeAttribute("aria-busy");
      this.stage?.style.setProperty("--turn-shadow", "0");
    }
    mode(text) {
      this.cancel();
      this.textMode = text;
      this.root.classList.toggle("reader--text", text);
      this.root.querySelector(".reader-layout").hidden = text;
      const continuous = this.root.querySelector(".reader-text");
      continuous.hidden = !text;
      if (text && !continuous.children.length) continuous.innerHTML = this.html.join("");
      this.root.querySelector('[data-action="text"]').setAttribute("aria-pressed", String(text));
      this.root.querySelector('[data-action="pages"]').setAttribute("aria-pressed", String(!text));
      this.paint();
    }
    fullscreen(expanded) {
      this.cancel();
      if (expanded) this.host.style.minHeight = this.root.offsetHeight + "px";
      else this.host.style.minHeight = "";
      this.expanded = expanded;
      this.root.classList.toggle("reader--expanded", expanded);
      document.body.classList.toggle("reader-open", expanded);
      this.root.setAttribute("role", expanded ? "dialog" : "region");
      if (expanded) this.root.setAttribute("aria-modal", "true");
      else this.root.removeAttribute("aria-modal");
      this.root.querySelector('[data-action="expand"]').innerHTML = expanded
        ? "× <span>Cerrar</span>"
        : "⤢ <span>Ampliar</span>";
      this.root
        .querySelector('[data-action="expand"]')
        .setAttribute("aria-label", expanded ? "Cerrar vista ampliada" : "Ampliar lector");
      this.root.focus({ preventScroll: true });
      this.paint();
    }
    destroy() {
      this.cancel();
      this.observer.disconnect();
      this.abort.abort();
      document.body.classList.remove("reader-open");
      this.host.replaceChildren();
    }
  }

  window.CeriEditorial = {
    page,
    cover,
    mount(host, pub) {
      host._reader?.destroy();
      const reader = new Reader(host, pub);
      host._reader = reader;
      return reader;
    },
    card(pub) {
      return `<a class="edition-card" href="#sala-de-lectura" data-edicion="${esc(pub.id)}"><div class="edition-card__visual"><span class="edition-card__issue">Edición ${esc(pub.editorial.edicion || "01")}</span>${cover(pub)}<span class="edition-card__arrow" aria-hidden="true">↗</span></div><div class="edition-card__copy"><p class="eyebrow">${esc(pub.ambito)} · ${pub.editorial.paginas.length} páginas</p><h3>${esc(pub.titulo)}</h3><p>${esc(pub.subtitulo)}</p><span class="edition-card__date">${formatearFecha(pub.fecha)} <span>Explorar edición ↗</span></span></div></a>`;
    }
  };
  window.abrirVisorEditorial = pub => {
    if (!pub?.editorial?.paginas?.length) return;
    const host = document.getElementById("lector-informes") || document.getElementById("lector-articulo");
    if (host) {
      host._reader?.pub.id === pub.id ? host._reader.go(0) : CeriEditorial.mount(host, pub);
      host.scrollIntoView({ behavior: "smooth", block: "start" });
      host._reader.root.focus({ preventScroll: true });
    }
  };
})();

/* Marca las fotos del lector cuando terminan de cargar (o fallan) para quitar el fondo animado. */
["load", "error"].forEach(tipo =>
  document.addEventListener(
    tipo,
    e => {
      if (e.target instanceof HTMLImageElement && e.target.closest(".paper-photo"))
        e.target.dataset.cargada = "";
    },
    true
  )
);
