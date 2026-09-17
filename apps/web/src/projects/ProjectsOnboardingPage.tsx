import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Utensils,
  FlaskConical,
  TestTube2,
  Car,
  Zap,
  Layers,
  Boxes,
  Cpu,
  Factory,
  Compass,
  ShieldCheck,
  X,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { useAuth } from '../auth';
import { useLanguage } from '../i18n';
import { LanguageSwitcher } from '../Layout';
import { projectsApi, profilesApi, ApiError, KnownFieldValue } from '../api-client';

interface IndustryOption {
  id: string;
  name: string;
  iconKey: string;
  category: string;
  path: string;
  popular?: boolean;
}

export function IndustryIcon({ iconKey, className = "w-4 h-4 text-ink" }: { iconKey: string; className?: string }): JSX.Element {
  switch (iconKey) {
    case 'brewery':
      return <Building2 className={className} />;
    case 'food_processing':
      return <Utensils className={className} />;
    case 'pharma':
      return <FlaskConical className={className} />;
    case 'chemicals':
      return <TestTube2 className={className} />;
    case 'automotive_ev':
      return <Car className={className} />;
    case 'renewable_energy':
      return <Zap className={className} />;
    case 'textiles':
      return <Layers className={className} />;
    case 'cold_chain':
      return <Boxes className={className} />;
    case 'electronics':
      return <Cpu className={className} />;
    case 'heavy_machinery':
      return <Factory className={className} />;
    default:
      return <Building2 className={className} />;
  }
}

const INDUSTRIES: IndustryOption[] = [
  { id: 'brewery', name: 'Craft Breweries & Distilleries', iconKey: 'brewery', category: 'Food & Beverage', path: 'Beverage Manufacturing → Microbrewery & Bottling', popular: true },
  { id: 'food_processing', name: 'Food Processing & Packaged Goods', iconKey: 'food_processing', category: 'Food & Beverage', path: 'Agro-Processing → FSSAI Manufacturing Unit', popular: true },
  { id: 'pharma', name: 'Pharmaceuticals & Active Ingredients', iconKey: 'pharma', category: 'Healthcare & Life Sciences', path: 'Pharmaceuticals → Formulations & Active Ingredients', popular: true },
  { id: 'chemicals', name: 'Specialty Chemicals & Polymers', iconKey: 'chemicals', category: 'Chemicals & Materials', path: 'Chemicals → Specialty Resins & Formulations', popular: true },
  { id: 'automotive_ev', name: 'Automotive & EV Powertrains', iconKey: 'automotive_ev', category: 'Manufacturing & Engineering', path: 'Engineering → Automotive Assembly & EV Systems', popular: true },
  { id: 'renewable_energy', name: 'Renewable Energy & Solar Tech', iconKey: 'renewable_energy', category: 'Clean Tech & Energy', path: 'Clean Tech → Solar Modules & Power Storage', popular: true },
  { id: 'textiles', name: 'Textile Mills & Technical Fabrics', iconKey: 'textiles', category: 'Textiles & Apparel', path: 'Textiles → Technical Fabrics & Spinning', popular: true },
  { id: 'cold_chain', name: 'Cold Chain Logistics & Warehousing', iconKey: 'cold_chain', category: 'Logistics & Infrastructure', path: 'Logistics → Temperature-Controlled Storage', popular: true },
  { id: 'electronics', name: 'Data Centers & Electronics Assembly', iconKey: 'electronics', category: 'Electronics & IT', path: 'Electronics → Hardware Assembly & Server Parks' },
  { id: 'heavy_machinery', name: 'Heavy Machinery & Steel Fabrication', iconKey: 'heavy_machinery', category: 'Heavy Industry', path: 'Heavy Industry → Structural Fabrication & Machinery' },
];

const PLAN_TYPES = [
  { id: 'new_business', label: 'Start a new establishment', desc: 'Greenfield commercial or industrial facility' },
  { id: 'expand_facility', label: 'Expand existing capacity', desc: 'Brownfield expansion or modernization' },
  { id: 'new_plant', label: 'Set up an additional unit', desc: 'Second operational plant in an enterprise' },
  { id: 'modify_activity', label: 'Modify product classification', desc: 'Line addition or category upgrade' },
];

const LAND_STATUS_OPTIONS = [
  { id: 'owned', label: 'Owned Freehold', desc: 'Registered deed in company name' },
  { id: 'leased', label: 'Registered Lease', desc: 'MIDC, GIDC or private lease deed' },
  { id: 'not_yet_acquired', label: 'Under Negotiation', desc: 'Site selection & due diligence phase' },
];

const STATE_DISTRICTS: Record<string, { name: string; code: string; districts: string[]; spcb: string; singleWindow: string }> = {
  MH: {
    name: 'Maharashtra',
    code: 'MH',
    districts: ['Pune', 'Mumbai Suburban', 'Mumbai City', 'Thane', 'Nashik', 'Nagpur', 'Chhatrapati Sambhajinagar', 'Kolhapur', 'Raigad', 'Solapur'],
    spcb: 'Maharashtra Pollution Control Board (MPCB)',
    singleWindow: 'MAITRI Single Window Portal',
  },
  KA: {
    name: 'Karnataka',
    code: 'KA',
    districts: ['Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Dakshina Kannada', 'Hubballi-Dharwad', 'Belagavi', 'Tumakuru', 'Udupi'],
    spcb: 'Karnataka State Pollution Control Board (KSPCB)',
    singleWindow: 'Karnataka eBiz Single Window Desk',
  },
  GJ: {
    name: 'Gujarat',
    code: 'GJ',
    districts: ['Ahmedabad', 'Surat', 'Vadodara', 'Bharuch (Ankleshwar)', 'Rajkot', 'Valsad (Vapi)', 'Gandhinagar', 'Bhavnagar'],
    spcb: 'Gujarat Pollution Control Board (GPCB)',
    singleWindow: 'Investor Facilitation Portal (IFP Gujarat)',
  },
  TS: {
    name: 'Telangana',
    code: 'TS',
    districts: ['Hyderabad', 'Rangareddy', 'Medchal-Malkajgiri', 'Sangareddy', 'Warangal', 'Nizamabad', 'Karimnagar'],
    spcb: 'Telangana State Pollution Control Board (TSPCB)',
    singleWindow: 'TS-iPASS Instant Clearances Portal',
  },
  TN: {
    name: 'Tamil Nadu',
    code: 'TN',
    districts: ['Chennai', 'Coimbatore', 'Sriperumbudur (Kanchipuram)', 'Hosur (Krishnagiri)', 'Tiruppur', 'Madurai', 'Salem'],
    spcb: 'Tamil Nadu Pollution Control Board (TNPCB)',
    singleWindow: 'Guidance Tamil Nadu Single Window Portal',
  },
  UP: {
    name: 'Uttar Pradesh',
    code: 'UP',
    districts: ['Noida (Gautam Buddha Nagar)', 'Greater Noida', 'Lucknow', 'Kanpur Nagar', 'Ghaziabad', 'Agra', 'Varanasi'],
    spcb: 'Uttar Pradesh Pollution Control Board (UPPCB)',
    singleWindow: 'Nivesh Mitra Single Window Portal',
  },
};

const AREA_TYPE_OPTIONS = [
  { value: 'built_up', label: 'Built-Up Industrial Shed' },
  { value: 'plot', label: 'Open Industrial Plot Area' },
  { value: 'leased', label: 'MIDC / GIDC Leased Factory' },
  { value: 'operational', label: 'Operational Commercial Floor' },
];

export interface ProjectHistoryItem {
  id: string;
  name: string;
  industry: string;
  state: string;
  district: string;
  createdAt: string;
}

const STORAGE_PROJECTS_KEY = 'approvaliq_founder_case_files_v1';

export function getStoredProjects(): ProjectHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectHistoryItem[];
  } catch {
    return [];
  }
}

export function saveStoredProject(project: ProjectHistoryItem): void {
  try {
    const existing = getStoredProjects();
    const updated = [project, ...existing.filter((p) => p.id !== project.id)].slice(0, 10);
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export const ProjectsOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { accessToken, user, isOfficer, logout } = useAuth();
  const { t } = useLanguage();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  const [projectName, setProjectName] = useState('');
  const [industrySearch, setIndustrySearch] = useState('');
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>('brewery');
  
  const [selectedStateCode, setSelectedStateCode] = useState<string>('MH');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Pune');

  const [planType, setPlanType] = useState<string>('new_business');
  const [landStatus, setLandStatus] = useState<string>('leased');
  const [areaSqft, setAreaSqft] = useState<string>('25000');
  const [areaType, setAreaType] = useState<string>('built_up');
  const [investmentInr, setInvestmentInr] = useState<string>('40000000');
  const [employeeCount, setEmployeeCount] = useState<string>('85');
  const [activityDescription, setActivityDescription] = useState<string>('Craft beer brewing, fermentation, bottling & packaging line');

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [existingProjects, setExistingProjects] = useState<ProjectHistoryItem[]>([]);

  useEffect(() => {
    const stored = getStoredProjects();
    setExistingProjects(stored);
  }, []);

  const selectedIndustry = useMemo(() => {
    return INDUSTRIES.find((i) => i.id === selectedIndustryId) || INDUSTRIES[0]!;
  }, [selectedIndustryId]);

  const stateInfo = useMemo(() => {
    return STATE_DISTRICTS[selectedStateCode] || STATE_DISTRICTS['MH']!;
  }, [selectedStateCode]);

  const filteredIndustries = useMemo(() => {
    if (!industrySearch.trim()) return INDUSTRIES;
    const q = industrySearch.toLowerCase();
    return INDUSTRIES.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.path.toLowerCase().includes(q)
    );
  }, [industrySearch]);

  const isStep1Valid = projectName.trim().length > 0 && selectedIndustryId.length > 0;
  const isStep2Valid = selectedStateCode.length > 0 && selectedDistrict.length > 0;
  const isStep3Valid = landStatus.length > 0 && areaSqft.trim().length > 0 && areaType.length > 0;

  const ANALYSIS_STEPS = [
    'Validating industrial classification against state gazette...',
    `Evaluating ${stateInfo.name} & ${selectedDistrict} single-window rules...`,
    'Determining pollution category (Red / Orange / Green)...',
    'Compiling statutory document checklists and prerequisite trees...',
    'Synthesizing deterministic critical path roadmap...',
  ];

  const handleFinalSubmit = async (): Promise<void> => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisStep(0);

    const stepInterval = setInterval(() => {
      setAnalysisStep((prev) => {
        if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 500);

    try {
      const cleanSlug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 20);
      const generatedBusinessId = `${cleanSlug || 'business'}-${Math.random().toString(36).substring(2, 7)}`;

      const project = await projectsApi.create(
        {
          name: projectName.trim(),
          industry: 'brewery',
          businessId: generatedBusinessId,
        },
        accessToken ?? undefined
      );

      saveStoredProject({
        id: project.id,
        name: project.name,
        industry: selectedIndustry.name,
        state: stateInfo.name,
        district: selectedDistrict,
        createdAt: new Date().toLocaleDateString(),
      });

      const values: Record<string, KnownFieldValue> = {
        industry: { status: 'known', value: 'brewery' },
        state: { status: 'known', value: stateInfo.name },
        district: { status: 'known', value: selectedDistrict },
        landStatus: { status: 'known', value: landStatus },
        areaSqft: { status: 'known', value: Number(areaSqft) || 25000 },
        areaType: { status: 'known', value: areaType },
        investmentAmountInr: { status: 'known', value: Number(investmentInr) || 40000000 },
        investmentDefinition: { status: 'known', value: 'total_project_cost' },
        employeeCount: { status: 'known', value: Number(employeeCount) || 80 },
        employeeCountDefinition: { status: 'known', value: 'full_operational_capacity' },
        activityType: { status: 'known', value: activityDescription.trim() || 'beer-manufacturing' },
      };

      const draft = await profilesApi.createDraft(project.id, values, accessToken ?? undefined);
      await profilesApi.confirm(project.id, draft.id, accessToken ?? undefined);

      clearInterval(stepInterval);
      setAnalysisStep(ANALYSIS_STEPS.length);

      setTimeout(() => {
        void navigate(`/projects/${project.id}/roadmap`);
      }, 700);

    } catch (err) {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
      setError(err instanceof ApiError ? err.message : 'Could not initialize project analysis. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      
      {/* Top Mustard & White Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-200/80 px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              ▲
            </div>
            <span className="font-editorial text-xl font-bold tracking-tight text-slate-900">
              Approval<span className="text-amber-600">IQ</span>
            </span>
          </Link>
          <span className="hidden sm:inline-block text-amber-200 font-mono">|</span>
          <span className="hidden sm:inline-block mustard-badge text-[10px]">
            {t('onboarding.desk_title', 'Case File Desk')}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <LanguageSwitcher />

          {user?.email && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200/90 text-amber-950 font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>{user.email}</span>
            </div>
          )}

          {isOfficer && (
            <Link
              to="/officer"
              className="tactile-btn mustard-btn-primary px-3 py-1 text-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              <span>{t('nav.officer_queue', 'Officer Queue')}</span>
            </Link>
          )}

          <Link
            to="/business-map"
            className="hidden sm:inline-flex items-center gap-1 text-slate-700 hover:text-amber-700 px-2 py-1 text-xs font-medium"
          >
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            <span>{t('nav.business_map', 'GIS Map')}</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              logout();
              void navigate('/login');
            }}
            className="tactile-btn tactile-btn-secondary px-3 py-1 text-xs text-ink-soft hover:text-vermilion-500 flex items-center gap-1.5 cursor-pointer"
            title="Sign out of ApprovalIQ"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('nav.logout', 'Sign Out')}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Executive Case Files Desk (If existing projects exist) */}
        {existingProjects.length > 0 && (
          <div className="editorial-card p-6 bg-white space-y-4 border border-ocean-300/80 shadow-tactile-lg rounded-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-ocean-200/80 pb-3">
              <div>
                <span className="stamp-seal stamp-approved text-[10px]">
                  ACTIVE REGULATORY DOCKETS
                </span>
                <h2 className="font-editorial text-xl font-bold text-ink mt-1">
                  Founder Command Central
                </h2>
              </div>
              <span className="text-xs font-mono text-ocean-700">
                {existingProjects.length} Verified Case {existingProjects.length === 1 ? 'File' : 'Files'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {existingProjects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}/roadmap`}
                  className="editorial-card p-4 bg-ocean-50/50 hover:bg-white border border-ocean-200 hover:border-ocean-400 hover:shadow-glow-cyan/20 transition-all duration-300 flex flex-col justify-between space-y-3 group rounded-xl"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted mb-1">
                      <span>{p.district ? `${p.district}, ${p.state}` : 'MH-REG-01'}</span>
                      <span className="stamp-seal stamp-approved text-[9px]">Active</span>
                    </div>
                    <h3 className="font-editorial text-base font-bold text-ink group-hover:text-ocean-700 transition-colors">
                      {p.name}
                    </h3>
                    <p className="text-xs text-ink-soft mt-0.5 truncate font-sans">
                      {p.industry}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-ocean-200/60 flex items-center justify-between text-xs font-semibold text-ocean-600 group-hover:text-ocean-800">
                    <span>Open Roadmap Desk</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* New Case File Setup Wizard */}
        <div className="editorial-card p-6 sm:p-8 bg-white space-y-6 border border-ocean-300/80 shadow-tactile-lg rounded-2xl animate-fade-in-up">
          
          {/* Header */}
          <div className="border-b border-ocean-200/80 pb-4 space-y-1">
            <span className="stamp-seal stamp-neutral text-[10px]">
              INTAKE QUESTIONNAIRE
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              {t('onboarding.hero_title', "Open a New Regulatory Case File")}
            </h1>
            <p className="text-xs text-ink-soft font-sans">
              {t('onboarding.hero_subtitle', "Provide statutory parameters to compute prerequisite sequences, mandatory documents, and RTS Act SLA timers.")}
            </p>
          </div>

          {/* Stepper with Glowing Active Tracer */}
          <div className="flex items-center justify-between border-b border-ocean-200/80 pb-3 text-xs font-mono">
            {[
              { num: 1, label: '1. Identity' },
              { num: 2, label: '2. Location' },
              { num: 3, label: '3. Parameters' },
              { num: 4, label: '4. Verification' },
            ].map((s) => {
              const isDone = currentStep > s.num;
              const isActive = currentStep === s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num < currentStep || (s.num === 2 && isStep1Valid) || (s.num === 3 && isStep2Valid)) {
                      setCurrentStep(s.num as 1 | 2 | 3 | 4);
                    }
                  }}
                  className={`flex items-center gap-1.5 transition-all font-bold ${
                    isActive
                      ? 'text-ocean-700'
                      : isDone
                      ? 'text-forest-600'
                      : 'text-ink-muted'
                  }`}
                >
                  <span className={`stamp-seal text-[10px] ${isActive ? 'stamp-pending shadow-glow-cyan/30' : isDone ? 'stamp-approved' : 'stamp-neutral'}`}>
                    {isDone ? '✓' : s.num}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-vermilion-50 border border-vermilion-500/30 text-vermilion-600 text-xs flex items-center justify-between animate-fade-in-up">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {/* Step 1: Business Identity */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-scale-in">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                  Project Docket Name *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Pune Craft Fermentation Facility"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-ocean-50/50 border border-ocean-200/80 text-xs text-ink focus:bg-white focus:border-ocean-500 focus:ring-2 focus:ring-ocean-300/40 focus:outline-none transition-all shadow-tactile-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950">
                    Industry Sector *
                  </label>
                  <span className="text-xs font-mono font-semibold text-ocean-700">
                    Selected: {selectedIndustry.name}
                  </span>
                </div>

                <input
                  type="text"
                  value={industrySearch}
                  onChange={(e) => setIndustrySearch(e.target.value)}
                  placeholder="Search sector classification (e.g. Brewery, Solar, Pharma)..."
                  className="w-full px-3.5 py-2 rounded-lg bg-ocean-50/50 border border-ocean-200/80 text-xs text-ink focus:bg-white focus:border-ocean-500 focus:outline-none"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {filteredIndustries.map((ind) => {
                    const isSelected = selectedIndustryId === ind.id;
                    return (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => {
                          setSelectedIndustryId(ind.id);
                          if (!projectName && ind.id === 'brewery') {
                            setProjectName('Pune Craft Brewery Unit');
                          }
                        }}
                        className={`text-left p-3 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-white border-ocean-500 shadow-glow-cyan/20'
                            : 'bg-ocean-50/50 border-ocean-200/70 hover:bg-white hover:border-ocean-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-ink truncate">{ind.name}</div>
                          <div className="text-[10px] font-mono text-ink-muted truncate">{ind.category}</div>
                        </div>
                        <span className={`stamp-seal text-[9px] shrink-0 ${isSelected ? 'stamp-approved' : 'stamp-neutral'}`}>
                          {isSelected ? '✓' : 'Select'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-ocean-200/80 flex justify-end">
                <button
                  type="button"
                  disabled={!isStep1Valid}
                  onClick={() => setCurrentStep(2)}
                  className="tactile-btn tactile-btn-primary px-5 py-2 text-xs font-semibold shadow-tactile hover:shadow-glow-cyan disabled:opacity-40"
                >
                  Proceed to Location →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-scale-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                    State Jurisdiction *
                  </label>
                  <select
                    value={selectedStateCode}
                    onChange={(e) => {
                      const newCode = e.target.value;
                      setSelectedStateCode(newCode);
                      const firstDist = STATE_DISTRICTS[newCode]?.districts[0] || 'Default District';
                      setSelectedDistrict(firstDist);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-ocean-50/50 border border-ocean-200/80 text-xs text-ink focus:bg-white focus:border-ocean-500 focus:outline-none"
                  >
                    {Object.values(STATE_DISTRICTS).map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                    District / Industrial Cluster *
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-ocean-50/50 border border-ocean-200/80 text-xs text-ink focus:bg-white focus:border-ocean-500 focus:outline-none"
                  >
                    {stateInfo.districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-ocean-50 border border-ocean-200 text-xs text-ink-soft space-y-1">
                <span className="stamp-seal stamp-approved text-[10px]">
                  NODAL SINGLE WINDOW DESK
                </span>
                <p className="text-[11px] font-mono text-ocean-900 font-medium">
                  {stateInfo.spcb} · {stateInfo.singleWindow}
                </p>
              </div>

              <div className="pt-4 border-t border-ocean-200/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="tactile-btn tactile-btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={!isStep2Valid}
                  onClick={() => setCurrentStep(3)}
                  className="tactile-btn tactile-btn-primary px-5 py-2 text-xs font-semibold shadow-tactile hover:shadow-glow-cyan"
                >
                  Proceed to Project Details →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Parameters */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-scale-in">
              <div className="space-y-2">
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950">
                  Project Lifecycle Stage
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PLAN_TYPES.map((plan) => {
                    const isSelected = planType === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setPlanType(plan.id)}
                        className={`text-left p-3 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-white border-ocean-500 shadow-glow-cyan/20'
                            : 'bg-ocean-50/50 border-ocean-200/70 hover:bg-white hover:border-ocean-300'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-ink">{plan.label}</div>
                          <div className="text-[10px] font-mono text-ink-muted">{plan.desc}</div>
                        </div>
                        <span className={`stamp-seal text-[9px] shrink-0 ${isSelected ? 'stamp-approved' : 'stamp-neutral'}`}>
                          {isSelected ? '✓' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950">
                  Land / Premises Status *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {LAND_STATUS_OPTIONS.map((land) => {
                    const isSelected = landStatus === land.id;
                    return (
                      <button
                        key={land.id}
                        type="button"
                        onClick={() => setLandStatus(land.id)}
                        className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-ocean-500 shadow-glow-cyan/20'
                            : 'bg-ocean-50/50 border-ocean-200/70 hover:bg-white hover:border-ocean-300'
                        }`}
                      >
                        <div className="text-xs font-bold text-ink">{land.label}</div>
                        <div className="text-[10px] font-mono text-ink-muted">{land.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                    Area (Square Feet) *
                  </label>
                  <input
                    type="number"
                    value={areaSqft}
                    onChange={(e) => setAreaSqft(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full px-3.5 py-2 rounded-lg bg-ocean-50/50 border border-ocean-200/80 text-xs text-ink focus:bg-white focus:border-ocean-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                    Area Classification *
                  </label>
                  <select
                    value={areaType}
                    onChange={(e) => setAreaType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-ocean-50/50 border border-ocean-200/80 text-xs text-ink focus:bg-white focus:border-ocean-500 focus:outline-none"
                  >
                    {AREA_TYPE_OPTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                    Total Investment (INR)
                  </label>
                  <input
                    type="number"
                    value={investmentInr}
                    onChange={(e) => setInvestmentInr(e.target.value)}
                    placeholder="e.g. 40000000"
                    className="w-full px-3.5 py-2 rounded-lg bg-ocean-50/50 border border-ocean-200/80 text-xs text-ink focus:bg-white focus:border-ocean-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                    Workforce Count
                  </label>
                  <input
                    type="number"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}
                    placeholder="e.g. 85"
                    className="w-full px-3.5 py-2 rounded-lg bg-ocean-50/50 border border-ocean-200/80 text-xs text-ink focus:bg-white focus:border-ocean-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                  Specific Activity & Process Description
                </label>
                <input
                  type="text"
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  placeholder="e.g. Craft beer brewing, fermentation, bottling & packaging line"
                  className="w-full px-3.5 py-2 rounded-lg bg-ocean-50/50 border border-ocean-200/80 text-xs text-ink focus:bg-white focus:border-ocean-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-ocean-200/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="tactile-btn tactile-btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={!isStep3Valid}
                  onClick={() => setCurrentStep(4)}
                  className="tactile-btn tactile-btn-primary px-5 py-2 text-xs font-semibold shadow-tactile hover:shadow-glow-cyan"
                >
                  Review Docket Summary →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Confirm */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-scale-in">
              <div className="p-4 rounded-xl bg-ocean-50/80 border border-ocean-200/80 space-y-3 text-xs">
                <span className="stamp-seal stamp-approved text-[10px]">
                  VERIFICATION SUMMARY
                </span>
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <span className="text-ocean-700 font-mono uppercase block text-[10px]">Docket Title</span>
                    <strong className="text-ink font-mono">{projectName}</strong>
                  </div>
                  <div>
                    <span className="text-ocean-700 font-mono uppercase block text-[10px]">Sector Package</span>
                    <strong className="text-ink font-mono">{selectedIndustry.name}</strong>
                  </div>
                  <div>
                    <span className="text-ocean-700 font-mono uppercase block text-[10px]">Jurisdiction</span>
                    <strong className="text-ink font-mono">{selectedDistrict}, {stateInfo.name}</strong>
                  </div>
                  <div>
                    <span className="text-ocean-700 font-mono uppercase block text-[10px]">Scale</span>
                    <strong className="text-ink font-mono">{areaSqft} sq ft · ₹{(Number(investmentInr) / 10000000).toFixed(1)} Cr</strong>
                  </div>
                </div>
              </div>

              {isAnalyzing && (
                <div className="p-4 rounded-xl bg-ocean-100/70 border border-ocean-300 text-xs text-ocean-900 space-y-2 animate-fade-in-up">
                  <div className="flex items-center gap-2 font-bold font-mono">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ocean-300 border-t-ocean-700" />
                    <span>Computing Regulatory Dependency Graph…</span>
                  </div>
                  <p className="text-[11px] font-mono text-ocean-800">
                    {ANALYSIS_STEPS[analysisStep] || ANALYSIS_STEPS[ANALYSIS_STEPS.length - 1]}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-ocean-200/80 flex items-center justify-between">
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => setCurrentStep(3)}
                  className="tactile-btn tactile-btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => void handleFinalSubmit()}
                  className="tactile-btn tactile-btn-primary px-6 py-2.5 text-xs font-semibold shadow-tactile hover:shadow-glow-cyan flex items-center gap-2"
                >
                  <span>{isAnalyzing ? 'Evaluating…' : 'Generate Regulatory Roadmap →'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </main>
    </div>
  );
};
