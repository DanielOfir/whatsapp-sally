import express, { Request, Response } from 'express';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { whatsappClient } from '../services/whatsapp/client';
import { sendAndWaitForReply } from '../services/whatsapp/replyWaiter';
import { HAWebhookEvent } from '../types';
import http from 'http';

let server: http.Server | null = null;

/** Strip WhatsApp formatting to produce clean text for voice/TTS responses. */
function toVoiceText(message: string): string {
  return message
    .replace(/\*/g, '')       // remove bold markers
    .replace(/~/g, '')        // remove strikethrough markers
    .replace(/_/g, '')        // remove italic markers
    .replace(/```[\s\S]*?```/g, '')  // remove code blocks
    .replace(/`/g, '')        // remove inline code markers
    .replace(/\n/g, '. ')    // newlines to sentence breaks
    .replace(/\s+/g, ' ')    // collapse whitespace
    .trim();
}

/** Build the WhatsApp command text from an action and optional item. */
function buildCommand(action: string, item?: string): string | null {
  const template = config.commands[action as keyof typeof config.commands];
  if (!template) return null;

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
function generateHAResponse(botReply: string, action: string, item?: string): string {
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

export function startWebhookServer(): http.Server {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      whatsapp: whatsappClient.isClientReady(),
      uptime: process.uptime(),
    });
  });

  // HA webhook endpoint
  app.post('/webhook/ha-event', async (req: Request, res: Response) => {
    // Validate bearer token if configured
    if (config.webhook.secret) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${config.webhook.secret}`) {
        logger.warn('Webhook request with invalid auth');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    const event = req.body as HAWebhookEvent;

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

    logger.info('Received HA webhook event', { action: event.action, item: event.item, command });

    try {
      // Send command and wait for reply (text message or reaction)
      const botReply = await sendAndWaitForReply(command);

      // Convert to user-friendly HA response
      const haResponse = generateHAResponse(botReply, event.action, event.item);

      res.json({
        ok: true,
        message: haResponse,
        voice_message: toVoiceText(haResponse),
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Error processing HA webhook', { error: errMsg });

      if (errMsg === 'WhatsApp client not ready') {
        res.status(503).json({ error: 'WhatsApp not connected' });
      } else {
        res.status(500).json({ error: 'Internal error' });
      }
    }
  });

  server = app.listen(config.webhook.port, () => {
    logger.info(`Webhook server listening on port ${config.webhook.port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${config.webhook.port} is already in use. Kill the other process or change WEBHOOK_PORT.`);
    } else {
      logger.error('Webhook server error', { error: err.message });
    }
  });

  return server;
}

export function stopWebhookServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        logger.info('Webhook server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}
