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
      ? { ...init, headers, credentials: 'include' }
      : { ...init, headers, signal: options.signal, credentials: 'include' },
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

export interface RefreshResponse {
  accessToken: string;
}

export const authApi = {
  login(body: LoginRequest): Promise<LoginResponse> {
    return post<LoginResponse>('/auth/login', body);
  },
  register(body: RegisterRequest): Promise<RegisteredUser> {
    return post<RegisteredUser>('/auth/register', body);
  },
  /**
   * Restores the session after a browser reload. The long-lived refresh token
   * lives in an httpOnly cookie set by the API at login — never in web
   * storage — so this just needs credentials to be sent along.
   */
  refresh(): Promise<RefreshResponse> {
    return post<RefreshResponse>('/auth/refresh', {});
  },
  logout(): Promise<void> {
    return request<void>('/auth/logout', { method: 'POST' }, {});
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
  create(
    body: { name: string; industry: string; businessId: string },
    token?: string,
  ): Promise<{
    id: string;
    name: string;
    industry: string;
    businessId: string;
  }> {
    return post('/projects', body, { token });
  },
};

/**
 * Profile intake. REQUIRES the caller's access token: the API enforces
 * JwtAuthGuard (who are you?) AND ProjectMemberGuard (are you a member of
 * :projectId?) on every route here, so an anonymous call is a 401 and a
 * non-member is a 403. The token is an explicit argument — same convention as
 * projectsApi/documentsApi — so the caller can never forget it silently.
 */
export const profilesApi = {
  /** POST /projects/:projectId/profiles — create a new draft version. */
  createDraft(
    projectId: string,
    values: Record<string, KnownFieldValue>,
    token?: string,
  ): Promise<ProfileVersion> {
    return post(`/projects/${projectId}/profiles`, { values }, { token });
  },
  /** PATCH /projects/:projectId/profiles/:versionId — update a DRAFT version. */
  updateDraft(
    projectId: string,
    versionId: string,
    values: Record<string, KnownFieldValue>,
    token?: string,
  ): Promise<ProfileVersion> {
    return patch(`/projects/${projectId}/profiles/${versionId}`, { values }, { token });
  },
  /**
   * POST /projects/:projectId/profiles/:versionId/confirm — locks the version
   * and automatically runs the approval evaluation; returns both.
   */
  confirm(projectId: string, versionId: string, token?: string): Promise<ConfirmProfileResponse> {
    return post(`/projects/${projectId}/profiles/${versionId}/confirm`, {}, { token });
  },
};

export const evaluationsApi = {
  /**
   * GET /evaluations/:id — replayable read of a persisted evaluation run.
   * Authenticated (JwtAuthGuard): a run contains the applicant's business data.
   */
  get(id: string, token?: string): Promise<EvaluationResponse> {
    return get(`/evaluations/${id}`, { token });
  },
};

// ---------------------------------------------------------------------------
// Approval roadmap (Phase 4 API): instances, dependency edges, parallel groups.
// ---------------------------------------------------------------------------

export type ApprovalInstanceStatus = 'blocked' | 'available' | 'in_progress' | 'done';

export type DependencyRelationshipType = 'depends_on' | 'informational' | 'parallel_with' | 'unknown';

export type EvaluationOutcome = 'applicable' | 'not_applicable' | 'needs_information' | 'not_evaluable';

export interface RoadmapNode {
  id: string;
  projectId: string;
  approvalDefinitionId: string;
  approvalCode: string;
  approvalName: string;
  shortName?: string | null;
  whyRequired?: string | null;
  inspectionRequired?: boolean | null;
  renewalRequired?: boolean | null;
  slaDays?: number | null;
  slaBasis?: string | null;
  ambiguityNotes?: string | null;
  authority?: { id: string; code: string; name: string } | null;
  source?: {
    id: string;
    name: string;
    citation: string;
    url?: string | null;
    verificationStatus: string;
  } | null;
  evaluationResultId: string;
  outcome: EvaluationOutcome;
  /** Derived at read time from the pinned evaluation (not_evaluable). */
  attentionRequired: boolean;
  missingFields: MissingFieldInfo[];
  requiredDocuments: Array<{ id: string; name: string }>;
  status: ApprovalInstanceStatus;
  sourceUrl: string | null;
  lastVerifiedDate: string | null;
  unlockedAt: string | null;
  updatedAt: string | null;
}

export interface RoadmapEdge {
  id: string;
  fromInstanceId: string | null;
  toInstanceId: string | null;
  fromApprovalId: string;
  fromApprovalCode: string;
  toApprovalId: string;
  toApprovalCode: string;
  type: DependencyRelationshipType;
  /** depends_on only — informational/parallel_with/unknown never gate. */
  gates: boolean;
}

export type SchemeOutcome =
  | 'potentially_eligible'
  | 'excluded'
  | 'not_eligible'
  | 'needs_information'
  | 'unknown'
  | 'not_evaluable';

export interface SchemeEvaluationInfo {
  scheme: {
    id: string;
    name: string;
    shortName?: string;
    description?: string;
    jurisdiction?: string;
    sourceTitle?: string;
    sourceUrl?: string;
    verificationDate?: string;
    exclusionReason?: string;
  };
  outcome: SchemeOutcome;
  matchedConditions?: string[];
  matchedExclusions?: string[];
  factsUsed?: Record<string, unknown>;
  neededInformation: MissingFieldInfo[];
  explanation: string;
}

export interface RoadmapResponse {
  projectId: string;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  /** Engine-computed parallel layers over the gating graph (instance ids). */
  parallelGroups: string[][];
  /** Government schemes and incentives evaluated for the project's profile. */
  schemes?: SchemeEvaluationInfo[];
}

export interface UpdateStatusResponse extends RoadmapNode {
  /** Present when marking done: instances the server flipped to available. */
  unlockedDependentIds?: string[];
}

export interface AiSchemeAnalysisResponse {
  projectId: string;
  businessContext: {
    legalName: string;
    industry: string;
    activity: string;
    state: string;
    district: string;
    investmentAmountInr: number;
    investmentCr: string;
    builtUpAreaSqft: number;
    workforceHeadcount: number;
    fuelType: string;
  };
  aiReadinessScore: number;
  totalPotentialFiscalBenefit: string;
  strategicSummary: string;
  recommendations: Array<{
    id: string;
    title: string;
    domain: string;
    impact: string;
    estimatedSavings: string;
    action: string;
  }>;
  generatedAt: string;
  aiModel: string;
}

export interface AiSchemeChatResponse {
  query: string;
  answer: string;
  relevantSchemes: string[];
  actionableSteps: string[];
  confidenceScore: number;
  sourceAttribution: string;
  timestamp: string;
}

/**
 * Roadmap reads/writes. Authenticated (JwtAuthGuard) AND object-scoped
 * (ProjectMemberGuard on :projectId) — pass the caller's access token.
 */
export const roadmapApi = {
  /** GET /projects/:projectId/roadmap — full graph, shaped for a graph UI. */
  get(projectId: string, token?: string): Promise<RoadmapResponse> {
    return get(`/projects/${projectId}/roadmap`, { token });
  },
  /**
   * PATCH /projects/:projectId/approval-instances/:instanceId/status — only
   * available→in_progress and in_progress→done are accepted by the server;
   * everything else (unblocking included) is derived server-side.
   */
  updateStatus(
    projectId: string,
    instanceId: string,
    status: Exclude<ApprovalInstanceStatus, 'blocked' | 'available'>,
    token?: string,
  ): Promise<UpdateStatusResponse> {
    return patch(
      `/projects/${projectId}/approval-instances/${instanceId}/status`,
      { status },
      { token },
    );
  },
  /** GET /projects/:projectId/schemes/ai-analysis — dynamic AI analysis & readiness score */
  getAiSchemeAnalysis(projectId: string, token?: string): Promise<AiSchemeAnalysisResponse> {
    return get(`/projects/${projectId}/schemes/ai-analysis`, { token });
  },
  /** POST /projects/:projectId/schemes/ai-chat — interactive AI scheme & tax copilot */
  queryAiSchemeAdvisor(
    projectId: string,
    query: string,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
    apiKey?: string,
    model?: string,
    baseUrl?: string,
    token?: string,
  ): Promise<AiSchemeChatResponse> {
    return post(
      `/projects/${projectId}/schemes/ai-chat`,
      { query, history, apiKey, model, baseUrl },
      { token },
    );
  },
};

// ---------------------------------------------------------------------------
// Clarifications (Phase 9 API): applicant inbox + threaded responses.
// ---------------------------------------------------------------------------

export type ClarificationStatus = 'requested' | 'responded' | 'resolved' | 'cancelled';

export type ClarificationAwaitingParty = 'applicant' | 'officer' | null;

export interface ClarificationRequestedField {
  field: string;
  reason?: string;
  label?: string;
}

export interface ClarificationResponseDocumentView {
  id: string;
  documentId: string;
  documentDefinitionId: string | null;
  currentVersion: {
    id: string;
    versionNumber: number;
    state: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    fileHash: string;
  } | null;
}

export interface ClarificationResponseView {
  id: string;
  authorUserId: string;
  author: { id: string; email: string; role: string } | null;
  authorRole: string;
  message: string;
  documents: ClarificationResponseDocumentView[];
  createdAt: string;
}

export interface ClarificationView {
  id: string;
  projectId: string;
  approvalInstanceId: string;
  approvalInstanceStatus: string | null;
  approval: { id: string; code: string; name: string } | null;
  authorityId: string;
  authority: { id: string; code: string; name: string; department: string | null } | null;
  subject: string;
  message: string;
  requestedFields: ClarificationRequestedField[];
  status: ClarificationStatus;
  awaitingParty: ClarificationAwaitingParty;
  isOpen: boolean;
  isTerminal: boolean;
  allowedActions: string[];
  dueAt: string | null;
  respondedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  requestedBy: { id: string; email: string; role: string } | null;
  resolvedBy: { id: string; email: string; role: string } | null;
  responses: ClarificationResponseView[];
  createdAt: string;
  updatedAt: string;
}

export interface ClarificationsInbox {
  projectId: string;
  total: number;
  openCount: number;
  awaitingApplicantCount: number;
  countsByStatus: Record<ClarificationStatus, number>;
  clarifications: ClarificationView[];
}

/**
 * Applicant clarification inbox. Project-scoped (ProjectMemberGuard) — pass the
 * caller's access token.
 */
export const clarificationsApi = {
  /** GET /projects/:projectId/clarifications — inbox, open items first. */
  list(projectId: string, token?: string, query?: string): Promise<ClarificationsInbox> {
    const qs = query ? `?${query}` : '';
    return get(`/projects/${projectId}/clarifications${qs}`, { token });
  },
  /** GET /projects/:projectId/clarifications/:clarificationId — full thread. */
  get(projectId: string, clarificationId: string, token?: string): Promise<ClarificationView> {
    return get(`/projects/${projectId}/clarifications/${clarificationId}`, { token });
  },
  /**
   * POST /projects/:projectId/clarifications/:clarificationId/responses —
   * answer, optionally attaching documents ALREADY in the project's vault.
   */
  respond(
    projectId: string,
    clarificationId: string,
    body: { message: string; documentIds?: string[] },
    token?: string,
  ): Promise<ClarificationView> {
    return post(`/projects/${projectId}/clarifications/${clarificationId}/responses`, body, {
      token,
    });
  },
};

// ---------------------------------------------------------------------------
// Officer (Phase 9 API): authority-scoped queue, review packet, lifecycle.
// ---------------------------------------------------------------------------

export interface OfficerAuthorityView {
  id: string;
  code: string;
  name: string;
  department: string | null;
  jurisdiction: string | null;
  openApplications: number;
  clarificationsAwaitingOfficer: number;
}

export interface RequiredDocumentState {
  code: string;
  name: string;
  status: 'verified' | 'provided_unverified' | 'missing';
  documentId: string | null;
  versionState: string | null;
}

export interface QueueItem {
  instanceId: string;
  projectId: string;
  project: {
    id: string;
    name: string;
    industry: string;
    businessId: string;
    applicantEmails: string[];
  } | null;
  approval: { id: string; code: string; name: string } | null;
  authority: { id: string; code: string; name: string; department: string | null } | null;
  instanceStatus: string;
  outcome: string | null;
  attentionRequired: boolean;
  missingFields: Array<{ field: string; reason: string; detail?: string }>;
  slaDays: number | null;
  inspectionRequired: boolean;
  renewalRequired: boolean;
  requiredDocuments: {
    total: number;
    verified: number;
    providedUnverified: number;
    missing: number;
    items: RequiredDocumentState[];
  };
  openClarifications: number;
  clarificationsAwaitingOfficer: number;
  clarificationsAwaitingApplicant: number;
  lastClarification: {
    id: string;
    status: string;
    subject: string;
    dueAt: string | null;
    updatedAt: string;
  } | null;
  unlockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfficerQueue {
  status: string;
  authorityIds: string[] | null;
  unrestricted: boolean;
  returned: number;
  total: number;
  truncated: boolean;
  summary: { awaitingOfficer: number; awaitingApplicant: number; withMissingDocuments: number };
  items: QueueItem[];
}

export interface ApplicationPacket {
  instance: {
    id: string;
    projectId: string;
    status: string;
    unlockedAt: string | null;
    createdAt: string;
    updatedAt: string;
    outcome: string | null;
    attentionRequired: boolean;
    missingFields: Array<{ field: string; reason: string; detail?: string }>;
  };
  project: {
    id: string;
    name: string;
    industry: string;
    businessId: string;
    createdAt: string;
    contacts: Array<{ id: string; email: string; role: string }>;
  } | null;
  evaluation: {
    runId: string;
    engineVersion: string;
    releaseId: string | null;
    releaseVersion: string | null;
    releaseStatus: string | null;
    evaluatedAt: string;
    profileSnapshot: Record<string, unknown>;
  } | null;
  approval: {
    id: string;
    code: string;
    name: string;
    whyRequired: string;
    officialApplicationUrl: string | null;
    ambiguityNotes: string | null;
    lastVerifiedDate: string;
    slaDays: number | null;
    inspectionRequired: boolean;
    renewalRequired: boolean;
    authority: { id: string; code: string; name: string; department: string | null } | null;
    source: {
      id: string;
      url: string;
      title: string;
      department: string | null;
      lastVerifiedDate: string;
      verificationStatus: string;
      sourceLastReviewed: string | null;
      stalenessFlag: boolean;
    } | null;
  } | null;
  requiredDocuments: {
    total: number;
    verified: number;
    providedUnverified: number;
    missing: number;
    items: Array<
      RequiredDocumentState & {
        documentType: string | null;
        reusability: string | null;
        reuseConditions: string | null;
        condition: string | null;
        matchingDocumentIds: string[];
      }
    >;
  };
  documents: Array<Document & { versions: Array<Record<string, unknown>> }>;
  documentSummary: { totalVersions: number; stateCounts: Record<string, number> };
  consistencyFindings: ConsistencyCheckResult[];
  clarifications: ClarificationView[];
  clarificationSummary: {
    total: number;
    open: number;
    awaitingOfficer: number;
    awaitingApplicant: number;
  };
  riskScores: RiskScoreView | null;
  auditTrail: AuditEventView[];
}

/** Officer surface. Officer-role + authority-assignment scoped — pass the access token. */
export const officerApi = {
  /** GET /officer/authorities — the signed-in officer's assigned authorities. */
  authorities(token?: string): Promise<{ unrestricted: boolean; authorities: OfficerAuthorityView[] }> {
    return get('/officer/authorities', { token });
  },
  /** GET /officer/queue — authority-scoped application queue. */
  queue(token?: string, query?: string): Promise<OfficerQueue> {
    return get(`/officer/queue${query ? `?${query}` : ''}`, { token });
  },
  /** GET /officer/applications/:instanceId — full review packet. */
  application(instanceId: string, token?: string): Promise<ApplicationPacket> {
    return get(`/officer/applications/${instanceId}`, { token });
  },
  /** GET /officer/applications/:instanceId/clarifications — threads for one application. */
  clarifications(instanceId: string, token?: string): Promise<ClarificationView[]> {
    return get(`/officer/applications/${instanceId}/clarifications`, { token });
  },
  /**
   * POST /officer/applications/:instanceId/clarifications — request a clarification.
   * requestedFields defaults server-side to the pinned evaluation's missing fields.
   */
  requestClarification(
    instanceId: string,
    body: {
      subject?: string;
      message: string;
      requestedFields?: ClarificationRequestedField[];
      dueAt?: string;
    },
    token?: string,
  ): Promise<ClarificationView> {
    return post(`/officer/applications/${instanceId}/clarifications`, body, { token });
  },
  /** GET /officer/clarifications/:clarificationId — one thread. */
  clarification(clarificationId: string, token?: string): Promise<ClarificationView> {
    return get(`/officer/clarifications/${clarificationId}`, { token });
  },
  /** POST /officer/clarifications/:clarificationId/follow-up — ask another question. */
  followUp(
    clarificationId: string,
    body: { message: string; requestedFields?: ClarificationRequestedField[]; dueAt?: string },
    token?: string,
  ): Promise<ClarificationView> {
    return post(`/officer/clarifications/${clarificationId}/follow-up`, body, { token });
  },
  /** POST /officer/clarifications/:clarificationId/resolve — close as resolved. */
  resolve(
    clarificationId: string,
    body: { note?: string },
    token?: string,
  ): Promise<ClarificationView> {
    return post(`/officer/clarifications/${clarificationId}/resolve`, body, { token });
  },
  /** POST /officer/clarifications/:clarificationId/cancel — withdraw the request. */
  cancel(
    clarificationId: string,
    body: { note?: string },
    token?: string,
  ): Promise<ClarificationView> {
    return post(`/officer/clarifications/${clarificationId}/cancel`, body, { token });
  },
  /** Construct direct download URL for officer document version */
  documentDownloadUrl(instanceId: string, documentId: string, versionId: string): string {
    return `${API_BASE_URL}/officer/applications/${instanceId}/documents/${documentId}/versions/${versionId}/download`;
  },
};

// ---------------------------------------------------------------------------
// Documents (Phase 5+ API): upload, versioning, download.
// ---------------------------------------------------------------------------

export type DocumentVersionState =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'extracted'
  | 'needs_verification'
  | 'verified'
  | 'rejected'
  | 'superseded'
  | 'archived';

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  uploadedByUserId: string;
  uploadedAt: string;
  state: DocumentVersionState;
}

export interface Document {
  id: string;
  projectId: string;
  documentDefinitionId: string | null;
  /** Stable public DocumentDefinition code (additive; null when unclassified). */
  documentDefinitionCode?: string | null;
  documentDefinitionManualOverride: boolean;
  metadata: Record<string, unknown> | null;
  currentVersion: DocumentVersion | null;
  createdAt: string;
  updatedAt: string;
}

export type UploadDocumentResponse = Document | DedupPromptResponse;

export interface DedupPromptResponse {
  duplicateDetected: true;
  matchedFileHash: string;
  /** The blueprint's four choices (Prompt 5.2) — re-submit with the selected `dedupChoice`. */
  dedupChoices: ['link_to_existing', 'create_new_version', 'keep_separate', 'reject_duplicate'];
  existingDocument: Document;
}

export type UploadDocumentVersionResponse = Document;

export const documentsApi = {
  /** GET /projects/:projectId/documents — list all documents in a project. */
  list(projectId: string, token?: string): Promise<Document[]> {
    return get(`/projects/${projectId}/documents`, { token });
  },

  /**
   * POST /projects/:projectId/documents — upload an original document.
   * Multipart form with field "file" and optional "documentDefinitionId".
   *
   * When a byte-identical file already exists in the project the response is a
   * DEDUP PROMPT ({ duplicateDetected: true, dedupChoices, existingDocument })
   * rather than a silent duplicate. Re-submit the same file with `dedupChoice`
   * set to one of link_to_existing | create_new_version | keep_separate |
   * reject_duplicate; the picked choice is recorded in the document metadata.
   */
  upload(
    projectId: string,
    file: File,
    documentDefinitionId?: string,
    dedupChoice?: string,
    token?: string,
  ): Promise<UploadDocumentResponse> {
    const form = new FormData();
    form.append('file', file);
    if (documentDefinitionId) form.append('documentDefinitionId', documentDefinitionId);
    if (dedupChoice) form.append('dedupChoice', dedupChoice);
    return request<UploadDocumentResponse>(
      `/projects/${projectId}/documents`,
      { method: 'POST', body: form },
      { token },
    );
  },

  /**
   * PATCH /projects/:projectId/documents/:documentId — update classification/metadata (manual override).
   */
  update(
    projectId: string,
    documentId: string,
    body: { documentDefinitionId?: string | null; metadata?: Record<string, unknown> | null },
    token?: string,
  ): Promise<Document> {
    return patch(`/projects/${projectId}/documents/${documentId}`, body, { token });
  },

  /**
   * POST /projects/:projectId/documents/:documentId/versions — upload a replacement version.
   * Multipart form with field "file". Prior version is marked superseded.
   */
  addVersion(
    projectId: string,
    documentId: string,
    file: File,
    token?: string,
  ): Promise<UploadDocumentVersionResponse> {
    const form = new FormData();
    form.append('file', file);
    return request<UploadDocumentVersionResponse>(
      `/projects/${projectId}/documents/${documentId}/versions`,
      { method: 'POST', body: form },
      { token },
    );
  },

  /**
   * GET /projects/:projectId/documents/:documentId/versions/:versionId/download — download a version.
   */
  download(
    projectId: string,
    documentId: string,
    versionId: string,
    token?: string,
  ): Promise<Blob> {
    return request<Blob>(
      `/projects/${projectId}/documents/${documentId}/versions/${versionId}/download`,
      { method: 'GET' },
      { token },
    );
  },
};

// ---------------------------------------------------------------------------
// Document reuse (Phase 7 API): same-project reuse candidates, each marked
// eligible/ineligible with its SPECIFIC reason. Ineligible candidates are
// returned too — never hidden.
// ---------------------------------------------------------------------------

export interface ReuseCandidateVersion {
  id: string;
  versionNumber: number;
  state: string;
  fileHash: string;
}

export interface ReuseCandidate {
  documentId: string;
  documentDefinitionCode: string | null;
  currentVersion: ReuseCandidateVersion | null;
  eligible: boolean;
  /** e.g. 'eligible' | 'eligible_for_conditional_reuse' | 'ineligible' */
  status: string;
  /** A SPECIFIC reason string — never a bare boolean. */
  reason: string;
  /** Emitted for eligible conditional candidates: which conditions passed. */
  passedConditions?: string[];
}

export interface ReuseRequiredDocument {
  documentDefinitionId: string;
  /** Stable DocumentDefinition code — matches RoadmapNode.requiredDocuments[].id. */
  code: string;
  name: string;
  documentType: string;
  reusability: string;
  reuseConditions: string[];
  candidates: ReuseCandidate[];
}

export interface ReuseCandidatesResponse {
  approvalInstanceId: string;
  approvalDefinition: { id: string; code: string; name: string };
  /** Same-project reuse only this sprint (Decision #7). */
  reuseScope: string;
  requiredDocuments: ReuseRequiredDocument[];
}

export const reuseApi = {
  /**
   * GET /projects/:projectId/documents/reuse-candidates?approvalInstanceId=X
   * Every candidate — eligible or not — is returned with its specific reason;
   * ineligible candidates are never hidden.
   */
  candidates(
    projectId: string,
    approvalInstanceId: string,
    token?: string,
  ): Promise<ReuseCandidatesResponse> {
    return get(
      `/projects/${projectId}/documents/reuse-candidates?approvalInstanceId=${encodeURIComponent(approvalInstanceId)}`,
      { token },
    );
  },
};
export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
  evidenceLocation: string | null;
}

export interface FieldCorrectionView {
  fieldName: string;
  correctedValue: string;
  source: string;
}

export interface ExtractionView {
  id: string;
  documentVersionId: string;
  fields: ExtractedField[];
  corrections: FieldCorrectionView[];
  modelProvider: string;
  modelVersion: string;
  promptVersion: string;
  extractedAt: string;
  reviewThreshold: number;
}

export interface VerificationView {
  id: string;
  documentVersionId?: string;
  verifierUserId: string;
  verifiedAt: string;
  fieldsVerified: string[];
  notes: string | null;
  method: string;
  evidenceInspected: boolean;
  verifiedBy: string;
}

export interface ExtractionJob {
  id: string;
  type: string;
  status: string;
  attemptCount: number;
  errorDetails: string | null;
  payload?: unknown;
  retryPolicy?: unknown;
  createdAt: string;
  completedAt: string | null;
}

export type ConsistencyOutcome =
  | 'match'
  | 'mismatch'
  | 'missing'
  | 'unknown'
  | 'not_applicable'
  | 'not_verified';

export interface ConsistencyCheckResult {
  id: string;
  checkType: 'profile_vs_document' | 'document_vs_document';
  checkId: string;
  profileField: string | null;
  documentField: string;
  sideAValue: string | null;
  sideBValue: string | null;
  outcome: ConsistencyOutcome;
  tolerancePct: number | null;
  detail: string | null;
  profileVersionId: string | null;
  otherDocumentVersionId: string | null;
  createdAt: string;
}

export const intelligenceApi = {
  /** POST …/documents/:documentId/extract — enqueue async extraction. */
  extract(projectId: string, documentId: string, token?: string): Promise<ExtractionJob> {
    return post(`/projects/${projectId}/documents/${documentId}/extract`, {}, { token });
  },
  /** GET extraction result for a version (null when not yet extracted). */
  extraction(projectId: string, documentId: string, versionId: string, token?: string): Promise<ExtractionView | null> {
    return get(`/projects/${projectId}/documents/${documentId}/versions/${versionId}/extraction`, { token });
  },
  /** PATCH one field correction (stored alongside raw extraction). */
  correctField(
    projectId: string,
    documentId: string,
    versionId: string,
    body: { fieldName: string; correctedValue: string },
    token?: string,
  ): Promise<ExtractionView> {
    return patch(`/projects/${projectId}/documents/${documentId}/versions/${versionId}/fields`, body, { token });
  },
  /** POST verify — the distinct human action flipping needs_verification → verified. */
  verify(
    projectId: string,
    documentId: string,
    versionId: string,
    body: { fieldsVerified?: string[]; notes?: string; evidenceInspected?: boolean },
    token?: string,
  ): Promise<VerificationView> {
    return post(`/projects/${projectId}/documents/${documentId}/versions/${versionId}/verify`, body, { token });
  },
  /** GET verification records for a version. */
  verifications(projectId: string, documentId: string, versionId: string, token?: string): Promise<VerificationView[]> {
    return get(`/projects/${projectId}/documents/${documentId}/versions/${versionId}/verifications`, { token });
  },
  /** GET job status (poll while pending/processing). */
  job(projectId: string, jobId: string, token?: string): Promise<ExtractionJob> {
    return get(`/projects/${projectId}/jobs/${jobId}`, { token });
  },
  /**
   * GET persisted consistency check results for a version. WARNING layer only —
   * results are surfaced to the user, never used to gate anything.
   */
  consistencyChecks(
    projectId: string,
    documentId: string,
    versionId: string,
    token?: string,
  ): Promise<ConsistencyCheckResult[]> {
    return get(
      `/projects/${projectId}/documents/${documentId}/versions/${versionId}/consistency-checks`,
      { token },
    );
  },
};

export interface JointInspectionApprovalView {
  id: string;
  approvalCode: string;
  approvalName: string;
  authorityCode: string;
  authorityName: string;
  specificRequirements: string | null;
}

export interface JointInspectorChecklistItem {
  item: string;
  status: 'pending' | 'pass' | 'fail' | 'na';
  remarks?: string;
}

export interface JointInspectorChecklistView {
  id: string;
  authorityCode: string;
  authorityName: string;
  inspectorName: string | null;
  inspectorDesignation: string | null;
  status: 'pending' | 'satisfactory' | 'needs_rectification' | 'rejected';
  items: JointInspectorChecklistItem[];
  findingsNotes: string | null;
  signedOffAt: string | null;
}

export interface ReadinessRequirementItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface JointInspectionView {
  id: string;
  projectId: string;
  title: string;
  stage: 'pre_construction' | 'plant_readiness' | 'pre_commissioning' | 'annual_compliance';
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'rescheduled' | 'cancelled';
  scheduledDate: string | null;
  timeSlot: string | null;
  premisesAddress: string | null;
  leadAuthorityCode: string | null;
  leadAuthorityName: string | null;
  notes: string | null;
  readinessChecklist: ReadinessRequirementItem[] | null;
  slotNegotiation?: {
    proposedAt: string;
    applicantNotes?: string;
    slots: Array<{ slotId: string; date: string; timeWindow: string; label?: string }>;
    responses: Record<
      string,
      {
        slotId: string;
        status: 'confirmed' | 'unavailable' | 'alternate_proposed';
        alternateDate?: string | null;
        officerNotes?: string | null;
        respondedAt: string;
      }
    >;
    consensusSlotId: string | null;
    status: string;
  } | null;
  rectificationPlan?: {
    status: string;
    lastSubmittedAt?: string;
    lastReviewedAt?: string;
    reviewNotes?: string;
    submissions: Array<{
      submissionId: string;
      authorityCode: string;
      submittedAt: string;
      itemsResolved: Array<{
        item: string;
        actionTaken: string;
        evidenceDocId?: string;
        notes?: string;
      }>;
      complianceDeclaration: string;
      status: string;
    }>;
  } | null;
  jointReportSummary: string | null;
  participatingApprovals: JointInspectionApprovalView[];
  inspectorChecklists: JointInspectorChecklistView[];
  createdAt: string;
  updatedAt: string;
}

export interface InspectionCandidateApproval {
  approvalCode: string;
  approvalName: string;
  authorityCode: string;
  authorityName: string;
  inspectionMandate: string;
  checklistTemplate: JointInspectorChecklistItem[];
}

export interface InspectionCandidateView {
  stage: 'pre_construction' | 'plant_readiness' | 'pre_commissioning' | 'annual_compliance';
  stageTitle: string;
  stageDescription: string;
  recommendedTimeframe: string;
  leadAuthorityCode: string;
  leadAuthorityName: string;
  participatingApprovals: InspectionCandidateApproval[];
  readinessRequirements: ReadinessRequirementItem[];
  estimatedVisitsSaved: number;
  estimatedDaysSaved: number;
}

export interface InspectionCandidatesResponse {
  candidates: InspectionCandidateView[];
  summary: {
    totalSeparateVisits: number;
    consolidatedJointVisits: number;
    visitsSaved: number;
    totalDaysSaved: number;
  };
}

export const inspectionsApi = {
  /** GET auto-detected candidates and savings metrics */
  candidates(projectId: string, token?: string): Promise<InspectionCandidatesResponse> {
    return get(`/projects/${projectId}/inspections/candidates`, { token });
  },
  /** GET all planned & scheduled inspections for a project */
  list(projectId: string, token?: string): Promise<JointInspectionView[]> {
    return get(`/projects/${projectId}/inspections`, { token });
  },
  /** GET a single joint inspection */
  get(projectId: string, inspectionId: string, token?: string): Promise<JointInspectionView> {
    return get(`/projects/${projectId}/inspections/${inspectionId}`, { token });
  },
  /** POST auto-generate joint inspection plan */
  createPlan(
    projectId: string,
    body?: { title?: string; stage?: string; premisesAddress?: string; notes?: string },
    token?: string,
  ): Promise<JointInspectionView[]> {
    return post(`/projects/${projectId}/inspections/plan`, body ?? {}, { token });
  },
  /** PATCH schedule date, time, and readiness checklist */
  schedule(
    projectId: string,
    inspectionId: string,
    body: {
      scheduledDate: string;
      timeSlot: string;
      premisesAddress?: string;
      leadAuthorityCode?: string;
      leadAuthorityName?: string;
      notes?: string;
      readinessChecklist?: ReadinessRequirementItem[];
    },
    token?: string,
  ): Promise<JointInspectionView> {
    return patch(`/projects/${projectId}/inspections/${inspectionId}/schedule`, body, { token });
  },
  /** POST propose multiple slots for multi-department consensus */
  proposeSlots(
    projectId: string,
    inspectionId: string,
    body: {
      slots: Array<{ slotId: string; date: string; timeWindow: string; label?: string }>;
      applicantNotes?: string;
    },
    token?: string,
  ): Promise<JointInspectionView> {
    return post(`/projects/${projectId}/inspections/${inspectionId}/slots/propose`, body, { token });
  },
  /** PATCH department officer response to proposed slot */
  respondSlot(
    projectId: string,
    inspectionId: string,
    body: {
      authorityCode: string;
      slotId: string;
      status: 'confirmed' | 'unavailable' | 'alternate_proposed';
      alternateDate?: string;
      officerNotes?: string;
    },
    token?: string,
  ): Promise<JointInspectionView> {
    return patch(`/projects/${projectId}/inspections/${inspectionId}/slots/respond`, body, { token });
  },
  /** PATCH submit departmental inspector checklist sign-off */
  signoffChecklist(
    projectId: string,
    inspectionId: string,
    checklistId: string,
    body: {
      inspectorName?: string;
      inspectorDesignation?: string;
      status: 'pending' | 'satisfactory' | 'needs_rectification' | 'rejected';
      items: JointInspectorChecklistItem[];
      findingsNotes?: string;
    },
    token?: string,
  ): Promise<JointInspectionView> {
    return patch(
      `/projects/${projectId}/inspections/${inspectionId}/checklists/${checklistId}/signoff`,
      body,
      { token },
    );
  },
  /** POST applicant submits rectification compliance actions & evidence */
  submitRectification(
    projectId: string,
    inspectionId: string,
    body: {
      authorityCode: string;
      itemsResolved: Array<{
        item: string;
        actionTaken: string;
        evidenceDocId?: string;
        notes?: string;
      }>;
      complianceDeclaration: string;
    },
    token?: string,
  ): Promise<JointInspectionView> {
    return post(`/projects/${projectId}/inspections/${inspectionId}/rectifications/submit`, body, { token });
  },
  /** PATCH department officer reviews rectification proof and resolves */
  reviewRectification(
    projectId: string,
    inspectionId: string,
    body: {
      authorityCode: string;
      status: 'satisfactory' | 'needs_rectification';
      reInspectionRequired: boolean;
      reviewNotes: string;
    },
    token?: string,
  ): Promise<JointInspectionView> {
    return patch(`/projects/${projectId}/inspections/${inspectionId}/rectifications/review`, body, { token });
  },
  /** POST finalize joint inspection */
  complete(
    projectId: string,
    inspectionId: string,
    body: { jointReportSummary: string },
    token?: string,
  ): Promise<JointInspectionView> {
    return post(`/projects/${projectId}/inspections/${inspectionId}/complete`, body, { token });
  },
};

// ---------------------------------------------------------------------------
// Feature #9: Grievance Escalation & Statutory RTS Act Escalation API Client
// ---------------------------------------------------------------------------

export type GrievanceType =
  | 'sla_breach_delay'
  | 'unjustified_clarification'
  | 'arbitrary_rejection'
  | 'inspection_harassment'
  | 'fee_overcharge'
  | 'other';

export type GrievanceTier =
  | 'tier_1_nodal_officer'
  | 'tier_2_appellate_authority'
  | 'tier_3_rts_commission';

export type GrievanceStatus =
  | 'submitted'
  | 'under_investigation'
  | 'escalated'
  | 'redressed'
  | 'rejected'
  | 'withdrawn';

export interface GrievanceDocumentItem {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface GrievanceActionItem {
  id: string;
  actionType: string;
  fromStatus: string | null;
  toStatus: string;
  fromTier: string | null;
  toTier: string | null;
  remarks: string;
  orderNumber: string | null;
  metadata: unknown;
  actor: { id: string; email: string; role: string } | null;
  actorRole: string;
  createdAt: string;
}

export interface GrievanceView {
  id: string;
  grievanceNumber: string;
  projectId: string;
  type: GrievanceType;
  tier: GrievanceTier;
  status: GrievanceStatus;
  subject: string;
  description: string;
  statutorySlaDays: number;
  targetResolutionDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  slaBreachDetectedAt: string | null;
  autoEscalatedAt: string | null;
  resolvedAt: string | null;
  resolutionSummary: string | null;
  rectificationAction: string | null;
  authority: { id: string; code: string; name: string; department: string | null } | null;
  approval: { id: string; code: string; name: string; slaDays: number | null } | null;
  submittedBy: { id: string; email: string; role: string };
  resolvedBy: { id: string; email: string; role: string } | null;
  documents: GrievanceDocumentItem[];
  actions: GrievanceActionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGrievancePayload {
  type: GrievanceType;
  subject: string;
  description: string;
  approvalInstanceId?: string;
  authorityId?: string;
  statutorySlaDays?: number;
  documentIds?: string[];
}

export interface EscalateGrievancePayload {
  remarks: string;
  targetTier?: 'tier_2_appellate_authority' | 'tier_3_rts_commission';
  documentIds?: string[];
}

export interface InvestigateGrievancePayload {
  remarks: string;
  hearingScheduledAt?: string;
  assignedInvestigator?: string;
}

export interface ResolveGrievancePayload {
  outcome: 'redressed' | 'rejected';
  resolutionSummary: string;
  rectificationAction?: string;
  orderNumber?: string;
}

export const grievancesApi = {
  /** List project grievances */
  list(
    projectId: string,
    params?: {
      status?: string | undefined;
      tier?: string | undefined;
      type?: string | undefined;
      approvalInstanceId?: string | undefined;
    },
    token?: string,
  ): Promise<{ grievances: GrievanceView[]; total: number }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.tier) qs.set('tier', params.tier);
    if (params?.type) qs.set('type', params.type);
    if (params?.approvalInstanceId) qs.set('approvalInstanceId', params.approvalInstanceId);
    const query = qs.toString();
    return get<{ grievances: GrievanceView[]; total: number }>(
      `/projects/${projectId}/grievances${query ? `?${query}` : ''}`,
      { token },
    );
  },

  /** Get single grievance details and audit timeline */
  get(projectId: string, grievanceId: string, token?: string): Promise<GrievanceView> {
    return get<GrievanceView>(`/projects/${projectId}/grievances/${grievanceId}`, { token });
  },

  /** Lodge statutory grievance */
  create(projectId: string, payload: CreateGrievancePayload, token?: string): Promise<GrievanceView> {
    return post<GrievanceView>(`/projects/${projectId}/grievances`, payload, { token });
  },

  /** Escalate grievance to next tier */
  escalate(
    projectId: string,
    grievanceId: string,
    payload: EscalateGrievancePayload,
    token?: string,
  ): Promise<GrievanceView> {
    return post<GrievanceView>(`/projects/${projectId}/grievances/${grievanceId}/escalate`, payload, {
      token,
    });
  },

  /** Withdraw grievance */
  withdraw(
    projectId: string,
    grievanceId: string,
    payload: { reason: string },
    token?: string,
  ): Promise<GrievanceView> {
    return post<GrievanceView>(`/projects/${projectId}/grievances/${grievanceId}/withdraw`, payload, {
      token,
    });
  },

  /** Officer queue */
  listForOfficer(
    params?: { status?: string | undefined; tier?: string | undefined; type?: string | undefined },
    token?: string,
  ): Promise<{ grievances: GrievanceView[]; total: number }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.tier) qs.set('tier', params.tier);
    if (params?.type) qs.set('type', params.type);
    const query = qs.toString();
    return get<{ grievances: GrievanceView[]; total: number }>(
      `/officer/grievances${query ? `?${query}` : ''}`,
      { token },
    );
  },

  /** Officer investigate / schedule hearing */
  officerInvestigate(
    grievanceId: string,
    payload: InvestigateGrievancePayload,
    token?: string,
  ): Promise<GrievanceView> {
    return post<GrievanceView>(`/officer/grievances/${grievanceId}/investigate`, payload, { token });
  },

  /** Officer/Appellate resolve or reject order */
  officerResolve(
    grievanceId: string,
    payload: ResolveGrievancePayload,
    token?: string,
  ): Promise<GrievanceView> {
    return post<GrievanceView>(`/officer/grievances/${grievanceId}/resolve`, payload, { token });
  },
};

export type { LoginRequest, LoginResponse, RegisterRequest, RegisteredUser };


// ---------------------------------------------------------------------------
// Feature 1: Regulatory Change Impact Engine API
// ---------------------------------------------------------------------------

export interface RegulatoryChangeView {
  id: string;
  title: string;
  description: string;
  approval: { id: string; code: string; name: string };
  authority: string | null;
  oldConditions: unknown;
  newConditions: unknown;
  effectiveDate: string;
  sourceUrl: string | null;
  sourceNotes: string | null;
  status: string;
  totalImpacts: number;
  createdAt: string;
}

export interface RegulatoryImpactView {
  id: string;
  projectId: string;
  project: { id: string; name: string; industry: string; businessId: string };
  impactType: string;
  priority: string;
  oldApplicability: string;
  newApplicability: string;
  changedCondition: string | null;
  requiredAction: string | null;
  explanation: string;
  confidence: string;
  createdAt: string;
}

export interface ImpactAnalysisResult {
  changeId: string;
  status: string;
  totalBusinessesAnalyzed: number;
  summary: {
    newlyAffected: number;
    noLongerAffected: number;
    requirementChanged: number;
    noMaterialImpact: number;
    needsReview: number;
  };
  impacts: RegulatoryImpactView[];
}

export const regulatoryChangesApi = {
  list(token?: string): Promise<RegulatoryChangeView[]> {
    return get('/regulatory-changes', { token });
  },
  get(id: string, token?: string): Promise<RegulatoryChangeView> {
    return get(`/regulatory-changes/${id}`, { token });
  },
  create(
    body: {
      title: string;
      description: string;
      approvalDefinitionId: string;
      oldConditions: unknown;
      newConditions: unknown;
      effectiveDate: string;
      sourceUrl?: string;
      sourceNotes?: string;
    },
    token?: string,
  ): Promise<RegulatoryChangeView> {
    return post('/regulatory-changes', body, { token });
  },
  analyze(id: string, token?: string): Promise<ImpactAnalysisResult> {
    return post(`/regulatory-changes/${id}/analyze`, {}, { token });
  },
  getImpacts(
    changeId: string,
    filters?: { impactType?: string; priority?: string; industry?: string },
    token?: string,
  ): Promise<{ changeId: string; impacts: RegulatoryImpactView[] }> {
    const params = new URLSearchParams();
    if (filters?.impactType) params.set('impactType', filters.impactType);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.industry) params.set('industry', filters.industry);
    const qs = params.toString();
    return get(`/regulatory-changes/${changeId}/impacts${qs ? `?${qs}` : ''}`, { token });
  },
  getProjectImpacts(projectId: string, token?: string): Promise<RegulatoryImpactView[]> {
    return get(`/regulatory-changes/project/${projectId}/impacts`, { token });
  },
};

// ---------------------------------------------------------------------------
// Feature 2: Compliance Recovery Engine API
// ---------------------------------------------------------------------------

export interface RecoveryActionView {
  id: string;
  issueId: string | null;
  title: string;
  description: string;
  reason: string;
  severity: string;
  status: string;
  sequenceOrder: number;
  affectedApproval: string | null;
  affectedDocument: string | null;
}

export interface RecoveryPlanView {
  planId: string | null;
  projectId: string;
  readinessLevel: string;
  totalBlocking: number;
  totalWarnings: number;
  totalActions: number;
  resolvedActions: number;
  actions: RecoveryActionView[];
}

export const recoveryApi = {
  generate(projectId: string, token?: string, approvalInstanceId?: string): Promise<RecoveryPlanView> {
    const qs = approvalInstanceId ? `?approvalInstanceId=${encodeURIComponent(approvalInstanceId)}` : '';
    return post(`/projects/${projectId}/recovery/generate${qs}`, {}, { token });
  },
  getPlan(projectId: string, token?: string): Promise<RecoveryPlanView> {
    return get(`/projects/${projectId}/recovery`, { token });
  },
  resolveAction(projectId: string, actionId: string, token?: string): Promise<Record<string, unknown>> {
    return patch(`/projects/${projectId}/recovery/actions/${actionId}/resolve`, {}, { token });
  },
};

// ---------------------------------------------------------------------------
// Feature 3: Officer Review Actions + Audit Trail API
// ---------------------------------------------------------------------------

export interface AuditEventView {
  id: string;
  userId: string;
  user: { id: string; email: string; role: string } | null;
  projectId: string | null;
  approvalInstanceId: string | null;
  action: string;
  actor: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface RiskScoreView {
  submissionRisk: {
    score: number;
    level: string;
    reasons: string[];
  };
  regulatoryComplexity: {
    score: number;
    level: string;
    reasons: string[];
  };
  recommendation: string;
  missingRequirements: Array<{ field: string; reason: string }>;
  validationProblems: Array<{ detail: string }>;
}

export const officerActionsApi = {
  recordAction(
    instanceId: string,
    body: { action: string; note?: string },
    token?: string,
  ): Promise<Record<string, unknown>> {
    return post(`/officer/applications/${instanceId}/review`, body, { token });
  },
};

// ---------------------------------------------------------------------------
// Government Single-Window & DigiLocker Interoperability Gateway API
// ---------------------------------------------------------------------------

export interface ExternalPortalAdapter {
  portalCode: 'maitri' | 'nsws' | 'digilocker' | 'apisetu';
  portalName: string;
  jurisdiction: string;
  status: 'connected' | 'mock_ready' | 'sandbox_active';
  syncDirection: 'inbound_push' | 'bidirectional' | 'pull_query';
  supportedEntities: string[];
}

export const integrationsApi = {
  getAdapters(token?: string): Promise<ExternalPortalAdapter[]> {
    return get('/integrations/adapters', { token });
  },
  exportPacket(
    body: { portalCode: 'maitri' | 'nsws'; projectId: string; approvalCode: string; packetId: string },
    token?: string,
  ): Promise<{
    success: boolean;
    remoteTransactionId: string;
    targetPortal: string;
    acknowledgedAt: string;
    portalReceiptUrl: string;
  }> {
    return post('/integrations/export-packet', body, { token });
  },
  fetchDigiLocker(
    body: { docType: string; docNumber: string },
    token?: string,
  ): Promise<{
    verified: boolean;
    issuer: string;
    docType: string;
    digiLockerDocId: string;
    digitalSignature: {
      signedBy: string;
      algorithm: string;
      valid: boolean;
    };
  }> {
    return post('/integrations/digilocker/fetch', body, { token });
  },
};

// ---------------------------------------------------------------------------
// Projects API (create)
// ---------------------------------------------------------------------------
