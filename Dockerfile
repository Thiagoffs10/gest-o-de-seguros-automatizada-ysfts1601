# =============================================================================
# Dockerfile — Frontend CRED10MIX (React + Vite)
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_POCKETBASE_URL=http://127.0.0.1:8090
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL

RUN pnpm build

# -----------------------------------------------------------------------------
# Serve estático com nginx
# -----------------------------------------------------------------------------
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
