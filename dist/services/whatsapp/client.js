"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappClient = exports.WhatsAppClient = void 0;
const whatsapp_web_js_1 = require("whatsapp-web.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');
const logger_1 = require("../../config/logger");
const env_1 = require("../../config/env");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WhatsAppClient {
    constructor() {
        this.isReady = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.baseReconnectDelay = 1000;
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({
                dataPath: env_1.config.whatsapp.sessionPath,
            }),
            puppeteer: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-crash-reporter',
                    '--no-crash-upload',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--single-process',
                    '--disable-features=VizDisplayCompositor,IsolateOrigins,site-per-process',
                    '--no-first-run',
                    '--no-default-browser-check',
                ],
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            },
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            logger_1.logger.info('WhatsApp QR Code generated. Scan with your phone:');
            qrcode.generate(qr, { small: true });
        });
        this.client.on('authenticated', () => {
            logger_1.logger.info('WhatsApp authenticated successfully');
            this.reconnectAttempts = 0;
        });
        this.client.on('ready', () => {
            logger_1.logger.info('WhatsApp client is ready');
            this.isReady = true;
            this.reconnectAttempts = 0;
        });
        this.client.on('message_reaction', (reaction) => {
            logger_1.logger.debug('Reaction event received', {
                reaction: reaction.reaction,
                senderId: reaction.senderId,
                msgId: reaction.msgId?._serialized || reaction.id?._serialized,
            });
            if (this.reactionHandler) {
                try {
                    const msgId = reaction.msgId?._serialized || reaction.id?._serialized || '';
                    this.reactionHandler({
                        reaction: reaction.reaction,
                        senderId: reaction.senderId,
                        timestamp: reaction.timestamp || Date.now() / 1000,
                    }, msgId);
                }
                catch (error) {
                    logger_1.logger.error('Error in reaction handler', { error });
                }
            }
        });
        this.client.on('disconnected', (reason) => {
            logger_1.logger.warn('WhatsApp client disconnected', { reason });
            this.isReady = false;
            this.scheduleReconnect();
        });
        this.client.on('auth_failure', (message) => {
            logger_1.logger.error('WhatsApp authentication failed', { message });
        });
    }
    async initialize() {
        logger_1.logger.info('Initializing WhatsApp client...');
        this.cleanStaleLocks();
        await this.client.initialize();
    }
    cleanStaleLocks() {
        const sessionDir = path.join(env_1.config.whatsapp.sessionPath, 'session');
        // Ensure session directory exists
        try {
            if (!fs.existsSync(env_1.config.whatsapp.sessionPath)) {
                fs.mkdirSync(env_1.config.whatsapp.sessionPath, { recursive: true });
                logger_1.logger.info('Created whatsapp session directory');
            }
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir, { recursive: true });
                logger_1.logger.info('Created session subdirectory');
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not create session directories', { error });
        }
        // Clean all common Chromium lock files
        const lockFiles = [
            'SingletonLock',
            'SingletonSocket',
            'SingletonCookie',
            'lockfile',
            '.lock',
        ];
        let removedCount = 0;
        for (const lockFile of lockFiles) {
            const lockPath = path.join(sessionDir, lockFile);
            try {
                if (fs.existsSync(lockPath)) {
                    // Try to force remove with different permissions
                    try {
                        fs.chmodSync(lockPath, 0o666);
                    }
                    catch {
                        // Ignore chmod errors
                    }
                    fs.unlinkSync(lockPath);
                    logger_1.logger.info(`Removed stale lock file: ${lockFile}`);
                    removedCount++;
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to remove lock file ${lockFile}`, { error });
            }
        }
        if (removedCount > 0) {
            logger_1.logger.info(`Cleaned up ${removedCount} stale lock file(s)`);
        }
        else {
            logger_1.logger.debug('No stale lock files found');
        }
    }
    async sendMessageToBot(text) {
        if (!this.isReady) {
            throw new Error('WhatsApp client not ready');
        }
        const sentMsg = await this.client.sendMessage(env_1.config.whatsapp.botPhoneNumber, text);
        logger_1.logger.debug('Message sent to bot', { text, msgId: sentMsg.id._serialized });
        return sentMsg;
    }
    async getBotChat() {
        if (!this.isReady) {
            throw new Error('WhatsApp client not ready');
        }
        return this.client.getChatById(env_1.config.whatsapp.botPhoneNumber);
    }
    setReactionHandler(handler) {
        this.reactionHandler = handler;
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Manual intervention required.`);
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000);
        logger_1.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(async () => {
            try {
                await this.client.initialize();
            }
            catch (error) {
                logger_1.logger.error('Reconnection failed', { error });
                this.scheduleReconnect();
            }
        }, delay);
    }
    isClientReady() {
        return this.isReady;
    }
    async destroy() {
        logger_1.logger.info('Destroying WhatsApp client...');
        try {
            await this.client.destroy();
        }
        catch (error) {
            logger_1.logger.error('Error destroying WhatsApp client', { error });
        }
        this.isReady = false;
    }
}
exports.WhatsAppClient = WhatsAppClient;
exports.whatsappClient = new WhatsAppClient();
//# sourceMappingURL=client.js.map