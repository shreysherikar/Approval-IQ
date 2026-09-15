/**
 * ApprovalIQ Demo Seed & Reset Script
 *
 * Provides a deterministic, repeatable demonstration environment for ApprovalIQ:
 *   1. Ensures regulatory knowledge release is loaded (draft release with 10 approvals).
 *   2. Seeds demo users: applicant@approvaliq.dev, officer@approvaliq.dev, admin@approvaliq.dev.
 *   3. Scopes demo officer across MPCB, Excise, Fire, and DISH authorities.
 *   4. Seeds 'Pune Craft Brewery' project with a confirmed 6,000 sq ft profile.
 *   5. Evaluates profile via @approvaliq/approval-engine and generates roadmap instances.
 *   6. Uploads documents, runs mock extraction, records human verification, and creates
 *      consistency check results featuring the DELIBERATE AREA MISMATCH (6,000 sq ft
 *      declared in profile vs 5,000 sq ft extracted from municipal trade licence).
 *   7. Seeds a live officer clarification request + applicant response thread.
 *   8. Seeds a scheduled Joint Inspection across MPCB, DISH, and Fire Department.
 *
 * Usage:
 *   pnpm --filter api seed:demo          (idempotent seed / update)
 *   pnpm --filter api seed:demo:reset    (clean wipe of demo data + fresh seed)
 *   pnpm --filter api seed:demo -- --wipe-only
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.util.js';
import { toEngineCondition, type EngineCondition, type EngineRelationship } from '../src/evaluations/evaluations.service.js';

const DEMO_PROJECT_NAME = 'Pune Craft Brewery';
const DEMO_BUSINESS_ID = 'biz-demo-pune-brewery';
const DEMO_PASSWORD = 'Password123!';

const DEMO_USERS = {
  applicant: {
    email: 'applicant@approvaliq.dev',
    role: 'applicant' as const,
    password: DEMO_PASSWORD,
  },
  officer: {
    email: 'officer@approvaliq.dev',
    role: 'officer' as const,
    password: DEMO_PASSWORD,
  },
  admin: {
    email: 'admin@approvaliq.dev',
    role: 'admin' as const,
    password: DEMO_PASSWORD,
  },
};

const DEMO_PROFILE_VALUES = {
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

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function parseFlags(): { reset: boolean; wipeOnly: boolean } {
  const args = process.argv.slice(2);
  return {
    reset: args.includes('--reset') || args.includes('-r'),
    wipeOnly: args.includes('--wipe-only'),
  };
}

async function ensureRegulatoryData(prisma: PrismaClient): Promise<string> {
  const existingRelease = await prisma.knowledgeRelease.findFirst({
    where: { status: 'draft' },
    orderBy: { version: 'desc' },
  });

  const approvalCount = await prisma.approvalDefinition.count({
    where: { industry: { code: 'brewery' } },
  });

  if (existingRelease && approvalCount > 0) {
    console.log(`[Regulatory KB] Release '${existingRelease.version}' present with ${approvalCount} brewery approvals.`);
    return existingRelease.id;
  }

  console.log('[Regulatory KB] Missing draft release or brewery approvals. Importing from CSV...');
  const importScript = resolve(__dirname, 'import-regulatory-data.ts');
  execFileSync('npx', ['tsx', importScript], {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  });

  const recheck = await prisma.knowledgeRelease.findFirst({
    where: { status: 'draft' },
    orderBy: { version: 'desc' },
  });
  if (!recheck) {
    throw new Error('Failed to bootstrap regulatory KnowledgeRelease via import-regulatory-data.ts');
  }
  return recheck.id;
}

async function wipeDemoData(prisma: PrismaClient, storageRoot: string): Promise<void> {
  console.log('[Reset] Cleaning up previous demo data...');

  const demoEmails = Object.values(DEMO_USERS).map((u) => u.email);
  const demoProjects = await prisma.project.findMany({
    where: {
      OR: [{ businessId: DEMO_BUSINESS_ID }, { name: DEMO_PROJECT_NAME }],
    },
    select: { id: true },
  });

  const projectIds = demoProjects.map((p) => p.id);

  if (projectIds.length > 0) {
    // 1. Clarifications & Responses
    await prisma.clarificationResponseDocument.deleteMany({
      where: { clarificationResponse: { clarificationRequest: { projectId: { in: projectIds } } } },
    });
    await prisma.clarificationResponse.deleteMany({
      where: { clarificationRequest: { projectId: { in: projectIds } } },
    });
    await prisma.clarificationRequest.deleteMany({
      where: { projectId: { in: projectIds } },
    });

    // 2. Joint Inspections
    await prisma.jointInspectorChecklist.deleteMany({
      where: { jointInspection: { projectId: { in: projectIds } } },
    });
    await prisma.jointInspectionApproval.deleteMany({
      where: { jointInspection: { projectId: { in: projectIds } } },
    });
    await prisma.jointInspection.deleteMany({
      where: { projectId: { in: projectIds } },
    });

    // 3. Consistency Checks
    await prisma.consistencyCheckResult.deleteMany({
      where: { projectId: { in: projectIds } },
    });

    // 4. Approval Instances & Packet Documents
    await prisma.approvalInstanceDocument.deleteMany({
      where: { approvalInstance: { projectId: { in: projectIds } } },
    });
    await prisma.approvalInstance.deleteMany({
      where: { projectId: { in: projectIds } },
    });

    // 5. Document Vault (Records, Extractions, Versions, Documents)
    const docs = await prisma.document.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true },
    });
    const docIds = docs.map((d) => d.id);
    if (docIds.length > 0) {
      await prisma.verificationRecord.deleteMany({
        where: { documentVersion: { documentId: { in: docIds } } },
      });
      const versions = await prisma.documentVersion.findMany({ where: { documentId: { in: docIds } }, select: { id: true } });
      const versionIds = versions.map((v) => v.id);
      await prisma.fieldCorrection.deleteMany({
        where: { documentVersionId: { in: versionIds } },
      });
      await prisma.extractionResult.deleteMany({
        where: { documentVersionId: { in: versionIds } },
      });
      await prisma.document.updateMany({
        where: { id: { in: docIds } },
        data: { currentVersionId: null },
      });
      await prisma.documentVersion.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.document.deleteMany({
        where: { id: { in: docIds } },
      });
    }

    // 6. Profiles & Memberships
    await prisma.businessProfileVersion.deleteMany({
      where: { projectId: { in: projectIds } },
    });
    await prisma.projectMember.deleteMany({
      where: { projectId: { in: projectIds } },
    });

    // 7. Delete Projects
    await prisma.project.deleteMany({
      where: { id: { in: projectIds } },
    });

    // 8. Delete Storage Directories
    for (const pid of projectIds) {
      const projDir = join(storageRoot, pid);
      if (existsSync(projDir)) {
        await rm(projDir, { recursive: true, force: true });
      }
    }
  }

  // 9. Officer Assignments for demo officers
  const demoOfficerUsers = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    select: { id: true },
  });
  const officerUserIds = demoOfficerUsers.map((u) => u.id);
  if (officerUserIds.length > 0) {
    await prisma.officerAuthorityAssignment.deleteMany({
      where: { officerId: { in: officerUserIds } },
    });
    // 10. Delete demo users
    await prisma.user.deleteMany({
      where: { id: { in: officerUserIds } },
    });
  }

  console.log('[Reset] Demo wipe complete.');
}

async function main(): Promise<void> {
  const { reset, wipeOnly } = parseFlags();
  const prisma = new PrismaClient();
  const storageRoot = resolve(process.env.STORAGE_LOCAL_PATH || resolve(process.cwd(), 'data', 'storage'));

  try {
    console.log('====================================================');
    console.log('       ApprovalIQ — Demo Seed & Reset Tool          ');
    console.log('====================================================\n');

    if (reset || wipeOnly) {
      await wipeDemoData(prisma, storageRoot);
      if (wipeOnly) {
        console.log('Wipe-only requested. Exiting.');
        return;
      }
    }

    // 1. Regulatory Knowledge Base
    const releaseId = await ensureRegulatoryData(prisma);

    // 2. Users & Authentication
    console.log('\n[1/7] Seeding demo users...');
    const userMap: Record<string, { id: string; email: string; role: string }> = {};

    for (const [key, spec] of Object.entries(DEMO_USERS)) {
      const passwordHash = await hashPassword(spec.password);
      const user = await prisma.user.upsert({
        where: { email: spec.email },
        update: { role: spec.role, passwordHash },
        create: { email: spec.email, role: spec.role, passwordHash },
      });
      userMap[key] = { id: user.id, email: user.email, role: user.role };
      console.log(`  ✓ ${spec.role.toUpperCase()}: ${user.email}`);
    }

    const applicant = userMap.applicant!;
    const officer = userMap.officer!;
    const _admin = userMap.admin!;

    // 3. Officer Authority Scoping
    console.log('\n[2/7] Scoping officer across authorities...');
    const targetAuthorityCodes = ['AUTH-MPCB', 'AUTH-EXCISE', 'AUTH-FIRE', 'AUTH-DISH', 'AUTH-FSSAI'];
    const authorities = await prisma.authority.findMany({
      where: { code: { in: targetAuthorityCodes } },
    });

    for (const auth of authorities) {
      await prisma.officerAuthorityAssignment.upsert({
        where: { officerId_authorityId: { officerId: officer.id, authorityId: auth.id } },
        update: {},
        create: { officerId: officer.id, authorityId: auth.id },
      });
      console.log(`  ✓ Assigned officer to ${auth.code} (${auth.name})`);
    }

    // 4. Demo Project & Confirmed Business Profile
    console.log('\n[3/7] Creating demo project & confirmed profile...');
    const existingProject = await prisma.project.findFirst({
      where: { OR: [{ businessId: DEMO_BUSINESS_ID }, { name: DEMO_PROJECT_NAME }] },
    });

    const project = existingProject
      ? await prisma.project.update({
          where: { id: existingProject.id },
          data: { name: DEMO_PROJECT_NAME, industry: 'brewery', businessId: DEMO_BUSINESS_ID },
        })
      : await prisma.project.create({
          data: { name: DEMO_PROJECT_NAME, industry: 'brewery', businessId: DEMO_BUSINESS_ID },
        });

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: applicant.id } },
      update: {},
      create: { projectId: project.id, userId: applicant.id },
    });

    const confirmedProfile = await prisma.businessProfileVersion.upsert({
      where: { projectId_versionNumber: { projectId: project.id, versionNumber: 1 } },
      update: { values: DEMO_PROFILE_VALUES as object, status: 'confirmed', confirmedAt: new Date() },
      create: {
        projectId: project.id,
        versionNumber: 1,
        values: DEMO_PROFILE_VALUES as object,
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    });
    console.log(`  ✓ Project: ${project.name} (${project.id})`);
    console.log(`  ✓ Profile v1: Confirmed (6,000 sq ft leased brewery in Pune, MH)`);

    // 5. Pure Approval Engine Evaluation & Roadmap Generation
    console.log('\n[4/7] Running approval engine evaluation & building roadmap...');
    const dbApprovals = await prisma.approvalDefinition.findMany({
      where: { releaseId, industry: { code: 'brewery' } },
      include: {
        requirements: { include: { documentDefinition: true } },
        source: { select: { url: true } },
        authority: true,
      },
      orderBy: { code: 'asc' },
    });

    const dbDeps = await prisma.dependency.findMany({
      where: {
        fromApprovalId: { in: dbApprovals.map((a) => a.id) },
        toApprovalId: { in: dbApprovals.map((a) => a.id) },
      },
    });

    const codeById = new Map(dbApprovals.map((a) => [a.id, a.code]));
    const idByCode = new Map(dbApprovals.map((a) => [a.code, a.id]));

    const engineDefs = dbApprovals.map((a) => ({
      id: a.code,
      name: a.name,
      description: a.whyRequired,
      sourceUrl: a.officialApplicationUrl ?? a.source?.url ?? undefined,
      lastVerifiedDate: a.lastVerifiedDate ? new Date(a.lastVerifiedDate).toISOString() : undefined,
      condition: toEngineCondition(a.applicabilityConditions) as EngineCondition | undefined,
      requiredDocuments: a.requirements.map((r) => ({
        id: r.documentDefinition.code,
        name: r.documentDefinition.name,
      })),
    }));

    const engineDeps = dbDeps.map((d) => ({
      from: codeById.get(d.fromApprovalId)!,
      to: codeById.get(d.toApprovalId)!,
      relationship: d.relationship as EngineRelationship,
    }));

    const { evaluate } = (await import('@approvaliq/approval-engine')) as {
      evaluate: (profile: unknown, defs: unknown, deps: unknown) => {
        approvals: Array<{ approval: { id: string }; outcome: string; neededInformation: unknown }>;
        [k: string]: unknown;
      };
    };

    const evalResult = evaluate(DEMO_PROFILE_VALUES, engineDefs, engineDeps);

    const evalRun = await prisma.evaluationRun.create({
      data: {
        profileSnapshot: DEMO_PROFILE_VALUES as object,
        releaseId,
        engineVersion: '0.0.1',
        resultSnapshot: evalResult as object,
        results: {
          create: evalResult.approvals.map((a) => ({
            approvalDefinitionId: idByCode.get(a.approval.id) ?? dbApprovals[0]!.id,
            outcome: a.outcome,
            missingFields: JSON.parse(JSON.stringify(a.neededInformation)) as object,
          })),
        },
      },
      include: { results: true },
    });

    // Roadmap Status Distribution: make it realistic
    const initialStatusMap: Record<string, 'available' | 'in_progress' | 'blocked'> = {
      'MPCB-CTE-001': 'in_progress', // Application started & documents attached
      'FIRE-PROVISIONAL-001': 'available',
      'DISH-PLAN-001': 'available',
      'FSSAI-LICENCE-001': 'available',
      'LM-PACKAGED-001': 'available',
      'MPCB-CTO-001': 'blocked', // Depends on CTE
      'FIRE-FINAL-001': 'blocked', // Depends on Provisional Fire
      'BRL-001': 'blocked', // Depends on MPCB, Fire, DISH
      'DISH-LICENCE-001': 'available',
      'EXCISE-LABEL-001': 'blocked',
    };

    const instanceMap = new Map<string, string>(); // code -> instanceId

    for (const r of evalRun.results) {
      if (r.outcome === 'not_applicable') continue;
      const defCode = codeById.get(r.approvalDefinitionId) || '';
      const status = initialStatusMap[defCode] ?? 'available';

      const inst = await prisma.approvalInstance.upsert({
        where: { projectId_approvalDefinitionId: { projectId: project.id, approvalDefinitionId: r.approvalDefinitionId } },
        update: {
          evaluationResultId: r.id,
          status,
          unlockedAt: status !== 'blocked' ? new Date() : null,
        },
        create: {
          projectId: project.id,
          approvalDefinitionId: r.approvalDefinitionId,
          evaluationResultId: r.id,
          status,
          unlockedAt: status !== 'blocked' ? new Date() : null,
        },
      });
      instanceMap.set(defCode, inst.id);
    }
    console.log(`  ✓ Evaluation run persisted (${evalRun.id}) with ${evalRun.results.length} evaluations.`);
    console.log(`  ✓ Generated ${instanceMap.size} approval roadmap instances.`);

    // 6. Documents, Pre-Run Extraction, Human Verification & Deliberate Area Mismatch
    console.log('\n[5/7] Seeding documents, pre-run extractions & consistency checks...');
    const projectStorageDir = join(storageRoot, project.id);
    await mkdir(projectStorageDir, { recursive: true });

    // Document 1: Municipal Trade Licence (with Deliberate 5,000 sq ft Area Mismatch)
    const tradeLicenceBuffer = Buffer.from('APPROVALIQ_DEMO_TRADE_LICENCE');
    const tradeLicenceHash = sha256(tradeLicenceBuffer);
    const doc1Id = randomUUID();
    const ver1Id = randomUUID();
    const blob1Path = join(projectStorageDir, `${ver1Id}.blob`);
    await writeFile(blob1Path, tradeLicenceBuffer);

    const docDefTradeLicence = await prisma.documentDefinition.findFirst({
      where: { code: 'DOC-022' }, // Local Body / Planning Authority NOC
    });

    const doc1 = await prisma.document.create({
      data: {
        id: doc1Id,
        projectId: project.id,
        documentDefinitionId: docDefTradeLicence?.id,
        documentDefinitionManualOverride: true,
        metadata: {
          notes: 'Municipal Trade Licence issued by Pune Municipal Corporation',
          verifiedFootprint: '5,000 sq ft operational area',
        },
      },
    });

    const ver1 = await prisma.documentVersion.create({
      data: {
        id: ver1Id,
        documentId: doc1.id,
        versionNumber: 1,
        storageKey: `${project.id}/${ver1Id}.blob`,
        originalFilename: 'pune_municipal_trade_licence_2024.pdf',
        mimeType: 'application/pdf',
        sizeBytes: tradeLicenceBuffer.length,
        fileHash: tradeLicenceHash,
        uploadedByUserId: applicant.id,
        state: 'verified',
      },
    });

    await prisma.document.update({
      where: { id: doc1.id },
      data: { currentVersionId: ver1.id },
    });

    const doc1ExtractionFields = [
      { name: 'documentType', value: 'trade_licence', confidence: 0.95, evidenceLocation: 'page 1, header' },
      { name: 'entityName', value: 'Pune Brewing Co.', confidence: 0.9, evidenceLocation: 'page 1, para 1' },
      { name: 'issuingAuthority', value: 'Pune Municipal Corporation', confidence: 0.88, evidenceLocation: 'page 1, seal' },
      { name: 'documentNumber', value: 'TL-2024-001', confidence: 0.92, evidenceLocation: 'page 1, top-right' },
      { name: 'issueDate', value: '2024-04-01', confidence: 0.85, evidenceLocation: 'page 1' },
      { name: 'expiryDate', value: '2025-03-31', confidence: 0.88, evidenceLocation: 'page 1' },
      { name: 'address', value: 'Plot 42, Hadapsar Industrial Estate, Pune, Maharashtra', confidence: 0.8, evidenceLocation: 'page 1, para 2' },
      { name: 'propertyIdentifier', value: 'Plot 42, Hadapsar', confidence: 0.85, evidenceLocation: 'page 1' },
      { name: 'area', value: '5000', confidence: 0.4, evidenceLocation: 'page 2' },
      { name: 'areaUnits', value: 'sqft', confidence: 0.9, evidenceLocation: 'page 2' },
      { name: 'ownerHolder', value: 'Pune Brewing Co.', confidence: 0.9, evidenceLocation: 'page 1' },
      { name: 'purpose', value: 'Commercial Brewery Operations', confidence: 0.85, evidenceLocation: 'page 1' },
      { name: 'jurisdiction', value: 'Maharashtra', confidence: 0.9, evidenceLocation: 'page 1' },
      { name: 'activityIndustry', value: 'brewery', confidence: 0.93, evidenceLocation: 'page 1' },
      { name: 'conditions', value: 'Subject to annual fire safety audit and effluent compliance', confidence: 0.8, evidenceLocation: 'page 3' },
    ];

    await prisma.extractionResult.create({
      data: {
        documentVersionId: ver1.id,
        fields: doc1ExtractionFields as object,
        modelProvider: 'mock',
        modelVersion: 'mock-1.0.0',
        promptVersion: 'n/a',
      },
    });

    await prisma.verificationRecord.create({
      data: {
        documentVersionId: ver1.id,
        verifierUserId: applicant.id,
        fieldsVerified: ['documentType', 'entityName', 'issuingAuthority', 'documentNumber', 'area'] as object,
        notes: 'Pre-inspected official municipal seal and trade licence registration number TL-2024-001.',
        evidenceInspected: true,
        method: 'manual_review',
        verifiedBy: 'applicant',
      },
    });

    // Consistency Check Results (Profile 6,000 sq ft vs Document 5,000 sq ft)
    await prisma.consistencyCheckResult.createMany({
      data: [
        {
          projectId: project.id,
          documentId: doc1.id,
          documentVersionId: ver1.id,
          profileVersionId: confirmedProfile.id,
          checkType: 'profile_vs_document',
          checkId: 'area',
          profileField: 'areaSqft',
          documentField: 'area',
          sideAValue: '6000 sqft',
          sideBValue: '5000 sqft',
          outcome: 'mismatch',
          tolerancePct: 1,
          detail: 'profile declared 6000 sqft, document specifies 5000 sqft (exceeds 1% tolerance)',
        },
        {
          projectId: project.id,
          documentId: doc1.id,
          documentVersionId: ver1.id,
          profileVersionId: confirmedProfile.id,
          checkType: 'profile_vs_document',
          checkId: 'jurisdiction',
          profileField: 'state',
          documentField: 'jurisdiction',
          sideAValue: 'Maharashtra',
          sideBValue: 'Maharashtra',
          outcome: 'match',
          detail: null,
        },
        {
          projectId: project.id,
          documentId: doc1.id,
          documentVersionId: ver1.id,
          profileVersionId: confirmedProfile.id,
          checkType: 'profile_vs_document',
          checkId: 'premises',
          profileField: 'district',
          documentField: 'address',
          sideAValue: 'Pune',
          sideBValue: 'Plot 42, Hadapsar Industrial Estate, Pune, Maharashtra',
          outcome: 'match',
          detail: null,
        },
        {
          projectId: project.id,
          documentId: doc1.id,
          documentVersionId: ver1.id,
          profileVersionId: confirmedProfile.id,
          checkType: 'profile_vs_document',
          checkId: 'activity',
          profileField: 'activityType',
          documentField: 'activityIndustry',
          sideAValue: 'brewery',
          sideBValue: 'brewery',
          outcome: 'match',
          detail: null,
        },
      ],
    });

    // Attach Trade Licence to MPCB-CTE-001 instance
    const mpcbCteInstanceId = instanceMap.get('MPCB-CTE-001');
    if (mpcbCteInstanceId) {
      await prisma.approvalInstanceDocument.create({
        data: {
          approvalInstanceId: mpcbCteInstanceId,
          documentId: doc1.id,
        },
      });
    }

    // Document 2: Land Lease Deed & N.A. Permission (Reusable across MPCB CTE & Excise BRL-001)
    const leaseBuffer = Buffer.from('APPROVALIQ_DEMO_LAND_LEASE_AGREEMENT');
    const leaseHash = sha256(leaseBuffer);
    const doc2Id = randomUUID();
    const ver2Id = randomUUID();
    await writeFile(join(projectStorageDir, `${ver2Id}.blob`), leaseBuffer);

    const docDefLease = await prisma.documentDefinition.findFirst({
      where: { code: 'DOC-023' }, // Land Ownership / Lease Certificate
    });

    const doc2 = await prisma.document.create({
      data: {
        id: doc2Id,
        projectId: project.id,
        documentDefinitionId: docDefLease?.id,
        documentDefinitionManualOverride: true,
        metadata: {
          notes: 'Registered Long-Term Industrial Lease Deed (30 years) with MIDC / Landowner',
          coveredArea: '6,000 sq ft total industrial plot',
        },
      },
    });

    const ver2 = await prisma.documentVersion.create({
      data: {
        id: ver2Id,
        documentId: doc2.id,
        versionNumber: 1,
        storageKey: `${project.id}/${ver2Id}.blob`,
        originalFilename: 'registered_industrial_lease_deed_6000sqft.pdf',
        mimeType: 'application/pdf',
        sizeBytes: leaseBuffer.length,
        fileHash: leaseHash,
        uploadedByUserId: applicant.id,
        state: 'verified',
      },
    });

    await prisma.document.update({
      where: { id: doc2.id },
      data: { currentVersionId: ver2.id },
    });

    await prisma.extractionResult.create({
      data: {
        documentVersionId: ver2.id,
        fields: [
          { name: 'documentType', value: 'land_lease_deed', confidence: 0.95, evidenceLocation: 'page 1' },
          { name: 'entityName', value: 'Pune Brewing Co.', confidence: 0.92, evidenceLocation: 'page 1, party B' },
          { name: 'area', value: '6000', confidence: 0.95, evidenceLocation: 'schedule A' },
          { name: 'areaUnits', value: 'sqft', confidence: 0.95, evidenceLocation: 'schedule A' },
          { name: 'address', value: 'Plot 42, Hadapsar Industrial Estate, Pune, Maharashtra', confidence: 0.9, evidenceLocation: 'page 1' },
          { name: 'jurisdiction', value: 'Maharashtra', confidence: 0.95, evidenceLocation: 'page 1' },
        ] as object,
        modelProvider: 'mock',
        modelVersion: 'mock-1.0.0',
        promptVersion: 'n/a',
      },
    });

    await prisma.verificationRecord.create({
      data: {
        documentVersionId: ver2.id,
        verifierUserId: applicant.id,
        fieldsVerified: ['documentType', 'entityName', 'area', 'address'] as object,
        notes: 'Verified registered land lease deed confirming full 6,000 sq ft plot boundary.',
        evidenceInspected: true,
        method: 'manual_review',
        verifiedBy: 'applicant',
      },
    });

    await prisma.consistencyCheckResult.create({
      data: {
        projectId: project.id,
        documentId: doc2.id,
        documentVersionId: ver2.id,
        profileVersionId: confirmedProfile.id,
        checkType: 'profile_vs_document',
        checkId: 'area',
        profileField: 'areaSqft',
        documentField: 'area',
        sideAValue: '6000 sqft',
        sideBValue: '6000 sqft',
        outcome: 'match',
        tolerancePct: 1,
        detail: null,
      },
    });

    // Attach Lease Deed to MPCB-CTE-001 and BRL-001 (demonstrating multi-approval packet reuse)
    if (mpcbCteInstanceId) {
      await prisma.approvalInstanceDocument.create({
        data: { approvalInstanceId: mpcbCteInstanceId, documentId: doc2.id },
      });
    }
    const brlInstanceId = instanceMap.get('BRL-001');
    if (brlInstanceId) {
      await prisma.approvalInstanceDocument.create({
        data: { approvalInstanceId: brlInstanceId, documentId: doc2.id },
      });
    }

    console.log(`  ✓ Seeded Municipal Trade Licence (${doc1.id}) with ⚠️ DELIBERATE AREA MISMATCH (6,000 vs 5,000 sq ft)`);
    console.log(`  ✓ Seeded Industrial Lease Deed (${doc2.id}) matching profile and linked across approvals for reuse`);

    // 7. Officer Queue & Two-Sided Clarification Round-Trip
    console.log('\n[6/7] Seeding officer clarification request & applicant response...');
    const authMpcb = authorities.find((a) => a.code === 'AUTH-MPCB') || authorities[0]!;

    if (mpcbCteInstanceId) {
      const clarificationReq = await prisma.clarificationRequest.create({
        data: {
          approvalInstanceId: mpcbCteInstanceId,
          projectId: project.id,
          authorityId: authMpcb.id,
          requestedByUserId: officer.id,
          subject: 'Discrepancy in declared brewery footprint vs. municipal trade licence',
          message:
            'Your business profile declares a plot/premises footprint of 6,000 sq ft, whereas the attached municipal trade licence (TL-2024-001) records 5,000 sq ft. Please provide clarification or documentary evidence for the remaining 1,000 sq ft before CTE inspection scheduling.',
          requestedFields: ['areaSqft', 'DOC-022'] as object,
          status: 'responded',
          dueAt: new Date(Date.now() + 7 * 86400000), // 7 days in future
          respondedAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
      });

      const clarificationResp = await prisma.clarificationResponse.create({
        data: {
          clarificationRequestId: clarificationReq.id,
          authorUserId: applicant.id,
          authorRole: 'applicant',
          message:
            'The primary brewing and fermentation plant occupies 5,000 sq ft as authorized under municipal trade licence TL-2024-001. The supplementary 1,000 sq ft represents an annexed cold-storage and grain-handling warehouse leased under Addendum Schedule B (registered Land Lease Deed attached as evidence).',
        },
      });

      await prisma.clarificationResponseDocument.create({
        data: {
          clarificationResponseId: clarificationResp.id,
          documentId: doc2.id, // Attached lease deed evidence
        },
      });

      console.log(`  ✓ Officer clarification request (${clarificationReq.id})`);
      console.log(`  ✓ Applicant clarification response with attached documentary evidence`);
    }

    // 8. Joint Inspection Planning (Feature #7)
    console.log('\n[7/7] Seeding joint inspection planning schedule...');
    const inspectionDate = new Date(Date.now() + 5 * 86400000); // 5 days in future

    const jointInspection = await prisma.jointInspection.create({
      data: {
        projectId: project.id,
        title: 'Joint Pre-Establishment Plant Readiness Inspection',
        stage: 'plant_readiness',
        status: 'scheduled',
        scheduledDate: inspectionDate,
        timeSlot: '10:30 AM - 01:30 PM',
        premisesAddress: 'Plot 42, Hadapsar Industrial Estate, Pune, Maharashtra 411028',
        leadAuthorityCode: 'AUTH-MPCB',
        leadAuthorityName: 'Maharashtra Pollution Control Board',
        notes:
          'Single-window joint inspection across MPCB, DISH, and Fire Department to inspect effluent treatment plant civil foundation, boiler setback boundaries, and emergency evacuation egress.',
        readinessChecklist: {
          civilWorksComplete: true,
          boundaryDemarcated: true,
          etpFootprintClear: true,
          fireHydrantAccessAvailable: true,
        } as object,
        slotNegotiation: {
          proposedSlots: ['2026-09-22 10:30', '2026-09-23 14:00'],
          consensusSlot: '2026-09-22 10:30',
          confirmedBy: ['AUTH-MPCB', 'AUTH-DISH', 'AUTH-FIRE'],
        } as object,
      },
    });

    const inspectionApprovals = [
      { code: 'MPCB-CTE-001', name: 'Consent to Establish', auth: 'AUTH-MPCB', authName: 'Maharashtra Pollution Control Board', reqs: 'Inspect Effluent Treatment Plant (ETP) capacity and hazardous waste containment.' },
      { code: 'DISH-PLAN-001', name: 'Approval of Factory Plan', auth: 'AUTH-DISH', authName: 'Directorate of Industrial Safety and Health', reqs: 'Verify ventilation, machine spacing, and structural emergency egress.' },
      { code: 'FIRE-PROVISIONAL-001', name: 'Provisional Fire NOC', auth: 'AUTH-FIRE', authName: 'Maharashtra Fire & Emergency Services', reqs: 'Verify water storage tank capacity, riser connections, and road access width.' },
    ];

    for (const item of inspectionApprovals) {
      await prisma.jointInspectionApproval.create({
        data: {
          jointInspectionId: jointInspection.id,
          approvalInstanceId: instanceMap.get(item.code) || null,
          approvalCode: item.code,
          approvalName: item.name,
          authorityCode: item.auth,
          authorityName: item.authName,
          specificRequirements: item.reqs,
        },
      });
    }

    const checklists = [
      {
        auth: 'AUTH-MPCB',
        name: 'Maharashtra Pollution Control Board',
        inspector: 'Er. Sandeep Patil',
        designation: 'Sub-Regional Officer (Pune-I)',
        items: [
          { id: 'etp_foundations', label: 'ETP civil excavation and base foundation integrity', status: 'satisfactory' },
          { id: 'air_stack_clearance', label: 'Boiler flue gas chimney height and clearance distance', status: 'pending' },
          { id: 'sampling_ports', label: 'Installation of ISO-compliant stack sampling ports', status: 'pending' },
        ],
      },
      {
        auth: 'AUTH-DISH',
        name: 'Directorate of Industrial Safety and Health',
        inspector: 'S. K. Deshmukh',
        designation: 'Joint Director of Industrial Safety',
        items: [
          { id: 'aisle_width', label: 'Passageway clear width >= 1.8m throughout brewhouse', status: 'satisfactory' },
          { id: 'ventilation_ratio', label: 'Natural/mechanical ventilation ratio compliant with Factories Rules', status: 'satisfactory' },
          { id: 'confined_space_egress', label: 'Fermentation vessel entry and emergency retrieval hoist setup', status: 'pending' },
        ],
      },
      {
        auth: 'AUTH-FIRE',
        name: 'Maharashtra Fire & Emergency Services',
        inspector: 'CFO V. R. Shinde',
        designation: 'Divisional Fire Officer',
        items: [
          { id: 'fire_tender_road', label: '6m wide all-weather motorable access road around perimeter', status: 'satisfactory' },
          { id: 'underground_static_tank', label: 'Underground static water storage capacity (minimum 100k litres)', status: 'satisfactory' },
        ],
      },
    ];

    for (const c of checklists) {
      await prisma.jointInspectorChecklist.create({
        data: {
          jointInspectionId: jointInspection.id,
          authorityCode: c.auth,
          authorityName: c.name,
          inspectorName: c.inspector,
          inspectorDesignation: c.designation,
          status: 'pending',
          items: c.items as object,
          findingsNotes: 'Preliminary site layout verified; final joint verification pending during scheduled inspection window.',
        },
      });
    }
    console.log(`  ✓ Joint inspection created (${jointInspection.id}) across MPCB, DISH, and Fire Department.`);

    // Finished summary
    console.log('\n====================================================');
    console.log('            ApprovalIQ DEMO READY! 🎉              ');
    console.log('====================================================');
    console.log('\nDemo User Accounts:');
    console.log('  ┌───────────────┬──────────────────────────┬──────────────┐');
    console.log('  │ Role          │ Email                    │ Password     │');
    console.log('  ├───────────────┼──────────────────────────┼──────────────┤');
    console.log('  │ Applicant     │ applicant@approvaliq.dev │ Password123! │');
    console.log('  │ Officer       │ officer@approvaliq.dev   │ Password123! │');
    console.log('  │ Admin         │ admin@approvaliq.dev     │ Password123! │');
    console.log('  └───────────────┴──────────────────────────┴──────────────┘');
    console.log('\nKey Demo Highlights & Features Seeded:');
    console.log(`  • Project: "${DEMO_PROJECT_NAME}" (ID: ${project.id})`);
    console.log(`  • Confirmed Profile: 6,000 sq ft leased brewery in Hadapsar, Pune, MH`);
    console.log(`  • Pure Engine Evaluation: Roadmap initialized with 10 approvals`);
    console.log(`  • Deliberate Consistency Finding: Trade Licence extracts 5,000 sq ft -> MISMATCH against 6,000 sq ft profile`);
    console.log(`  • Document Packet & Reuse: Industrial Lease Deed attached across both MPCB CTE and Excise BRL`);
    console.log(`  • Two-Sided Clarification: Officer raised inquiry on area disparity; Applicant responded with Addendum B`);
    console.log(`  • Joint Inspection: Multi-agency site inspection scheduled across MPCB, DISH, and Fire`);
    console.log('\nHow to rehearse / present:');
    console.log('  1. Login as applicant@approvaliq.dev: Explore Roadmap, Document Vault, Consistency Warnings, and Clarification inbox.');
    console.log('  2. Login as officer@approvaliq.dev: Explore Authority Queue, review MPCB CTE application, and resolve or follow up on Clarification.');
    console.log('====================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exitCode = 1;
});
