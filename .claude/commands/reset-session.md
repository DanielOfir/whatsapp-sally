Reset the WhatsApp session for the bridge. This will require re-scanning the QR code.

IMPORTANT: Confirm with the user before proceeding — this deletes the WhatsApp authentication session.

Steps:

1. Stop the running app:
   - Local: find the process on port 3000 and stop it
   - Docker: `docker compose -f docker/docker-compose.yml down`

2. Remove the session data:
   - Local: `rm -rf data/whatsapp-session/session`
   - Docker: `docker compose -f docker/docker-compose.yml down -v` (removes volumes)

3. Also clean the wwebjs cache if it exists: `rm -rf .wwebjs_cache`

4. Restart the app — it will display a new QR code for scanning:
   - Local: `npm run dev`
   - Docker: `docker compose -f docker/docker-compose.yml up --build -d && docker logs -f whatsapp-bridge`

Tell the user to watch the logs for the QR code and scan it with their phone.

Working directory: /Users/daniel/Documents/projects/claude-play/whatsapp-bridge
