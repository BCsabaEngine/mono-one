# Build context: repo root, after `nx build web` (adapter-node output with all dependencies bundled).
FROM node:24.21.0-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY dist/apps/web ./
RUN echo '{"type":"module"}' > package.json
USER node
EXPOSE 3000
CMD ["node", "index.js"]
