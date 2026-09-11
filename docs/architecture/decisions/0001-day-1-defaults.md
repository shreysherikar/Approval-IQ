# 0001 — Day-1 Defaults

These are working defaults for the Phase 0-3 sprint on 2026-09-11. Revisit before Phase 13 (regulatory KB management) locks in permanent schema decisions.

| Decision | Choice | Rationale | Status: provisional/final |
| --- | --- | --- | --- |
| ORM choice | Prisma | Unchanged | final |
| Package manager | pnpm | Blueprint's choice | final |
| Area measurement | areaSqft + areaType (plot \| built_up \| leased \| operational \| unknown) | Prevents incompatible area comparisons | final |
| Investment definition | investmentAmountInr + investmentDefinition = total_project_cost | Makes the assumption explicit | final |
| Employee count | employeeCount + employeeCountDefinition = full_operational_capacity | Makes the definition explicit | final |
| One project = one premises | Yes, for today | Simplifies today's scope | final |
| Regulatory verification | research_verified only; never production_verified | Production verification requires Phase 13 workflow | final |
| Dependency semantics | depends_on \| informational \| parallel_with \| unknown | Only depends_on gates; requires gatingRationale; shared-document overlap is not itself a dependency | final |
| Conversational LLM in Phase 3 | Deferred to tomorrow | Prove structured intake first | final |
