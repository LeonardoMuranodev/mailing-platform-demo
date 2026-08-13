import { dbPool } from '../config/db.js';

async function seed() {
  console.log('Iniciando seed de campañas y cola de envíos...');
  
  try {
    console.log('Verificando/Creando tabla contactos si no existe...');
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS contactos (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        empresa_nombre TEXT,
        email TEXT UNIQUE NOT NULL,
        tipo TEXT,
        estado VARCHAR(50) DEFAULT 'activo',
        rubro_id TEXT,
        creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // 1. Crear campañas de prueba con distintos estados
    const campanas = [
      {
        asunto: '🚀 ¡Lanzamiento de nuevo programa para Pymes!',
        cuerpo_html: '<h1>Nuevo Programa</h1><p>Te invitamos a sumarte a nuestro nuevo plan de financiamiento.</p>',
        estado: 'borrador',
        fecha_limite_envio: '2026-10-01',
        para_todos_rubros: true,
        rubros_seleccionados: '[]',
      },
      {
        asunto: '📊 Reporte Mensual de Industria - Agosto',
        cuerpo_html: '<h1>Reporte de Agosto</h1><p>Adjuntamos el informe estadístico del mes pasado.</p>',
        estado: 'en_proceso',
        fecha_limite_envio: '2026-08-30',
        para_todos_rubros: false,
        rubros_seleccionados: '["metalmecanica", "industria", "fundicion"]',
      },
      {
        asunto: '🎉 Invitación: Cena de Fin de Año de Comerciantes',
        cuerpo_html: '<h1>¡Festejamos el cierre del año!</h1><p>Reserva tu lugar antes del 15 de diciembre.</p>',
        estado: 'completada',
        fecha_limite_envio: '2025-12-10',
        para_todos_rubros: false,
        rubros_seleccionados: '["comercio", "servicios"]',
      },
      {
        asunto: '⚠️ Aviso Importante: Mantenimiento del Sistema',
        cuerpo_html: '<h1>Corte programado</h1><p>El próximo fin de semana habrá una ventana de mantenimiento en AFIP.</p>',
        estado: 'aprobada',
        fecha_limite_envio: '2026-09-15',
        para_todos_rubros: true,
        rubros_seleccionados: '[]',
      },
      {
        asunto: '❌ Cancelado: Taller de Robótica Industrial',
        cuerpo_html: '<h1>Taller Cancelado</h1><p>Lamentamos informar que el evento fue suspendido por fuerza mayor.</p>',
        estado: 'cancelada',
        fecha_limite_envio: '2026-07-20',
        para_todos_rubros: false,
        rubros_seleccionados: '["electronica", "informatica"]',
      }
    ];

    console.log('Insertando campañas...');
    const insertedCampanas = [];
    for (const c of campanas) {
      const res = await dbPool.query(
        `INSERT INTO campanas (asunto, cuerpo_html, estado, fecha_limite_envio, para_todos_rubros, rubros_seleccionados) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [c.asunto, c.cuerpo_html, c.estado, c.fecha_limite_envio, c.para_todos_rubros, c.rubros_seleccionados]
      );
      insertedCampanas.push(res.rows[0].id);
    }

    // 2. Insertar algunos contactos falsos si no existen
    console.log('Insertando contactos de prueba...');
    const contactos = [
      'empresaA@test.com', 'proveedorB@test.com', 'comercioC@test.com', 
      'industriaD@test.com', 'serviciosE@test.com', 'tecnologiaF@test.com',
      'logisticaG@test.com', 'ventasH@test.com', 'marketingI@test.com',
      'consultoraJ@test.com'
    ];

    const insertedContactos = [];
    for (const email of contactos) {
      const res = await dbPool.query(
        `INSERT INTO contactos (email, empresa_nombre, tipo, estado, rubro_id) 
         VALUES ($1, $2, 'empresa', 'activo', null) 
         ON CONFLICT (email) DO UPDATE SET estado = 'activo'
         RETURNING id`,
        [email, `Empresa ${email.split('@')[0]}`]
      );
      insertedContactos.push(res.rows[0].id);
    }

    // 3. Crear registros en la cola de envíos para la campaña "en_proceso" (índice 1)
    const campanaEnProcesoId = insertedCampanas[1];
    console.log(`Poblando cola de envíos para la campaña: ${campanaEnProcesoId}`);
    
    // Asignaremos distintos estados a la cola
    const estados = ['enviado', 'enviado', 'enviado', 'enviado', 'fallido', 'pendiente', 'pendiente', 'procesando', 'pendiente', 'fallido'];
    
    for (let i = 0; i < insertedContactos.length; i++) {
      const contactoId = insertedContactos[i];
      const estado = estados[i];
      
      let fecha_envio = null;
      let respuesta_smtp = null;
      
      if (estado === 'enviado') {
        fecha_envio = new Date().toISOString();
        respuesta_smtp = '250 2.0.0 OK';
      } else if (estado === 'fallido') {
        fecha_envio = new Date().toISOString();
        respuesta_smtp = '550 5.1.1 The email account that you tried to reach does not exist.';
      }
      
      await dbPool.query(
        `INSERT INTO cola_envios (campana_id, contacto_id, estado, intentos, fecha_envio, respuesta_smtp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [campanaEnProcesoId, contactoId, estado, estado === 'enviado' || estado === 'fallido' ? 1 : 0, fecha_envio, respuesta_smtp]
      );
    }

    // 4. Crear registros en la cola para la campaña completada (índice 2)
    const campanaCompletadaId = insertedCampanas[2];
    console.log(`Poblando cola de envíos para la campaña completada: ${campanaCompletadaId}`);
    
    for (let i = 0; i < 5; i++) {
      const contactoId = insertedContactos[i];
      await dbPool.query(
        `INSERT INTO cola_envios (campana_id, contacto_id, estado, intentos, fecha_envio, respuesta_smtp)
         VALUES ($1, $2, 'enviado', 1, $3, '250 2.0.0 OK')`,
        [campanaCompletadaId, contactoId, new Date(Date.now() - 86400000 * 2).toISOString()]
      );
    }

    console.log('✅ Seed completado con éxito.');
  } catch (err) {
    console.error('❌ Error en el seed:', err);
  } finally {
    await dbPool.end();
  }
}

seed();
