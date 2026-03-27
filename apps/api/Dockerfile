FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci \
  && npm install -g @openai/codex \
  && npm run build --workspace @codex-builder/shared \
  && npm run build --workspace @codex-builder/api \
  && mkdir -p /app/.runtime/projects

ENV NODE_ENV=production
ENV PORT=10000
ENV CODEX_BIN=/usr/local/bin/codex
ENV MANAGED_PROJECT_ROOT=/app/.runtime/projects

EXPOSE 10000

CMD ["npm", "run", "start", "--workspace", "@codex-builder/api"]
