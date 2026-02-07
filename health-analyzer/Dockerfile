# Proofi Health Analyzer Agent
# Open source, transparent, no black box

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S proofi && \
    adduser -S proofi -u 1001 -G proofi

# Create keys directory with proper permissions
RUN mkdir -p /app/keys && chown proofi:proofi /app/keys

USER proofi

# Expose port
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3100/status || exit 1

# Start
CMD ["node", "dist/server.js"]
