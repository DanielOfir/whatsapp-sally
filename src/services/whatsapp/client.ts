import { Client, LocalAuth, Chat, Message } from 'whatsapp-web.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');
import { logger } from '../../config/logger';
import { config } from '../../config/env';
import * as fs from 'fs';
import * as path from 'path';

export interface Reaction {
  reaction: string;
  senderId: string;
  timestamp: number;
}

export class WhatsAppClient {
  private client: Client;
  private isReady: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private readonly baseReconnectDelay: number = 1000;
  private reactionHandler?: (reaction: Reaction, reactedMsgId: string) => void;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: config.whatsapp.sessionPath,
      }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('qr', (qr) => {
      logger.info('WhatsApp QR Code generated. Scan with your phone:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp authenticated successfully');
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      logger.info('WhatsApp client is ready');
      this.isReady = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('message_reaction', (reaction: any) => {
      logger.debug('Reaction event received', {
        reaction: reaction.reaction,
        senderId: reaction.senderId,
        msgId: reaction.msgId?._serialized || reaction.id?._serialized,
      });
      if (this.reactionHandler) {
        try {
          const msgId = reaction.msgId?._serialized || reaction.id?._serialized || '';
          this.reactionHandler(
            {
              reaction: reaction.reaction,
              senderId: reaction.senderId,
              timestamp: reaction.timestamp || Date.now() / 1000,
            },
            msgId,
          );
        } catch (error) {
          logger.error('Error in reaction handler', { error });
        }
      }
    });

    this.client.on('disconnected', (reason) => {
      logger.warn('WhatsApp client disconnected', { reason });
      this.isReady = false;
      this.scheduleReconnect();
    });

    this.client.on('auth_failure', (message) => {
      logger.error('WhatsApp authentication failed', { message });
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing WhatsApp client...');
    this.cleanStaleLocks();
    await this.client.initialize();
  }

  private cleanStaleLocks(): void {
    const sessionDir = path.join(config.whatsapp.sessionPath, 'session');
    for (const lockFile of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
      const lockPath = path.join(sessionDir, lockFile);
      try {
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
          logger.info(`Removed stale lock file: ${lockFile}`);
        }
      } catch {
        // Ignore — file may not exist or may already be cleaned
      }
    }
  }

  async sendMessageToBot(text: string): Promise<Message> {
    if (!this.isReady) {
      throw new Error('WhatsApp client not ready');
    }
    const sentMsg = await this.client.sendMessage(config.whatsapp.botPhoneNumber, text);
    logger.debug('Message sent to bot', { text, msgId: sentMsg.id._serialized });
    return sentMsg;
  }

  async getBotChat(): Promise<Chat> {
    if (!this.isReady) {
      throw new Error('WhatsApp client not ready');
    }
    return this.client.getChatById(config.whatsapp.botPhoneNumber);
  }

  setReactionHandler(handler: (reaction: Reaction, reactedMsgId: string) => void): void {
    this.reactionHandler = handler;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Manual intervention required.`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      60000,
    );

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.client.initialize();
      } catch (error) {
        logger.error('Reconnection failed', { error });
        this.scheduleReconnect();
      }
    }, delay);
  }

  isClientReady(): boolean {
    return this.isReady;
  }

  async destroy(): Promise<void> {
    logger.info('Destroying WhatsApp client...');
    try {
      await this.client.destroy();
    } catch (error) {
      logger.error('Error destroying WhatsApp client', { error });
    }
    this.isReady = false;
  }
}

export const whatsappClient = new WhatsAppClient();
