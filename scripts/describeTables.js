const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});
async function describeTables() {
  try {
    const res = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name = 'campanas' OR table_name = 'cola_envios'");
    console.log(res.rows);
  } catch (err) {
    console.error(err.message);
  } finally {
    pool.end();
  }
}
describeTables();
