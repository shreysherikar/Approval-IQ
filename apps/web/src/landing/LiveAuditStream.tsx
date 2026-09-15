import React, { useState, useEffect } from 'react';
import { Check, Activity } from 'lucide-react';

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
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-xl text-left w-full max-w-md">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-xs font-bold text-slate-200 tracking-wider uppercase font-mono">
            Live Compliance Feed
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Real-time Stream</span>
      </div>

      <div className="space-y-2 font-mono text-xs">
        {visibleEvents.map((evt, idx) => (
          <div
            key={`${evt.id}-${eventIndex}-${idx}`}
            className={`flex items-center justify-between p-2 rounded-lg transition-all duration-500 ${
              idx === 0
                ? 'bg-blue-950/60 border border-blue-800/80 text-white shadow-xs scale-[1.01]'
                : 'bg-slate-950/40 border border-slate-800/40 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[11px] text-slate-400 shrink-0">{evt.time}</span>
              <span className="text-slate-600">•</span>
              <span className="font-semibold text-slate-200 truncate">{evt.action}</span>
            </div>
            <div className="shrink-0 ml-2">
              {evt.status === 'success' ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Verified</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-950/80 border border-blue-800/60 px-1.5 py-0.5 rounded">
                  <Activity className="w-3 h-3 text-blue-400" />
                  <span>Processed</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
