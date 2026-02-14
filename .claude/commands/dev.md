Start the whatsapp-bridge in development mode using ts-node.

Run `npm run dev` from the whatsapp-bridge directory. This runs `ts-node src/index.ts` directly without a build step.

IMPORTANT: This launches a long-running process (Express server + WhatsApp client). Run it in background and monitor the output. The app will:
1. Start the Express webhook server on the configured port (default 3000)
2. Initialize the WhatsApp client (may show a QR code on first run)
3. Listen for incoming webhook requests

If it fails to start, check:
- Port conflicts: `lsof -i :3000` — kill conflicting process or set WEBHOOK_PORT in .env
- Missing BOT_PHONE_NUMBER in .env file
- Node.js version (requires Node 20+)
- Missing dependencies: run `npm install` first

Working directory: /Users/daniel/Documents/projects/claude-play/whatsapp-bridge
