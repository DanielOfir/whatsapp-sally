# WhatsApp Bridge — HA Voice Assistant ↔ Existing WhatsApp Bot

**Version:** 1.0.0
**Language:** Hebrew user-facing, English internal
**Architecture:** Relay/bridge — does NOT own the grocery bot logic

## What This App Does

Bridges Home Assistant Voice Assistant to an **existing** WhatsApp grocery bot (managed by someone else). The user speaks voice commands to HA, which are relayed as WhatsApp messages to the bot. The bot's text reply is captured and spoken back via TTS.

```
Voice → HA → curl → Bridge webhook → WhatsApp DM to bot → bot replies → Bridge returns reply → HA TTS
```

## Key Differences from whatsapp-web / whatsapp-bot

| | whatsapp-web / whatsapp-bot | whatsapp-bridge |
|---|---|---|
| **Role** | IS the grocery bot | Relays TO an existing bot |
| **Database** | SQLite (source of truth) | None |
| **Command logic** | Regex matching, CRUD ops | Template-based forwarding |
| **AI categorization** | OpenAI gpt-4o-mini | None |
| **WhatsApp connection** | whatsapp-web.js | whatsapp-web.js |
| **HA integration** | Webhook → local handler | Webhook → WhatsApp DM → wait for reply |

## Tech Stack

- Node.js 20 + TypeScript
- whatsapp-web.js (Puppeteer/Chromium) — connects as user's personal WhatsApp
- Express.js — webhook server
- Winston — logging

## Startup Sequence

1. Load .env config
2. Start Express webhook server on configured port
3. Wire WhatsApp `message_create` events to ReplyWaiter
4. Initialize WhatsApp client (QR code display on first run)
5. Graceful shutdown on SIGINT/SIGTERM

## Source Files

- `src/index.ts` — Entry point & startup orchestration
- `src/config/env.ts` — .env loader with typed config
- `src/config/logger.ts` — Winston logger (console + file)
- `src/types/index.ts` — TypeScript interfaces (Config, HAWebhookEvent)
- `src/types/qrcode-terminal.d.ts` — Type declaration for qrcode-terminal
- `src/services/whatsapp/client.ts` — WhatsApp client wrapper (LocalAuth, Puppeteer, reconnect)
- `src/services/whatsapp/replyWaiter.ts` — Promise-based reply listener with timeout + multi-message buffering
- `src/webhooks/server.ts` — Express server (/health, /webhook/ha-event)

## How Reply Correlation Works

1. Webhook handler sends command to bot via WhatsApp DM
2. `ReplyWaiter.waitForReply()` returns a Promise
3. WhatsApp `message_create` fires for incoming messages
4. Messages from bot's phone number are buffered
5. After `REPLY_BUFFER_MS` of silence (debounce), buffered messages are joined and the Promise resolves
6. If `REPLY_TIMEOUT_MS` elapses with no reply, resolves with a Hebrew timeout message

This handles bots that split replies across multiple messages.

## Environment Variables

### Required
- `BOT_PHONE_NUMBER` — Bot's WhatsApp number with `@c.us` suffix (e.g., `972501234567@c.us`)

### Optional
- `WEBHOOK_SECRET` — Bearer token for HA webhook auth
- `WEBHOOK_PORT` — Default `3000`
- `WHATSAPP_SESSION_PATH` — Chromium profile path (default: `./data/whatsapp-session`)
- `REPLY_TIMEOUT_MS` — Max wait for bot reply (default: `30000`)
- `REPLY_BUFFER_MS` — Buffer window for multi-message replies (default: `1500`)
- `CMD_TEMPLATE_ADD` — Add command template (default: `הוסף {item}`)
- `CMD_TEMPLATE_REMOVE` — Remove command template (default: `הסר {item}`)
- `CMD_TEMPLATE_BOUGHT` — Bought command template (default: `קניתי {item}`)
- `CMD_TEMPLATE_LIST` — List command (default: `רשימה`)
- `CMD_TEMPLATE_CLEAR` — Clear command (default: `נקה`)
- `LOG_LEVEL` — Default `info`
- `LOG_FILE` — Default `./data/logs/bridge.log`

## Home Assistant Integration

Uses `trigger: conversation` automations (not `platform: intent`).
Hebrew voice sentence patterns trigger `shell_command` calls to the bridge webhook.
The bridge's JSON response is parsed and spoken via `set_conversation_response`.

See `home-assistant/automations/grocery_bridge.yaml` for full configuration.

### Supported Voice Actions
- **Add**: "תוסיף חלב לרשימת הקניות" → sends `הוסף חלב` to bot
- **Remove**: "תסיר חלב מהרשימה" → sends `הסר חלב` to bot
- **Bought**: "קניתי חלב" → sends `קניתי חלב` to bot
- **List**: "מה ברשימת הקניות" → sends `רשימה` to bot
- **Clear**: "נקה את הרשימה" → sends `נקה` to bot

## Docker

- Multi-stage build (needs Chromium for whatsapp-web.js)
- `node:20-slim` with Chromium dependencies
- Non-root user (botuser)
- 2 named volumes: session, logs
- Port 3002 externally (avoids conflict with other apps)
- Health check every 30s

## Claude Commands

Slash commands for running, debugging, and troubleshooting:

| Command | What it does |
|---|---|
| `/build` | Compile TypeScript → `dist/`, fix errors if any |
| `/dev` | Start in dev mode with `ts-node` (no build step) |
| `/health` | Check health endpoint + process status + recent logs |
| `/logs` | Read and analyze recent log files |
| `/test-webhook [action] [item]` | Send a test HA webhook (e.g., `/test-webhook add חלב`) |
| `/docker-up` | Build & start via Docker Compose |
| `/docker-down` | Stop Docker container |
| `/typecheck` | Run `tsc --noEmit` to check types without building |
| `/troubleshoot` | Full diagnostic: process, health, config, logs, common issues |
| `/reset-session` | Delete WhatsApp session and re-scan QR code |

## Known Issues / Considerations

- WhatsApp session requires QR code scan on first run (same as whatsapp-web app)
- Stale Chromium lock files need cleanup on crash (handled automatically)
- QR code expires every 20 seconds
- Bot reply timeout defaults to 30s — if the bot is slow, increase `REPLY_TIMEOUT_MS`
- Concurrent voice commands are serialized — a second command cancels the pending reply of the first
- Command templates must match what the external bot understands — adjust via env vars
- The `toVoiceText()` function strips WhatsApp formatting for TTS but long lists may sound awkward
