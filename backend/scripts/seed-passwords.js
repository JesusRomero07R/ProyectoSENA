/**
 * Sustituye password_hash de todos los usuarios por un hash bcrypt de una misma contraseña.
 * Útil tras importar inserts.sql (hash_admin, hash_lider, etc. no son válidos para bcrypt).
 *
 * Uso: node scripts/seed-passwords.js "TuContraseñaSegura"
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { getPool } = require("../src/config/db");

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('Uso: node scripts/seed-passwords.js "contraseña_común_para_todos"');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const pool = getPool();
  const [result] = await pool.query("UPDATE usuarios SET password_hash = ?", [hash]);
  console.log(`Actualizados ${result.affectedRows} usuario(s).`);
}

main().catch((err) => {
  if (err.code === "ER_NO_SUCH_TABLE") {
    console.error(`
No existe la tabla indicada. Primero debes crear el esquema y cargar datos en MySQL.

1) Desde la raíz del repositorio (carpeta donde está "PROYECTO SENA/"), con un usuario
   que pueda crear/borrar bases (normalmente root o: sudo mysql):

   mysql -u root -p < "PROYECTO SENA/BASE DE DATOS/constructora_gg v1.sql"
   mysql -u root -p constructora_gg < "PROYECTO SENA/BASE DE DATOS/inserts.sql"

   Nota: el primer archivo hace DROP/CREATE de la base; el usuario de la app
   (constructora_app) a veces no tiene permiso para eso — por eso se usa root o sudo.

2) Vuelve a ejecutar:

   npm run seed-passwords -- "TuContraseña"
`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
