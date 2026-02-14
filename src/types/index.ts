export interface Config {
  whatsapp: {
    sessionPath: string;
    botPhoneNumber: string;
  };
  webhook: {
    secret: string;
    port: number;
  };
  reply: {
    timeoutMs: number;
    bufferMs: number;
  };
  commands: {
    add: string;
    remove: string;
    bought: string;
    list: string;
    clear: string;
  };
  logging: {
    level: string;
    file: string;
  };
}

export interface HAWebhookEvent {
  action: 'add' | 'remove' | 'bought' | 'list' | 'clear';
  item?: string;
}
