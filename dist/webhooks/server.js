"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebhookServer = startWebhookServer;
exports.stopWebhookServer = stopWebhookServer;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const client_1 = require("../services/whatsapp/client");
const replyWaiter_1 = require("../services/whatsapp/replyWaiter");
const VALID_ACTIONS = new Set(['add', 'remove', 'bought', 'list', 'clear']);
const MAX_ITEM_LENGTH = 200;
// Strip control characters (C0/C1) except normal whitespace (space, tab)
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
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
/** Timing-safe comparison of two strings using HMAC to avoid length leaks. */
function safeCompare(a, b) {
    const key = crypto_1.default.randomBytes(32);
    const hmacA = crypto_1.default.createHmac('sha256', key).update(a).digest();
    const hmacB = crypto_1.default.createHmac('sha256', key).update(b).digest();
    return crypto_1.default.timingSafeEqual(hmacA, hmacB);
}
/** Sanitize an item string: trim, strip control chars, enforce max length. */
function sanitizeItem(item) {
    const cleaned = item.replace(CONTROL_CHARS_RE, '').trim();
    if (cleaned.length === 0)
        return null;
    if (cleaned.length > MAX_ITEM_LENGTH)
        return null;
    return cleaned;
}
function startWebhookServer() {
    const app = (0, express_1.default)();
    // Security middleware
    app.use((0, helmet_1.default)());
    app.use(express_1.default.json({ limit: '10kb' }));
    app.disable('x-powered-by');
    // Rate limit the webhook endpoint
    const webhookLimiter = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests' },
    });
    // Health check (no auth, no rate limit)
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            whatsapp: client_1.whatsappClient.isClientReady(),
            uptime: process.uptime(),
        });
    });
    // HA webhook endpoint
    app.post('/webhook/ha-event', webhookLimiter, async (req, res) => {
        // Validate bearer token
        const authHeader = req.headers.authorization;
        if (!authHeader || !safeCompare(authHeader, `Bearer ${env_1.config.webhook.secret}`)) {
            logger_1.logger.warn('Webhook request with invalid auth');
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const event = req.body;
        if (!event.action || typeof event.action !== 'string' || !VALID_ACTIONS.has(event.action)) {
            res.status(400).json({ error: 'Invalid or missing action' });
            return;
        }
        // Actions that require an item
        const itemRequired = ['add', 'remove', 'bought'];
        if (itemRequired.includes(event.action) && !event.item) {
            res.status(400).json({ error: `Missing item for action: ${event.action}` });
            return;
        }
        // Sanitize item if present
        let sanitizedItem = event.item;
        if (event.item) {
            if (typeof event.item !== 'string') {
                res.status(400).json({ error: 'Item must be a string' });
                return;
            }
            sanitizedItem = sanitizeItem(event.item) ?? undefined;
            if (!sanitizedItem) {
                res.status(400).json({ error: 'Invalid item (empty or too long)' });
                return;
            }
        }
        const command = buildCommand(event.action, sanitizedItem);
        if (!command) {
            res.status(400).json({ error: `Unknown action: ${event.action}` });
            return;
        }
        logger_1.logger.info('Received HA webhook event', { action: event.action, command });
        try {
            // Send command and wait for reply (text message or reaction)
            const botReply = await (0, replyWaiter_1.sendAndWaitForReply)(command);
            // Convert to user-friendly HA response
            const haResponse = generateHAResponse(botReply, event.action, sanitizedItem);
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