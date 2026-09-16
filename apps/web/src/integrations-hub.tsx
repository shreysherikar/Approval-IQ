import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from './auth';
import { useLanguage } from './i18n';
import { integrationsApi, type ExternalPortalAdapter } from './api-client';
import { LoadingSpinner, ErrorBanner } from './components';

export function IntegrationsHubPage(): JSX.Element {
  const { accessToken } = useAuth();
  const { isMarathi } = useLanguage();
  const [selectedAdapter, setSelectedAdapter] = useState<ExternalPortalAdapter | null>(null);
  const [docType, setDocType] = useState('DOC-PAN');
  const [docNumber, setDocNumber] = useState('AAACP1234F');
  const [digiResult, setDigiResult] = useState<Record<string, unknown> | null>(null);

  const [exportPortal, setExportPortal] = useState<'maitri' | 'nsws'>('maitri');
  const [exportApprovalCode, setExportApprovalCode] = useState('MPCB-CTE-001');
  const [exportResult, setExportResult] = useState<Record<string, unknown> | null>(null);

  const adaptersQuery = useQuery({
    queryKey: ['integration-adapters'],
    queryFn: () => integrationsApi.getAdapters(accessToken ?? undefined),
  });

  const digiMutation = useMutation({
    mutationFn: () => integrationsApi.fetchDigiLocker({ docType, docNumber }, accessToken ?? undefined),
    onSuccess: (data) => setDigiResult(data),
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      integrationsApi.exportPacket(
        {
          portalCode: exportPortal,
          projectId: 'demo-project-pune',
          approvalCode: exportApprovalCode,
          packetId: `PKT-${Date.now()}`,
        },
        accessToken ?? undefined,
      ),
    onSuccess: (data) => setExportResult(data),
  });

  if (adaptersQuery.isLoading) {
    return (
      <LoadingSpinner
        label={
          isMarathi
            ? 'राष्ट्रीय व राज्य एक खिडकी गेटवे अ‍ॅडॉप्टर्सशी जोडत आहे…'
            : 'Connecting to National & State Gateway Adapters…'
        }
      />
    );
  }

  if (adaptersQuery.isError) {
    return (
      <ErrorBanner
        message={
          isMarathi
            ? 'एकत्रीकरण गेटवे अ‍ॅडॉप्टर्स लोड करता आले नाहीत.'
            : 'Could not load integration gateway adapters.'
        }
      />
    );
  }

  const adapters = adaptersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center gap-2 text-xs font-mono text-blue-600 font-bold uppercase tracking-wider">
          <span>{isMarathi ? 'आंतरकार्यक्षमता स्तर' : 'Interoperability Layer'}</span>
          <span>•</span>
          <span>API Setu &amp; National Single Window</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
          {isMarathi
            ? 'राज्य व राष्ट्रीय एक खिडकी (Single Window) हब'
            : 'State & National Gateway Hub'}
        </h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          {isMarathi
            ? 'ApprovalIQ हे राज्य एक खिडकी (MAITRI), राष्ट्रीय पोर्टल (NSWS) आणि डिजिलॉकर (DigiLocker) सोबत थेट जोडलेले बुद्धिमान ऑर्केस्ट्रेशन इंजिन आहे.'
            : 'ApprovalIQ acts as an intelligent orchestration engine feeding bi-directionally into State Single Windows (MAITRI), the National Single Window System (NSWS), and DigiLocker.'}
        </p>
      </div>

      {/* Gateway Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adapters.map((adapter) => {
          const isSelected = selectedAdapter?.portalCode === adapter.portalCode;
          return (
            <div
              key={adapter.portalCode}
              onClick={() => setSelectedAdapter(adapter)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-800">
                  {adapter.portalCode.toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {adapter.status.replace('_', ' ')}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-bold text-gray-900 leading-snug">
                {adapter.portalName}
              </h3>
              <p className="mt-1 text-xs text-gray-500">{adapter.jurisdiction}</p>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-600">
                <span>Sync: <strong>{adapter.syncDirection}</strong></span>
                <span>{adapter.supportedEntities.length} entities</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Simulation Sandbox */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* DigiLocker Credential Pull Sandbox */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-indigo-100 p-2 text-indigo-700 font-bold text-xs">
              DL
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                DigiLocker / API Setu Credential Verification
              </h2>
              <p className="text-xs text-gray-500">Pull digitally signed, authentic certificates directly from MeitY.</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
              >
                <option value="DOC-PAN">Income Tax Department PAN Certificate</option>
                <option value="DOC-GST">GSTIN Registration Certificate (Form REG-06)</option>
                <option value="DOC-TITLE-7-12">Maharashtra Land Revenue Record (7/12 Extract)</option>
                <option value="DOC-TRADE-LICENCE">Municipal Trade Licence (Urban Local Body)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Identifier / Certificate Number</label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs font-mono"
              />
            </div>

            <button
              type="button"
              disabled={digiMutation.isPending}
              onClick={() => digiMutation.mutate()}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 shadow transition-colors disabled:opacity-50"
            >
              {digiMutation.isPending ? 'Fetching from DigiLocker Gateway…' : 'Pull & Verify Digital Credential →'}
            </button>
          </div>

          {digiResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-1.5 text-xs animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900">✓ DigiLocker Cryptographic Proof Valid</span>
                <span className="font-mono text-[10px] text-emerald-700">{String(digiResult['digiLockerDocId'])}</span>
              </div>
              <p className="text-emerald-700 text-[11px]">
                eSign Verification: <strong>{String((digiResult['digitalSignature'] as Record<string, unknown> | undefined)?.['signedBy'] ?? 'DigiLocker CA')}</strong> (Valid RSA-256)
              </p>
            </div>
          )}
        </div>

        {/* State Single-Window Outbound Push Sandbox */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-100 p-2 text-blue-700 font-bold text-xs">
              NSW
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Single-Window Push Adapter (MAITRI / NSWS)
              </h2>
              <p className="text-xs text-gray-500">Export sealed dossier to government departmental single-window clearinghouses.</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Target Single Window Portal</label>
              <select
                value={exportPortal}
                onChange={(e) => setExportPortal(e.target.value as 'maitri' | 'nsws')}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
              >
                <option value="maitri">MAITRI (Maharashtra Industry Facilitation Cell)</option>
                <option value="nsws">National Single Window System (NSWS Central)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Approval Statutory Clearance Code</label>
              <input
                type="text"
                value={exportApprovalCode}
                onChange={(e) => setExportApprovalCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs font-mono"
              />
            </div>

            <button
              type="button"
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow transition-colors disabled:opacity-50"
            >
              {exportMutation.isPending ? 'Transmitting Sealed Dossier…' : 'Push Submission Dossier to Gateway →'}
            </button>
          </div>

          {exportResult && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-1.5 text-xs animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900">✓ Export Acknowledged by Government Gateway</span>
                <span className="font-mono text-[10px] text-blue-700">{String(exportResult['remoteTransactionId'])}</span>
              </div>
              <p className="text-blue-800">Target: <strong>{String(exportResult['targetPortal'])}</strong></p>
              <div className="pt-1 text-[11px]">
                <a
                  href={String(exportResult['portalReceiptUrl'])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-blue-700 hover:underline"
                >
                  View Gateway Electronic Receipt ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
