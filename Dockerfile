# ── Stage 1: install dependencies ──────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: build the app ──────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (OPENAI_API_KEY isn't needed at build time since
# it's only read inside API route handlers at request time, not during
# the build itself — but NEXT_PUBLIC_* vars would need to be passed here
# via ARG/ENV if you ever add any).
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: production runtime ─────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output includes only the files needed to run the app —
# a self-contained server.js plus the minimal node_modules subset.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]