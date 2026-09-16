import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Gift,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sliders,
  ExternalLink,
  ShieldAlert,
  Layers,
  Lightbulb,
  Check,
  RefreshCw,
  Scale,
} from 'lucide-react';
import { useAuth } from './auth';
import { useLanguage } from './i18n';
import {
  roadmapApi,
  type RoadmapResponse,
} from './api-client';
import { EmptyState, LoadingSpinner } from './components';
import { SCHEME_ADVISORY_MAP } from './roadmap';
import { PROFILE_FIELD_LABELS } from './profile-form';

/**
 * ---------------------------------------------------------------------------
 * WHAT-IF / SENSITIVITY SIMULATION RULE DEFINITIONS & GATING MATRIX
 * ---------------------------------------------------------------------------
 * Dossier Part 7.1 & 11.1:
 * Computes "Eligible If" guidance with precise numeric gaps and statutory citations:
 * e.g., "You would qualify for PSI-2019 Capital Subsidy if sector shifted from alcohol to agro/food or investment exceeded threshold"
 * e.g., "Eligible for CGTMSE collateral-free loan up to ₹5 Cr if enterprise is Udyam MSME registered"
 */

interface SchemeSensitivityRule {
  schemeId: string;
  schemeName: string;
  category: 'state_industrial' | 'msme_credit' | 'tax_direct' | 'export' | 'green_energy';
  categoryLabel: string;
  statutoryBasis: string;
  statutoryCitation: string;
  statutoryNegativeListClauses?: string[];
  maxBenefitSummary: string;
  evaluator: (params: SimulationParams) => {
    isEligible: boolean;
    status: 'eligible' | 'excluded' | 'threshold_shortfall' | 'profile_prerequisite_needed';
    verdictTitle: string;
    verdictReason: string;
    eligibleIfGuidance?: string;
    gapMetrics?: Array<{ label: string; current: string; required: string; gap: string }>;
    potentialBenefitEstInr: number;
    benefitFormatted: string;
  };
}

export interface SimulationParams {
  industry: string;
  investmentCr: number;
  employees: number;
  talukaZone: 'A' | 'B' | 'C' | 'D' | 'D_PLUS' | 'VIDARBHA_MARATHWADA';
  isStartupRegistered: boolean;
  isUdyamRegistered: boolean;
  hasGreenRenewableComponent: boolean;
  exportTurnoverPercentage: number;
}

const SCHEME_SENSITIVITY_CATALOG: SchemeSensitivityRule[] = [
  {
    schemeId: 'SCHEME-PSI-2019',
    schemeName: 'Maharashtra Package Scheme of Incentives (PSI-2019)',
    category: 'state_industrial',
    categoryLabel: 'State Fiscal & Industrial Policy',
    statutoryBasis: 'Government Resolution No. PSI-2019/CR-46/IND-8, Industries Department, Govt of Maharashtra',
    statutoryCitation: 'Annexure II: Negative List of Ineligible Industries (Clause 4.1 & Item 7: Beer, Potable Alcohol, Distilleries & Tobacco)',
    statutoryNegativeListClauses: [
      'Annexure II, Item 7: Manufacture of Potable Liquor, Beer, Wine, Rectified Spirit and Country Liquor',
      'Annexure II, Item 3: Tobacco and Tobacco-related manufacturing processing',
    ],
    maxBenefitSummary: 'Up to 100% Fixed Capital Investment (FCI) SGST reimbursement + 100% Electricity Duty Exemption for 10 Years',
    evaluator: (params) => {
      const isNegativeSector = params.industry === 'brewery' || params.industry === 'distillery' || params.industry === 'tobacco';
      if (isNegativeSector) {
        return {
          isEligible: false,
          status: 'excluded',
          verdictTitle: 'Ineligible — Annexure II Statutory Negative List Exclusion',
          verdictReason: 'Beer, brewery, and potable alcohol manufacturing are statutorily barred from state fiscal cash subsidies and SGST refunds under Maharashtra PSI-2019 Annexure II (GR No. PSI-2019/CR-46/IND-8).',
          eligibleIfGuidance: 'You would qualify for up to ₹25 Cr (100% FCI) capital subsidy & 100% power duty waiver if the activity is diversified into Agro-Food Processing (PMFME), Packaged Beverage, or Cold-Chain Logistics in Taluka Zone C/D.',
          gapMetrics: [
            { label: 'Statutory Sector Whitelist', current: 'Brewery (Negative List)', required: 'Agro/Food/General Mfg', gap: 'Sector Switch Required' },
            { label: 'Taluka Zone Multiplier', current: `Zone ${params.talukaZone}`, required: 'Zone C, D, D+ or Vidarbha', gap: params.talukaZone === 'A' ? 'Move to Zone C/D for 100% FCI' : 'Eligible Zone' },
          ],
          potentialBenefitEstInr: 0,
          benefitFormatted: '₹0 (Excluded by Negative List)',
        };
      }

      // If not negative list:
      const minInvestmentRequired = params.talukaZone === 'A' ? 50 : params.talukaZone === 'B' ? 25 : 10;
      if (params.investmentCr < minInvestmentRequired) {
        return {
          isEligible: false,
          status: 'threshold_shortfall',
          verdictTitle: 'Investment Below Minimum Project Scale for Zone',
          verdictReason: `In Taluka Zone ${params.talukaZone}, the minimum fixed capital investment threshold is ₹${minInvestmentRequired} Cr. Current investment is ₹${params.investmentCr} Cr.`,
          eligibleIfGuidance: `You would qualify if fixed capital investment increased by ₹${(minInvestmentRequired - params.investmentCr).toFixed(1)} Cr or if the unit relocates to Taluka Zone C/D where the threshold is ₹10 Cr.`,
          gapMetrics: [
            { label: 'Fixed Capital Investment', current: `₹${params.investmentCr} Cr`, required: `₹${minInvestmentRequired} Cr`, gap: `+₹${(minInvestmentRequired - params.investmentCr).toFixed(1)} Cr needed` },
            { label: 'Minimum Direct Employment', current: `${params.employees} Staff`, required: '50+ Staff', gap: params.employees >= 50 ? 'Met' : `${50 - params.employees} more staff needed` },
          ],
          potentialBenefitEstInr: 0,
          benefitFormatted: `Potential: ₹${(params.investmentCr * 0.7).toFixed(1)} Cr upon threshold qualification`,
        };
      }

      const benefitMultiplier = params.talukaZone === 'VIDARBHA_MARATHWADA' || params.talukaZone === 'D_PLUS' ? 1.0 : params.talukaZone === 'D' ? 0.8 : params.talukaZone === 'C' ? 0.6 : 0.4;
      const benefitEst = params.investmentCr * benefitMultiplier;
      return {
        isEligible: true,
        status: 'eligible',
        verdictTitle: 'Eligible for Industrial Promotion Subsidy (IPS)',
        verdictReason: `Unit satisfies non-negative sector criteria and exceeds ₹${minInvestmentRequired} Cr threshold in Taluka Zone ${params.talukaZone}.`,
        eligibleIfGuidance: `Maintain commercial production and file annual SGST refund claims on MAITRI to draw up to ₹${benefitEst.toFixed(2)} Cr over 7–10 years.`,
        gapMetrics: [
          { label: 'Fixed Capital Investment', current: `₹${params.investmentCr} Cr`, required: `₹${minInvestmentRequired} Cr`, gap: '✓ Met' },
          { label: 'Direct Employment', current: `${params.employees} Staff`, required: '50+ Staff', gap: params.employees >= 50 ? '✓ Met' : 'Met' },
        ],
        potentialBenefitEstInr: benefitEst * 10_000_000,
        benefitFormatted: `₹${benefitEst.toFixed(2)} Cr Subsidy Cap (IPS + Power Duty)`,
      };
    },
  },
  {
    schemeId: 'MSME-CGTMSE-001',
    schemeName: 'Credit Guarantee Scheme for Micro & Small Enterprises (CGTMSE)',
    category: 'msme_credit',
    categoryLabel: 'MSME & Collateral-Free Credit',
    statutoryBasis: 'Credit Guarantee Fund Trust for Micro and Small Enterprises (SIDBI & Ministry of MSME, GoI)',
    statutoryCitation: 'CGTMSE Operating Guidelines Circular No. 214/2023-24 (Credit Guarantee up to ₹500 Lakhs)',
    maxBenefitSummary: '75%–85% Credit Guarantee on Term Loans & Working Capital up to ₹5 Crore without property mortgage',
    evaluator: (params) => {
      if (!params.isUdyamRegistered) {
        return {
          isEligible: false,
          status: 'profile_prerequisite_needed',
          verdictTitle: 'Udyam MSME Registration Prerequisite Missing',
          verdictReason: 'CGTMSE member lending institutions (MLIs) require an active statutory Udyam Registration Number linked to the enterprise PAN.',
          eligibleIfGuidance: 'You would qualify for ₹5.00 Cr collateral-free loan sanction immediately upon completing free Udyam registration (takes 10 minutes on udyamregistration.gov.in).',
          gapMetrics: [
            { label: 'Udyam MSME Certificate', current: 'Not Registered', required: 'Active Udyam ID', gap: 'Register on portal' },
            { label: 'Eligible Loan Facility', current: 'Standard Loan', required: 'Up to ₹5 Cr', gap: 'Instant unlock' },
          ],
          potentialBenefitEstInr: 50_000_000,
          benefitFormatted: '₹5.00 Cr Collateral-Free Credit Guarantee (Pending Udyam)',
        };
      }

      return {
        isEligible: true,
        status: 'eligible',
        verdictTitle: '100% Eligible for ₹5 Cr Collateral-Free Credit Guarantee',
        verdictReason: 'Enterprise holds Udyam status and qualifies under manufacturing micro/small enterprise priority lending framework.',
        eligibleIfGuidance: 'Present Detailed Project Report (DPR) to any nationalized or private scheduled bank under CGTMSE to waive commercial property mortgage.',
        gapMetrics: [
          { label: 'Udyam MSME Certificate', current: 'Active', required: 'Active Udyam ID', gap: '✓ Met' },
          { label: 'Guarantee Cover', current: '85% SIDBI Cover', required: '75%–85%', gap: '✓ Met' },
        ],
        potentialBenefitEstInr: 50_000_000,
        benefitFormatted: '₹5.00 Cr Collateral-Free Credit Guarantee',
      };
    },
  },
  {
    schemeId: 'STARTUP-80IAC-001',
    schemeName: 'Section 80-IAC Corporate Income Tax Exemption',
    category: 'tax_direct',
    categoryLabel: 'Central Direct Tax Incentive',
    statutoryBasis: 'Section 80-IAC of Income Tax Act 1961 (CBDT & DPIIT Notification G.S.R. 127(E))',
    statutoryCitation: 'Finance Act 2016 as amended by Finance Act 2024 — 100% deduction of profits for 3 consecutive years out of 10 years',
    maxBenefitSummary: '100% Corporate Income Tax Holiday for 3 consecutive financial years',
    evaluator: (params) => {
      if (!params.isStartupRegistered) {
        return {
          isEligible: false,
          status: 'profile_prerequisite_needed',
          verdictTitle: 'DPIIT Startup Recognition Certificate Required',
          verdictReason: 'Section 80-IAC requires Inter-Ministerial Board (IMB) certification granted to DPIIT-recognized private limited companies / LLPs.',
          eligibleIfGuidance: 'You would save ~25% corporate tax on all profits for 3 full years if you register entity on startupindia.gov.in and file Form-1 IMB application.',
          gapMetrics: [
            { label: 'DPIIT Recognition', current: 'Not Recognized', required: 'Active DPIIT ID', gap: 'Apply on Startup India' },
            { label: 'Incorporation Window', current: 'Active', required: 'Post 01-Apr-2016', gap: '✓ Met' },
          ],
          potentialBenefitEstInr: 15_000_000,
          benefitFormatted: '100% Corporate Tax Holiday (3 Years)',
        };
      }

      return {
        isEligible: true,
        status: 'eligible',
        verdictTitle: 'Eligible for Section 80-IAC 3-Year Complete Tax Holiday',
        verdictReason: 'Entity possesses DPIIT credentials and is eligible to submit Form-1 before the Inter-Ministerial Board on NSWS.',
        eligibleIfGuidance: 'Elect your 3-year consecutive tax holiday block during peak revenue years within the 10-year window to maximize tax savings.',
        gapMetrics: [
          { label: 'DPIIT Recognition', current: 'Active', required: 'Active DPIIT ID', gap: '✓ Met' },
          { label: 'Tax Deduction', current: '100% of profits', required: 'Schedule 80-IAC', gap: '✓ Met' },
        ],
        potentialBenefitEstInr: 15_000_000,
        benefitFormatted: '100% Corporate Tax Holiday (3 Consecutive Years)',
      };
    },
  },
  {
    schemeId: 'DGFT-EPCG-001',
    schemeName: 'Export Promotion Capital Goods (EPCG) Scheme',
    category: 'export',
    categoryLabel: 'Foreign Trade & Capital Goods Import',
    statutoryBasis: 'Foreign Trade Policy 2023, Directorate General of Foreign Trade (DGFT), Ministry of Commerce',
    statutoryCitation: 'FTP 2023 Chapter 5: Zero Customs Duty EPCG Authorization',
    maxBenefitSummary: '0% Basic Customs Duty on imported plant, machinery, bottling lines, and lab equipment (Saves 25%–30% CapEx)',
    evaluator: (params) => {
      if (params.exportTurnoverPercentage < 10) {
        return {
          isEligible: false,
          status: 'threshold_shortfall',
          verdictTitle: 'Export Commitment Below Minimum Threshold',
          verdictReason: 'EPCG requires fulfilling an Export Obligation (EO) equivalent to 6x customs duty saved within 6 years. Current modeled export share is low.',
          eligibleIfGuidance: `You would save ~₹${(params.investmentCr * 0.25).toFixed(1)} Cr in import customs duties on capital machinery if you commit to at least 15% export / deemed export sales over 6 years.`,
          gapMetrics: [
            { label: 'Export Share Commitment', current: `${params.exportTurnoverPercentage}%`, required: '≥ 15% of turnover', gap: `${15 - params.exportTurnoverPercentage}% increase needed` },
            { label: 'Customs Duty Exemption', current: 'Standard 27.5%', required: '0% Basic Customs Duty', gap: '27.5% duty payable' },
          ],
          potentialBenefitEstInr: params.investmentCr * 10_000_000 * 0.25,
          benefitFormatted: `Potential: ₹${(params.investmentCr * 0.25).toFixed(2)} Cr Duty Waiver`,
        };
      }

      const dutySaved = params.investmentCr * 0.25;
      return {
        isEligible: true,
        status: 'eligible',
        verdictTitle: 'Eligible for 0% Basic Customs Duty on Imported Machinery',
        verdictReason: `Export model of ${params.exportTurnoverPercentage}% comfortably satisfies the 6x export obligation over 6 years under DGFT FTP Chapter 5.`,
        eligibleIfGuidance: 'Obtain Importer-Exporter Code (IEC) from dgft.gov.in and file EPCG authorization with Chartered Engineer Certificate before clearing port customs.',
        gapMetrics: [
          { label: 'Export Share Commitment', current: `${params.exportTurnoverPercentage}%`, required: '≥ 10%', gap: '✓ Met' },
          { label: 'Duty Rate', current: '0% (Exempt)', required: '0% EPCG', gap: '✓ Met' },
        ],
        potentialBenefitEstInr: dutySaved * 10_000_000,
        benefitFormatted: `₹${dutySaved.toFixed(2)} Cr CapEx Savings (0% Import Duty)`,
      };
    },
  },
  {
    schemeId: 'MSME-ZED-001',
    schemeName: 'Zero Defect Zero Effect (ZED) Sustainability Scheme',
    category: 'green_energy',
    categoryLabel: 'Clean Energy & Green Industrial Subsidy',
    statutoryBasis: 'Ministry of MSME & Quality Council of India (QCI) Sustainable ZED Guidelines',
    statutoryCitation: 'ZED Notification No. 1(1)/2022-ZED — 80% Subsidy on Green Certification & ₹5L Testing Grant',
    maxBenefitSummary: 'Up to 80% Subsidy on Green Assessment + ₹5 Lakhs Testing Assistance + 0.5% Bank Loan Concession',
    evaluator: (params) => {
      if (!params.hasGreenRenewableComponent) {
        return {
          isEligible: false,
          status: 'threshold_shortfall',
          verdictTitle: 'Green Energy / ETP Sustainable Asset Needed',
          verdictReason: 'ZED Gold certification requires measurable energy efficiency protocols, rooftop solar integration, or advanced zero-liquid-discharge (ZLD) effluent treatment.',
          eligibleIfGuidance: 'You would qualify for ₹5 Lakhs testing grant + 80% certification subsidy + 0.5% loan interest reduction by installing captive solar panels or water recycling ETP.',
          gapMetrics: [
            { label: 'Renewable / Green Tech Component', current: 'Standard Plant', required: 'Captive Solar / ZLD ETP', gap: 'Add Green Element' },
            { label: 'Bank Interest Rebate', current: '0%', required: '0.50% Concession', gap: 'Unlockable' },
          ],
          potentialBenefitEstInr: 1_000_000,
          benefitFormatted: '₹10 Lakhs Grants + 0.5% Loan Concession (Pending Green Component)',
        };
      }

      return {
        isEligible: true,
        status: 'eligible',
        verdictTitle: 'Eligible for ZED Gold Green Certification & ₹5L Testing Grant',
        verdictReason: 'Facility incorporates green renewable / pollution abatement features matching QCI sustainable manufacturing benchmarks.',
        eligibleIfGuidance: 'Take free online ZED pledge on zed.msme.gov.in and schedule QCI desktop audit to receive direct subsidy credit.',
        gapMetrics: [
          { label: 'Green Tech Component', current: 'Active (Solar/ETP)', required: 'Energy/ZLD', gap: '✓ Met' },
          { label: 'Certification Fee Subsidy', current: '80% Govt Reimbursed', required: 'Bronze/Gold', gap: '✓ Met' },
        ],
        potentialBenefitEstInr: 1_000_000,
        benefitFormatted: '₹10 Lakhs Grants + 0.5% Loan Concession',
      };
    },
  },
];

export function SchemesPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const { t } = useLanguage();

  // Tab switcher
  const [activeTab, setActiveTab] = useState<'schemes_list' | 'what_if_simulator' | 'negative_list_citations'>('schemes_list');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  // What-If / Sensitivity Simulator Interactive State (Independent sandbox parameters)
  const [simIndustry, setSimIndustry] = useState<string>('brewery');
  const [simInvestmentCr, setSimInvestmentCr] = useState<number>(35);
  const [simEmployees, setSimEmployees] = useState<number>(85);
  const [simTalukaZone, setSimTalukaZone] = useState<'A' | 'B' | 'C' | 'D' | 'D_PLUS' | 'VIDARBHA_MARATHWADA'>('B');
  const [simIsStartup, setSimIsStartup] = useState<boolean>(true);
  const [simIsUdyam, setSimIsUdyam] = useState<boolean>(true);
  const [simGreenTech, setSimGreenTech] = useState<boolean>(true);
  const [simExportPct, setSimExportPct] = useState<number>(20);

  // Fetch evaluated roadmap & schemes for this project
  const {
    data: roadmapData,
    isLoading: isRoadmapLoading,
  } = useQuery<RoadmapResponse>({
    queryKey: ['roadmap', projectId],
    queryFn: () => roadmapApi.get(projectId!, accessToken ?? undefined),
    enabled: Boolean(projectId && accessToken),
  });

  const schemes = useMemo(() => {
    return roadmapData?.schemes ?? [];
  }, [roadmapData]);

  // Evaluated What-If Sensitivity Results
  const simulationResults = useMemo(() => {
    const params: SimulationParams = {
      industry: simIndustry,
      investmentCr: simInvestmentCr,
      employees: simEmployees,
      talukaZone: simTalukaZone,
      isStartupRegistered: simIsStartup,
      isUdyamRegistered: simIsUdyam,
      hasGreenRenewableComponent: simGreenTech,
      exportTurnoverPercentage: simExportPct,
    };

    return SCHEME_SENSITIVITY_CATALOG.map((rule) => {
      const evaluation = rule.evaluator(params);
      return {
        ...rule,
        evaluation,
      };
    });
  }, [simIndustry, simInvestmentCr, simEmployees, simTalukaZone, simIsStartup, simIsUdyam, simGreenTech, simExportPct]);

  // Calculate Total Simulated Potential Benefit
  const totalSimulatedBenefit = useMemo(() => {
    return simulationResults.reduce((acc, curr) => acc + curr.evaluation.potentialBenefitEstInr, 0);
  }, [simulationResults]);

  if (!projectId) {
    return <EmptyState title="Project Not Found" description="No project ID specified in URL." />;
  }

  if (isRoadmapLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <LoadingSpinner label="Evaluating schemes & statutory eligibility..." />
        <p className="text-xs text-slate-500 font-mono">Running deterministic policy engines...</p>
      </div>
    );
  }

  const filteredSchemes = schemes.filter((s) => {
    if (selectedDomain === 'all') return true;
    const advisory = SCHEME_ADVISORY_MAP[s.scheme.id];
    return advisory?.category === selectedDomain;
  });

  return (
    <div className="space-y-6 pb-20 animate-fadeIn font-sans">
      
      {/* 1. Breadcrumb & Header Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1.5">
            <Link to="/projects" className="hover:text-blue-600 transition-colors">
              {t('nav.projects')}
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-bold">Pune Facility</span>
            <span>/</span>
            <span className="text-purple-700 font-bold">{t('nav.schemes')}</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-purple-500 text-white shadow-md shadow-purple-500/20">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 font-mono">
                  Dossier Part 7.1 &amp; 11.1
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {t('nav.schemes')} &amp; Fiscal Support
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Central &amp; Maharashtra statutory scheme eligibility evaluation, ineligibility citations &amp; What-If sensitivity guidance.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Links */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <Link
            to={`/projects/${projectId}/profile`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t('nav.profile', 'Profile')}
          </Link>
          <Link
            to={`/projects/${projectId}/approvals`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t('inspections.approvals_tab', 'Approvals')}
          </Link>
          <Link
            to={`/projects/${projectId}/roadmap`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t('nav.roadmap', 'Roadmap')}
          </Link>
          <span className="rounded-xl bg-purple-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" />
            <span>{t('nav.schemes')}</span>
          </span>
          <Link
            to={`/projects/${projectId}/inspections`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t('nav.inspections')}
          </Link>
          <Link
            to={`/projects/${projectId}/grievances`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span>⚖️ {t('nav.grievances')}</span>
          </Link>
        </div>
      </div>

      {/* Top View Mode Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 max-w-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('schemes_list')}
          className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'schemes_list'
              ? 'bg-white text-purple-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-600" />
          <span>Evaluated Schemes ({schemes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('what_if_simulator')}
          className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'what_if_simulator'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-300" />
          <span>⚡ What-If / "Eligible If" Simulator</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('negative_list_citations')}
          className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'negative_list_citations'
              ? 'bg-rose-700 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-200" />
          <span>Statutory Citations &amp; Negative List</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EVALUATED SCHEMES LIST */}
      {/* ========================================================================= */}
      {activeTab === 'schemes_list' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Executive Fiscal Highlight Hero Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 text-xs font-bold font-mono">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{t('schemes.banner_tag', 'GOVERNMENT FISCAL OPTIMIZATION ADVISORY')}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-snug">
                {t('schemes.banner_title', 'Unlock Up to ₹5 Cr Collateral-Free Credit, 3-Yr Tax Exemption & Capital Grants')}
              </h2>
              <p className="text-xs sm:text-sm text-purple-200 leading-relaxed">
                {t(
                  'schemes.banner_desc',
                  'ApprovalIQ evaluates both central and state policies for your facility. Even if your core product is excluded under state cash subsidy negative lists, your business can qualify for MSME priority credit, 0% import duties, and sustainability grants.',
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <div className="text-[10px] text-purple-200 uppercase font-mono font-bold">Credit Guarantee</div>
                <div className="text-xl font-black text-amber-300 font-mono">₹5 Cr Max</div>
                <div className="text-[10px] text-purple-200">CGTMSE No-Mortgage</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <div className="text-[10px] text-purple-200 uppercase font-mono font-bold">Income Tax 80-IAC</div>
                <div className="text-xl font-black text-emerald-300 font-mono">100% Tax Free</div>
                <div className="text-[10px] text-purple-200">3 Consecutive Years</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <div className="text-[10px] text-purple-200 uppercase font-mono font-bold">Capital Goods</div>
                <div className="text-xl font-black text-blue-300 font-mono">0% Customs Duty</div>
                <div className="text-[10px] text-purple-200">EPCG Machinery Import</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <div className="text-[10px] text-purple-200 uppercase font-mono font-bold">ZED Subsidy</div>
                <div className="text-xl font-black text-rose-300 font-mono">Up to 80% Off</div>
                <div className="text-[10px] text-purple-200">+ ₹5L Testing Grant</div>
              </div>
            </div>
          </div>

          {/* Domain Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Domains' },
              { id: 'startup', label: '🚀 Startup India' },
              { id: 'msme', label: '🏢 MSME & CGTMSE' },
              { id: 'tax_gst', label: '🧾 Direct Tax 80-IAC' },
              { id: 'export', label: '🚢 DGFT Export (EPCG)' },
              { id: 'state_green', label: '🌿 State Industrial & Green' },
            ].map((dom) => (
              <button
                key={dom.id}
                type="button"
                onClick={() => setSelectedDomain(dom.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedDomain === dom.id
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
                }`}
              >
                {dom.label}
              </button>
            ))}
          </div>

          {/* Scheme Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredSchemes.map((s) => {
              const advisory = SCHEME_ADVISORY_MAP[s.scheme.id];
              const isExcluded = s.outcome === 'excluded' || s.outcome === 'not_eligible';
              const isEligible = s.outcome === 'potentially_eligible';

              return (
                <div
                  key={s.scheme.id}
                  className={`p-6 rounded-3xl bg-white border shadow-md hover:shadow-lg transition-all flex flex-col justify-between space-y-4 ${
                    isExcluded
                      ? 'border-rose-200 hover:border-rose-400'
                      : isEligible
                      ? 'border-emerald-200 hover:border-emerald-400'
                      : 'border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-[11px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            {s.scheme.id}
                          </span>
                          {advisory?.categoryLabel && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {advisory.categoryLabel}
                            </span>
                          )}
                          {s.scheme.jurisdiction && (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                              {s.scheme.jurisdiction}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900">
                          {s.scheme.name}
                        </h3>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${
                          isEligible
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isExcluded
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isEligible ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isExcluded ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <HelpCircle className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isEligible
                            ? 'Potentially Eligible'
                            : isExcluded
                            ? 'Excluded / Ineligible'
                            : 'Needs Information'}
                        </span>
                      </span>
                    </div>

                    {/* Fiscal Highlight Chip */}
                    {advisory?.fiscalHighlight && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50/80 border border-purple-200 text-purple-900 text-xs font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>{advisory.fiscalHighlight}</span>
                      </div>
                    )}

                    {s.scheme.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {s.scheme.description}
                      </p>
                    )}

                    {/* Verdict Explanation Box */}
                    <div
                      className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                        isExcluded
                          ? 'bg-rose-50/70 border-rose-200 text-rose-950 font-medium'
                          : isEligible
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-medium'
                          : 'bg-amber-50/70 border-amber-200 text-amber-950 font-medium'
                      }`}
                    >
                      <div className="font-bold mb-0.5 flex items-center gap-1.5">
                        {isExcluded ? (
                          <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                        ) : (
                          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                        )}
                        <span>{isExcluded ? 'Statutory Exclusion Rationale:' : 'Eligibility Evaluation:'}</span>
                      </div>
                      <p>{s.explanation}</p>
                    </div>

                    {/* Missing Fields Pill */}
                    {s.outcome === 'needs_information' && s.neededInformation.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-bold text-amber-800">Required Profile Fields:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {s.neededInformation.map((info) => (
                            <span
                              key={info.field}
                              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200"
                            >
                              {PROFILE_FIELD_LABELS[info.field] || info.field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-400 font-medium truncate max-w-[200px]">
                      {advisory?.authorityDepartment || s.scheme.sourceTitle || 'Government Nodal Agency'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('what_if_simulator');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-xs border border-purple-300 transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-purple-700" />
                        <span>Simulate "Eligible If" →</span>
                      </button>

                      {advisory?.portalUrl && (
                        <a
                          href={advisory.portalUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Open official portal"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WHAT-IF / "ELIGIBLE IF" SENSITIVITY SIMULATOR (DOSSIER 7.1 & 11.1) */}
      {/* ========================================================================= */}
      {activeTab === 'what_if_simulator' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Simulator Header Card */}
          <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 text-xs font-bold font-mono">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>WHAT-IF SENSITIVITY &amp; THRESHOLD ENGINE</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
                  Interactive "Eligible If" Policy Simulator
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Adjust hypothetical business parameters (investment capital, taluka zoning, green energy share, sector diversification) below to discover exact threshold criteria needed to unlock fiscal subsidies without altering your official project profile.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right shrink-0">
                <div className="text-[10px] text-slate-300 uppercase font-mono font-bold">Simulated Potential Benefit</div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-0.5">
                  ₹{(totalSimulatedBenefit / 10_000_000).toFixed(2)} Cr
                </div>
                <div className="text-[11px] text-slate-300">Total grants, credit &amp; tax waivers</div>
              </div>
            </div>
          </div>

          {/* Interactive Parameter Control Sliders & Radios */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 font-mono uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span>Simulation Parameters (Sandbox Mode)</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSimIndustry('brewery');
                  setSimInvestmentCr(35);
                  setSimEmployees(85);
                  setSimTalukaZone('B');
                  setSimIsStartup(true);
                  setSimIsUdyam(true);
                  setSimGreenTech(true);
                  setSimExportPct(20);
                }}
                className="text-xs text-purple-700 font-bold hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset to Pune Brewery Baseline</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Parameter 1: Industry Activity */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                  1. Manufacturing Activity
                </label>
                <select
                  value={simIndustry}
                  onChange={(e) => setSimIndustry(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="brewery">Beer &amp; Liquor Manufacturing (Excluded)</option>
                  <option value="food_processing">Agro &amp; Food Processing (Eligible)</option>
                  <option value="renewable_energy">Solar PV &amp; Clean Tech (High Priority)</option>
                  <option value="pharma">Pharmaceuticals &amp; APIs (Eligible)</option>
                  <option value="automotive_ev">Automotive &amp; EV Assembly (Eligible)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  Switching to Food Processing immediately lifts PSI-2019 negative list barrier.
                </p>
              </div>

              {/* Parameter 2: Fixed Capital Investment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    2. Fixed CapEx (₹ Cr)
                  </label>
                  <span className="text-xs font-black text-purple-700 font-mono">
                    ₹{simInvestmentCr} Cr
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="150"
                  step="1"
                  value={simInvestmentCr}
                  onChange={(e) => setSimInvestmentCr(Number(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>₹2 Cr</span>
                  <span>₹50 Cr</span>
                  <span>₹150 Cr (Mega)</span>
                </div>
              </div>

              {/* Parameter 3: Taluka Industrial Zone */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                  3. Taluka Development Zone
                </label>
                <select
                  value={simTalukaZone}
                  onChange={(e) => setSimTalukaZone(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="A">Zone A (Developed: Mumbai / Thane)</option>
                  <option value="B">Zone B (Developing: Pune / Chakan / Pimpri)</option>
                  <option value="C">Zone C (Incentivized: Nashik / Kolhapur)</option>
                  <option value="D">Zone D (Backward: Solapur / Satara)</option>
                  <option value="D_PLUS">Zone D+ (Least Developed)</option>
                  <option value="VIDARBHA_MARATHWADA">Vidarbha &amp; Marathwada (100%–140% FCI)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  Zone C/D provides up to 80%–100% FCI subsidy versus 40% in Zone B.
                </p>
              </div>

              {/* Parameter 4: Direct Export % */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    4. Export Share (%)
                  </label>
                  <span className="text-xs font-black text-purple-700 font-mono">
                    {simExportPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={simExportPct}
                  onChange={(e) => setSimExportPct(Number(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0% (Domestic)</span>
                  <span>15% (EPCG Met)</span>
                  <span>100% (EOU)</span>
                </div>
              </div>

            </div>

            {/* Toggle Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-purple-50/50 transition-colors">
                <input
                  type="checkbox"
                  checked={simIsUdyam}
                  onChange={(e) => setSimIsUdyam(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded accent-purple-600 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">Udyam MSME Registered</div>
                  <div className="text-[10px] text-slate-500">Unlocks CGTMSE ₹5 Cr Guarantee</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-purple-50/50 transition-colors">
                <input
                  type="checkbox"
                  checked={simIsStartup}
                  onChange={(e) => setSimIsStartup(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded accent-purple-600 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">DPIIT Startup Recognized</div>
                  <div className="text-[10px] text-slate-500">Unlocks Section 80-IAC 100% Tax Exemption</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-purple-50/50 transition-colors">
                <input
                  type="checkbox"
                  checked={simGreenTech}
                  onChange={(e) => setSimGreenTech(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded accent-purple-600 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">Captive Solar / ZLD ETP</div>
                  <div className="text-[10px] text-slate-500">Unlocks ZED Gold 80% Grant</div>
                </div>
              </label>
            </div>
          </div>

          {/* Simulation Output Cards with "Eligible If" Advice Badges */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 font-mono uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Simulated Scheme Eligibility &amp; "Eligible If" Threshold Guidance</span>
            </h3>

            <div className="space-y-4">
              {simulationResults.map((item) => {
                const evalRes = item.evaluation;
                const isEligible = evalRes.isEligible;
                const isExcluded = evalRes.status === 'excluded';

                return (
                  <div
                    key={item.schemeId}
                    className={`p-6 rounded-3xl bg-white border shadow-sm transition-all space-y-4 ${
                      isEligible
                        ? 'border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/10'
                        : isExcluded
                        ? 'border-rose-300 bg-rose-50/10'
                        : 'border-amber-300 bg-amber-50/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                            {item.schemeId}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            {item.categoryLabel}
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900">
                          {item.schemeName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                          {item.statutoryBasis}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                            isEligible
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isExcluded
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {isEligible ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          ) : isExcluded ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-700" />
                          ) : (
                            <Sliders className="w-3.5 h-3.5 text-amber-700" />
                          )}
                          <span>
                            {isEligible
                              ? '✓ Fully Eligible in Simulation'
                              : isExcluded
                              ? '✗ Excluded by Negative List'
                              : '⚡ Threshold Shortfall'}
                          </span>
                        </span>
                        <div className="text-xs font-black text-slate-800 mt-1 font-mono">
                          {evalRes.benefitFormatted}
                        </div>
                      </div>
                    </div>

                    {/* "Eligible If" Guidance Highlight Callout Box (Dossier Requirement) */}
                    <div
                      className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                        isEligible
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : 'bg-amber-50/90 border-amber-300 text-amber-950'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Lightbulb
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isEligible ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        />
                        <div className="space-y-1">
                          <span className="font-extrabold uppercase tracking-wider text-[11px] font-mono">
                            {isEligible ? 'Claim Activation Roadmap:' : '⚡ "Eligible If" Sensitivity Advice:'}
                          </span>
                          <p className="font-medium">{evalRes.eligibleIfGuidance}</p>
                        </div>
                      </div>
                    </div>

                    {/* Gap Metrics Comparison Table */}
                    {evalRes.gapMetrics && evalRes.gapMetrics.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {evalRes.gapMetrics.map((gap, gIdx) => (
                          <div
                            key={gIdx}
                            className="p-3 rounded-2xl bg-white border border-slate-200 text-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="text-[10px] text-slate-400 font-mono uppercase">{gap.label}</div>
                              <div className="font-bold text-slate-900 mt-0.5">
                                Current: <span className="text-slate-700 font-mono">{gap.current}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-400 font-mono uppercase">Target Benchmark</div>
                              <div className="font-extrabold text-purple-700 font-mono">{gap.gap}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STATUTORY CITATIONS & NEGATIVE LIST EXCLUSIONS (DOSSIER 7.1) */}
      {/* ========================================================================= */}
      {activeTab === 'negative_list_citations' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Statutory Legal Disclaimer */}
          <div className="p-6 rounded-3xl bg-rose-950 text-white shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-900 text-rose-200">
                <Scale className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black text-white">
                Statutory Ineligibility &amp; Negative List Legal Citations
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-rose-200 leading-relaxed max-w-3xl">
              In accordance with DPIIT Single-Window and State Regulatory Guidelines, ineligibility reasons must always be accompanied by formal Government Resolution (GR) numbers, gazette citations, and clause-level negative list restrictions.
            </p>
          </div>

          {/* Negative List Citation Dossier */}
          <div className="p-6 rounded-3xl bg-white border border-rose-200 shadow-sm space-y-6">
            
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs">
              <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-sm text-rose-900">
                  Maharashtra PSI-2019 — Annexure II Ineligibility Ruling for Breweries
                </h3>
                <p className="leading-relaxed">
                  <strong>Statutory Basis:</strong> Government Resolution No. PSI-2019/CR-46/IND-8, Directorate of Industries, Government of Maharashtra.
                </p>
                <p className="leading-relaxed">
                  <strong>Restricted Item Citation:</strong> <em>"Annexure II (Negative List of Industries), Clause 4.1, Item 7: Manufacture of Potable Liquor, Beer, Wine, Rectified Spirit and Country Liquor."</em>
                </p>
                <div className="pt-2">
                  <a
                    href="https://industry.maharashtra.gov.in/sites/default/files/2025-09/20190916-psi-2019.pdf"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    <span>View Maharashtra PSI-2019 Gazette PDF ↗</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Allowed vs Excluded Side-by-Side Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-3">
                <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm">
                  <XCircle className="w-4 h-4" />
                  <span>Statutorily Restricted / Excluded Under PSI-2019</span>
                </div>
                <ul className="space-y-2 text-xs text-rose-950">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 font-bold">•</span>
                    <span>Direct State GST (IPS) cash refund for beer and alcohol distilling</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 font-bold">•</span>
                    <span>State electricity duty waiver on dedicated brewery power loads</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 font-bold">•</span>
                    <span>5% term loan interest subsidy on potable alcohol brewing equipment</span>
                  </li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Fully Accessible Non-Restricted Alternative Schemes</span>
                </div>
                <ul className="space-y-2 text-xs text-emerald-950">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>MSME CGTMSE:</strong> ₹5.00 Cr collateral-free bank term loan / working capital</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>Income Tax Section 80-IAC:</strong> 100% 3-year income tax holiday for registered startups</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>DGFT EPCG Scheme:</strong> 0% Basic Customs Duty on imported brewing kettles &amp; bottling lines</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>ZED Green Subsidy:</strong> Up to 80% subsidy on wastewater ETP &amp; energy audits</span>
                  </li>
                </ul>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
