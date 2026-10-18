# Build context: repo root, after `nx build document-service` (the bundle is self-contained, no node_modules needed).
FROM node:24.21.0-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3003
COPY dist/apps/document-service ./
USER node
EXPOSE 3003
CMD ["node", "main.mjs"]
