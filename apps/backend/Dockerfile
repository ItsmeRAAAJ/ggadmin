# ---- Build stage ----
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

# Prisma 7 needs both the schema and prisma.config.ts to generate the client
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .
# Compiles src/ and prisma/seed.ts into dist/
RUN npm run build

# ---- Production stage ----
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

RUN npx prisma generate

USER node
EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3002}/health" >/dev/null || exit 1

# Apply pending migrations, then start the API.
# Seed (branches, roles, permissions, first super admin) is run separately:
#   docker compose exec backend node dist/prisma/seed.js
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
