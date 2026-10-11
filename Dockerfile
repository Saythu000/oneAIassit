FROM node:20-slim

WORKDIR /app

# Install openssl and ca-certificates for database and runtime connections
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy package manifests and Prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies needed for building (including devDependencies like tailwindcss & typescript)
RUN npm install --legacy-peer-deps

# Ensure whatsapp-rust-bridge exports resolve properly under modern Node ESM/CJS loader
RUN node -e '\
const fs = require("fs"); \
const p = "./node_modules/whatsapp-rust-bridge/package.json"; \
if (fs.existsSync(p)) { \
  const pkg = JSON.parse(fs.readFileSync(p, "utf8")); \
  pkg.main = "./dist/index.js"; \
  if (pkg.exports && pkg.exports["."]) { \
    pkg.exports["."].require = "./dist/index.js"; \
    pkg.exports["."].default = "./dist/index.js"; \
  } \
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2)); \
  console.log("Patched whatsapp-rust-bridge exports for container runtime"); \
}'

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application codebase
COPY . .

# Build Next.js production bundle
RUN npm run build

# Set production runtime environment
ENV NODE_ENV=production

# Expose HTTP & Socket.IO unified port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/tenant/info || exit 1

# Start the unified application
CMD ["npm", "run", "start"]
