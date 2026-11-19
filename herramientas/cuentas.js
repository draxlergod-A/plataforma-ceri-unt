/* Gestión de cuentas desde la terminal del servidor (útil en un alojamiento, donde no hay localhost).
   Uso:
     npm run cuentas -- listar
     npm run cuentas -- crear-admin <usuario> "<Nombre completo>"
     npm run cuentas -- restablecer <usuario>
   Las contraseñas generadas son temporales: la persona debe cambiarla al entrar. */
const { leerConfig } = require("./config.js");
const { crearAlmacen } = require("./almacen.js");
const { crearUsuarios, passwordTemporal } = require("./usuarios.js");

async function main([comando, ...args]) {
  const cfg = leerConfig();
  const almacen = crearAlmacen(cfg);
  await almacen.iniciar();
  const usuarios = crearUsuarios(almacen, { sessionHours: cfg.sessionHours });
  await usuarios.migrarLegado();

  if (comando === "listar") {
    const lista = await usuarios.lista();
    if (!lista.length)
      console.log(
        'Todavía no hay cuentas. Crea la primera con: npm run cuentas -- crear-admin <usuario> "<Nombre>"'
      );
    for (const u of lista)
      console.log(
        `${u.usuario.padEnd(20)} ${u.rol.padEnd(8)} ${u.activo === false ? "desactivada" : "activa"}   ${u.nombre}`
      );
    return;
  }
  if (comando === "crear-admin") {
    const [usuario, nombre] = args;
    const temporal = passwordTemporal();
    const nuevo = await usuarios.crear(
      { usuario, nombre, rol: "admin" },
      { password: temporal, debeCambiar: true }
    );
    await almacen.registro.anotar(null, "usuario.creado", `${nuevo.usuario} (admin) desde la terminal`);
    console.log(
      `Cuenta de administración creada: ${nuevo.usuario}\nContraseña temporal: ${temporal}\nCámbiala al iniciar sesión.`
    );
    return;
  }
  if (comando === "restablecer") {
    const u = (await usuarios.lista()).find(x => x.usuario === String(args[0] || "").toLowerCase());
    if (!u) throw new Error("No existe una cuenta con ese usuario.");
    const temporal = passwordTemporal();
    await usuarios.cambiarPassword(u.id, temporal, { debeCambiar: true });
    await usuarios.cerrarSesionesDe(u.id);
    if (u.activo === false) await usuarios.actualizar(u.id, { activo: true });
    await almacen.registro.anotar(null, "usuario.passwordRestablecida", `${u.usuario} desde la terminal`);
    console.log(`Contraseña temporal de ${u.usuario}: ${temporal}\nCámbiala al iniciar sesión.`);
    return;
  }
  console.log(
    'Comandos:\n  listar\n  crear-admin <usuario> "<Nombre completo>"\n  restablecer <usuario>\n\nEjemplo: npm run cuentas -- crear-admin presidencia "Presidencia CERI"'
  );
}

main(process.argv.slice(2)).catch(error => {
  console.error("Error:", error.message);
  process.exit(1);
});
