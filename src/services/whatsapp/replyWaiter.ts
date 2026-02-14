import { logger } from '../../config/logger';
import { config } from '../../config/env';
import { whatsappClient, Reaction } from './client';

const POLL_INTERVAL_MS = 2000;
const REACTION_EXTRA_WAIT_MS = 2000;

/** Map of emoji reactions to Hebrew descriptions for TTS */
const REACTION_LABELS: Record<string, string> = {
  '👍': 'אישור',
  '✅': 'בוצע',
  '❤️': 'לב',
  '😂': 'צחוק',
  '😮': 'הפתעה',
  '😢': 'עצוב',
  '🙏': 'תודה',
};

/** Module-level state — mutated by onReaction(), read by sendAndWaitForReply() */
const state = {
  reactionEmoji: null as string | null,
  watchedMsgId: null as string | null,
};

/**
 * Called by the reaction event handler on the WhatsApp client.
 * If the reaction is on our sent message, store it for the polling loop to pick up.
 */
export function onReaction(reaction: Reaction, reactedMsgId: string): void {
  logger.debug('Checking reaction', {
    reactedMsgId,
    watchedMsgId: state.watchedMsgId,
    emoji: reaction.reaction,
    senderId: reaction.senderId,
  });

  if (!state.watchedMsgId) return;

  // Match: reaction is on the message we sent
  if (reactedMsgId === state.watchedMsgId && reaction.reaction) {
    logger.info('Bot reacted to our message', { emoji: reaction.reaction });
    state.reactionEmoji = reaction.reaction;
  }
}

/**
 * Send a command to the bot and wait for either a text reply or a reaction.
 * Uses polling for text messages and an event listener for reactions.
 */
export async function sendAndWaitForReply(command: string): Promise<string> {
  // Reset state
  state.reactionEmoji = null;
  state.watchedMsgId = null;

  // Send the command and track the message ID for reaction matching
  const sentMsg = await whatsappClient.sendMessageToBot(command);
  const sentMsgId = sentMsg.id._serialized;
  const sentAt = Date.now();

  state.watchedMsgId = sentMsgId;
  logger.debug('Watching for reply/reaction', { sentMsgId });

  const deadline = Date.now() + config.reply.timeoutMs;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    // Check if a reaction was received (via event handler)
    // Wait a bit longer — bots often send an emoji reaction followed by a text message
    if (state.reactionEmoji) {
      const emoji = state.reactionEmoji;
      logger.info('Reaction detected, waiting for possible text follow-up', { emoji });
      await sleep(REACTION_EXTRA_WAIT_MS);

      // Poll for text messages that may have arrived after the reaction
      try {
        const chat = await whatsappClient.getBotChat();
        const messages = await chat.fetchMessages({ limit: 5 });
        const textReplies = messages.filter((msg) => {
          if (msg.fromMe) return false;
          return msg.timestamp * 1000 > sentAt;
        });

        if (textReplies.length > 0) {
          const combined = textReplies.map((msg) => msg.body?.trim()).filter(Boolean).join('\n');
          if (combined) {
            logger.info('Text reply arrived after reaction, using text', {
              emoji,
              messageCount: textReplies.length,
            });
            state.watchedMsgId = null;
            return combined;
          }
        }
      } catch (error) {
        logger.debug('Error polling after reaction', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // No text message followed — return the reaction
      state.watchedMsgId = null;
      const label = REACTION_LABELS[emoji] || emoji;
      return `הבוט הגיב: ${emoji} ${label}`;
    }

    // Poll for text messages
    try {
      const chat = await whatsappClient.getBotChat();
      const messages = await chat.fetchMessages({ limit: 5 });

      const botReplies = messages.filter((msg) => {
        if (msg.fromMe) return false;
        return msg.timestamp * 1000 > sentAt;
      });

      if (botReplies.length > 0) {
        // Buffer briefly to catch multi-message replies
        await sleep(config.reply.bufferMs);

        // Check for reaction one more time (might have arrived during buffer)
        if (state.reactionEmoji) {
          const emoji = state.reactionEmoji;
          state.watchedMsgId = null;
          const label = REACTION_LABELS[emoji] || emoji;
          const textPart = botReplies.map((msg) => msg.body?.trim()).filter(Boolean).join('\n');
          return textPart ? `${textPart}` : `הבוט הגיב: ${emoji} ${label}`;
        }

        const freshChat = await whatsappClient.getBotChat();
        const freshMessages = await freshChat.fetchMessages({ limit: 10 });
        const allReplies = freshMessages.filter((msg) => {
          if (msg.fromMe) return false;
          return msg.timestamp * 1000 > sentAt;
        });

        const combined = allReplies.map((msg) => msg.body?.trim()).filter(Boolean).join('\n');
        logger.info('Bot reply received via polling', {
          messageCount: allReplies.length,
          length: combined.length,
        });
        state.watchedMsgId = null;
        return combined || 'הבוט הגיב אבל ההודעה ריקה.';
      }
    } catch (error) {
      logger.debug('Error polling bot chat', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  state.watchedMsgId = null;
  logger.warn('Reply timeout — bot did not respond', {
    timeoutMs: config.reply.timeoutMs,
  });
  return 'הבוט לא הגיב. נסה שוב מאוחר יותר.';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
