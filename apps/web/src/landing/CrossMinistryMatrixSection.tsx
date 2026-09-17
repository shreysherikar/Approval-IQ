import React, { useState, useEffect } from 'react';
import {
  GitFork,
  ArrowRight,
  Factory,
  FlaskConical,
  Sun,
  Loader2,
  CheckCircle2,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { aiSimulationApi } from '../api-client';

interface ClearanceNode {
  id: string;
  department: string;
  name: string;
  law: string;
  stage: 'central' | 'state' | 'local';
  sequentialDays: number;
  parallelDays: number;
  prerequisites: string[];
  status: 'optimized' | 'instant' | 'parallel';
  aiRationale?: string;
}

interface SectorPreset {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  category: string;
  nodes: ClearanceNode[];
}

const DEFAULT_SECTORS: SectorPreset[] = [
  {
    id: 'manufacturing',
    name: 'Advanced Manufacturing',
    icon: Factory,
    category: 'Orange/Red Category',
    description: 'Precision engineering, automotive ancillaries, and industrial tooling requiring SPCB CTE & Factory Plan approval.',
    nodes: [
      {
        id: 'clu',
        department: 'Town & Country Planning / MIDC',
        name: 'Land Use Conversion (CLU) & Zoning Clearance',
        law: 'State Industrial Development Act, Sec 42',
        stage: 'local',
        sequentialDays: 45,
        parallelDays: 7,
        prerequisites: ['Revenue Survey Sheet', 'Title Deed'],
        status: 'optimized',
        aiRationale: 'GIS zoning records pre-clear master land conversion without manual visits.',
      },
      {
        id: 'spcb-cte',
        department: 'State Pollution Control Board',
        name: 'Consent to Establish (CTE - Orange/Red)',
        law: 'Water Act 1974 Sec 25 / Air Act 1981 Sec 21',
        stage: 'state',
        sequentialDays: 60,
        parallelDays: 14,
        prerequisites: ['CLU Copy', 'Effluent Treatment Flowsheet'],
        status: 'parallel',
        aiRationale: 'Executed concurrently alongside building fire safety inspection.',
      },
      {
        id: 'fire-noc',
        department: 'Directorate of Fire & Emergency Services',
        name: 'Provisional Fire Safety NOC',
        law: 'National Building Code 2016 Part 4',
        stage: 'state',
        sequentialDays: 30,
        parallelDays: 7,
        prerequisites: ['Architectural Site Layout', 'Hydrant Scheme'],
        status: 'parallel',
        aiRationale: 'Multi-desk OCR verification extracts setback dimensions automatically.',
      },
      {
        id: 'factory-plan',
        department: 'Directorate of Industrial Safety & Health (DISH)',
        name: 'Factory Drawing Approval & Registration',
        law: 'Factories Act 1948, Section 6',
        stage: 'state',
        sequentialDays: 45,
        parallelDays: 10,
        prerequisites: ['Fire NOC', 'SPCB CTE'],
        status: 'optimized',
        aiRationale: 'Predecessor validation guarantees zero document re-submission.',
      },
      {
        id: 'discom',
        department: 'State Power Transmission / DISCOM',
        name: '11kV/33kV Industrial Power Sanction',
        law: 'Electricity Act 2003, Sec 43',
        stage: 'local',
        sequentialDays: 30,
        parallelDays: 5,
        prerequisites: ['Factory Plan', 'Ownership Proof'],
        status: 'instant',
        aiRationale: 'Automated load calculation triggers instant substation reservation.',
      },
    ],
  },
  {
    id: 'pharma',
    name: 'Biotech & API Formulations',
    icon: FlaskConical,
    category: 'Red / EIA Category A',
    description: 'Active Pharmaceutical Ingredients, bioreactors, and clinical sterile formulations under MoEFCC and CDSCO oversight.',
    nodes: [
      {
        id: 'moefcc-ec',
        department: 'Ministry of Environment (MoEFCC)',
        name: 'Prior Environmental Clearance (Category A/B1)',
        law: 'EIA Notification 2006 (Item 5f)',
        stage: 'central',
        sequentialDays: 120,
        parallelDays: 28,
        prerequisites: ['Public Hearing Dossier', 'EIA/EMP Baseline'],
        status: 'optimized',
        aiRationale: 'Standardized Terms of Reference (ToR) fast-tracks expert appraisal committee.',
      },
      {
        id: 'cdsco-mfg',
        department: 'CDSCO & State FDA',
        name: 'Form 25/28 Drug Manufacturing License',
        law: 'Drugs & Cosmetics Act 1940, Rule 68',
        stage: 'central',
        sequentialDays: 75,
        parallelDays: 14,
        prerequisites: ['MoEFCC EC', 'Technical Staff Bio-data'],
        status: 'parallel',
        aiRationale: 'GMP cleanroom audit conducted jointly with state FDA inspectorate.',
      },
      {
        id: 'peso',
        department: 'PESO (Petroleum & Explosives)',
        name: 'Solvent & Bulk Chemical Storage License',
        law: 'Petroleum Rules 2002, Form VIII',
        stage: 'central',
        sequentialDays: 45,
        parallelDays: 10,
        prerequisites: ['Fabrication Drawings', 'Site Safety Plan'],
        status: 'parallel',
        aiRationale: 'Storage tank vessel certifications verified through digital CAD validator.',
      },
      {
        id: 'cpcb-zld',
        department: 'Central & State PCB',
        name: 'Zero Liquid Discharge (ZLD) CTE',
        law: 'Water Prevention & Control of Pollution Act',
        stage: 'state',
        sequentialDays: 60,
        parallelDays: 14,
        prerequisites: ['CDSCO Form', 'ZLD RO Schematic'],
        status: 'parallel',
        aiRationale: 'CETP membership certificate validates zero surface discharge.',
      },
    ],
  },
  {
    id: 'clean-tech',
    name: 'Clean Tech & Solar Fab',
    icon: Sun,
    category: 'Green / White Category',
    description: 'Solar wafer cell manufacturing, EV battery packaging, and green hydrogen electrolyzers with expedited fast-track provisions.',
    nodes: [
      {
        id: 'spcb-white',
        department: 'State Pollution Board',
        name: 'Green / White Category Exemption Consent',
        law: 'CPCB Categorization Scheme 2016',
        stage: 'state',
        sequentialDays: 30,
        parallelDays: 2,
        prerequisites: ['Process Flow Diagram'],
        status: 'instant',
        aiRationale: 'Zero-emission classification triggers instant self-certification consent.',
      },
      {
        id: 'mnre-grid',
        department: 'Ministry of New & Renewable Energy / CEIG',
        name: 'Grid Synchronization & Chief Electrical Inspector Approval',
        law: 'Central Electricity Authority Regulations 2010',
        stage: 'central',
        sequentialDays: 45,
        parallelDays: 7,
        prerequisites: ['Inverter Specs', 'Earthing Test Report'],
        status: 'parallel',
        aiRationale: 'Automated telemetry validation ensures direct substation grid hookup.',
      },
      {
        id: 'fire-green',
        department: 'Fire Directorate',
        name: 'Industrial Fire System Deemed NOC',
        law: 'National Building Code Part 4',
        stage: 'local',
        sequentialDays: 20,
        parallelDays: 3,
        prerequisites: ['Building Plan'],
        status: 'instant',
        aiRationale: 'Pre-engineered industrial shed design qualifies for deemed fire consent.',
      },
    ],
  },
];

export const CrossMinistryMatrixSection: React.FC = () => {
  const [selectedSectorId, setSelectedSectorId] = useState('manufacturing');
  const [customNicheInput, setCustomNicheInput] = useState('');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [aiSimulation, setAiSimulation] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Live Dynamic AI DAG Generation
  useEffect(() => {
    let isMounted = true;
    setIsSimulating(true);

    const timer = setTimeout(async () => {
      try {
        const res = await aiSimulationApi.simulateDag({
          sector: selectedSectorId,
          customNiche: customNicheInput.trim() || undefined,
          state: 'Maharashtra',
        });
        if (isMounted && res) {
          setAiSimulation(res);
        }
      } catch {
        // Handled gracefully
      } finally {
        if (isMounted) setIsSimulating(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [selectedSectorId, customNicheInput]);

  const defaultSector = DEFAULT_SECTORS.find((s) => s.id === selectedSectorId) ?? DEFAULT_SECTORS[0]!;
  const nodes: ClearanceNode[] = aiSimulation?.nodes || defaultSector.nodes;
  const activeNode: ClearanceNode = nodes.find((n) => n.id === activeNodeId) ?? nodes[0]!;

  const totalSequential = aiSimulation?.totalSequentialDays || nodes.reduce((acc, curr) => acc + curr.sequentialDays, 0);
  const totalParallel = aiSimulation?.totalOptimizedDays || Math.max(...nodes.map((n) => n.parallelDays)) + 7;
  const timeSaved = Math.round(((totalSequential - totalParallel) / totalSequential) * 100);

  return (
    <section className="py-24 lg:py-32 bg-transparent relative overflow-hidden border-b border-ocean-200/80">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-ocean-300/20 rounded-full blur-3xl pointer-events-none -z-10 animate-float" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none -z-10 animate-float-slow" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="stamp-seal stamp-approved text-[10px] shadow-sm">
            <GitFork className="w-3 h-3 text-ocean-700 inline mr-1 animate-pulse" />
            <span>TOPOLOGICAL CLEARANCE MATRIX</span>
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-bold text-ink tracking-tight">
            How Parallel Routing Collapses Bureaucratic Latency
          </h2>
          <p className="text-xs sm:text-sm text-ink-soft leading-relaxed font-sans max-w-2xl mx-auto">
            Traditional linear approvals force founders to wait for one department to finish before approaching the next. ApprovalIQ compiles a mathematical Dependency DAG to run clearances concurrently.
          </p>
        </div>

        {/* Custom Sector Input & Selector Tabs */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="w-4 h-4 text-ocean-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customNicheInput}
              onChange={(e) => setCustomNicheInput(e.target.value)}
              placeholder="Simulate any custom industry (e.g. Lithium-ion Gigafactory, Space-Tech Satellite Fab, Green Hydrogen)..."
              className="w-full pl-10 pr-24 py-2.5 rounded-full bg-white/95 border border-ocean-300 text-xs sm:text-sm text-ink placeholder-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-500 shadow-sm"
            />
            {customNicheInput && (
              <button
                type="button"
                onClick={() => setCustomNicheInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ocean-500 font-bold hover:text-ocean-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Sector Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          {DEFAULT_SECTORS.map((s) => {
            const isSelected = s.id === selectedSectorId && !customNicheInput.trim();
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedSectorId(s.id);
                  setCustomNicheInput('');
                  setActiveNodeId(null);
                }}
                className={`tactile-btn flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-ocean-950 text-white border-ocean-800 shadow-glow-cyan scale-105'
                    : 'bg-white text-ink-soft border-ocean-200 hover:bg-ocean-50 hover:text-ink'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-300' : 'text-ocean-600'}`} />
                <span>{s.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-normal ${
                    isSelected ? 'bg-ocean-800 text-cyan-200' : 'bg-ocean-100 text-ocean-700'
                  }`}
                >
                  {s.category}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Comparison & Node Inspector Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Interactive DAG Nodes */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between px-2 text-xs font-mono text-ink-muted">
              <div className="flex items-center gap-2">
                <span>STATUTORY CLEARANCE PIPELINE</span>
                {isSimulating && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-ocean-700 animate-pulse font-sans font-bold">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Synthesizing...</span>
                  </span>
                )}
              </div>
              <span>CLICK A NODE TO INSPECT</span>
            </div>

            <div className="space-y-3">
              {nodes.map((node, index) => {
                const isSelected = (activeNodeId ?? nodes[0]?.id) === node.id;
                return (
                  <div
                    key={node.id || index}
                    onClick={() => setActiveNodeId(node.id)}
                    className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer text-left ${
                      isSelected
                        ? 'bg-white border-ocean-600 shadow-glow-cyan-card ring-2 ring-ocean-400/30'
                        : 'bg-white/80 border-ocean-200 hover:border-ocean-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-ocean-950 text-cyan-300'
                              : 'bg-ocean-100 text-ocean-800'
                          }`}
                        >
                          0{index + 1}
                        </div>
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-ocean-600 font-bold">
                            {node.department}
                          </div>
                          <h4 className="text-sm font-bold text-ink mt-0.5">{node.name}</h4>
                          <div className="text-[11px] text-ink-muted mt-0.5 font-mono">{node.law}</div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                            node.status === 'instant'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : node.status === 'parallel'
                              ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {node.status === 'instant' ? 'Instant Deemed' : node.status === 'parallel' ? 'Parallel Desk' : 'Sequenced'}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="line-through text-ink-muted text-[11px]">{node.sequentialDays}d</span>
                          <span className="font-bold text-ocean-700">{node.parallelDays}d</span>
                        </div>
                      </div>
                    </div>

                    {/* Pre-requisite Badges */}
                    <div className="mt-3 pt-2.5 border-t border-ocean-100 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="font-mono text-ink-muted mr-1">Pre-requisites:</span>
                      {node.prerequisites.map((prereq, pIdx) => (
                        <span
                          key={pIdx}
                          className="px-2 py-0.5 rounded-md bg-ocean-50 text-ocean-800 border border-ocean-200 font-mono"
                        >
                          {prereq}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Comparative Metrics & Live Node Inspector */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Latency Collapse Metric Hero Card */}
            <div className="bg-ocean-950 text-white p-6 rounded-3xl border border-ocean-800 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 font-bold">
                  SLA ACCELERATION BENCHMARK
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  ⚡ -{timeSaved}% LATENCY
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-2xl bg-ocean-900/90 border border-ocean-800">
                  <div className="text-[11px] font-mono text-ocean-300">Linear Sequential:</div>
                  <div className="text-3xl font-black font-mono text-rose-400 mt-1">
                    {totalSequential} <span className="text-xs font-normal text-ocean-300">Days</span>
                  </div>
                  <div className="text-[10px] text-ocean-400 mt-1">Traditional siloed filings</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 shadow-glow-cyan">
                  <div className="text-[11px] font-mono text-cyan-300">ApprovalIQ DAG:</div>
                  <div className="text-3xl font-black font-mono text-cyan-300 mt-1">
                    {totalParallel} <span className="text-xs font-normal text-cyan-200">Days</span>
                  </div>
                  <div className="text-[10px] text-cyan-200 mt-1">RTS SLA Guaranteed</div>
                </div>
              </div>

              {aiSimulation?.aiInsights && (
                <p className="text-xs text-ocean-200 leading-relaxed font-sans bg-ocean-900/60 p-3 rounded-xl border border-ocean-800">
                  {aiSimulation.aiInsights}
                </p>
              )}

              {/* Action Link */}
              <Link
                to="/register"
                className="tactile-btn w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-ocean-500 to-cyan-400 text-ocean-950 shadow-glow-cyan flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
              >
                <span>Compile Regulatory Graph for Your Business</span>
                <ArrowRight className="w-4 h-4 text-ocean-950" />
              </Link>
            </div>

            {/* Selected Node Deep-Dive Inspector */}
            {activeNode && (
              <div className="bg-white p-5 rounded-3xl border border-ocean-300 shadow-tactile space-y-3.5 text-left">
                <div className="flex items-center justify-between border-b border-ocean-100 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ocean-700 font-bold">
                      INSPECTING NODE
                    </span>
                    <h4 className="text-base font-bold text-ink">{activeNode.name}</h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-ocean-800 bg-ocean-100 px-2.5 py-1 rounded-lg">
                    Stage: {activeNode.stage.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-ink-soft space-y-2">
                  <div>
                    <span className="font-bold text-ink">Governing Statute:</span> {activeNode.law}
                  </div>
                  <div>
                    <span className="font-bold text-ink">Department:</span> {activeNode.department}
                  </div>
                  {activeNode.aiRationale && (
                    <div className="p-2.5 rounded-xl bg-ocean-50 border border-ocean-200 text-[11px] text-ocean-900 leading-relaxed">
                      <span className="font-bold text-ocean-800">Optimization Rationale:</span> {activeNode.aiRationale}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center gap-2 text-[11px] text-forest-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0" />
                  <span>Document re-use verified: zero redundant notarizations required</span>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </section>
  );
};
