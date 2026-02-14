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

# Create data directories and ensure /tmp is writable
RUN mkdir -p /app/data/whatsapp-session /app/data/logs /tmp/chrome \
    && chmod 1777 /tmp /tmp/chrome

# Run as non-root
RUN groupadd -r botuser && useradd -r -g botuser botuser \
    && chown -R botuser:botuser /app /tmp/chrome
USER botuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ process.exit(JSON.parse(d).status==='ok'?0:1) }) })"

CMD ["node", "dist/index.js"]
