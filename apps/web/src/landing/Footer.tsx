import React from 'react';
import { Link } from 'react-router-dom';
import { Globe2, Compass } from 'lucide-react';
import { useLanguage } from '../i18n';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-[#0b1329] text-slate-300 text-sm border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-400 flex items-center justify-center text-white font-black text-lg shadow-md">
                ▲
              </div>
              <span className="text-xl font-black text-white tracking-tight">
                Approval<span className="text-blue-400">IQ</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm">
              {t('footer.tagline', 'AI-powered regulatory intelligence and approvals platform engineered for Indian enterprises, MSMEs, and startups.')}
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-200 text-xs font-medium">
              <Globe2 className="w-3.5 h-3.5 text-slate-300" />
              <span>{t('footer.engineered', 'Engineered for Bharat')}</span>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">
              {t('footer.product_title', 'Product')}
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link to="/business-map" className="hover:text-white transition-colors text-cyan-400 font-semibold inline-flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('nav.business_map', 'Business Intelligence Map')}</span>
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  {t('workflow.step2_title', 'AI Regulatory Engine')}
                </a>
              </li>
              <li>
                <a href="#industries" className="hover:text-white transition-colors">
                  {t('industries.title', 'Industry Frameworks')}
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  {t('workflow.step3_title', 'Document Checklists')}
                </a>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  {t('nav.integrations', 'Single Window Integration')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Industries */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">
              {t('footer.industries_title', 'Industries')}
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <a href="#industries" className="hover:text-white transition-colors">
                  {t('industries.brewery', 'Brewery & Distilleries')}
                </a>
              </li>
              <li>
                <a href="#industries" className="hover:text-white transition-colors">
                  {t('industries.food', 'Food Processing & FMCG')}
                </a>
              </li>
              <li>
                <a href="#industries" className="hover:text-white transition-colors">
                  {t('industries.chemicals', 'Chemical Manufacturing')}
                </a>
              </li>
              <li>
                <a href="#industries" className="hover:text-white transition-colors">
                  {t('industries.pharma', 'Pharmaceuticals & Biotech')}
                </a>
              </li>
              <li>
                <a href="#industries" className="hover:text-white transition-colors">
                  {t('industries.logistics', 'Logistics & Warehousing')}
                </a>
              </li>
            </ul>
          </div>

          {/* Account / Legal */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">
              {t('footer.company_title', 'Company & Access')}
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  {t('nav.about', 'About Us')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  {t('nav.contact', 'Contact & Support')}
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  {t('nav.login', 'Sign In')}
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  {t('nav.register', 'Create Account')}
                </Link>
              </li>
              <li>
                <span className="text-slate-500">Security & Encryption (AES-256)</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} ApprovalIQ Technologies. {t('footer.rights', 'All rights reserved.')}
          </div>
          <div>
            {t('footer.disclaimer', 'Regulatory guidance platform for informational & clearance facilitation purposes.')}
          </div>
        </div>
      </div>
    </footer>
  );
};
