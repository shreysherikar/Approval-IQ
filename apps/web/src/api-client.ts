import type {
  ApiErrorEnvelope,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisteredUser,
} from '@approvaliq/contracts';

/**
 * API base URL comes from `VITE_API_URL` (see `.env.example` / README).
 * Defaults to the NestJS API default port (3001) for local dev.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function extractErrorMessage(code: string, fallback: string, details: unknown): string {
  if (typeof details === 'string' && details.length > 0) {
    return details;
  }
  if (Array.isArray(details)) {
    const parts = details.filter((d): d is string => typeof d === 'string');
    if (parts.length > 0) {
      return parts.join('; ');
    }
  }
  if (typeof fallback === 'string' && fallback.length > 0) {
    return fallback;
  }
  return code;
}

async function parseError(res: Response): Promise<never> {
  let code = 'REQUEST_ERROR';
  let message = `Request failed with status ${res.status}`;
  let details: unknown;
  try {
    const body = (await res.json()) as Partial<ApiErrorEnvelope>;
    if (body?.error) {
      code = body.error.code || code;
      details = body.error.details;
      message = extractErrorMessage(code, body.error.message || message, details);
    }
  } catch {
    // Non-JSON error body — fall back to status-based message.
  }
  throw new ApiError(res.status, code, message, details);
}

export interface RequestOptions {
  token?: string | undefined;
  signal?: AbortSignal | undefined;
}

async function request<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  const res = await fetch(
    `${API_BASE_URL}${path}`,
    options.signal === undefined
      ? { ...init, headers }
      : { ...init, headers, signal: options.signal },
  );
  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'GET' }, options);
}

export function post<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, options);
}

export function patch<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, options);
}

export const authApi = {
  login(body: LoginRequest): Promise<LoginResponse> {
    return post<LoginResponse>('/auth/login', body);
  },
  register(body: RegisterRequest): Promise<RegisteredUser> {
    return post<RegisteredUser>('/auth/register', body);
  },
};

// ---------------------------------------------------------------------------
// Projects / profile versions / evaluations (Phases 2–3 API).
// ---------------------------------------------------------------------------

/** One BusinessProfile field: `{ status: 'known', value }` or `{ status: 'unknown' }`. */
export type KnownFieldValue =
  | { status: 'known'; value: unknown }
  | { status: 'unknown' };

export interface ProfileVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  values: Record<string, unknown>;
  status: 'draft' | 'confirmed';
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmProfileResponse {
  profile: ProfileVersion;
  evaluation: EvaluationResponse;
}

export interface MissingFieldInfo {
  field: string;
  reason: 'unknown' | 'type_mismatch';
  detail?: string;
}

export interface ApprovalEvaluationInfo {
  approval: {
    id: string;
    name: string;
    description?: string;
    sourceUrl?: string;
    lastVerifiedDate?: string;
    requiredDocuments?: Array<{ id: string; name: string }>;
  };
  outcome: 'applicable' | 'not_applicable' | 'needs_information' | 'not_evaluable';
  neededInformation: MissingFieldInfo[];
}

export interface EvaluationResponse {
  id: string;
  releaseId?: string | null;
  engineVersion: string;
  createdAt?: string;
  approvals: ApprovalEvaluationInfo[];
  requiredDocuments: Array<{ id: string; name: string }>;
  warnings: string[];
}

export const projectsApi = {
  create(body: { name: string; industry: string; businessId: string }): Promise<{
    id: string;
    name: string;
    industry: string;
    businessId: string;
  }> {
    return post('/projects', body);
  },
};

export const profilesApi = {
  /** POST /projects/:projectId/profiles — create a new draft version. */
  createDraft(projectId: string, values: Record<string, KnownFieldValue>): Promise<ProfileVersion> {
    return post(`/projects/${projectId}/profiles`, { values });
  },
  /** PATCH /projects/:projectId/profiles/:versionId — update a DRAFT version. */
  updateDraft(
    projectId: string,
    versionId: string,
    values: Record<string, KnownFieldValue>,
  ): Promise<ProfileVersion> {
    return patch(`/projects/${projectId}/profiles/${versionId}`, { values });
  },
  /**
   * POST /projects/:projectId/profiles/:versionId/confirm — locks the version
   * and automatically runs the approval evaluation; returns both.
   */
  confirm(projectId: string, versionId: string): Promise<ConfirmProfileResponse> {
    return post(`/projects/${projectId}/profiles/${versionId}/confirm`, {});
  },
};

export const evaluationsApi = {
  /** GET /evaluations/:id — replayable read of a persisted evaluation run. */
  get(id: string): Promise<EvaluationResponse> {
    return get(`/evaluations/${id}`);
  },
};

export type { LoginRequest, LoginResponse, RegisterRequest, RegisteredUser };
