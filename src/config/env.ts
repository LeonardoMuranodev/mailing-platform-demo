import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  appUrl: (
    process.env.APP_URL || 
    process.env.VITE_APP_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'http://localhost:${process.env.PORT || 3000}' 
      : 'http://localhost:5173')
  ).replace(/\/+$/, ''),
  publicApiUrl: (
    process.env.PUBLIC_API_URL || 
    process.env.VITE_API_BASE_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'http://localhost:${process.env.PORT || 3000}' 
      : `http://localhost:${process.env.PORT || 3000}`)
  ).replace(/\/+$/, ''),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  modoPrueba: process.env.MODO_PRUEBA === 'true',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  imapTest: [1, 2, 3, 4, 5].map(i => ({
    host: process.env[`IMAP${i}_TEST_HOST`],
    port: parseInt(process.env[`IMAP${i}_TEST_PORT`] || '993', 10),
    user: process.env[`IMAP${i}_TEST_USER`] || '',
    pass: process.env[`IMAP${i}_TEST_PASS`] || '',
    tls: process.env[`IMAP${i}_TEST_TLS`] !== 'false',
  })).filter(a => a.host && a.user && a.pass),
  imapProd: [1, 2, 3, 4, 5].map(i => ({
    host: process.env[`IMAP${i}_HOST`],
    port: parseInt(process.env[`IMAP${i}_PORT`] || '993', 10),
    user: process.env[`IMAP${i}_USER`] || '',
    pass: process.env[`IMAP${i}_PASS`] || '',
    tls: process.env[`IMAP${i}_TLS`] !== 'false',
  })).filter(a => a.host && a.user && a.pass),
  db: {
    host: process.env.MODO_PRUEBA === 'true' ? (process.env.DB_TEST_HOST || process.env.DB_HOST || '') : (process.env.DB_HOST || ''),
    port: parseInt(process.env.MODO_PRUEBA === 'true' ? (process.env.DB_TEST_PORT || process.env.DB_PORT || '6543') : (process.env.DB_PORT || '6543'), 10),
    user: process.env.MODO_PRUEBA === 'true' ? (process.env.DB_TEST_USER || process.env.DB_USER || '') : (process.env.DB_USER || ''),
    password: process.env.MODO_PRUEBA === 'true' ? (process.env.DB_TEST_PASSWORD || process.env.DB_PASSWORD || '') : (process.env.DB_PASSWORD || ''),
    name: process.env.MODO_PRUEBA === 'true' ? (process.env.DB_TEST_NAME || process.env.DB_NAME || 'postgres') : (process.env.DB_NAME || 'postgres'),
    ssl: (() => {
      const rawSsl = process.env.MODO_PRUEBA === 'true' 
        ? (process.env.DB_TEST_SSL || process.env.DB_SSL) 
        : process.env.DB_SSL;
      if (rawSsl === 'false' || rawSsl === '0') return false;
      if (rawSsl === 'true' || rawSsl === '1') return true;
      const host = process.env.MODO_PRUEBA === 'true' 
        ? (process.env.DB_TEST_HOST || process.env.DB_HOST || '') 
        : (process.env.DB_HOST || '');
      return host.includes('supabase.com') || host.includes('aws') || host.includes('render.com');
    })(),
  },
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  jwt: {
    secret: process.env.JWT_SECRET || process.env.ENCRYPTION_KEY || 'secret_para_desarrollo_cambiar_en_produccion',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  notifier: {
    smtpHost: process.env.SMTP_NOTIFIER_HOST || '',
    smtpPort: parseInt(process.env.SMTP_NOTIFIER_PORT || '587', 10),
    smtpUser: process.env.SMTP_NOTIFIER_USER || '',
    smtpPass: process.env.SMTP_NOTIFIER_PASS || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    telegramToken: process.env.TELEGRAM_TOKEN || '',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => o.trim()),
  backup: {
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10),
  },
  google: {
    sheetId: process.env.GOOGLE_SHEET_ID || '',
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  oauth: {
    clientId: (process.env.GMAIL_OAUTH_CLIENT_ID || '').replace(/"/g, '').trim(),
    clientSecret: (process.env.GMAIL_OAUTH_CLIENT_SECRET || '').replace(/"/g, '').trim(),
    cuentas: [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({
      user: (process.env[`USER_SMTP${i}`] || process.env[`USER_DPI${i}`] || '').replace(/"/g, '').trim(),
      refreshToken: (process.env[`REFRESH_TOKEN_SMTP${i}`] || process.env[`REFRESH_TOKEN_DPI${i}`] || '').replace(/"/g, '').trim(),
    })).filter(c => c.user && c.refreshToken),
  },
  resend: {
    apiKey: (process.env.SMTP_RESEND || process.env.RESEND_API_KEY || '').replace(/"/g, '').trim(),
    webhookSecret: (process.env.RESEND_WEBHOOK_SECRET || '').replace(/"/g, '').trim(),
  },
  testEmailRecipient: (process.env.TEST_EMAIL_RECIPIENT || process.env.TEST_EMAIL || '').trim(),
  alertEmailDestination: (process.env.ALERT_EMAIL_DESTINATION || process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || '').trim(),
  maxAdjuntos: parseInt(process.env.MAX_ADJUNTOS || process.env.VITE_MAX_ADJUNTOS || '6', 10),
};
