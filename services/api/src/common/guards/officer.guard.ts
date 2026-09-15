import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UserRole } from '../decorators/roles.decorator';

/**
 * The officer's authorization scope, attached to the request as
 * `request.officerScope` for every downstream handler.
 *
 * `authorityIds === []` with `unrestricted === false` means the officer has NO
 * assignment yet: every authority-scoped read is then empty and every explicit
 * object access is a 403 (fail-closed). An `admin` is deliberately unrestricted
 * — that is the only role allowed to see across authorities, and it is recorded
 * so query builders can branch on it explicitly instead of guessing.
 */
export interface OfficerScope {
  userId: string;
  role: UserRole;
  authorityIds: string[];
  unrestricted: boolean;
}

interface OfficerRequest {
  user?: { userId?: string; email?: string; role?: UserRole };
  officerScope?: OfficerScope;
}

/**
 * Role + authority gating for the officer surface (Phase 9).
 *
 * A valid JWT proving `role = officer` is NOT sufficient authorization, for the
 * same reason a JWT alone is not sufficient for an applicant: an officer must
 * additionally be ASSIGNED to the authority that owns the approval. This guard
 * establishes the *scope* (who may I act for); the per-object guards
 * (OfficerApplicationGuard / OfficerClarificationGuard) then prove that the
 * specific application/thread is inside it.
 *
 * Must run AFTER JwtAuthGuard so `request.user` is populated.
 */
@Injectable()
export class OfficerGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OfficerRequest>();
    const user = request.user;
    if (!user?.userId || !user.role) {
      throw new ForbiddenException('Authentication is required for officer endpoints');
    }
    if (user.role !== 'officer' && user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'officer_role_required',
        message: 'This endpoint is restricted to officers and administrators',
        details: { role: user.role },
      });
    }

    if (user.role === 'admin') {
      request.officerScope = {
        userId: user.userId,
        role: user.role,
        authorityIds: [],
        unrestricted: true,
      };
      return true;
    }

    const assignments = await this.prisma.officerAuthorityAssignment.findMany({
      where: { officerId: user.userId },
      select: { authorityId: true },
    });
    request.officerScope = {
      userId: user.userId,
      role: user.role,
      authorityIds: assignments.map((a) => a.authorityId),
      unrestricted: false,
    };
    return true;
  }
}

/** Reads the scope the guard attached, failing closed when it is missing. */
export function requireOfficerScope(request: unknown): OfficerScope {
  const scope = (request as OfficerRequest).officerScope;
  if (!scope) {
    throw new ForbiddenException('Officer scope was not established for this request');
  }
  return scope;
}

export function isAuthorityInScope(scope: OfficerScope, authorityId: string): boolean {
  return scope.unrestricted || scope.authorityIds.includes(authorityId);
}