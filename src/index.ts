import { logger } from './config/logger';
import { whatsappClient } from './services/whatsapp/client';
import { onReaction } from './services/whatsapp/replyWaiter';
import { startWebhookServer, stopWebhookServer } from './webhooks/server';

async function main(): Promise<void> {
  logger.info('Starting WhatsApp Bridge...');

  // Start Express webhook server
  startWebhookServer();

  // Wire reaction events to the reply waiter
  whatsappClient.setReactionHandler(onReaction);

  // Initialize WhatsApp client (shows QR code on first run)
  await whatsappClient.initialize();

  logger.info('WhatsApp Bridge is running');
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down...');
  await whatsappClient.destroy();
  await stopWebhookServer();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((error) => {
  logger.error('Fatal error during startup', {
    message: error?.message,
    stack: error?.stack,
    error: error,
  });
  process.exit(1);
});
