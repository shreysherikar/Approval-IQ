/**
 * Integration test: Document Vault (Phase 5).
 *
 * Key test: a user with a valid JWT CANNOT access another user's documents —
 * object-level authorization (ProjectMemberGuard) prevents this.
 *
 * Usage (from services/api):
 *   pnpm exec tsx test/documents.integration.test.ts
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

/**
 * Helper to make multipart/form-data uploads with file attachments.
 */
async function uploadFile(
  address: string,
  path: string,
  token: string,
  fileContent: Buffer,
  filename: string,
  mimeType: string,
  additionalFields?: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
  let body = '';

  // Add additional form fields
  if (additionalFields) {
    for (const [key, value] of Object.entries(additionalFields)) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }
  }

  // Add file
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
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

async function call(
  address: string,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null; buffer?: Buffer }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(`${address}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  } else {
    const buffer = Buffer.from(await res.arrayBuffer());
    return { status: res.status, json: null, buffer };
  }
}

async function main(): Promise<void> {
  console.log('Starting Document Vault integration tests...\n');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  const address = url.replace('[::1]', '127.0.0.1');
  const prisma = app.get(PrismaService);

  try {
    // Clean up any existing test data
    const testProjects = await prisma.project.findMany({
      where: { name: { contains: 'DocTest' } },
      select: { id: true },
    });
    const projectIds = testProjects.map((p) => p.id);

    if (projectIds.length > 0) {
      await prisma.documentVersion.deleteMany({ where: { document: { projectId: { in: projectIds } } } });
      await prisma.document.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { in: ['doctest-a@example.com', 'doctest-b@example.com'] } } });

    // 1. Register two users
    console.log('1. Registering users...');
    const userA = await call(address, 'POST', '/auth/register', undefined, {
      email: 'doctest-a@example.com',
      password: 'password123',
      role: 'applicant',
    });
    assert(userA.status === 201, `User A registration: expected 201, got ${userA.status}`);
    const userAId = userA.json!.id as string;
    const userALoginRes = await call(address, 'POST', '/auth/login', undefined, {
      email: 'doctest-a@example.com',
      password: 'password123',
    });
    assert(userALoginRes.status === 200, `User A login: expected 200, got ${userALoginRes.status}`);
    const userAToken = userALoginRes.json!.accessToken as string;
    console.log(`   User A: ${userAId}`);

    const userB = await call(address, 'POST', '/auth/register', undefined, {
      email: 'doctest-b@example.com',
      password: 'password123',
      role: 'applicant',
    });
    assert(userB.status === 201, `User B registration: expected 201, got ${userB.status}`);
    const userBId = userB.json!.id as string;
    const userBLoginRes = await call(address, 'POST', '/auth/login', undefined, {
      email: 'doctest-b@example.com',
      password: 'password123',
    });
    assert(userBLoginRes.status === 200, `User B login: expected 200, got ${userBLoginRes.status}`);
    const userBToken = userBLoginRes.json!.accessToken as string;
    console.log(`   User B: ${userBId}\n`);

    // 2. Create projects for each user
    console.log('2. Creating projects...');
    const projectA = await call(address, 'POST', '/projects', userAToken, {
      name: 'DocTest Project A',
      industry: 'brewery',
      businessId: 'BIZ-DOCTEST-A',
    });
    assert(projectA.status === 201, `Project A creation: expected 201, got ${projectA.status}`);
    const projectAId = projectA.json!.id as string;
    console.log(`   Project A: ${projectAId}`);

    const projectB = await call(address, 'POST', '/projects', userBToken, {
      name: 'DocTest Project B',
      industry: 'brewery',
      businessId: 'BIZ-DOCTEST-B',
    });
    assert(projectB.status === 201, `Project B creation: expected 201, got ${projectB.status}`);
    const projectBId = projectB.json!.id as string;
    console.log(`   Project B: ${projectBId}\n`);

    // 3. Upload a document to Project A
    console.log('3. Uploading document to Project A...');
    const fileContent = Buffer.from('This is a test PDF document content');
    const upload = await uploadFile(
      address,
      `/projects/${projectAId}/documents`,
      userAToken,
      fileContent,
      'test-document.pdf',
      'application/pdf',
    );
    assert(upload.status === 201, `Document upload: expected 201, got ${upload.status}`);
    assert(upload.json.id !== undefined, 'Document ID returned');
    const documentId = upload.json.id as string;
    const versionId = (upload.json.currentVersion as Record<string, unknown>).id as string;
    const storageKey = (upload.json.currentVersion as Record<string, unknown>).storageKey as string;
    console.log(`   Document: ${documentId}`);
    console.log(`   Version: ${versionId}`);
    console.log(`   Storage key: ${storageKey}\n`);

    // 4. Verify document structure
    console.log('4. Verifying document structure...');
    assert(upload.json.projectId === projectAId, 'Document belongs to correct project');
    assert((upload.json.currentVersion as Record<string, unknown>).versionNumber === 1, 'First version is number 1');
    assert((upload.json.currentVersion as Record<string, unknown>).originalFilename === 'test-document.pdf', 'Filename preserved');
    assert((upload.json.currentVersion as Record<string, unknown>).mimeType === 'application/pdf', 'MIME type preserved');
    assert((upload.json.currentVersion as Record<string, unknown>).state === 'uploaded', 'State is uploaded');
    assert((upload.json.currentVersion as Record<string, unknown>).uploadedByUserId === userAId, 'Uploader tracked');
    assert((upload.json.currentVersion as Record<string, unknown>).fileHash !== undefined, 'File hash computed');
    assert(storageKey.includes(projectAId), 'Storage key includes project ID (per-project isolation)');
    console.log('   ✓ All fields correct\n');

    // 5. CRITICAL TEST: User B cannot access User A's document (object-level auth)
    console.log('5. Testing object-level authorization (CRITICAL)...');
    const unauthorizedDownload = await call(
      address,
      'GET',
      `/projects/${projectAId}/documents/${documentId}/versions/${versionId}/download`,
      userBToken,
    );
    assert(
      unauthorizedDownload.status === 403,
      `User B accessing User A's document: expected 403, got ${unauthorizedDownload.status}`,
    );
    console.log('   ✓ User B FORBIDDEN from downloading User A\'s document (403)\n');

    // 6. Download through authorized endpoint
    console.log('6. Downloading document through authorized endpoint...');
    const download = await call(
      address,
      'GET',
      `/projects/${projectAId}/documents/${documentId}/versions/${versionId}/download`,
      userAToken,
    );
    assert(download.status === 200, `Authorized download: expected 200, got ${download.status}`);
    assert(download.buffer !== undefined, 'Download returns buffer');
    assert(download.buffer.toString() === fileContent.toString(), 'Downloaded content matches uploaded content');
    console.log('   ✓ User A successfully downloaded own document\n');

    // 7. Upload a replacement version
    console.log('7. Uploading replacement version...');
    const newFileContent = Buffer.from('This is an updated version of the document');
    const newVersion = await uploadFile(
      address,
      `/projects/${projectAId}/documents/${documentId}/versions`,
      userAToken,
      newFileContent,
      'updated-document.pdf',
      'application/pdf',
    );
    assert(newVersion.status === 201, `Version upload: expected 201, got ${newVersion.status}`);
    assert(newVersion.json.id === documentId, 'Document ID unchanged');
    assert((newVersion.json.currentVersion as Record<string, unknown>).versionNumber === 2, 'Version number incremented');
    console.log(`   ✓ Version 2 uploaded\n`);

    // 8. Verify old version is superseded
    console.log('8. Verifying version superseding...');
    const oldVersionRow = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      select: { state: true },
    });
    assert(oldVersionRow?.state === 'superseded', 'Old version marked as superseded');
    console.log('   ✓ Version 1 marked as superseded\n');

    // 9. Test file validation: unsupported MIME type
    console.log('9. Testing file validation...');
    const invalidUpload = await uploadFile(
      address,
      `/projects/${projectAId}/documents`,
      userAToken,
      Buffer.from('fake exe'),
      'malware.exe',
      'application/x-msdownload',
    );
    assert(invalidUpload.status === 400, `Unsupported MIME type: expected 400, got ${invalidUpload.status}`);
    console.log('   ✓ Unsupported MIME type rejected (400)\n');

    // 10. Test file hash for deduplication (Phase 7 prep)
    console.log('10. Testing file hash computation (Phase 7 prep)...');
    const content = Buffer.from('identical content');
    const doc1 = await uploadFile(
      address,
      `/projects/${projectAId}/documents`,
      userAToken,
      content,
      'file1.pdf',
      'application/pdf',
    );
    const doc2 = await uploadFile(
      address,
      `/projects/${projectAId}/documents`,
      userAToken,
      content,
      'file2.pdf',
      'application/pdf',
    );
    const hash1 = (doc1.json.currentVersion as Record<string, unknown>).fileHash as string;
    const hash2 = (doc2.json.currentVersion as Record<string, unknown>).fileHash as string;
    assert(hash1 === hash2, 'Identical content produces identical hash');
    assert(hash1.length === 64, 'Hash is sha256 (64 hex chars)');
    console.log(`   ✓ Identical content hash: ${hash1}\n`);

    // 11. List documents in project
    console.log('11. Listing documents...');
    const list = await call(address, 'GET', `/projects/${projectAId}/documents`, userAToken);
    assert(list.status === 200, `List documents: expected 200, got ${list.status}`);
    assert(Array.isArray(list.json), 'List returns array');
    assert(((list.json as unknown) as unknown[]).length >= 3, 'At least 3 documents in project');
    console.log(`   ✓ ${((list.json as unknown) as unknown[]).length} documents listed\n`);

    // 12. User B cannot list User A's documents
    console.log('12. Testing list authorization...');
    const unauthorizedList = await call(address, 'GET', `/projects/${projectAId}/documents`, userBToken);
    assert(unauthorizedList.status === 403, `User B listing User A's documents: expected 403, got ${unauthorizedList.status}`);
    console.log('   ✓ User B FORBIDDEN from listing User A\'s documents (403)\n');

    console.log('✅ ALL TESTS PASSED\n');
    console.log('Key findings:');
    console.log('  - Object-level authorization works: valid JWT ≠ access to all projects');
    console.log('  - Documents stored with per-project isolation');
    console.log('  - Version superseding works without deletion');
    console.log('  - File hash computed for Phase 7 deduplication');
    console.log('  - Downloads only through authorized endpoint (no static URL exposure)\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    // Clean up
    const testProjects = await prisma.project.findMany({
      where: { name: { contains: 'DocTest' } },
      select: { id: true },
    });
    const projectIds = testProjects.map((p) => p.id);

    if (projectIds.length > 0) {
      await prisma.documentVersion.deleteMany({ where: { document: { projectId: { in: projectIds } } } });
      await prisma.document.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { in: ['doctest-a@example.com', 'doctest-b@example.com'] } } });
    await prisma.$disconnect();
    await app.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
