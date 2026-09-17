import React, { useState, useEffect } from 'react';
import { Check, Activity } from 'lucide-react';
import { useLanguage } from '../i18n';

interface AuditEvent {
  id: string;
  time: string;
  action: string;
  entity: string;
  status: 'info' | 'success' | 'warning';
}

const SAMPLE_EVENTS: AuditEvent[] = [
  { id: '1', time: '12:41:02', action: 'Project Registered', entity: 'Bangalore Microbrewery Unit-2', status: 'info' },
  { id: '2', time: '12:42:15', action: 'Document OCR Extracted', entity: 'Form-IV CTE Clearance Application', status: 'info' },
  { id: '3', time: '12:43:40', action: 'Norms Verified', entity: 'Water Act 1974 & Air Act 1981', status: 'success' },
  { id: '4', time: '12:45:10', action: 'NOC Issued', entity: 'State Fire & Emergency Services', status: 'success' },
  { id: '5', time: '12:46:25', action: 'Single-Window Submission', entity: 'Karnataka State PCB Gateway', status: 'info' },
  { id: '6', time: '12:47:50', action: 'Statutory Approval Granted', entity: 'Consent to Establish (CTE) #KA-2026-90', status: 'success' },
];

export const LiveAuditStream: React.FC = () => {
  const { t } = useLanguage();
  const [eventIndex, setEventIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setEventIndex((prev) => (prev + 1) % SAMPLE_EVENTS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const visibleEvents = [
    SAMPLE_EVENTS[eventIndex]!,
    SAMPLE_EVENTS[(eventIndex + 1) % SAMPLE_EVENTS.length]!,
    SAMPLE_EVENTS[(eventIndex + 2) % SAMPLE_EVENTS.length]!,
  ];

  return (
    <div className="bg-[#072633]/95 backdrop-blur-xl border border-ocean-500/40 rounded-2xl p-5 shadow-glow-cyan/15 text-left w-full max-w-md">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-ocean-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ocean-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ocean-500" />
          </span>
          <span className="text-xs font-bold text-ocean-100 tracking-wider uppercase font-mono">
            {t('audit.title', 'Live Compliance Feed')}
          </span>
        </div>
        <span className="text-[10px] text-ocean-300 font-mono bg-ocean-950/80 px-2 py-0.5 rounded border border-ocean-800">
          {t('audit.realtime', 'Real-time Stream')}
        </span>
      </div>

      <div className="space-y-2 font-mono text-xs">
        {visibleEvents.map((evt, idx) => (
          <div
            key={`${evt.id}-${eventIndex}-${idx}`}
            className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-500 ${
              idx === 0
                ? 'bg-ocean-900/90 border border-ocean-500/60 text-white shadow-glow-cyan/20 scale-[1.01]'
                : 'bg-ocean-950/50 border border-ocean-900/60 text-ocean-300/70'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[11px] text-ocean-400 shrink-0">{evt.time}</span>
              <span className="text-ocean-700">•</span>
              <span className="font-semibold text-ocean-100 truncate">{evt.action}</span>
            </div>
            <div className="shrink-0 ml-2">
              {evt.status === 'success' ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-forest-400 bg-forest-950/80 border border-forest-800/60 px-2 py-0.5 rounded-full font-bold">
                  <Check className="w-3 h-3 text-forest-400" />
                  <span>{t('audit.verified', 'Verified')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-ocean-300 bg-ocean-950/80 border border-ocean-700/60 px-2 py-0.5 rounded-full">
                  <Activity className="w-3 h-3 text-ocean-400" />
                  <span>{t('audit.processed', 'Processed')}</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
