import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { aiSimulationApi } from '../api-client';

export const HeliverCapsuleLens: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'founder' | 'authority'>('founder');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic AI synthesis for the statutory lens
  const { data: lensAi, isFetching: isAiFetching } = useQuery({
    queryKey: ['ai-lens-analysis', activeMode],
    queryFn: () => aiSimulationApi.analyzeLens({ mode: activeMode }),
    staleTime: 60_000,
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 30;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 30;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <section className="py-20 lg:py-24 bg-transparent relative overflow-hidden border-b border-ocean-200/80">
      {/* Background Animated Floating Ambient Orbs responding to scroll */}
      <div
        className="absolute top-10 left-10 w-96 h-96 bg-ocean-300/25 rounded-full blur-3xl pointer-events-none -z-10 transition-transform duration-700 ease-out"
        style={{ transform: `translate(${mousePos.x * 0.5}px, ${scrollY * 0.08}px)` }}
      />
      <div
        className="absolute bottom-10 right-10 w-96 h-96 bg-ocean-400/20 rounded-full blur-3xl pointer-events-none -z-10 transition-transform duration-700 ease-out"
        style={{ transform: `translate(${mousePos.x * -0.5}px, ${-scrollY * 0.06}px)` }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2.5 mb-12">
          <span className="stamp-seal stamp-approved text-[10px] shadow-sm">
            <Sparkles className="w-3 h-3 text-forest-600 inline mr-1 animate-pulse" />
            <span>INTERACTIVE LENS EXPERIENCE</span>
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-bold text-ink tracking-tight">
            From Click to Statutory Clearance
          </h2>
          <p className="text-xs sm:text-sm text-ink-soft leading-relaxed font-sans">
            Slide through the interactive compliance lens to experience how statutory filings, dependency DAGs, and multi-agency consensus are unified.
          </p>
        </div>

        {/* Heliver-Style Interactive Frosted Glass Showcase Card */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative w-full max-w-4xl mx-auto h-[420px] sm:h-[480px] rounded-3xl overflow-hidden shadow-2xl border border-ocean-300/80 transition-all duration-300 select-none group"
          style={{
            background: activeMode === 'founder'
              ? 'linear-gradient(135deg, #06212B 0%, #0E4B5E 45%, #15808B 80%, #22D3EE 100%)'
              : 'linear-gradient(135deg, #0A2F3D 0%, #0E6B7A 40%, #B45309 85%, #F59E0B 100%)',
          }}
        >
          {/* Animated Glowing Color Spheres Behind Lens */}
          <div
            className="absolute w-72 h-72 rounded-full blur-2xl transition-all duration-700 ease-out pointer-events-none"
            style={{
              left: activeMode === 'founder' ? '15%' : '55%',
              top: '20%',
              background: activeMode === 'founder' ? 'radial-gradient(circle, #38ACCC 0%, transparent 70%)' : 'radial-gradient(circle, #F59E0B 0%, transparent 70%)',
              transform: `translate(${mousePos.x * 1.5}px, ${mousePos.y * 1.5}px)`,
            }}
          />
          <div
            className="absolute w-80 h-80 rounded-full blur-2xl transition-all duration-700 ease-out pointer-events-none"
            style={{
              right: activeMode === 'founder' ? '15%' : '55%',
              bottom: '15%',
              background: activeMode === 'founder' ? 'radial-gradient(circle, #10B981 0%, transparent 70%)' : 'radial-gradient(circle, #06B6D4 0%, transparent 70%)',
              transform: `translate(${mousePos.x * -1.2}px, ${mousePos.y * -1.2}px)`,
            }}
          />

          {/* Top Bar Header inside Showcase */}
          <div className="absolute top-6 left-6 right-6 z-30 flex items-center justify-between text-white/90 text-xs font-mono">
            <div>
              <span className="font-bold tracking-wider uppercase block text-[11px] text-white">ApprovalIQ / 2026</span>
              <span className="text-[10px] text-white/70">Deterministic Engine v2.4</span>
            </div>

            {/* Interactive Mode Toggle Switch */}
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-xl border border-white/20 px-3.5 py-1.5 rounded-full shadow-lg">
              <button
                type="button"
                className={`text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${activeMode === 'founder' ? 'text-cyan-300 font-extrabold' : 'text-white/60 hover:text-white'}`}
                onClick={() => setActiveMode('founder')}
              >
                Founder
              </button>
              <button
                type="button"
                onClick={() => setActiveMode(activeMode === 'founder' ? 'authority' : 'founder')}
                className="w-10 h-5 rounded-full bg-white/20 relative p-0.5 transition-colors cursor-pointer border border-white/30 flex items-center"
                aria-label="Toggle Lens Mode"
              >
                <div
                  className={`w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                    activeMode === 'authority' ? 'translate-x-5 bg-amber-400' : 'translate-x-0 bg-cyan-300'
                  }`}
                />
              </button>
              <button
                type="button"
                className={`text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${activeMode === 'authority' ? 'text-amber-300 font-extrabold' : 'text-white/60 hover:text-white'}`}
                onClick={() => setActiveMode('authority')}
              >
                Authority
              </button>
            </div>

            {/* Right Meta Tags */}
            <div className="hidden sm:flex flex-col text-right text-[10px] text-white/80 font-mono">
              <span>/ Statutory Intake</span>
              <span>/ DAG Routing Engine</span>
            </div>
          </div>

          {/* Centerpiece: Ultra-Frosted Interactive Glass Capsule */}
          <div
            className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[92%] sm:w-[560px] rounded-3xl border border-white/40 shadow-2xl backdrop-blur-2xl flex items-center justify-center p-5 sm:p-6 transition-transform duration-500 ease-out cursor-pointer group-hover:scale-[1.02]"
            style={{
              background: 'rgba(255, 255, 255, 0.16)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.4)',
              transform: `translate(calc(-50% + ${mousePos.x}px), calc(-50% + ${mousePos.y}px))`,
            }}
            onClick={() => setActiveMode(activeMode === 'founder' ? 'authority' : 'founder')}
          >
            {/* Luminous Inner Glass Content */}
            <div className="flex items-center gap-3.5 sm:gap-4 text-white w-full">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/25 backdrop-blur-xl border border-white/70 flex items-center justify-center text-white shadow-lg shrink-0">
                {isAiFetching ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : activeMode === 'founder' ? (
                  <Zap className="w-6 h-6 text-cyan-200 animate-pulse" />
                ) : (
                  <ShieldCheck className="w-6 h-6 text-amber-300 animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-md">
                    {activeMode === 'founder' ? 'ApprovalIQ' : 'Nodal Gateway'}
                  </h3>
                  {lensAi?.averageTimeReductionPercentage && (
                    <span className="text-[10px] font-mono font-bold bg-white/20 border border-white/40 px-2 py-0.5 rounded-full text-white">
                      -{lensAi.averageTimeReductionPercentage}% SLA
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-[13px] text-white/95 font-sans mt-1 drop-shadow-sm leading-relaxed line-clamp-2">
                  {lensAi?.diagnosis ||
                    (activeMode === 'founder'
                      ? 'Deterministic graph routing automates 42 clearances with pre-verified single-dossier reuse.'
                      : 'Autonomous multi-agency verification with concurrent inspection scheduling and audit trails.')}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Headline & High-Contrast Action Button */}
          <div className="absolute bottom-4 sm:bottom-6 left-5 sm:left-6 right-5 sm:right-6 z-30 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 text-white">
            <div className="max-w-md">
              <span className="font-editorial text-sm sm:text-lg font-bold tracking-tight block text-white drop-shadow-sm uppercase">
                {lensAi?.headline || (activeMode === 'founder' ? 'FROM CLICK TO CLEARANCE' : 'FROM FILING TO COMMISSIONING')}
              </span>
              <span className="text-[11px] text-white/85 font-sans block truncate mt-0.5">
                {lensAi?.keyEnablers?.[0] || '100% deterministic critical path routing across 7+ ministries.'}
              </span>
            </div>

            {/* High-Contrast Interactive CTA Button */}
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-white hover:bg-slate-100 border border-white shadow-lg transition-all transform hover:scale-105 shrink-0"
            >
              <span>Launch Clearance Desk</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
};
