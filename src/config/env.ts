import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  imap: {
    host: process.env.IMAP_HOST || '',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    user: process.env.IMAP_USER || '',
    pass: process.env.IMAP_PASS || '',
    tls: process.env.IMAP_TLS !== 'false',
  },
  db: {
    host: process.env.DB_HOST || '',
    port: parseInt(process.env.DB_PORT || '6543', 10),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'postgres',
    ssl: process.env.DB_SSL !== 'false',
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
};
