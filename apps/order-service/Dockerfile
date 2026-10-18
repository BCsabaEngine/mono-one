# Build context: repo root, after `nx build order-service` (the bundle is self-contained, no node_modules needed).
FROM node:24.21.0-slim
WORKDIR /app
ENV NODE_ENV=production MIGRATIONS_DIR=/app/migrations PORT=3002
COPY dist/apps/order-service ./
USER node
EXPOSE 3002
CMD ["node", "main.mjs"]
