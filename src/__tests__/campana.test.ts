import { describe, it, expect } from 'vitest';
import { crearCampanaSchema } from '../schemas/campanaSchema.js';

describe('Campana Schema — Validaciones de Audiencia Manual (V2)', () => {
  const basePayload = {
    asunto: 'Convocatoria Especial V2',
    cuerpo_html: '<p>Invitación exclusiva</p>',
    fecha_limite_envio: '2099-12-31',
    prioridad: 'alta',
  };

  it('debe permitir crear una campaña manual con un array de emails válidos', () => {
    const payload = {
      ...basePayload,
      tipo_audiencia: 'manual',
      destinatarios_manuales: ['contacto1@empresa.com', 'contacto2@empresa.com'],
    };

    const parsed = crearCampanaSchema.parse(payload);
    expect(parsed.tipo_audiencia).toBe('manual');
    expect(parsed.destinatarios_manuales).toEqual(['contacto1@empresa.com', 'contacto2@empresa.com']);
  });

  it('debe normalizar y deduplicar correos en minúsculas ignorando espacios', () => {
    const payload = {
      ...basePayload,
      tipo_audiencia: 'manual',
      destinatarios_manuales: [
        '  JUAN.PEREZ@EMPRESA.COM  ',
        'juan.perez@empresa.com',
        'OTRO@TEST.COM',
      ],
    };

    const parsed = crearCampanaSchema.parse(payload);
    expect(parsed.destinatarios_manuales).toHaveLength(2);
    expect(parsed.destinatarios_manuales).toEqual(['juan.perez@empresa.com', 'otro@test.com']);
  });

  it('debe admitir destinatarios_manuales pasados como string separados por comas, puntos y comas y saltos de línea', () => {
    const rawString = 'primero@test.com, segundo@test.com; tercero@test.com\ncuarto@test.com\r\nquinto@test.com';
    const payload = {
      ...basePayload,
      tipo_audiencia: 'manual',
      destinatarios_manuales: rawString,
    };

    const parsed = crearCampanaSchema.parse(payload);
    expect(parsed.destinatarios_manuales).toEqual([
      'primero@test.com',
      'segundo@test.com',
      'tercero@test.com',
      'cuarto@test.com',
      'quinto@test.com',
    ]);
  });

  it('debe admitir destinatarios_manuales pasados como JSON stringificado', () => {
    const jsonString = JSON.stringify(['vip1@empresa.com', 'vip2@empresa.com']);
    const payload = {
      ...basePayload,
      tipo_audiencia: 'manual',
      destinatarios_manuales: jsonString,
    };

    const parsed = crearCampanaSchema.parse(payload);
    expect(parsed.destinatarios_manuales).toEqual(['vip1@empresa.com', 'vip2@empresa.com']);
  });

  it('debe rechazar correos con formato inválido en destinatarios_manuales', () => {
    const payload = {
      ...basePayload,
      tipo_audiencia: 'manual',
      destinatarios_manuales: ['correo_valido@empresa.com', 'correo_invalido_sin_arroba'],
    };

    expect(() => crearCampanaSchema.parse(payload)).toThrowError(/Formato de correo inválido/);
  });

  it('debe admitir cuenta_emisor_id como UUID válido', () => {
    const payload = {
      ...basePayload,
      tipo_audiencia: 'manual',
      destinatarios_manuales: ['test@empresa.com'],
      cuenta_emisor_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    };

    const parsed = crearCampanaSchema.parse(payload);
    expect(parsed.cuenta_emisor_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  });

  it('debe fallar si cuenta_emisor_id no es un UUID válido', () => {
    const payload = {
      ...basePayload,
      tipo_audiencia: 'manual',
      destinatarios_manuales: ['test@empresa.com'],
      cuenta_emisor_id: 'no-es-un-uuid',
    };

    expect(() => crearCampanaSchema.parse(payload)).toThrowError(/UUID válido/);
  });
});

