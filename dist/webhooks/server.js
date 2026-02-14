"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebhookServer = startWebhookServer;
exports.stopWebhookServer = stopWebhookServer;
const express_1 = __importDefault(require("express"));
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const client_1 = require("../services/whatsapp/client");
const replyWaiter_1 = require("../services/whatsapp/replyWaiter");
let server = null;
/** Strip WhatsApp formatting to produce clean text for voice/TTS responses. */
function toVoiceText(message) {
    return message
        .replace(/\*/g, '') // remove bold markers
        .replace(/~/g, '') // remove strikethrough markers
        .replace(/_/g, '') // remove italic markers
        .replace(/```[\s\S]*?```/g, '') // remove code blocks
        .replace(/`/g, '') // remove inline code markers
        .replace(/\n/g, '. ') // newlines to sentence breaks
        .replace(/\s+/g, ' ') // collapse whitespace
        .trim();
}
/** Build the WhatsApp command text from an action and optional item. */
function buildCommand(action, item) {
    const template = env_1.config.commands[action];
    if (!template)
        return null;
    if (item) {
        return template.replace('{item}', item);
    }
    return template;
}
/**
 * Generate a user-friendly response for Home Assistant TTS.
 * If the bot replied with a reaction (starts with "הבוט הגיב:"), replace it with
 * a meaningful success message based on the action. Otherwise return the bot's text reply.
 */
function generateHAResponse(botReply, action, item) {
    // If it's a reaction response, map to action-specific message
    if (botReply.startsWith('הבוט הגיב:')) {
        const itemText = item ? ` ${item}` : '';
        switch (action) {
            case 'add':
                return `הפריט${itemText} נוסף לרשימה`;
            case 'remove':
                return `הפריט${itemText} הוסר מהרשימה`;
            case 'bought':
                return `הפריט${itemText} סומן כנקנה`;
            case 'clear':
                return 'הרשימה נוקתה';
            default:
                return botReply; // fallback to bot's reply
        }
    }
    // For text replies (like list), return as-is
    return botReply;
}
function startWebhookServer() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Health check
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            whatsapp: client_1.whatsappClient.isClientReady(),
            uptime: process.uptime(),
        });
    });
    // HA webhook endpoint
    app.post('/webhook/ha-event', async (req, res) => {
        // Validate bearer token if configured
        if (env_1.config.webhook.secret) {
            const authHeader = req.headers.authorization;
            if (authHeader !== `Bearer ${env_1.config.webhook.secret}`) {
                logger_1.logger.warn('Webhook request with invalid auth');
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
        }
        const event = req.body;
        if (!event.action) {
            res.status(400).json({ error: 'Missing action' });
            return;
        }
        // Actions that require an item
        const itemRequired = ['add', 'remove', 'bought'];
        if (itemRequired.includes(event.action) && !event.item) {
            res.status(400).json({ error: `Missing item for action: ${event.action}` });
            return;
        }
        const command = buildCommand(event.action, event.item);
        if (!command) {
            res.status(400).json({ error: `Unknown action: ${event.action}` });
            return;
        }
        logger_1.logger.info('Received HA webhook event', { action: event.action, item: event.item, command });
        try {
            // Send command and wait for reply (text message or reaction)
            const botReply = await (0, replyWaiter_1.sendAndWaitForReply)(command);
            // Convert to user-friendly HA response
            const haResponse = generateHAResponse(botReply, event.action, event.item);
            res.json({
                ok: true,
                message: haResponse,
                voice_message: toVoiceText(haResponse),
            });
        }
        catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger_1.logger.error('Error processing HA webhook', { error: errMsg });
            if (errMsg === 'WhatsApp client not ready') {
                res.status(503).json({ error: 'WhatsApp not connected' });
            }
            else {
                res.status(500).json({ error: 'Internal error' });
            }
        }
    });
    server = app.listen(env_1.config.webhook.port, () => {
        logger_1.logger.info(`Webhook server listening on port ${env_1.config.webhook.port}`);
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger_1.logger.error(`Port ${env_1.config.webhook.port} is already in use. Kill the other process or change WEBHOOK_PORT.`);
        }
        else {
            logger_1.logger.error('Webhook server error', { error: err.message });
        }
    });
    return server;
}
function stopWebhookServer() {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => {
                logger_1.logger.info('Webhook server stopped');
                resolve();
            });
        }
        else {
            resolve();
        }
    });
}
//# sourceMappingURL=server.js.map