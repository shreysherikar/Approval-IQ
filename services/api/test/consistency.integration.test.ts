import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkerService } from '../src/jobs/worker.service';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function uploadFile(address: string, path: string, token: string, content: Buffer, filename: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const boundary = `----B${Math.random().toString(36).slice(2)}`;
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`, 'utf8');
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const res = await fetch(`${address}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat([head, content, tail]),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function call(address: string, method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${address}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? (JSON.parse(text) as unknown) : null; } catch { json = text; }
  return { status: res.status, json };
}

interface CheckRow {
  checkId: string;
  outcome: string;
  sideAValue: string | null;
  sideBValue: string | null;
}

function outcomeOf(results: CheckRow[], checkId: string): string {
  const row = results.find((r) => r.checkId === checkId);
  if (!row) throw new Error(`missing check '${checkId}'`);
  return row.outcome;
}

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const address = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const prisma = app.get(PrismaService);
  const worker = app.get(WorkerService);
  const tag = `P7-${Date.now()}`;
  const email = `p7-${Date.now()}@example.com`;
  try {
    const reg = await call(address, 'POST', '/auth/register', undefined, { email, password: 'password123', role: 'applicant' });
    assert(reg.status === 201, `register ${reg.status}`);
    const login = await call(address, 'POST', '/auth/login', undefined, { email, password: 'password123' });
    const token = (login.json as Record<string, string>).accessToken;
    const proj = await call(address, 'POST', '/projects', token, { name: tag, industry: 'brewery', businessId: `biz-${tag}` });
    assert(proj.status === 201, `project ${proj.status}`);
    const projectId = (proj.json as Record<string, string>).id;

    // Full profile: area 6000 sqft leased in Pune, Maharashtra, brewery activity.
    const fullProfile = {
      industry: { status: 'known', value: 'brewery' },
      state: { status: 'known', value: 'Maharashtra' },
      district: { status: 'known', value: 'Pune' },
      landStatus: { status: 'known', value: 'leased' },
      areaSqft: { status: 'known', value: 6000 },
      areaType: { status: 'known', value: 'leased' },
      investmentAmountInr: { status: 'known', value: 400000000 },
      investmentDefinition: { status: 'known', value: 'total_project_cost' },
      employeeCount: { status: 'known', value: 25 },
      employeeCountDefinition: { status: 'known', value: 'full_operational_capacity' },
      activityType: { status: 'known', value: 'brewery' },
    };
    const draft = await call(address, 'POST', `/projects/${projectId}/profiles`, token, { values: fullProfile });
    assert(draft.status === 201, `profile draft ${draft.status}`);
    const profileVersionId = (draft.json as Record<string, string>).id;
    const confirm = await call(address, 'POST', `/projects/${projectId}/profiles/${profileVersionId}/confirm`, token);
    assert(confirm.status === 200, `profile confirm ${confirm.status} ${JSON.stringify(confirm.json)}`);

    // Demo document (fixture area = 5000 sqft) → extract → verify.
    const up = await uploadFile(address, `/projects/${projectId}/documents`, token, Buffer.from('APPROVALIQ_DEMO_TRADE_LICENCE'), 'licence.pdf');
    assert(up.status === 201, `upload ${up.status}`);
    const docId = up.json.id as string;
    const versionId = (up.json.currentVersion as Record<string, string>).id;
    const ex = await call(address, 'POST', `/projects/${projectId}/documents/${docId}/extract`, token, {});
    void ex;
    for (let i = 0; i < 5; i++) await worker.tick();
    const ver = await call(address, 'POST', `/projects/${projectId}/documents/${docId}/versions/${versionId}/verify`, token, { notes: 'checked', evidenceInspected: true });
    assert(ver.status === 201, `verify ${ver.status}`);

    // 1) Profile-vs-document: deliberate area mismatch (6000 vs 5000, tol 1%).
    const run = await call(address, 'POST', `/projects/${projectId}/documents/${docId}/consistency-check`, token, {});
    assert(run.status === 201, `consistency-check ${run.status} ${JSON.stringify(run.json)}`);
    const runJson = run.json as Record<string, unknown>;
    const results = runJson.results as CheckRow[];
    assert(outcomeOf(results, 'area') === 'mismatch', `area mismatch got ${outcomeOf(results, 'area')}`);
    assert((runJson.summary as Record<string, number>).mismatch >= 1, 'summary mismatch');
    assert(outcomeOf(results, 'jurisdiction') === 'match', `jurisdiction got ${outcomeOf(results, 'jurisdiction')}`);
    assert(outcomeOf(results, 'premises') === 'match', `premises got ${outcomeOf(results, 'premises')}`);
    assert(outcomeOf(results, 'activity') === 'match', `activity got ${outcomeOf(results, 'activity')}`);
    console.log('PASS profile-vs-document mismatch+match');

    // 2) Results persisted and queryable.
    const listed = await call(address, 'GET', `/projects/${projectId}/documents/${docId}/versions/${versionId}/consistency-checks`, token);
    assert(listed.status === 200 && Array.isArray(listed.json) && (listed.json as unknown[]).length >= 4, 'persisted rows queryable');
    console.log('PASS persisted');

    // 3) THE GUARANTEE: a mismatch result must not gate anything. The document
    // stays fully usable: state unchanged, still downloadable, still editable,
    // and still attachable to an approval instance (application packet).
    assert(String((await prisma.documentVersion.findUnique({ where: { id: versionId } }))?.state) === 'verified', 'state still verified');
    const dl = await fetch(`${address}/projects/${projectId}/documents/${docId}/versions/${versionId}/download`, { headers: { Authorization: `Bearer ${token}` } });
    assert(dl.status === 200, `download after mismatch ${dl.status}`);
    const patch = await call(address, 'PATCH', `/projects/${projectId}/documents/${docId}`, token, { metadata: { note: 'mismatch reviewed' } });
    assert(patch.status === 200, `patch after mismatch ${patch.status}`);
    const anyInstance = await prisma.approvalInstance.findFirst({ where: { projectId }, select: { id: true } });
    if (anyInstance) {
      const attached = await prisma.approvalInstanceDocument.create({
        data: { approvalInstanceId: anyInstance.id, documentId: docId },
      });
      assert(Boolean(attached.id), 'attachable after mismatch');
      await prisma.approvalInstanceDocument.delete({ where: { id: attached.id } });
    } else {
      console.log('NOTE no approval instances in project — attach check via replacement version instead');
      const repl = await uploadFile(address, `/projects/${projectId}/documents/${docId}/versions`, token, Buffer.from('APPROVALIQ_DEMO_TRADE_LICENCE'), 'licence-v2.pdf');
      assert(repl.status === 201, `replacement after mismatch ${repl.status}`);
    }
    console.log('PASS mismatch-does-not-gate');

    // 4) unknown stays unknown: an unfixed file extracts all-unknown fields.
    const up2 = await uploadFile(address, `/projects/${projectId}/documents`, token, Buffer.from('NO_FIXTURE_CONTENT'), 'nofix.pdf');
    const doc2 = up2.json.id as string;
    const ver2 = (up2.json.currentVersion as Record<string, string>).id;
    const ex2 = await call(address, 'POST', `/projects/${projectId}/documents/${doc2}/extract`, token, {});
    void ex2;
    for (let i = 0; i < 5; i++) await worker.tick();
    const run2 = (await call(address, 'POST', `/projects/${projectId}/documents/${doc2}/consistency-check`, token, {})).json as Record<string, unknown>;
    const results2 = run2.results as CheckRow[];
    assert(outcomeOf(results2, 'area') === 'unknown', `unknown area got ${outcomeOf(results2, 'area')}`);
    assert(outcomeOf(results2, 'jurisdiction') === 'unknown', `unknown jurisdiction got ${outcomeOf(results2, 'jurisdiction')}`);
    assert((run2.summary as Record<string, number>).mismatch === undefined, 'unknown never reported as mismatch');
    console.log('PASS unknown-stays-unknown');

    // 5) No extraction at all → not_verified, and the check writes nothing to state.
    const up3 = await uploadFile(address, `/projects/${projectId}/documents`, token, Buffer.from('NEVER_EXTRACTED'), 'raw.pdf');
    const doc3 = up3.json.id as string;
    const ver3 = (up3.json.currentVersion as Record<string, string>).id;
    const run3 = (await call(address, 'POST', `/projects/${projectId}/documents/${doc3}/consistency-check`, token, {})).json as Record<string, unknown>;
    const results3 = run3.results as CheckRow[];
    assert(results3.every((r) => r.outcome === 'not_verified'), `not_verified got ${JSON.stringify(results3.map((r) => r.outcome))}`);
    assert(String((await prisma.documentVersion.findUnique({ where: { id: ver3 } }))?.state) === 'uploaded', 'state untouched by checks');
    console.log('PASS not_verified');

    // 6) Document-vs-document reuses the same comparator with different pairs.
    const run4 = (await call(address, 'POST', `/projects/${projectId}/documents/${docId}/consistency-check`, token, { checkType: 'document_vs_document', otherDocumentId: doc2 })).json as Record<string, unknown>;
    assert(run4.checkType === 'document_vs_document', 'doc-vs-doc checkType');
    const results4 = run4.results as CheckRow[];
    assert(results4.some((r) => r.checkId === 'validity_expiry'), 'doc-vs-doc pairs used');
    assert((await prisma.consistencyCheckResult.count({ where: { otherDocumentVersionId: ver2, checkType: 'document_vs_document' } })) > 0, 'doc-vs-doc rows persisted');
    console.log('PASS document-vs-document');

    console.log('PHASE7 CONSISTENCY INTEGRATION: ALL PASSED');
  } catch (err) {
    console.error('PHASE7 CONSISTENCY INTEGRATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    const projs = await prisma.project.findMany({ where: { name: { contains: tag } }, select: { id: true } });
    const ids = projs.map((p) => p.id);
    if (ids.length > 0) {
      await prisma.consistencyCheckResult.deleteMany({ where: { projectId: { in: ids } } }).catch(() => undefined);
      await prisma.approvalInstanceDocument.deleteMany({ where: { document: { projectId: { in: ids } } } }).catch(() => undefined);
      await prisma.verificationRecord.deleteMany({ where: { documentVersion: { document: { projectId: { in: ids } } } } }).catch(() => undefined);
      await prisma.fieldCorrection.deleteMany({ where: { documentVersion: { document: { projectId: { in: ids } } } } }).catch(() => undefined);
      await prisma.extractionResult.deleteMany({ where: { documentVersion: { document: { projectId: { in: ids } } } } }).catch(() => undefined);
      await prisma.documentVersion.deleteMany({ where: { document: { projectId: { in: ids } } } });
      await prisma.document.deleteMany({ where: { projectId: { in: ids } } });
      await prisma.businessProfileVersion.deleteMany({ where: { projectId: { in: ids } } }).catch(() => undefined);
      await prisma.evaluationResult.deleteMany({ where: { evaluationRun: { project: { id: { in: ids } } } } }).catch(() => undefined);
      await prisma.evaluationRun.deleteMany({ where: { project: { id: { in: ids } } } }).catch(() => undefined);
      await prisma.approvalInstance.deleteMany({ where: { projectId: { in: ids } } }).catch(() => undefined);
      await prisma.projectMember.deleteMany({ where: { projectId: { in: ids } } });
      await prisma.project.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.job.deleteMany({}).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
    await app.close();
  }
}

void main();
