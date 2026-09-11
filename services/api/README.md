# api (ApprovalIQ backend)

NestJS (TypeScript, strict) API service.

## Setup

```bash
# from the repo root
cp .env.example .env            # root .env, used by `docker compose`
docker compose up -d postgres
pnpm --filter api prisma migrate dev
pnpm --filter api start:dev
```

`services/api/.env` (gitignored, dev defaults) is used when running the API
directly from this folder; the root `.env` is picked up by `docker compose`
and as a fallback via `envFilePath: ['.env', '../../.env']`.

## Endpoints

- `GET /health` — `{ status: "ok", timestamp }`, verifies DB connectivity
- `POST /auth/register` — `{ email, password, role: applicant|officer|admin }`
- `POST /auth/login` — returns `{ accessToken, refreshToken }` JWT pair
- `GET /api/docs` — auto-generated Swagger UI (OpenAPI baseline)

## Auth building blocks for later phases

- `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`) — `@UseGuards(JwtAuthGuard)`
- `@Roles(...)` + `RolesGuard` (`src/common/...`) — role-restricted routes
- Passwords hashed with argon2; roles stored on the `User` record.

Errors always use the envelope `{ error: { code, message, details? } }` via
`AllExceptionsFilter` — stack traces are logged server-side only.

