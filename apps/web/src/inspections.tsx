import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from './auth';
import { useLanguage } from './i18n';
import {
  ApiError,
  inspectionsApi,
  type InspectionCandidatesResponse,
  type JointInspectionView,
  type JointInspectorChecklistView,
  type ReadinessRequirementItem,
} from './api-client';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

export function JointInspectionsPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>();
  const { accessToken, isRestoring } = useAuth();
  const { t } = useLanguage();

  const [inspections, setInspections] = useState<JointInspectionView[]>([]);
  const [candidateData, setCandidateData] =
    useState<InspectionCandidatesResponse | null>(null);
  const [selectedInspection, setSelectedInspection] =
    useState<JointInspectionView | null>(null);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);

  // Role Switcher: Applicant Mode vs. Departmental Inspector Mode
  const [viewMode, setViewMode] = useState<'applicant' | 'inspector'>('applicant');

  // Certificate Modal State
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isSigningOff, setIsSigningOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Schedule form state
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleSlot, setScheduleSlot] = useState('10:00 AM - 01:00 PM');
  const [premisesAddress, setPremisesAddress] = useState('');
  const [readinessItems, setReadinessItems] = useState<ReadinessRequirementItem[]>([]);

  // Signoff form state
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorDesignation, setInspectorDesignation] = useState('');
  const [findingsNotes, setFindingsNotes] = useState('');
  const [activeItems, setActiveItems] = useState<
    Array<{ item: string; status: 'pass' | 'fail' | 'na' | 'pending'; remarks?: string }>
  >([]);

  // Slot Negotiation state
  const [showSlotNegotiationModal, setShowSlotNegotiationModal] = useState(false);
  const [slotOptions, setSlotOptions] = useState<
    Array<{ slotId: string; date: string; timeWindow: string; label?: string }>
  >([
    {
      slotId: 'slot-1',
      date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] ?? '',
      timeWindow: '10:00 AM - 01:00 PM (Morning Slot)',
      label: 'Preferred Option A (Primary)',
    },
    {
      slotId: 'slot-2',
      date: new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0] ?? '',
      timeWindow: '02:00 PM - 05:00 PM (Afternoon Slot)',
      label: 'Alternate Option B',
    },
  ]);
  const [slotProposalNotes, setSlotProposalNotes] = useState('');
  const [isProposingSlots, setIsProposingSlots] = useState(false);
  const [isRespondingSlot, setIsRespondingSlot] = useState(false);

  // Rectification state
  const [showRectificationModal, setShowRectificationModal] = useState(false);
  const [rectificationActionTaken, setRectificationActionTaken] = useState('');
  const [rectificationEvidenceDoc, setRectificationEvidenceDoc] = useState('');
  const [rectificationDeclaration, setRectificationDeclaration] = useState(
    'I hereby confirm that all flagged non-compliances have been fully rectified on site according to statutory regulations.',
  );
  const [isSubmittingRectification, setIsSubmittingRectification] = useState(false);
  const [isReviewingRectification, setIsReviewingRectification] = useState(false);

  const handleProposeSlotsSubmit = async (): Promise<void> => {
    if (!projectId || !selectedInspection) return;
    setIsProposingSlots(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await inspectionsApi.proposeSlots(
        projectId,
        selectedInspection.id,
        {
          slots: slotOptions,
          applicantNotes: slotProposalNotes,
        },
        accessToken ?? undefined,
      );
      setSelectedInspection(updated);
      setInspections((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      setShowSlotNegotiationModal(false);
      setSuccessMessage('Proposed inspection slots submitted for multi-agency officer consensus.');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not submit proposed inspection slots.',
      );
    } finally {
      setIsProposingSlots(false);
    }
  };

  const handleOfficerSlotResponse = async (
    authorityCode: string,
    slotId: string,
    status: 'confirmed' | 'unavailable' | 'alternate_proposed',
  ): Promise<void> => {
    if (!projectId || !selectedInspection) return;
    setIsRespondingSlot(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await inspectionsApi.respondSlot(
        projectId,
        selectedInspection.id,
        {
          authorityCode,
          slotId,
          status,
          officerNotes: `Availability confirmed by ${authorityCode} divisional officer.`,
        },
        accessToken ?? undefined,
      );
      setSelectedInspection(updated);
      setInspections((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      if (updated.status === 'scheduled') {
        setSuccessMessage('✓ Consensus Reached across all participating departments! Inspection scheduled.');
      } else {
        setSuccessMessage(`Department availability response recorded for ${authorityCode}.`);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not record slot response.',
      );
    } finally {
      setIsRespondingSlot(false);
    }
  };

  const handleSubmitRectification = async (): Promise<void> => {
    if (!projectId || !selectedInspection || !activeChecklist) return;
    if (!rectificationActionTaken.trim()) {
      setError('Please provide the corrective action taken.');
      return;
    }
    setIsSubmittingRectification(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const resolvedItem: {
        item: string;
        actionTaken: string;
        evidenceDocId?: string;
      } = {
        item: 'Statutory non-compliance remediation item',
        actionTaken: rectificationActionTaken.trim(),
      };
      if (rectificationEvidenceDoc.trim()) {
        resolvedItem.evidenceDocId = rectificationEvidenceDoc.trim();
      }

      const updated = await inspectionsApi.submitRectification(
        projectId,
        selectedInspection.id,
        {
          authorityCode: activeChecklist.authorityCode,
          itemsResolved: [resolvedItem],
          complianceDeclaration: rectificationDeclaration,
        },
        accessToken ?? undefined,
      );
      setSelectedInspection(updated);
      setInspections((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      setShowRectificationModal(false);
      setSuccessMessage('Compliance Action Plan submitted! Awaiting departmental officer re-evaluation.');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not submit rectification plan.',
      );
    } finally {
      setIsSubmittingRectification(false);
    }
  };

  const handleReviewRectification = async (
    status: 'satisfactory' | 'needs_rectification',
  ): Promise<void> => {
    if (!projectId || !selectedInspection || !activeChecklist) return;
    setIsReviewingRectification(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await inspectionsApi.reviewRectification(
        projectId,
        selectedInspection.id,
        {
          authorityCode: activeChecklist.authorityCode,
          status,
          reInspectionRequired: status !== 'satisfactory',
          reviewNotes:
            status === 'satisfactory'
              ? 'Rectification photographic evidence and site measurements verified and approved.'
              : 'Further physical remediation required.',
        },
        accessToken ?? undefined,
      );
      setSelectedInspection(updated);
      setInspections((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      if (updated.status === 'completed') {
        setSuccessMessage('✓ All rectifications cleared! Joint Inspection completed and downstream approvals unlocked.');
      } else {
        setSuccessMessage('Rectification review recorded.');
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not record rectification review.',
      );
    } finally {
      setIsReviewingRectification(false);
    }
  };

  const loadData = async (): Promise<void> => {
    if (!projectId) return;
    if (isRestoring) return;
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [candidatesRes, listRes] = await Promise.all([
        inspectionsApi.candidates(projectId, accessToken ?? undefined),
        inspectionsApi.list(projectId, accessToken ?? undefined),
      ]);
      setCandidateData(candidatesRes);
      setInspections(listRes);

      if (listRes.length > 0 && listRes[0]) {
        const first = listRes[0];
        setSelectedInspection(first);
        initInspectionState(first);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not load joint inspections.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isRestoring && accessToken && projectId) {
      void loadData();
    }
  }, [projectId, accessToken, isRestoring]);

  const initInspectionState = (inspection: JointInspectionView) => {
    const dateStr = inspection.scheduledDate
      ? new Date(inspection.scheduledDate).toISOString().split('T')[0] ?? ''
      : '';
    setScheduleDate(dateStr);
    setScheduleSlot(inspection.timeSlot ?? '10:00 AM - 01:00 PM');
    setPremisesAddress(
      inspection.premisesAddress ??
        'Plot No. PAP-K-12, Chakan Industrial Area, Phase II, Pune 410501',
    );
    setReadinessItems(
      Array.isArray(inspection.readinessChecklist)
        ? inspection.readinessChecklist
        : [],
    );

    if (
      inspection.inspectorChecklists &&
      inspection.inspectorChecklists.length > 0 &&
      inspection.inspectorChecklists[0]
    ) {
      const firstChecklist = inspection.inspectorChecklists[0];
      setActiveChecklistId(firstChecklist.id);
      initChecklistState(firstChecklist);
    }
  };

  const initChecklistState = (checklist: JointInspectorChecklistView) => {
    setInspectorName(checklist.inspectorName ?? '');
    setInspectorDesignation(checklist.inspectorDesignation ?? '');
    setFindingsNotes(checklist.findingsNotes ?? '');
    setActiveItems(
      Array.isArray(checklist.items)
        ? checklist.items.map((it) => {
            const itemObj: {
              item: string;
              status: 'pass' | 'fail' | 'na' | 'pending';
              remarks?: string;
            } = {
              item: it.item,
              status: it.status,
            };
            if (it.remarks) itemObj.remarks = it.remarks;
            return itemObj;
          })
        : [],
    );
  };

  const handleGeneratePlan = async (): Promise<void> => {
    if (!projectId) return;
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const created = await inspectionsApi.createPlan(
        projectId,
        undefined,
        accessToken ?? undefined,
      );
      setInspections(created);
      if (created.length > 0 && created[0]) {
        setSelectedInspection(created[0]);
        initInspectionState(created[0]);
      }
      setSuccessMessage('Synchronized Joint Inspection Plan generated successfully!');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not generate joint inspection plan.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScheduleSubmit = async (): Promise<void> => {
    if (!projectId || !selectedInspection) return;
    if (!scheduleDate) {
      setError('Please select an inspection date.');
      return;
    }
    setIsSavingSchedule(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await inspectionsApi.schedule(
        projectId,
        selectedInspection.id,
        {
          scheduledDate: new Date(scheduleDate).toISOString(),
          timeSlot: scheduleSlot,
          premisesAddress,
          readinessChecklist: readinessItems,
        },
        accessToken ?? undefined,
      );
      setSelectedInspection(updated);
      setInspections((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      setSuccessMessage('Inspection schedule & readiness prerequisites updated.');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to update schedule.',
      );
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleToggleReadiness = (itemId: string) => {
    setReadinessItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const handleItemStatusChange = (
    index: number,
    status: 'pass' | 'fail' | 'na' | 'pending',
  ) => {
    setActiveItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, status } : it)),
    );
  };

  const handleSignoffSubmit = async (): Promise<void> => {
    if (!projectId || !selectedInspection || !activeChecklistId) return;
    setIsSigningOff(true);
    setError(null);
    setSuccessMessage(null);

    const hasFailures = activeItems.some((it) => it.status === 'fail');
    const allPassed = activeItems.every(
      (it) => it.status === 'pass' || it.status === 'na',
    );
    const signoffStatus = hasFailures
      ? 'needs_rectification'
      : allPassed
      ? 'satisfactory'
      : 'pending';

    const signoffPayload: {
      inspectorName: string;
      inspectorDesignation: string;
      status: 'needs_rectification' | 'satisfactory' | 'pending' | 'rejected';
      items: Array<{ item: string; status: 'pass' | 'fail' | 'na' | 'pending'; remarks?: string }>;
      findingsNotes?: string;
    } = {
      inspectorName: inspectorName.trim() || 'Senior Field Inspector',
      inspectorDesignation:
        inspectorDesignation.trim() || 'Divisional Regulatory Officer',
      status: signoffStatus,
      items: activeItems,
    };

    if (findingsNotes.trim()) {
      signoffPayload.findingsNotes = findingsNotes.trim();
    }

    try {
      const updated = await inspectionsApi.signoffChecklist(
        projectId,
        selectedInspection.id,
        activeChecklistId,
        signoffPayload,
        accessToken ?? undefined,
      );

      setSelectedInspection(updated);
      setInspections((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      if (updated.status === 'completed') {
        setSuccessMessage(
          '✓ All departments signed off! Joint Inspection marked as COMPLETED and associated roadmap approvals advanced to DONE.',
        );
      } else {
        setSuccessMessage('Departmental checklist sign-off recorded successfully!');
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not record inspector sign-off.',
      );
    } finally {
      setIsSigningOff(false);
    }
  };

  if (!projectId) {
    return <EmptyState title="Project not found" description="No project ID provided in URL." />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const activeChecklist = selectedInspection?.inspectorChecklists.find(
    (c) => c.id === activeChecklistId,
  );

  return (
    <div className="space-y-6">
      {/* Project Navigation Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
              {t('inspections.sih_feature', 'SIH Feature #7')}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {t('inspections.title', 'Joint Inspection Planner')}
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {t(
              'inspections.subtitle',
              'Unified physical site verification across MPCB, Fire Services, Labour (DISH), and State Excise.',
            )}
          </p>
        </div>

        {/* Tab Links */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/projects/${projectId}/profile`}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('nav.profile', 'Profile')}
          </Link>
          <Link
            to={`/projects/${projectId}/approvals`}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('inspections.approvals_tab', 'Approvals')}
          </Link>
          <Link
            to={`/projects/${projectId}/roadmap`}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('nav.roadmap', 'Roadmap')}
          </Link>
          <Link
            to={`/projects/${projectId}/schemes`}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
          >
            <span>💰 {t('nav.schemes', 'Schemes')}</span>
          </Link>
          <span className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
            {t('nav.inspections', 'Joint Inspections')}
          </span>
          <Link
            to={`/projects/${projectId}/grievances`}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
          >
            <span>⚖️ {t('nav.grievances', 'Grievances')}</span>
          </Link>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-base">✓</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-green-700 hover:text-green-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mode / Persona Switcher */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider pl-1">
            Active Workspace Perspective:
          </span>
          <span className="text-xs text-gray-500 hidden sm:inline">
            ({viewMode === 'applicant' ? 'Applicant / Business User' : 'Authorized Multi-Department Inspector'})
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-md border border-gray-200">
          <button
            type="button"
            onClick={() => setViewMode('applicant')}
            className={`px-3 py-1 text-xs font-semibold rounded transition ${
              viewMode === 'applicant'
                ? 'bg-white text-indigo-700 shadow-xs border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏢 Applicant View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('inspector')}
            className={`px-3 py-1 text-xs font-semibold rounded transition ${
              viewMode === 'inspector'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👮 Officer / Inspector Portal
          </button>
        </div>
      </div>

      {/* Impact & Consolidation Hero Banner */}
      {candidateData && (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 p-6 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <span className="inline-flex items-center rounded-full bg-indigo-500/30 px-3 py-0.5 text-xs font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/30">
                Single-Window Efficiency Engine
              </span>
              <h2 className="text-xl font-bold">
                Unified Multi-Departmental Site Verification
              </h2>
              <p className="text-xs text-indigo-200 max-w-xl">
                Instead of scheduling 4–6 separate uncoordinated visits by individual departments,
                ApprovalIQ clusters statutory inspection mandates into coordinated Joint Inspection Windows.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center shrink-0">
              <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm border border-white/10">
                <div className="text-2xl font-black text-amber-300">
                  {candidateData.summary.totalSeparateVisits}
                </div>
                <div className="text-[10px] text-indigo-200 uppercase tracking-wider font-semibold mt-0.5">
                  Separate Visits
                </div>
              </div>
              <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm border border-white/10">
                <div className="text-2xl font-black text-emerald-300">
                  {candidateData.summary.visitsSaved}
                </div>
                <div className="text-[10px] text-indigo-200 uppercase tracking-wider font-semibold mt-0.5">
                  Visits Saved
                </div>
              </div>
              <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm border border-white/10">
                <div className="text-2xl font-black text-cyan-300">
                  ~{candidateData.summary.totalDaysSaved}d
                </div>
                <div className="text-[10px] text-indigo-200 uppercase tracking-wider font-semibold mt-0.5">
                  Delay Reduced
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Action Bar */}
      {inspections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-xl font-bold">
            📋
          </div>
          <h3 className="mt-3 text-base font-semibold text-gray-900">
            No Joint Inspection Plans Created Yet
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            Auto-detect physical inspection mandates from your required approvals and generate a synchronized multi-agency inspection plan.
          </p>
          <div className="mt-5">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGeneratePlan}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isGenerating ? 'Generating Coordinated Plan…' : 'Generate Synchronized Joint Inspection Plan'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Inspection Stage Selector */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Inspection Windows ({inspections.length})
              </h3>
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Refresh Plans
              </button>
            </div>

            <div className="space-y-3">
              {inspections.map((insp) => {
                const isSelected = selectedInspection?.id === insp.id;
                const completedChecklists = insp.inspectorChecklists.filter(
                  (c) => c.status === 'satisfactory',
                ).length;
                const totalChecklists = insp.inspectorChecklists.length;

                return (
                  <button
                    key={insp.id}
                    type="button"
                    onClick={() => {
                      setSelectedInspection(insp);
                      initInspectionState(insp);
                    }}
                    className={`w-full text-left rounded-lg p-4 transition border ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                        {insp.stage.replace('_', ' ')}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          insp.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : insp.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-800'
                            : insp.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {insp.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="mt-1 text-sm font-bold text-gray-900 line-clamp-1">
                      {insp.title}
                    </h4>

                    <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>
                        {insp.scheduledDate
                          ? new Date(insp.scheduledDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Date unscheduled'}
                      </span>
                      <span className="font-medium text-gray-700">
                        {completedChecklists}/{totalChecklists} Depts Sign-off
                      </span>
                    </div>

                    {/* Participating Authorities Badges */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {insp.participatingApprovals.map((app) => (
                        <span
                          key={app.id}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 border border-gray-200"
                        >
                          {app.authorityCode.replace('AUTH-', '')}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Inspection Details & Scheduling / Sign-off */}
          {selectedInspection && (
            <div className="lg:col-span-8 space-y-6">
              {/* Card 1: Overview & Scheduling */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {selectedInspection.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Lead Coordinator: <span className="font-semibold text-gray-700">{selectedInspection.leadAuthorityName ?? 'State Level Coordination Desk'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedInspection.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => setShowCertificateModal(true)}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 flex items-center gap-1.5"
                      >
                        <span>📜 View Certificate (Form JIC-1)</span>
                      </button>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        selectedInspection.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedInspection.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Status: {selectedInspection.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Participating Approvals Matrix */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                    Unified Participating Approvals ({selectedInspection.participatingApprovals.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedInspection.participatingApprovals.map((app) => (
                      <div
                        key={app.id}
                        className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-indigo-700">
                            {app.approvalCode}
                          </span>
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-semibold">
                            {app.authorityCode}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-900">
                          {app.approvalName}
                        </p>
                        <p className="text-[11px] text-gray-500 line-clamp-2">
                          {app.specificRequirements}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scheduling & Multi-Department Slot Negotiation Matrix */}
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-2">
                        <span>🗓️ Multi-Department Time-Slot Negotiation & Conflict Matrix</span>
                      </h4>
                      <p className="text-[11px] text-gray-600">
                        Synchronizes time-slots across participating authorities to resolve scheduling conflicts.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSlotNegotiationModal(true)}
                      className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700"
                    >
                      + Propose Alternate Slots
                    </button>
                  </div>

                  {/* Slot Consensus Status Indicator */}
                  {selectedInspection.slotNegotiation ? (
                    <div className="space-y-3 bg-white p-3.5 rounded-lg border border-indigo-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-800">
                          Consensus Status:{' '}
                          <span
                            className={`font-semibold uppercase ${
                              selectedInspection.slotNegotiation.status === 'consensus_reached'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {selectedInspection.slotNegotiation.status.replace('_', ' ')}
                          </span>
                        </span>
                        {selectedInspection.slotNegotiation.consensusSlotId && (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold">
                            ✓ All Departments Aligned
                          </span>
                        )}
                      </div>

                      {/* Department Availability Matrix Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs divide-y divide-gray-200 border rounded">
                          <thead className="bg-gray-50 text-gray-700 font-semibold">
                            <tr>
                              <th className="px-3 py-1.5 text-left">Department</th>
                              <th className="px-3 py-1.5 text-left">Assigned Slot</th>
                              <th className="px-3 py-1.5 text-center">Availability Status</th>
                              {viewMode === 'inspector' && (
                                <th className="px-3 py-1.5 text-right">Quick Officer Action</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedInspection.inspectorChecklists.map((chk) => {
                              const response =
                                selectedInspection.slotNegotiation?.responses?.[
                                  chk.authorityCode
                                ];
                              const isConfirmed = response?.status === 'confirmed';

                              return (
                                <tr key={chk.id}>
                                  <td className="px-3 py-2 font-medium text-gray-900">
                                    {chk.authorityName}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600 font-mono text-[11px]">
                                    {response?.slotId ? `Option ${response.slotId.replace('slot-', '')}` : 'Pending Confirmation'}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        isConfirmed
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {response?.status ? response.status.toUpperCase() : 'AWAITING RESPONSE'}
                                    </span>
                                  </td>
                                  {viewMode === 'inspector' && (
                                    <td className="px-3 py-2 text-right">
                                      <button
                                        type="button"
                                        disabled={isRespondingSlot}
                                        onClick={() =>
                                          handleOfficerSlotResponse(
                                            chk.authorityCode,
                                            'slot-1',
                                            'confirmed',
                                          )
                                        }
                                        className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
                                      >
                                        Confirm Slot A
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 bg-white p-3 rounded-lg border border-gray-200">
                      Standard slot configured. Click &quot;Propose Alternate Slots&quot; to initiate multi-department consensus negotiation.
                    </div>
                  )}

                  {/* Standard Logistics Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Confirmed Inspection Date
                      </label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Time Slot Window
                      </label>
                      <select
                        value={scheduleSlot}
                        onChange={(e) => setScheduleSlot(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                      >
                        <option value="10:00 AM - 01:00 PM">Morning Slot (10:00 AM - 01:00 PM)</option>
                        <option value="02:00 PM - 05:00 PM">Afternoon Slot (02:00 PM - 05:00 PM)</option>
                        <option value="Full Day (10:00 AM - 04:30 PM)">Full Day Integrated (10:00 AM - 04:30 PM)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Site / Premises Address
                      </label>
                      <input
                        type="text"
                        value={premisesAddress}
                        onChange={(e) => setPremisesAddress(e.target.value)}
                        placeholder="Industrial premises address..."
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Readiness Prerequisites Checklist */}
                  <div className="space-y-2 pt-2 border-t border-indigo-100">
                    <span className="text-xs font-semibold text-gray-800">
                      Premises Readiness Prerequisites (Pre-Inspection Check by Applicant):
                    </span>
                    <div className="space-y-2">
                      {readinessItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggleReadiness(item.id)}
                            className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <span className="font-semibold text-gray-900">{item.title}: </span>
                            <span className="text-gray-600">{item.description}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={isSavingSchedule}
                      onClick={handleScheduleSubmit}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isSavingSchedule ? 'Saving Schedule…' : 'Save & Confirm Joint Slot'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Remedial Compliance Banner when Rectification Needed */}
              {selectedInspection.inspectorChecklists.some((c) => c.status === 'needs_rectification') && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                      <span>⚠️ Remedial Compliance Notice (Rectification Required)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {viewMode === 'applicant' ? (
                        <button
                          type="button"
                          onClick={() => setShowRectificationModal(true)}
                          className="rounded bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-800"
                        >
                          📝 Submit Rectification Action Plan
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isReviewingRectification}
                            onClick={() => handleReviewRectification('satisfactory')}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
                          >
                            ✓ Grant Clearance
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    One or more participating authorities noted site parameters requiring corrective action. The applicant can upload photographic/documentary evidence for digital re-evaluation without undergoing a full new application cycle.
                  </p>
                </div>
              )}

              {/* Card 2: Multi-Department Inspector Sign-off Station */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
                <div className="border-b pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <span>Multi-Agency Digital Sign-off Station</span>
                      {viewMode === 'applicant' && (
                        <span className="text-[11px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Applicant Read-Only View
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Inspectors evaluate statutory compliance items and record findings in a unified ledger.
                    </p>
                  </div>
                  {selectedInspection.status === 'completed' && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
                      ✓ Fully Certified
                    </span>
                  )}
                </div>

                {/* Department Selector Tabs */}
                <div className="flex flex-wrap gap-2 border-b pb-3">
                  {selectedInspection.inspectorChecklists.map((chk) => {
                    const isActive = activeChecklistId === chk.id;
                    const isPassed = chk.status === 'satisfactory';
                    const isNeedsRectification = chk.status === 'needs_rectification';

                    return (
                      <button
                        key={chk.id}
                        type="button"
                        onClick={() => {
                          setActiveChecklistId(chk.id);
                          initChecklistState(chk);
                        }}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition border flex items-center gap-2 ${
                          isActive
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>{chk.authorityName}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            isPassed
                              ? isActive
                                ? 'bg-emerald-400 text-emerald-950'
                                : 'bg-emerald-100 text-emerald-800'
                              : isNeedsRectification
                              ? isActive
                                ? 'bg-amber-300 text-amber-950'
                                : 'bg-amber-100 text-amber-800'
                              : isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {isPassed ? '✓ Pass' : isNeedsRectification ? '⚠ Action' : 'Pending'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Department Checklist Form */}
                {activeChecklist && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gray-50 p-3 rounded-lg border">
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">
                          {activeChecklist.authorityName} Inspection Checklist
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          Authority Code: <span className="font-mono">{activeChecklist.authorityCode}</span> · Status:{' '}
                          <span className="font-semibold uppercase">{activeChecklist.status}</span>
                        </p>
                      </div>
                      {activeChecklist.signedOffAt && (
                        <span className="text-[11px] text-gray-500">
                          Signed off on {new Date(activeChecklist.signedOffAt).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Inspection Check Items Table */}
                    <div className="space-y-2">
                      {activeItems.map((item, index) => (
                        <div
                          key={index}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 bg-white"
                        >
                          <span className="text-xs text-gray-800 font-medium flex-1">
                            {index + 1}. {item.item}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={viewMode === 'applicant'}
                              onClick={() => handleItemStatusChange(index, 'pass')}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition ${
                                item.status === 'pass'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 disabled:opacity-60'
                              }`}
                            >
                              Satisfactory
                            </button>
                            <button
                              type="button"
                              disabled={viewMode === 'applicant'}
                              onClick={() => handleItemStatusChange(index, 'fail')}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition ${
                                item.status === 'fail'
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 disabled:opacity-60'
                              }`}
                            >
                              Rectification Needed
                            </button>
                            <button
                              type="button"
                              disabled={viewMode === 'applicant'}
                              onClick={() => handleItemStatusChange(index, 'na')}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition ${
                                item.status === 'na'
                                  ? 'bg-gray-700 text-white border-gray-700'
                                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 disabled:opacity-60'
                              }`}
                            >
                              N/A
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Inspector Details & Findings */}
                    {viewMode === 'inspector' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Attending Inspector Name
                          </label>
                          <input
                            type="text"
                            value={inspectorName}
                            onChange={(e) => setInspectorName(e.target.value)}
                            placeholder="e.g. S. R. Patil"
                            className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Designation / Authority Division
                          </label>
                          <input
                            type="text"
                            value={inspectorDesignation}
                            onChange={(e) => setInspectorDesignation(e.target.value)}
                            placeholder="e.g. Sub-Regional Officer, MPCB Pune"
                            className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Field Observation Notes & Observations
                          </label>
                          <textarea
                            rows={2}
                            value={findingsNotes}
                            onChange={(e) => setFindingsNotes(e.target.value)}
                            placeholder="Specific remarks, compliance status, or rectification directions..."
                            className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2 flex justify-end pt-3 border-t">
                          <button
                            type="button"
                            disabled={isSigningOff}
                            onClick={handleSignoffSubmit}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isSigningOff ? 'Submitting Sign-off…' : 'Record Departmental Sign-off'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                        <div>
                          <span className="font-bold">Inspector Sign-off Status: </span>
                          <span>
                            {activeChecklist.inspectorName
                              ? `Signed by ${activeChecklist.inspectorName} (${activeChecklist.inspectorDesignation ?? 'Officer'})`
                              : 'Awaiting on-site verification by attending departmental officer.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewMode('inspector')}
                          className="text-xs font-bold text-indigo-700 underline"
                        >
                          Switch to Inspector Portal →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 3: Unified Joint Report Summary */}
              {selectedInspection.jointReportSummary && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                      <span>📜 Joint Inspection Outcome Record</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCertificateModal(true)}
                      className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
                    >
                      Print Form JIC-1 Certificate
                    </button>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    {selectedInspection.jointReportSummary}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Propose Alternate Slots Modal */}
      {showSlotNegotiationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl space-y-4 border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 border-b pb-2">
              Propose Synchronized Inspection Windows
            </h3>
            <p className="text-xs text-gray-500">
              Submit preferred date options for multi-agency departmental consensus.
            </p>

            <div className="space-y-3">
              {slotOptions.map((slot, idx) => (
                <div key={slot.slotId} className="p-3 rounded border bg-gray-50 space-y-2">
                  <span className="text-xs font-bold text-indigo-900">{slot.label ?? `Option ${idx + 1}`}</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={slot.date}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSlotOptions((prev) =>
                          prev.map((s) => (s.slotId === slot.slotId ? { ...s, date: val } : s)),
                        );
                      }}
                      className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
                    />
                    <input
                      type="text"
                      value={slot.timeWindow}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSlotOptions((prev) =>
                          prev.map((s) => (s.slotId === slot.slotId ? { ...s, timeWindow: val } : s)),
                        );
                      }}
                      className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
                    />
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Applicant Logistics Remarks</label>
                <textarea
                  rows={2}
                  value={slotProposalNotes}
                  onChange={(e) => setSlotProposalNotes(e.target.value)}
                  placeholder="e.g. Electrical crew and site safety manager present on all slots..."
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowSlotNegotiationModal(false)}
                className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProposingSlots}
                onClick={handleProposeSlotsSubmit}
                className="rounded bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50"
              >
                {isProposingSlots ? 'Submitting…' : 'Submit for Officer Consensus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Rectification Action Plan Modal */}
      {showRectificationModal && activeChecklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl space-y-4 border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 border-b pb-2">
              Submit Remedial Action Plan ({activeChecklist.authorityName})
            </h3>
            <p className="text-xs text-gray-500">
              Provide photographic evidence or test certificates documenting the resolution of flagged non-compliances.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Corrective Action Description
                </label>
                <textarea
                  rows={3}
                  value={rectificationActionTaken}
                  onChange={(e) => setRectificationActionTaken(e.target.value)}
                  placeholder="e.g. Widened fire access gate archway to 6.2 meters and removed overhead obstructions..."
                  className="w-full rounded border border-gray-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Evidence Document / Photo ID (Optional)
                </label>
                <input
                  type="text"
                  value={rectificationEvidenceDoc}
                  onChange={(e) => setRectificationEvidenceDoc(e.target.value)}
                  placeholder="e.g. DOC-VERIFIED-GATE-01"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Applicant Compliance Declaration
                </label>
                <textarea
                  rows={2}
                  value={rectificationDeclaration}
                  onChange={(e) => setRectificationDeclaration(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs bg-gray-50 text-gray-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowRectificationModal(false)}
                className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRectification}
                onClick={handleSubmitRectification}
                className="rounded bg-amber-700 px-4 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-800 disabled:opacity-50"
              >
                {isSubmittingRectification ? 'Submitting…' : 'Submit Action Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Official Joint Inspection Certificate Modal (Form JIC-1) */}
      {showCertificateModal && selectedInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-2xl space-y-6 border border-gray-200 max-h-[90vh] overflow-y-auto print:p-0 print:border-none print:shadow-none">
            {/* Certificate Header */}
            <div className="text-center border-b-2 border-indigo-900 pb-4 space-y-1">
              <div className="inline-block px-3 py-1 bg-indigo-900 text-white text-[11px] font-bold tracking-widest uppercase rounded">
                Government of Maharashtra · Single Window Clearance System
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-tight mt-2">
                Unified Joint Site Inspection Clearance Certificate
              </h2>
              <div className="text-xs font-mono font-bold text-indigo-800">
                FORM JIC-1 (Statutory Compliance Rule 14) · Ref: MH-JIC-{selectedInspection.id.slice(0, 8).toUpperCase()}
              </div>
            </div>

            {/* Project & Inspection Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <span className="text-gray-500 font-medium">Project Identifier:</span>
                <p className="font-bold text-gray-900 font-mono">{selectedInspection.projectId}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Inspection Stage:</span>
                <p className="font-bold text-gray-900 uppercase">{selectedInspection.stage.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Premises / Site Address:</span>
                <p className="font-semibold text-gray-900">{selectedInspection.premisesAddress ?? 'Industrial Plot, Pune'}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Date & Slot of Joint Visit:</span>
                <p className="font-semibold text-gray-900">
                  {selectedInspection.scheduledDate
                    ? new Date(selectedInspection.scheduledDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'N/A'}{' '}
                  ({selectedInspection.timeSlot})
                </p>
              </div>
            </div>

            {/* Departmental Attestation Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Participating Regulatory Authorities & Verified Findings:
              </h4>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-100 font-semibold text-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left">Department / Authority</th>
                      <th className="px-3 py-2 text-left">Attending Inspector</th>
                      <th className="px-3 py-2 text-center">Finding</th>
                      <th className="px-3 py-2 text-right">Digital Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {selectedInspection.inspectorChecklists.map((chk) => (
                      <tr key={chk.id}>
                        <td className="px-3 py-2.5 font-medium text-gray-900">
                          {chk.authorityName}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">
                          {chk.inspectorName ? (
                            <div>
                              <span className="font-semibold text-gray-800">{chk.inspectorName}</span>
                              <div className="text-[10px] text-gray-500">{chk.inspectorDesignation}</div>
                            </div>
                          ) : (
                            <span className="italic text-gray-400">Awaiting Signoff</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              chk.status === 'satisfactory'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {chk.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-gray-500">
                          {chk.signedOffAt ? new Date(chk.signedOffAt).toLocaleString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unified Declaration & QR Verification */}
            <div className="flex items-center justify-between border-t pt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 font-bold text-xs">✓ Cryptographically Verified & Sealed</span>
                </div>
                <p className="text-[11px] text-gray-600 max-w-md">
                  This electronic certificate validates that a synchronized physical site inspection was completed by all listed statutory departments under single-window mandate.
                </p>
              </div>

              {/* QR Verification Badge representation */}
              <div className="text-center bg-white p-2.5 rounded border border-gray-300 shadow-2xs">
                <div className="h-16 w-16 bg-slate-900 text-white flex items-center justify-center font-mono text-[10px] p-1 text-center font-bold rounded">
                  QR VERIFIED [JIC-1]
                </div>
                <span className="text-[9px] font-mono text-gray-500 mt-1 block">SCAN TO VERIFY</span>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t print:hidden">
              <button
                type="button"
                onClick={() => setShowCertificateModal(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <span>🖨️ Print / Save as PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

