import { Mic, Sparkles, Volume2, Loader2, Square } from 'lucide-react';
import type { VoiceState } from './voiceTypes';

interface ApproveMicButtonProps {
  state: VoiceState;
  onClick: () => void;
  floating?: boolean;
  className?: string;
  isSupported?: boolean;
}

export function ApproveMicButton({
  state,
  onClick,
  floating = false,
  className = '',
  isSupported = true,
}: ApproveMicButtonProps): JSX.Element {
  if (floating) {
    return (
      <div className={`fixed bottom-6 right-6 z-40 flex items-center gap-3 ${className}`}>
        {state !== 'idle' && (
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-xs font-medium shadow-lg border border-amber-500/30 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono uppercase tracking-wider text-[11px]">
              {state === 'listening' ? 'Listening…' : state === 'processing' ? 'Thinking…' : 'Speaking…'}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onClick}
          aria-label={state !== 'idle' ? 'Stop Voice Assistant' : 'Start Voice Assistant (Approve)'}
          title={state !== 'idle' ? 'Stop Voice Assistant' : 'Talk to Approve (Voice Assistant)'}
          className={`relative group flex items-center justify-center rounded-2xl p-4 shadow-xl transition-all duration-300 transform active:scale-95 ${
            state === 'idle'
              ? 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/30 hover:shadow-amber-500/50 hover:-translate-y-0.5'
              : state === 'listening'
              ? 'bg-blue-600 text-white shadow-blue-500/40 ring-4 ring-blue-400/30'
              : state === 'processing'
              ? 'bg-amber-600 text-white shadow-amber-500/40 ring-4 ring-amber-400/30'
              : 'bg-emerald-600 text-white shadow-emerald-500/40 ring-4 ring-emerald-400/30'
          }`}
        >
          {/* Pulsing Concentric Rings while active */}
          {state === 'listening' && (
            <>
              <span className="absolute -inset-2 rounded-2xl bg-blue-500/30 animate-ping" />
              <span className="absolute -inset-1 rounded-2xl bg-blue-400/40 animate-pulse" />
            </>
          )}

          {state === 'speaking' && (
            <span className="absolute -inset-2 rounded-2xl bg-emerald-500/30 animate-pulse" />
          )}

          {/* Icon state */}
          <div className="relative z-10 flex items-center justify-center">
            {state === 'idle' ? (
              <div className="flex items-center gap-1.5">
                <Mic className="w-5 h-5 text-slate-950" />
                <Sparkles className="w-3.5 h-3.5 text-amber-900 animate-pulse" />
              </div>
            ) : state === 'listening' ? (
              <Mic className="w-5 h-5 text-white animate-bounce" />
            ) : state === 'processing' ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <div className="flex items-center gap-0.5 h-5 px-0.5">
                <span className="w-1 bg-white rounded-full animate-[bounce_0.6s_infinite_100ms] h-3" />
                <span className="w-1 bg-white rounded-full animate-[bounce_0.6s_infinite_200ms] h-5" />
                <span className="w-1 bg-white rounded-full animate-[bounce_0.6s_infinite_300ms] h-4" />
                <span className="w-1 bg-white rounded-full animate-[bounce_0.6s_infinite_150ms] h-2" />
              </div>
            )}
          </div>
        </button>
      </div>
    );
  }

  // Inline Header / Dashboard Bar Button
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tactile-btn relative group inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 shadow-sm ${
        state === 'idle'
          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 shadow-amber-500/20'
          : state === 'listening'
          ? 'bg-blue-600 text-white border border-blue-700 animate-pulse shadow-blue-500/30'
          : state === 'processing'
          ? 'bg-amber-600 text-white border border-amber-700'
          : 'bg-emerald-600 text-white border border-emerald-700'
      } ${className}`}
      title={isSupported ? 'Talk to Approve' : 'Voice Assistant (Text input supported)'}
    >
      {state === 'idle' ? (
        <>
          <div className="w-5 h-5 rounded-md bg-amber-600/20 text-slate-950 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 text-slate-950" />
          </div>
          <span className="tracking-tight">My Voice Assistant</span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-600/30 text-slate-950 uppercase font-black">
            Approve
          </span>
        </>
      ) : state === 'listening' ? (
        <>
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>Listening…</span>
          <Square className="w-3 h-3 text-white/70 fill-current ml-1" />
        </>
      ) : state === 'processing' ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Thinking…</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5 animate-bounce" />
          <span>Speaking…</span>
          <Square className="w-3 h-3 text-white/70 fill-current ml-1" />
        </>
      )}
    </button>
  );
}
