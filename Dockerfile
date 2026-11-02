# Production image for Coolify: static files served by nginx.
# Only files the browser needs are copied; tests, SQL, n8n workflows,
# reports and decks never reach the web server.
FROM nginx:1.27-alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf

WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

COPY index.html company-hub.html favicon.svg ./
COPY *.js *.css ./
COPY fonts ./fonts
COPY vendor ./vendor
COPY manual ./manual

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
