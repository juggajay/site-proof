# Stage 1: Install dependencies
FROM node:20-slim AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile

# Stage 2: Build TypeScript
FROM deps AS build
COPY . .
RUN pnpm build

# Stage 3: Production runtime
FROM node:20-slim AS runtime
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json pnpm-lock.yaml ./

RUN pnpm prune --prod && pnpm prisma generate

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
