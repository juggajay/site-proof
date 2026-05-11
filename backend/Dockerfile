# syntax=docker/dockerfile:1.7

# Stage 0: Shared runtime dependencies
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Stage 1: Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --no-audit --no-fund \
  && node -e "require.resolve('prisma/package.json'); require.resolve('typescript/package.json'); require.resolve('@prisma/client/package.json')"

# Stage 2: Build TypeScript
FROM deps AS build
COPY . .
RUN ./node_modules/.bin/prisma generate && npm run build

# Stage 3: Prune development dependencies for production runtime
FROM deps AS prod-deps
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund \
  && node -e "require.resolve('express/package.json'); require.resolve('@prisma/client/package.json')" \
  && npm cache clean --force

# Stage 4: Production runtime
FROM base AS runtime
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

RUN mkdir -p uploads/avatars uploads/comments uploads/company-logos uploads/documents uploads/drawings uploads/certificates logs \
  && chown -R node:node /app

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "const port = process.env.PORT || 3001; fetch('http://127.0.0.1:' + port + '/ready').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
