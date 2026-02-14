FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

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

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY docker/entrypoint.sh /app/entrypoint.sh

# Create non-root user, data directories, and fix permissions
# Create all potential temp directories that Chromium might need
RUN groupadd -r -g 997 botuser && useradd -r -u 997 -g botuser botuser \
    && mkdir -p \
        /app/data/whatsapp-session \
        /app/data/logs \
        /home/botuser \
        /home/botuser/.config \
        /home/botuser/.cache/chromium \
        /home/botuser/tmp \
    && chmod +x /app/entrypoint.sh \
    && chown -R botuser:botuser /app /home/botuser

USER botuser

# Set environment variables for Chromium to use user directories
ENV HOME=/home/botuser
ENV XDG_CONFIG_HOME=/home/botuser/.config
ENV XDG_CACHE_HOME=/home/botuser/.cache
ENV TMPDIR=/home/botuser/tmp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ process.exit(JSON.parse(d).status==='ok'?0:1) }) })"

ENTRYPOINT ["/app/entrypoint.sh"]
