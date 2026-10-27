import { dbPool } from '../config/db.js';

interface SeedContacto {
  email: string;
  empresa_nombre: string;
  cuit: string;
  rubro_id: string;
  tipo: string;
  estado: 'funcional' | 'inactivo' | 'rebotado inexistente' | 'rebotado bandeja llena' | 'rebotado spam' | 'rebotado desconocido';
}

interface SeedCampana {
  asunto: string;
  cuerpo_html: string;
  link_inscripcion?: string | null;
  link_nacion?: string | null;
  link_provincia?: string | null;
  flyer_url?: string | null;
  adjunto_url?: string | null;
  adjunto_nombre_original?: string | null;
  fecha_limite_envio: string;
  creado_en: string;
  prioridad: 'alta' | 'media' | 'baja';
  para_todos_rubros: boolean;
  rubros_seleccionados: string[];
  estado: 'borrador' | 'aprobada' | 'en_proceso' | 'pausada' | 'completada' | 'cancelada';
  cola?: {
    contactosCount: number;
    distribucion: {
      enviados: number;
      fallidos: number;
      pendientes: number;
      procesando: number;
      aperturas: number;
      clics: number;
    };
    fecha_base: string; // ISO date string for envíos
  };
}

export async function runSeed() {
  console.log('🚀 Iniciando inyección de datos de prueba completos para estadísticas y campañas...');
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    console.log('🧹 Limpiando guiones residuales en CUITs de base de datos...');
    await client.query(`UPDATE contactos SET cuit = REPLACE(cuit, '-', '') WHERE cuit LIKE '%-%'`);
    await client.query(`UPDATE empresas SET cuit = REPLACE(cuit, '-', '') WHERE cuit LIKE '%-%'`);

    // 0. Obtener cuenta SMTP si existe
    const smtpRes = await client.query('SELECT id FROM cuentas_smtp LIMIT 1');
    const smtpId = smtpRes.rows[0]?.id || null;

    // 1. Limpiar datos previos de prueba en cola_envios y campanas
    console.log('🧹 Limpiando registros anteriores de cola y campañas...');
    await client.query('DELETE FROM cola_envios');
    await client.query('DELETE FROM campanas');

    // 2. Catálogo de Contactos de Prueba (24 contactos con todos los estados requeridos)
    const contactosSeed: SeedContacto[] = [
      // 14 Funcionales en diversos rubros
      { email: 'contacto@metalurgicacentral.com.ar', empresa_nombre: 'Metalúrgica Central S.A.', cuit: '23559533300', rubro_id: 'metalurgica', tipo: 'empresa', estado: 'funcional' },
      { email: 'administracion@molinos.com.ar', empresa_nombre: 'Molinos Argentinos S.A.', cuit: '23414704824', rubro_id: 'alimenticia', tipo: 'empresa', estado: 'funcional' },
      { email: 'info@innovasolutions.tech', empresa_nombre: 'Innova Solutions Tech', cuit: '30765640195', rubro_id: 'informatica', tipo: 'empresa', estado: 'funcional' },
      { email: 'ventas@hormigonespodesta.com.ar', empresa_nombre: 'Hormigones Pablo Podestá SRL', cuit: '20122409709', rubro_id: 'construccion', tipo: 'empresa', estado: 'funcional' },
      { email: 'compras@autopartessantosvega.com.ar', empresa_nombre: 'Autopartes Santos Vega', cuit: '34950168864', rubro_id: 'autopartes', tipo: 'empresa', estado: 'funcional' },
      { email: 'gerencia@distribuidorasur.com', empresa_nombre: 'Distribuidora Mayorista Sur', cuit: '24759045161', rubro_id: 'comercio', tipo: 'empresa', estado: 'funcional' },
      { email: 'contacto@plasticossanmartin.com.ar', empresa_nombre: 'Plásticos & Polímeros del Oeste', cuit: '23948863529', rubro_id: 'plastico', tipo: 'empresa', estado: 'funcional' },
      { email: 'contacto@quimicadelplata.com', empresa_nombre: 'Laboratorios Químicos del Plata', cuit: '20707636565', rubro_id: 'quimica', tipo: 'empresa', estado: 'funcional' },
      { email: 'info@textilsaenzpena.com.ar', empresa_nombre: 'Hilados y Tejidos Sáenz Peña', cuit: '24938346549', rubro_id: 'textil', tipo: 'empresa', estado: 'funcional' },
      { email: 'operaciones@logisticacentro.com', empresa_nombre: 'Logística Integral del Plata', cuit: '30633057040', rubro_id: 'transporte', tipo: 'empresa', estado: 'funcional' },
      { email: 'contacto@fundicionsur.com.ar', empresa_nombre: 'Fundición de Metales Sur', cuit: '23902928855', rubro_id: 'fundicion', tipo: 'empresa', estado: 'funcional' },
      { email: 'soporte@sistemas.io', empresa_nombre: 'Sistemas & Redes Global', cuit: '24280565942', rubro_id: 'informatica', tipo: 'empresa', estado: 'funcional' },
      { email: 'rrhh@serviciosempresariales.com', empresa_nombre: 'Servicios Empresariales SRL', cuit: '24566826883', rubro_id: 'servicios', tipo: 'empresa', estado: 'funcional' },
      { email: 'proveedores@electroindustrial.com.ar', empresa_nombre: 'Electro Industrial Distribuciones', cuit: '24494479857', rubro_id: 'electricidad', tipo: 'empresa', estado: 'funcional' },

      // 2 Inactivos
      { email: 'antigua_fabrica@bajas-comerciales.com', empresa_nombre: 'Manufacturas del Oeste (Inactiva)', cuit: '27703560828', rubro_id: 'manufactura', tipo: 'empresa', estado: 'inactivo' },
      { email: 'sucursal_cerrada@revestimientos.com', empresa_nombre: 'Revestimientos del Oeste (Cerrada)', cuit: '20551973167', rubro_id: 'construccion', tipo: 'empresa', estado: 'inactivo' },

      // 2 Rebotados Inexistente
      { email: 'correo_que_no_existe_123@dominiofantasma.org', empresa_nombre: 'Metalúrgica Inexistente', cuit: '27778569359', rubro_id: 'metalurgica', tipo: 'empresa', estado: 'rebotado inexistente' },
      { email: 'buzon_borrado@antiguo-proveedor.com.ar', empresa_nombre: 'Logística Bajas SRL', cuit: '30664297503', rubro_id: 'transporte', tipo: 'empresa', estado: 'rebotado inexistente' },

      // 2 Rebotados Bandeja Llena
      { email: 'bandeja_tope_maximo@talleresunidos.com.ar', empresa_nombre: 'Talleres Unidos Industriales', cuit: '23646881811', rubro_id: 'metalmecanica', tipo: 'empresa', estado: 'rebotado bandeja llena' },
      { email: 'mailbox_full_box@comerciocentro.com', empresa_nombre: 'Comercial Centro Express', cuit: '33305250371', rubro_id: 'comercio', tipo: 'empresa', estado: 'rebotado bandeja llena' },

      // 2 Rebotados Spam
      { email: 'bloqueado_por_filtro@servicios-spam.net', empresa_nombre: 'Promociones Masivas SA', cuit: '23553605539', rubro_id: 'servicios', tipo: 'empresa', estado: 'rebotado spam' },
      { email: 'rechazado_dmarc@agroservicios-oeste.com', empresa_nombre: 'Agroservicios del Oeste', cuit: '34404352212', rubro_id: 'comercio', tipo: 'empresa', estado: 'rebotado spam' },

      // 2 Rebotados Desconocido
      { email: 'error_554_timeout@servidorcaido.ar', empresa_nombre: 'Distribuciones Santos Vega', cuit: '34326635717', rubro_id: 'alimenticia', tipo: 'empresa', estado: 'rebotado desconocido' },
      { email: 'conexion_rechazada_smtp@redrota.com.ar', empresa_nombre: 'Industrias Gráficas Metropolitanas', cuit: '27972194846', rubro_id: 'grafica', tipo: 'empresa', estado: 'rebotado desconocido' }
    ];

    console.log(`📥 Insertando/Actualizando ${contactosSeed.length} contactos y sus empresas asociadas...`);
    const insertedContactos: { id: string; email: string; estado: string; rubro_id: string }[] = [];

    for (const c of contactosSeed) {
      // Upsert empresa
      let empId: string;
      const empExist = await client.query('SELECT id FROM empresas WHERE cuit = $1', [c.cuit]);
      if (empExist.rows.length > 0) {
        empId = empExist.rows[0].id;
        await client.query('UPDATE empresas SET nombre = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2', [c.empresa_nombre, empId]);
      } else {
        const empInsert = await client.query(
          'INSERT INTO empresas (nombre, cuit) VALUES ($1, $2) RETURNING id',
          [c.empresa_nombre, c.cuit]
        );
        empId = empInsert.rows[0].id;
      }

      // Upsert contacto
      const contRes = await client.query(`
        INSERT INTO contactos (email, empresa_nombre, empresa_id, cuit, rubro_id, tipo, estado, actualizado_en)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO UPDATE SET
          empresa_nombre = EXCLUDED.empresa_nombre,
          empresa_id = EXCLUDED.empresa_id,
          cuit = EXCLUDED.cuit,
          rubro_id = EXCLUDED.rubro_id,
          tipo = EXCLUDED.tipo,
          estado = EXCLUDED.estado,
          actualizado_en = CURRENT_TIMESTAMP
        RETURNING id, email, estado, rubro_id
      `, [c.email, c.empresa_nombre, empId, c.cuit, c.rubro_id, c.tipo, c.estado]);

      insertedContactos.push(contRes.rows[0]);
    }

    // 3. Catálogo de 12 Campañas con distribución temporal y de estados
    // Estados requeridos cubiertos:
    // - borrador (3) [con flyer y adjuntos listos para previsualizar]
    // - aprobada (1)
    // - en_proceso (1) [con envíos en marcha: pendientes, procesando, enviados]
    // - pausada (1) [con envíos parciales]
    // - cancelada (1)
    // - completada (5) [mínimo 3 pedidas: 1 en últimos 7 días, 2 en mes actual, 1 en año actual, 1 año previo]
    const campanasSeed: SeedCampana[] = [
      // 1. Borrador Reciente (Últimos 7 días) - Con Flyer y Adjunto
      {
        asunto: '📄 [Borrador] Programa de Financiamiento Exportador PyME 2026',
        cuerpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h2 style="color: #1e3a8a;">Convocatoria: Créditos a Tasa Subsidiada para Exportadores</h2>
            <p>La Dirección de Operaciones presenta la nueva línea de asistencia financiera para empresas industriales con perfil exportador.</p>
            <p>Podrán solicitar hasta $50.000.000 con tasa bonificada para la adquisición de bienes de capital y certificaciones internacionales.</p>
            <p><strong>Revisar las bases y condiciones adjuntas en este borrador antes de su aprobación definitiva.</strong></p>
          </div>
        `,
        link_inscripcion: 'https://plataforma.empresa.com/exportar-2026',
        link_nacion: 'https://banco.com/creditos_pyme',
        link_provincia: 'https://creditos.banco.com/pyme',
        flyer_url: '/uploads/flyer-1789397162985-358925225.png',
        adjunto_url: '/uploads/adjunto-1790688464566-733732036.csv',
        adjunto_nombre_original: 'Bases_Convocatoria_Exportar.csv',
        fecha_limite_envio: '2026-09-30',
        creado_en: '2026-09-30T10:00:00.000Z',
        prioridad: 'alta',
        para_todos_rubros: false,
        rubros_seleccionados: ['metalurgica', 'alimenticia', 'plastico', 'quimica'],
        estado: 'borrador'
      },

      // 2. Borrador de Mediados de Mes - Con Flyer y Adjunto
      {
        asunto: '💡 [Borrador] Taller Intensivo de Inteligencia Artificial para la Industria',
        cuerpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h2 style="color: #047857;">Capacitación en Automatización y LLMs Productivos</h2>
            <p>Descubra cómo implementar automatizaciones con n8n, visión por computadora y análisis predictivo en su línea de manufactura.</p>
            <p>Destinado a directores técnicos, jefes de planta y líderes de desarrollo empresarial.</p>
          </div>
        `,
        link_inscripcion: 'https://plataforma.empresa.com/talleres/ia-industria',
        flyer_url: '/uploads/flyer-1788191220002-87837546.jpg',
        adjunto_url: '/uploads/adjunto-1790178577269-350830320.xlsx',
        adjunto_nombre_original: 'Programa_Temario_IA_Industria.xlsx',
        fecha_limite_envio: '2026-09-12',
        creado_en: '2026-09-10T14:30:00.000Z',
        prioridad: 'media',
        para_todos_rubros: true,
        rubros_seleccionados: [],
        estado: 'borrador'
      },

      // 3. Borrador Anterior del Año
      {
        asunto: '🛡️ [Borrador] Protocolo de Seguridad e Higiene Laboral en Depósitos y Plantas',
        cuerpo_html: '<p>Borrador interno en revisión para la actualización de normas de prevención contra incendios y manipulación de sustancias químicas.</p>',
        fecha_limite_envio: '2026-03-15',
        creado_en: '2026-03-05T09:15:00.000Z',
        prioridad: 'baja',
        para_todos_rubros: true,
        rubros_seleccionados: [],
        estado: 'borrador'
      },

      // 4. Aprobada (Lista para despachar)
      {
        asunto: '🤝 Encuentro Empresarial PyME: Ronda de Negocios y Proveedores',
        cuerpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Gran Encuentro de Networking Industrial</h2>
            <p>Estimado empresario: lo convocamos al encuentro anual donde más de 80 empresas generarán acuerdos comerciales directos.</p>
            <p>Lugar: Centro de Convenciones y Eventos. Horario: 09:00 a 14:00 hs.</p>
          </div>
        `,
        link_inscripcion: 'https://plataforma.empresa.com/ronda-pyme',
        fecha_limite_envio: '2026-09-18',
        creado_en: '2026-09-16T11:00:00.000Z',
        prioridad: 'alta',
        para_todos_rubros: true,
        rubros_seleccionados: [],
        estado: 'aprobada'
      },

      // 5. En Proceso (Activa en Últimos 7 Días - con cola mixta)
      {
        asunto: '⚡ Alerta Técnica: Actualización de Protocolos Eléctricos y Medición de Potencia',
        cuerpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #b45309;">Aviso Técnico para Plantas Industriales</h2>
            <p>Se informa el nuevo esquema tarifario y los requisitos de medición de factor de potencia exigidos por el ENRE.</p>
          </div>
        `,
        fecha_limite_envio: '2026-09-29',
        creado_en: '2026-09-29T08:00:00.000Z',
        prioridad: 'alta',
        para_todos_rubros: false,
        rubros_seleccionados: ['metalurgica', 'electricidad', 'quimica', 'plastico'],
        estado: 'en_proceso',
        cola: {
          contactosCount: 18,
          distribucion: {
            enviados: 10,
            fallidos: 1,
            pendientes: 5,
            procesando: 2,
            aperturas: 6,
            clics: 2
          },
          fecha_base: '2026-09-29T11:30:00.000Z'
        }
      },

      // 6. Pausada (Últimos 7 Días - Envíos parciales)
      {
        asunto: '🔒 Seminario Intensivo de Ciberseguridad y Protección de Datos Comerciales',
        cuerpo_html: '<p>Campaña temporalmente pausada por reprogramación de fechas de oradores.</p>',
        fecha_limite_envio: '2026-09-27',
        creado_en: '2026-09-27T09:00:00.000Z',
        prioridad: 'media',
        para_todos_rubros: true,
        rubros_seleccionados: [],
        estado: 'pausada',
        cola: {
          contactosCount: 16,
          distribucion: {
            enviados: 8,
            fallidos: 1,
            pendientes: 7,
            procesando: 0,
            aperturas: 5,
            clics: 2
          },
          fecha_base: '2026-09-27T14:00:00.000Z'
        }
      },

      // 7. Cancelada (Mes actual)
      {
        asunto: '❌ Desayuno de Trabajo: Nuevas Tasas de Servicios (Suspendido por Clima)',
        cuerpo_html: '<p>Lamentamos informar que la jornada presencial ha sido cancelada.</p>',
        fecha_limite_envio: '2026-09-08',
        creado_en: '2026-09-07T16:00:00.000Z',
        prioridad: 'baja',
        para_todos_rubros: true,
        rubros_seleccionados: [],
        estado: 'cancelada'
      },

      // 8. Completada 1 (ÚLTIMOS 7 DÍAS) -> Aparece en: 7 días, Mes, Año, Todo
      {
        asunto: '🚨 Subsidios de Eficiencia Energética: Cierre de Convocatoria 2026',
        cuerpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Últimos días para postular a los ANR de Eficiencia</h2>
            <p>Se recuerda que este viernes vence el plazo para presentar proyectos de recambio de luminarias y motores de alta eficiencia.</p>
            <p><a href="https://plataforma.empresa.com/eficiencia" style="background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Consultar Estado del Trámite</a></p>
          </div>
        `,
        link_inscripcion: 'https://plataforma.empresa.com/eficiencia',
        fecha_limite_envio: '2026-09-28',
        creado_en: '2026-09-28T07:30:00.000Z',
        prioridad: 'alta',
        para_todos_rubros: true,
        rubros_seleccionados: [],
        estado: 'completada',
        cola: {
          contactosCount: 20,
          distribucion: {
            enviados: 18,
            fallidos: 2,
            pendientes: 0,
            procesando: 0,
            aperturas: 12,
            clics: 5
          },
          fecha_base: '2026-09-28T10:00:00.000Z'
        }
      },

      // 9. Completada 2 (MES ACTUAL - Quincena anterior) -> Aparece en: Mes, Año, Todo (NO en 7 días)
      {
        asunto: '📊 Censo Industrial: Relevamiento de Capacidad Productiva Q3',
        cuerpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Censo de Manufactura y Empleo 2026</h2>
            <p>Agradecemos a todas las industrias participantes por completar el formulario de estadísticas productivas.</p>
          </div>
        `,
        fecha_limite_envio: '2026-09-12',
        creado_en: '2026-09-12T08:00:00.000Z',
        prioridad: 'alta',
        para_todos_rubros: false,
        rubros_seleccionados: ['metalurgica', 'alimenticia', 'construccion', 'autopartes', 'textil'],
        estado: 'completada',
        cola: {
          contactosCount: 22,
          distribucion: {
            enviados: 20,
            fallidos: 2,
            pendientes: 0,
            procesando: 0,
            aperturas: 15,
            clics: 7
          },
          fecha_base: '2026-09-12T09:15:00.000Z'
        }
      },

      // 10. Completada 3 (MES ACTUAL - Principio de mes) -> Aparece en: Mes, Año, Todo (NO en 7 días)
      {
        asunto: '📦 Programa de Fomento al Compre Local y Cadena de Valor Corporativa',
        cuerpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Impulso al Comercio e Industria</h2>
            <p>Conocé el nuevo catálogo oficial de proveedores del distrito para compras institucionales y entre privados.</p>
          </div>
        `,
        fecha_limite_envio: '2026-09-04',
        creado_en: '2026-09-04T08:30:00.000Z',
        prioridad: 'media',
        para_todos_rubros: true,
        rubros_seleccionados: [],
        estado: 'completada',
        cola: {
          contactosCount: 16,
          distribucion: {
            enviados: 15,
            fallidos: 1,
            pendientes: 0,
            procesando: 0,
            aperturas: 11,
            clics: 4
          },
          fecha_base: '2026-09-04T11:00:00.000Z'
        }
      },

      // 11. Completada 4 (AÑO ACTUAL - Primer Semestre) -> Aparece en: Año, Todo (NO en Mes ni en 7 días)
      {
        asunto: '🏆 Convocatoria al Premio a la Innovación y Diseño PyME 2026',
        cuerpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reconocimiento a la Creatividad y Tecnología Industrial</h2>
            <p>Se premiarán proyectos de economía circular, automatización e impacto comunitario.</p>
          </div>
        `,
        fecha_limite_envio: '2026-05-20',
        creado_en: '2026-05-20T09:00:00.000Z',
        prioridad: 'alta',
        para_todos_rubros: true,
        rubros_seleccionados: [],
        estado: 'completada',
        cola: {
          contactosCount: 24,
          distribucion: {
            enviados: 22,
            fallidos: 2,
            pendientes: 0,
            procesando: 0,
            aperturas: 16,
            clics: 8
          },
          fecha_base: '2026-05-20T10:30:00.000Z'
        }
      },

      // 12. Completada 5 (AÑO ANTERIOR - 2025) -> Aparece SOLO sin filtros de fecha
      {
        asunto: '🎉 Encuentro Anual de la Industria y el Comercio 2025',
        cuerpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Celebración y Balance de Cierre de Año</h2>
            <p>Agradecemos a toda la comunidad productiva por su esfuerzo y compromiso durante el 2025.</p>
          </div>
        `,
        fecha_limite_envio: '2025-12-18',
        creado_en: '2025-12-18T10:00:00.000Z',
        prioridad: 'media',
        para_todos_rubros: true,
        rubros_seleccionados: [],
        estado: 'completada',
        cola: {
          contactosCount: 20,
          distribucion: {
            enviados: 20,
            fallidos: 0,
            pendientes: 0,
            procesando: 0,
            aperturas: 15,
            clics: 6
          },
          fecha_base: '2025-12-18T12:00:00.000Z'
        }
      }
    ];

    console.log(`📋 Insertando ${campanasSeed.length} campañas de prueba...`);
    let totalEnviosGenerados = 0;
    let totalAperturasGeneradas = 0;
    let totalClicksGenerados = 0;

    for (const camp of campanasSeed) {
      const campInsert = await client.query(`
        INSERT INTO campanas (
          asunto, cuerpo_html, link_inscripcion, link_nacion, link_provincia,
          flyer_url, adjunto_url, adjunto_nombre_original,
          fecha_limite_envio, prioridad, para_todos_rubros, rubros_seleccionados,
          estado, creado_en, actualizado_en
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $14
        ) RETURNING id
      `, [
        camp.asunto,
        camp.cuerpo_html,
        camp.link_inscripcion || null,
        camp.link_nacion || null,
        camp.link_provincia || null,
        camp.flyer_url || null,
        camp.adjunto_url || null,
        camp.adjunto_nombre_original || null,
        camp.fecha_limite_envio,
        camp.prioridad,
        camp.para_todos_rubros,
        JSON.stringify(camp.rubros_seleccionados),
        camp.estado,
        camp.creado_en
      ]);

      const campanaId = campInsert.rows[0].id;

      // Si tiene cola de envíos asociada, generarla
      if (camp.cola) {
        const { distribucion, fecha_base } = camp.cola;
        const total = distribucion.enviados + distribucion.fallidos + distribucion.pendientes + distribucion.procesando;
        const contactosParaCola = insertedContactos.slice(0, Math.min(total, insertedContactos.length));

        let aperturasRestantes = distribucion.aperturas;
        let clicsRestantes = distribucion.clics;

        let enviadosAsignados = 0;
        let fallidosAsignados = 0;
        let procesandoAsignados = 0;

        for (let i = 0; i < contactosParaCola.length; i++) {
          const contacto = contactosParaCola[i];
          let estadoCola = 'pendiente';
          let fechaEnvio: string | null = null;
          let fechaApertura: string | null = null;
          let fechaClick: string | null = null;
          let respuestaSmtp: string | null = null;
          let intentos = 0;

          if (enviadosAsignados < distribucion.enviados) {
            estadoCola = 'enviado';
            enviadosAsignados++;
            intentos = 1;
            // Variar ligeramente los minutos de envío
            const baseMs = new Date(fecha_base).getTime();
            const envioMs = baseMs + i * 180000; // cada 3 minutos
            fechaEnvio = new Date(envioMs).toISOString();
            respuestaSmtp = '250 2.0.0 OK [Mails-Gateway] Message queued for delivery';

            // Aperturas
            if (aperturasRestantes > 0) {
              fechaApertura = new Date(envioMs + 600000 + (i * 30000)).toISOString(); // 10 mins después
              aperturasRestantes--;
              totalAperturasGeneradas++;

              // Clics
              if (clicsRestantes > 0) {
                fechaClick = new Date(envioMs + 900000 + (i * 45000)).toISOString(); // 15 mins después
                clicsRestantes--;
                totalClicksGenerados++;
              }
            }
          } else if (fallidosAsignados < distribucion.fallidos) {
            estadoCola = 'fallido';
            fallidosAsignados++;
            intentos = 2;
            const baseMs = new Date(fecha_base).getTime();
            fechaEnvio = new Date(baseMs + i * 180000).toISOString();
            respuestaSmtp = '550 5.1.1 Recipient address rejected: User unknown / Mailbox full';
          } else if (procesandoAsignados < distribucion.procesando) {
            estadoCola = 'procesando';
            procesandoAsignados++;
            intentos = 1;
          } else {
            estadoCola = 'pendiente';
            intentos = 0;
          }

          await client.query(`
            INSERT INTO cola_envios (
              campana_id, contacto_id, cuenta_smtp_id, estado,
              respuesta_smtp, intentos, fecha_programada,
              fecha_envio, fecha_apertura, fecha_click, creado_en
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7,
              $8, $9, $10, $7
            )
          `, [
            campanaId,
            contacto.id,
            smtpId,
            estadoCola,
            respuestaSmtp,
            intentos,
            fecha_base,
            fechaEnvio,
            fechaApertura,
            fechaClick
          ]);

          totalEnviosGenerados++;
        }
      }
    }

    await client.query('COMMIT');

    console.log('----------------------------------------------------');
    console.log('✅ SEED COMPLETADO EXITOSAMENTE');
    console.log(`- 👥 Contactos: ${insertedContactos.length} distribuidos por estado.`);
    console.log(`- 📢 Campañas creadas: ${campanasSeed.length} con todos los estados y rangos temporales.`);
    console.log(`- ✉️ Registros en cola: ${totalEnviosGenerados}`);
    console.log(`- 👀 Aperturas simuladas: ${totalAperturasGeneradas}`);
    console.log(`- 🖱️ Clics simulados: ${totalClicksGenerados}`);
    console.log('----------------------------------------------------');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error ejecutando seed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.includes('seed')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}

