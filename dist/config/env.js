"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
function optionalEnv(key, defaultValue = '') {
    return process.env[key] || defaultValue;
}
function parseIntEnv(key, defaultValue) {
    const raw = process.env[key] || defaultValue;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) {
        throw new Error(`Invalid integer for environment variable ${key}: "${raw}"`);
    }
    return parsed;
}
exports.config = {
    whatsapp: {
        botPhoneNumber: requireEnv('BOT_PHONE_NUMBER'),
        sessionPath: optionalEnv('WHATSAPP_SESSION_PATH', './data/whatsapp-session'),
    },
    webhook: {
        secret: requireEnv('WEBHOOK_SECRET'),
        port: parseIntEnv('WEBHOOK_PORT', '3000'),
    },
    reply: {
        timeoutMs: parseIntEnv('REPLY_TIMEOUT_MS', '30000'),
        bufferMs: parseIntEnv('REPLY_BUFFER_MS', '1500'),
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
//# sourceMappingURL=env.js.map