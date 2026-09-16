import React from 'react';
import { Globe2, Check } from 'lucide-react';
import { useLanguage } from '../i18n';

export const FloatingApprovalCards: React.FC = () => {
  const { t } = useLanguage();

  return (
    <>
      {/* 1. Main Floating Workflow Status Glass Card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[90%] max-w-[340px] sm:max-w-[380px] transition-transform duration-500 hover:scale-[1.02]">
        <div className="relative glass-card rounded-2xl p-4 sm:p-5 shadow-2xl border border-white/60 bg-white/75 backdrop-blur-xl">
          {/* Card Header glow indicator */}
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-200/60">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-primary-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                {t('hero.card_engine', 'Live Regulatory Engine')}
              </span>
            </div>
            <span className="text-[11px] font-medium text-brand-primary-700 bg-brand-primary-50 border border-brand-primary-200/60 px-2 py-0.5 rounded-full">
              {t('hero.card_single_window', 'Single Window')}
            </span>
          </div>

          {/* Status List items */}
          <div className="space-y-2.5">
            {/* Step 1: Business Profile */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/80 border border-slate-100/90 shadow-sm transition-all hover:bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    {t('hero.card_profile', 'Business Profile')}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {t('hero.card_profile_sub', 'Industry, Location & Scale')}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t('hero.card_completed', 'Completed')}
              </span>
            </div>

            {/* Step 2: Applicable Norms */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/80 border border-slate-100/90 shadow-sm transition-all hover:bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    {t('hero.card_norms', 'Applicable Norms')}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {t('hero.card_norms_sub', 'Central & State Frameworks')}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50/90 border border-indigo-200/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {t('hero.card_identified', 'Identified')}
              </span>
            </div>

            {/* Step 3: Documents */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/80 border border-slate-100/90 shadow-sm transition-all hover:bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    {t('hero.card_docs', 'Documents & Filings')}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {t('hero.card_docs_sub', 'Pre-validated & Indexed')}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50/90 border border-blue-200/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {t('hero.card_verified', 'Verified')}
              </span>
            </div>

            {/* Step 4: Authority Review */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-amber-50/90 to-amber-100/40 border border-amber-200/80 shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-amber-950">
                    {t('hero.card_review', 'Authority Review')}
                  </div>
                  <div className="text-[10px] text-amber-700 font-medium">
                    {t('hero.card_review_sub', 'Single-Window Portal')}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                {t('hero.card_in_progress', 'In Progress')}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Handwritten Callout on the right/top of card */}
        <div className="hidden sm:block absolute -top-8 -right-28 transform rotate-3 pointer-events-none z-30">
          <div className="font-handwriting text-indigo-900 text-lg sm:text-xl font-bold tracking-wide drop-shadow-sm flex flex-col items-start">
            <span className="text-indigo-800">
              {t('hero.callout_idea', 'Your idea.')}
            </span>
            <span className="text-brand-primary-800 ml-2">
              {t('hero.callout_guidance', 'Our guidance.')}
            </span>
            <span className="text-indigo-950 ml-4">
              {t('hero.callout_progress', 'Real progress.')}
            </span>
            <svg className="w-16 h-8 text-indigo-600 -mt-1 ml-4" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10 5 Q 50 35, 85 15" />
              <path d="M75 10 L 85 15 L 80 25" />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Quote Card in Top-Right Area */}
      <div className="hidden lg:block absolute top-6 right-6 z-20 max-w-[260px] pointer-events-auto">
        <div className="bg-white/85 backdrop-blur-md rounded-xl p-3.5 border border-white/80 shadow-lg text-slate-800 transition-all hover:bg-white/95">
          <div className="text-brand-primary-600 text-2xl font-serif leading-none mb-1">“</div>
          <p className="text-xs font-medium text-slate-700 leading-snug">
            {t(
              'hero.quote_text',
              'A more transparent, efficient, and entrepreneur-friendly India.',
            )}
          </p>
          <div className="mt-2 text-[10px] font-semibold text-slate-500 flex items-center justify-between">
            <span>{t('hero.quote_author', '— ApprovalIQ Mission')}</span>
            <span className="text-emerald-600 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t('hero.quote_active', 'Active')}
            </span>
          </div>
        </div>
      </div>

      {/* 4. India Compliant Tomorrow Badge on Top/Side */}
      <div className="hidden xl:block absolute bottom-20 right-6 z-20 max-w-[210px] pointer-events-auto animate-float">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-white/90 shadow-xl text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-brand-primary-600 to-indigo-500 text-white flex items-center justify-center shadow-md mb-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="text-xs font-bold text-slate-900 leading-tight">
            {t('hero.tomorrow_title', 'Building a Compliant Tomorrow')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-center gap-1.5">
            <span>{t('hero.tomorrow_sub', 'Stronger & Safer')}</span>
            <Globe2 className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 font-handwriting text-xs text-indigo-700 font-semibold">
            {t('hero.tomorrow_badge', 'Bharat Builds Better Together')}
          </div>
        </div>
      </div>

      {/* 5. Animated AI Processing Micro Card (Top-Left overlay) */}
      <div className="hidden md:block absolute top-6 left-6 z-20 pointer-events-auto animate-float-slow">
        <div className="bg-slate-950/90 backdrop-blur-md rounded-xl p-3 border border-slate-700/80 shadow-xl text-white font-mono text-xs max-w-[230px]">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5 text-blue-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              {t('hero.ai_processing', 'AI PROCESSING')}
            </span>
            <span className="text-emerald-400">{t('hero.ai_match', '96% match')}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1.5">
            <div className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full w-[96%] animate-pulse" />
          </div>
          <div className="text-[10px] text-slate-300 flex items-center justify-between">
            <span>{t('hero.ai_statutory', 'Statutory extraction')}</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>{t('hero.ai_verified', 'Verified')}</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
