import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Object-level authorization guard for project-scoped routes.
 *
 * A valid JWT only proves *who* you are. This guard additionally proves you
 * are a MEMBER of the project in the URL — otherwise any logged-in user could
 * read/write another user's documents. Run it AFTER JwtAuthGuard so
 * `request.user.userId` is populated.
 *
 * Denying with 403 (rather than pretending the resource doesn't exist) is an
 * explicit choice: the failure mode we are guarding against is "correct auth
 * mechanism, wrong scope check", and making the denial unambiguous makes it
 * impossible to miss in a test.
 */
@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { userId } = request.user as { userId: string };
    const projectId = request.params.projectId as string;

    if (!userId || typeof projectId !== 'string' || projectId.length === 0) {
      throw new ForbiddenException('Not a member of this project');
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException(`User is not a member of project '${projectId}'`);
    }
    return true;
  }
}