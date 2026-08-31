import { dbPool } from './src/config/db.js';
import { poblarColaEnvios } from './src/services/queueService.js';

async function run() {
  try {
    const res = await dbPool.query("SELECT id FROM campanas WHERE estado = 'aprobada'");
    for (const row of res.rows) {
      console.log('Poblando cola para:', row.id);
      await poblarColaEnvios(row.id);
    }
    console.log('¡Listo!');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
