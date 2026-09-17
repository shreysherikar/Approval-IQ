import React from 'react';
import { Link } from 'react-router-dom';
import { Globe2, Compass } from 'lucide-react';
import { useLanguage } from '../i18n';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-ocean-950 text-ocean-100 text-xs border-t border-ocean-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-ocean-400 to-ocean-600 flex items-center justify-center text-white font-bold text-xs shadow-glow-cyan/20">
                ▲
              </div>
              <span className="font-editorial text-xl font-bold text-white tracking-tight">
                Approval<span className="text-ocean-400">IQ</span>
              </span>
            </div>
            <p className="text-ocean-200/80 text-xs leading-relaxed max-w-sm font-sans">
              {t('footer.tagline', 'Deterministic regulatory roadmap and statutory compliance intelligence for industrial facilities, MSMEs, and startups across Indian states.')}
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-ocean-900/80 border border-ocean-800 text-ocean-200 font-mono text-[10px]">
              <Globe2 className="w-3.5 h-3.5 text-ocean-400" />
              <span>National Single Window &amp; Right to Services Aligned</span>
            </div>
          </div>

          {/* Platform Links */}
          <div className="space-y-3">
            <h4 className="text-white font-mono font-bold text-[11px] uppercase tracking-wider">
              {t('footer.product_title', 'Platform')}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/business-map" className="hover:text-white text-ocean-300 font-semibold inline-flex items-center gap-1.5 transition-colors">
                  <Compass className="w-3.5 h-3.5 text-ocean-400" />
                  <span>{t('nav.business_map', 'GIS Cluster Map')}</span>
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="text-ocean-200/70 hover:text-white transition-colors">
                  {t('workflow.step2_title', 'DAG Gating Engine')}
                </a>
              </li>
              <li>
                <a href="#industries" className="text-ocean-200/70 hover:text-white transition-colors">
                  {t('industries.title', 'Sector Packages')}
                </a>
              </li>
              <li>
                <Link to="/integrations" className="text-ocean-200/70 hover:text-white transition-colors">
                  {t('nav.integrations', 'DigiLocker & NSWS Hub')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Industries */}
          <div className="space-y-3">
            <h4 className="text-white font-mono font-bold text-[11px] uppercase tracking-wider">
              {t('footer.industries_title', 'Sectors')}
            </h4>
            <ul className="space-y-2 text-xs text-ocean-200/70">
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
                  {t('industries.chemicals', 'Chemicals & Materials')}
                </a>
              </li>
              <li>
                <a href="#industries" className="hover:text-white transition-colors">
                  {t('industries.imports', 'Cross-Border Imports')}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Standards */}
          <div className="space-y-3">
            <h4 className="text-white font-mono font-bold text-[11px] uppercase tracking-wider">
              {t('footer.legal_title', 'Regulatory Governance')}
            </h4>
            <ul className="space-y-2 text-xs text-ocean-200/70">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  {t('nav.about', 'About ApprovalIQ')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  {t('nav.contact', 'Support & Help Desk')}
                </Link>
              </li>
              <li>
                <span className="font-mono text-[10px] text-ocean-400 block pt-1">
                  ISO 27001 / DPDP Act Compliant
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="mt-10 pt-6 border-t border-ocean-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-ocean-400">
          <div>
            © {new Date().getFullYear()} ApprovalIQ. All statutory rule citations verified against official gazettes.
          </div>
          <div className="flex items-center gap-4 text-ocean-300">
            <span>Deterministic Compliance Intelligence</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
