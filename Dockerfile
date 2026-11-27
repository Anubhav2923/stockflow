FROM node:24-bookworm-slim AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma.config.ts backend/tsconfig.json ./
COPY backend/prisma/ ./prisma/
COPY backend/src/ ./src/
RUN npm run build
COPY --from=frontend /frontend/dist/ ./dist/public/
ENV NODE_ENV=production PORT=10000
USER node
EXPOSE 10000
CMD ["sh", "-c", "npm run db:deploy && npm run db:seed && exec node dist/server.js"]
