import dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export const config: Config = {
  whatsapp: {
    botPhoneNumber: requireEnv('BOT_PHONE_NUMBER'),
    sessionPath: optionalEnv('WHATSAPP_SESSION_PATH', './data/whatsapp-session'),
  },
  webhook: {
    secret: optionalEnv('WEBHOOK_SECRET') || undefined,
    port: parseInt(optionalEnv('WEBHOOK_PORT', '3000'), 10),
  },
  reply: {
    timeoutMs: parseInt(optionalEnv('REPLY_TIMEOUT_MS', '30000'), 10),
    bufferMs: parseInt(optionalEnv('REPLY_BUFFER_MS', '1500'), 10),
  },
  commands: {
    add: optionalEnv('CMD_TEMPLATE_ADD', 'הוסף {item}'),
    remove: optionalEnv('CMD_TEMPLATE_REMOVE', 'הסר {item}'),
    bought: optionalEnv('CMD_TEMPLATE_BOUGHT', 'קניתי {item}'),
    list: optionalEnv('CMD_TEMPLATE_LIST', 'רשימה'),
    clear: optionalEnv('CMD_TEMPLATE_CLEAR', 'נקה'),
  },
  logging: {
    level: optionalEnv('LOG_LEVEL', 'info'),
    file: optionalEnv('LOG_FILE', './data/logs/bridge.log'),
  },
};
