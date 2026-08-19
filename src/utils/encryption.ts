import crypto from 'crypto';
import { config } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const keyHex = config.encryptionKey;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('La variable ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres.');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encripta un texto usando AES-256-GCM.
 * Devuelve un formato combinado: iv:tag:encryptedText
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Desencripta un texto usando AES-256-GCM.
 * Espera el formato combinado: iv:tag:encryptedText
 */
export function decrypt(encryptedData: string): string {
  const key = getKey();
  const parts = encryptedData.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Formato de datos encriptados inválido.');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
