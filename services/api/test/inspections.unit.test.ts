import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InspectionsService } from '../src/inspections/inspections.service';
import { JointInspectionStageEnum } from '../src/inspections/dto/schedule-inspection.dto';

test('InspectionsService: candidate grouping identifies pre-construction and pre-commissioning stages', async () => {
  const mockPrisma: any = {
    project: {
      findUnique: async () => ({ id: 'proj-1', name: 'Test Brewery', industry: 'brewery' }),
    },
    approvalInstance: {
      findMany: async () => [
        { approvalDefinition: { code: 'MPCB-CTE-001', authority: { code: 'AUTH-MPCB', name: 'MPCB' } } },
        { approvalDefinition: { code: 'FIRE-PROVISIONAL-001', authority: { code: 'AUTH-FIRE', name: 'Fire Services' } } },
        { approvalDefinition: { code: 'MPCB-CTO-001', authority: { code: 'AUTH-MPCB', name: 'MPCB' } } },
        { approvalDefinition: { code: 'FIRE-FINAL-001', authority: { code: 'AUTH-FIRE', name: 'Fire Services' } } },
        { approvalDefinition: { code: 'DISH-LICENCE-001', authority: { code: 'AUTH-DISH', name: 'Labour / DISH' } } },
        { approvalDefinition: { code: 'BRL-001', authority: { code: 'AUTH-EXCISE', name: 'State Excise' } } },
      ],
    },
  };

  const service = new InspectionsService(mockPrisma);
  const result = await service.getCandidates('proj-1');

  assert.ok(result.candidates.length >= 2, 'Should find at least 2 inspection stages');
  
  const preConstruction = result.candidates.find(
    (c) => c.stage === JointInspectionStageEnum.PRE_CONSTRUCTION,
  );
  assert.ok(preConstruction, 'Pre-construction candidate stage should exist');
  assert.equal(preConstruction?.leadAuthorityCode, 'AUTH-MPCB');
  assert.ok(preConstruction?.participatingApprovals.some((a) => a.approvalCode === 'MPCB-CTE-001'));
  assert.ok(preConstruction?.participatingApprovals.some((a) => a.approvalCode === 'FIRE-PROVISIONAL-001'));

  const preCommissioning = result.candidates.find(
    (c) => c.stage === JointInspectionStageEnum.PRE_COMMISSIONING,
  );
  assert.ok(preCommissioning, 'Pre-commissioning candidate stage should exist');
  assert.equal(preCommissioning?.leadAuthorityCode, 'AUTH-EXCISE');
  assert.ok(preCommissioning?.participatingApprovals.some((a) => a.approvalCode === 'MPCB-CTO-001'));
  assert.ok(preCommissioning?.participatingApprovals.some((a) => a.approvalCode === 'FIRE-FINAL-001'));
  assert.ok(preCommissioning?.participatingApprovals.some((a) => a.approvalCode === 'DISH-LICENCE-001'));
  assert.ok(preCommissioning?.participatingApprovals.some((a) => a.approvalCode === 'BRL-001'));

  // Consolidation metrics
  assert.ok(result.summary.totalSeparateVisits > result.summary.consolidatedJointVisits);
  assert.ok(result.summary.visitsSaved > 0, 'Visits saved should be positive');
  assert.ok(result.summary.totalDaysSaved > 0, 'Total days saved should be positive');
});

test('InspectionsService: completeInspection marks participating approval instances done and unlocks dependents', async () => {
  let unlockedDefId: string | null = null;
  const updatedInstances: any[] = [];

  const mockPrisma: any = {
    project: {
      findUnique: async () => ({ id: 'proj-1', name: 'Test Brewery', industry: 'brewery' }),
    },
    jointInspection: {
      findFirst: async () => ({
        id: 'insp-1',
        projectId: 'proj-1',
        stage: 'pre_construction',
        status: 'scheduled',
        participatingApprovals: [
          { approvalCode: 'MPCB-CTE-001' },
          { approvalCode: 'FIRE-PROVISIONAL-001' },
        ],
        inspectorChecklists: [],
      }),
      update: async ({ data }: any) => ({
        id: 'insp-1',
        status: data.status,
        jointReportSummary: data.jointReportSummary,
      }),
    },
    jointInspectionApproval: {
      findMany: async () => [
        { approvalCode: 'MPCB-CTE-001' },
        { approvalCode: 'FIRE-PROVISIONAL-001' },
      ],
    },
    approvalInstance: {
      findFirst: async ({ where }: any) => {
        const code = where.approvalDefinition.code;
        return {
          id: `inst-${code}`,
          projectId: 'proj-1',
          approvalDefinitionId: `def-${code}`,
          status: 'in_progress',
        };
      },
      update: async ({ where, data }: any) => {
        updatedInstances.push({ id: where.id, data });
        return { id: where.id, ...data };
      },
    },
  };

  const mockRoadmap: any = {
    unlockDependents: async (_projId: string, defId: string) => {
      unlockedDefId = defId;
      return [];
    },
  };

  const service = new InspectionsService(mockPrisma, mockRoadmap);
  const result = await service.completeInspection('proj-1', 'insp-1', {
    jointReportSummary: 'Site passed all fire and pollution checks.',
  });

  assert.equal(result.status, 'completed');
  assert.equal(updatedInstances.length, 2, 'Should mark both participating approvals done');
  assert.ok(updatedInstances.every((inst) => inst.data.status === 'done'));
  assert.ok(unlockedDefId !== null, 'Should have triggered unlockDependents');
});

test('InspectionsService: multi-department slot negotiation reaches consensus and auto-schedules', async () => {
  let storedInspection: any = {
    id: 'insp-slot-1',
    projectId: 'proj-1',
    status: 'draft',
    inspectorChecklists: [
      { authorityCode: 'AUTH-MPCB' },
      { authorityCode: 'AUTH-FIRE' },
    ],
    participatingApprovals: [],
    slotNegotiation: null,
  };

  const mockPrisma: any = {
    project: { findUnique: async () => ({ id: 'proj-1' }) },
    jointInspection: {
      findFirst: async () => storedInspection,
      update: async ({ data }: any) => {
        storedInspection = { ...storedInspection, ...data };
        return storedInspection;
      },
    },
  };

  const service = new InspectionsService(mockPrisma, null as any);

  // 1. Applicant proposes 2 slots
  const proposed = await service.proposeSlots('proj-1', 'insp-slot-1', {
    slots: [
      { slotId: 'slot-101', date: '2026-10-20', timeWindow: '10:00 AM - 01:00 PM' },
      { slotId: 'slot-102', date: '2026-10-22', timeWindow: '02:00 PM - 05:00 PM' },
    ],
  });
  assert.equal(proposed.slotNegotiation.status, 'pending_officer_responses');

  // 2. MPCB confirms slot-101
  await service.respondSlot('proj-1', 'insp-slot-1', {
    authorityCode: 'AUTH-MPCB',
    slotId: 'slot-101',
    status: 'confirmed' as any,
  });
  assert.equal(storedInspection.slotNegotiation.status, 'in_negotiation');
  assert.equal(storedInspection.status, 'draft');

  // 3. Fire confirms slot-101 (Consensus reached!)
  const consensusResult = await service.respondSlot('proj-1', 'insp-slot-1', {
    authorityCode: 'AUTH-FIRE',
    slotId: 'slot-101',
    status: 'confirmed' as any,
  });

  assert.equal(consensusResult.slotNegotiation.status, 'consensus_reached');
  assert.equal(consensusResult.slotNegotiation.consensusSlotId, 'slot-101');
  assert.equal(consensusResult.status, 'scheduled');
  assert.equal(consensusResult.timeSlot, '10:00 AM - 01:00 PM');
});

test('InspectionsService: rectification lifecycle: flagged item -> applicant submits proof -> officer review clears inspection', async () => {
  let checklistStatus = 'needs_rectification';
  let inspectionStatus = 'in_progress';
  let unlockedDef = false;

  const mockPrisma: any = {
    project: { findUnique: async () => ({ id: 'proj-1' }) },
    jointInspection: {
      findFirst: async () => ({
        id: 'insp-rect-1',
        projectId: 'proj-1',
        status: inspectionStatus,
        inspectorChecklists: [
          { id: 'chk-1', authorityCode: 'AUTH-FIRE', status: checklistStatus },
        ],
        participatingApprovals: [{ approvalCode: 'FIRE-FINAL-001' }],
      }),
      update: async ({ data }: any) => {
        if (data.status) inspectionStatus = data.status;
        return {
          id: 'insp-rect-1',
          status: inspectionStatus,
          rectificationPlan: data.rectificationPlan,
          inspectorChecklists: [{ id: 'chk-1', authorityCode: 'AUTH-FIRE', status: checklistStatus }],
          participatingApprovals: [{ approvalCode: 'FIRE-FINAL-001' }],
        };
      },
    },
    jointInspectorChecklist: {
      findFirst: async () => ({
        id: 'chk-1',
        authorityCode: 'AUTH-FIRE',
        status: checklistStatus,
      }),
      update: async ({ data }: any) => {
        checklistStatus = data.status;
        return { id: 'chk-1', authorityCode: 'AUTH-FIRE', status: checklistStatus };
      },
      findMany: async () => [
        { id: 'chk-1', authorityCode: 'AUTH-FIRE', status: checklistStatus },
      ],
    },
    jointInspectionApproval: {
      findMany: async () => [{ approvalCode: 'FIRE-FINAL-001' }],
    },
    approvalInstance: {
      findFirst: async () => ({ id: 'inst-fire', approvalDefinitionId: 'def-fire', status: 'in_progress' }),
      update: async () => ({ id: 'inst-fire', status: 'done' }),
    },
  };

  const mockRoadmap: any = {
    unlockDependents: async () => {
      unlockedDef = true;
      return [];
    },
  };

  const service = new InspectionsService(mockPrisma, mockRoadmap);

  // 1. Applicant submits rectification
  const submitted = await service.submitRectification('proj-1', 'insp-rect-1', {
    authorityCode: 'AUTH-FIRE',
    itemsResolved: [
      {
        item: 'Main gate width >= 6.0 meters',
        actionTaken: 'Expanded gate to 6.2m and cleared overhead height.',
      },
    ],
    complianceDeclaration: 'All items rectified as per fire guidelines.',
  });

  assert.equal(submitted.rectificationPlan.status, 'awaiting_re_evaluation');
  assert.equal(submitted.rectificationPlan.submissions.length, 1);

  // 2. Officer reviews and approves rectification
  const reviewResult = await service.reviewRectification('proj-1', 'insp-rect-1', {
    authorityCode: 'AUTH-FIRE',
    status: 'satisfactory' as any,
    reInspectionRequired: false,
    reviewNotes: 'Photo inspection verified satisfactory.',
  });

  assert.equal(checklistStatus, 'satisfactory');
  assert.equal(reviewResult.status, 'completed');
  assert.ok(unlockedDef, 'Should have unlocked downstream roadmap nodes');
});
