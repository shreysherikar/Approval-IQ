import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protect a route with `@UseGuards(JwtAuthGuard)`. The validated JWT payload
 * is available as `request.user`. Combine with `RolesGuard` + `@Roles(...)`
 * for role-restricted routes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
