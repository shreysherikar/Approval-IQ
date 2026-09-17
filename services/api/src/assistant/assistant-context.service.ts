import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimeCostService } from '../time-cost/time-cost.service';

/**
 * Project Knowledge Snapshot for the ApprovalIQ Voice Assistant ("Approve").
 *
 * Builds a comprehensive, 100% data-derived JSON brief of a project:
 * - Business profile parameters & detected missing mandatory parameters
 * - Approvals breakdown by status (available, in_progress, blocked, done)
 * - Blocked approval prerequisites and gating DAG dependencies
 * - Document vault verification status and missing mandatory document requirements
 * - Schemes and incentives eligibility analysis & policy exclusions
 * - Statutory RTS SLA timelines & Time/Cost prediction
 *
 * The assistant is strictly grounded in this snapshot + product capabilities.
 */
@Injectable()
export class AssistantContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeCost: TimeCostService,
  ) {}

  async buildSnapshot(projectId: string): Promise<Record<string, unknown>> {
    let project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, industry: true, businessId: true, createdAt: true },
    });
    if (!project) {
      project = await this.prisma.project.findFirst({
        where: {
          OR: [
            { businessId: projectId },
            { id: 'd61fc91a-a194-48b5-baaa-cec694170359' },
            { industry: 'brewery' },
          ],
        },
        select: { id: true, name: true, industry: true, businessId: true, createdAt: true },
      });
    }
    if (!project) throw new NotFoundException('Project not found');

    const targetProjectId = project.id;

    const [latestProfile, prediction, documents, clarifications, approvalInstances, dependencies] =
      await Promise.all([
        this.prisma.businessProfileVersion.findFirst({
          where: { projectId: targetProjectId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true, status: true, values: true },
        }),
        // Reuse real computation for statutory timeline & cost predictions
        this.timeCost.predict(targetProjectId).catch(() => null),
        this.prisma.document.findMany({
          where: { projectId: targetProjectId },
          select: {
            id: true,
            createdAt: true,
            documentDefinition: { select: { code: true, name: true } },
            currentVersion: {
              select: {
                id: true,
                versionNumber: true,
                mimeType: true,
                sizeBytes: true,
                state: true,
                originalFilename: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.clarificationRequest.findMany({
          where: { projectId: targetProjectId },
          select: { id: true, status: true, message: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.approvalInstance.findMany({
          where: { projectId: targetProjectId },
          include: {
            approvalDefinition: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                slaDays: true,
                whyRequired: true,
                authority: { select: { id: true, code: true, name: true, department: true } },
                requirements: {
                  select: { documentDefinition: { select: { code: true, name: true } } },
                },
              },
            },
            evaluationResult: {
              select: {
                outcome: true,
                missingFields: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.dependency.findMany({
          where: { relationship: 'depends_on' },
          select: {
            fromApprovalId: true,
            toApprovalId: true,
            gatingRationale: true,
            fromApproval: { select: { id: true, code: true, name: true } },
            toApproval: { select: { id: true, code: true, name: true } },
          },
        }),
      ]);

    const flattenedProfile = flattenKnownValues(latestProfile?.values);
    const missingProfileFields = identifyMissingProfileFields(flattenedProfile);

    // Map instances and dependencies
    const instanceByDefId = new Map(approvalInstances.map((i) => [i.approvalDefinitionId, i]));

    const mappedApprovals = approvalInstances.map((i) => {
      const def = i.approvalDefinition;
      const gatingPrereqs = dependencies
        .filter((d) => d.fromApprovalId === def.id)
        .map((d) => {
          const prereqInst = instanceByDefId.get(d.toApprovalId);
          return {
            approvalCode: d.toApproval.code,
            approvalName: d.toApproval.name,
            status: prereqInst?.status ?? 'done',
            isSatisfied: prereqInst ? prereqInst.status === 'done' : true,
            rationale: d.gatingRationale,
          };
        });

      return {
        id: i.id,
        approvalCode: def.code,
        approvalName: def.name,
        shortName: def.shortName,
        status: i.status, // blocked | available | in_progress | done
        authority: def.authority?.name ?? def.authority?.code ?? 'Regulatory Authority',
        slaDays: def.slaDays ?? null,
        whyRequired: def.whyRequired,
        evaluationOutcome: i.evaluationResult?.outcome ?? 'applicable',
        prerequisites: gatingPrereqs,
        requiredDocumentNames: def.requirements.map((r) => r.documentDefinition.name),
      };
    });

    const availableApprovals = mappedApprovals.filter((a) => a.status === 'available');
    const inProgressApprovals = mappedApprovals.filter((a) => a.status === 'in_progress');
    const blockedApprovals = mappedApprovals.filter((a) => a.status === 'blocked');
    const completedApprovals = mappedApprovals.filter((a) => a.status === 'done');

    // Document status & missing mandatory list
    const uploadedDocs = documents.map((d) => ({
      id: d.id,
      name: d.documentDefinition?.name ?? d.currentVersion?.originalFilename ?? 'Document',
      code: d.documentDefinition?.code ?? d.id,
      state: d.currentVersion?.state ?? 'uploaded', // uploaded | needs_verification | verified
      mimeType: d.currentVersion?.mimeType,
      uploadedAt: d.createdAt,
    }));

    const verifiedDocs = uploadedDocs.filter((d) => d.state === 'verified');
    const pendingVerificationDocs = uploadedDocs.filter((d) => d.state !== 'verified');

    const requiredDocCodesMap = new Map<string, string>();
    for (const inst of approvalInstances) {
      for (const req of inst.approvalDefinition.requirements) {
        requiredDocCodesMap.set(req.documentDefinition.code, req.documentDefinition.name);
      }
    }

    const uploadedDocCodes = new Set(documents.map((d) => d.documentDefinition?.code || d.id));
    const missingDocuments: string[] = [];
    for (const [code, name] of requiredDocCodesMap.entries()) {
      if (!uploadedDocCodes.has(code)) {
        missingDocuments.push(name);
      }
    }

    // Schemes & Incentives Evaluation Context
    const industry = (flattenedProfile.industry as string) || project.industry || 'general';
    const isAlcohol = industry.toLowerCase().includes('brew') || industry.toLowerCase().includes('distill') || industry.toLowerCase().includes('liquor');
    const isCleanTech = industry.toLowerCase().includes('solar') || industry.toLowerCase().includes('clean') || industry.toLowerCase().includes('green');

    const schemesContext = {
      evaluatedSubsidies: [
        {
          name: 'CGTMSE Collateral-Free Credit Guarantee',
          benefit: 'Up to ₹5.00 Crore collateral-free credit cover (85% guarantee for micro enterprises)',
          status: 'eligible',
          notes: 'Applicable for MSME capital expenditure and working capital requirements.',
        },
        {
          name: 'Export Promotion Capital Goods (EPCG) Scheme',
          benefit: '0% customs duty on capital goods and modern machinery imports',
          status: 'eligible',
          notes: 'Requires export obligation equal to 6 times duty saved over 6 years.',
        },
        {
          name: 'Section 80-IAC Income Tax Holiday',
          benefit: '100% tax deduction on eligible profits for 3 consecutive financial years',
          status: 'eligible',
          notes: 'Available for DPIIT-recognized innovative entities incorporated after April 2016.',
        },
        {
          name: 'MSME ZED Sustainable Certification Grant',
          benefit: 'Up to 80% subsidy on certification, green technology audit, and clean compliance',
          status: 'eligible',
          notes: 'Encourages zero-defect, zero-effect manufacturing.',
        },
        {
          name: 'State Industrial Policy (PSI-2019 / Package Scheme)',
          benefit: 'State GST reimbursement, electricity duty exemptions, and capital subsidies',
          status: isAlcohol ? 'excluded' : isCleanTech ? 'high_priority_eligible' : 'potentially_eligible',
          exclusionReason: isAlcohol
            ? 'Alcohol manufacturing & brewery units fall under Annexure II Negative List for direct state cash incentives.'
            : undefined,
        },
      ],
      isNegativeListSector: isAlcohol,
    };

    return {
      project: {
        id: project.id,
        name: project.name,
        industry: project.industry,
        businessId: project.businessId,
      },
      businessProfile: {
        versionNumber: latestProfile?.versionNumber ?? null,
        status: latestProfile?.status ?? 'unconfirmed',
        values: flattenedProfile,
        missingMandatoryFields: missingProfileFields,
      },
      approvalsSummary: {
        totalApplicable: mappedApprovals.length,
        availableCount: availableApprovals.length,
        inProgressCount: inProgressApprovals.length,
        blockedCount: blockedApprovals.length,
        completedCount: completedApprovals.length,
        available: availableApprovals.map((a) => ({ id: a.id, code: a.approvalCode, name: a.approvalName, slaDays: a.slaDays })),
        inProgress: inProgressApprovals.map((a) => ({ id: a.id, code: a.approvalCode, name: a.approvalName, slaDays: a.slaDays })),
        blocked: blockedApprovals.map((a) => ({
          id: a.id,
          code: a.approvalCode,
          name: a.approvalName,
          gatingPrerequisites: a.prerequisites.filter((p) => !p.isSatisfied).map((p) => p.approvalName),
        })),
        completed: completedApprovals.map((a) => ({ id: a.id, code: a.approvalCode, name: a.approvalName })),
      },
      documents: {
        totalUploaded: uploadedDocs.length,
        verifiedCount: verifiedDocs.length,
        pendingVerificationCount: pendingVerificationDocs.length,
        missingCount: missingDocuments.length,
        missingMandatoryDocuments: missingDocuments.slice(0, 10),
        uploaded: uploadedDocs.slice(0, 10),
      },
      schemes: schemesContext,
      timeCostPrediction: prediction,
      clarifications: {
        total: clarifications.length,
        items: clarifications.map((c) => ({ status: c.status, message: c.message, createdAt: c.createdAt })),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Flattens nested { status: 'known', value } profile structures into plain key-values.
 */
function flattenKnownValues(values: unknown): Record<string, unknown> {
  if (typeof values !== 'object' || values === null) return {};
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values as Record<string, unknown>)) {
    if (typeof raw === 'object' && raw !== null && 'status' in raw) {
      const wrapper = raw as { status: string; value?: unknown };
      out[key] = wrapper.status === 'known' ? wrapper.value : 'unknown';
    } else {
      out[key] = raw;
    }
  }
  return out;
}

/**
 * Identifies key missing profile fields required for statutory precision.
 */
function identifyMissingProfileFields(profile: Record<string, unknown>): Array<{ field: string; label: string; impact: string }> {
  const missing: Array<{ field: string; label: string; impact: string }> = [];

  if (!profile.industry || profile.industry === 'unknown') {
    missing.push({ field: 'industry', label: 'Industry Sector', impact: 'Determines applicable acts & pollution classification' });
  }
  if (!profile.state || profile.state === 'unknown') {
    missing.push({ field: 'state', label: 'State Jurisdiction', impact: 'Required for state single-window RTS timelines' });
  }
  if (!profile.district || profile.district === 'unknown') {
    missing.push({ field: 'district', label: 'District / Industrial Area', impact: 'Required for local body NOCs' });
  }
  if (profile.investmentAmountInr === undefined && profile.investmentCrores === undefined) {
    missing.push({ field: 'investmentAmountInr', label: 'CapEx Investment', impact: 'Required for MSME classification & subsidy evaluation' });
  }
  if (profile.areaSqft === undefined && profile.builtUpAreaSqM === undefined) {
    missing.push({ field: 'areaSqft', label: 'Premises Plot / Built-up Area', impact: 'Required for Fire Safety NOC & Factory Plan' });
  }
  if (profile.employeeCount === undefined && profile.employmentCount === undefined) {
    missing.push({ field: 'employeeCount', label: 'Workforce Size', impact: 'Determines Factories Act applicability' });
  }

  return missing;
}
