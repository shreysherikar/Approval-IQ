import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { businessProfileDraftSchema } from '@approvaliq/contracts';
import { useAuth } from './auth';
import { useLanguage } from './i18n';
import { ApiError, profilesApi } from './api-client';
import type { KnownFieldValue, ProfileVersion } from './api-client';
import { ErrorBanner, LoadingSpinner } from './components';

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  industry: 'Industry Sector',
  state: 'State Jurisdiction',
  district: 'District Location',
  landStatus: 'Land & Premises Status',
  areaSqft: 'Built-up / Plot Area (sq ft)',
  areaType: 'Area Classification',
  investmentAmountInr: 'Total Investment (INR)',
  investmentDefinition: 'Investment Scope Definition',
  employeeCount: 'Projected Workforce',
  employeeCountDefinition: 'Workforce Scope Definition',
  activityType: 'Specific Industrial Activity',
};

const AREA_TYPE_OPTIONS = [
  { value: 'plot', label: 'Plot Area' },
  { value: 'built_up', label: 'Built-Up Area' },
  { value: 'leased', label: 'Leased Shed' },
  { value: 'operational', label: 'Operational Floor' },
] as const;

const LAND_STATUS_OPTIONS = [
  { value: 'owned', label: 'Owned Freehold' },
  { value: 'leased', label: 'Registered Lease' },
  { value: 'not_yet_acquired', label: 'Under Negotiation' },
] as const;

export const INVESTMENT_DEFINITION_LABEL =
  'Total project capital expenditure including land, civil works, plant & machinery';
export const EMPLOYEE_COUNT_DEFINITION_LABEL = 'Workforce count at full commissioned capacity';

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
  industry: 'brewery',
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

export function buildProfileValues(form: ProfileFormState): Record<string, KnownFieldValue> {
  const area = parseNumeric(form.areaSqft);
  const investment = parseNumeric(form.investmentAmountInr);
  const employees = parseNumeric(form.employeeCount);

  return {
    industry: form.industry ? known(form.industry) : { status: 'unknown' },
    state: form.state ? known(form.state) : { status: 'unknown' },
    district: form.district ? known(form.district) : { status: 'unknown' },
    landStatus: form.landStatus ? known(form.landStatus) : { status: 'unknown' },
    areaSqft: area !== undefined ? known(area) : { status: 'unknown' },
    areaType: form.areaType ? known(form.areaType) : { status: 'unknown' },
    investmentAmountInr: investment !== undefined ? known(investment) : { status: 'unknown' },
    investmentDefinition: known('total_project_cost'),
    employeeCount: employees !== undefined ? known(employees) : { status: 'unknown' },
    employeeCountDefinition: known('full_operational_capacity'),
    activityType: form.activityType ? known(form.activityType) : { status: 'unknown' },
  };
}

export function formFromConfirmedProfile(version: ProfileVersion): ProfileFormState {
  const v = version.values;
  const pick = (key: string): string => {
    const f = v[key] as KnownFieldValue | undefined;
    if (!f || typeof f !== 'object' || !('status' in f) || f.status !== 'known') return '';
    return String(f.value);
  };
  return {
    industry: pick('industry') || 'brewery',
    state: pick('state'),
    district: pick('district'),
    landStatus: pick('landStatus'),
    areaSqft: pick('areaSqft'),
    areaType: pick('areaType'),
    investmentAmountInr: pick('investmentAmountInr'),
    employeeCount: pick('employeeCount'),
    activityType: pick('activityType'),
  };
}

export interface FormValidationResult {
  ok: boolean;
  fieldErrors: Partial<Record<keyof ProfileFormState, string>>;
  formErrors: string[];
  values: Record<string, KnownFieldValue>;
}

export function validateForm(form: ProfileFormState): FormValidationResult {
  const fieldErrors: Partial<Record<keyof ProfileFormState, string>> = {};
  const formErrors: string[] = [];

  const area = parseNumeric(form.areaSqft);
  const hasAreaNumber = area !== undefined;
  const hasAreaType = form.areaType.trim() !== '';
  if (hasAreaNumber !== hasAreaType) {
    fieldErrors.areaType = 'Area and Area type must be provided together.';
  }

  const values = buildProfileValues(form);
  const parsed = businessProfileDraftSchema.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ProfileFormState | undefined;
      if (field && field in EMPTY_FORM && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      } else if (!formErrors.includes(issue.message)) {
        formErrors.push(issue.message);
      }
    }
  }

  const ok = Object.keys(fieldErrors).length === 0 && formErrors.length === 0;
  return { ok, fieldErrors, formErrors, values };
}

interface StoredDraftPointer {
  versionId: string;
  versionNumber: number;
}

const draftPointerKey = (projectId: string) => `approvaliq:draft:${projectId}`;
const valuesCacheKey = (projectId: string) => `approvaliq:profile:${projectId}`;

export function ProfileIntakeForm({ projectId }: { projectId: string }): JSX.Element {
  const { accessToken, isRestoring } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [draft, setDraft] = useState<StoredDraftPointer | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ProfileFormState, string>>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  useEffect(() => {
    try {
      const cachedFormRaw = localStorage.getItem(valuesCacheKey(projectId));
      if (cachedFormRaw) {
        const cachedForm = JSON.parse(cachedFormRaw) as ProfileFormState;
        setForm(cachedForm);
      }
      const cachedDraftRaw = localStorage.getItem(draftPointerKey(projectId));
      if (cachedDraftRaw) {
        const cachedDraft = JSON.parse(cachedDraftRaw) as StoredDraftPointer;
        setDraft(cachedDraft);
      }
    } catch {
      // Storage unavailable
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const set = (field: keyof ProfileFormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const saveDraft = async (): Promise<StoredDraftPointer | null> => {
    const validation = validateForm(form);
    setFieldErrors(validation.fieldErrors);
    setFormErrors(validation.formErrors);
    if (!validation.ok) return null;

    if (accessToken === null) {
      setSaveError(
        isRestoring
          ? 'Session restoring — please retry.'
          : 'Session ended — please sign in again.',
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
        // Ignore
      }
      setDraft(pointer);
      setLastSavedAt(new Date().toLocaleTimeString());
      return pointer;
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save draft.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const confirmAndSeeApprovals = async (): Promise<void> => {
    setConfirmError(null);
    setConfirming(true);
    try {
      const saved = await saveDraft();
      if (!saved) return;
      await profilesApi.confirm(projectId, saved.versionId, accessToken ?? undefined);
      try {
        localStorage.removeItem(draftPointerKey(projectId));
        localStorage.setItem(valuesCacheKey(projectId), JSON.stringify(form));
      } catch {
        // Ignore
      }
      navigate(`/projects/${projectId}/roadmap`);
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'Could not confirm profile.');
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
    'mt-1 w-full rounded-lg bg-white border border-ocean-200/80 px-3.5 py-2.5 text-xs text-ink focus:border-ocean-500 focus:ring-2 focus:ring-ocean-300/40 focus:outline-none transition-all shadow-tactile-sm';
  const invalidClass = ' border-vermilion-500 bg-vermilion-50/40';
  const errorTextClass = 'mt-1 text-xs font-mono text-vermilion-600';

  const textField = (
    field: keyof ProfileFormState,
    label: string,
    opts: { placeholder?: string } = {},
  ): JSX.Element => {
    const invalid = fieldErrors[field] !== undefined;
    return (
      <label className="block">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950">{label}</span>
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
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950">{label}</span>
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

  if (loading) {
    return (
      <div className="py-12 text-center">
        <LoadingSpinner label="Loading statutory case file…" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="editorial-card p-6 sm:p-8 bg-white space-y-6 border border-ocean-300/80 shadow-tactile-lg rounded-2xl animate-fade-in-up" noValidate>
      
      {/* Information Header */}
      <div className="p-4 rounded-xl bg-ocean-50/80 border border-ocean-200/80 text-xs text-ink-soft space-y-1.5">
        <span className="stamp-seal stamp-neutral text-[10px]">
          STATUTORY INTAKE DOSSIER
        </span>
        <p className="leading-relaxed">
          {t('profile.banner_info', 'Fill in available project parameters. Unfilled fields are classified as "pending evaluation" and will highlight missing prerequisites on your clearance roadmap.')}
        </p>
      </div>

      {formErrors.length > 0 && <ErrorBanner message={formErrors.join('; ')} />}
      {saveError && <ErrorBanner message={saveError} />}
      {confirmError && <ErrorBanner message={confirmError} />}

      <fieldset className="space-y-5" disabled={busy}>
        {/* Industry & Location */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950">{t('profile.industry', 'Industry Sector')}</span>
            <select
              value={form.industry}
              onChange={(e) => set('industry')(e.target.value)}
              className={`${inputClass}${fieldErrors.industry ? invalidClass : ''}`}
            >
              <option value="brewery">{t('industries.brewery', 'Brewery & Fermentation')}</option>
              <option value="solar_manufacturing">{t('industries.solar', 'Solar PV & Clean Tech Manufacturing')}</option>
            </select>
            {fieldErrors.industry && <p className={errorTextClass}>{fieldErrors.industry}</p>}
          </label>
          {textField('state', t('onboarding.state_label', 'State Jurisdiction'), { placeholder: 'e.g. Maharashtra' })}
          {textField('district', t('onboarding.district_label', 'District Location'), { placeholder: 'e.g. Pune' })}
          {textField('activityType', t('profile.activity_type', 'Activity Description'), { placeholder: 'e.g. beer-manufacturing' })}
        </div>

        {/* Land Status */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950">Land &amp; Premises Title</span>
          <div className="flex flex-wrap gap-3 pt-1">
            {LAND_STATUS_OPTIONS.map((opt) => (
              <label key={opt.value} className="tactile-btn tactile-btn-secondary px-3.5 py-2 text-xs flex items-center gap-2 cursor-pointer border-ocean-200 hover:border-ocean-400">
                <input
                  type="radio"
                  name="landStatus"
                  value={opt.value}
                  checked={form.landStatus === opt.value}
                  onChange={() => set('landStatus')(opt.value)}
                  className="accent-ocean-600"
                />
                <span className="text-ink font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
          {fieldErrors.landStatus && <p className={errorTextClass}>{fieldErrors.landStatus}</p>}
        </div>

        {/* Area */}
        <div className="p-4 sm:p-5 rounded-xl bg-ocean-50/50 border border-ocean-200/80 space-y-3">
          <span className="text-xs font-mono font-bold text-ocean-950 uppercase tracking-wider">Facility Sizing</span>
          <div className="grid gap-4 sm:grid-cols-2">
            {numberField('areaSqft', 'Area (Square Feet)', { min: '1', placeholder: 'e.g. 25000' })}
            <label className="block">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950">Area Type (Required)</span>
              <select
                value={form.areaType}
                onChange={(e) => set('areaType')(e.target.value)}
                className={`${inputClass}${fieldErrors.areaType ? invalidClass : ''}`}
              >
                <option value="">Select classification…</option>
                {AREA_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldErrors.areaType && <p className={errorTextClass}>{fieldErrors.areaType}</p>}
            </label>
          </div>
        </div>

        {/* Investment & Workforce */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {numberField('investmentAmountInr', 'Total Investment (INR)', {
              min: '1',
              placeholder: 'e.g. 40000000',
            })}
            <p className="mt-1 text-[11px] font-mono text-ink-muted">
              Scope: {INVESTMENT_DEFINITION_LABEL}
            </p>
          </div>
          <div>
            {numberField('employeeCount', 'Projected Workforce Count', {
              min: '1',
              placeholder: 'e.g. 85',
            })}
            <p className="mt-1 text-[11px] font-mono text-ink-muted">
              Scope: {EMPLOYEE_COUNT_DEFINITION_LABEL}
            </p>
          </div>
        </div>
      </fieldset>

      {/* Footer Controls */}
      <div className="pt-4 border-t border-ocean-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-mono text-ink-muted">
          {draft && <span>Draft v{draft.versionNumber}</span>}
          {lastSavedAt && <span className="ml-2">· Saved at {lastSavedAt}</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveDraft()}
            className="tactile-btn tactile-btn-secondary px-4 py-2 text-xs font-semibold"
          >
            {saving ? 'Saving Draft…' : 'Save Draft'}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="tactile-btn tactile-btn-primary px-5 py-2 text-xs font-semibold shadow-tactile hover:shadow-glow-cyan flex items-center gap-1.5"
          >
            {confirming ? (
              <span>Evaluating Clearances…</span>
            ) : (
              <span>Confirm &amp; Generate Roadmap →</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
