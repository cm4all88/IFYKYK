FROM node:20-bookworm-slim

# System libraries Remotion / headless Chromium need.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 \
    libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
    libpango-1.0-0 libcairo2 libcups2 libx11-6 libxcb1 libxext6 \
    fonts-liberation ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
# Remotion downloads its headless shell on first boot (server.mjs calls ensureBrowser).
EXPOSE 8080
CMD ["node", "server.mjs"]
