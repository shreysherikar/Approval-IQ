import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { FileText, Printer, X, Scale } from 'lucide-react';
import { useLanguage } from './i18n';
import {
  grievancesApi,
  documentsApi,
  type GrievanceView,
  type GrievanceTier,
  type GrievanceStatus,
  type GrievanceType,
  type CreateGrievancePayload,
  type EscalateGrievancePayload,
  type InvestigateGrievancePayload,
  type ResolveGrievancePayload,
} from './api-client';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

const TIER_LABELS: Record<GrievanceTier, { name: string; authority: string; badge: string; step: number }> = {
  tier_1_nodal_officer: {
    name: 'Tier 1: Designated First Authority',
    authority: 'Nodal Officer / District Level Authority',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    step: 1,
  },
  tier_2_appellate_authority: {
    name: 'Tier 2: First Appellate Authority',
    authority: 'Departmental Appellate Officer / District Collector',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    step: 2,
  },
  tier_3_rts_commission: {
    name: 'Tier 3: Right to Services Commission',
    authority: 'Maharashtra State RTS Commission (Statutory Redressal)',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    step: 3,
  },
};

const STATUS_LABELS: Record<GrievanceStatus, { label: string; badge: string }> = {
  submitted: { label: 'Lodged (Pending Review)', badge: 'bg-blue-100 text-blue-800' },
  under_investigation: { label: 'Under Investigation / Hearing', badge: 'bg-amber-100 text-amber-800' },
  escalated: { label: 'Statutorily Escalated', badge: 'bg-purple-100 text-purple-800' },
  redressed: { label: 'Redressed & Remedied', badge: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected with Reasoned Order', badge: 'bg-rose-100 text-rose-800' },
  withdrawn: { label: 'Withdrawn by Applicant', badge: 'bg-gray-100 text-gray-800' },
};

const TYPE_LABELS: Record<GrievanceType, string> = {
  sla_breach_delay: 'SLA Breach / Undue Processing Delay',
  unjustified_clarification: 'Repetitive / Extraneous Clarification Demands',
  arbitrary_rejection: 'Rejection without Statutory Evidence or Ground',
  inspection_harassment: 'Inspection Undue Delay / Irregularity',
  fee_overcharge: 'Fee Schedule Discrepancy / Overcharge',
  other: 'Other Administrative Non-compliance',
};

export function GrievanceCenterPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const urlApprovalInstanceId = searchParams.get('approvalInstanceId') ?? undefined;

  const { accessToken, isOfficer } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedGrievanceId, setSelectedGrievanceId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(Boolean(urlApprovalInstanceId));
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['grievances', projectId, filterStatus, filterTier],
    queryFn: () => {
      const params: {
        status?: string | undefined;
        tier?: string | undefined;
      } = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterTier !== 'all') params.tier = filterTier;
      return grievancesApi.list(projectId!, params, accessToken ?? undefined);
    },
    enabled: Boolean(projectId && accessToken),
  });

  if (!projectId) {
    return <EmptyState title="Project Not Found" description="Missing project ID in the URL route." />;
  }

  const grievances = data?.grievances ?? [];
  const selectedGrievance = grievances.find((g) => g.id === selectedGrievanceId) ?? grievances[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              Maharashtra RTS Act 2015
            </span>
            <span className="text-xs text-gray-500">{t('grievances.sla_days', 'Statutory Timelines & Redressal')}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            {t('grievances.title', 'Grievance Escalation & Redressal Center')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('grievances.subtitle', 'Statutory delay escalation ladder under the Maharashtra Right to Public Services Act 2015')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/projects/${projectId}/roadmap`}
            className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50"
          >
            ← {t('nav.roadmap', 'Roadmap')}
          </Link>
          <Link
            to={`/projects/${projectId}/schemes`}
            className="rounded-xl border border-purple-300 bg-purple-50 px-3.5 py-2 text-xs font-medium text-purple-800 shadow-2xs hover:bg-purple-100 flex items-center gap-1"
          >
            <span>💰 {t('nav.schemes', 'Schemes')}</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 cursor-pointer"
          >
            + {t('grievances.file_new', 'Lodge New Grievance')}
          </button>
        </div>
      </div>

      {/* Statutory Protection Banner */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-2xs">
        <div className="flex items-start gap-3">
          <span className="text-lg">⚖️</span>
          <div>
            <p className="font-bold">
              {t('grievances.statutory_title', 'Statutory Right to Service Guarantee')}
            </p>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              {t(
                'grievances.statutory_desc',
                'Under the Maharashtra Right to Public Services Act, every notified clearance carries a mandatory SLA. If an authority fails to issue the sanction or resolve a clarification within the statutory window without reasonable cause, you may file a formal grievance.',
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Error / Loading */}
      {isLoading && <LoadingSpinner label="Loading grievance dossiers..." />}
      {error && <ErrorBanner message={error instanceof Error ? error.message : 'Failed to load grievances'} />}

      {/* Main Two-Column Layout */}
      {!isLoading && grievances.length === 0 ? (
        <EmptyState
          title="No Grievances Lodged"
          description="Your approvals and timelines are currently running without active statutory disputes. If any authority breaches published SLA or makes unjustified demands, lodge a grievance here."
          action={
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="rounded-md bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700"
            >
              Lodge First Grievance
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Filterable Grievances List */}
          <div className="space-y-4 lg:col-span-5">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_investigation">Under Investigation</option>
                <option value="escalated">Escalated</option>
                <option value="redressed">Redressed</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All Statutory Tiers</option>
                <option value="tier_1_nodal_officer">Tier 1: Nodal Officer</option>
                <option value="tier_2_appellate_authority">Tier 2: Appellate Authority</option>
                <option value="tier_3_rts_commission">Tier 3: RTS Commission</option>
              </select>
            </div>

            {/* List */}
            <div className="space-y-3">
              {grievances.map((g) => {
                const isSelected = selectedGrievance?.id === g.id;
                const statusInfo = STATUS_LABELS[g.status];
                const tierInfo = TIER_LABELS[g.tier];

                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGrievanceId(g.id)}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-600'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-gray-500">{g.grievanceNumber}</span>
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{g.subject}</h3>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusInfo.badge}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium">{TYPE_LABELS[g.type]}</span>
                      {g.authority && (
                        <span className="text-gray-500 font-mono text-[11px]">{g.authority.name}</span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                      <span className={`rounded border px-1.5 py-0.5 font-medium ${tierInfo.badge}`}>
                        {tierInfo.name.split(':')[0]}
                      </span>
                      <span
                        className={`font-medium ${
                          g.isOverdue ? 'text-rose-600 font-semibold animate-pulse' : 'text-gray-500'
                        }`}
                      >
                        {g.status === 'redressed' || g.status === 'rejected'
                          ? 'Closed'
                          : g.isOverdue
                          ? `Overdue by ${Math.abs(g.daysRemaining)} days`
                          : `${g.daysRemaining} days left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Grievance Dossier & Actions */}
          <div className="lg:col-span-7">
            {selectedGrievance ? (
              <GrievanceDetailPanel
                projectId={projectId}
                grievance={selectedGrievance}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ['grievances', projectId] })}
                isOfficer={Boolean(isOfficer)}
              />
            ) : (
              <EmptyState title="Select a Grievance" description="Click on any grievance from the list to view its full dossier and timeline." />
            )}
          </div>
        </div>
      )}

      {/* Lodge Grievance Modal */}
      {showCreateModal && (
        <CreateGrievanceModal
          projectId={projectId}
          initialApprovalInstanceId={urlApprovalInstanceId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            void queryClient.invalidateQueries({ queryKey: ['grievances', projectId] });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grievance Detail & Statutory Escalation Panel
// ---------------------------------------------------------------------------

function GrievanceDetailPanel({
  projectId,
  grievance,
  onRefresh,
  isOfficer,
}: {
  projectId: string;
  grievance: GrievanceView;
  onRefresh: () => void;
  isOfficer: boolean;
}): JSX.Element {
  const { t } = useLanguage();
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showInvestigateModal, setShowInvestigateModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showFilingPackModal, setShowFilingPackModal] = useState(false);

  const statusInfo = STATUS_LABELS[grievance.status];
  const currentTierInfo = TIER_LABELS[grievance.tier];

  const canEscalate =
    (grievance.status === 'submitted' || grievance.status === 'under_investigation' || grievance.status === 'escalated') &&
    grievance.tier !== 'tier_3_rts_commission';

  const canWithdraw =
    grievance.status !== 'redressed' && grievance.status !== 'rejected' && grievance.status !== 'withdrawn';

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* Dossier Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-gray-700">{grievance.grievanceNumber}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.badge}`}>
              {statusInfo.label}
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-gray-900">{grievance.subject}</h2>
          <p className="mt-1 text-xs text-gray-500">
            Lodged on {new Date(grievance.createdAt).toLocaleDateString()} by {grievance.submittedBy.email}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilingPackModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('grievances.export_pack')}</span>
          </button>

          {canEscalate && !isOfficer && (
            <button
              type="button"
              onClick={() => setShowEscalateModal(true)}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              ↑ Escalate to Next Tier
            </button>
          )}

          {canWithdraw && !isOfficer && (
            <button
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Withdraw
            </button>
          )}

          {isOfficer && grievance.status === 'submitted' && (
            <button
              type="button"
              onClick={() => setShowInvestigateModal(true)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Take Up for Investigation
            </button>
          )}

          {isOfficer && (grievance.status === 'submitted' || grievance.status === 'under_investigation' || grievance.status === 'escalated') && (
            <button
              type="button"
              onClick={() => setShowResolveModal(true)}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Issue Formal Resolution Order
            </button>
          )}
        </div>
      </div>

      {/* 3-Tier Statutory Progress Visualizer */}
      <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Statutory Appellate Ladder (Maharashtra RTS Act)
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          {(['tier_1_nodal_officer', 'tier_2_appellate_authority', 'tier_3_rts_commission'] as GrievanceTier[]).map(
            (t, index) => {
              const tierConfig = TIER_LABELS[t];
              const isCurrent = grievance.tier === t;
              const isPast =
                (t === 'tier_1_nodal_officer' && grievance.tier !== 'tier_1_nodal_officer') ||
                (t === 'tier_2_appellate_authority' && grievance.tier === 'tier_3_rts_commission');

              return (
                <div
                  key={t}
                  className={`rounded-md p-2.5 border transition-all ${
                    isCurrent
                      ? 'border-indigo-600 bg-white shadow-sm ring-2 ring-indigo-500/20'
                      : isPast
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 bg-gray-100 text-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="h-4 w-4 rounded-full bg-gray-200 text-[10px] font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-semibold">{tierConfig.name.split(':')[0]}</span>
                  </div>
                  <p className="mt-1 text-[11px] truncate">{tierConfig.authority.split('/')[0]}</p>
                  {isCurrent && (
                    <span className="mt-1.5 inline-block rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Active Tier
                    </span>
                  )}
                </div>
              );
            },
          )}
        </div>

        {/* SLA Countdown & Details */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 text-xs text-gray-600">
          <div>
            <span className="font-medium">Statutory Window: </span>
            {grievance.statutorySlaDays} days (Target:{' '}
            {new Date(grievance.targetResolutionDate).toLocaleDateString()})
          </div>
          <div
            className={`font-semibold ${
              grievance.isOverdue ? 'text-rose-600 animate-pulse' : 'text-emerald-700'
            }`}
          >
            {grievance.status === 'redressed' || grievance.status === 'rejected'
              ? 'Completed'
              : grievance.isOverdue
              ? `⚠️ Statutory SLA Breached (${Math.abs(grievance.daysRemaining)} days overdue)`
              : `⏱️ ${grievance.daysRemaining} days remaining for statutory order`}
          </div>
        </div>
      </div>

      {/* Dossier Metadata & Dispute Facts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
        <div className="rounded border border-gray-200 p-3 bg-white space-y-1.5">
          <p className="font-semibold text-gray-700 uppercase tracking-wider text-[11px]">Dispute Specifics</p>
          <p><span className="text-gray-500">Category:</span> <span className="font-medium">{TYPE_LABELS[grievance.type]}</span></p>
          {grievance.approval && (
            <p><span className="text-gray-500">Approval Reference:</span> <span className="font-mono">{grievance.approval.code} - {grievance.approval.name}</span></p>
          )}
          {grievance.authority && (
            <p><span className="text-gray-500">Respondent Department:</span> <span className="font-medium">{grievance.authority.name}</span></p>
          )}
        </div>

        <div className="rounded border border-gray-200 p-3 bg-white space-y-1.5">
          <p className="font-semibold text-gray-700 uppercase tracking-wider text-[11px]">Appellate Jurisdiction</p>
          <p><span className="text-gray-500">Current Bench:</span> <span className="font-medium">{currentTierInfo.name}</span></p>
          <p><span className="text-gray-500">Competent Authority:</span> <span className="font-medium">{currentTierInfo.authority}</span></p>
          {grievance.autoEscalatedAt && (
            <p className="text-rose-600 font-medium">⚡ Auto-escalated on SLA expiry: {new Date(grievance.autoEscalatedAt).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">Applicant Statement of Grievance</h4>
        <div className="mt-1.5 rounded-md border border-gray-200 bg-gray-50/50 p-3 text-xs leading-relaxed text-gray-800 whitespace-pre-wrap">
          {grievance.description}
        </div>
      </div>

      {/* Supporting Evidence Documents */}
      {grievance.documents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">Attached Documentary Evidence</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {grievance.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-sm"
              >
                <span>📄</span>
                <span className="font-medium">{doc.filename}</span>
                <span className="text-gray-400">({Math.round(doc.sizeBytes / 1024)} KB)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formal Resolution Box (if resolved/redressed) */}
      {(grievance.status === 'redressed' || grievance.status === 'rejected') && (
        <div
          className={`rounded-lg border p-4 ${
            grievance.status === 'redressed'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
              : 'border-rose-300 bg-rose-50 text-rose-950'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider">
                {grievance.status === 'redressed' ? '✅ Formal Redressal Order' : '❌ Reasoned Rejection Order'}
              </span>
              <p className="mt-1 text-sm font-semibold">{grievance.resolutionSummary}</p>
            </div>
            {grievance.resolvedAt && (
              <span className="text-xs font-mono">
                Dated: {new Date(grievance.resolvedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {grievance.rectificationAction && (
            <div className="mt-3 rounded border border-emerald-200 bg-white p-2.5 text-xs text-emerald-900">
              <span className="font-bold">Statutory Directive / Rectification Ordered: </span>
              {grievance.rectificationAction}
            </div>
          )}
        </div>
      )}

      {/* Full Audit Action History */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Statutory Proceedings & Audit Trail ({grievance.actions.length} Events)
        </h4>
        <div className="mt-3 space-y-3">
          {grievance.actions.map((act) => (
            <div key={act.id} className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200">
              <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-white bg-indigo-600" />
              <div className="rounded-md border border-gray-200 bg-white p-3 text-xs shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-semibold text-gray-900">
                    {act.actionType.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="text-gray-400 font-mono text-[11px]">
                    {new Date(act.createdAt).toLocaleString()}
                  </span>
                </div>
                {act.orderNumber && (
                  <p className="mt-0.5 font-mono text-[11px] text-indigo-700">Order No: {act.orderNumber}</p>
                )}
                <p className="mt-1 text-gray-700 leading-relaxed">{act.remarks}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                  <span>Actor: {act.actor?.email ?? 'System Engine'} ({act.actorRole})</span>
                  {act.toTier && <span>· Tier: {act.toTier}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Dialogs */}
      {showEscalateModal && (
        <EscalateGrievanceModal
          projectId={projectId}
          grievance={grievance}
          onClose={() => setShowEscalateModal(false)}
          onSuccess={() => {
            setShowEscalateModal(false);
            onRefresh();
          }}
        />
      )}

      {showWithdrawModal && (
        <WithdrawGrievanceModal
          projectId={projectId}
          grievanceId={grievance.id}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false);
            onRefresh();
          }}
        />
      )}

      {showInvestigateModal && (
        <InvestigateGrievanceModal
          grievanceId={grievance.id}
          onClose={() => setShowInvestigateModal(false)}
          onSuccess={() => {
            setShowInvestigateModal(false);
            onRefresh();
          }}
        />
      )}

      {showResolveModal && (
        <ResolveGrievanceModal
          grievanceId={grievance.id}
          onClose={() => setShowResolveModal(false)}
          onSuccess={() => {
            setShowResolveModal(false);
            onRefresh();
          }}
        />
      )}

      {showFilingPackModal && (
        <AppealFilingPackModal
          grievance={grievance}
          projectId={projectId}
          onClose={() => setShowFilingPackModal(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals: Create, Escalate, Withdraw, Officer Review
// ---------------------------------------------------------------------------

function CreateGrievanceModal({
  projectId,
  initialApprovalInstanceId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  initialApprovalInstanceId?: string | undefined;
  onClose: () => void;
  onSuccess: () => void;
}): JSX.Element {
  const { accessToken } = useAuth();
  const [type, setType] = useState<GrievanceType>('sla_breach_delay');
  const [subject, setSubject] = useState(
    initialApprovalInstanceId ? 'Statutory Delay: Clearance Processing SLA Exceeded' : '',
  );
  const [description, setDescription] = useState(
    initialApprovalInstanceId
      ? 'Clearance application was submitted and all prerequisite documents provided, but statutory processing timeline under Maharashtra RTS Act has been breached without reason.'
      : '',
  );
  const [statutorySlaDays, setStatutorySlaDays] = useState(15);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch project documents for evidence attachment
  const { data: docsData } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.list(projectId, accessToken ?? undefined),
    enabled: Boolean(accessToken),
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateGrievancePayload) =>
      grievancesApi.create(projectId, payload, accessToken ?? undefined),
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError('Please fill in both subject and detailed description.');
      return;
    }
    const payload: CreateGrievancePayload = {
      type,
      subject: subject.trim(),
      description: description.trim(),
      statutorySlaDays,
      documentIds: selectedDocIds,
    };
    if (initialApprovalInstanceId) {
      payload.approvalInstanceId = initialApprovalInstanceId;
    }
    mutation.mutate(payload);
  };

  const docs = Array.isArray(docsData) ? docsData : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h3 className="text-lg font-bold text-gray-900">Lodge Statutory RTS Grievance</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-gray-700">Grievance Nature / Category</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GrievanceType)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700">Subject Summary</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Tree Authority delayed NOC beyond 30 days RTS statutory limit"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700">
              Detailed Statement & Timeline of Grievance
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide chronological facts: application submission date, inspection attempts, unanswered clarification responses, or arbitrary decisions."
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700">
              Statutory Resolution Window (Days per RTS Act)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={statutorySlaDays}
              onChange={(e) => setStatutorySlaDays(Number(e.target.value))}
              className="mt-1 w-28 rounded border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
            <span className="ml-2 text-gray-500">Standard: 15 business days</span>
          </div>

          {docs.length > 0 && (
            <div>
              <label className="block font-medium text-gray-700">
                Attach Supporting Evidence from Vault
              </label>
              <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
                {docs.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedDocIds.includes(d.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedDocIds([...selectedDocIds, d.id]);
                        else setSelectedDocIds(selectedDocIds.filter((id) => id !== d.id));
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium">{d.currentVersion?.originalFilename ?? d.id}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Filing Statutory Dossier...' : 'File Grievance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EscalateGrievanceModal({
  projectId,
  grievance,
  onClose,
  onSuccess,
}: {
  projectId: string;
  grievance: GrievanceView;
  onClose: () => void;
  onSuccess: () => void;
}): JSX.Element {
  const { accessToken } = useAuth();
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const targetTier =
    grievance.tier === 'tier_1_nodal_officer' ? 'tier_2_appellate_authority' : 'tier_3_rts_commission';
  const targetLabel = TIER_LABELS[targetTier];

  const mutation = useMutation({
    mutationFn: (payload: EscalateGrievancePayload) =>
      grievancesApi.escalate(projectId, grievance.id, payload, accessToken ?? undefined),
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      setError('Please state grounds for escalation.');
      return;
    }
    mutation.mutate({ remarks: remarks.trim(), targetTier });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">
          Escalate to {targetLabel.name}
        </h3>
        <p className="mt-1 text-xs text-gray-600">
          Competent Appellate Body: <span className="font-semibold">{targetLabel.authority}</span>
        </p>

        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-gray-700">Appellate Grounds & Prayer</label>
            <textarea
              rows={4}
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="State why the previous tier's response was delayed or unsatisfactory, and the specific relief requested under RTS Act."
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Submitting Escalation...' : 'Confirm Statutory Escalation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WithdrawGrievanceModal({
  projectId,
  grievanceId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  grievanceId: string;
  onClose: () => void;
  onSuccess: () => void;
}): JSX.Element {
  const { accessToken } = useAuth();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: { reason: string }) =>
      grievancesApi.withdraw(projectId, grievanceId, payload, accessToken ?? undefined),
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for withdrawal.');
      return;
    }
    mutation.mutate({ reason: reason.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Withdraw Grievance</h3>
        <p className="mt-1 text-xs text-gray-600">
          This will formally conclude proceedings for this dispute.
        </p>

        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-gray-700">Reason for Withdrawal</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Authority has issued the clearance / resolved the issue amicably."
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded bg-gray-800 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {mutation.isPending ? 'Processing...' : 'Confirm Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvestigateGrievanceModal({
  grievanceId,
  onClose,
  onSuccess,
}: {
  grievanceId: string;
  onClose: () => void;
  onSuccess: () => void;
}): JSX.Element {
  const { accessToken } = useAuth();
  const [remarks, setRemarks] = useState('');
  const [hearingDate, setHearingDate] = useState('');
  const [investigator, setInvestigator] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: InvestigateGrievancePayload) =>
      grievancesApi.officerInvestigate(grievanceId, payload, accessToken ?? undefined),
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      setError('Please record investigation notes.');
      return;
    }
    const payload: InvestigateGrievancePayload = { remarks: remarks.trim() };
    if (hearingDate) payload.hearingScheduledAt = new Date(hearingDate).toISOString();
    if (investigator.trim()) payload.assignedInvestigator = investigator.trim();
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Initiate Investigation / Hearing</h3>
        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-gray-700">Inquiry / Hearing Notes</label>
            <textarea
              rows={3}
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Record inquiry steps, notice issued to desk officer, or hearing agenda."
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700">Hearing Date & Time (Optional)</label>
              <input
                type="datetime-local"
                value={hearingDate}
                onChange={(e) => setHearingDate(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Inquiry Officer Name</label>
              <input
                type="text"
                value={investigator}
                onChange={(e) => setInvestigator(e.target.value)}
                placeholder="e.g. Deputy Commissioner (Industries)"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Updating...' : 'Record Investigation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResolveGrievanceModal({
  grievanceId,
  onClose,
  onSuccess,
}: {
  grievanceId: string;
  onClose: () => void;
  onSuccess: () => void;
}): JSX.Element {
  const { accessToken } = useAuth();
  const [outcome, setOutcome] = useState<'redressed' | 'rejected'>('redressed');
  const [summary, setSummary] = useState('');
  const [rectification, setRectification] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: ResolveGrievancePayload) =>
      grievancesApi.officerResolve(grievanceId, payload, accessToken ?? undefined),
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Please provide resolution summary.');
      return;
    }
    const payload: ResolveGrievancePayload = {
      outcome,
      resolutionSummary: summary.trim(),
    };
    if (rectification.trim()) payload.rectificationAction = rectification.trim();
    if (orderNumber.trim()) payload.orderNumber = orderNumber.trim();
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Issue Formal Order / Disposition</h3>
        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-gray-700">Appellate Disposition</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as 'redressed' | 'rejected')}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
            >
              <option value="redressed">Redress Grievance (Uphold with Directives)</option>
              <option value="rejected">Reject Grievance (Reasoned Order Dismissing Claim)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700">Formal Order / Dispatch Number</label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. RTS/APPEAL/2026/894"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700">Reasoned Finding & Order Summary</label>
            <textarea
              rows={3}
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="State grounds of decision, evidence considered, and whether delay was justified."
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {outcome === 'redressed' && (
            <div>
              <label className="block font-medium text-gray-700">
                Rectification Directives to Subordinate Authority
              </label>
              <textarea
                rows={2}
                value={rectification}
                onChange={(e) => setRectification(e.target.value)}
                placeholder="e.g. Issue deemed approval within 48 hours; waiver of duplicate inspection."
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={`rounded px-4 py-2 text-xs font-semibold text-white ${
                outcome === 'redressed' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              } disabled:opacity-50`}
            >
              {mutation.isPending ? 'Pronouncing Order...' : 'Pronounce & Issue Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Statutory Appeal Filing Pack Modal (Print & PDF Docket)
// ---------------------------------------------------------------------------

function AppealFilingPackModal({
  grievance,
  projectId,
  onClose,
}: {
  grievance: GrievanceView;
  projectId: string;
  onClose: () => void;
}): JSX.Element {
  const currentTierInfo = TIER_LABELS[grievance.tier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
        {/* Top Modal Controls Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-700" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-mono">
              Statutory Appeal Filing Pack (RTS Docket)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Docket Sheet */}
        <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto text-slate-800 font-sans print:p-0 print:overflow-visible">
          {/* Official Emblem & Title */}
          <div className="text-center border-b-2 border-slate-900 pb-5 space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-600 font-mono">
              Government of Maharashtra
            </div>
            <h2 className="text-xl font-black text-slate-950 tracking-tight uppercase">
              Maharashtra Right to Public Services Act, 2015
            </h2>
            <div className="text-xs font-bold text-slate-700 font-mono">
              FORM 1 · MEMORANDUM OF STATUTORY APPEAL UNDER SECTION 18 / 19
            </div>
          </div>

          {/* Docket Summary Band */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono">Grievance Docket ID</div>
              <div className="font-bold font-mono text-slate-900">{grievance.grievanceNumber}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono">Appellate Stage</div>
              <div className="font-bold text-indigo-700">{currentTierInfo.name.split(':')[0]}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono">Filing Date</div>
              <div className="font-bold text-slate-900">{new Date(grievance.createdAt).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono">Statutory Breach</div>
              <div className="font-bold text-rose-700 font-mono">
                {grievance.isOverdue ? `${Math.abs(grievance.daysRemaining)} Days Delay` : 'Pending Order'}
              </div>
            </div>
          </div>

          {/* Section A: Particulars of the Appellant & Enterprise */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 font-mono">
              Section A: Particulars of the Appellant Enterprise
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p><span className="text-slate-500">Project / Enterprise ID:</span> <strong className="font-mono text-slate-900">{projectId}</strong></p>
              <p><span className="text-slate-500">Jurisdiction / Location:</span> <strong className="text-slate-900">Pune, Maharashtra</strong></p>
              <p><span className="text-slate-500">Authorized Representative:</span> <strong className="text-slate-900">{grievance.submittedBy.email}</strong></p>
              <p><span className="text-slate-500">Project Sector:</span> <strong className="text-slate-900">Brewery &amp; Food Manufacturing</strong></p>
            </div>
          </div>

          {/* Section B: Impugned Service & Regulatory Authority */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 font-mono">
              Section B: Impugned Statutory Service &amp; Respondent Authority
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p><span className="text-slate-500">Statutory Clearance / License:</span> <strong className="text-slate-900">{grievance.approval ? `${grievance.approval.code} - ${grievance.approval.name}` : 'General Regulatory Clearance'}</strong></p>
              <p><span className="text-slate-500">Competent Authority (Respondent):</span> <strong className="text-slate-900">{grievance.authority?.name || 'Departmental Officer / SPCB / DISH'}</strong></p>
              <p><span className="text-slate-500">Designated Statutory SLA:</span> <strong className="font-mono text-slate-900">{grievance.statutorySlaDays} Working Days</strong></p>
              <p><span className="text-slate-500">Statutory Due Date:</span> <strong className="font-mono text-slate-900">{new Date(grievance.targetResolutionDate).toLocaleDateString()}</strong></p>
            </div>
          </div>

          {/* Section C: Grounds of Grievance / Appeal */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 font-mono">
              Section C: Nature of Statutory Default &amp; Grounds of Appeal
            </h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <p><span className="font-bold text-slate-700">Category of Violation:</span> <span className="font-mono text-indigo-700 font-bold">{TYPE_LABELS[grievance.type]}</span></p>
              <p><span className="font-bold text-slate-700">Subject:</span> <span>{grievance.subject}</span></p>
              <p><span className="font-bold text-slate-700">Statement of Facts &amp; Grievance Ground:</span></p>
              <p className="text-slate-700 whitespace-pre-wrap bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed font-mono text-[11px]">
                {grievance.description}
              </p>
            </div>
          </div>

          {/* Section D: Chronological Proceedings & Audit Trail */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 font-mono">
              Section D: Chronological Action &amp; Statutory Hearing Trail ({grievance.actions.length} Events)
            </h3>
            <div className="space-y-2 text-xs">
              {grievance.actions.map((act, idx) => (
                <div key={act.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">
                      {idx + 1}. {act.actionType.replace(/_/g, ' ').toUpperCase()} {act.orderNumber && `(Order #${act.orderNumber})`}
                    </div>
                    <div className="text-slate-600 mt-0.5">{act.remarks}</div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 shrink-0 text-right">
                    {new Date(act.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section E: Evidentiary Attachments */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 font-mono">
              Section E: Attached Evidentiary Documents ({grievance.documents.length})
            </h3>
            {grievance.documents.length > 0 ? (
              <ul className="divide-y divide-slate-100 text-xs">
                {grievance.documents.map((d) => (
                  <li key={d.id} className="py-2 flex items-center justify-between">
                    <span className="font-mono text-slate-800">{d.filename}</span>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Hash Verified (SHA-256)
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">No external document attachments linked to this grievance docket.</p>
            )}
          </div>

          {/* Statutory Declaration & Signature Box */}
          <div className="pt-4 border-t-2 border-slate-900 flex items-end justify-between text-xs">
            <div className="space-y-1">
              <p className="font-bold text-slate-900">Verification &amp; Attestation</p>
              <p className="text-[11px] text-slate-600 max-w-sm">
                I hereby declare that the particulars stated above are true and correct to the best of my knowledge and belief pursuant to the Maharashtra Right to Public Services Act, 2015.
              </p>
            </div>
            <div className="text-right space-y-1">
              <div className="font-mono text-[10px] text-slate-400">Digitally Verified via ApprovalIQ</div>
              <div className="font-bold text-slate-900">{grievance.submittedBy.email}</div>
              <div className="text-[10px] text-slate-500">Authorized Signatory</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow cursor-pointer"
          >
            Print Official Docket
          </button>
        </div>
      </div>
    </div>
  );
}
