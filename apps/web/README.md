# @approvaliq/web

ApprovalIQ web frontend: React + TypeScript + Vite + Tailwind CSS.

- Entrypoint: `src/main.tsx` (router + `QueryClientProvider` + `AuthProvider`)
- Dev server: `pnpm --filter @approvaliq/web dev` (or `pnpm --filter web dev`)
- Routes: `/`, `/login`, `/register`, `/projects`, `/projects/:id/profile`,
  `/projects/:id/approvals?evaluation=<runId>`, `/projects/:id/roadmap`
  (Phase 4 roadmap graph: confirming a profile builds the ApprovalInstances and
  redirects here; the approvals page also links to it). The approvals page
  renders the evaluation returned by confirming a profile version.
- API base URL: `VITE_API_URL` env var (defaults to `http://localhost:3001`);
  see root `.env.example`. All requests go through `src/api-client.ts`,
  which uses shared types from `@approvaliq/contracts`.
- Auth: in-memory JWT store via `src/auth.tsx` (`useAuth()`); tokens are
  never written to localStorage/sessionStorage.
- Reusable states: `LoadingSpinner`, `ErrorBanner`, `EmptyState` in
  `src/components.tsx` — every screen must use these.
