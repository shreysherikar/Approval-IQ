import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDemo: () => void;
}

interface SearchItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onOpenDemo,
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open triggered by parent state or custom event
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const items: SearchItem[] = [
    {
      id: 'fssai',
      category: 'Statutory Permits',
      title: 'FSSAI Central & State Manufacturer License',
      subtitle: 'Food Safety and Standards Authority of India',
      action: () => {
        onClose();
        void navigate('/register');
      },
    },
    {
      id: 'spcb-cte',
      category: 'Environmental Clearance',
      title: 'SPCB Consent to Establish (CTE) / Consent to Operate (CTO)',
      subtitle: 'Red, Orange, and Green industrial classifications',
      action: () => {
        onClose();
        void navigate('/register');
      },
    },
    {
      id: 'peso',
      category: 'Hazardous Materials',
      title: 'PESO Petroleum & Explosives Safety Approvals',
      subtitle: 'Storage tanks, gas cylinders & boiler permissions',
      action: () => {
        onClose();
        void navigate('/register');
      },
    },
    {
      id: 'demo',
      category: 'Product Walkthrough',
      title: 'Launch Interactive Engine Simulation',
      subtitle: 'Simulate compliance graph and rule evaluation',
      action: () => {
        onClose();
        onOpenDemo();
      },
    },
    {
      id: 'signin',
      category: 'Authentication',
      title: 'Sign In to ApprovalIQ Workspace',
      subtitle: 'Continue with Google OAuth or Email',
      action: () => {
        onClose();
        void navigate('/login');
      },
    },
    {
      id: 'signup',
      category: 'Get Started',
      title: 'Create an Account & Free Assessment',
      subtitle: 'Start mapping your industry approvals today',
      action: () => {
        onClose();
        void navigate('/register');
      },
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette Dialog */}
      <div className="relative bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden z-10 text-white">
        
        {/* Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search regulations, clearances, industries or actions..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="p-2 max-h-80 overflow-y-auto space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching regulations or actions found for "{query}".
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-800/80 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors mt-0.5">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-400">{item.subtitle}</div>
                </div>
                <svg className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Tip: Navigate quickly across statutory norms</span>
          <div className="flex items-center gap-1.5">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">↵</kbd>
            <span>to select</span>
          </div>
        </div>

      </div>
    </div>
  );
};
