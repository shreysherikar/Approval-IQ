import { SetMetadata } from '@nestjs/common';

export type UserRole = 'applicant' | 'officer' | 'admin';

export const ROLES_KEY = 'roles';

export const USER_ROLES: readonly [UserRole, UserRole, UserRole] = [
  'applicant',
  'officer',
  'admin',
];

/** Restrict a route to specific roles, e.g. `@Roles('officer', 'admin')`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
