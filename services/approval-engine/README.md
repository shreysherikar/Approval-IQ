# @approvaliq/approval-engine

Pure TypeScript approval evaluation engine for ApprovalIQ.

**Constraint:** no NestJS, database, or HTTP imports are allowed in this package. It may only depend on `@approvaliq/domain-types` (plus dev-time tooling) so the engine stays portable and trivially unit-testable.
