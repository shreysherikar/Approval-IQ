/**
 * Integration test: Phase 9 officer queue + clarification round-trip.
 *
 * Validates the FULL two-sided loop end to end against a real database:
 *   officer login → authority-scoped queue → open application → review packet →
 *   request clarification → applicant sees it → applicant responds (with an
 *   attached project document) → officer sees the response → follow-up →
 *   applicant responds again → officer resolves.
 *
 * Authorization is asserted, not assumed:
 *   - an APPLICANT token is rejected on /officer/* (`officer_role_required`);
 *   - an officer assigned to ANOTHER authority gets `officer_out_of_scope` (403)
 *     and an EMPTY queue — never someone else's application;
 *   - an UNASSIGNED officer sees nothing and cannot act;
 *   - a non-member of the project cannot read the applicant inbox.
 *
 * Usage (from services/api, with Postgres up + migrations applied):
 *   pnpm run test:integration:clarifications
 */
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

interface ApiResult {
  status: number;
  json: Record<string, unknown>;
}

async function call(
  address: string,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${address}${path}`, init);
  const text = await res.text();
  return {
    status: res.status,
    json: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

/** Pulls the pinned domain error code out of the standard error envelope. */
function errorCode(json: Record<string, unknown>): string | null {
  const error = json['error'];
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

async function uploadFile(
  address: string,
  path: string,
  token: string,
  fileContent: Buffer,
  filename: string,
  mimeType: string,
): Promise<ApiResult> {
  const boundary = `----ClarTest${randomUUID().replace(/-/g, '')}`;
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
    'utf8',
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const res = await fetch(`${address}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: Buffer.concat([prefix, fileContent, suffix]),
  });
  const text = await res.text();
  return { status: res.status, json: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

/** Registers a user and returns an access token. */
async function registerAndLogin(
  address: string,
  email: string,
  role: 'applicant' | 'officer' | 'admin',
): Promise<{ userId: string; token: string }> {
  const reg = await call(address, 'POST', '/auth/register', undefined, {
    email,
    password: 'password123',
    role,
  });
  assert(reg.status === 201, `register ${role}: expected 201, got ${reg.status}`);
  const userId = reg.json['id'] as string;
  const login = await call(address, 'POST', '/auth/login', undefined, {
    email,
    password: 'password123',
  });
  assert(login.status === 200, `login ${role}: expected 200, got ${login.status}`);
  return { userId, token: login.json['accessToken'] as string };
}

async function main(): Promise<void> {
  console.log('Starting Phase 9 officer + clarification integration tests...\n');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const address = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const prisma = app.get(PrismaService);

  const stamp = Date.now();
  const authorityId = randomUUID();
  const otherAuthorityId = randomUUID();
  const industryId = randomUUID();
  const sourceId = randomUUID();
  const docDefId = randomUUID();
  const approvalId = randomUUID();
  const otherApprovalId = randomUUID();

  const userIds: string[] = [];
  const projectIds: string[] = [];
  const runIds: string[] = [];
  let instanceId = '';
  let blockedInstanceId = '';
  let documentId = '';
  let applicantToken = '';
  let officerToken = '';
  let otherOfficerToken = '';
  let otherOfficerId = '';
  let unassignedOfficerToken = '';
  let officerId = '';
  let clarificationId = '';

  try {
    console.log('0. Registering applicant, two scoped officers, one unassigned officer, a stranger...');
    const applicant = await registerAndLogin(address, `clar-applicant-${stamp}@example.com`, 'applicant');
    applicantToken = applicant.token;
    userIds.push(applicant.userId);
    const officer = await registerAndLogin(address, `clar-officer-${stamp}@example.com`, 'officer');
    officerToken = officer.token;
    officerId = officer.userId;
    userIds.push(officer.userId);
    const otherOfficer = await registerAndLogin(address, `clar-officer-other-${stamp}@example.com`, 'officer');
    otherOfficerToken = otherOfficer.token;
    otherOfficerId = otherOfficer.userId;
    userIds.push(otherOfficer.userId);
    const unassigned = await registerAndLogin(address, `clar-officer-none-${stamp}@example.com`, 'officer');
    unassignedOfficerToken = unassigned.token;
    userIds.push(unassigned.userId);
    const stranger = await registerAndLogin(address, `clar-stranger-${stamp}@example.com`, 'applicant');
    userIds.push(stranger.userId);
    console.log('   ✓ 5 users registered\n');

    console.log('1. Seeding authorities, industry, source, document + approval definitions...');
    await prisma.authority.create({
      data: {
        id: authorityId,
        code: `CLAR-AUTH-${stamp}`,
        name: 'Clarification Test Authority',
        department: 'Factories',
      },
    });
    await prisma.authority.create({
      data: { id: otherAuthorityId, code: `CLAR-AUTH-OTHER-${stamp}`, name: 'Other Authority' },
    });
    await prisma.industry.create({
      data: { id: industryId, code: `clar-industry-${stamp}`, name: 'Clarification Test Industry' },
    });
    await prisma.source.create({
      data: {
        id: sourceId,
        url: `https://example.gov.in/clarification-${stamp}`,
        title: 'Clarification test notification',
        retrievedDate: new Date(),
        lastVerifiedDate: new Date(),
        verifiedBy: 'integration-test',
      },
    });
    await prisma.documentDefinition.create({
      data: {
        id: docDefId,
        code: `CLAR-DOC-${stamp}`,
        name: 'Clarification test document',
        documentType: 'certificate',
        validityRule: 'valid until expiry',
        reusability: 'reusable',
        reuseConditions: 'same project',
        verificationMethod: 'manual review',
      },
    });
    await prisma.approvalDefinition.create({
      data: {
        id: approvalId,
        code: `CLAR-APPROVAL-${stamp}`,
        name: 'Clarification Test Approval',
        industryId,
        authorityId,
        whyRequired: 'Test approval for the clarification workflow',
        inspectionRequired: false,
        renewalRequired: false,
        sourceId,
        lastVerifiedDate: new Date(),
      },
    });
    await prisma.approvalDocumentRequirement.create({
      data: { approvalDefinitionId: approvalId, documentDefinitionId: docDefId },
    });
    await prisma.approvalDefinition.create({
      data: {
        id: otherApprovalId,
        code: `CLAR-APPROVAL-OTHER-${stamp}`,
        name: 'Other Authority Approval',
        industryId,
        authorityId: otherAuthorityId,
        whyRequired: 'Belongs to a different authority',
        inspectionRequired: false,
        renewalRequired: false,
        sourceId,
        lastVerifiedDate: new Date(),
      },
    });

    // Officer scoping: officer -> authority A, otherOfficer -> authority B,
    // unassigned officer -> nothing at all.
    await prisma.officerAuthorityAssignment.create({
      data: { officerId, authorityId },
    });
    await prisma.officerAuthorityAssignment.create({
      data: { officerId: otherOfficerId, authorityId: otherAuthorityId },
    });
    console.log('   ✓ fixtures ready\n');

    console.log('2. Creating project (via API), evaluation run, and approval instances...');
    const project = await call(address, 'POST', '/projects', applicantToken, {
      name: 'Clarification test project',
      industry: `clar-industry-${stamp}`,
      businessId: `clar-biz-${stamp}`,
    });
    assert(project.status === 201, `create project: expected 201, got ${project.status}`);
    const projectId = project.json['id'] as string;
    projectIds.push(projectId);

    const run = await prisma.evaluationRun.create({
      data: {
        profileSnapshot: { industry: 'brewery' },
        engineVersion: '0.0.1',
        resultSnapshot: {},
      },
    });
    runIds.push(run.id);
    const result = await prisma.evaluationResult.create({
      data: {
        evaluationRunId: run.id,
        approvalDefinitionId: approvalId,
        outcome: 'needs_information',
        missingFields: [{ field: 'landAreaSqft', reason: 'unknown' }],
      },
    });
    const created = await prisma.approvalInstance.create({
      data: {
        projectId,
        approvalDefinitionId: approvalId,
        evaluationResultId: result.id,
        status: 'in_progress',
        unlockedAt: new Date(),
      },
    });
    instanceId = created.id;

    // A second, still-blocked instance for the "cannot clarify" guard.
    const blockedRun = await prisma.evaluationRun.create({
      data: { profileSnapshot: {}, engineVersion: '0.0.1', resultSnapshot: {} },
    });
    runIds.push(blockedRun.id);
    const blockedEval = await prisma.evaluationResult.create({
      data: {
        evaluationRunId: blockedRun.id,
        approvalDefinitionId: approvalId,
        outcome: 'applicable',
        missingFields: [],
      },
    });
    const blocked = await prisma.approvalInstance.create({
      data: {
        projectId,
        approvalDefinitionId: otherApprovalId,
        evaluationResultId: blockedEval.id,
        status: 'blocked',
      },
    });
    blockedInstanceId = blocked.id;
    console.log('   ✓ project + instances ready\n');
    console.log('3. Uploading one document to the project vault...');
    const upload = await uploadFile(
      address,
      `/projects/${projectId}/documents`,
      applicantToken,
      Buffer.from('clarification test evidence'),
      'evidence.pdf',
      'application/pdf',
    );
    assert(upload.status === 201, `upload: expected 201, got ${upload.status}`);
    documentId = upload.json['id'] as string;
    assert(typeof documentId === 'string' && documentId.length > 0, 'upload must return a document id');
    console.log('   ✓ document uploaded\n');

    console.log('4. Asserting applicant tokens are rejected on officer routes...');
    const applicantQueue = await call(address, 'GET', '/officer/queue', applicantToken);
    assert(applicantQueue.status === 403, `applicant /officer/queue: expected 403, got ${applicantQueue.status}`);
    assert(
      errorCode(applicantQueue.json) === 'officer_role_required',
      `applicant /officer/queue: expected officer_role_required, got ${errorCode(applicantQueue.json)}`,
    );
    const applicantDetail = await call(
      address,
      'GET',
      `/officer/applications/${instanceId}`,
      applicantToken,
    );
    assert(applicantDetail.status === 403, `applicant application read: expected 403, got ${applicantDetail.status}`);
    console.log('   ✓ applicants cannot reach the officer surface\n');
    console.log('5. Asserting authority-scoped queue visibility...');
    const authorities = await call(address, 'GET', '/officer/authorities', officerToken);
    assert(authorities.status === 200, `authorities: expected 200, got ${authorities.status}`);
    const authorityList = authorities.json['authorities'] as Record<string, unknown>[];
    assert(Array.isArray(authorityList), 'authorities must be a list');
    assert(
      authorityList.length === 1 && (authorityList[0] as Record<string, unknown>)['id'] === authorityId,
      `officer must see exactly their own authority, got ${JSON.stringify(authorityList)}`,
    );

    const queue = await call(address, 'GET', '/officer/queue', officerToken);
    assert(queue.status === 200, `queue: expected 200, got ${queue.status}`);
    const items = queue.json['items'];
    assert(
      Array.isArray(items) && items.length === 1,
      `queue must contain the one in_progress instance, got ${JSON.stringify(items)}`,
    );
    const queueItem = (items as Record<string, unknown>[])[0]!;
    assert(queueItem['instanceId'] === instanceId, 'queue item must be the created instance');
    const requiredDocs = queueItem['requiredDocuments'] as Record<string, unknown>;
    assert(requiredDocs['total'] === 1, `must report one required document, got ${JSON.stringify(requiredDocs)}`);
    const queueReqItems = requiredDocs['items'] as Record<string, unknown>[];
    assert(
      queueReqItems[0]!['status'] === 'provided_unverified',
      `uploaded-but-unverified doc must be provided_unverified, got ${queueReqItems[0]!['status']}`,
    );

    // The other authority's officer must not see this application anywhere.
    const otherQueue = await call(address, 'GET', '/officer/queue', otherOfficerToken);
    assert(otherQueue.status === 200, `other officer queue: expected 200, got ${otherQueue.status}`);
    assert(
      (otherQueue.json['items'] as unknown[]).length === 0,
      'an officer from another authority must see an empty queue',
    );
    const otherDetail = await call(
      address,
      'GET',
      `/officer/applications/${instanceId}`,
      otherOfficerToken,
    );
    assert(otherDetail.status === 403, `cross-authority read: expected 403, got ${otherDetail.status}`);
    assert(
      errorCode(otherDetail.json) === 'officer_out_of_scope',
      `cross-authority read: expected officer_out_of_scope, got ${errorCode(otherDetail.json)}`,
    );

    // An officer with no assignment sees nothing.
    const bareQueue = await call(address, 'GET', '/officer/queue', unassignedOfficerToken);
    assert(bareQueue.status === 200, `unassigned queue: expected 200, got ${bareQueue.status}`);
    assert(
      (bareQueue.json['items'] as unknown[]).length === 0,
      'an unassigned officer must see an empty queue',
    );
    console.log('   ✓ scoping enforced on queue + application read\n');

    console.log('6. Reading the full review packet...');
    const packet = await call(address, 'GET', `/officer/applications/${instanceId}`, officerToken);
    assert(packet.status === 200, `packet: expected 200, got ${packet.status}`);
    const packetApproval = packet.json['approval'] as Record<string, unknown>;
    assert(packetApproval['code'] === `CLAR-APPROVAL-${stamp}`, 'packet must carry the approval code');
    const packetEval = packet.json['evaluation'] as Record<string, unknown>;
    assert(packetEval['runId'] === runIds[0], 'packet must expose the pinned evaluation run');
    const reqSummary = packet.json['requiredDocuments'] as Record<string, unknown>;
    assert(reqSummary['missing'] === 0, 'required doc provided -> missing must be 0');
    assert((packet.json['documents'] as unknown[]).length === 1, 'packet must list the uploaded document');
    const clarSummary = packet.json['clarificationSummary'] as Record<string, unknown>;
    assert(clarSummary['total'] === 0, 'no clarifications yet');
    console.log('7. Asserting blocked applications cannot be clarified...');
    const blockedAsk = await call(
      address,
      'POST',
      `/officer/applications/${blockedInstanceId}/clarifications`,
      officerToken,
      { message: 'Please clarify.' },
    );
    assert(blockedAsk.status === 409, `blocked ask: expected 409, got ${blockedAsk.status}`);
    assert(
      errorCode(blockedAsk.json) === 'application_not_submitted',
      `blocked ask: expected application_not_submitted, got ${errorCode(blockedAsk.json)}`,
    );
    console.log('   ✓ blocked applications are protected\n');

    console.log('8. Running the clarification round-trip...');
    const ask = await call(
      address,
      'POST',
      `/officer/applications/${instanceId}/clarifications`,
      officerToken,
      { subject: 'Land area evidence', message: 'Please attach your land records.' },
    );
    assert(ask.status === 201, `ask: expected 201, got ${ask.status}`);
    assert(ask.json['status'] === 'requested', 'new clarification must be requested');
    assert(ask.json['awaitingParty'] === 'applicant', 'ball must be with the applicant');
    const askedFields = ask.json['requestedFields'];
    assert(
      Array.isArray(askedFields) && askedFields.length === 1 && (askedFields[0] as Record<string, unknown>)['field'] === 'landAreaSqft',
      `requestedFields must default to the pinned evaluation missingFields, got ${JSON.stringify(askedFields)}`,
    );
    assert(
      (ask.json['requestedBy'] as Record<string, unknown>)['id'] === officerId,
      'requestedBy must attribute the officer',
    );
    clarificationId = ask.json['id'] as string;

    const inbox = await call(address, 'GET', `/projects/${projectId}/clarifications`, applicantToken);
    assert(inbox.status === 200, `inbox: expected 200, got ${inbox.status}`);
    assert(inbox.json['openCount'] === 1, 'inbox must show one open clarification');
    assert(
      inbox.json['awaitingApplicantCount'] === 1,
      'inbox must show one item awaiting the applicant',
    );

    const reply = await call(
      address,
      'POST',
      `/projects/${projectId}/clarifications/${clarificationId}/responses`,
      applicantToken,
      { message: 'Land records attached.', documentIds: [documentId] },
    );
    assert(reply.status === 201, `reply: expected 201, got ${reply.status}`);
    assert(reply.json['status'] === 'responded', 'thread must move to responded');
    assert(reply.json['awaitingParty'] === 'officer', 'ball must be with the officer');
    assert(reply.json['respondedAt'] !== null, 'respondedAt must be recorded');
    const responses = reply.json['responses'] as Record<string, unknown>[];
    assert(Array.isArray(responses) && responses.length === 1, 'thread must contain one response');
    const linked = (responses[0] as Record<string, unknown>)['documents'];
    assert(
      Array.isArray(linked) && linked.length === 1 && (linked[0] as Record<string, unknown>)['documentId'] === documentId,
      `response must link the evidence document, got ${JSON.stringify(linked)}`,
    );

    // Attaching an unknown document is rejected with the offending ids listed.
    const badDocs = await call(
      address,
      'POST',
      `/projects/${projectId}/clarifications/${clarificationId}/responses`,
      applicantToken,
      { message: 'Another reply.', documentIds: [randomUUID()] },
    );
    assert(badDocs.status === 400, `unknown-doc reply: expected 400, got ${badDocs.status}`);
    assert(
      errorCode(badDocs.json) === 'invalid_clarification_documents',
      `unknown-doc reply: expected invalid_clarification_documents, got ${errorCode(badDocs.json)}`,
    );
    console.log('   ✓ ask -> respond with evidence works\n');
    console.log('9. Asserting officer follow-up, resolution and terminal states...');
    const officerView = await call(
      address,
      'GET',
      `/officer/clarifications/${clarificationId}`,
      officerToken,
    );
    assert(officerView.status === 200, `officer thread read: expected 200, got ${officerView.status}`);
    assert(officerView.json['status'] === 'responded', 'officer must see responded');

    const queueAfterReply = await call(address, 'GET', '/officer/queue', officerToken);
    const repliedItem = (queueAfterReply.json['items'] as Record<string, unknown>[])[0]!;
    assert(
      repliedItem['clarificationsAwaitingOfficer'] === 1,
      'queue must flag one clarification awaiting the officer',
    );

    const followUp = await call(
      address,
      'POST',
      `/officer/clarifications/${clarificationId}/follow-up`,
      officerToken,
      { message: 'One more thing: what is the survey number?' },
    );
    assert(followUp.status === 201, `follow-up: expected 201, got ${followUp.status}`);
    assert(followUp.json['status'] === 'requested', 'follow-up must return the thread to requested');
    const threadMessages = followUp.json['responses'] as Record<string, unknown>[];
    assert(threadMessages.length === 2, 'thread must hold applicant reply + officer follow-up');
    assert(
      threadMessages[1]!['authorRole'] === 'officer',
      'follow-up must be attributed to the officer',
    );

    const secondReply = await call(
      address,
      'POST',
      `/projects/${projectId}/clarifications/${clarificationId}/responses`,
      applicantToken,
      { message: 'Survey number 42.' },
    );
    assert(secondReply.status === 201, `second reply: expected 201, got ${secondReply.status}`);
    assert(secondReply.json['status'] === 'responded', 'thread must be responded again');

    const resolved = await call(
      address,
      'POST',
      `/officer/clarifications/${clarificationId}/resolve`,
      officerToken,
      { note: 'Evidence accepted.' },
    );
    assert(resolved.status === 200, `resolve: expected 200, got ${resolved.status}`);
    assert(resolved.json['status'] === 'resolved', 'thread must be resolved');
    assert(resolved.json['isTerminal'] === true, 'resolved must be terminal');
    assert(resolved.json['resolvedAt'] !== null, 'resolvedAt must be recorded');
    assert(
      (resolved.json['resolvedBy'] as Record<string, unknown>)['id'] === officerId,
      'resolvedBy must attribute the officer',
    );
    assert(resolved.json['resolutionNote'] === 'Evidence accepted.', 'resolution note must be kept');
    // Terminal threads reject every further action - from BOTH sides.
    const lateReply = await call(
      address,
      'POST',
      `/projects/${projectId}/clarifications/${clarificationId}/responses`,
      applicantToken,
      { message: 'Too late.' },
    );
    assert(lateReply.status === 409, `late reply: expected 409, got ${lateReply.status}`);
    assert(
      errorCode(lateReply.json) === 'invalid_clarification_transition',
      `late reply: expected invalid_clarification_transition, got ${errorCode(lateReply.json)}`,
    );
    const lateFollowUp = await call(
      address,
      'POST',
      `/officer/clarifications/${clarificationId}/follow-up`,
      officerToken,
      { message: 'Reopening?' },
    );
    assert(lateFollowUp.status === 409, `late follow-up: expected 409, got ${lateFollowUp.status}`);
    const lateCancel = await call(
      address,
      'POST',
      `/officer/clarifications/${clarificationId}/cancel`,
      officerToken,
      {},
    );
    assert(lateCancel.status === 409, `late cancel: expected 409, got ${lateCancel.status}`);
    console.log('   ✓ follow-up, resolution and terminal enforcement work\n');

    console.log('10. Asserting inbox isolation for non-members...');
    const strangerInbox = await call(
      address,
      'GET',
      `/projects/${projectId}/clarifications`,
      otherOfficerToken,
    );
    assert(strangerInbox.status === 403, `non-member inbox: expected 403, got ${strangerInbox.status}`);
    console.log('   ✓ inbox is project-scoped\n');

    console.log('✅ ALL TESTS PASSED\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await cleanup(prisma, app, userIds, projectIds, runIds, authorityId, otherAuthorityId, industryId, sourceId, docDefId, approvalId, otherApprovalId);
  }
}

async function cleanup(
  prisma: PrismaService,
  app: { close: () => Promise<void> },
  userIds: string[],
  projectIds: string[],
  runIds: string[],
  authorityId: string,
  otherAuthorityId: string,
  industryId: string,
  sourceId: string,
  docDefId: string,
  approvalId: string,
  otherApprovalId: string,
): Promise<void> {
  try {
    await prisma.clarificationRequest.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.approvalInstance.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.consistencyCheckResult.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.documentVersion.deleteMany({ where: { document: { projectId: { in: projectIds } } } });
    await prisma.document.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.businessProfileVersion.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.evaluationResult.deleteMany({ where: { approvalDefinitionId: { in: [approvalId, otherApprovalId] } } });
    await prisma.evaluationRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.approvalDocumentRequirement.deleteMany({ where: { approvalDefinitionId: { in: [approvalId, otherApprovalId] } } });
    await prisma.approvalDefinition.deleteMany({ where: { id: { in: [approvalId, otherApprovalId] } } });
    await prisma.documentDefinition.deleteMany({ where: { id: docDefId } });
    await prisma.source.deleteMany({ where: { id: sourceId } });
    await prisma.industry.deleteMany({ where: { id: industryId } });
    await prisma.officerAuthorityAssignment.deleteMany({ where: { authorityId: { in: [authorityId, otherAuthorityId] } } });
    await prisma.authority.deleteMany({ where: { id: { in: [authorityId, otherAuthorityId] } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } catch {
    /* best-effort cleanup */
  }
  await prisma.$disconnect();
  await app.close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
    console.log('   ✓ review packet is complete\n');