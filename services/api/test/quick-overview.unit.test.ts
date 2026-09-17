import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RoadmapService } from '../src/roadmap/roadmap.service';

describe('AI Quick Overview Service Unit Tests', () => {
  it('returns isReady: false when core profile details are missing', async () => {
    // Mock PrismaService
    const mockPrisma: any = {
      project: {
        findUnique: async () => ({
          id: 'proj-empty-01',
          name: 'Empty Project Unit',
          industry: '',
          businessId: 'biz-01',
          profiles: [{ values: {} }],
          documents: [],
        }),
        findFirst: async () => ({
          id: 'proj-empty-01',
          name: 'Empty Project Unit',
        }),
      },
      knowledgeRelease: {
        findFirst: async () => ({ id: 'kr-01', version: '2.4.0' }),
      },
    };

    const service = new RoadmapService(mockPrisma);
    const res = await service.getQuickOverview('proj-empty-01');

    assert.equal(res.isReady, false);
    assert.equal(res.projectId, 'proj-empty-01');
    assert.ok(Array.isArray(res.missingInformation));
    assert.ok((res.missingInformation as any[]).some((m) => m.field === 'industry'));
    assert.ok((res.missingInformation as any[]).some((m) => m.field === 'state'));
    assert.ok((res.missingInformation as any[]).some((m) => m.field === 'district'));
    assert.equal(res.nextSteps[0]?.actionRoute, '/projects/proj-empty-01/profile');
  });

  it('correctly aggregates facts, available/blocked approvals, schemes, and documents for a configured project', async () => {
    const mockPrisma: any = {
      project: {
        findUnique: async () => ({
          id: 'proj-pune-01',
          name: 'Pune Advanced Brewery',
          industry: 'brewery',
          businessId: 'biz-01',
          profiles: [
            {
              versionNumber: 1,
              values: {
                industry: { status: 'known', value: 'brewery' },
                state: { status: 'known', value: 'Maharashtra' },
                district: { status: 'known', value: 'Pune' },
                investmentAmountInr: { status: 'known', value: 250000000 },
                employeeCount: { status: 'known', value: 85 },
                areaSqft: { status: 'known', value: 35000 },
                activityType: { status: 'known', value: 'Craft beer brewing & bottling line' },
              },
            },
          ],
          documents: [
            {
              id: 'doc-01',
              documentDefinition: { code: 'DOC-TITLE-DEED', name: 'Title Deed' },
              currentVersion: { state: 'verified' },
            },
          ],
        }),
        findFirst: async () => ({
          id: 'proj-pune-01',
          name: 'Pune Advanced Brewery',
        }),
      },
      approvalInstance: {
        findMany: async () => [],
        findFirst: async () => null,
      },
      dependency: {
        findMany: async () => [],
      },
      evaluationRun: {
        findFirst: async () => null,
      },
      knowledgeRelease: {
        findFirst: async () => ({ id: 'kr-01', version: '2.4.0' }),
      },
    };

    const service = new RoadmapService(mockPrisma);
    const res = await service.getQuickOverview('proj-pune-01');

    assert.equal(res.isReady, true);
    assert.equal(res.projectId, 'proj-pune-01');
    assert.equal(res.businessContext.industry, 'brewery');
    assert.equal(res.businessContext.location, 'Pune, Maharashtra');
    assert.ok(res.summary.length > 10);
    assert.ok(Array.isArray(res.keyHighlights));
    assert.ok(res.keyHighlights.length >= 3);
    assert.ok(Array.isArray(res.nextSteps));
    assert.ok(res.nextSteps.length >= 2);
    // Verify actionable routes
    assert.ok(res.nextSteps.some((s) => s.actionRoute.includes('/roadmap')));
    assert.ok(res.nextSteps.some((s) => s.actionRoute.includes('/schemes')));
    // Verify documents structure
    assert.equal(res.documents.uploadedCount, 1);
    assert.equal(res.documents.verifiedCount, 1);
  });

  it('adapts dynamically when location or industry changes without hardcoded values', async () => {
    const mockPrisma: any = {
      project: {
        findUnique: async () => ({
          id: 'proj-solar-01',
          name: 'Ahmedabad Clean Energy Park',
          industry: 'solar_manufacturing',
          businessId: 'biz-02',
          profiles: [
            {
              versionNumber: 1,
              values: {
                industry: { status: 'known', value: 'solar_manufacturing' },
                state: { status: 'known', value: 'Gujarat' },
                district: { status: 'known', value: 'Ahmedabad' },
                investmentAmountInr: { status: 'known', value: 500000000 },
                employeeCount: { status: 'known', value: 120 },
                areaSqft: { status: 'known', value: 75000 },
                activityType: { status: 'known', value: 'Photovoltaic Solar Panel Fabrication' },
              },
            },
          ],
          documents: [],
        }),
        findFirst: async () => ({
          id: 'proj-solar-01',
          name: 'Ahmedabad Clean Energy Park',
        }),
      },
      approvalInstance: {
        findMany: async () => [],
        findFirst: async () => null,
      },
      dependency: {
        findMany: async () => [],
      },
      evaluationRun: {
        findFirst: async () => null,
      },
      knowledgeRelease: {
        findFirst: async () => ({ id: 'kr-01', version: '2.4.0' }),
      },
    };

    const service = new RoadmapService(mockPrisma);
    const res = await service.getQuickOverview('proj-solar-01');

    assert.equal(res.isReady, true);
    assert.equal(res.businessContext.location, 'Ahmedabad, Gujarat');
    assert.equal(res.businessContext.industry, 'solar_manufacturing');
    assert.equal(res.businessContext.investmentFormatted, '₹50.00 Cr');
  });
});
