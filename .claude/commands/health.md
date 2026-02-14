Check the health of the running whatsapp-bridge service.

Run these diagnostic checks:

1. Hit the health endpoint: `curl -s http://localhost:3000/health | python3 -m json.tool`
   - If using Docker, try port 3002 instead: `curl -s http://localhost:3002/health | python3 -m json.tool`
   - Expected response: `{"status": "ok", "whatsapp": true, "uptime": <seconds>}`
   - If `whatsapp` is false, the WhatsApp client is not connected (may need QR code scan)

2. Check if the process is running: `lsof -i :3000` (or `:3002` for Docker)

3. Check for recent errors in the log file:
   - Read the last 50 lines of `data/logs/bridge.log`
   - Read the last 20 lines of `data/logs/error.log`

4. If running in Docker, also check: `docker ps --filter name=whatsapp-bridge` and `docker logs --tail 50 whatsapp-bridge`

Report the findings clearly: whether the service is up, whether WhatsApp is connected, and any recent errors.

Working directory: /Users/daniel/Documents/projects/claude-play/whatsapp-bridge
