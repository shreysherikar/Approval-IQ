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
 * Object-level authorization for an officer acting on ONE clarification thread.
 *
 * A clarification stores its authorityId and projectId (denormalized at creation
 * from the approval's authority), so this is a single indexed read — no three
 * table join to answer "may this officer touch this thread?". Out-of-scope is an
 * explicit 403 `officer_out_of_scope`; unknown is a 404.
 *
 * Run AFTER JwtAuthGuard + OfficerGuard.
 */
export interface OfficerClarificationScope {
  clarificationId: string;
  projectId: string;
  authorityId: string;
  approvalInstanceId: string;
}

interface ClarificationRequestShape {
  params?: Record<string, string | undefined>;
  officerClarification?: OfficerClarificationScope;
}

@Injectable()
export class OfficerClarificationGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ClarificationRequestShape>();
    const scope = requireOfficerScope(request);
    const clarificationId = request.params?.['clarificationId'];
    if (typeof clarificationId !== 'string' || clarificationId.length === 0) {
      throw new NotFoundException('No clarification id in the request path');
    }

    const row = await this.prisma.clarificationRequest.findUnique({
      where: { id: clarificationId },
      select: { id: true, projectId: true, authorityId: true, approvalInstanceId: true },
    });
    if (!row) {
      throw new NotFoundException(`Clarification '${clarificationId}' not found`);
    }
    if (!isAuthorityInScope(scope, row.authorityId)) {
      throw new ForbiddenException({
        code: 'officer_out_of_scope',
        message:
          'This clarification was raised by an authority you are not assigned to; you cannot act on it',
        details: {
          clarificationId,
          requiredAuthorityId: row.authorityId,
          assignedAuthorityIds: scope.authorityIds,
        },
      });
    }

    request.officerClarification = {
      clarificationId: row.id,
      projectId: row.projectId,
      authorityId: row.authorityId,
      approvalInstanceId: row.approvalInstanceId,
    };
    return true;
  }
}

export function requireOfficerClarification(request: unknown): OfficerClarificationScope {
  const scope = (request as ClarificationRequestShape).officerClarification;
  if (!scope) {
    throw new ForbiddenException('Clarification scope was not established for this request');
  }
  return scope;
}