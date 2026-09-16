import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';

interface IndustryItem {
  id: string;
  name: string;
  category: string;
  iconBg: string;
  iconColor: string;
  badge: string;
  icon: React.ReactNode;
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
      iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconColor: 'text-emerald-600',
      badge: t('industries.brewery_badge', 'High Regulatory Focus'),
      permits: [
        'State Excise Brewery License',
        'SPCB Consent to Establish (CTE)',
        'FSSAI Central Manufacturer License',
        'CGWA Groundwater Clearance'
      ],
      keyAuthorities: ['State Excise Dept', 'State Pollution Control Board', 'FSSAI', 'Fire & Safety Dept'],
      turnaroundEstimate: t('industries.brewery_time', '35–60 days with AI guidance'),
      description: t('industries.brewery_desc', 'Comprehensive compliance mapping for craft microbreweries, distilleries, and bottling plants across all Indian states.'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
    {
      id: 'food',
      name: t('industries.food', 'Food Processing'),
      category: t('industries.food_cat', 'FMCG & Agro Products'),
      iconBg: 'bg-rose-50 text-rose-700 border-rose-200',
      iconColor: 'text-rose-600',
      badge: t('industries.food_badge', 'Multi-Tier Compliance'),
      permits: [
        'FSSAI Central / State License',
        'Factory Inspectorate Approval',
        'Legal Metrology Packaging Approval',
        'SPCB Orange Category Consent'
      ],
      keyAuthorities: ['FSSAI India', 'Directorate of Industrial Safety', 'SPCB', 'Municipal Health Officer'],
      turnaroundEstimate: t('industries.food_time', '20–40 days automated mapping'),
      description: t('industries.food_desc', 'Automate hygiene standards, packaging disclosures, food safety audits, and factory plant certifications.'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: 'chemicals',
      name: t('industries.chemicals', 'Chemical Manufacturing'),
      category: t('industries.chemicals_cat', 'Industrial Materials'),
      iconBg: 'bg-blue-50 text-blue-700 border-blue-200',
      iconColor: 'text-blue-600',
      badge: t('industries.chemicals_badge', 'Red Category SPCB'),
      permits: [
        'MoEFCC Environmental Clearance (EC)',
        'SPCB Consent to Establish (CTE)',
        'PESO Petroleum & Explosives License',
        'Factory License & Hazardous Waste'
      ],
      keyAuthorities: ['Ministry of Environment (MoEFCC)', 'PESO Nagpur', 'State Pollution Board', 'DISh'],
      turnaroundEstimate: t('industries.chemicals_time', '45–90 days end-to-end guidance'),
      description: t('industries.chemicals_desc', 'Navigate strict EIA notifications, hazardous substance storage rules, and multi-agency environmental clearances.'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
    {
      id: 'imports',
      name: t('industries.imports', 'Imports & Trading'),
      category: t('industries.imports_cat', 'Cross-Border Commerce'),
      iconBg: 'bg-purple-50 text-purple-700 border-purple-200',
      iconColor: 'text-purple-600',
      badge: t('industries.imports_badge', 'Customs & Trade'),
      permits: [
        'Importer Exporter Code (IEC)',
        'DGFT Registrations',
        'BIS Compulsory Registration Scheme',
        'Customs ICEGATE Single Window'
      ],
      keyAuthorities: ['DGFT India', 'CBIC / ICEGATE', 'Bureau of Indian Standards', 'Plant Quarantine / CDSCO'],
      turnaroundEstimate: t('industries.imports_time', '7–15 days fast-tracked'),
      description: t('industries.imports_desc', 'Streamline import certifications, customs classification, HS codes, and BIS product registration conformity.'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      id: 'pharma',
      name: t('industries.pharma', 'Pharmaceuticals & Biotech'),
      category: t('industries.pharma_cat', 'Life Sciences'),
      iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      iconColor: 'text-indigo-600',
      badge: t('industries.pharma_badge', 'CDSCO Regulated'),
      permits: [
        'Drug Manufacturing License (Form 25/28)',
        'CDSCO SUGAM Approvals',
        'WHO-GMP Certification',
        'Bio-Medical Waste Authorization'
      ],
      keyAuthorities: ['CDSCO Central', 'State Drug Control Administration', 'State Pollution Control Board'],
      turnaroundEstimate: t('industries.pharma_time', '30–60 days structured review'),
      description: t('industries.pharma_desc', 'Ensure audit-ready documentation for clinical trials, API formulation plants, and healthcare product clearances.'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'logistics',
      name: t('industries.logistics', 'Logistics & Warehousing'),
      category: t('industries.logistics_cat', 'Supply Chain & Storage'),
      iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
      iconColor: 'text-amber-600',
      badge: t('industries.logistics_badge', 'Infrastructure'),
      permits: [
        'Warehouse Registration (WDRA)',
        'PESO Hazardous Storage Approval',
        'State Fire NOC',
        'Building Plan Sanction'
      ],
      keyAuthorities: ['WDRA', 'PESO', 'Town & Country Planning', 'State Fire Dept'],
      turnaroundEstimate: t('industries.logistics_time', '15–30 days accelerated'),
      description: t('industries.logistics_desc', 'Fast-track cold storage zoning, hazardous logistics clearances, and multi-modal fulfillment licenses.'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM4 17h1.5a2.5 2.5 0 002.5-2.5V9.5A2.5 2.5 0 0110.5 7h6A2.5 2.5 0 0119 9.5v5a2.5 2.5 0 002.5 2.5H22M4 17H3a1 1 0 01-1-1v-4a1 1 0 011-1h1m16 6h1a1 1 0 001-1v-4a1 1 0 00-1-1h-1" />
        </svg>
      ),
    },
  ];

  const selectedIndustry: IndustryItem =
    INDUSTRIES.find((ind) => ind.id === selectedId) ?? INDUSTRIES[0]!;

  return (
    <section id="industries" className="relative py-20 lg:py-28 overflow-hidden">
      {/* Background Indian Architecture Silhouette Accent */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-100/80 to-transparent pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-brand-primary-600 mb-2">
            {t('industries.tag', 'INDUSTRY-SPECIFIC INTELLIGENCE')}
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {t('industries.title', 'Tailored Compliance Across Sectors')}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            {t('industries.subtitle', 'Every industry faces unique statutory matrices. ApprovalIQ embeds sector-specific rule engines.')}
          </p>
        </div>

        {/* Industry Selection Pills Row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {INDUSTRIES.map((ind) => {
            const isSelected = ind.id === selectedId;
            return (
              <button
                key={ind.id}
                type="button"
                onClick={() => setSelectedId(ind.id)}
                className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-xs border cursor-pointer ${
                  isSelected
                    ? `${ind.iconBg} font-semibold ring-2 ring-brand-primary-500/30 scale-105 shadow-md`
                    : 'bg-white/90 text-slate-700 border-slate-200/80 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <span className={ind.iconColor}>{ind.icon}</span>
                <span>{ind.name}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Industry Detail View Card */}
        <div className="mt-10 max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 p-6 sm:p-10 transition-all duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left detail info */}
              <div className="lg:col-span-7 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-primary-50 text-brand-primary-700 border border-brand-primary-200">
                    {selectedIndustry.category}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {selectedIndustry.badge}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-slate-900">
                  {selectedIndustry.name} {t('industries.workflow_suffix', 'Compliance Workflow')}
                </h3>

                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  {selectedIndustry.description}
                </p>

                {/* Key Required Permits */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    {t('industries.req_permits', 'Essential Approvals & Licenses')}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedIndustry.permits.map((permit, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{permit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Side Stats & Action */}
              <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-brand-primary-50/30 rounded-2xl p-6 border border-slate-200/70 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {t('industries.key_auth', 'Regulatory Authorities')}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedIndustry.keyAuthorities.map((auth, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        {auth}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-200/60">
                    <div className="text-xs text-slate-500">{t('industries.turnaround', 'Estimated Clearance Velocity')}</div>
                    <div className="text-base font-bold text-brand-primary-900 mt-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {selectedIndustry.turnaroundEstimate}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Link
                    to="/register"
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-brand-primary-700 text-white text-sm font-semibold shadow-md transition-colors"
                  >
                    <span>{t('industries.start_project', 'Generate Industry Roadmap')}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>

              </div>

            </div>
          </div>
        </div>

        {/* Handwritten visual footer note */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 font-handwriting text-xl sm:text-2xl font-bold text-indigo-900">
            <span>{t('industries.bharat_tag', 'A Compliant and Prosperous India')}</span>
            <svg className="w-6 h-6 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
        </div>

      </div>
    </section>
  );
};
