/**
 * Integration test: Phase 7 Reuse + file-hash dedup.
 *
 * Validates end-to-end:
 *   1. GET /projects/:projectId/documents/reuse-candidates?approvalInstanceId=X
 *      returns same-project (Decision #7) candidate documents, each marked
 *      eligible or ineligible WITH its specific reason — including a
 *      fresh_required document that never appears eligible.
 *   2. File-hash dedup on upload surfaces the blueprint's four choices
 *      (link_to_existing / create_new_version / keep_separate / reject_duplicate)
 *      instead of silently duplicating, and records which one the user picked.
 *
 * Usage (from services/api):
 *   pnpm exec tsx test/reuse.integration.test.ts
 */
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function call(
  address: string,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${address}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function uploadFile(
  address: string,
  path: string,
  token: string,
  fileContent: Buffer,
  filename: string,
  mimeType: string,
  additionalFields?: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const boundary = `----ReuseTest${randomUUID().replace(/-/g, '')}`;
  let body = '';
  if (additionalFields) {
    for (const [key, value] of Object.entries(additionalFields)) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    }
  }
  body += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
  body += `Content-Type: ${mimeType}\r\n\r\n`;
  const bodyPrefix = Buffer.from(body, 'utf8');
  const bodySuffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const fullBody = Buffer.concat([bodyPrefix, fileContent, bodySuffix]);

  const res = await fetch(`${address}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: fullBody,
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function main(): Promise<void> {
  console.log('Starting Reuse (Phase 7) integration tests...\n');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  const address = url.replace('[::1]', '127.0.0.1');
  const prisma = app.get(PrismaService);

  const userEmail = `reuse-${Date.now()}@example.com`;
  let userId = '';
  const authorityId = randomUUID();
  const industryId = randomUUID();
  const sourceId = randomUUID();
  const defConditionalId = randomUUID();
  const defFreshId = randomUUID();
  const approvalId = randomUUID();
  const runId = randomUUID();
  const evalResultId = randomUUID();
  const instanceId = randomUUID();
  const docConditionalId = randomUUID();
  const docFreshId = randomUUID();
  let createdProjectId = '';
  let token = '';
  let userBId = '';
  let firstDocId = '';

  try {
    // 1. Register a user + create a project (the project member row is what the
    //    ProjectMemberGuard requires — object-level authorization).
    console.log('1. Registering user + creating project...');
    const reg = await call(address, 'POST', '/auth/register', undefined, {
      email: userEmail,
      password: 'password123',
      role: 'applicant',
    });
    assert(reg.status === 201, `register: expected 201, got ${reg.status}`);
    userId = reg.json!.id as string;
    const loginRes = await call(address, 'POST', '/auth/login', undefined, {
      email: userEmail,
      password: 'password123',
    });
    assert(loginRes.status === 200, `login: expected 200, got ${loginRes.status}`);
    token = loginRes.json!.accessToken as string;

    const project = await call(address, 'POST', '/projects', token, {
      name: 'ReuseTest Project',
      industry: 'brewery',
      businessId: `BIZ-REUSE-${Date.now()}`,
    });
    assert(project.status === 201, `project create: expected 201, got ${project.status}`);
    createdProjectId = project.json!.id as string;
    console.log(`   project ${createdProjectId}\n`);

    // Directly seed the regulatory + approval graph needed by the endpoint.
    console.log('2. Seeding approval/document graph...');
    await prisma.$transaction([
      prisma.authority.create({
        data: { id: authorityId, code: `AUTH-REUSE-${Date.now()}`, name: 'Reuse Test Authority', jurisdiction: 'Maharashtra' },
      }),
      prisma.industry.create({ data: { id: industryId, code: `IND-REUSE-${Date.now()}`, name: 'Brewery (reuse test)' } }),
      prisma.source.create({
        data: {
          id: sourceId,
          url: `https://example.test/source-${Date.now()}`,
          title: 'Reuse test source',
          retrievedDate: new Date(),
          lastVerifiedDate: new Date(),
          verifiedBy: userId,
        },
      }),
      prisma.documentDefinition.create({
        data: {
          id: defConditionalId,
          code: `DOC-REUSE-COND-${Date.now()}`,
          name: 'Trade Licence (reuse test)',
          documentType: 'trade_licence',
          validityRule: '1 year',
          reusability: 'conditional',
          reuseConditions: 'reuse valid only while document is not expired',
          verificationMethod: 'manual review',
        },
      }),
      prisma.documentDefinition.create({
        data: {
          id: defFreshId,
          code: `DOC-REUSE-FRESH-${Date.now()}`,
          name: 'Annual Renewal (fresh required)',
          documentType: 'annual_renewal',
          validityRule: 'per application',
          reusability: 'fresh_required',
          reuseConditions: '',
          verificationMethod: 'manual review',
        },
      }),
      prisma.approvalDefinition.create({
        data: {
          id: approvalId,
          code: `APP-REUSE-${Date.now()}`,
          name: 'Trade Licence Approval (reuse test)',
          industryId,
          authorityId,
          whyRequired: 'needed for lawful operation',
          inspectionRequired: false,
          renewalRequired: true,
          slaDays: 7,
          sourceId,
          lastVerifiedDate: new Date(),
        },
      }),
      prisma.approvalDocumentRequirement.create({
        data: { approvalDefinitionId: approvalId, documentDefinitionId: defConditionalId },
      }),
      prisma.approvalDocumentRequirement.create({
        data: { approvalDefinitionId: approvalId, documentDefinitionId: defFreshId },
      }),
      prisma.evaluationRun.create({
        data: { id: runId, profileSnapshot: {}, engineVersion: 'test', resultSnapshot: {} },
      }),
      prisma.evaluationResult.create({
        data: {
          id: evalResultId,
          evaluationRunId: runId,
          approvalDefinitionId: approvalId,
          outcome: 'applicable',
          missingFields: [],
        },
      }),
      prisma.approvalInstance.create({
        data: {
          id: instanceId,
          projectId: createdProjectId,
          approvalDefinitionId: approvalId,
          evaluationResultId: evalResultId,
          status: 'available',
        },
      }),
    ]);
        // Seed two candidate documents in the SAME project (Decision #7 scope).
    // docConditional is verified, correctly typed, in jurisdiction, and its
    // single reuse condition passes → eligible. docFresh is fresh_required →
    // ineligible no matter how good it looks.
    console.log('   ✓ graph seeded; adding candidates...');
    const versionConditionalId = randomUUID();
    const versionFreshId = randomUUID();
    const fileHashConditional = 'a'.repeat(64);
    const fileHashFresh = 'b'.repeat(64);
    await prisma.$transaction([
      prisma.document.create({
        data: { id: docConditionalId, projectId: createdProjectId, documentDefinitionId: defConditionalId },
      }),
      prisma.document.create({
        data: { id: docFreshId, projectId: createdProjectId, documentDefinitionId: defFreshId },
      }),
    ]);
    await prisma.$transaction([
      prisma.documentVersion.create({
        data: {
          id: versionConditionalId,
          documentId: docConditionalId,
          versionNumber: 1,
          storageKey: `reuse-test/${createdProjectId}/${versionConditionalId}`,
          originalFilename: 'trade-licence.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          fileHash: fileHashConditional,
          uploadedByUserId: userId,
          state: 'verified',
        },
      }),
      prisma.documentVersion.create({
        data: {
          id: versionFreshId,
          documentId: docFreshId,
          versionNumber: 1,
          storageKey: `reuse-test/${createdProjectId}/${versionFreshId}`,
          originalFilename: 'annual-renewal.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          fileHash: fileHashFresh,
          uploadedByUserId: userId,
          state: 'verified',
        },
      }),
      prisma.document.update({ where: { id: docConditionalId }, data: { currentVersionId: versionConditionalId } }),
      prisma.document.update({ where: { id: docFreshId }, data: { currentVersionId: versionFreshId } }),
      prisma.extractionResult.create({
        data: {
          documentVersionId: versionConditionalId,
          modelProvider: 'mock',
          modelVersion: '1',
          promptVersion: 'n/a',
          fields: [
            { name: 'documentType', value: 'trade_licence', confidence: 0.95 },
            { name: 'expiryDate', value: '2027-06-30', confidence: 0.9 },
            { name: 'jurisdiction', value: 'Maharashtra', confidence: 0.9 },
          ] as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.extractionResult.create({
        data: {
          documentVersionId: versionFreshId,
          modelProvider: 'mock',
          modelVersion: '1',
          promptVersion: 'n/a',
          fields: [
            { name: 'documentType', value: 'annual_renewal', confidence: 0.95 },
            { name: 'expiryDate', value: '2027-06-30', confidence: 0.9 },
            { name: 'jurisdiction', value: 'Maharashtra', confidence: 0.9 },
          ] as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    console.log('   ✓ candidates seeded\n');
        // 3. Reuse-candidates endpoint: conditional candidate is eligible with a reason.
    console.log('3. Reuse candidates: conditional doc eligible...');
    const reuseRes = await call(
      address,
      'GET',
      `/projects/${createdProjectId}/documents/reuse-candidates?approvalInstanceId=${instanceId}`,
      token,
    );
    assert(reuseRes.status === 200, `reuse-candidates: expected 200, got ${reuseRes.status}`);
    assert(reuseRes.json!.reuseScope === 'same_project', 'reuse scope is same_project (Decision #7)');
    const requiredDocs = reuseRes.json!.requiredDocuments as Array<{
      code: string;
      documentType: string;
      candidates: Array<{ documentDefinitionCode: string | null; eligible: boolean; status: string; reason: string; passedConditions?: string[] }>;
    }>;

    const condGroup = requiredDocs.find((d) => d.documentType === 'trade_licence');
    assert(!!condGroup, 'trade_licence requirement present');
    assert(condGroup!.candidates.length === 1, 'one candidate for trade_licence');
    const condCandidate = condGroup!.candidates[0];
    assert(condCandidate.eligible === true, 'conditional candidate should be ELIGIBLE');
    assert(condCandidate.status === 'eligible_for_conditional_reuse', 'status correctly set');
    assert(
      (condCandidate.passedConditions ?? []).some((p) => /valid until 2027-06-30/.test(p)),
      'passing condition (expiry) listed explicitly',
    );
    console.log(`   ✓ eligible: "${condCandidate.reason}" (${(condCandidate.passedConditions ?? []).length} passing condition(s))\n`);

    // 4. Reuse-candidates: fresh_required doc is ineligible no matter the state.
    console.log('4. Reuse candidates: fresh_required never eligible...');
    const freshGroup = requiredDocs.find((d) => d.documentType === 'annual_renewal');
    assert(!!freshGroup, 'annual_renewal requirement present');
    assert(freshGroup!.candidates.length === 1, 'one candidate for annual_renewal');
    const freshCandidate = freshGroup!.candidates[0];
    assert(freshCandidate.eligible === false, 'fresh_required candidate must be INELIGIBLE');
    assert(
      freshCandidate.reason === 'this document type must be obtained fresh for every use',
      `fresh_required reason mismatch: got "${freshCandidate.reason}"`,
    );
    console.log(`   ✓ ineligible: "${freshCandidate.reason}"\n`);

    // 5. Cross-user authorization: user B cannot read project A candidates.
    console.log('5. Cross-user authorization...');
    const userBEmail = `reuse-b-${Date.now()}@example.com`;
    const regB = await call(address, 'POST', '/auth/register', undefined, {
      email: userBEmail,
      password: 'password123',
      role: 'applicant',
    });
    userBId = regB.json!.id as string;
    const loginB = await call(address, 'POST', '/auth/login', undefined, {
      email: userBEmail,
      password: 'password123',
    });
    assert(loginB.status === 200, `user B login: expected 200, got ${loginB.status}`);
    const tokenB = loginB.json!.accessToken as string;
    const forbidden = await call(
      address,
      'GET',
      `/projects/${createdProjectId}/documents/reuse-candidates?approvalInstanceId=${instanceId}`,
      tokenB,
    );
    assert(forbidden.status === 403, `User B reading reuse candidates: expected 403, got ${forbidden.status}`);
    console.log('   ✓ user B forbidden (403)\n');
        // 6. File-hash dedup: identical content no longer silently duplicates.
    console.log('6. File-hash dedup surfaces the four choices...');
    const bytes = Buffer.from(`dedup-content-${Date.now()}`);
    const first = await uploadFile(address, `/projects/${createdProjectId}/documents`, token, bytes, 'dup-a.pdf', 'application/pdf');
    assert(first.status === 201, `first upload: expected 201, got ${first.status}`);
    firstDocId = first.json.id as string;
    const sameContent = Buffer.from(bytes);

    const second = await uploadFile(address, `/projects/${createdProjectId}/documents`, token, sameContent, 'dup-b.pdf', 'application/pdf');
    assert(second.status === 201, `duplicate prompt: expected 201 (controller sets CREATED), got ${second.status}`);
    assert(second.json.duplicateDetected === true, 'duplicateDetected flag set');
    const choices = second.json.dedupChoices as string[];
    assert(
      choices.length === 4 &&
        ['link_to_existing', 'create_new_version', 'keep_separate', 'reject_duplicate'].every((c) => choices.includes(c)),
      `four choices surfaced, got ${JSON.stringify(choices)}`,
    );
    assert((second.json.existingDocument as { id: string }).id === firstDocId, 'prompt names the existing document');
    console.log(`   ✓ prompt surfaced (not a silent duplicate); choices = ${choices.join(', ')}`);

    // keep_separate → creates a distinct document and records the pick.
    const kept = await uploadFile(address, `/projects/${createdProjectId}/documents`, token, sameContent, 'dup-c.pdf', 'application/pdf', {
      dedupChoice: 'keep_separate',
    });
    assert(kept.status === 201, `keep_separate: expected 201, got ${kept.status}`);
    const keptMeta = kept.json.metadata as { dedup?: { action?: string } };
    assert(keptMeta?.dedup?.action === 'keep_separate', `keep_separate recorded, got ${JSON.stringify(keptMeta)}`);
    const keptId = kept.json.id as string;
    assert(keptId !== firstDocId, 'keep_separate produces a different document');

    // link_to_existing → returns the first document, records the pick.
    const linked = await uploadFile(address, `/projects/${createdProjectId}/documents`, token, sameContent, 'dup-d.pdf', 'application/pdf', {
      dedupChoice: 'link_to_existing',
    });
    assert(linked.status === 201, `link_to_existing: expected 201, got ${linked.status}`);
    assert(linked.json.id === firstDocId, 'link_to_existing returns the existing document');
    const linkedMeta = linked.json.metadata as { dedup?: { action?: string } };
    assert(linkedMeta?.dedup?.action === 'link_to_existing', `link_to_existing recorded, got ${JSON.stringify(linkedMeta)}`);

    // reject_duplicate → 409.
    const rejected = await uploadFile(address, `/projects/${createdProjectId}/documents`, token, sameContent, 'dup-e.pdf', 'application/pdf', {
      dedupChoice: 'reject_duplicate',
    });
    assert(rejected.status === 409, `reject_duplicate: expected 409, got ${rejected.status}`);

    // invalid choice → 400, and record is never created.
    const invalidChoice = await uploadFile(address, `/projects/${createdProjectId}/documents`, token, sameContent, 'dup-f.pdf', 'application/pdf', {
      dedupChoice: 'merge_anyway',
    });
    assert(invalidChoice.status === 400, `invalid dedupChoice: expected 400, got ${invalidChoice.status}`);
    console.log('   ✓ keep_separate / link_to_existing / reject_duplicate / invalid all behave correctly\n');

    // 7. create_new_version — supersedes and records the pick.
    console.log('7. create_new_version choice...');
    const newVer = await uploadFile(address, `/projects/${createdProjectId}/documents`, token, sameContent, 'dup-g.pdf', 'application/pdf', {
      dedupChoice: 'create_new_version',
    });
    assert(newVer.status === 201, `create_new_version: expected 201, got ${newVer.status}`);
    const nvMeta = newVer.json.metadata as { dedup?: { action?: string } };
    assert(nvMeta?.dedup?.action === 'create_new_version', `create_new_version recorded, got ${JSON.stringify(nvMeta)}`);
    console.log('   ✓ create_new_version recorded\n');

    console.log('✅ ALL TESTS PASSED\n');
      } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    // Clean up in FK-safe order.
    const projIds = createdProjectId ? [createdProjectId] : [];
    try {
      if (projIds.length) {
        await prisma.approvalInstance.deleteMany({ where: { projectId: { in: projIds } } });
        await prisma.documentVersion.deleteMany({ where: { document: { projectId: { in: projIds } } } });
        await prisma.document.deleteMany({ where: { projectId: { in: projIds } } });
        await prisma.projectMember.deleteMany({ where: { projectId: { in: projIds } } });
        await prisma.project.deleteMany({ where: { id: { in: projIds } } });
      }
    } catch {
      /* best-effort cleanup */
    }
    await prisma.evaluationResult.delete({ where: { id: evalResultId } }).catch(() => undefined);
    await prisma.approvalDocumentRequirement.deleteMany({ where: { approvalDefinitionId: approvalId } }).catch(() => undefined);
    await prisma.approvalDefinition.delete({ where: { id: approvalId } }).catch(() => undefined);
    await prisma.documentDefinition.deleteMany({ where: { id: { in: [defConditionalId, defFreshId] } } }).catch(() => undefined);
    await prisma.evaluationRun.deleteMany({ where: { id: { in: [runId] } } }).catch(() => undefined);
    await prisma.source.delete({ where: { id: sourceId } }).catch(() => undefined);
    await prisma.industry.delete({ where: { id: industryId } }).catch(() => undefined);
    await prisma.authority.delete({ where: { id: authorityId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { OR: [{ email: userEmail }, { id: userBId }] } }).catch(() => undefined);
    await prisma.$disconnect();
    await app.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
