# Multi-stage Dockerfile for NixOS-based AI IDE
# For deployment on Render, Railway, Fly.io etc.

# Stage 1: Build with Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Install migrations tool
RUN npm install -g drizzle-kit pg

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/shared/schema.ts ./shared/schema.ts

# Expose port
EXPOSE 5000

# Start script to run migrations then app
CMD ["sh", "-c", "npx drizzle-kit push && node dist/index.js"]
