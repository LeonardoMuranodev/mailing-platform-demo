import bcrypt from 'bcrypt';
import { dbPool } from '../config/db.js';

export async function runSeed() {
  const client = await dbPool.connect();
  console.log('🌱 Iniciando seeding de datos de prueba para GenMailer...');
  
  try {
    await client.query('BEGIN');

    // 1. Usuarios
    console.log('👤 Creando usuarios...');
    const saltRounds = 10;
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@genmailer.com';
    const adminHash = await bcrypt.hash(adminPassword, saltRounds);
    
    const genericHash = await bcrypt.hash('Usuario123!', saltRounds);

    const usuarios = [
      { nombre: 'Admin', email: adminEmail, rol: 'desarrollador', hash: adminHash },
      { nombre: 'Operador', email: 'operador@genmailer.com', rol: 'encargada', hash: genericHash },
      { nombre: 'Visor', email: 'visor@genmailer.com', rol: 'invitado', hash: genericHash },
    ];

    for (const u of usuarios) {
      await client.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [u.nombre, u.email, u.hash, u.rol]
      );
    }

    // 2. Rubros
    console.log('🏷️ Creando rubros...');
    const rubros = ['Tecnología', 'Salud', 'Educación'];
    for (const r of rubros) {
      await client.query(
        `INSERT INTO rubros (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING`,
        [r]
      );
    }

    // Obtener rubro_id de Tecnología
    const rubroRes = await client.query('SELECT id FROM rubros WHERE nombre = $1', ['Tecnología']);
    const rubroId = rubroRes.rows.length > 0 ? rubroRes.rows[0].id : null;

    // 3. Empresas y Contactos
    console.log('🏢 Creando empresas y contactos...');
    let empresaId = null;
    const empRes = await client.query(
      `INSERT INTO empresas (nombre, cuit) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
      ['Empresa Genérica S.A.', '30709328995']
    );
    if (empRes.rows.length > 0) {
      empresaId = empRes.rows[0].id;
    } else {
      const getEmp = await client.query(`SELECT id FROM empresas WHERE cuit = '30709328995'`);
      empresaId = getEmp.rows.length > 0 ? getEmp.rows[0].id : null;
    }

    const contactos = [
      { email: 'valido1@genmailer.com', estado: 'funcional' },
      { email: 'valido2@genmailer.com', estado: 'funcional' },
      { email: 'rebotado@inexistente.com', estado: 'rebotado inexistente' },
      { email: 'lleno@dominio.com', estado: 'rebotado bandeja llena' },
    ];

    for (const c of contactos) {
      await client.query(
        `INSERT INTO contactos (email, empresa_id, rubro_id, estado) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [c.email, empresaId, rubroId, c.estado]
      );
    }

    // 4. Campañas
    console.log('📧 Creando campañas y envíos en cola...');
    const campanas = [
      { asunto: 'Campaña Completada de Prueba', estado: 'completada', enviados: 2, fallidos: 1, pendientes: 0 },
      { asunto: 'Campaña En Proceso', estado: 'en_proceso', enviados: 1, fallidos: 0, pendientes: 1 },
      { asunto: 'Campaña Pausada', estado: 'pausada', enviados: 0, fallidos: 0, pendientes: 2 },
    ];

    // Obtener IDs de contactos reales para la cola
    const todosContactos = await client.query('SELECT id FROM contactos LIMIT 5');
    const contactosIds = todosContactos.rows.map(r => r.id);

    for (const camp of campanas) {
      const cRes = await client.query(
        `INSERT INTO campanas (asunto, cuerpo_html, para_todos_rubros, estado)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [camp.asunto, '<h1>Hola Mundo</h1>', true, camp.estado]
      );
      
      const campId = cRes.rows[0].id;

      // Cola de envíos simulada (solo si hay contactos)
      if (contactosIds.length >= 3) {
        if (camp.enviados > 0) {
          await client.query(
            `INSERT INTO cola_envios (campana_id, contacto_id, estado) VALUES ($1, $2, $3)`,
            [campId, contactosIds[0], 'enviado']
          );
        }
        if (camp.fallidos > 0) {
          await client.query(
            `INSERT INTO cola_envios (campana_id, contacto_id, estado) VALUES ($1, $2, $3)`,
            [campId, contactosIds[1], 'fallido']
          );
        }
        if (camp.pendientes > 0) {
          await client.query(
            `INSERT INTO cola_envios (campana_id, contacto_id, estado) VALUES ($1, $2, $3)`,
            [campId, contactosIds[2], 'pendiente']
          );
        }
      }
    }

    // 5. Cuentas SMTP
    console.log('⚙️ Creando cuentas SMTP falsas...');
    await client.query(
      `INSERT INTO cuentas_smtp (email, usuario, password_encrypted, host, puerto, limite_diario, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      ['noreply1@genmailer.com', 'noreply1@genmailer.com', 'dummy_pass', 'smtp.gmail.com', 465, 400, 'activo']
    );

    await client.query(
      `INSERT INTO cuentas_smtp (email, usuario, password_encrypted, host, puerto, limite_diario, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      ['quemada@genmailer.com', 'quemada@genmailer.com', 'dummy_pass2', 'smtp.gmail.com', 465, 400, 'bloqueado']
    );

    // 6. Logs SMTP
    console.log('📝 Creando logs de cuentas quemadas...');
    const cuentaQuemaRes = await client.query(`SELECT id FROM cuentas_smtp WHERE email = 'quemada@genmailer.com'`);
    if (cuentaQuemaRes.rows.length > 0) {
      await client.query(
        `INSERT INTO smtp_logs (cuenta_id, tipo_error, mensaje, contexto)
         VALUES ($1, $2, $3, $4)`,
        [cuentaQuemaRes.rows[0].id, 'limite_alcanzado', 'Limit Exceeded: Daily quota reached', '{"code": "454", "command": "DATA"}']
      );
    }

    // 7. Reportes de Soporte
    console.log('🎫 Creando tickets de soporte...');
    await client.query(
      `INSERT INTO reportes_soporte (asunto, descripcion, estado)
       VALUES ($1, $2, $3)`,
      ['Problema visual en Safari', 'El botón no se alinea correctamente', 'abierto']
    );
    await client.query(
      `INSERT INTO reportes_soporte (asunto, descripcion, estado)
       VALUES ($1, $2, $3)`,
      ['Importación CSV', 'La importación de CSV dio error en la línea 40', 'en_progreso']
    );

    await client.query('COMMIT');
    console.log('✅ Seeding completado exitosamente!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante el seeding:', err);
  } finally {
    client.release();
    // pool.end(); ya no lo llamamos porque cerramos el pool principal
  }
}
// Ya no se ejecuta automáticamente al importar
// runSeed();
