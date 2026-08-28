FROM oven/bun:1.3.14-debian AS base

# 1. Install dependencies only when needed
FROM base AS deps

WORKDIR /workspace

# Install dependencies based on the preferred package manager
COPY package.json bun.lock ./
RUN bun ci --verbose --no-cache

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
RUN bun run build

# 3. Production image, copy all the files and run next
FROM nginx:1.31.3-trixie AS runner
WORKDIR /app

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/dist /var/www/out
