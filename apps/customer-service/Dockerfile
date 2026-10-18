# Build context: repo root, after `nx build customer-service` (the bundle is self-contained, no node_modules needed).
FROM node:24.21.0-slim
WORKDIR /app
ENV NODE_ENV=production MIGRATIONS_DIR=/app/migrations PORT=3001
COPY dist/apps/customer-service ./
USER node
EXPOSE 3001
CMD ["node", "main.mjs"]
