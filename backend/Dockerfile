FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads logs

# Expose port
EXPOSE 9004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:9004/health || exit 1

# Start the application
CMD ["node", "server.js"]