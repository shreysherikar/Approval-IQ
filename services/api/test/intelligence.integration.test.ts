import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JobsService } from '../src/jobs/jobs.service';
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
async function drain(worker: WorkerService, prisma: PrismaService, jobId: string, rounds: number): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await prisma.job.updateMany({ where: { id: jobId, status: 'pending' }, data: { nextAttemptAt: new Date() } });
    await worker.tick();
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const address = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const prisma = app.get(PrismaService);
  const jobs = app.get(JobsService);
  const worker = app.get(WorkerService);
  const tag = `P6-${Date.now()}`;
  const email = `p6-${Date.now()}@example.com`;
  try {
    const reg = await call(address, 'POST', '/auth/register', undefined, { email, password: 'password123', role: 'applicant' });
    assert(reg.status === 201, `register ${reg.status}`);
    const login = await call(address, 'POST', '/auth/login', undefined, { email, password: 'password123' });
    assert(login.status === 200, `login ${login.status}`);
    const token = (login.json as Record<string, string>).accessToken;
    const proj = await call(address, 'POST', '/projects', token, { name: tag, industry: 'brewery', businessId: `biz-${tag}` });
    assert(proj.status === 201, `project ${proj.status}`);
    const projectId = (proj.json as Record<string, string>).id;
    const up = await uploadFile(address, `/projects/${projectId}/documents`, token, Buffer.from('APPROVALIQ_DEMO_TRADE_LICENCE'), 'licence.pdf');
    assert(up.status === 201, `upload ${up.status}`);
    const docId = up.json.id as string;
    const versionId = (up.json.currentVersion as Record<string, string>).id;
    const ex = await call(address, 'POST', `/projects/${projectId}/documents/${docId}/extract`, token, {});
    assert(ex.status === 202, `enqueue ${ex.status}`);
    const jobId = (ex.json as Record<string, string>).id;
    for (let i = 0; i < 5; i++) await worker.tick();
    const job = (await call(address, 'GET', `/projects/${projectId}/jobs/${jobId}`, token)).json as Record<string, string>;
    assert(job.status === 'completed', `job completed got ${JSON.stringify(job)}`);
    const view = (await call(address, 'GET', `/projects/${projectId}/documents/${docId}/versions/${versionId}/extraction`, token)).json as Record<string, unknown>;
    const fields = view.fields as Array<{ name: string; value: string; confidence: number }>;
    assert(fields.length >= 10, 'fields populated');
    assert(fields.find((f) => f.name === 'entityName')?.value === 'Pune Brewing Co.', 'fixture value');
    const expiry = fields.find((f) => f.name === 'expiryDate');
    assert(expiry?.value === 'unknown' && expiry?.confidence === 0, 'unknown stays unknown');
    assert(view.modelProvider === 'mock' && view.promptVersion === 'n/a', 'provider recorded');
    console.log('PASS extract+unknown');
    const vrow = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    assert(String(vrow?.state) === 'needs_verification', 'needs_verification');
    const before = await prisma.extractionResult.count({ where: { documentVersionId: versionId } });
    await jobs.enqueue('document_extraction', { projectId, documentId: docId, documentVersionId: versionId }, `extract:${versionId}`);
    for (let i = 0; i < 3; i++) await worker.tick();
    assert((await prisma.extractionResult.count({ where: { documentVersionId: versionId } })) === before, 'idempotent');
    console.log('PASS idempotent-retry');
    const corr = await call(address, 'PATCH', `/projects/${projectId}/documents/${docId}/versions/${versionId}/fields`, token, { fieldName: 'area', correctedValue: '5200' });
    assert(corr.status === 200, `correct ${corr.status}`);
    const cview = corr.json as Record<string, unknown>;
    assert((cview.corrections as Array<{ fieldName: string }>).some((c) => c.fieldName === 'area'), 'correction alongside');
    assert((cview.fields as Array<{ name: string; value: string }>).find((f) => f.name === 'area')?.value === '5000', 'raw kept');
    const ver = await call(address, 'POST', `/projects/${projectId}/documents/${docId}/versions/${versionId}/verify`, token, { notes: 'checked', evidenceInspected: true });
    assert(ver.status === 201, `verify ${ver.status}`);
    assert(String((await prisma.documentVersion.findUnique({ where: { id: versionId } }))?.state) === 'verified', 'verified');
    const vlist = await call(address, 'GET', `/projects/${projectId}/documents/${docId}/versions/${versionId}/verifications`, token);
    assert(vlist.status === 200 && Array.isArray(vlist.json) && (vlist.json as unknown[]).length === 1, 'record queryable');
    console.log('PASS correct+verify');
    const up2 = await uploadFile(address, `/projects/${projectId}/documents`, token, Buffer.from('APPROVALIQ_DEMO_TRADE_LICENCE'), 'lic2.pdf');
    const doc2 = up2.json.id as string;
    const ver2id = (up2.json.currentVersion as Record<string, string>).id;
    const ex2 = await call(address, 'POST', `/projects/${projectId}/documents/${doc2}/extract`, token, {});
    const job2 = (ex2.json as Record<string, string>).id;
    await prisma.job.update({ where: { id: job2 }, data: { status: 'processing' } });
    await prisma.$executeRaw`UPDATE jobs SET updated_at = NOW() - INTERVAL '10 minutes' WHERE id = ${job2}`;
    assert((await jobs.resetStuckProcessing(60_000)) >= 1, 'stuck re-queued');
    for (let i = 0; i < 5; i++) await worker.tick();
    const job2s = (await call(address, 'GET', `/projects/${projectId}/jobs/${job2}`, token)).json as Record<string, string>;
    assert(job2s.status === 'completed', 'resumed completed');
    assert(String((await prisma.documentVersion.findUnique({ where: { id: ver2id } }))?.state) === 'needs_verification', 'resumed intact');
    console.log('PASS restart-resume');
    const up3 = await uploadFile(address, `/projects/${projectId}/documents`, token, Buffer.from('totally __CORRUPT__ file'), 'bad.pdf');
    const doc3 = up3.json.id as string;
    const ver3id = (up3.json.currentVersion as Record<string, string>).id;
    const metaBefore = JSON.stringify(up3.json.metadata ?? null);
    const ex3 = await call(address, 'POST', `/projects/${projectId}/documents/${doc3}/extract`, token, {});
    const job3 = (ex3.json as Record<string, string>).id;
    await drain(worker, prisma, job3, 12);
    const job3s = (await call(address, 'GET', `/projects/${projectId}/jobs/${job3}`, token)).json as Record<string, string>;
    assert(job3s.status === 'dead_letter', `dead_letter got ${job3s.status}`);
    assert(String((await prisma.documentVersion.findUnique({ where: { id: ver3id } }))?.state) === 'rejected', 'rejected');
    assert(JSON.stringify((await prisma.document.findUnique({ where: { id: doc3 } }))?.metadata ?? null) === metaBefore, 'metadata intact');
    const man = await call(address, 'PATCH', `/projects/${projectId}/documents/${doc3}`, token, { metadata: { note: 'manual fallback' } });
    assert(man.status === 200, 'manual fallback');
    console.log('PASS corrupt-rejected');
    console.log('PHASE6 INTEGRATION: ALL PASSED');
  } catch (err) {
    console.error('PHASE6 INTEGRATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    const projs = await prisma.project.findMany({ where: { name: { contains: tag } }, select: { id: true } });
    const ids = projs.map((p) => p.id);
    if (ids.length > 0) {
      await prisma.verificationRecord.deleteMany({ where: { documentVersion: { document: { projectId: { in: ids } } } } }).catch(() => undefined);
      await prisma.fieldCorrection.deleteMany({ where: { documentVersion: { document: { projectId: { in: ids } } } } }).catch(() => undefined);
      await prisma.extractionResult.deleteMany({ where: { documentVersion: { document: { projectId: { in: ids } } } } }).catch(() => undefined);
      await prisma.documentVersion.deleteMany({ where: { document: { projectId: { in: ids } } } });
      await prisma.document.deleteMany({ where: { projectId: { in: ids } } });
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


