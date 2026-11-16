import { describe, it, expect } from 'vitest';
import {
  crearCampanaSchema,
  validarFormulario,
  validarBorrador,
  formatZodIssues,
} from '../schemas/campanaSchema';

describe('Frontend: campanaSchema', () => {
  describe('formatZodIssues', () => {
    it('debe mapear issues de Zod a diccionario campo -> mensaje', () => {
      const parsed = crearCampanaSchema.safeParse({});
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const errors = formatZodIssues(parsed.error.issues);
        expect(errors).toBeTypeOf('object');
        expect(errors.asunto).toBeDefined();
        expect(errors.cuerpo_html).toBeDefined();
      }
    });
  });

  describe('validarBorrador (Schema Laxo)', () => {
    it('debe rechazar borrador sin asunto', () => {
      const res = validarBorrador({ asunto: '' });
      expect(res).not.toBeNull();
      expect(res?.asunto).toBeDefined();
    });

    it('debe aceptar borrador con solo asunto', () => {
      const res = validarBorrador({
        asunto: 'Borrador preliminar',
      });
      expect(res).toBeNull();
    });

    it('debe aceptar borrador con destinatarios manuales parciales', () => {
      const res = validarBorrador({
        asunto: 'Campaña rápida',
        tipo_audiencia: 'manual',
        destinatarios_manuales: ['test@ejemplo.com'],
      });
      expect(res).toBeNull();
    });
  });

  describe('validarFormulario (Schema Estricto)', () => {
    const baseValida = {
      asunto: 'Asunto de prueba',
      cuerpo_html: '<p>Hola mundo</p>',
      usa_links_multiples: false,
      link_inscripcion: 'https://inscripcion.ejemplo.com',
      fecha_limite_envio: '2026-12-31',
      prioridad: 'alta' as const,
      para_todos_rubros: true,
      rubros_seleccionados: [],
      tipo_audiencia: 'rubros' as const,
      destinatarios_manuales: [],
    };

    it('debe validar exitosamente un formulario completo con link único', () => {
      const res = validarFormulario(baseValida);
      expect(res).toBeNull();
    });

    it('debe exigir links de Nación y Provincia si usa_links_multiples es true', () => {
      const conMultiplesFaltantes = {
        ...baseValida,
        usa_links_multiples: true,
        link_inscripcion: '',
        link_nacion: '',
        link_provincia: '',
      };
      const res = validarFormulario(conMultiplesFaltantes);
      expect(res).not.toBeNull();
      expect(res?.link_inscripcion).toBeDefined();
    });

    it('debe aceptar links de Nación y Provincia válidos si usa_links_multiples es true', () => {
      const conMultiplesValidos = {
        ...baseValida,
        usa_links_multiples: true,
        link_inscripcion: '',
        link_nacion: 'https://nacion.ejemplo.com',
        link_provincia: 'https://provincia.ejemplo.com',
      };
      const res = validarFormulario(conMultiplesValidos);
      expect(res).toBeNull();
    });

    it('debe exigir al menos un destinatario si tipo_audiencia es manual', () => {
      const audienciaManualVacia = {
        ...baseValida,
        tipo_audiencia: 'manual' as const,
        destinatarios_manuales: [],
      };
      const res = validarFormulario(audienciaManualVacia);
      expect(res).not.toBeNull();
      expect(res?.destinatarios_manuales).toBeDefined();
    });

    it('debe aceptar formulario con audiencia manual y correos', () => {
      const audienciaManualOk = {
        ...baseValida,
        tipo_audiencia: 'manual' as const,
        destinatarios_manuales: ['usuario@empresa.com'],
      };
      const res = validarFormulario(audienciaManualOk);
      expect(res).toBeNull();
    });
  });
});
