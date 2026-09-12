/**
 * Integration test: the roadmap GET endpoint must ensure the specific subset of
 * ApprovalInstances + depends_on edges it is about to return is acyclic.
 *
 * Upstream checks (Phase 1 import cycle detection, Phase 2 evaluate assertion)
 * make a cycle provably impossible — but a dependency that is manually edited
 * into the DB (bypassing the importer) must NOT silently reach the frontend as
 * a broken/infinite-loop graph. This test constructs exactly such a cyclic
 * fixture directly in the database, then asserts GET /roadmap returns an
 * explicit `roadmap_unavailable` error that describes the offending cycle.
 *
 * Usage (from services/api):
 *   pnpm exec tsx scripts/roadmap_cycle.integration.ts
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ROADMAP_UNAVAILABLE_CODE } from '../src/common/errors/roadmap-unavailable.exception';

function known<T>(value: T): { status: 'known'; value: T } {
  return { status: 'known', value };
}

function fullBreweryValues(): Record<string, unknown> {
  return {
    industry: known('brewery'),
    state: known('Maharashtra'),
    district: known('Pune'),
    landStatus: known('owned'),
    areaSqft: known(25000),
    areaType: known('leased'),
    investmentAmountInr: known(400000000),
    investmentDefinition: known('total_project_cost'),
    employeeCount: known(120),
    employeeCountDefinition: known('full_operational_capacity'),
    activityType: known('beer-manufacturing'),
  };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: unknown };
}

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const prisma = app.get(PrismaService);

  async function call(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`${url}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  const project = await call('POST', '/projects', {
    name: 'Cycle guard IT project',
    industry: 'brewery',
    businessId: 'biz-it-cycle-guard',
  });
  assert(project.status === 201, `POST /projects -> 201, got ${project.status}`);
  const projectId = project.json.id as string;

  // Confirm a brewery profile so the roadmap has real instances (the normal,
  // non-cyclic path — the same flow the roadmap.integration test runs).
  const draft = await call('POST', `/projects/${projectId}/profiles`, {
    values: fullBreweryValues(),
  });
  assert(draft.status === 201, `draft -> 201, got ${draft.status}`);
  const confirmed = await call(
    'POST',
    `/projects/${projectId}/profiles/${draft.json.id as string}/confirm`,
  );
  assert(confirmed.status === 200, `confirm -> 200, got ${confirmed.status}`);

  // Baseline: the untouched (acyclic) roadmap serves 200 with both approvals we
  // intend to wire into a cycle present.
  const baseline = await call('GET', `/projects/${projectId}/roadmap`);
  assert(baseline.status === 200, `baseline roadmap -> 200, got ${baseline.status}`);
  const baselineCodes = (baseline.json.nodes as Array<{ approvalCode: string }>).map(
    (n) => n.approvalCode,
  );
  assert(
    baselineCodes.includes('MPCB-CTE-001') && baselineCodes.includes('MPCB-CTO-001'),
    'baseline roadmap contains MPCB-CTE-001 and MPCB-CTO-001',
  );
  console.log('BASELINE ok: acyclic roadmap serves normally');

  // Manually inject a DEPENDS_ON edge that closes a cycle, bypassing the Phase 1
  // importer that would otherwise have rejected it: MPCB-CTE-001 depends_on
  // MPCB-CTO-001 (the seed data already has MPCB-CTO-001 depends_on MPCB-CTE-001).
  // This is the hypothetical "approval dependency edited between releases" case.
  const cte = await prisma.approvalDefinition.findUnique({ where: { code: 'MPCB-CTE-001' } });
  const cto = await prisma.approvalDefinition.findUnique({ where: { code: 'MPCB-CTO-001' } });
  assert(!!cte && !!cto, 'seed data contains MPCB-CTE-001 and MPCB-CTO-001');
  const injected = await prisma.dependency.create({
    data: {
      fromApprovalId: cte!.id,
      toApprovalId: cto!.id,
      relationship: 'depends_on',
      gatingRationale: 'MANUALLY-INJECTED cyclic edge (test only)',
    },
  });
  assert(!!injected.id, 'injected the reverse depends_on edge');

  // The endpoint must REFUSE to serve the graph — an explicit roadmap_unavailable
  // error describing the offending cycle, never a 200 with a broken graph.
  const res = await call('GET', `/projects/${projectId}/roadmap`);
  assert(res.status === 500, `cyclic roadmap -> 500, got ${res.status}`);
  const envelope = res.json as ErrorEnvelope;
  assert(!!envelope.error, 'error envelope present');
  assert(
    envelope.error.code === ROADMAP_UNAVAILABLE_CODE,
    `error code is '${ROADMAP_UNAVAILABLE_CODE}', got '${envelope.error.code}'`,
  );
  const details = (envelope.error.details ?? {}) as {
    cycleDescription?: string;
    cycleApprovalIds?: string[];
  };
  assert(
    typeof details.cycleDescription === 'string' &&
      /MPCB-CTE-001/.test(details.cycleDescription) &&
      /MPCB-CTO-001/.test(details.cycleDescription),
    `cycle described with both offending approval codes, got: ${JSON.stringify(details.cycleDescription)}`,
  );
  assert(
    Array.isArray(details.cycleApprovalIds) && details.cycleApprovalIds.length >= 2,
    'cycleApprovalIds enumerates the cycle participants',
  );
  console.log('CYCLE-GUARD ok: cyclic roadmap refused with explicit roadmap_unavailable (never rendered)');

  // Cleanup — remove the injected edge and the project.
  await prisma.dependency.delete({ where: { id: injected.id } });
  await prisma.project.delete({ where: { id: projectId } });
  console.log('INTEGRATION PASS');
  await app.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});