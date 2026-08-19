import { dbPool } from './src/config/db.js';
dbPool.query("UPDATE contactos SET estado = 'funcional' WHERE estado = 'activo'")
  .then(res => console.log(`Actualizados ${res.rowCount} contactos.`))
  .catch(console.error)
  .finally(() => dbPool.end());
