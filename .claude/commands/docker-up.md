Build and start the whatsapp-bridge using Docker Compose.

Run from the whatsapp-bridge directory:
```
docker compose -f docker/docker-compose.yml up --build -d
```

Then monitor startup:
```
docker logs -f whatsapp-bridge
```
(watch for ~30 seconds to confirm startup completes)

After startup, verify health:
```
curl -s http://localhost:3002/health | python3 -m json.tool
```

Notes:
- The container maps port 3002 (host) → 3000 (container)
- Two named volumes persist data: `whatsapp-session` and `bridge-logs`
- First run requires QR code scan — check `docker logs whatsapp-bridge` for the QR code
- The health check has a 60-second start period before it begins checking

If the build fails, check:
- Docker daemon is running
- No port conflicts on 3002: `lsof -i :3002`
- Sufficient disk space for Chromium layer

Working directory: /Users/daniel/Documents/projects/claude-play/whatsapp-bridge
