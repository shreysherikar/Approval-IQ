import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { businessProfileDraftSchema } from '@approvaliq/contracts';
import { useAuth } from './auth';
import { ApiError, profilesApi } from './api-client';
import type { KnownFieldValue, ProfileVersion } from './api-client';
import { ErrorBanner, LoadingSpinner } from './components';

/**
 * Applicant BusinessProfile intake.
 *
 * Validation REUSES the shared Zod schema from @approvaliq/contracts — the
 * exact same rules the API enforces (types, units, enum values). The only
 * form-local rule is the area pairing check (an area number without an area
 * type is the ambiguity the team decided to eliminate), which the shared
 * per-field schema cannot express.
 */

/** Human-readable label per BusinessProfile field (shared with the results page). */
export const PROFILE_FIELD_LABELS: Record<string, string> = {
  industry: 'Industry',
  state: 'State',
  district: 'District',
  landStatus: 'Land status',
  areaSqft: 'Area (sq ft)',
  areaType: 'Area type',
  investmentAmountInr: 'Investment amount (INR)',
  investmentDefinition: 'Investment definition',
  employeeCount: 'Employee count',
  employeeCountDefinition: 'Employee count definition',
  activityType: 'Activity type',
};

const AREA_TYPE_OPTIONS = [
  { value: 'plot', label: 'Plot' },
  { value: 'built_up', label: 'Built-up' },
  { value: 'leased', label: 'Leased' },
  { value: 'operational', label: 'Operational' },
] as const;

const LAND_STATUS_OPTIONS = [
  { value: 'owned', label: 'Owned' },
  { value: 'leased', label: 'Leased' },
  { value: 'not_yet_acquired', label: 'Not yet acquired' },
] as const;

/**
 * Fixed definitions used today — NOT yet user-selectable. Shown read-only
 * under the numeric inputs so the applicant never guesses what a number means.
 */
export const INVESTMENT_DEFINITION_LABEL =
  'Total project cost including land, building, plant & machinery';
export const EMPLOYEE_COUNT_DEFINITION_LABEL = 'Employees at full operational capacity';

/** Raw form state: one string per input, '' when untouched. */
export interface ProfileFormState {
  industry: string;
  state: string;
  district: string;
  landStatus: string;
  areaSqft: string;
  areaType: string;
  investmentAmountInr: string;
  employeeCount: string;
  activityType: string;
}

const EMPTY_FORM: ProfileFormState = {
  industry: 'brewery', // brewery is the only industry with regulatory data today
  state: '',
  district: '',
  landStatus: '',
  areaSqft: '',
  areaType: '',
  investmentAmountInr: '',
  employeeCount: '',
  activityType: '',
};

function known(value: string | number): KnownFieldValue {
  return { status: 'known', value };
}

function parseNumeric(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Builds the canonical 11-field payload the API stores: every field the user
 * filled becomes `{ status: 'known', value }`; every blank field becomes an
 * explicit `{ status: 'unknown' }` — never null/0/'' as a fake unknown. The
 * fixed definition fields are always known.
 */
export function buildProfileValues(form: ProfileFormState): Record<string, KnownFieldValue> {
  const area = parseNumeric(form.areaSqft);
  const investment = parseNumeric(form.investmentAmountInr);
  const employees = parseNumeric(form.employeeCount);
  return {
    industry: form.industry.trim() === '' ? { status: 'unknown' } : known(form.industry.trim()),
    state: form.state.trim() === '' ? { status: 'unknown' } : known(form.state.trim()),
    district: form.district.trim() === '' ? { status: 'unknown' } : known(form.district.trim()),
    landStatus: form.landStatus === '' ? { status: 'unknown' } : known(form.landStatus),
    areaSqft: area === undefined ? { status: 'unknown' } : known(area),
    areaType: form.areaType === '' ? { status: 'unknown' } : known(form.areaType),
    investmentAmountInr: investment === undefined ? { status: 'unknown' } : known(investment),
    investmentDefinition: known('total_project_cost'),
    employeeCount: employees === undefined ? { status: 'unknown' } : known(employees),
    employeeCountDefinition: known('full_operational_capacity'),
    activityType:
      form.activityType.trim() === '' ? { status: 'unknown' } : known(form.activityType.trim()),
  };
}

export interface ProfileFormValidation {
  ok: boolean;
  fieldErrors: Partial<Record<keyof ProfileFormState, string>>;
  formErrors: string[];
  values: Record<string, KnownFieldValue>;
}

/**
 * Validates the form against the SHARED Zod draft schema (same rules the API
 * enforces) plus the form-only area pairing rule. Any subset of fields may be
 * left blank — blank means explicitly unknown, and the evaluation will name
 * exactly what is still missing.
 */
export function validateProfileForm(form: ProfileFormState): ProfileFormValidation {
  const fieldErrors: Partial<Record<keyof ProfileFormState, string>> = {};
  const formErrors: string[] = [];

  // Area pairing: both filled or both blank — never a number without a type.
  const hasAreaNumber = form.areaSqft.trim() !== '';
  const hasAreaType = form.areaType !== '';
  if (hasAreaNumber && !hasAreaType) {
    fieldErrors.areaType =
      'Select the area type — an area number without a type is ambiguous and cannot be saved.';
  } else if (!hasAreaNumber && hasAreaType) {
    fieldErrors.areaSqft = 'Enter the area in sq ft to go with the selected area type.';
  }

  for (const field of ['areaSqft', 'investmentAmountInr', 'employeeCount'] as const) {
    if (form[field].trim() !== '' && parseNumeric(form[field]) === undefined) {
      fieldErrors[field] = 'Must be a number.';
    }
  }

  const values = buildProfileValues(form);
  // Shared contract schema — identical rules to the API (types/units/enums).
  const parsed = businessProfileDraftSchema.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && key in PROFILE_FIELD_LABELS) {
        const existing = fieldErrors[key as keyof ProfileFormState];
        if (!existing) fieldErrors[key as keyof ProfileFormState] = issue.message;
      } else {
        formErrors.push(issue.message);
      }
    }
  }

  return {
    ok: formErrors.length === 0 && Object.keys(fieldErrors).length === 0,
    fieldErrors,
    formErrors,
    values,
  };
}

// ---------------------------------------------------------------------------
// Draft persistence: the API has no draft-read endpoint yet, so the client
// tracks the open draft version (PATCH target) and the last-saved values
// (prefill) in localStorage. Values are re-sent in full on every save (the
// API replaces `values` wholesale), so cache and server never diverge.
// ---------------------------------------------------------------------------

interface StoredDraftPointer {
  versionId: string;
  versionNumber: number;
}

const draftPointerKey = (projectId: string): string => `approvaliq:profile-draft:${projectId}`;
const valuesCacheKey = (projectId: string): string => `approvaliq:profile-values:${projectId}`;

function loadDraftPointer(projectId: string): StoredDraftPointer | null {
  try {
    const raw = localStorage.getItem(draftPointerKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraftPointer>;
    if (typeof parsed.versionId === 'string' && typeof parsed.versionNumber === 'number') {
      return { versionId: parsed.versionId, versionNumber: parsed.versionNumber };
    }
  } catch {
    // Corrupted storage — treat as absent.
  }
  return null;
}

function loadCachedValues(projectId: string): ProfileFormState | null {
  try {
    const raw = localStorage.getItem(valuesCacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileFormState>;
    return { ...EMPTY_FORM, ...parsed };
  } catch {
    return null;
  }
}

export function ProfileIntakeForm({ projectId }: { projectId: string }): JSX.Element {
  const navigate = useNavigate();
  // Authorization is enforced server-side on every profiles route (JwtAuthGuard
  // + ProjectMemberGuard), so the in-memory access token must travel with each
  // save/confirm call — otherwise the API answers 401 and the draft is never
  // persisted. The token lives only in React state (never web storage).
  const { accessToken, isRestoring } = useAuth();
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [draft, setDraft] = useState<StoredDraftPointer | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProfileFormState, string>>
  >({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Prefill from the last successful save so returning users don't retype.
  useEffect(() => {
    setForm(loadCachedValues(projectId) ?? EMPTY_FORM);
    setDraft(loadDraftPointer(projectId));
  }, [projectId]);

  const set = (field: keyof ProfileFormState) => (value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Persists the current form as the open draft version. PATCHes the tracked
   * draft when we know it is still open; POSTs a fresh version otherwise
   * (first save, missing local cache, or the previous draft was already
   * confirmed — a confirmed version is immutable and must never be mutated).
   */
  const saveDraft = async (): Promise<StoredDraftPointer | null> => {
    const validation = validateProfileForm(form);
    setFieldErrors(validation.fieldErrors);
    setFormErrors(validation.formErrors);
    if (!validation.ok) return null;

    if (accessToken === null) {
      // No access token in memory (e.g. a reload whose silent refresh failed).
      // Say that plainly instead of surfacing a bare "Unauthorized".
      setSaveError(
        isRestoring
          ? 'Still restoring your session — please try again in a moment.'
          : 'Your session has ended — please log in again to save your profile.',
      );
      return null;
    }

    setSaving(true);
    setSaveError(null);
    try {
      let version: ProfileVersion;
      if (draft) {
        try {
          version = await profilesApi.updateDraft(
            projectId,
            draft.versionId,
            validation.values,
            accessToken,
          );
        } catch (err) {
          if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
            // 409: the draft was confirmed since (immutable) — start a new version.
            version = await profilesApi.createDraft(projectId, validation.values, accessToken);
          } else {
            throw err;
          }
        }
      } else {
        version = await profilesApi.createDraft(projectId, validation.values, accessToken);
      }
      const pointer: StoredDraftPointer = {
        versionId: version.id,
        versionNumber: version.versionNumber,
      };
      try {
        localStorage.setItem(draftPointerKey(projectId), JSON.stringify(pointer));
        localStorage.setItem(valuesCacheKey(projectId), JSON.stringify(form));
      } catch {
        // Storage unavailable (private mode) — the server save still worked.
      }
      setDraft(pointer);
      setLastSavedAt(new Date().toLocaleTimeString());
      return pointer;
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save the draft.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const confirmAndSeeApprovals = async (): Promise<void> => {
    setConfirmError(null);
    setConfirming(true);
    try {
      // Persist first so the evaluated profile is exactly what is on screen.
      const saved = await saveDraft();
      if (!saved) return;
      await profilesApi.confirm(projectId, saved.versionId, accessToken ?? undefined);
      try {
        localStorage.removeItem(draftPointerKey(projectId)); // version is locked now
        localStorage.setItem(valuesCacheKey(projectId), JSON.stringify(form));
      } catch {
        // Storage unavailable — confirm still succeeded.
      }
      // Phase 4: land the applicant on their interactive approval roadmap
      // (confirm already built the ApprovalInstances + evaluation under the hood).
      navigate(`/projects/${projectId}/roadmap`);
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'Could not confirm the profile.');
    } finally {
      setConfirming(false);
    }
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    void confirmAndSeeApprovals();
  };

  const busy = saving || confirming;
  const inputClass =
    'mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none';
  const invalidClass = ' border-red-400';
  const errorTextClass = 'mt-1 text-sm text-red-700';

  const textField = (
    field: keyof ProfileFormState,
    label: string,
    opts: { placeholder?: string } = {},
  ): JSX.Element => {
    const invalid = fieldErrors[field] !== undefined;
    return (
      <label className="block">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <input
          type="text"
          value={form[field]}
          placeholder={opts.placeholder}
          onChange={(e) => set(field)(e.target.value)}
          className={`${inputClass}${invalid ? invalidClass : ''}`}
        />
        {invalid && <p className={errorTextClass}>{fieldErrors[field]}</p>}
      </label>
    );
  };

  const numberField = (
    field: 'areaSqft' | 'investmentAmountInr' | 'employeeCount',
    label: string,
    opts: { min?: string; step?: string; placeholder?: string } = {},
  ): JSX.Element => {
    const invalid = fieldErrors[field] !== undefined;
    return (
      <label className="block">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <input
          type="number"
          min={opts.min}
          step={opts.step}
          value={form[field]}
          placeholder={opts.placeholder}
          onChange={(e) => set(field)(e.target.value)}
          className={`${inputClass}${invalid ? invalidClass : ''}`}
        />
        {invalid && <p className={errorTextClass}>{fieldErrors[field]}</p>}
      </label>
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Fill in what you know — anything left blank counts as &ldquo;not known yet&rdquo;, and after
        confirming you will see exactly which approvals need more information.
      </p>

      {formErrors.length > 0 && <ErrorBanner message={formErrors.join('; ')} />}
      {saveError && <ErrorBanner message={saveError} />}
      {confirmError && <ErrorBanner message={confirmError} />}

      <fieldset className="space-y-4" disabled={busy}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Industry</span>
            <select
              value={form.industry}
              onChange={(e) => set('industry')(e.target.value)}
              className={`${inputClass}${fieldErrors.industry ? invalidClass : ''}`}
            >
              <option value="brewery">Brewery</option>
            </select>
            {fieldErrors.industry && <p className={errorTextClass}>{fieldErrors.industry}</p>}
            <p className="mt-1 text-xs text-gray-500">
              Brewery is the only industry covered by the regulatory data today.
            </p>
          </label>
          {textField('state', 'State', { placeholder: 'e.g. Maharashtra' })}
          {textField('district', 'District', { placeholder: 'e.g. Pune' })}
          {textField('activityType', 'Activity type', { placeholder: 'e.g. beer-manufacturing' })}
        </div>

        <div>
          <span className="text-sm font-medium text-gray-700">Land status</span>
          <div className="mt-2 flex flex-wrap gap-4">
            {LAND_STATUS_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="landStatus"
                  value={opt.value}
                  checked={form.landStatus === opt.value}
                  onChange={() => set('landStatus')(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {fieldErrors.landStatus && <p className={errorTextClass}>{fieldErrors.landStatus}</p>}
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-800">Area</p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {numberField('areaSqft', 'Area (sq ft)', { min: '1', placeholder: 'e.g. 25000' })}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Area type (required)</span>
              <select
                value={form.areaType}
                onChange={(e) => set('areaType')(e.target.value)}
                className={`${inputClass}${fieldErrors.areaType ? invalidClass : ''}`}
              >
                <option value="">Select area type…</option>
                {AREA_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldErrors.areaType && <p className={errorTextClass}>{fieldErrors.areaType}</p>}
              <p className="mt-1 text-xs text-gray-500">
                An area number without a type is ambiguous — pick the one that matches your number.
              </p>
            </label>
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-800">Money &amp; people</p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              {numberField('investmentAmountInr', 'Investment amount (INR)', {
                min: '0',
                placeholder: 'e.g. 400000000',
              })}
              <p className="mt-1 text-xs text-gray-500">
                Definition used today (fixed): {INVESTMENT_DEFINITION_LABEL}
              </p>
            </div>
            <div>
              {numberField('employeeCount', 'Employee count', {
                min: '0',
                step: '1',
                placeholder: 'e.g. 120',
              })}
              <p className="mt-1 text-xs text-gray-500">
                Definition used today (fixed): {EMPLOYEE_COUNT_DEFINITION_LABEL}
              </p>
            </div>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveDraft()}
          className="rounded border border-blue-600 px-4 py-2 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {confirming ? 'Confirming…' : 'Confirm and see my approvals'}
        </button>
        {(saving || confirming) && (
          <LoadingSpinner label={confirming ? 'Evaluating your profile…' : 'Saving draft…'} />
        )}
      </div>
      <p className="text-sm text-gray-600">
        {draft
          ? `Draft version ${draft.versionNumber} is open — saving updates it in place.`
          : 'No draft saved yet — “Save draft” creates version 1.'}
        {lastSavedAt && ` Last saved at ${lastSavedAt}.`}
      </p>
      <p className="text-xs text-gray-500">
        Confirming locks this profile version (it can no longer be edited) and automatically checks
        it against the current regulatory rule set. Later changes create a new version.
      </p>
    </form>
  );
}

