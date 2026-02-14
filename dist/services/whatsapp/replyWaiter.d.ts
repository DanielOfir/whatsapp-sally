import { Reaction } from './client';
/**
 * Called by the reaction event handler on the WhatsApp client.
 * If the reaction is on our sent message, store it for the polling loop to pick up.
 */
export declare function onReaction(reaction: Reaction, reactedMsgId: string): void;
/**
 * Send a command to the bot and wait for either a text reply or a reaction.
 * Uses polling for text messages and an event listener for reactions.
 */
export declare function sendAndWaitForReply(command: string): Promise<string>;
//# sourceMappingURL=replyWaiter.d.ts.map