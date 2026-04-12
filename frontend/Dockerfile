# =============================================================================
# Stage 1: Builder - Build the React application
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# =============================================================================
# Stage 2: Runner - Nginx serve the built application
# =============================================================================
FROM nginx:alpine AS runner

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user for security
RUN adduser -D -s /bin/sh nginxuser && \
    chown -R nginxuser:nginxuser /usr/share/nginx/html && \
    chown -R nginxuser:nginxuser /var/cache/nginx && \
    chown -R nginxuser:nginxuser /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginxuser:nginxuser /var/run/nginx.pid

USER nginxuser

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]