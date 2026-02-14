FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ------- Production image -------
FROM node:20-slim

# Install Chromium and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create a wrapper for chrome_crashpad_handler that ignores the --database requirement
# This fixes the crashpad_handler error without disabling crash reporting entirely
RUN mv /usr/lib/chromium/chrome_crashpad_handler /usr/lib/chromium/chrome_crashpad_handler.real \
    && printf '#!/bin/sh\nexec /usr/lib/chromium/chrome_crashpad_handler.real --database=/tmp "$@"\n' > /usr/lib/chromium/chrome_crashpad_handler \
    && chmod +x /usr/lib/chromium/chrome_crashpad_handler

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Run as non-root - create user with explicit UID to match common volume ownership
RUN groupadd -r -g 997 botuser && useradd -r -u 997 -g botuser botuser

# Create data directories with proper ownership
RUN mkdir -p /app/data/whatsapp-session /app/data/logs \
    && chown -R botuser:botuser /app

# Ensure /tmp and subdirs are writable by botuser
RUN mkdir -p /tmp/chrome /tmp/.X11-unix \
    && chmod 1777 /tmp \
    && chown -R botuser:botuser /tmp/chrome /tmp/.X11-unix

USER botuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ process.exit(JSON.parse(d).status==='ok'?0:1) }) })"

CMD ["node", "dist/index.js"]
