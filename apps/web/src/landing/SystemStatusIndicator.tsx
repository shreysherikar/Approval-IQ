import React, { useState } from 'react';

export const SystemStatusIndicator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const services = [
    { name: 'Authentication & OAuth', status: 'Operational', latency: '18ms' },
    { name: 'AI Document Extraction', status: 'Operational', latency: '240ms' },
    { name: 'Regulatory Graph (10k+ Norms)', status: 'Synchronized', latency: '42ms' },
    { name: 'Single Window Gateway', status: 'Active', latency: '65ms' },
    { name: 'Immutable Audit Logging', status: 'Operational', latency: '12ms' },
  ];

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Pill Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 shadow-sm text-white text-xs font-medium backdrop-blur-md transition-all duration-200 group cursor-pointer"
        aria-label="System status overview"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-slate-200 group-hover:text-white font-semibold">
          System Online
        </span>
        <span className="text-slate-500 group-hover:text-slate-400">99.98%</span>
        <svg
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Floating Status Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#0b1329]/95 backdrop-blur-xl border border-slate-700/80 p-4 shadow-2xl z-50 animate-fade-in text-left">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                All Systems Operational
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Live Health</span>
          </div>

          <div className="space-y-2">
            {services.map((srv, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-900/70 border border-slate-800/80 text-xs"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-200 font-medium">{srv.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">{srv.latency}</span>
                  <span className="text-[10px] font-semibold text-emerald-400">{srv.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Verified compliant infrastructure</span>
            <span className="text-blue-400 font-mono">ISO 27001 • SOC2</span>
          </div>
        </div>
      )}
    </div>
  );
};
