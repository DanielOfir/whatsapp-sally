"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReaction = onReaction;
exports.sendAndWaitForReply = sendAndWaitForReply;
const logger_1 = require("../../config/logger");
const env_1 = require("../../config/env");
const client_1 = require("./client");
const POLL_INTERVAL_MS = 2000;
/** Map of emoji reactions to Hebrew descriptions for TTS */
const REACTION_LABELS = {
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
    reactionEmoji: null,
    watchedMsgId: null,
};
/**
 * Called by the reaction event handler on the WhatsApp client.
 * If the reaction is on our sent message, store it for the polling loop to pick up.
 */
function onReaction(reaction, reactedMsgId) {
    logger_1.logger.debug('Checking reaction', {
        reactedMsgId,
        watchedMsgId: state.watchedMsgId,
        emoji: reaction.reaction,
        senderId: reaction.senderId,
    });
    if (!state.watchedMsgId)
        return;
    // Match: reaction is on the message we sent
    if (reactedMsgId === state.watchedMsgId && reaction.reaction) {
        logger_1.logger.info('Bot reacted to our message', { emoji: reaction.reaction });
        state.reactionEmoji = reaction.reaction;
    }
}
/**
 * Send a command to the bot and wait for either a text reply or a reaction.
 * Uses polling for text messages and an event listener for reactions.
 */
async function sendAndWaitForReply(command) {
    // Reset state
    state.reactionEmoji = null;
    state.watchedMsgId = null;
    // Send the command and track the message ID for reaction matching
    const sentMsg = await client_1.whatsappClient.sendMessageToBot(command);
    const sentMsgId = sentMsg.id._serialized;
    const sentAt = Date.now();
    state.watchedMsgId = sentMsgId;
    logger_1.logger.debug('Watching for reply/reaction', { sentMsgId });
    const deadline = Date.now() + env_1.config.reply.timeoutMs;
    while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        // Check if a reaction was received (via event handler)
        if (state.reactionEmoji) {
            const emoji = state.reactionEmoji;
            state.watchedMsgId = null;
            const label = REACTION_LABELS[emoji] || emoji;
            return `הבוט הגיב: ${emoji} ${label}`;
        }
        // Poll for text messages
        try {
            const chat = await client_1.whatsappClient.getBotChat();
            const messages = await chat.fetchMessages({ limit: 5 });
            const botReplies = messages.filter((msg) => {
                if (msg.fromMe)
                    return false;
                return msg.timestamp * 1000 > sentAt;
            });
            if (botReplies.length > 0) {
                // Buffer briefly to catch multi-message replies
                await sleep(env_1.config.reply.bufferMs);
                // Check for reaction one more time (might have arrived during buffer)
                if (state.reactionEmoji) {
                    const emoji = state.reactionEmoji;
                    state.watchedMsgId = null;
                    const label = REACTION_LABELS[emoji] || emoji;
                    const textPart = botReplies.map((msg) => msg.body?.trim()).filter(Boolean).join('\n');
                    return textPart ? `${textPart}` : `הבוט הגיב: ${emoji} ${label}`;
                }
                const freshChat = await client_1.whatsappClient.getBotChat();
                const freshMessages = await freshChat.fetchMessages({ limit: 10 });
                const allReplies = freshMessages.filter((msg) => {
                    if (msg.fromMe)
                        return false;
                    return msg.timestamp * 1000 > sentAt;
                });
                const combined = allReplies.map((msg) => msg.body?.trim()).filter(Boolean).join('\n');
                logger_1.logger.info('Bot reply received via polling', {
                    messageCount: allReplies.length,
                    length: combined.length,
                });
                state.watchedMsgId = null;
                return combined || 'הבוט הגיב אבל ההודעה ריקה.';
            }
        }
        catch (error) {
            logger_1.logger.debug('Error polling bot chat', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    state.watchedMsgId = null;
    logger_1.logger.warn('Reply timeout — bot did not respond', {
        timeoutMs: env_1.config.reply.timeoutMs,
    });
    return 'הבוט לא הגיב. נסה שוב מאוחר יותר.';
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=replyWaiter.js.map