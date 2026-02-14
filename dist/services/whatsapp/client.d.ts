import { Chat, Message } from 'whatsapp-web.js';
export interface Reaction {
    reaction: string;
    senderId: string;
    timestamp: number;
}
export declare class WhatsAppClient {
    private client;
    private isReady;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private readonly baseReconnectDelay;
    private reactionHandler?;
    constructor();
    private setupEventHandlers;
    initialize(): Promise<void>;
    private cleanStaleLocks;
    sendMessageToBot(text: string): Promise<Message>;
    getBotChat(): Promise<Chat>;
    setReactionHandler(handler: (reaction: Reaction, reactedMsgId: string) => void): void;
    private scheduleReconnect;
    isClientReady(): boolean;
    destroy(): Promise<void>;
}
export declare const whatsappClient: WhatsAppClient;
//# sourceMappingURL=client.d.ts.map