/**
 * @approvaliq/contracts — shared API DTO types.
 *
 * Auth contract stub. Full Zod schemas land with the contracts package;
 * the web app imports these shared types via the api-client module.
 */

export type UserRole = 'applicant' | 'officer' | 'admin';

export interface RegisterRequest {
  email: string;
  password: string;
  role: UserRole;
}

export interface RegisteredUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

