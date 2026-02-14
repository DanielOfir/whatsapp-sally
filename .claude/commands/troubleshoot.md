Diagnose and troubleshoot issues with the whatsapp-bridge.

Run a comprehensive diagnostic of the whatsapp-bridge. Check ALL of the following:

## 1. Process Status
- Check if the app is running locally: `lsof -i :3000`
- Check if running in Docker: `docker ps --filter name=whatsapp-bridge`

## 2. Health Check
- `curl -s http://localhost:3000/health` (local) or `curl -s http://localhost:3002/health` (Docker)
- Report: is the server responding? Is WhatsApp connected?

## 3. Configuration
- Read `.env` file — verify BOT_PHONE_NUMBER is set
- Check if WEBHOOK_SECRET is configured (webhook auth enabled?)
- Note any non-default settings

## 4. Logs Analysis
- Read the last 50 lines of `data/logs/bridge.log`
- Read `data/logs/error.log` for error-level issues
- If Docker: `docker logs --tail 50 whatsapp-bridge`

## 5. Common Issues Checklist
- **Port in use**: EADDRINUSE error → `lsof -i :3000` to find conflicting process
- **WhatsApp disconnected**: `whatsapp: false` in health → needs QR scan or session expired
- **Stale Chromium locks**: check for SingletonLock/SingletonSocket/SingletonCookie files in `data/whatsapp-session/session/`
- **Auth failure**: check for `auth_failure` in logs → may need to delete session and re-scan QR
- **Bot not responding**: check REPLY_TIMEOUT_MS, verify BOT_PHONE_NUMBER is correct
- **TypeScript errors**: run `npx tsc --noEmit` to check for type errors without building
- **Missing dependencies**: check if `node_modules` exists, run `npm install` if needed
- **Node version**: `node --version` — requires v20+

## 6. Network
- Can the webhook port be reached? `curl -s http://localhost:3000/health`
- For Docker, check port mapping: `docker port whatsapp-bridge`

Report all findings organized by category. For each issue found, suggest the specific fix.

Working directory: /Users/daniel/Documents/projects/claude-play/whatsapp-bridge
