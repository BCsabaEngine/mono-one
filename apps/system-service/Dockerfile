# Build context: repo root, after `nx build system-service` (the bundle is self-contained, no node_modules needed).
FROM node:24.21.0-slim
WORKDIR /app
ENV NODE_ENV=production MIGRATIONS_DIR=/app/migrations PORT=3004
COPY dist/apps/system-service ./
USER node
EXPOSE 3004
CMD ["node", "main.mjs"]
