Stop the whatsapp-bridge Docker container.

Run from the whatsapp-bridge directory:
```
docker compose -f docker/docker-compose.yml down
```

This stops and removes the container but preserves the named volumes (whatsapp-session and bridge-logs).

To also remove volumes (will require re-scanning QR code):
```
docker compose -f docker/docker-compose.yml down -v
```

Only remove volumes if the user explicitly asks to reset the session.

Working directory: /Users/daniel/Documents/projects/claude-play/whatsapp-bridge
