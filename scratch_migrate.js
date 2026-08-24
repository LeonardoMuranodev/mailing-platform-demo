const fs = require('fs');
const { Client } = require('pg');

async function runMigration() {
  const connectionString = "postgresql://postgres:0OzFo8Ya11Bdwfcg@db.flfnbtakmmewviamblyo.supabase.co:5432/postgres";
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Conectado a la base de datos');
    const sql = fs.readFileSync('src/migrations/003_usuarios.sql', 'utf8');
    await client.query(sql);
    console.log('Migración 003 ejecutada exitosamente');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

runMigration();
