"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./config/logger");
const client_1 = require("./services/whatsapp/client");
const replyWaiter_1 = require("./services/whatsapp/replyWaiter");
const server_1 = require("./webhooks/server");
async function main() {
    logger_1.logger.info('Starting WhatsApp Bridge...');
    // Start Express webhook server
    (0, server_1.startWebhookServer)();
    // Wire reaction events to the reply waiter
    client_1.whatsappClient.setReactionHandler(replyWaiter_1.onReaction);
    // Initialize WhatsApp client (shows QR code on first run)
    await client_1.whatsappClient.initialize();
    logger_1.logger.info('WhatsApp Bridge is running');
}
// Graceful shutdown
async function shutdown() {
    logger_1.logger.info('Shutting down...');
    await client_1.whatsappClient.destroy();
    await (0, server_1.stopWebhookServer)();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
main().catch((error) => {
    logger_1.logger.error('Fatal error during startup', {
        message: error?.message,
        stack: error?.stack,
        error: error,
    });
    process.exit(1);
});
//# sourceMappingURL=index.js.map