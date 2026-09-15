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

## Authentication & Google OAuth

ApprovalIQ supports both standard Email/Password authentication and Google OAuth 2.0 Sign-In.

### Environment Configuration (`.env`)

```env
# Backend & Frontend URLs
PORT=3001
VITE_API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

### Google Cloud Console Configuration

To configure Google OAuth in Google Cloud Console:
1. Go to **APIs & Services** > **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Set **Authorized JavaScript origins**:
   - `http://localhost:5173` (Frontend)
   - `http://localhost:3001` (Backend API)
4. Set **Authorized redirect URIs**:
   - `http://localhost:3001/auth/google/callback`
5. Copy the Client ID and Client Secret into your `.env` file.
