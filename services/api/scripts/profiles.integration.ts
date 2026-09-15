
/**
 * Integration test: profile versioning lifecycle (Phase 3).
 * Boots the Nest app in-process against the real DATABASE_URL.
 * Expects Phase-1 seed data: draft release with brewery approvals.
 *
 * Usage (from services/api):
 *   pnpm exec tsx scripts/profiles.integration.ts
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

/** Deterministic stringify — JSONB round-trips reorder object keys. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : 1,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  const address = url.replace('[::1]', '127.0.0.1');
  const prisma = app.get(PrismaService);

  async function call(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = `Bearer ${token}`;
    const res = await fetch(`${address}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  // Auth setup (blueprint §§18-19: authorization enforced server-side).
  const email = `profiles-it-${Date.now()}@example.com`;
  const registerRes = await call('POST', '/auth/register', {
    email,
    password: 'password123',
    role: 'applicant',
  });
  assert(registerRes.status === 201, `register -> 201, got ${registerRes.status}`);
  const loginRes = await call('POST', '/auth/login', { email, password: 'password123' });
  assert(loginRes.status === 200, `login -> 200, got ${loginRes.status}`);
  const token = loginRes.json.accessToken as string;
  assert(typeof token === 'string' && token.length > 0, 'access token returned');

  // 1. Create a project.
  const project = await call(
    'POST',
    '/projects',
    {
      name: 'Profiles IT project',
      industry: 'brewery',
      businessId: 'biz-it-1',
    },
    token,
  );
  assert(project.status === 201, `POST /projects -> 201, got ${project.status}`);
  const projectId = project.json.id as string;
  assert(typeof projectId === 'string', 'project id returned');
  console.log('PROJECT ok:', projectId);

  // Regression: anonymous profile creation is rejected.
  const anonDraft = await call('POST', `/projects/${projectId}/profiles`, {
    values: { industry: known('brewery') },
  });
  assert(anonDraft.status === 401, `anonymous POST profiles -> 401, got ${anonDraft.status}`);

  // 2. Partial draft (any subset accepted).
  const draft = await call(
    'POST',
    `/projects/${projectId}/profiles`,
    {
      values: { industry: known('brewery'), state: known('Maharashtra') },
    },
    token,
  );
  assert(
    draft.status === 201,
    `POST draft -> 201, got ${draft.status}: ${JSON.stringify(draft.json)}`,
  );
  const draftId = draft.json.id as string;
  assert(draft.json.versionNumber === 1, 'first version is number 1');
  assert(draft.json.status === 'draft', 'new version is draft');
  console.log('DRAFT ok: v1', draftId);

  // 3. Draft validation: bad types/units rejected.
  const bad = await call(
    'PATCH',
    `/projects/${projectId}/profiles/${draftId}`,
    {
      values: { areaSqft: known(-5) },
    },
    token,
  );
  assert(bad.status === 400, `invalid draft values -> 400, got ${bad.status}`);
  const badType = await call(
    'PATCH',
    `/projects/${projectId}/profiles/${draftId}`,
    {
      values: { areaSqft: known('huge') },
    },
    token,
  );
  assert(badType.status === 400, `wrong-typed draft values -> 400, got ${badType.status}`);
  console.log('VALIDATION ok: negative + wrong-typed values rejected with 400');

  // 4. Confirm an incomplete draft -> 400 with missing-field details.
  const incomplete = await call('POST', `/projects/${projectId}/profiles/${draftId}/confirm`, undefined, token);
  assert(incomplete.status === 400, `incomplete confirm -> 400, got ${incomplete.status}`);
  assert(
    JSON.stringify(incomplete.json).includes('district'),
    'incomplete confirm names a missing field',
  );
  console.log('INCOMPLETE ok: confirm blocked with 400');

  // 5. Complete the draft, then confirm -> evaluation auto-runs.
  const updated = await call(
    'PATCH',
    `/projects/${projectId}/profiles/${draftId}`,
    {
      values: fullBreweryValues(),
    },
    token,
  );
  assert(updated.status === 200, `PATCH draft -> 200, got ${updated.status}`);
  const confirmed = await call('POST', `/projects/${projectId}/profiles/${draftId}/confirm`, undefined, token);
  assert(
    confirmed.status === 200,
    `confirm -> 200, got ${confirmed.status}: ${JSON.stringify(confirmed.json)}`,
  );
  const profile = confirmed.json.profile as Record<string, unknown>;
  const evaluation = confirmed.json.evaluation as Record<string, unknown>;
  assert(profile.status === 'confirmed', 'profile is confirmed');
  assert(!!profile.confirmedAt, 'confirmedAt is set');
  assert(typeof evaluation.id === 'string', 'evaluation run id returned');
  const approvals = evaluation.approvals as Array<{
    approval: { id: string; name: string; sourceUrl?: string; lastVerifiedDate?: string };
    outcome: string;
  }>;
  assert(Array.isArray(approvals) && approvals.length > 0, 'evaluation has approvals');
  // Results-page provenance: source URL + last-verified date must ride on each
  // approval so the UI can render them (never silently absent).
  const withSource = approvals.filter((a) => typeof a.approval.sourceUrl === 'string');
  assert(
    withSource.length > 0,
    'at least one approval carries a sourceUrl for the results page',
  );
  const withVerified = approvals.filter((a) => typeof a.approval.lastVerifiedDate === 'string');
  assert(
    withVerified.length > 0,
    'at least one approval carries a lastVerifiedDate for the results page',
  );
  console.log(
    `CONFIRM ok: v1 confirmed, evaluation ${evaluation.id} with ${approvals.length} approvals`,
  );

  // 6. Confirmed versions are immutable: PATCH -> 409, re-confirm -> 409.
  const patchConfirmed = await call(
    'PATCH',
    `/projects/${projectId}/profiles/${draftId}`,
    {
      values: { areaSqft: known(1) },
    },
    token,
  );
  assert(patchConfirmed.status === 409, `PATCH confirmed -> 409, got ${patchConfirmed.status}`);
  const reconfirm = await call('POST', `/projects/${projectId}/profiles/${draftId}/confirm`, undefined, token);
  assert(reconfirm.status === 409, `re-confirm -> 409, got ${reconfirm.status}`);
  const afterPatch = await prisma.businessProfileVersion.findUnique({ where: { id: draftId } });
  assert(
    stableStringify(afterPatch!.values) === stableStringify(fullBreweryValues()),
    'confirmed values were NOT mutated by the rejected PATCH',
  );
  console.log('IMMUTABILITY ok: PATCH + re-confirm on confirmed version -> 409, values unchanged');

  // 7. New draft auto-increments versionNumber per project.
  const draft2 = await call('POST', `/projects/${projectId}/profiles`, { values: {} }, token);
  assert(draft2.status === 201, `second draft -> 201, got ${draft2.status}`);
  assert(draft2.json.versionNumber === 2, 'second version is number 2');
  console.log('VERSIONING ok: v2 created');

  // 8. Unknown project -> 404; cross-project non-member -> 403.
  const missing = await call('POST', '/projects/nope/profiles', { values: {} }, token);
  assert(missing.status === 403 || missing.status === 404, `unknown project -> 403/404, got ${missing.status}`);
  const outsiderEmail = `profiles-outsider-${Date.now()}@example.com`;
  const outsiderReg = await call('POST', '/auth/register', {
    email: outsiderEmail,
    password: 'password123',
    role: 'applicant',
  });
  assert(outsiderReg.status === 201, `outsider register -> 201, got ${outsiderReg.status}`);
  const outsiderLogin = await call('POST', '/auth/login', { email: outsiderEmail, password: 'password123' });
  const outsiderToken = outsiderLogin.json.accessToken as string;
  const forbidden = await call('POST', `/projects/${projectId}/profiles`, { values: {} }, outsiderToken);
  assert(forbidden.status === 403, `non-member POST profiles -> 403, got ${forbidden.status}`);
  console.log('AUTHZ ok: non-member rejected with 403');

  // Cleanup: projects + throwaway users.
  await prisma.project.delete({ where: { id: projectId } });
  for (const u of [email, outsiderEmail]) {
    const row = await prisma.user.findUnique({ where: { email: u }, select: { id: true } });
    if (row) await prisma.user.delete({ where: { id: row.id } });
  }

  console.log('INTEGRATION PASS');
  await app.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

