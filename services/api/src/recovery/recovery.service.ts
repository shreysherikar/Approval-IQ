import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Compliance Recovery Engine
//
// Consumes existing validation output (dry run / evaluation results) and
// generates a prioritized recovery plan with dependency-aware sequencing.
// ---------------------------------------------------------------------------

interface Issue {
  id: string;
  category: string;
  severity: 'blocking' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedApproval?: string | null;
  affectedDocument?: string | null;
  reason: string;
}

/** Classify a validation issue into a normalized category and severity. */
function classifyIssue(rawIssue: {
  code?: string | null;
  field?: string | null;
  reason?: string | null;
  detail?: string | null;
  status?: string | null;
  outcome?: string | null;
}): Issue {
  const code = rawIssue.code ?? '';
  const field = rawIssue.field ?? '';
  const reason = rawIssue.reason ?? '';
  const detail = rawIssue.detail ?? '';
  const status = rawIssue.status ?? '';

  // Missing mandatory document
  if (status === 'missing' || reason === 'missing' || code.startsWith('missing_')) {
    return {
      id: `issue-${Math.random().toString(36).slice(2, 10)}`,
      category: 'missing_mandatory_document',
      severity: 'blocking',
      title: `Missing required document: ${field || code}`,
      description: `A mandatory document is required but has not been uploaded. ${detail}`,
      affectedDocument: field || code,
      reason: `Missing mandatory document`,
    };
  }

  // Invalid/expired document
  if (status === 'needs_verification' || status === 'rejected' || reason === 'expired') {
    return {
      id: `issue-${Math.random().toString(36).slice(2, 10)}`,
      category: 'invalid_document',
      severity: 'high',
      title: `Document needs attention: ${field || code}`,
      description: `A document requires verification or has been rejected. ${detail}`,
      affectedDocument: field || code,
      reason: `Document state: ${status}`,
    };
  }

  // Low-confidence extraction
  if (reason === 'low_confidence' || reason === 'type_mismatch') {
    return {
      id: `issue-${Math.random().toString(36).slice(2, 10)}`,
      category: 'low_confidence_extraction',
      severity: 'medium',
      title: `Low confidence extraction: ${field}`,
      description: `Data extracted from a document has low confidence or type mismatch. ${detail}`,
      affectedDocument: field,
      reason: `Low confidence / type mismatch`,
    };
  }    // Missing business information
    if (reason === 'unknown') {
      return {
        id: `issue-${Math.random().toString(36).slice(2, 10)}`,
        category: 'missing_business_info',
        severity: 'blocking' as const,
        title: `Missing information: ${field}`,
        description: `Business profile field '${field}' is unknown. This information is needed for accurate evaluation. ${detail}`,
        affectedApproval: code || null,
        reason: `Field unknown`,
      };
    }

  // Contradictory information (consistency mismatch)
  if (reason === 'mismatch' || status === 'mismatch') {
    return {
      id: `issue-${Math.random().toString(36).slice(2, 10)}`,
      category: 'contradictory_information',
      severity: 'high',
      title: `Contradiction detected: ${field}`,
      description: `There is a contradiction between extracted data and the business profile. ${detail}`,
      affectedDocument: field,
      reason: `Mismatch between profile and document`,
    };
  }

  // Default: warning
  return {
    id: `issue-${Math.random().toString(36).slice(2, 10)}`,
    category: 'warning',
    severity: 'low',
    title: `Review needed: ${field || code || 'Unknown issue'}`,
    description: detail || reason || 'A review is recommended.',
    reason: reason || 'General review needed',
  };
}

/** Determine readiness level from issue counts. */
function computeReadiness(blocking: number, high: number, medium: number): string {
  if (blocking > 0) return 'not_ready';
  if (high > 0) return 'needs_attention';
  if (medium > 0) return 'almost_ready';
  return 'ready';
}

@Injectable()
export class RecoveryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Generate a recovery plan for a project's approval instance. */
  async generatePlan(projectId: string, approvalInstanceId?: string): Promise<Record<string, unknown>> {
    // Fetch the project and its latest confirmed profile
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true, name: true, industry: true,
        profiles: {
          where: { status: 'confirmed' },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { id: true, values: true },
        },
        documents: {
          select: {
            id: true,
            documentDefinitionId: true,
            documentDefinition: { select: { code: true, name: true } },
            currentVersion: {
              select: { id: true, state: true, originalFilename: true },
            },
          },
        },
      },
    });
    if (!project) throw new NotFoundException(`Project '${projectId}' not found`);

    // Get relevant approval instances
    const instanceWhere: Record<string, unknown> = { projectId };
    if (approvalInstanceId) instanceWhere.id = approvalInstanceId;

    const instances = await this.prisma.approvalInstance.findMany({
      where: instanceWhere,
      include: {
        approvalDefinition: {
          select: {
            id: true, code: true, name: true,
            requirements: {
              select: {
                condition: true,
                documentDefinition: { select: { code: true, name: true, documentType: true, reusability: true } },
              },
            },
          },
        },
        evaluationResult: {
          select: { id: true, outcome: true, missingFields: true },
        },
      },
    });

    const issues: Issue[] = [];

    // Analyze each approval instance
    for (const inst of instances) {
      const approval = inst.approvalDefinition;
      if (!approval) continue;

      // Check missing fields from evaluation
      const missingFields = Array.isArray(inst.evaluationResult?.missingFields)
        ? (inst.evaluationResult?.missingFields as Array<{ field?: string; reason?: string; detail?: string }>)
        : [];

      for (const mf of missingFields) {
      issues.push(classifyIssue({
        code: approval.code,
        field: mf.field ?? null,
        reason: mf.reason ?? null,
        detail: mf.detail ?? null,
        }));
      }

      // Check document requirements
      const requiredDocs = approval.requirements;
      for (const req of requiredDocs) {
        const docCode = req.documentDefinition.code;
        const hasDoc = project.documents.some(d =>
          d.documentDefinition?.code === docCode && d.currentVersion?.state !== 'superseded',
        );
        if (!hasDoc) {
          issues.push(classifyIssue({
            code: approval.code,
            field: docCode,
            reason: 'missing',
            detail: `Required document '${req.documentDefinition.name}' has not been uploaded.`,
            status: 'missing',
          }));
        }
      }

      // Check consistency warnings for this project
      const findings = await this.prisma.consistencyCheckResult.findMany({
        where: { projectId },
        select: { outcome: true, detail: true, profileField: true, documentField: true },
      });
      for (const f of findings) {
        if (f.outcome === 'mismatch') {
          issues.push(classifyIssue({
            code: approval.code,
            field: f.profileField ?? f.documentField,
            reason: 'mismatch',
            detail: f.detail ?? `Value mismatch between profile and document`,
            status: 'mismatch',
          }));
        }
      }
    }

    // Classify and count
    const blockingIssues = issues.filter(i => i.severity === 'blocking');
    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    const lowIssues = issues.filter(i => i.severity === 'low');
    const warnings = [...highIssues, ...mediumIssues, ...lowIssues];

    const readinessLevel = computeReadiness(blockingIssues.length, highIssues.length, mediumIssues.length);

    // Build recovery actions with dependency-aware ordering
    const actions = this.buildRecoveryActions(issues, instances);

    // Upsert recovery plan
    const existingPlan = await this.prisma.recoveryPlan.findFirst({
      where: { projectId, status: 'active' },
    });

    const planData = {
      projectId,
      approvalInstanceId: approvalInstanceId ?? null,
      status: 'active' as const,
      readinessLevel,
      totalBlocking: blockingIssues.length,
      totalWarnings: warnings.length,
      totalActions: actions.length,
      resolvedActions: 0,
    };

    let plan;
    if (existingPlan) {
      // Delete old actions
      await this.prisma.recoveryAction.deleteMany({ where: { recoveryPlanId: existingPlan.id } });
      plan = await this.prisma.recoveryPlan.update({
        where: { id: existingPlan.id },
        data: planData,
      });
    } else {
      plan = await this.prisma.recoveryPlan.create({ data: planData });
    }

    // Create recovery actions
    const createdActions: Array<Record<string, unknown>> = [];
    for (const action of actions) {
      const created = await this.prisma.recoveryAction.create({
        data: {
          recoveryPlanId: plan.id,
          issueId: action.issueId,
          title: action.title,
          description: action.description,
          reason: action.reason,
          severity: action.severity,
          status: 'open',
          sequenceOrder: action.sequenceOrder,
          affectedApproval: action.affectedApproval ?? null,
          affectedDocument: action.affectedDocument ?? null,
        },
      });
      createdActions.push({
        id: created.id,
        issueId: created.issueId,
        title: created.title,
        description: created.description,
        reason: created.reason,
        severity: created.severity,
        status: created.status,
        sequenceOrder: created.sequenceOrder,
        affectedApproval: created.affectedApproval,
        affectedDocument: created.affectedDocument,
      });
    }

    return {
      planId: plan.id,
      projectId,
      readinessLevel: plan.readinessLevel,
      totalBlocking: plan.totalBlocking,
      totalWarnings: plan.totalWarnings,
      totalActions: plan.totalActions,
      resolvedActions: plan.resolvedActions,
      actions: createdActions,
    };
  }

  /** Get an existing recovery plan for a project. */
  async getPlan(projectId: string): Promise<Record<string, unknown>> {
    const plan = await this.prisma.recoveryPlan.findFirst({
      where: { projectId, status: 'active' },
      include: {
        actions: { orderBy: { sequenceOrder: 'asc' } },
      },
    });
    if (!plan) return { planId: null, projectId, readinessLevel: 'unknown', actions: [] };

    return {
      planId: plan.id,
      projectId,
      readinessLevel: plan.readinessLevel,
      totalBlocking: plan.totalBlocking,
      totalWarnings: plan.totalWarnings,
      totalActions: plan.totalActions,
      resolvedActions: plan.resolvedActions,
      createdAt: plan.createdAt,
      actions: plan.actions.map(a => ({
        id: a.id,
        issueId: a.issueId,
        title: a.title,
        description: a.description,
        reason: a.reason,
        severity: a.severity,
        status: a.status,
        sequenceOrder: a.sequenceOrder,
        affectedApproval: a.affectedApproval,
        affectedDocument: a.affectedDocument,
      })),
    };
  }

  /** Mark a recovery action as resolved. */
  async resolveAction(actionId: string): Promise<Record<string, unknown>> {
    const action = await this.prisma.recoveryAction.findUnique({
      where: { id: actionId },
      include: { recoveryPlan: true },
    });
    if (!action) throw new NotFoundException(`Recovery action '${actionId}' not found`);

    await this.prisma.recoveryAction.update({
      where: { id: actionId },
      data: { status: 'resolved' },
    });

    // Recount resolved actions
    const resolvedCount = await this.prisma.recoveryAction.count({
      where: { recoveryPlanId: action.recoveryPlanId, status: 'resolved' },
    });

    const totalActions = await this.prisma.recoveryAction.count({
      where: { recoveryPlanId: action.recoveryPlanId },
    });

    // Update readiness
    const unresolvedBlocking = await this.prisma.recoveryAction.count({
      where: { recoveryPlanId: action.recoveryPlanId, status: { not: 'resolved' }, severity: 'blocking' },
    });
    const unresolvedHigh = await this.prisma.recoveryAction.count({
      where: { recoveryPlanId: action.recoveryPlanId, status: { not: 'resolved' }, severity: 'high' },
    });
    const unresolvedMedium = await this.prisma.recoveryAction.count({
      where: { recoveryPlanId: action.recoveryPlanId, status: { not: 'resolved' }, severity: 'medium' },
    });

    const readinessLevel = computeReadiness(unresolvedBlocking, unresolvedHigh, unresolvedMedium);
    const newStatus = resolvedCount === totalActions ? 'completed' : 'active';

    await this.prisma.recoveryPlan.update({
      where: { id: action.recoveryPlanId },
      data: { resolvedActions: resolvedCount, readinessLevel, status: newStatus },
    });

    return {
      actionId,
      status: 'resolved',
      planReadiness: readinessLevel,
      resolvedCount,
      totalActions,
    };
  }

  /** Build prioritized recovery actions with dependency awareness. */
  private buildRecoveryActions(issues: Issue[], _instances: Array<{ approvalDefinition?: { code?: string; name?: string } | null }>): Array<{
    issueId: string;
    title: string;
    description: string;
    reason: string;
    severity: 'blocking' | 'high' | 'medium' | 'low';
    sequenceOrder: number;
    affectedApproval?: string | null;
    affectedDocument?: string | null;
  }> {
    // Sort by severity (blocking > high > medium > low), then by dependencies
    const severityOrder: Record<string, number> = { blocking: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...issues].sort((a, b) => {
      const sevDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      if (sevDiff !== 0) return sevDiff;
      // Dependency: document issues after field issues
      const aIsDoc = a.category === 'missing_mandatory_document';
      const bIsDoc = b.category === 'missing_mandatory_document';
      if (aIsDoc && !bIsDoc) return 1;
      if (!aIsDoc && bIsDoc) return -1;
      return 0;
    });

    return sorted.map((issue, idx) => ({
      issueId: issue.id,
      title: issue.title,
      description: issue.description,
      reason: issue.reason,
      severity: issue.severity,
      sequenceOrder: idx + 1,
      affectedApproval: issue.affectedApproval ?? null,
      affectedDocument: issue.affectedDocument ?? null,
    }));
  }
}
