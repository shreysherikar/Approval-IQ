import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { ArrowRight, Sparkles } from 'lucide-react';

interface IndustryItem {
  id: string;
  name: string;
  category: string;
  badge: string;
  image: string;
  location: string;
  permits: string[];
  keyAuthorities: string[];
  turnaroundEstimate: string;
  description: string;
}

export const IndustriesSection: React.FC = () => {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string>('brewery');

  const INDUSTRIES: IndustryItem[] = [
    {
      id: 'brewery',
      name: t('industries.brewery', 'Brewery & Distilleries'),
      category: t('industries.brewery_cat', 'Beverage & Fermentation'),
      badge: t('industries.brewery_badge', 'Red Category SPCB / State Excise'),
      image: '/images/brewery_facility.jpg',
      location: 'Pune, Maharashtra',
      permits: [
        'State Excise Brewery & Bottling License',
        'MPCB Consent to Establish (CTE) - Red Category',
        'FSSAI Central Manufacturer License',
        'CGWA Industrial Groundwater Abstraction NOC'
      ],
      keyAuthorities: ['State Excise Dept', 'Maharashtra Pollution Control Board', 'FSSAI', 'Fire CFO'],
      turnaroundEstimate: t('industries.brewery_time', '45–60 days via single-window consensus'),
      description: t('industries.brewery_desc', 'Comprehensive clearance mapping for craft microbreweries, commercial distilleries, and bottling units with effluent ZLD mandates.'),
    },
    {
      id: 'food',
      name: t('industries.food', 'Food Processing & FMCG'),
      category: t('industries.food_cat', 'Agro-Processing & Dairy'),
      badge: t('industries.food_badge', 'Orange Category / FSSAI Central'),
      image: '/images/smart_manufacturing.jpg',
      location: 'Aurangabad Corridor, India',
      permits: [
        'FSSAI Central Manufacturer License',
        'Directorate of Industrial Safety & Health (DISH) Plan Approval',
        'Legal Metrology Packaged Commodities Registration',
        'SPCB Consent to Establish (Orange Category)'
      ],
      keyAuthorities: ['FSSAI India', 'Directorate of Industrial Safety (DISH)', 'SPCB', 'Local Health Officer'],
      turnaroundEstimate: t('industries.food_time', '25–40 days automated routing'),
      description: t('industries.food_desc', 'Automated hygiene protocols, packaging disclosures, food safety audits, and factory layout approvals.'),
    },
    {
      id: 'chemicals',
      name: t('industries.chemicals', 'Chemical & Specialty Materials'),
      category: t('industries.chemicals_cat', 'Industrial Formulations'),
      badge: t('industries.chemicals_badge', 'MoEFCC EC / PESO Storage'),
      image: '/images/chemical_plant.jpg',
      location: 'Dahej / Gujarat Industrial Zone',
      permits: [
        'MoEFCC Environmental Clearance (EC) / SPCB CTE',
        'PESO Petroleum & Hazardous Storage Clearance',
        'Factory License with Hazardous Process Schedule',
        'State Fire CFO Final NOC'
      ],
      keyAuthorities: ['MoEFCC', 'PESO Nagpur', 'State Pollution Control Board', 'DISH'],
      turnaroundEstimate: t('industries.chemicals_time', '60–90 days critical path sequence'),
      description: t('industries.chemicals_desc', 'Navigate Environmental Impact Assessment notifications, hazardous storage rules, and multi-agency safety clearances.'),
    },
    {
      id: 'imports',
      name: t('industries.imports', 'Cross-Border Trading & Import'),
      category: t('industries.imports_cat', 'Customs & Logistics'),
      badge: t('industries.imports_badge', 'DGFT / Customs ICEGATE'),
      image: '/images/smart_logistics.jpg',
      location: 'JNPT Port Corridor, India',
      permits: [
        'DGFT Importer Exporter Code (IEC)',
        'ICEGATE Single Window Clearance (SWIFT)',
        'BIS Compulsory Registration Scheme (CRS)',
        'EPR Plastic / E-Waste Authorization'
      ],
      keyAuthorities: ['Directorate General of Foreign Trade', 'Central Board of Indirect Taxes & Customs', 'BIS'],
      turnaroundEstimate: t('industries.imports_time', '10–18 days fast-track clearance'),
      description: t('industries.imports_desc', 'Instant customs port mapping, preferential tariff certificate filing, and mandatory quality standard compliances.'),
    },
  ];

  const current = INDUSTRIES.find((ind) => ind.id === selectedId) || INDUSTRIES[0]!;

  return (
    <section id="industries" className="py-20 lg:py-24 bg-canvas border-b border-ocean-200/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-ocean-200/80">
          <div className="space-y-2">
            <span className="stamp-seal stamp-neutral text-[10px]">
              <Sparkles className="w-3 h-3 text-ocean-500 inline mr-1" />
              {t('industries.tag', 'SECTOR-SPECIFIC STATUTORY PROTOCOLS')}
            </span>
            <h2 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-ink tracking-tight">
              {t('industries.title', 'Tailored for Highly Regulated Sectors')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-ink-soft max-w-md font-sans leading-relaxed">
            {t('industries.subtitle', 'Explore exact statutory clearance packages, issuing authorities, and verified turnaround estimates.')}
          </p>
        </div>

        {/* Sector Tabs + Detail Docket Layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Sector Selector Buttons */}
          <div className="lg:col-span-5 space-y-2.5">
            {INDUSTRIES.map((ind) => {
              const isSelected = ind.id === selectedId;
              return (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => setSelectedId(ind.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-white border-ocean-500 shadow-glow-cyan/20 translate-x-1'
                      : 'bg-ocean-50/60 border-ocean-200/80 hover:bg-white hover:border-ocean-300'
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <span className="font-mono text-[10px] uppercase text-ocean-600 font-semibold block mb-0.5">
                      {ind.category}
                    </span>
                    <span className="font-semibold text-sm text-ink block truncate">
                      {ind.name}
                    </span>
                  </div>
                  <span className={`stamp-seal text-[9px] shrink-0 ${isSelected ? 'stamp-approved' : 'stamp-neutral'}`}>
                    {isSelected ? 'Active Sector' : 'Select'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Authoritative Sector Docket Card */}
          <div className="lg:col-span-7 editorial-card p-6 bg-white space-y-5 border border-ocean-300/80 shadow-tactile-lg rounded-2xl animate-scale-in">
            {/* Sector High-Resolution Imagery Banner */}
            <div className="relative h-44 sm:h-52 w-full rounded-xl overflow-hidden border border-ocean-200 shadow-inner group">
              <img
                src={current.image}
                alt={current.name}
                className="w-full h-full object-cover object-center transform transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold drop-shadow-sm">{current.name}</span>
                </div>
                <span className="font-mono text-[11px] text-white/80 bg-black/40 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/20">
                  {current.location}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ocean-200/80 pb-3">
              <div>
                <span className="stamp-seal stamp-approved text-[10px]">
                  {current.badge}
                </span>
                <h3 className="font-editorial text-xl font-bold text-ink mt-1.5">
                  {current.name} Clearance Package
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-ink-muted uppercase block">Estimated SLA</span>
                <span className="font-mono font-bold text-xs text-ocean-700">{current.turnaroundEstimate}</span>
              </div>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed font-sans">
              {current.description}
            </p>

            {/* Mandatory Approvals Checklist */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-ocean-950 uppercase tracking-wider block">
                Mandatory Statutory Approvals in Sequence:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {current.permits.map((permit, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-ocean-50/60 border border-ocean-200/80 flex items-start gap-2 text-xs hover:bg-white hover:border-ocean-300 transition-colors">
                    <span className="font-mono text-ocean-600 font-bold shrink-0">{idx + 1}.</span>
                    <span className="font-medium text-ink leading-tight">{permit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Nodal Authorities */}
            <div className="pt-3 border-t border-ocean-200/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono text-ink-muted uppercase">Issuing Desks:</span>
                {current.keyAuthorities.map((auth, idx) => (
                  <span key={idx} className="stamp-seal stamp-neutral text-[9px]">
                    {auth}
                  </span>
                ))}
              </div>

              <Link
                to="/register"
                className="tactile-btn tactile-btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shadow-tactile hover:shadow-glow-cyan"
              >
                <span>Launch {current.name} Roadmap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
