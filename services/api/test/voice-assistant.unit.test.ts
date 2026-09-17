import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { offlineAnswer } from '../src/assistant/assistant.service';

describe('Voice Assistant ("Approve") Unit Tests', () => {
  const mockSnapshot: Record<string, unknown> = {
    project: {
      id: 'prj-test-123',
      name: 'Pune Craft Brewery',
      industry: 'brewery',
      businessId: 'biz-test-01',
    },
    businessProfile: {
      versionNumber: 1,
      status: 'confirmed',
      values: {
        industry: 'brewery',
        state: 'Maharashtra',
        district: 'Pune',
        investmentAmountInr: 250000000,
        areaSqft: 6000,
        employeeCount: 45,
      },
      missingMandatoryFields: [],
    },
    approvalsSummary: {
      totalApplicable: 12,
      availableCount: 7,
      inProgressCount: 2,
      blockedCount: 3,
      completedCount: 0,
      available: [
        { id: 'inst-1', code: 'MPCB-CTE', name: 'Consent to Establish (MPCB)', slaDays: 60 },
        { id: 'inst-2', code: 'FIRE-PROV', name: 'Provisional Fire NOC', slaDays: 30 },
      ],
      inProgress: [
        { id: 'inst-3', code: 'EXCISE-FL', name: 'Excise Brewery Licence', slaDays: 45 },
      ],
      blocked: [
        {
          id: 'inst-4',
          code: 'MPCB-CTO',
          name: 'Consent to Operate (MPCB)',
          gatingPrerequisites: ['Consent to Establish (MPCB)'],
        },
        {
          id: 'inst-5',
          code: 'FACTORY-LIC',
          name: 'Factory Operating Licence',
          gatingPrerequisites: ['Factory Plan Approval'],
        },
      ],
      completed: [],
    },
    documents: {
      totalUploaded: 2,
      verifiedCount: 1,
      pendingVerificationCount: 1,
      missingCount: 8,
      missingMandatoryDocuments: ['Form BRA Application', 'Factory Plan Drawing', 'Solvency Certificate'],
      uploaded: [],
    },
    schemes: {
      isNegativeListSector: true,
      evaluatedSubsidies: [
        { name: 'CGTMSE', benefit: '₹5.00 Cr Guarantee', status: 'eligible' },
        { name: 'PSI-2019', benefit: 'State GST Refund', status: 'excluded', exclusionReason: 'Annexure II Negative List' },
      ],
    },
    timeCostPrediction: {
      time: { estimatedMinWorkingDays: 95, estimatedMaxWorkingDays: 130, criticalPath: ['MPCB-CTE', 'MPCB-CTO'] },
      cost: { total: { min: 250000, max: 400000 } },
    },
  };

  it('answers "What is pending?" with accurate live counts and navigates to roadmap', () => {
    const res = offlineAnswer(mockSnapshot, 'What is pending on my dashboard?');
    assert.ok(res.spokenText.includes('12 total applicable approvals'));
    assert.ok(res.spokenText.includes('7 ready'));
    assert.ok(res.spokenText.includes('3 blocked'));
    assert.equal(res.actions?.[0]?.target, 'roadmap');
  });

  it('answers "Why are approvals blocked?" citing the exact prerequisite dependency', () => {
    const res = offlineAnswer(mockSnapshot, 'Why is my approval blocked?');
    assert.ok(res.spokenText.includes('3 blocked'));
    assert.ok(res.spokenText.includes('Consent to Establish (MPCB)'));
    assert.equal(res.actions?.[0]?.target, 'roadmap');
  });

  it('answers "Which documents are missing?" with real vault deficit data', () => {
    const res = offlineAnswer(mockSnapshot, 'Which documents are missing?');
    assert.ok(res.spokenText.includes('8 missing mandatory documents'));
    assert.ok(res.spokenText.includes('Form BRA Application'));
    assert.equal(res.actions?.[0]?.target, 'vault');
  });

  it('answers schemes query with sector-aware policy exclusions and eligible financing', () => {
    const res = offlineAnswer(mockSnapshot, 'What schemes or incentives am I eligible for?');
    assert.ok(res.spokenText.includes('Annexure II'));
    assert.ok(res.spokenText.includes('CGTMSE'));
    assert.equal(res.actions?.[0]?.target, 'schemes');
  });

  it('identifies missing mandatory profile parameters when profile is incomplete', () => {
    const incompleteSnapshot = {
      ...mockSnapshot,
      businessProfile: {
        versionNumber: 1,
        status: 'draft',
        values: {},
        missingMandatoryFields: [
          { field: 'state', label: 'State Jurisdiction', impact: 'Required' },
          { field: 'district', label: 'District / Industrial Area', impact: 'Required' },
        ],
      },
    };
    const res = offlineAnswer(incompleteSnapshot, 'What information is missing from my profile?');
    assert.ok(res.spokenText.includes('2 essential parameters'));
    assert.ok(res.spokenText.includes('State Jurisdiction'));
    assert.equal(res.actions?.[0]?.target, 'profile');
  });

  it('handles navigation speech triggers safely with structured action envelopes', () => {
    const res = offlineAnswer(mockSnapshot, 'Take me to schemes and incentives');
    assert.ok(res.spokenText.includes('Schemes and Incentives'));
    assert.equal(res.actions?.[0]?.target, 'schemes');
    assert.equal(res.actions?.[0]?.type, 'navigate');
  });
});
