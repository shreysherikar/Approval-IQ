import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.util';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('--- Populating Complete Officer Demo Dataset ---');

    // 1. Officer User
    const officerEmail = 'officer@approvaliq.gov.in';
    const officerPassword = 'Officer123!';
    const officerHash = await hashPassword(officerPassword);

    const officer = await prisma.user.upsert({
      where: { email: officerEmail },
      update: { role: 'officer', passwordHash: officerHash },
      create: {
        email: officerEmail,
        passwordHash: officerHash,
        role: 'officer',
      },
    });
    console.log(`Officer user ready: ${officer.email}`);

    // 2. Applicant User
    const applicantEmail = 'business@solarpower.in';
    const applicantPassword = 'Password123!';
    const applicantHash = await hashPassword(applicantPassword);

    const applicant = await prisma.user.upsert({
      where: { email: applicantEmail },
      update: { role: 'applicant', passwordHash: applicantHash },
      create: {
        email: applicantEmail,
        passwordHash: applicantHash,
        role: 'applicant',
      },
    });
    console.log(`Applicant user ready: ${applicant.email}`);

    // 3. Authorities
    const authorities = await prisma.authority.findMany();
    for (const auth of authorities) {
      await prisma.officerAuthorityAssignment.upsert({
        where: {
          officerId_authorityId: {
            officerId: officer.id,
            authorityId: auth.id,
          },
        },
        update: {},
        create: {
          officerId: officer.id,
          authorityId: auth.id,
        },
      });
    }
    console.log(`Assigned officer to ${authorities.length} regulatory authorities.`);

    // 4. Create Demo Project
    const project = await prisma.project.create({
      data: {
        name: 'Apex Green Hydrogen Plant (Nashik Phase 1)',
        industry: 'Chemicals & Clean Fuels',
        businessId: 'BUS-APEX-001',
        members: {
          create: {
            userId: applicant.id,
          },
        },
      },
    });
    console.log(`Demo project created: ${project.name} (${project.id})`);

    // 5. Pick an active release and approvals
    const release =
      (await prisma.knowledgeRelease.findFirst({
        where: { status: 'published' },
      })) ??
      (await prisma.knowledgeRelease.create({
        data: {
          version: 'v1.0.0-demo',
          status: 'published',
        },
      }));

    const approvals = await prisma.approvalDefinition.findMany({ take: 3 });

    const evalRun = await prisma.evaluationRun.create({
      data: {
        releaseId: release.id,
        engineVersion: '0.1.0',
        profileSnapshot: {
          companyName: 'Apex Clean Energy Ltd',
          industry: 'Chemicals & Clean Fuels',
          state: 'Maharashtra',
          district: 'Nashik',
          investmentInrCrores: 85,
        },
        resultSnapshot: {},
      },
    });

    for (let i = 0; i < approvals.length; i++) {
      const appDef = approvals[i];

      const evalResult = await prisma.evaluationResult.create({
        data: {
          evaluationRunId: evalRun.id,
          approvalDefinitionId: appDef.id,
          outcome: 'applicable',
          missingFields: [],
        },
      });

      const instance = await prisma.approvalInstance.create({
        data: {
          projectId: project.id,
          approvalDefinitionId: appDef.id,
          evaluationResultId: evalResult.id,
          status: 'in_progress',
        },
      });

      if (i === 0) {
        const clar = await prisma.clarificationRequest.create({
          data: {
            approvalInstanceId: instance.id,
            projectId: project.id,
            authorityId: appDef.authorityId,
            requestedByUserId: officer.id,
            subject: 'Clarification regarding Effluent Treatment Flow Diagram',
            message:
              'Please provide the updated Zero Liquid Discharge (ZLD) mass balance flowchart along with membrane filtration specifications.',
            status: 'responded',
            responses: {
              create: [
                {
                  authorUserId: applicant.id,
                  authorRole: 'applicant',
                  message:
                    'We have updated the schematic and attached the high-pressure RO membrane capacity sheet as requested.',
                },
              ],
            },
          },
        });
        console.log(`Created clarification thread on ${appDef.name}: ${clar.subject}`);
      }
      console.log(`Created Application in Officer Queue: ${appDef.name} (${instance.id})`);
    }

    console.log('--- All Officer Demo Data Initialized Successfully ---');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to seed officer demo:', err);
  process.exit(1);
});
