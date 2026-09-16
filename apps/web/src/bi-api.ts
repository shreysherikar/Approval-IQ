import { get, post } from './api-client';

// ---------------------------------------------------------------------------
// Business Intelligence (Features 1 + 2): Time & Cost Prediction + Market &
// Competitor Intelligence. Same request conventions as the rest of the client.
// ---------------------------------------------------------------------------

/** Project list item (membership-scoped GET /projects). */
export interface ProjectListItem {
  id: string;
  name: string;
  industry: string;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceStatus = 'verified' | 'configured' | 'estimated' | 'needs_review' | string;

export interface MinMax {
  min: number | null;
  max: number | null;
}

export interface TimeCostTimelineRow {
  approvalDefinitionId: string;
  code: string;
  name: string;
  authority: string;
  authorityDepartment: string | null;
  estimatedTimeMinDays: number | null;
  estimatedTimeMaxDays: number | null;
  timeBasis: string | null;
  timeStatus: EvidenceStatus | null;
  timeSourceNote: string | null;
  dependencies: string | null;
  dependencyApprovalNames: string[];
  parallelRun: boolean;
  startDayMin: number;
  finishDayMin: number | null;
  finishDayMax: number | null;
  onCriticalPath: boolean;
  inspectionRequired: boolean;
  sourceUrl: string | null;
  sourceTitle: string | null;
  verificationStatus: string | null;
  stalenessFlag: boolean;
  lastVerifiedDate: string;
  outcome: string | null;
  dependents: string[];
  timeKnown: boolean;
}

export interface TimeCostCostRow {
  approvalDefinitionId: string;
  code: string;
  name: string;
  authority: string;
  govtFee: MinMax;
  registrationFee: MinMax;
  inspectionFee: MinMax;
  documentationCost: MinMax;
  otherCost: MinMax;
  total: MinMax;
  costStatus: EvidenceStatus | null;
  costSourceNote: string | null;
  whyRequired: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  verificationStatus: string | null;
  stalenessFlag: boolean;
  lastVerifiedDate: string;
  costKnown: boolean;
}

export interface TimeCostPrediction {
  projectId: string;
  project: { id: string; name: string; industry: string; businessId: string };
  profile: { versionNumber: number; status: string } | null;
  hasData: boolean;
  message?: string;
  businessContext?: {
    industry: string;
    location: Record<string, { value?: unknown; status?: string }> | null;
  };
  time?: {
    estimatedMinWorkingDays: number;
    estimatedMaxWorkingDays: number;
    basis: string;
    criticalPath: string[];
    criticalPathLengthDays: MinMax;
    longestApproval: { code: string; name: string; days: number } | null;
    parallelGroups: Array<{ layerIndex: number; approvalIds: string[]; startDay: number; finishDayMax: number }>;
    parallelApprovalCodes: string[];
    explanation: string;
    approvalsMissingTime: string[];
  };
  cost?: {
    currency: string;
    governmentFees: MinMax;
    registrationFees: MinMax;
    inspectionFees: MinMax;
    documentationCosts: MinMax;
    otherComplianceCosts: MinMax;
    total: MinMax;
    approvalsMissingCost: string[];
    note: string;
  };
  timeline?: TimeCostTimelineRow[];
  costRows?: TimeCostCostRow[];
  confidence?: {
    level: 'high' | 'medium' | 'limited' | 'no_data' | string;
    score: number;
    timeEvidenceKnown: number;
    costEvidenceKnown: number;
    verifiedTimeApprovals: number;
    verifiedCostApprovals: number;
    totalApprovals: number;
    explanation: string[];
  };
  delayFactors?: Array<{ factor: string; affectedApprovals: string[]; basis: string }>;
  generatedAt?: string;
}

export const businessIntelligenceApi = {
  /** GET /projects — the signed-in user's projects (for the BI project pickers). */
  projects(token?: string): Promise<ProjectListItem[]> {
    return get('/projects', { token });
  },

  /** GET /projects/:projectId/time-cost-prediction — Feature 1 payload. */
  timeCostPrediction(projectId: string, token?: string): Promise<TimeCostPrediction> {
    return get(`/projects/${projectId}/time-cost-prediction`, { token });
  },
};

// ---------------------------------------------------------------------------
// Feature 2: Market & Competitor Intelligence (Google Maps / Places via the API).
// ---------------------------------------------------------------------------

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string | null;
  location: { lat: number; lng: number };
}

export interface Competitor {
  placeId: string;
  name: string;
  address: string | null;
  location: { lat: number; lng: number };
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  category: string | null;
  openNow: boolean | null;
  distanceMeters: number | null;
  websiteUri: string | null;
  phone: string | null;
  mapsUri: string | null;
  businessStatus: string | null;
}

export interface ThemeMention {
  theme: string;
  count: number;
  kind: 'positive' | 'negative' | 'neutral';
  /** Example short quote snippets backing the theme (max 2). */
  evidence: string[];
}

export interface CompetitorAnalysis {
  placeId: string;
  name: string;
  overallRating: number | null;
  reviewVolume: number | null;
  positiveThemes: ThemeMention[];
  negativeThemes: ThemeMention[];
  experienceThemes: string[];
  observation: string | null;
  insufficientData: boolean;
  reviewsAnalyzed: number;
  scopeNote: string;
}

export interface MarketSnapshot {
  competitorsFound: number;
  averageRating: number | null;
  averageReviewVolume: number | null;
  frequentlyPraised: ThemeMention[];
  frequentlyComplained: ThemeMention[];
  potentialGaps: Array<{ gap: string; evidence: string; relatedComplaints: number }>;
}

export interface ResourceCategory {
  category: string;
  label: string;
  count: number;
  examples: Array<{ name: string; vicinity: string | null }>;
}

export interface LocationIntelligence {
  locationName: string;
  businessType: string;
  facts: string[];
  inferences: string[];
  competitivePressure: 'low' | 'moderate' | 'high' | string | null;
  potentialSegments: string[];
  resources: ResourceCategory[];
}

export interface MarketIntelligenceResult {
  location: PlaceSearchResult;
  businessType: string;
  competitors: Competitor[];
  snapshot: MarketSnapshot;
  locationIntelligence: LocationIntelligence;
  recommendations: Array<{ observation: string; recommendation: string }>;
  nextSteps: string[];
  scopeNote: string;
  error?: string;
}

export interface MarketSearchResponse {
  location: PlaceSearchResult;
  competitors: Competitor[];
}

export const marketApi = {
  /** GET /market/locations?q=... — location autocomplete (Places Text Search). */
  searchLocations(q: string, token?: string): Promise<{ results: PlaceSearchResult[]; error?: string }> {
    return get(`/market/locations?q=${encodeURIComponent(q)}`, { token });
  },

  /**
   * POST /market/analyze — competitors + market-wide analysis for one
   * location + business type. Returns per-competitor data only; review
   * analysis is fetched per competitor via `reviews`.
   */
  analyze(
    body: { placeId: string; locationName: string; businessType: string },
    token?: string,
  ): Promise<MarketSearchResponse> {
    return post('/market/analyze', body, { token });
  },

  /**
   * POST /market/competitors/:placeId/reviews — the API-returned review
   * sample for one place, already analyzed into themes by the backend.
   */
  reviews(placeId: string, token?: string): Promise<CompetitorAnalysis> {
    return post(`/market/competitors/${encodeURIComponent(placeId)}/reviews`, {}, { token });
  },
};
