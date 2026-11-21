# PRAXIS — all-in-one image: builds frontend, serves it from the Express API.
# Target: Render Web Service (Docker runtime) or any Docker host.

# ---------- Stage 1: build the frontend ----------
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: backend runtime ----------
FROM node:20-bookworm-slim AS runtime
# System Chromium for Puppeteer (avoids the ~170MB Chrome-for-Testing download and sandbox issues)
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY backend/ ./

# Built frontend lands where src/app.js looks for it: <repoRoot>/frontend/dist
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Non-root user; storage dir must be writable for PDFs
RUN mkdir -p /app/backend/storage && chown -R node:node /app
USER node

EXPOSE 10000
CMD ["node", "src/server.js"]
