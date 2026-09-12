/**
 * Integration test: POST /evaluations with a known brewery profile, then
 * GET /evaluations/:id. Runs against a live API + Postgres (replayable read).
 *
 * Usage (from services/api):
 *   pnpm exec tsx scripts/evaluations.integration.ts [--base-url http://localhost:3001]
 *
 * The script boots the Nest app in-process against the real DATABASE_URL, so
 * no separate server process is needed. Exits non-zero on any assertion
 * failure. Expects Phase-1 seed data: draft release 2026.09.11-brewery-v1
 * with brewery approvals (BRL-001, MPCB-CTE-001, MPCB-CTO-001, ...).
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function known<T>(value: T): { status: 'known'; value: T } {
  return { status: 'known', value };
}

function breweryProfile(): Record<string, unknown> {
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

function unknown(): { status: 'unknown' } {
  return { status: 'unknown' };
}

type ApprovalResult = {
  approval: { id: string };
  outcome: string;
  neededInformation?: Array<{ field: string }>;
};

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main(): Promise<void> {
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    const address = url.replace('[::1]', '127.0.0.1');
    const prisma = app.get(PrismaService);
    const release = await prisma.knowledgeRelease.findFirst({
      where: { status: 'draft' },
      orderBy: { version: 'desc' },
    });
    assert(!!release, 'expected a draft KnowledgeRelease (run import:regulatory first)');
    console.log(`draft release: ${release!.version}`);

    async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
      const res = await fetch(`${address}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await res.json()) as unknown;
      return { status: res.status, json };
    }

    const post = await call('POST', '/evaluations', {
      profile: breweryProfile(),
      industryCode: 'brewery',
    });
    assert(post.status === 201, `POST /evaluations -> 201, got ${post.status}: ${JSON.stringify(post.json)}`);
    const created = post.json as Record<string, unknown>;
    assert(typeof created.id === 'string', 'response has run id');
    const approvals = created.approvals as ApprovalResult[];
    assert(Array.isArray(approvals) && approvals.length > 0, 'response contains approvals');
    const ids = new Set(approvals.map((a) => a.approval.id));
    for (const expected of ['BRL-001', 'MPCB-CTE-001', 'MPCB-CTO-001']) {
      assert(ids.has(expected), `response contains seed approval ${expected}`);
    }
    const brl = approvals.find((a) => a.approval.id === 'BRL-001');
    assert(brl?.outcome === 'applicable', `BRL-001 applicable for Maharashtra brewery, got ${brl?.outcome}`);
    console.log(`POST ok: ${approvals.length} approvals, run ${created.id as string}`);

    // Prose/unresolved applicability (free-text in approvals.csv) must surface
    // as not_evaluable — check manually — never as a fabricated not_applicable
    // (regression: the old industry == "__never__" sentinel).
    const outcomeById = new Map(approvals.map((a) => [a.approval.id, a.outcome]));
    for (const proseId of ['DISH-LICENCE-001', 'FSSAI-LICENCE-001', 'LM-PACKAGED-001']) {
      assert(
        outcomeById.get(proseId) === 'not_evaluable',
        `${proseId} (prose applicability) is not_evaluable, got ${outcomeById.get(proseId)}`,
      );
    }
    // EXCISE-LABEL-001's own source note: unresolved/unconfirmed — never a
    // mandatory required roadmap step. It must not be applicable, and neither
    // its documents nor its id may appear in the applicable roadmap output.
    const exciseOutcome = outcomeById.get('EXCISE-LABEL-001');
    assert(
      exciseOutcome !== 'applicable',
      `EXCISE-LABEL-001 must not be applicable, got ${exciseOutcome}`,
    );
    assert(
      !(created.orderedApprovalIds as string[] | undefined)?.includes('EXCISE-LABEL-001'),
      'EXCISE-LABEL-001 must not appear in the applicable ordered roadmap',
    );
    assert(
      !(created.requiredDocuments as Array<{ id: string }> | undefined)?.some(
        (d) => d.id === 'EXCISE-LABEL-001',
      ),
      'EXCISE-LABEL-001 must not contribute required documents to the roadmap',
    );
    console.log('PROSE ok: DISH/FSSAI/LM not_evaluable; EXCISE-LABEL-001 excluded from roadmap');

    const get = await call('GET', `/evaluations/${created.id as string}`);
    assert(get.status === 200, `GET /evaluations/:id -> 200, got ${get.status}`);
    const replayed = get.json as Record<string, unknown>;
    assert(replayed.id === created.id, 'replayed id matches (replayable)');
    const replayedApprovals = replayed.approvals as ApprovalResult[];
    const norm = (list: ApprovalResult[]): string =>
      JSON.stringify(
        [...list]
          .map((a) => ({ id: a.approval.id, outcome: a.outcome }))
          .sort((x, y) => (x.id < y.id ? -1 : 1)),
      );
    assert(
      norm(replayedApprovals) === norm(approvals),
      'GET returns the exact persisted engine snapshot',
    );
    console.log('GET ok: replayable snapshot matches POST response');

    const persisted = await prisma.evaluationRun.findUnique({
      where: { id: created.id as string },
      include: { results: true },
    });
    assert(!!persisted, 'EvaluationRun persisted');
    assert(persisted!.results.length === approvals.length, 'EvaluationResult rows persisted per approval');
    console.log(`DB ok: EvaluationRun + ${persisted!.results.length} EvaluationResult rows`);

    // Phase 2 exit criterion: the same real Maharashtra brewery profile with
    // one condition-required field (state) deliberately unknown must succeed
    // and report needs_information naming "state", without crashing siblings.
    const unknownState = { ...breweryProfile(), state: unknown() };
    const partial = await call('POST', '/evaluations', {
      profile: unknownState,
      industryCode: 'brewery',
    });
    assert(
      partial.status === 201,
      `POST /evaluations (unknown state) -> 201, got ${partial.status}: ${JSON.stringify(partial.json)}`,
    );
    const partialBody = partial.json as Record<string, unknown>;
    const partialApprovals = partialBody.approvals as ApprovalResult[];
    assert(Array.isArray(partialApprovals) && partialApprovals.length > 0, 'unknown-state response contains approvals');
    const brlPartial = partialApprovals.find((a) => a.approval.id === 'BRL-001');
    assert(!!brlPartial, 'unknown-state response contains BRL-001');
    assert(
      brlPartial!.outcome === 'needs_information',
      `BRL-001 with unknown state is needs_information, got ${brlPartial!.outcome}`,
    );
    const missingFields = (brlPartial!.neededInformation ?? []).map((n) => n.field);
    assert(
      missingFields.includes('state'),
      `BRL-001 names missing field "state", got ${JSON.stringify(missingFields)}`,
    );
    console.log('UNKNOWN-STATE ok: BRL-001 needs_information naming "state"');
    // Other approvals keep evaluating normally (no crash, no reinterpretation):
    // the full-set length is unchanged and every entry carries a valid outcome.
    const validOutcomes = new Set(['applicable', 'not_applicable', 'needs_information', 'not_evaluable']);
    assert(
      partialApprovals.length === approvals.length,
      'unknown-state run still evaluates all approvals',
    );
    for (const a of partialApprovals) {
      assert(validOutcomes.has(a.outcome), `approval ${a.approval.id} has a valid outcome`);
    }

    // Regression: the prose-applicability fix (not_evaluable for unrepresentable
    // conditions) must not change mismatch semantics of valid structured
    // conditions. BRL-001's real seeded condition is
    // {all:[{industry=brewery},{state=Maharashtra}]} — a fully-known Gujarat
    // brewery profile mismatches `state=Maharashtra` and must be a clean,
    // deterministic not_applicable, never not_evaluable.
    const gujaratProfile = { ...breweryProfile(), state: known('Gujarat') };
    const gujarat = await call('POST', '/evaluations', {
      profile: gujaratProfile,
      industryCode: 'brewery',
    });
    assert(
      gujarat.status === 201,
      `POST /evaluations (Gujarat brewery) -> 201, got ${gujarat.status}: ${JSON.stringify(gujarat.json)}`,
    );
    const gujaratApprovals = (gujarat.json as Record<string, unknown>).approvals as ApprovalResult[];
    const brlGujarat = gujaratApprovals.find((a) => a.approval.id === 'BRL-001');
    assert(!!brlGujarat, 'Gujarat response contains BRL-001');
    assert(
      brlGujarat!.outcome === 'not_applicable',
      `BRL-001 (structured mismatch, Gujarat) is not_applicable, got ${brlGujarat!.outcome}`,
    );
    assert(
      brlGujarat!.outcome !== 'not_evaluable',
      'BRL-001 structured mismatch must not be reclassified as not_evaluable',
    );
    // The prose approvals are unaffected by the profile: still not_evaluable.
    for (const proseId of ['DISH-LICENCE-001', 'FSSAI-LICENCE-001', 'LM-PACKAGED-001']) {
      const p = gujaratApprovals.find((a) => a.approval.id === proseId);
      assert(
        p?.outcome === 'not_evaluable',
        `${proseId} stays not_evaluable on the Gujarat profile, got ${p?.outcome}`,
      );
    }
    console.log('MISMATCH ok: BRL-001 Gujarat brewery is not_applicable (not not_evaluable)');

    console.log('INTEGRATION PASS');
  } finally {
    if (app) await app.close();
  }
  process.exitCode = 0;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
