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
  Sparkles,
  TrendingUp,
  RefreshCw,
  Building,
  FileText,
  Clock,
  Lightbulb,
  FolderClosed,
  Check,
  ShieldCheck,
  X
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

export function IndustryIcon({ iconKey, className = "w-4 h-4 text-slate-800" }: { iconKey: string; className?: string }): JSX.Element {
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
  { id: 'brewery', name: 'Craft Breweries & Distilleries', iconKey: 'brewery', category: 'Food & Beverage', path: 'Food & Beverage → Beverage Manufacturing → Brewery', popular: true },
  { id: 'food_processing', name: 'Food Processing & Packaged Goods', iconKey: 'food_processing', category: 'Food & Beverage', path: 'Food & Beverage → Agro-Processing → Packaged Food', popular: true },
  { id: 'pharma', name: 'Pharmaceuticals & Active Ingredients', iconKey: 'pharma', category: 'Healthcare & Life Sciences', path: 'Healthcare → Pharmaceuticals → Formulations & APIs', popular: true },
  { id: 'chemicals', name: 'Specialty Chemicals & Polymers', iconKey: 'chemicals', category: 'Chemicals & Materials', path: 'Chemicals → Specialty Reagents & Industrial Resins', popular: true },
  { id: 'automotive_ev', name: 'Automotive & EV Powertrains', iconKey: 'automotive_ev', category: 'Manufacturing & Engineering', path: 'Engineering → Automotive Assembly & EV Systems', popular: true },
  { id: 'renewable_energy', name: 'Renewable Energy & Solar Tech', iconKey: 'renewable_energy', category: 'Clean Tech & Energy', path: 'Clean Tech → Solar PV Modules & Energy Storage', popular: true },
  { id: 'textiles', name: 'Textile Mills & Technical Fabrics', iconKey: 'textiles', category: 'Textiles & Apparel', path: 'Textiles → Spinning, Dyeing & Technical Fabrics', popular: true },
  { id: 'cold_chain', name: 'Cold Chain Logistics & Warehousing', iconKey: 'cold_chain', category: 'Logistics & Infrastructure', path: 'Infrastructure → Temperature-Controlled Logistics', popular: true },
  { id: 'electronics', name: 'Data Centers & Electronics Assembly', iconKey: 'electronics', category: 'Electronics & IT', path: 'Electronics → Hardware Assembly & Data Centers' },
  { id: 'heavy_machinery', name: 'Heavy Machinery & Steel Fabrication', iconKey: 'heavy_machinery', category: 'Heavy Industry', path: 'Heavy Industry → Industrial Equipment & Fabrication' },
];

const PLAN_TYPES = [
  { id: 'new_business', label: 'Start a new business', iconType: 'new', desc: 'Greenfield commercial or manufacturing establishment' },
  { id: 'expand_facility', label: 'Expand an existing facility', iconType: 'expand', desc: 'Brownfield capacity expansion or modernization' },
  { id: 'new_plant', label: 'Set up an additional plant / unit', iconType: 'plant', desc: 'New operational facility in an existing enterprise' },
  { id: 'modify_activity', label: 'Add / modify business activity', iconType: 'modify', desc: 'Line expansion or product categorization change' },
];

const LAND_STATUS_OPTIONS = [
  { id: 'owned', label: 'Owned Land / Premise', iconType: 'owned', desc: 'Freehold title or registered property in company name' },
  { id: 'leased', label: 'Leased / Industrial Shed', iconType: 'leased', desc: 'Registered lease agreement (MIDC, GIDC, private)' },
  { id: 'not_yet_acquired', label: 'Not Yet Acquired', iconType: 'pending', desc: 'In negotiation / land selection phase' },
];

function PlanTypeIcon({ type, className = "w-5 h-5 text-slate-700" }: { type: string; className?: string }): JSX.Element {
  switch (type) {
    case 'new':
      return <Zap className={className} />;
    case 'expand':
      return <TrendingUp className={className} />;
    case 'plant':
      return <Factory className={className} />;
    case 'modify':
    default:
      return <RefreshCw className={className} />;
  }
}

function LandStatusIcon({ type, className = "w-5 h-5 text-slate-700" }: { type: string; className?: string }): JSX.Element {
  switch (type) {
    case 'owned':
      return <Building className={className} />;
    case 'leased':
      return <FileText className={className} />;
    case 'pending':
    default:
      return <Clock className={className} />;
  }
}

const STATE_DISTRICTS: Record<string, { name: string; code: string; districts: string[]; spcb: string; singleWindow: string }> = {
  MH: {
    name: 'Maharashtra',
    code: 'MH',
    districts: ['Pune', 'Mumbai Suburban', 'Mumbai City', 'Thane', 'Nashik', 'Nagpur', 'Aurangabad / Sambhajinagar', 'Kolhapur', 'Raigad', 'Solapur'],
    spcb: 'Maharashtra Pollution Control Board (MPCB)',
    singleWindow: 'MAITRI Single Window Portal',
  },
  KA: {
    name: 'Karnataka',
    code: 'KA',
    districts: ['Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Dakshina Kannada (Mangaluru)', 'Hubballi-Dharwad', 'Belagavi', 'Tumakuru', 'Udupi'],
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
    districts: ['Hyderabad', 'Rangareddy', 'Medchal-Malkajgiri', 'Sangareddy (Genome Valley)', 'Warangal', 'Nizamabad', 'Karimnagar'],
    spcb: 'Telangana State Pollution Control Board (TSPCB)',
    singleWindow: 'TS-iPASS Instant Clearances Portal',
  },
  TN: {
    name: 'Tamil Nadu',
    code: 'TN',
    districts: ['Chennai', 'Kanchipuram (Sriperumbudur)', 'Coimbatore', 'Tirupur', 'Krishnagiri (Hosur)', 'Tiruvallur', 'Salem', 'Madurai'],
    spcb: 'Tamil Nadu Pollution Control Board (TNPCB)',
    singleWindow: 'Guidance Tamil Nadu Single Window',
  },
  DL: {
    name: 'Delhi NCR',
    code: 'DL',
    districts: ['New Delhi', 'South Delhi', 'Gurugram (Haryana)', 'Gautam Buddha Nagar (Noida)', 'Faridabad', 'Ghaziabad'],
    spcb: 'Delhi Pollution Control Committee (DPCC) / CAQM',
    singleWindow: 'Delhi Single Window Clearances Portal',
  },
  RJ: {
    name: 'Rajasthan',
    code: 'RJ',
    districts: ['Jaipur', 'Alwar (Neemrana)', 'Jodhpur', 'Udaipur', 'Kota', 'Bhilwara', 'Bikaner'],
    spcb: 'Rajasthan State Pollution Control Board (RSPCB)',
    singleWindow: 'RajNivesh Single Window System',
  },
  UP: {
    name: 'Uttar Pradesh',
    code: 'UP',
    districts: ['Gautam Buddha Nagar (Noida)', 'Lucknow', 'Kanpur Nagar', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut'],
    spcb: 'UP Pollution Control Board (UPPCB)',
    singleWindow: 'Nivesh Mitra Single Window System',
  },
  WB: {
    name: 'West Bengal',
    code: 'WB',
    districts: ['Kolkata', 'Howrah', 'North 24 Parganas', 'Purba Medinipur (Haldia)', 'Paschim Bardhaman (Durgapur/Asansol)', 'Hooghly'],
    spcb: 'West Bengal Pollution Control Board (WBPCB)',
    singleWindow: 'Silpa Sathi Single Window Desk',
  },
  MP: {
    name: 'Madhya Pradesh',
    code: 'MP',
    districts: ['Indore', 'Dhar (Pithampur Auto Belt)', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain'],
    spcb: 'MP Pollution Control Board (MPPCB)',
    singleWindow: 'MP Single Window Portal (Invest MP)',
  },
  PB: {
    name: 'Punjab',
    code: 'PB',
    districts: ['Ludhiana', 'SAS Nagar (Mohali)', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'],
    spcb: 'Punjab Pollution Control Board (PPCB)',
    singleWindow: 'Invest Punjab Single Window Service Desk',
  },
  AP: {
    name: 'Andhra Pradesh',
    code: 'AP',
    districts: ['Visakhapatnam', 'NTR (Vijayawada)', 'Tirupati (Sri City)', 'Guntur', 'Krishna'],
    spcb: 'Andhra Pradesh Pollution Control Board (APPCB)',
    singleWindow: 'AP Single Desk Portal',
  },
  KL: {
    name: 'Kerala',
    code: 'KL',
    districts: ['Ernakulam (Kochi)', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Palakkad'],
    spcb: 'Kerala State Pollution Control Board (KSPCB)',
    singleWindow: 'K-SWIFT Single Window Interface',
  },
  GA: {
    name: 'Goa',
    code: 'GA',
    districts: ['North Goa (Panaji)', 'South Goa (Verna/Margao)'],
    spcb: 'Goa State Pollution Control Board (GSPCB)',
    singleWindow: 'Goa Investment Promotion Board Portal',
  },
  HP: {
    name: 'Himachal Pradesh',
    code: 'HP',
    districts: ['Solan (Baddi-Barotiwala-Nalagarh)', 'Sirmaur', 'Una', 'Shimla'],
    spcb: 'Himachal Pradesh State Pollution Control Board',
    singleWindow: 'HP Single Window Clearance Desk',
  },
};

const AREA_TYPE_OPTIONS = [
  { value: 'built_up', label: 'Built-Up Area (Covered)' },
  { value: 'plot', label: 'Total Plot / Land Area' },
  { value: 'leased', label: 'Leased Facility Area' },
  { value: 'operational', label: 'Operational Factory Floor' },
];

interface ProjectHistoryItem {
  id: string;
  name: string;
  industry: string;
  state?: string;
  district?: string;
  createdAt: string;
}

const STORAGE_PROJECTS_KEY = 'approvaliq:created-projects';

function getStoredProjects(): ProjectHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as ProjectHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveStoredProject(project: ProjectHistoryItem): void {
  try {
    const list = getStoredProjects();
    const updated = [project, ...list.filter((p) => p.id !== project.id)].slice(0, 10);
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage issues
  }
}

export const ProjectsOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isOfficer, accessToken, logout } = useAuth();
  const { t } = useLanguage();

  // Wizard Steps: 1 = Business, 2 = Location, 3 = Project Details, 4 = Review
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [projectName, setProjectName] = useState('');
  const [industrySearch, setIndustrySearch] = useState('');
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>('brewery');
  
  const [selectedStateCode, setSelectedStateCode] = useState<string>('MH');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Pune');

  const [planType, setPlanType] = useState<string>('new_business');
  const [landStatus, setLandStatus] = useState<string>('leased');
  const [areaSqft, setAreaSqft] = useState<string>('25000');
  const [areaType, setAreaType] = useState<string>('built_up');
  const [investmentInr, setInvestmentInr] = useState<string>('40000000'); // 4 Cr
  const [employeeCount, setEmployeeCount] = useState<string>('85');
  const [activityDescription, setActivityDescription] = useState<string>('Craft beer brewing, fermentation, bottling & packaging line');

  // UI / Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [existingProjects, setExistingProjects] = useState<ProjectHistoryItem[]>([]);

  useEffect(() => {
    setExistingProjects(getStoredProjects());
  }, []);

  const selectedIndustry = useMemo(() => {
    return INDUSTRIES.find((i) => i.id === selectedIndustryId) || INDUSTRIES[0]!;
  }, [selectedIndustryId]);

  const stateInfo = useMemo(() => {
    return STATE_DISTRICTS[selectedStateCode] || STATE_DISTRICTS['MH']!;
  }, [selectedStateCode]);

  // Filtered industries based on search input
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

  // Validation per step
  const isStep1Valid = projectName.trim().length > 0 && selectedIndustryId.length > 0;
  const isStep2Valid = selectedStateCode.length > 0 && selectedDistrict.length > 0;
  const isStep3Valid = landStatus.length > 0 && areaSqft.trim().length > 0 && areaType.length > 0;

  // Analysis steps text
  const ANALYSIS_STEPS = [
    'Parsing industrial activity classification...',
    `Evaluating ${stateInfo.name} & ${selectedDistrict} single-window requirements...`,
    'Assessing environmental pollution tier (Orange / Red Category)...',
    'Generating statutory document checklists & clearance prerequisites...',
    'Synthesizing intelligent approval dependency roadmap...',
  ];

  const handleFinalSubmit = async (): Promise<void> => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisStep(0);

    // Progressive step simulation for animation
    const stepInterval = setInterval(() => {
      setAnalysisStep((prev) => {
        if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 500);

    try {
      // 1. Generate internal seamless businessId without bothering user
      const cleanSlug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 20);
      const generatedBusinessId = `${cleanSlug || 'business'}-${Math.random().toString(36).substring(2, 7)}`;

      // 2. Create the Project record via backend API
      const project = await projectsApi.create(
        {
          name: projectName.trim(),
          industry: 'brewery', // standard compliant industry code accepted by backend
          businessId: generatedBusinessId,
        },
        accessToken ?? undefined
      );

      // Save to local project cache for convenient recall
      saveStoredProject({
        id: project.id,
        name: project.name,
        industry: selectedIndustry.name,
        state: stateInfo.name,
        district: selectedDistrict,
        createdAt: new Date().toLocaleDateString(),
      });

      // 3. Build canonical profile payload matching backend contracts
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

      // 4. Create Draft and Confirm Profile Version to generate approvals evaluation automatically
      const draft = await profilesApi.createDraft(project.id, values, accessToken ?? undefined);
      await profilesApi.confirm(project.id, draft.id, accessToken ?? undefined);

      clearInterval(stepInterval);
      setAnalysisStep(ANALYSIS_STEPS.length);

      // 5. Seamlessly route to the interactive Approval Roadmap
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900 relative">
      
      {/* Subtle Background Particle Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-80 h-80 bg-indigo-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Modern Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs relative">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-base shadow-sm shadow-blue-500/30 group-hover:scale-105 transition-transform">
              ▲
            </div>
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">
              Approval<span className="text-blue-600">IQ</span>
            </span>
          </Link>
          <span className="hidden sm:inline-block text-xs text-slate-300 font-mono">|</span>
          <span className="hidden sm:inline-block text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
            {t('onboarding.desk_title', 'Project Onboarding Desk')}
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-xs font-medium">
          <LanguageSwitcher />

          {user?.email && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{user.email}</span>
            </div>
          )}

          {isOfficer && (
            <Link
              to="/officer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>{t('nav.officer_queue', 'Officer Queue')}</span>
            </Link>
          )}

          <Link
            to="/business-map"
            className="hidden sm:inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors"
          >
            <Compass className="w-4 h-4 text-slate-600" />
            <span>{t('nav.business_map', 'Business Map')}</span>
          </Link>

          <button
            type="button"
            onClick={() => logout()}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {t('nav.logout', 'Logout')}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
        
        {/* Hero Banner */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('onboarding.badge', 'Intelligent Regulatory Setup')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {t('onboarding.hero_title', "Let's understand your business.")}
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t('onboarding.hero_subtitle', "Tell ApprovalIQ a little about your project and we'll help identify the statutory approvals, mandatory documents, and clearance timelines that apply.")}
          </p>
        </div>

        {/* Main Grid: Guided Card + Right Analysis Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Guided Multi-Step Card (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 relative overflow-hidden">
            
            {/* Step Progress Bar */}
            <div className="mb-8 pb-6 border-b border-slate-100">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-3">
                {[
                  { num: 1, label: t('onboarding.step_business', 'Business') },
                  { num: 2, label: t('onboarding.step_location', 'Location') },
                  { num: 3, label: t('onboarding.step_project', 'Project') },
                  { num: 4, label: t('onboarding.step_review', 'Review') },
                ].map((step) => {
                  const isDone = currentStep > step.num;
                  const isActive = currentStep === step.num;
                  return (
                    <button
                      key={step.num}
                      type="button"
                      onClick={() => {
                        if (step.num < currentStep || (step.num === 2 && isStep1Valid) || (step.num === 3 && isStep2Valid)) {
                          setCurrentStep(step.num as 1 | 2 | 3 | 4);
                        }
                      }}
                      className={`flex items-center gap-2 transition-all ${
                        isActive
                          ? 'text-blue-600 font-extrabold'
                          : isDone
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                            : isDone
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5 text-white" /> : step.num}
                      </span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Progress Line */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(currentStep / 4) * 100}%` }}
                />
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="font-bold ml-2 text-rose-600 hover:text-rose-800"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* STEP 1: BUSINESS */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    What are you setting up?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Enter your project name and select your industry sector.
                  </p>
                </div>

                {/* Project Name Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Project Name *
                    </label>
                    <span className="text-[11px] text-slate-400">Recognizable internal identifier</span>
                  </div>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. New craft brewery in Pune"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-medium"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Give your project a name you'll easily recognize in your roadmap and audit logs.
                  </p>
                </div>

                {/* Searchable Industry Selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Industry Sector &amp; Niche *
                    </label>
                    <span className="text-[11px] text-blue-600 font-medium">
                      Selected: <strong>{selectedIndustry.name}</strong>
                    </span>
                  </div>

                  <div className="relative">
                    <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={industrySearch}
                      onChange={(e) => setIndustrySearch(e.target.value)}
                      placeholder="Search your industry (e.g. Brewery, Pharmaceuticals, Renewable Energy)..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  {/* Popular Category Chips */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
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
                          className={`text-left p-3 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <span className="p-2 rounded-xl bg-slate-100 border border-slate-200/80">
                            <IndustryIcon iconKey={ind.iconKey} className="w-5 h-5 text-slate-800" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{ind.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">{ind.category}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Breadcrumb path */}
                  <div className="p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Classification Path:</span>
                    <span className="font-mono text-blue-700 truncate">{selectedIndustry.path}</span>
                  </div>
                </div>

                {/* Step 1 Actions */}
                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={!isStep1Valid}
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 cursor-pointer"
                  >
                    Continue to Location →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: LOCATION */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Where will your business operate?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    State and district determine your regional pollution board, fire department, and single-window portal.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* State Select */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        State / Union Territory *
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'state' ? null : 'state')}
                        className="text-[11px] text-blue-600 hover:underline font-medium"
                      >
                        Why do we ask?
                      </button>
                    </div>
                    <select
                      value={selectedStateCode}
                      onChange={(e) => {
                        const newCode = e.target.value;
                        setSelectedStateCode(newCode);
                        const firstDist = STATE_DISTRICTS[newCode]?.districts[0] || 'Default District';
                        setSelectedDistrict(firstDist);
                      }}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    >
                      {Object.values(STATE_DISTRICTS).map((st) => (
                        <option key={st.code} value={st.code}>
                          {st.name} ({st.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* District Select */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        District / Industrial Cluster *
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'district' ? null : 'district')}
                        className="text-[11px] text-blue-600 hover:underline font-medium"
                      >
                        Why do we ask?
                      </button>
                    </div>
                    <select
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    >
                      {stateInfo.districts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>

                {/* Helpful Tooltip Callout */}
                {activeTooltip && (
                  <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Why Location Matters:</strong> In India, environmental consent (CTE/CTO), industrial development land allotments (e.g., MIDC/KIADB/GIDC), and state excise permits are strictly governed by state-level statutes.
                    </div>
                  </div>
                )}

                {/* Mini State Intelligence Preview Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono">Pollution Control Authority:</span>
                    <span className="font-bold text-slate-800">{stateInfo.spcb}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono">Single Window Clearance:</span>
                    <span className="font-bold text-blue-700">{stateInfo.singleWindow}</span>
                  </div>
                </div>

                {/* Step 2 Actions */}
                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!isStep2Valid}
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 cursor-pointer"
                  >
                    Continue to Project Details →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PROJECT DETAILS */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    What are you planning to do?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Specify your facility sizing, investment scale, and land status for accurate consent fee and licensing calculation.
                  </p>
                </div>

                {/* Plan Type Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Project Lifecycle Stage
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PLAN_TYPES.map((plan) => {
                      const isSelected = planType === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setPlanType(plan.id)}
                          className={`text-left p-3 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-500'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <span className="p-2 rounded-xl bg-slate-100 border border-slate-200/80">
                            <PlanTypeIcon type={plan.iconType} className="w-4 h-4 text-slate-800" />
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{plan.label}</div>
                            <div className="text-[10px] text-slate-500">{plan.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Land Status Cards */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Land / Premise Status
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {LAND_STATUS_OPTIONS.map((ls) => {
                      const isSelected = landStatus === ls.id;
                      return (
                        <button
                          key={ls.id}
                          type="button"
                          onClick={() => setLandStatus(ls.id)}
                          className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-500'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="mb-2 p-1.5 rounded-lg bg-slate-100 inline-block border border-slate-200/80">
                            <LandStatusIcon type={ls.iconType} className="w-4 h-4 text-slate-800" />
                          </div>
                          <div className="text-xs font-bold text-slate-900">{ls.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{ls.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Area & Sizing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                      Area (in Square Feet) *
                    </label>
                    <input
                      type="number"
                      value={areaSqft}
                      onChange={(e) => setAreaSqft(e.target.value)}
                      placeholder="e.g. 25000"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                      Area Type (Required) *
                    </label>
                    <select
                      value={areaType}
                      onChange={(e) => setAreaType(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    >
                      {AREA_TYPE_OPTIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Investment & Employees */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Total Project Investment (INR)
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Land + Plant &amp; Machinery</span>
                    </div>
                    <input
                      type="number"
                      value={investmentInr}
                      onChange={(e) => setInvestmentInr(e.target.value)}
                      placeholder="e.g. 40000000"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Projected Full Workforce
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Operational Capacity</span>
                    </div>
                    <input
                      type="number"
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(e.target.value)}
                      placeholder="e.g. 85"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                </div>

                {/* Specific Business Activity */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                    Specific Business Activity Description
                  </label>
                  <input
                    type="text"
                    value={activityDescription}
                    onChange={(e) => setActivityDescription(e.target.value)}
                    placeholder="e.g. Commercial craft beer brewing, kegging and packaging line"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                {/* Step 3 Actions */}
                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!isStep3Valid}
                    onClick={() => setCurrentStep(4)}
                    className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 cursor-pointer"
                  >
                    Review Project →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRM */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Review your project profile
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    ApprovalIQ will evaluate this profile against applicable central and state regulatory frameworks.
                  </p>
                </div>

                {/* Review Cards Grid */}
                <div className="space-y-4">
                  
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Business Identity</span>
                      <button type="button" onClick={() => setCurrentStep(1)} className="text-xs text-blue-600 font-semibold hover:underline">
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">Project Name:</span>
                        <strong className="text-slate-900 text-sm">{projectName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Industry Sector:</span>
                        <strong className="text-slate-900 text-sm">{selectedIndustry.name}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Geographic Jurisdiction</span>
                      <button type="button" onClick={() => setCurrentStep(2)} className="text-xs text-blue-600 font-semibold hover:underline">
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">State:</span>
                        <strong className="text-slate-900 text-sm">{stateInfo.name} ({stateInfo.code})</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">District:</span>
                        <strong className="text-slate-900 text-sm">{selectedDistrict}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Operational Parameters</span>
                      <button type="button" onClick={() => setCurrentStep(3)} className="text-xs text-blue-600 font-semibold hover:underline">
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">Land Status:</span>
                        <strong className="text-slate-900">{landStatus.replace('_', ' ').toUpperCase()}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Built-up Area:</span>
                        <strong className="text-slate-900">{Number(areaSqft).toLocaleString()} sq ft</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Projected Workforce:</span>
                        <strong className="text-slate-900">{employeeCount} Personnel</strong>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Final Submission Action */}
                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFinalSubmit()}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-sm shadow-xl shadow-blue-500/30 transition-all hover:scale-105 cursor-pointer"
                  >
                    Analyze My Requirements →
                  </button>
                </div>
              </div>
            )}

            {/* Cinematic Full-Card Analysis Loading Overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-xl shadow-blue-500/30 animate-bounce mb-6">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
                  Analyzing your project...
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6">
                  Synthesizing regulatory rules, state single-window checkpoints, and document prerequisites.
                </p>

                <div className="w-full max-w-md space-y-2.5 text-left font-mono text-xs">
                  {ANALYSIS_STEPS.map((stepText, idx) => {
                    const isDone = analysisStep > idx;
                    const isCurrent = analysisStep === idx;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          isDone
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : isCurrent
                            ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <span>{stepText}</span>
                        <span className="flex items-center">
                          {isDone ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : isCurrent ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full border border-slate-300" />
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Right: Live ApprovalIQ Analysis Preview Card (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Real-Time Analysis Status */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-blue-600 uppercase tracking-wider font-bold">
                  Live Project Profile
                </span>
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                  {currentStep === 1 ? '25%' : currentStep === 2 ? '50%' : currentStep === 3 ? '75%' : '100%'} Ready
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {projectName || 'Your New Project'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedIndustry.name} • {stateInfo.name}
                </p>
              </div>

              {/* Dynamic Assessment Checkmarks */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Check className={`w-3.5 h-3.5 ${projectName ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <span>Industry framework mapped</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Check className={`w-3.5 h-3.5 ${selectedStateCode ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <span>{stateInfo.name} state single-window identified</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Check className={`w-3.5 h-3.5 ${landStatus ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <span>Premise title &amp; area sizing configured</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Check className={`w-3.5 h-3.5 ${currentStep >= 3 ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <span>Workforce &amp; investment fee tier derived</span>
                </div>
              </div>

              {/* Regulatory Insight Callout */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 text-xs text-blue-900 space-y-1">
                <div className="font-bold text-[11px] uppercase tracking-wider text-blue-800">
                  Expected Clearances ({stateInfo.code})
                </div>
                <p className="text-[11px] leading-relaxed text-blue-950">
                  {selectedStateCode === 'MH'
                    ? 'MPCB Consent to Establish (CTE), MIDC Land Sanction, CFO Fire NOC, State Excise Brewery License.'
                    : selectedStateCode === 'KA'
                    ? 'KSPCB Consent to Establish, Karnataka eBiz Single Desk, Factory Directorate License.'
                    : `${stateInfo.spcb} Environmental Consent, Single Window Sanction, CFO Fire NOC.`}
                </p>
              </div>
            </div>

            {/* Existing Projects / Quick Recall Drawer */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xl shadow-slate-200/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                  Your Recent Projects
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  {existingProjects.length} Created
                </span>
              </div>

              {existingProjects.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                    <FolderClosed className="w-5 h-5 text-slate-700" />
                  </div>
                  <div className="text-xs font-bold text-slate-700">No projects yet</div>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Complete the guided setup above to create your first project roadmap.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {existingProjects.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {p.district || p.state || 'India'} • {p.industry}
                        </div>
                      </div>
                      <Link
                        to={`/projects/${p.id}/roadmap`}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shrink-0 transition-all cursor-pointer"
                      >
                        Roadmap →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </main>
    </div>
  );
};
