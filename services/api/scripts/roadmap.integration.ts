/**
 * Integration test: Phase 4 approval roadmap (ApprovalInstance lifecycle).
 * Boots the Nest app in-process against the real DATABASE_URL.
 * Expects Phase-1 seed data: draft release with brewery approvals
 * (BRL-001 depends_on MPCB-CTE-001 and MPCB-CTO-001; MPCB-CTO-001
 * depends_on MPCB-CTE-001 — a real gating chain).
 *
 * Usage (from services/api):
 *   pnpm exec tsx scripts/roadmap.integration.ts
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

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

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const prisma = app.get(PrismaService);

  async function call(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = `Bearer ${token}`;
    const res = await fetch(`${url}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  const registerRes = await call('POST', '/auth/register', {
    email: `roadmap-it-${Date.now()}@example.com`,
    password: 'password123',
    role: 'applicant',
  });
  assert(registerRes.status === 201, `register -> 201, got ${registerRes.status}`);
  const loginRes = await call('POST', '/auth/login', {
    email: registerRes.json.email as string,
    password: 'password123',
  });
  assert(loginRes.status === 200, `login -> 200, got ${loginRes.status}`);
  const token = loginRes.json.accessToken as string;

  const project = await call(
    'POST',
    '/projects',
    {
      name: 'Roadmap IT project',
      industry: 'brewery',
      businessId: 'biz-it-roadmap',
    },
    token,
  );
  assert(project.status === 201, `POST /projects -> 201, got ${project.status}`);
  const projectId = project.json.id as string;

  const draft = await call('POST', `/projects/${projectId}/profiles`, {
    values: fullBreweryValues(),
  });
  assert(draft.status === 201, `draft -> 201, got ${draft.status}`);
  const draftId = draft.json.id as string;

  const confirmed = await call('POST', `/projects/${projectId}/profiles/${draftId}/confirm`);
  assert(confirmed.status === 200, `confirm -> 200, got ${confirmed.status}: ${JSON.stringify(confirmed.json)}`);

  // 1. Instances were created from the evaluation.
  const instances = confirmed.json.roadmapInstances as Array<{
    id: string;
    status: string;
    unlockedAt: string | null;
  }>;
  assert(Array.isArray(instances) && instances.length > 0, 'confirm produced roadmap instances');
  const evaluation = confirmed.json.evaluation as {
    approvals: Array<{ approval: { id: string }; outcome: string }>;
  };
  const expected = evaluation.approvals.filter((a) => a.outcome !== 'not_applicable');
  assert(
    instances.length === expected.length,
    `instance count matches non-not_applicable outcomes (${instances.length} vs ${expected.length})`,
  );
  console.log(`CONFIRM ok: ${instances.length} instances created`);

  // 2. Roadmap graph shape.
  const roadmap = await call('GET', `/projects/${projectId}/roadmap`);
  assert(roadmap.status === 200, `roadmap -> 200, got ${roadmap.status}`);
  const nodes = roadmap.json.nodes as Array<{
    id: string;
    approvalCode: string;
    approvalName: string;
    outcome: string;
    status: string;
    attentionRequired: boolean;
    sourceUrl: string | null;
    lastVerifiedDate: string | null;
  }>;
  assert(nodes.length === instances.length, 'one node per instance');
  for (const n of nodes) {
    assert(typeof n.approvalName === 'string', 'node has approval name');
    assert(
      n.attentionRequired === (n.outcome === 'not_evaluable'),
      'attentionRequired derived at read time from the pinned evaluation',
    );
  }
  const edges = roadmap.json.edges as Array<{ fromApprovalCode: string; toApprovalCode: string; type: string; gates: boolean }>;
  assert(edges.length > 0, 'roadmap has dependency edges');
  const gating = edges.filter((e) => e.type === 'depends_on');
  assert(gating.every((e) => e.gates), 'depends_on edges marked gates=true');
  const groups = roadmap.json.parallelGroups as string[][];
  assert(Array.isArray(groups) && groups.length > 0, 'parallelGroups present');
  console.log(`ROADMAP ok: ${nodes.length} nodes, ${edges.length} edges, ${groups.length} parallel groups`);

  const byCode = new Map(nodes.map((n) => [n.approvalCode, n]));

  // 3. Gating: BRL-001 depends_on MPCB-CTE-001 and MPCB-CTO-001, so BRL-001
  // starts blocked while its prerequisites are incomplete instances.
  const brl = byCode.get('BRL-001');
  if (brl) {
    assert(brl.status === 'blocked', `BRL-001 blocked initially, got ${brl.status}`);
  }
  const cte = byCode.get('MPCB-CTE-001');
  if (cte) {
    assert(cte.status === 'available', `MPCB-CTE-001 available initially, got ${cte.status}`);
    assert(typeof cte.unlockedAt === 'string', 'unlockedAt set on first availability');
  }

  // 4. Transition rejections.
  if (brl) {
    const blockedStart = await call('PATCH', `/projects/${projectId}/approval-instances/${brl.id}/status`, { status: 'in_progress' });
    assert(blockedStart.status === 400, `blocked -> in_progress REJECTED, got ${blockedStart.status}`);
    const blockedDone = await call('PATCH', `/projects/${projectId}/approval-instances/${brl.id}/status`, { status: 'done' });
    assert(blockedDone.status === 400, `blocked -> done REJECTED, got ${blockedDone.status}`);
    const blockedAvailable = await call('PATCH', `/projects/${projectId}/approval-instances/${brl.id}/status`, { status: 'available' });
    assert(blockedAvailable.status === 400, `blocked -> available NEVER client-requestable, got ${blockedAvailable.status}`);
  }
  if (cte) {
    const skipDone = await call('PATCH', `/projects/${projectId}/approval-instances/${cte.id}/status`, { status: 'done' });
    assert(skipDone.status === 400, `available -> done REJECTED, got ${skipDone.status}`);
    const backward = await call('PATCH', `/projects/${projectId}/approval-instances/${cte.id}/status`, { status: 'available' });
    assert(backward.status === 400, `weird transition rejected, got ${backward.status}`);
    const start = await call('PATCH', `/projects/${projectId}/approval-instances/${cte.id}/status`, { status: 'in_progress' });
    assert(start.status === 200, `available -> in_progress ACCEPTED, got ${start.status}`);
    const backward2 = await call('PATCH', `/projects/${projectId}/approval-instances/${cte.id}/status`, { status: 'available' });
    assert(backward2.status === 400, `in_progress -> available REJECTED, got ${backward2.status}`);
    const done = await call('PATCH', `/projects/${projectId}/approval-instances/${cte.id}/status`, { status: 'done' });
    assert(done.status === 200, `in_progress -> done ACCEPTED, got ${done.status}`);
    const again = await call('PATCH', `/projects/${projectId}/approval-instances/${cte.id}/status`, { status: 'in_progress' });
    assert(again.status === 400, `done is terminal, got ${again.status}`);
    console.log('TRANSITIONS ok: only available→in_progress and in_progress→done accepted');
  }

  // 5. Forward unlock cascade after CTE is done.
  if (cte) {
    const after = await call('GET', `/projects/${projectId}/roadmap`);
    const afterNodes = after.json.nodes as Array<{ approvalCode: string; status: string; unlockedAt: string | null }>;
    const afterByCode = new Map(afterNodes.map((n) => [n.approvalCode, n]));
    const cto = afterByCode.get('MPCB-CTO-001');
    if (cto) {
      assert(cto.status === 'available', `MPCB-CTO-001 unblocked server-side after CTE done, got ${cto.status}`);
      assert(typeof cto.unlockedAt === 'string', 'unlockedAt stamped on server-side unlock');
    }
    const brlAfter = afterByCode.get('BRL-001');
    if (brlAfter) {
      assert(brlAfter.status === 'blocked', `BRL-001 still blocked while CTO incomplete, got ${brlAfter.status}`);
    }
    console.log('CASCADE ok: completing a prerequisite unlocks dependents server-side');
  }

  // 6. Outcome flips across re-evaluations.
  // 6a. applicable → not_applicable: Maharashtra brewery → Karnataka brewery.
  // Every structured approval (state = Maharashtra) becomes not_applicable, so
  // its instance must be REMOVED (no stale roadmap slot), even if it was done.
  const snapshot1 = new Map(nodes.map((n) => [n.approvalCode, n]));
  const draft2 = await call('POST', `/projects/${projectId}/profiles`, {
    values: { ...fullBreweryValues(), state: known('Karnataka') },
  });
  assert(draft2.status === 201, `draft2 -> 201`);
  const confirmed2 = await call('POST', `/projects/${projectId}/profiles/${draft2.json.id as string}/confirm`);
  assert(confirmed2.status === 200, `confirm v2 -> 200, got ${confirmed2.status}`);
  const eval2 = confirmed2.json.evaluation as {
    approvals: Array<{ approval: { id: string }; outcome: string }>;
  };
  const instances2 = confirmed2.json.roadmapInstances as Array<{ id: string }>;
  const warranted2 = eval2.approvals.filter((a) => a.outcome !== 'not_applicable');
  assert(
    instances2.length === warranted2.length,
    `v2 instance count matches warranted set (${instances2.length} vs ${warranted2.length})`,
  );
  const roadmap2 = await call('GET', `/projects/${projectId}/roadmap`);
  const nodes2 = roadmap2.json.nodes as Array<{ approvalCode: string; status: string }>;
  const byCode2 = new Map(nodes2.map((n) => [n.approvalCode, n.status]));
  for (const a of eval2.approvals) {
    const hasNode = byCode2.has(a.approval.id);
    const warranted = a.outcome !== 'not_applicable';
    assert(
      hasNode === warranted,
      `v2 ${a.approval.id} (${a.outcome}) ${warranted ? 'must have' : 'must NOT have'} an instance`,
    );
  }
  assert(
    byCode2.get('MPCB-CTE-001') === undefined,
    'stale done instance removed after applicable -> not_applicable flip',
  );
  assert(
    instances2.length === 4 && instances2.length < nodes.length,
    'prose approvals (not_evaluable) still represented',
  );
  console.log('FLIP-A ok: applicable -> not_applicable removes stale instances, not_evaluable ones stay');

  // 6b. not_applicable → applicable: Karnataka → back to Maharashtra. The
  // structured approvals return and get FRESH instances (the roadmap slot was
  // deleted on the flip, so no phantom 'done' status carries over).
  const draft3 = await call('POST', `/projects/${projectId}/profiles`, {
    values: fullBreweryValues(),
  });
  assert(draft3.status === 201, `draft3 -> 201`);
  const confirmed3 = await call('POST', `/projects/${projectId}/profiles/${draft3.json.id as string}/confirm`);
  assert(confirmed3.status === 200, `confirm v3 -> 200, got ${confirmed3.status}`);
  const roadmap3 = await call('GET', `/projects/${projectId}/roadmap`);
  const nodes3 = roadmap3.json.nodes as Array<{ approvalCode: string; status: string; unlockedAt: string | null }>;
  const byCode3 = new Map(nodes3.map((n) => [n.approvalCode, n]));
  const cte3 = byCode3.get('MPCB-CTE-001');
  assert(!!cte3, 'not_applicable -> applicable re-creates the instance');
  assert(cte3!.status === 'available', `re-created CTE starts available, got ${cte3!.status}`);
  assert(typeof cte3!.unlockedAt === 'string', 're-created instance has unlockedAt');
  const brl3 = byCode3.get('BRL-001');
  assert(!!brl3 && brl3.status === 'blocked', `re-created BRL-001 blocked by fresh prereqs, got ${brl3?.status}`);
  const cteOldId = snapshot1.get('MPCB-CTE-001')!.id;
  assert(
    cte3!.id !== cteOldId,
    're-created instance is a NEW row (old slot was deleted, status not resurrected)',
  );
  console.log('FLIP-B ok: not_applicable -> applicable creates fresh instances with derived status');

  // 7. Status preservation ONLY while the approval remains represented.
  // Complete CTE in v3, re-confirm same values: done must survive the re-point.
  const startCte = await call('PATCH', `/projects/${projectId}/approval-instances/${cte3!.id}/status`, { status: 'in_progress' });
  assert(startCte.status === 200, `start CTE ok, got ${startCte.status}`);
  const doneCte = await call('PATCH', `/projects/${projectId}/approval-instances/${cte3!.id}/status`, { status: 'done' });
  assert(doneCte.status === 200, `finish CTE ok, got ${doneCte.status}`);
  const draft4 = await call('POST', `/projects/${projectId}/profiles`, {
    values: fullBreweryValues(),
  });
  assert(draft4.status === 201, `draft4 -> 201`);
  const confirmed4 = await call('POST', `/projects/${projectId}/profiles/${draft4.json.id as string}/confirm`);
  assert(confirmed4.status === 200, `confirm v4 -> 200, got ${confirmed4.status}`);
  const roadmap4 = await call('GET', `/projects/${projectId}/roadmap`);
  const nodes4 = roadmap4.json.nodes as Array<{ approvalCode: string; status: string }>;
  const byCode4 = new Map(nodes4.map((n) => [n.approvalCode, n.status]));
  assert(
    byCode4.get('MPCB-CTE-001') === 'done',
    're-evaluation preserves workflow status while the approval stays warranted',
  );
  console.log('PRESERVE ok: status preserved only while approval remains represented');

  await prisma.project.delete({ where: { id: projectId } });
  const roadmapUser = await prisma.user.findUnique({
    where: { email: registerRes.json.email as string },
    select: { id: true },
  });
  if (roadmapUser) await prisma.user.delete({ where: { id: roadmapUser.id } });
  console.log('INTEGRATION PASS');
  await app.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
