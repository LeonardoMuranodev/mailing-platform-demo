import bcrypt from 'bcrypt';
import { dbPool } from '../config/db.js';
import { encrypt } from '../utils/encryption.js';

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

    // Obtener mapa de rubros para asignarlos dinámicamente
    const rubrosMap = new Map();
    const rubrosQuery = await client.query('SELECT id, nombre FROM rubros');
    for (const r of rubrosQuery.rows) {
      rubrosMap.set(r.nombre, r.id);
    }

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
      { email: 'contacto_tech1@empresa.com', estado: 'funcional', rubro: 'Tecnología' },
      { email: 'contacto_tech2@empresa.com', estado: 'funcional', rubro: 'Tecnología' },
      { email: 'rrhh@salud-clinica.com', estado: 'funcional', rubro: 'Salud' },
      { email: 'directora@escuela-primaria.edu', estado: 'funcional', rubro: 'Educación' },
      { email: 'rebotado@inexistente.com', estado: 'rebotado inexistente', rubro: 'Tecnología' },
      { email: 'lleno@dominio.com', estado: 'rebotado bandeja llena', rubro: 'Salud' },
      { email: 'spam_trap@catchall.com', estado: 'rebotado spam', rubro: null },
      { email: 'viejo_contacto@empresa.com', estado: 'inactivo', rubro: 'Educación' },
      { email: 'ceo@startup-tech.com', estado: 'funcional', rubro: 'Tecnología' },
      { email: 'ventas@distribuidora.com', estado: 'funcional', rubro: null },
      { email: 'info@salud-clinica.com', estado: 'funcional', rubro: 'Salud' },
      { email: 'contacto@escuela-secundaria.edu', estado: 'funcional', rubro: 'Educación' },
    ];

    for (const c of contactos) {
      const cRubroId = c.rubro ? rubrosMap.get(c.rubro) : null;
      await client.query(
        `INSERT INTO contactos (email, empresa_id, rubro_id, estado) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [c.email, empresaId, cRubroId, c.estado]
      );
    }

    // 4. Campañas
    console.log('📧 Creando campañas y envíos en cola...');
    const campanas = [
      { asunto: 'Lanzamiento Nueva Plataforma', estado: 'completada', enviados: 5, fallidos: 1, pendientes: 0 },
      { asunto: 'Actualización de Términos', estado: 'completada', enviados: 8, fallidos: 0, pendientes: 0 },
      { asunto: 'Promoción de Invierno', estado: 'completada', enviados: 4, fallidos: 2, pendientes: 0 },
      { asunto: 'Boletín Mensual - Septiembre', estado: 'en_proceso', enviados: 3, fallidos: 0, pendientes: 5 },
      { asunto: 'Aviso de Mantenimiento', estado: 'pausada', enviados: 1, fallidos: 0, pendientes: 8 },
      { asunto: 'Borrador de Evento Anual', estado: 'borrador', enviados: 0, fallidos: 0, pendientes: 0 },
    ];

    // Obtener IDs de contactos reales para la cola
    const todosContactos = await client.query('SELECT id FROM contactos');
    const contactosIds = todosContactos.rows.map(r => r.id);

    for (const camp of campanas) {
      const cRes = await client.query(
        `INSERT INTO campanas (asunto, cuerpo_html, para_todos_rubros, estado, creado_en, fecha_limite_envio)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - (random() * 7 || ' days')::interval, CURRENT_TIMESTAMP + (random() * 15 || ' days')::interval)
         RETURNING id`,
        [camp.asunto, '<h1>Hola Mundo</h1>', true, camp.estado]
      );
      
      const campId = cRes.rows[0].id;

      // Cola de envíos simulada (solo si hay contactos)
      if (contactosIds.length > 0) {
        // Distribuir equitativamente los contactos aleatorios
        let cIndex = 0;
        const getNextContacto = () => contactosIds[(cIndex++) % contactosIds.length];

        for (let i = 0; i < camp.enviados; i++) {
          await client.query(
            `INSERT INTO cola_envios (campana_id, contacto_id, estado, fecha_envio) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP - (random() * 7 || ' days')::interval)`,
            [campId, getNextContacto(), 'enviado']
          );
        }
        for (let i = 0; i < camp.fallidos; i++) {
          await client.query(
            `INSERT INTO cola_envios (campana_id, contacto_id, estado, fecha_envio) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP - (random() * 7 || ' days')::interval)`,
            [campId, getNextContacto(), 'fallido']
          );
        }
        for (let i = 0; i < camp.pendientes; i++) {
          await client.query(
            `INSERT INTO cola_envios (campana_id, contacto_id, estado) 
             VALUES ($1, $2, $3)`,
            [campId, getNextContacto(), 'pendiente']
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
      ['noreply1@genmailer.com', 'noreply1@genmailer.com', encrypt('dummy_pass'), 'smtp.gmail.com', 465, 400, 'activo']
    );

    await client.query(
      `INSERT INTO cuentas_smtp (email, usuario, password_encrypted, host, puerto, limite_diario, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      ['quemada@genmailer.com', 'quemada@genmailer.com', encrypt('dummy_pass2'), 'smtp.gmail.com', 465, 400, 'bloqueado']
    );

    // 6. Logs SMTP
    console.log('📝 Creando logs de cuentas quemadas...');
    const cuentaQuemaRes = await client.query(`SELECT id FROM cuentas_smtp WHERE email = 'quemada@genmailer.com'`);
    if (cuentaQuemaRes.rows.length > 0) {
      await client.query(
        `INSERT INTO smtp_logs (cuenta_smtp_id, tipo, mensaje)
         VALUES ($1, $2, $3)`,
        [cuentaQuemaRes.rows[0].id, 'agotada', 'Limit Exceeded: Daily quota reached']
      );
    }

    // 7. Reportes de Soporte
    console.log('🎫 Creando tickets de soporte...');
    const userRes = await client.query(`SELECT id FROM usuarios LIMIT 1`);
    const adminId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

    if (adminId) {
      await client.query(
        `INSERT INTO reportes_soporte (tipo, descripcion, estado, usuario_id)
         VALUES ($1, $2, $3, $4)`,
        ['error', 'Problema visual en Safari: El botón de enviar no se alinea correctamente en dispositivos móviles', 'pendiente', adminId]
      );
      await client.query(
        `INSERT INTO reportes_soporte (tipo, descripcion, estado, usuario_id)
         VALUES ($1, $2, $3, $4)`,
        ['error', 'Importación CSV: La importación de CSV dio error en la línea 40 porque faltaba el arroba en un correo.', 'pendiente', adminId]
      );
      await client.query(
        `INSERT INTO reportes_soporte (tipo, descripcion, estado, usuario_id)
         VALUES ($1, $2, $3, $4)`,
        ['sugerencia', 'Duda sobre límite diario: Quería consultar qué pasa si supero los 400 envíos por día, se pausa la campaña automáticamente?', 'resuelto', adminId]
      );
      await client.query(
        `INSERT INTO reportes_soporte (tipo, descripcion, estado, usuario_id)
         VALUES ($1, $2, $3, $4)`,
        ['mejora', 'Editor de templates: Sería genial poder guardar templates HTML favoritos para reutilizarlos en vez de armarlos desde cero cada vez.', 'pendiente', adminId]
      );
    }

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
