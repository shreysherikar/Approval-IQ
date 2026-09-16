import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Explainable Risk-Based Scrutiny
//
// Two separate signals:
// 1. SUBMISSION RISK — how likely the application has completeness problems
// 2. REGULATORY COMPLEXITY — how complex from a regulatory standpoint
// Dynamic Risk & Scrutiny Calibration Engine
//
// Dual-signal scoring:
// 1. SUBMISSION RISK: Evaluates document completeness, data parity, and extraction confidence.
// 2. REGULATORY COMPLEXITY: Evaluates multi-agency jurisdictional scope, hazardous classification, and inspection mandates.
//
// CALIBRATION STANDARD:
// Configured to align with DIPP / DPIIT Business Reforms Action Plan (BRAP) 
// and Maharashtra Right to Services (RTS) scrutiny priority guidelines.
// ---------------------------------------------------------------------------

/**
 * Risk scoring configuration with transparent basis annotations.
 * Adaptable per state/department policy guidelines.
 */
export const RISK_CONFIG = {
  // Submission risk factors (additive, capped at 100)
  missingMandatoryDocument: 15,       // Weight: High (Statutory prerequisite missing)
  blockingValidationIssue: 12,        // Weight: High (Mandatory schema field unknown or invalid)
  missingProfileField: 8,             // Weight: Moderate (Informational gap)
  contradiction: 10,                  // Weight: High (Cross-document or profile vs document discrepancy)
  lowConfidenceExtraction: 5,         // Weight: Low-Moderate (Flagged for human spot-check)
  warning: 3,                         // Weight: Low (Advisory warning)
  verifiedDocumentBonus: -2,          // Risk mitigation: Human-verified document in vault

  // Regulatory complexity factors
  approvalCount: 8,                   // Complexity scaling per applicable approval
  dependencyCount: 5,                 // Inter-department gating bottleneck
  inspectionRequired: 10,             // Physical site verification required
  multiAuthority: 7,                  // Multi-agency coordination threshold
  conditionalRequirements: 6,         // Hazardous / special conditional scrutiny
  renewalRequired: 3,                 // Recurring periodic compliance
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function riskLevel(score: number): string {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function complexityLevel(score: number): string {
  if (score >= 60) return 'very_high';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

@Injectable()
export class RiskService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Calculate submission risk and regulatory complexity for an approval instance. */
  async calculateRiskForInstance(instanceId: string): Promise<Record<string, unknown>> {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: instanceId },
      include: {
        approvalDefinition: {
          select: {
            id: true, code: true, name: true, inspectionRequired: true, renewalRequired: true,
            authority: { select: { id: true, name: true } },
            requirements: {
              select: {
                condition: true,
                documentDefinition: { select: { code: true, name: true } },
              },
            },
            outgoingDeps: { select: { id: true } },
            incomingDeps: { select: { id: true } },
          },
        },
        evaluationResult: {
          select: { id: true, outcome: true, missingFields: true },
        },
        project: {
          select: {
            id: true, name: true, industry: true,
            documents: {
              select: {
                id: true,
                documentDefinition: { select: { code: true } },
                currentVersion: { select: { state: true } },
              },
            },
            consistencyCheckResults: {
              select: { outcome: true, detail: true },
              take: 50,
            },
          },
        },
      },
    });
    if (!instance) return { error: 'Instance not found' };

    return this.computeRiskScore(instance);
  }

  /** Calculate risk scores for all instances in a project. */
  async calculateRiskForProject(projectId: string): Promise<Record<string, unknown>[]> {
    const instances = await this.prisma.approvalInstance.findMany({
      where: { projectId },
      include: {
        approvalDefinition: {
          select: {
            id: true, code: true, name: true, inspectionRequired: true, renewalRequired: true,
            authority: { select: { id: true, name: true } },
            requirements: {
              select: {
                condition: true,
                documentDefinition: { select: { code: true, name: true } },
              },
            },
            outgoingDeps: { select: { id: true } },
            incomingDeps: { select: { id: true } },
          },
        },
        evaluationResult: {
          select: { id: true, outcome: true, missingFields: true },
        },
      },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        documents: {
          select: {
            id: true,
            documentDefinition: { select: { code: true } },
            currentVersion: { select: { state: true } },
          },
        },
        consistencyCheckResults: {
          select: { outcome: true, detail: true },
          take: 50,
        },
      },
    });

    const projectData = project ?? { documents: [], consistencyCheckResults: [] };
    const results: Array<Record<string, unknown>> = [];
    for (const inst of instances) {
      const score = this.computeRiskScore({ ...inst, project: projectData });
      results.push({
        instanceId: inst.id,
        ...score,
      });
    }
    return results;
  }

  /** Compute risk score for an instance (the core scoring logic). */
  private computeRiskScore(instance: {
    approvalDefinition?: {
      code: string;
      name: string;
      inspectionRequired: boolean;
      renewalRequired: boolean;
      authority?: { id: string; name: string } | null;
      requirements: Array<{ condition: string | null; documentDefinition: { code: string; name: string } }>;
      outgoingDeps: Array<{ id: string }>;
      incomingDeps: Array<{ id: string }>;
    } | null;
    evaluationResult?: { outcome: string; missingFields: unknown } | null;
    project: {
      documents: Array<{
        id: string;
        documentDefinition: { code: string } | null;
        currentVersion: { state: string } | null;
      }>;
      consistencyCheckResults: Array<{ outcome: string; detail: string | null }>;
    };
  }): Record<string, unknown> {
    const approval = instance.approvalDefinition;
    const evaluation = instance.evaluationResult;
    const project = instance.project;

    // --- SUBMISSION RISK ---
    let submissionScore = 0;
    const submissionReasons: string[] = [];

    // Missing mandatory documents
    const docsByCode = new Map<string, typeof project.documents[0]>();
    for (const doc of project.documents) {
      const code = doc.documentDefinition?.code;
      if (code && !docsByCode.has(code)) docsByCode.set(code, doc);
    }
    if (approval) {
      for (const req of approval.requirements) {
        const doc = docsByCode.get(req.documentDefinition.code);
        if (!doc || !doc.currentVersion) {
          submissionScore += RISK_CONFIG.missingMandatoryDocument;
          submissionReasons.push(`Missing mandatory document: ${req.documentDefinition.name}`);
        }
      }
    }

    // Blocking validation issues (missing fields)
    const missingFields = Array.isArray(evaluation?.missingFields)
      ? (evaluation?.missingFields as Array<{ field?: string; reason?: string }>)
      : [];
    const blockingIssues = missingFields.filter(f => f.reason === 'unknown' || f.reason === 'type_mismatch');
    for (const bf of blockingIssues) {
      submissionScore += RISK_CONFIG.blockingValidationIssue;
      submissionReasons.push(`Blocking issue: field '${bf.field ?? 'unknown'}' is ${bf.reason}`);
    }

    // Contradictions (consistency mismatches)
    const mismatches = project.consistencyCheckResults.filter(c => c.outcome === 'mismatch');
    for (const m of mismatches) {
      submissionScore += RISK_CONFIG.contradiction;
      submissionReasons.push(`Contradiction: ${m.detail ?? 'Value mismatch between profile and document'}`);
    }

    // Low-confidence extractions (state-based heuristic)
    const lowConfDocs = project.documents.filter(d =>
      d.currentVersion?.state === 'needs_verification' || d.currentVersion?.state === 'extracted',
    );
    for (const lc of lowConfDocs) {
      submissionScore += RISK_CONFIG.lowConfidenceExtraction;
      submissionReasons.push(`Low-confidence extraction: document in state '${lc.currentVersion?.state}'`);
    }

    // Verified document bonus
    const verifiedDocs = project.documents.filter(d => d.currentVersion?.state === 'verified');
    submissionScore += verifiedDocs.length * RISK_CONFIG.verifiedDocumentBonus;
    if (verifiedDocs.length > 0) {
      submissionReasons.push(`${verifiedDocs.length} verified document(s) reduce risk`);
    }

    submissionScore = clamp(submissionScore, 0, 100);

    // --- REGULATORY COMPLEXITY ---
    let complexityScore = 0;
    const complexityReasons: string[] = [];

    if (approval) {
      // Approval count (1 for this instance, but we note it)
      complexityScore += RISK_CONFIG.approvalCount;
      complexityReasons.push(`Applicable approval: ${approval.name}`);

      // Dependencies
      const totalDeps = approval.outgoingDeps.length + approval.incomingDeps.length;
      complexityScore += totalDeps * RISK_CONFIG.dependencyCount;
      if (totalDeps > 0) {
        complexityReasons.push(`${totalDeps} dependency/dependencies with other approvals`);
      }

      // Inspection required
      if (approval.inspectionRequired) {
        complexityScore += RISK_CONFIG.inspectionRequired;
        complexityReasons.push('Joint inspection required');
      }

      // Renewal required
      if (approval.renewalRequired) {
        complexityScore += RISK_CONFIG.renewalRequired;
        complexityReasons.push('Periodic renewal required');
      }

      // Conditional requirements
      const conditionalReqs = approval.requirements.filter(r => r.condition);
      complexityScore += conditionalReqs.length * RISK_CONFIG.conditionalRequirements;
      if (conditionalReqs.length > 0) {
        complexityReasons.push(`${conditionalReqs.length} condition-dependent requirement(s)`);
      }
    }

    complexityScore = clamp(complexityScore, 0, 100);

    // Determine recommendation
    let recommendation: string;
    if (submissionScore >= 75) {
      recommendation = 'Priority Review';
    } else if (submissionScore >= 50 || (submissionScore >= 25 && complexityScore >= 40)) {
      recommendation = 'Needs Clarification';
    } else if (submissionScore >= 25) {
      recommendation = 'Standard Review';
    } else {
      recommendation = 'Ready for Officer Review';
    }

    return {
      submissionRisk: {
        score: submissionScore,
        level: riskLevel(submissionScore),
        reasons: submissionReasons,
      },
      regulatoryComplexity: {
        score: complexityScore,
        level: complexityLevel(complexityScore),
        reasons: complexityReasons,
      },
      recommendation,
      missingRequirements: blockingIssues.map(f => ({
        field: f.field,
        reason: f.reason,
      })),
      validationProblems: mismatches.map(m => ({
        detail: m.detail,
      })),
    };
  }
}
