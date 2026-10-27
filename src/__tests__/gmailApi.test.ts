import { describe, it, expect, beforeEach } from 'vitest';
import { config } from '../config/env.js';
import { esCuentaOAuth, obtenerConfiguracionOAuth } from '../services/gmailApiService.js';

describe('Gmail API OAuth2 Service', () => {
  beforeEach(() => {
    config.oauth.clientId = 'test-client-id.apps.googleusercontent.com';
    config.oauth.clientSecret = 'test-client-secret';
    config.oauth.cuentas = [
      { user: 'oauth-cuenta1@dominio.com', refreshToken: 'refresh-token-1' },
      { user: 'oauth-cuenta2@dominio.com', refreshToken: 'refresh-token-2' },
    ];
  });

  describe('1. Detección de cuentas OAuth', () => {
    it('debe reconocer a oauth-cuenta1@dominio.com como cuenta OAuth (case insensitive)', () => {
      expect(esCuentaOAuth('oauth-cuenta1@dominio.com')).toBe(true);
      expect(esCuentaOAuth('OAUTH-CUENTA1@DOMINIO.COM')).toBe(true);
      expect(esCuentaOAuth(' oauth-cuenta1@dominio.com ')).toBe(true);
    });

    it('debe reconocer a oauth-cuenta2@dominio.com como cuenta OAuth (case insensitive)', () => {
      expect(esCuentaOAuth('oauth-cuenta2@dominio.com')).toBe(true);
      expect(esCuentaOAuth('OAUTH-CUENTA2@DOMINIO.COM')).toBe(true);
      expect(esCuentaOAuth(' oauth-cuenta2@dominio.com ')).toBe(true);
    });

    it('debe devolver la configuración correspondiente para cada cuenta', () => {
      const cfg1 = obtenerConfiguracionOAuth('oauth-cuenta1@dominio.com');
      const cfg2 = obtenerConfiguracionOAuth('oauth-cuenta2@dominio.com');

      expect(cfg1).not.toBeNull();
      expect(cfg2).not.toBeNull();
      expect(cfg1?.user).toBe('oauth-cuenta1@dominio.com');
      expect(cfg2?.user).toBe('oauth-cuenta2@dominio.com');
      expect(cfg1?.clientId).toBe(cfg2?.clientId);
      expect(cfg1?.clientSecret).toBe(cfg2?.clientSecret);
      expect(cfg1?.refreshToken).not.toBe(cfg2?.refreshToken);
    });

    it('no debe marcar cuentas SMTP estándar como OAuth', () => {
      expect(esCuentaOAuth('cuenta-comun@gmail.com')).toBe(false);
      expect(esCuentaOAuth('otra@dominio.com')).toBe(false);
      expect(esCuentaOAuth('')).toBe(false);
    });
  });
});
