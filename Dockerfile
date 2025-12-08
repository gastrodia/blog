# Base stage for building the static files
FROM oven/bun:latest AS base
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Build the application
RUN bun run build

# Runtime stage for serving the application
FROM nginx:mainline-alpine-slim AS runtime

# Copy custom nginx config if needed (optional)
# COPY nginx.conf /etc/nginx/nginx.conf

# Copy built static files
COPY --from=base /app/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

# Use nginx user for better security
USER nginx
