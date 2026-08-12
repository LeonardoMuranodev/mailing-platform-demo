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
};
