# Local-dev image for the ApprovalIQ API.
# NOTE: not production-hardened (no non-root user, no healthcheck, dev secrets
# via env). Production hardening lands in Phase 15.
# Build context is the REPO ROOT:  docker build -f services/api/Dockerfile .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Prisma engines need OpenSSL at install- and run-time on debian-slim.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY services/api/package.json ./services/api/package.json
COPY services/approval-engine/package.json ./services/approval-engine/package.json
COPY services/document-engine/package.json ./services/document-engine/package.json
COPY services/workflow-engine/package.json ./services/workflow-engine/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/domain-types/package.json ./packages/domain-types/package.json
COPY packages/test-fixtures/package.json ./packages/test-fixtures/package.json
COPY . .
RUN pnpm install --frozen-lockfile --filter api...
RUN pnpm --filter api build

FROM base AS runner
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/api/node_modules ./services/api/node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/services/api/dist ./services/api/dist
COPY --from=build /app/services/api/package.json ./services/api/package.json
COPY --from=build /app/services/api/prisma ./services/api/prisma
WORKDIR /app/services/api
EXPOSE 3001
CMD ["node", "dist/main.js"]