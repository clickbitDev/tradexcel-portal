# Stage 1: Dependencies
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Install qpdf for PDF encryption
RUN apt-get update && apt-get install -y openssl qpdf && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Copy Prisma files early so client generation can succeed during install/build
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Stage 2: Build
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma Client explicitly for deterministic container builds
RUN npx prisma generate

# Clean any existing build artifacts to ensure a fresh build
RUN rm -rf .next

# Accept build arguments for environment variables needed at build time
# CRITICAL: In Next.js standalone mode, NEXT_PUBLIC_* variables are embedded at build time.
# These MUST be provided as build arguments during Docker build, AND also set at runtime.
# 
# In Dokploy, you need to:
# 1. Set these as BUILD ARGUMENTS (for the build process)
# 2. Set these as RUNTIME ENVIRONMENT VARIABLES (for the running container)
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""

# Set build-time environment variables
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# Force a clean build without cache to prevent stale chunks
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application (postbuild script will run automatically)
# Use --no-cache flag to ensure clean build
RUN npm run build

# Verify that static files and standalone directory exist after build
RUN ls -la /app/.next/standalone || (echo "ERROR: .next/standalone directory not found" && exit 1)
RUN ls -la /app/.next/static || (echo "ERROR: .next/static directory not found" && exit 1)
RUN test -f /app/.next/standalone/server.js || (echo "ERROR: server.js not found in standalone" && exit 1)
RUN test -d /app/.next/standalone/.next/static || (echo "ERROR: .next/static not copied to standalone by postbuild script" && exit 1)
RUN test -d /app/.next/standalone/public || (echo "WARNING: public directory not found in standalone (may be optional)" || true)

# Verify chunks directory exists and has files
RUN echo "=== Verifying chunks directory ===" && \
    test -d /app/.next/standalone/.next/static/chunks || (echo "ERROR: chunks directory not found" && exit 1) && \
    CHUNK_COUNT=$(find /app/.next/standalone/.next/static/chunks -type f | wc -l) && \
    echo "Found $CHUNK_COUNT chunk files" && \
    test $CHUNK_COUNT -gt 0 || (echo "ERROR: No chunk files found" && exit 1) && \
    echo "✓ Chunks verification passed"

# Stage 3: Production
FROM node:20-bookworm-slim AS production
WORKDIR /app

# Install qpdf for PDF encryption and openssl for Prisma Query Engine
RUN apt-get update && apt-get install -y openssl qpdf && rm -rf /var/lib/apt/lists/*

# Set environment to production
ENV NODE_ENV=production
# PORT can be overridden by Dokploy via environment variable
# Default to 3000 (standard Next.js port) for better compatibility with deployment platforms
ENV PORT=3000

# Accept build arguments - these should be passed during docker build
# These will be used as defaults if runtime env vars are not set
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG ENABLE_DETAILED_PROD_ERRORS=true

# Set environment variables from build args (if provided)
# These can be overridden by runtime environment variables set by the deployment platform
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
ENV ENABLE_DETAILED_PROD_ERRORS=${ENABLE_DETAILED_PROD_ERRORS}

# Copy standalone output from builder stage
# The postbuild script has already copied public and .next/static into standalone
# In standalone mode, everything needed is in the standalone directory
COPY --from=builder /app/.next/standalone ./

# Ensure Prisma query engines and schema are available in the standalone production environment
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
RUN mkdir -p ./scripts
COPY --from=builder /app/scripts/validate-runtime-env.js ./scripts/validate-runtime-env.js

# Copy PDF assets directory for certificate generation
COPY --from=builder /app/src/lib/pdf/assets ./src/lib/pdf/assets

# DIAGNOSTIC: Show file structure AFTER copying
RUN echo "=== DIAGNOSTIC: File structure in container ===" && \
    echo "--- /app contents ---" && \
    ls -la /app && \
    echo "--- /app/.next contents ---" && \
    ls -la /app/.next 2>/dev/null || echo ".next does not exist" && \
    echo "--- /app/.next/static contents ---" && \
    ls -la /app/.next/static 2>/dev/null || echo ".next/static does not exist" && \
    echo "--- /app/.next/static/chunks (first 5 files) ---" && \
    ls -la /app/.next/static/chunks 2>/dev/null | head -5 || echo ".next/static/chunks does not exist" && \
    echo "--- /app/.next/static/css (first 5 files) ---" && \
    ls -la /app/.next/static/css 2>/dev/null | head -5 || echo ".next/static/css does not exist" && \
    echo "=== END DIAGNOSTIC ==="

# Expose port (default 3000, but can be overridden via PORT env var)
# Next.js standalone server respects the PORT environment variable
EXPOSE 3000

# Fail fast on missing runtime env before starting the standalone server
CMD ["sh", "-c", "node scripts/validate-runtime-env.js && exec node server.js"]
