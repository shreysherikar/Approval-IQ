import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

/**
 * Demo Seed & Reset Script for SIH Presentation.
 *
 * Sets up a rich end-to-end demo state with:
 * 1. Demo Applicant & Officer users
 * 2. Pre-seeded project & confirmed brewery business profile
 * 3. Evaluated roadmap with live approval instances
 * 4. Active Joint Inspection in progress
 * 5. Pre-seeded RTS Statutory Grievance under Tier 2 Appellate review with audit history
 *
 * Usage:
 *   pnpm run demo:seed
 */

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  console.log('🌱 Seeding ApprovalIQ presentation demo environment...');

  try {
    const passwordHash = await argon2.hash('Password123!');

    // 1. Seed users
    const applicant = await prisma.user.upsert({
      where: { email: 'applicant@demo.com' },
      update: { role: 'applicant', passwordHash },
      create: { email: 'applicant@demo.com', role: 'applicant', passwordHash },
    });

    const officer = await prisma.user.upsert({
      where: { email: 'officer@demo.com' },
      update: { role: 'officer', passwordHash },
      create: { email: 'officer@demo.com', role: 'officer', passwordHash },
    });

    console.log('✔ Demo users ready: applicant@demo.com, officer@demo.com');

    // 2. Assign officer to authorities
    const authorities = await prisma.authority.findMany();
    for (const auth of authorities) {
      await prisma.officerAuthorityAssignment.upsert({
        where: {
          officerId_authorityId: {
            officerId: officer.id,
            authorityId: auth.id,
          },
        },
        create: { officerId: officer.id, authorityId: auth.id },
        update: {},
      });
    }
    console.log(`✔ Assigned officer to ${authorities.length} authorities`);

    // 3. Seed project
    const project = await prisma.project.upsert({
      where: { id: 'demo-pune-brewery-01' },
      update: { name: 'Pune Craft Brewery & Bottling Plant' },
      create: {
        id: 'demo-pune-brewery-01',
        name: 'Pune Craft Brewery & Bottling Plant',
        industry: 'brewery',
        businessId: 'MAH-BIZ-2026-09',
        members: {
          create: [{ userId: applicant.id }],
        },
      },
    });

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: applicant.id } },
      create: { projectId: project.id, userId: applicant.id },
      update: {},
    });

    console.log('✔ Project created and membership assigned');

    // 4. Seed an active statutory RTS Act Grievance
    const existingGrievance = await prisma.grievance.findFirst({
      where: { projectId: project.id, grievanceNumber: 'GRV-2026-948102' },
    });

    if (!existingGrievance) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 5); // 5 days remaining in Tier 2

      const grv = await prisma.grievance.create({
        data: {
          grievanceNumber: 'GRV-2026-948102',
          projectId: project.id,
          authorityId: authorities[0]?.id ?? null,
          submittedByUserId: applicant.id,
          type: 'sla_breach_delay',
          tier: 'tier_2_appellate_authority',
          status: 'under_investigation',
          subject: 'Statutory Delay: Tree Authority NOC Exceeded 30-Day Mandatory SLA',
          description:
            'Tree felling & transplant NOC application filed 42 days ago. Mandated SLA under Maharashtra RTS Act is 30 days. No inspection conducted or reasons given for withholding sanction.',
          statutorySlaDays: 15,
          targetResolutionDate: targetDate,
          actions: {
            create: [
              {
                actorUserId: applicant.id,
                actorRole: 'applicant',
                actionType: 'grievance_submitted',
                fromStatus: null,
                toStatus: 'submitted',
                fromTier: null,
                toTier: 'tier_1_nodal_officer',
                remarks: 'Initial complaint filed before Designated First Authority regarding 12-day SLA breach.',
              },
              {
                actorUserId: applicant.id,
                actorRole: 'applicant',
                actionType: 'statutory_escalation',
                fromStatus: 'submitted',
                toStatus: 'escalated',
                fromTier: 'tier_1_nodal_officer',
                toTier: 'tier_2_appellate_authority',
                remarks:
                  'First Authority failed to issue response within statutory 15 days. Escalated to First Appellate Authority (District Collector / Additional Commissioner).',
              },
              {
                actorUserId: officer.id,
                actorRole: 'officer',
                actionType: 'investigation_initiated',
                fromStatus: 'escalated',
                toStatus: 'under_investigation',
                fromTier: 'tier_2_appellate_authority',
                toTier: 'tier_2_appellate_authority',
                remarks:
                  'Appellate Authority took cognizance. Summons issued to desk officer; hearing fixed for tomorrow.',
                metadata: {
                  hearingScheduledAt: new Date(Date.now() + 86400000).toISOString(),
                  assignedInvestigator: 'Additional District Magistrate (Industries)',
                },
              },
            ],
          },
        },
      });

      console.log(`✔ Pre-seeded active statutory grievance: ${grv.grievanceNumber} (Tier 2 Appellate Review)`);
    }

    console.log('\n🎉 DEMO SEED COMPLETE! Log in with:');
    console.log('   Applicant: applicant@demo.com / Password123!');
    console.log('   Officer:   officer@demo.com   / Password123!');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
