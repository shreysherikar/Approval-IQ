import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isAuthorityInScope, requireOfficerScope } from './officer.guard';

/**
 * Object-level authorization for an officer touching ONE application
 * (an ApprovalInstance). Mirrors ProjectMemberGuard's philosophy exactly:
 *
 * - The instance must exist (otherwise 404 — we are not hiding a real id).
 * - Its approval MUST belong to an authority inside the officer's scope,
 *   otherwise an explicit, unmistakable 403 `officer_out_of_scope` that names
 *   the officer's authority and the required one. Denying loudly is the point:
 *   the failure mode being guarded against is "correct role check, missing
 *   scope check", and an ambiguous failure would hide it.
 *
 * On success `request.officerApplication` carries the resolved scope so the
 * handler never re-queries the same rows for authorization purposes.
 *
 * Run AFTER JwtAuthGuard + OfficerGuard.
 */
export interface OfficerApplicationScope {
  instanceId: string;
  projectId: string;
  authorityId: string;
  approvalDefinitionId: string;
}

interface ApplicationRequest {
  params?: Record<string, string | undefined>;
  officerApplication?: OfficerApplicationScope;
}

@Injectable()
export class OfficerApplicationGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApplicationRequest>();
    const scope = requireOfficerScope(request);
    const instanceId = request.params?.['instanceId'];
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      throw new NotFoundException('No approval instance id in the request path');
    }

    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        projectId: true,
        approvalDefinitionId: true,
        approvalDefinition: { select: { authorityId: true } },
      },
    });
    if (!instance) {
      throw new NotFoundException(`Approval instance '${instanceId}' not found`);
    }

    const authorityId = instance.approvalDefinition.authorityId;
    if (!isAuthorityInScope(scope, authorityId)) {
      throw new ForbiddenException({
        code: 'officer_out_of_scope',
        message:
          'This application belongs to an authority you are not assigned to; you cannot review it',
        details: {
          instanceId,
          requiredAuthorityId: authorityId,
          assignedAuthorityIds: scope.authorityIds,
        },
      });
    }

    request.officerApplication = {
      instanceId: instance.id,
      projectId: instance.projectId,
      authorityId,
      approvalDefinitionId: instance.approvalDefinitionId,
    };
    return true;
  }
}

/** Reads the application scope attached by the guard, failing closed when absent. */
export function requireOfficerApplication(request: unknown): OfficerApplicationScope {
  const scope = (request as ApplicationRequest).officerApplication;
  if (!scope) {
    throw new ForbiddenException('Application scope was not established for this request');
  }
  return scope;
}