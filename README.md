# ApprovalIQ

ApprovalIQ is an industrial approvals platform that helps businesses (e.g. breweries) manage permit, license and compliance approval workflows.

## Getting started

```bash
pnpm install
docker compose up -d
pnpm dev
```

`pnpm dev` starts the database (docker compose), the API (`services/api`) and the web app (`apps/web`) concurrently.

## Repository layout

- `apps/` — user-facing applications (web, and in later phases the mobile/desktop shells)
- `services/` — backend services (NestJS API, approval engine, document engine, workflow engine)
- `packages/` — shared packages (contracts, domain-types, test-fixtures)
- `database/` — migrations and seeds
- `data/` — research and reference CSV data
- `docs/` — architecture documentation
- `infra/` — docker and GitHub Actions configuration

## Architecture docs

Architecture decisions live in [`docs/architecture/decisions`](docs/architecture/decisions) (ADR format). High-level architecture documentation lives in [`docs/architecture`](docs/architecture).
