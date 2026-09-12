# @approvaliq/approval-engine

Pure TypeScript approval evaluation engine for ApprovalIQ — a small, typed,
deterministic rule interpreter. Given a `BusinessProfile`, a list of
`ApprovalDefinition`s and a list of `Dependency` edges, `evaluate()` returns an
`EvaluationResult` with per-approval outcomes (`applicable` / `not_applicable` /
`needs_information` / `not_evaluable`), deduplicated required documents,
`depends_on`-ordered approval ids, parallel groups (topological layers), and
warnings (including the cycle assertion).

Conditions are a closed expression tree (`all`, `any`, `not`, `eq`, `in`, typed
numeric `range` with min/max + inclusive/exclusive bounds). Numeric checks on
`areaSqft` must pin an `expectedAreaType`; checks on `investmentAmountInr` must
pin the investment definition. A definition mismatch (or an unknown definition)
yields `needs_information` naming the mismatch — never a silent cross-definition
numeric comparison.

**Constraint:** this package must stay pure TypeScript. NestJS, database/ORM,
HTTP-client, and LLM-SDK imports are banned by the package ESLint rule in
`eslint.config.mjs`. It only depends on `@approvaliq/domain-types` (plus
dev-time tooling) so the engine stays portable and unit-testable with zero
other services running.

Scripts: `pnpm --filter @approvaliq/approval-engine test` runs the Node
`node:test` suite directly (`test/evaluate.test.ts` executes under Node's
native TypeScript stripping; only the engine, `@approvaliq/domain-types`, and
the test runner are importable there).
`pnpm --filter @approvaliq/approval-engine lint` runs ESLint (imports ban).
