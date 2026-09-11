# GitHub Actions

CI lives in `.github/workflows/ci.yml` at the repo root (GitHub only
discovers workflows there): checkout → pnpm + Node (`.nvmrc`) → frozen-lockfile
install → lint → typecheck → Postgres service + Prisma `migrate deploy` →
test → web build → API build. No image publishing or deploys (Phase 15).
