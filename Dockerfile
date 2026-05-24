# ─── Stage 1: Builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Workspace manifest'lerini kopyala (npm ci için hepsi gerekli)
COPY package.json package-lock.json ./
COPY shared/package.json    ./shared/
COPY backend/package.json   ./backend/
COPY mobile/package.json    ./mobile/

# Tüm workspace bağımlılıklarını yükle
RUN npm ci

# Kaynak kodları kopyala
COPY shared/src          ./shared/src
COPY backend/src         ./backend/src
COPY backend/tsconfig.json ./backend/

# Backend'i derle (shared tipler de backend/dist/ içine gömülür)
RUN npm run backend:build

# ─── Stage 2: Runner ────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Sadece backend/package.json kopyala (workspace değil, standalone)
COPY backend/package.json ./

# focusarena-shared runtime'da gerekmez → derlendi, dist içinde.
# Workspace olmadan sadece dış npm paketlerini yükle.
RUN node -e " \
  const pkg = require('./package.json'); \
  delete pkg.dependencies['focusarena-shared']; \
  require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2)); \
" && npm install --omit=dev --ignore-scripts

# Derlenmiş dosyaları kopyala
COPY --from=builder /app/backend/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Healthcheck — Fly.io bu endpointi kullanır
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/server.js"]
