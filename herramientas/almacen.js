/* Almacenamiento en archivos: escrituras atómicas, respaldos, publicaciones privadas
   y registro de actividad. Todas las escrituras pasan por una única cola. */
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const Colecciones = require("../admin/colecciones.js");

const COLECCIONES_PUBLICAS = ["sitio", "eventos", "participacion", "alianzas", "equipo", "convocatoria"];
const MAX_RESPALDOS = 30;
const digest = value => crypto.createHash("sha256").update(value).digest("hex");

async function existe(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function crearAlmacen({ root, dataDir }) {
  const contenido = path.join(dataDir, "contenido");
  const privado = path.join(dataDir, ".ceri");
  // Datos del equipo que se comparten por Git: cuentas (sin contraseñas, solo su huella scrypt)
  // y todas las publicaciones, incluidos los borradores. Nunca se sirven por la web.
  const equipo = path.join(dataDir, "datos-equipo");
  const respaldos = path.join(privado, "backups");
  const subidas = path.join(dataDir, "assets", "img", "subidas");
  const publicacionesPrivadas = path.join(equipo, "publicaciones.json");
  const publicacionesPublicas = path.join(contenido, "publicaciones.json");
  const auditoria = path.join(privado, "auditoria.jsonl");
  let cola = Promise.resolve();

  /* Ejecuta las escrituras de una en una para evitar que dos guardados se pisen. */
  function enSerie(trabajo) {
    const resultado = cola.then(trabajo);
    cola = resultado.catch(() => {});
    return resultado;
  }

  async function leerJSON(file) {
    const raw = await fs.readFile(file, "utf8");
    return { datos: JSON.parse(raw), raw, revision: digest(raw) };
  }

  async function escribirAtomico(file, datos, modo) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.mkdir(privado, { recursive: true });
    const temporal = path.join(privado, `tmp-${crypto.randomUUID()}.json`);
    try {
      await fs.writeFile(temporal, JSON.stringify(datos, null, 2) + "\n", modo ? { mode: modo } : undefined);
      await fs.rename(temporal, file);
    } finally {
      await fs.unlink(temporal).catch(() => {});
    }
  }

  async function respaldar(nombre, raw) {
    await fs.mkdir(respaldos, { recursive: true });
    const archivo = `${nombre}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.json`;
    await fs.writeFile(path.join(respaldos, archivo), raw, { mode: 0o600 });
    const lista = (await fs.readdir(respaldos))
      .filter(f => f.startsWith(nombre + "-") && /^[a-z]+-\d+-[a-f0-9]+\.json$/.test(f))
      .sort()
      .reverse();
    await Promise.all(
      lista.slice(MAX_RESPALDOS).map(f => fs.unlink(path.join(respaldos, f)).catch(() => {}))
    );
  }

  const soloPublicadas = items =>
    items
      .filter(p => p && p.estado === "publicado")
      .map(p => {
        const { meta, ...publico } = p;
        return publico;
      });

  async function exportarPublicas(items) {
    await escribirAtomico(publicacionesPublicas, { items: soloPublicadas(items) });
  }

  /* Prepara las carpetas. Si los datos viven fuera del proyecto, copia el contenido inicial.
     Los borradores pasan al almacén privado y el archivo público queda solo con lo publicado. */
  async function iniciar() {
    await fs.mkdir(privado, { recursive: true, mode: 0o700 });
    await fs.mkdir(subidas, { recursive: true });
    await fs.mkdir(contenido, { recursive: true });
    await fs.mkdir(equipo, { recursive: true });
    if (path.resolve(dataDir) !== path.resolve(root)) {
      for (const nombre of [...COLECCIONES_PUBLICAS, "publicaciones"]) {
        const destino = path.join(contenido, nombre + ".json");
        const origen = path.join(root, "contenido", nombre + ".json");
        if (!(await existe(destino)) && (await existe(origen))) await fs.copyFile(origen, destino);
      }
    }
    await enSerie(async () => {
      // Versión anterior: las publicaciones vivían solo en .ceri/ de cada computadora.
      const anterior = path.join(privado, "publicaciones.json");
      if (await existe(anterior)) {
        const viejas = (await leerJSON(anterior)).datos.items || [];
        if (!(await existe(publicacionesPrivadas)))
          await escribirAtomico(publicacionesPrivadas, { items: viejas });
        else {
          const actual = await leerJSON(publicacionesPrivadas);
          const ids = new Set((actual.datos.items || []).map(p => p.id));
          const nuevas = viejas.filter(p => p && p.id && !ids.has(p.id));
          if (nuevas.length)
            await escribirAtomico(publicacionesPrivadas, { items: [...actual.datos.items, ...nuevas] });
        }
        await fs.rename(anterior, anterior + ".migrado");
      }
      const publico = (await existe(publicacionesPublicas))
        ? (await leerJSON(publicacionesPublicas)).datos.items || []
        : [];
      if (!(await existe(publicacionesPrivadas))) {
        await escribirAtomico(publicacionesPrivadas, { items: publico });
      } else {
        // Importa publicaciones que llegaron por Git y aún no están en el almacén privado.
        const privadas = await leerJSON(publicacionesPrivadas);
        const ids = new Set((privadas.datos.items || []).map(p => p.id));
        const nuevas = publico.filter(p => p && p.id && !ids.has(p.id));
        if (nuevas.length) {
          await respaldar("publicaciones", privadas.raw);
          await escribirAtomico(publicacionesPrivadas, { items: [...nuevas, ...privadas.datos.items] });
        }
      }
      const actuales = (await leerJSON(publicacionesPrivadas)).datos.items || [];
      const esperado = JSON.stringify({ items: soloPublicadas(actuales) }, null, 2) + "\n";
      const presente = (await existe(publicacionesPublicas))
        ? await fs.readFile(publicacionesPublicas, "utf8")
        : "";
      if (presente !== esperado) await exportarPublicas(actuales);
    });
  }

  const publicaciones = {
    async leer() {
      const { datos, revision, raw } = await leerJSON(publicacionesPrivadas);
      return { items: Array.isArray(datos.items) ? datos.items : [], revision, raw };
    },
    /* cambiar(items) recibe la lista actual y devuelve la nueva; se ejecuta dentro de la cola. */
    actualizar(revisionEsperada, cambiar) {
      return enSerie(async () => {
        const actual = await publicaciones.leer();
        if (revisionEsperada !== undefined && revisionEsperada !== actual.revision) {
          const error = new Error("conflicto");
          error.conflicto = true;
          throw error;
        }
        const items = await cambiar(structuredClone(actual.items));
        await respaldar("publicaciones", actual.raw);
        await escribirAtomico(publicacionesPrivadas, { items });
        await exportarPublicas(items);
        return publicaciones.leer();
      });
    },
    async publicas() {
      try {
        return (await leerJSON(publicacionesPublicas)).datos.items || [];
      } catch {
        return [];
      }
    }
  };

  const colecciones = {
    nombres: COLECCIONES_PUBLICAS,
    archivo: nombre => path.join(contenido, nombre + ".json"),
    async leer(nombre) {
      try {
        return await leerJSON(colecciones.archivo(nombre));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        const def = Colecciones.COLECCIONES[nombre];
        return { datos: def.tipo === "lista" ? { items: [] } : {}, raw: "", revision: digest("") };
      }
    },
    guardar(nombre, revisionEsperada, datos) {
      return enSerie(async () => {
        const actual = await colecciones.leer(nombre);
        if (revisionEsperada !== actual.revision) {
          const error = new Error("conflicto");
          error.conflicto = true;
          throw error;
        }
        if (actual.raw) await respaldar(nombre, actual.raw);
        await escribirAtomico(colecciones.archivo(nombre), datos);
        return colecciones.leer(nombre);
      });
    }
  };

  const copias = {
    async listar() {
      const archivos = await fs.readdir(respaldos).catch(() => []);
      const lista = [];
      for (const nombre of archivos) {
        const m = /^([a-z]+)-(\d+)-[a-f0-9]+\.json$/.exec(nombre);
        if (!m) continue;
        const stat = await fs.stat(path.join(respaldos, nombre));
        lista.push({
          nombre,
          coleccion: m[1],
          fecha: new Date(Number(m[2])).toISOString(),
          tamano: stat.size
        });
      }
      return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
    },
    ruta(nombre) {
      if (!/^[a-z]+-\d+-[a-f0-9]+\.json$/.test(nombre)) return null;
      return path.join(respaldos, nombre);
    },
    /* Restaura un respaldo. El estado actual se respalda antes, así que la restauración se puede deshacer. */
    async restaurar(nombre) {
      const ruta = copias.ruta(nombre);
      if (!ruta || !(await existe(ruta))) throw Object.assign(new Error("noexiste"), { noExiste: true });
      const coleccion = nombre.split("-")[0];
      const { datos } = await leerJSON(ruta);
      if (coleccion === "publicaciones") {
        if (!Array.isArray(datos.items)) throw Object.assign(new Error("invalido"), { invalido: true });
        return publicaciones.actualizar(undefined, () => datos.items);
      }
      if (!COLECCIONES_PUBLICAS.includes(coleccion))
        throw Object.assign(new Error("invalido"), { invalido: true });
      const { errores, datos: limpio } = Colecciones.validar(coleccion, datos);
      if (errores.length) throw Object.assign(new Error("invalido"), { invalido: true, errores });
      const actual = await colecciones.leer(coleccion);
      return colecciones.guardar(coleccion, actual.revision, limpio);
    }
  };

  const registro = {
    async anotar(usuario, accion, detalle = "") {
      const linea = JSON.stringify({
        fecha: new Date().toISOString(),
        usuario: usuario ? usuario.usuario : "sistema",
        nombre: usuario ? usuario.nombre : "Sistema",
        accion,
        detalle: String(detalle).slice(0, 300)
      });
      await fs.mkdir(privado, { recursive: true });
      await fs.appendFile(auditoria, linea + "\n", { mode: 0o600 });
      const stat = await fs.stat(auditoria);
      if (stat.size > 2 * 1024 * 1024) {
        const lineas = (await fs.readFile(auditoria, "utf8")).trim().split("\n");
        await fs.writeFile(auditoria, lineas.slice(-5000).join("\n") + "\n", { mode: 0o600 });
      }
    },
    async leer(limite = 300) {
      const texto = await fs.readFile(auditoria, "utf8").catch(() => "");
      return texto
        .trim()
        .split("\n")
        .filter(Boolean)
        .slice(-limite)
        .reverse()
        .map(linea => {
          try {
            return JSON.parse(linea);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
  };

  /* Archivo JSON genérico. Privado (.ceri/, solo esta computadora) o del equipo (datos-equipo/, va a Git). */
  const archivoPrivado = (nombre, inicial) => archivoEn(privado, nombre, inicial, 0o600);
  const archivoEquipo = (nombre, inicial) => archivoEn(equipo, nombre, inicial, undefined);
  function archivoEn(carpeta, nombre, inicial, modo) {
    const file = path.join(carpeta, nombre);
    const archivo = {
      file,
      async leer() {
        try {
          return JSON.parse(await fs.readFile(file, "utf8"));
        } catch (error) {
          if (error.code === "ENOENT") return structuredClone(inicial);
          throw error;
        }
      },
      escribir: datos => escribirAtomico(file, datos, modo),
      actualizar: cambiar =>
        enSerie(async () => {
          const datos = await archivo.leer();
          const resultado = await cambiar(datos);
          await escribirAtomico(file, datos, modo);
          return resultado;
        })
    };
    return archivo;
  }

  return {
    rutas: { contenido, privado, equipo, respaldos, subidas, dataDir, root },
    iniciar,
    enSerie,
    publicaciones,
    colecciones,
    copias,
    registro,
    archivoPrivado,
    archivoEquipo,
    existe
  };
}

module.exports = { crearAlmacen, COLECCIONES_PUBLICAS };
