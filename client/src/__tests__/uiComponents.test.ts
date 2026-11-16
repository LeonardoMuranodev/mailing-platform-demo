import { describe, it, expect } from 'vitest';
import { CAMPANA_ESTADO_CLASSES, CAMPANA_ESTADO_LABELS } from '../components/ui/CampanaBadge';
import { buildFormData } from '../stores/campanaStore';
import { CAMPANA_FORM_INITIAL } from '../types/campana';

describe('Frontend: UI Components & Helpers', () => {
  describe('CampanaBadge dictionary', () => {
    it('debe contener todas las variantes de estado de campaña esperadas', () => {
      const estados = ['borrador', 'aprobada', 'en_proceso', 'pausada', 'completada', 'cancelada', 'archivada'];
      for (const est of estados) {
        expect(CAMPANA_ESTADO_CLASSES[est]).toBeDefined();
        expect(CAMPANA_ESTADO_LABELS[est]).toBeDefined();
      }
    });

    it('debe tener soporte de dark mode en las clases de cada estado', () => {
      expect(CAMPANA_ESTADO_CLASSES.borrador).toContain('dark:');
      expect(CAMPANA_ESTADO_CLASSES.aprobada).toContain('dark:');
      expect(CAMPANA_ESTADO_CLASSES.en_proceso).toContain('dark:');
      expect(CAMPANA_ESTADO_CLASSES.pausada).toContain('dark:');
      expect(CAMPANA_ESTADO_CLASSES.completada).toContain('dark:');
      expect(CAMPANA_ESTADO_CLASSES.cancelada).toContain('dark:');
    });
  });

  describe('buildFormData helper', () => {
    it('debe serializar datos básicos en FormData', () => {
      const form = {
        ...CAMPANA_FORM_INITIAL,
        asunto: 'Asunto FormData Test',
        cuerpo_html: '<p>Cuerpo</p>',
        tipo_audiencia: 'manual' as const,
        destinatarios_manuales: ['dest1@test.com', 'dest2@test.com'],
        rubros_seleccionados: ['rubro_a'],
      };

      const fd = buildFormData(form, null, []);
      expect(fd.get('asunto')).toBe('Asunto FormData Test');
      expect(fd.get('cuerpo_html')).toBe('<p>Cuerpo</p>');
      expect(fd.get('tipo_audiencia')).toBe('manual');
      expect(JSON.parse(fd.get('destinatarios_manuales') as string)).toEqual(['dest1@test.com', 'dest2@test.com']);
      expect(JSON.parse(fd.get('rubros_seleccionados') as string)).toEqual(['rubro_a']);
    });

    it('debe adjuntar enlaces condicionalmente', () => {
      const form = {
        ...CAMPANA_FORM_INITIAL,
        asunto: 'Asunto con Enlaces',
        link_inscripcion: 'https://inscripcion.com',
        link_nacion: 'https://nacion.com',
        link_provincia: 'https://provincia.com',
      };

      const fd = buildFormData(form, null, []);
      expect(fd.get('link_inscripcion')).toBe('https://inscripcion.com');
      expect(fd.get('link_nacion')).toBe('https://nacion.com');
      expect(fd.get('link_provincia')).toBe('https://provincia.com');
    });

    it('debe preservar adjuntos_extras si no se suben archivos nuevos', () => {
      const form = {
        ...CAMPANA_FORM_INITIAL,
        asunto: 'Edición con extras existentes',
        adjuntos_extras: [
          { url: '/uploads/doc1.pdf', nombre_original: 'doc1.pdf' },
          { url: '/uploads/doc2.pdf', nombre_original: 'doc2.pdf' },
        ],
      };

      const fd = buildFormData(form, null, []);
      const extras = JSON.parse(fd.get('adjuntos_extras') as string);
      expect(extras).toHaveLength(2);
      expect(extras[0].nombre_original).toBe('doc1.pdf');
    });
  });

  describe('CustomSelect & Date Filters logic', () => {
    it('debe filtrar correctamente opciones de rubros por texto de búsqueda', () => {
      const options = [
        { value: '', label: 'Todos los rubros' },
        { value: 'alimenticia', label: 'Alimenticia' },
        { value: 'automotor', label: 'Automotor' },
        { value: 'metalurgica', label: 'Metalúrgica' },
      ];

      const query = 'auto';
      const filtered = options.filter(opt => opt.label.toLowerCase().includes(query.toLowerCase()));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].value).toBe('automotor');
    });

    it('debe encontrar la opción seleccionada incluso con valor vacío', () => {
      const options = [
        { value: '', label: 'Todos los estados' },
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'enviado', label: 'Enviado' },
      ];

      const selected = options.find(opt => opt.value === '');
      expect(selected).toBeDefined();
      expect(selected?.label).toBe('Todos los estados');
    });
  });
});
