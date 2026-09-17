import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n';

interface MetricItem {
  id: string;
  targetNumber: number;
  prefix?: string;
  suffix: string;
  labelKey: string;
  defaultLabel: string;
  sublabelKey: string;
  defaultSublabel: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const METRICS: MetricItem[] = [
  {
    id: 'businesses',
    targetNumber: 1284,
    prefix: '',
    suffix: '+',
    labelKey: 'metrics.businesses',
    defaultLabel: 'Businesses Supported',
    sublabelKey: 'metrics.businesses_sub',
    defaultSublabel: 'Across Indian States & UTs',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: 'regulations',
    targetNumber: 10450,
    prefix: '',
    suffix: '+',
    labelKey: 'metrics.regulations',
    defaultLabel: 'Regulations Mapped',
    sublabelKey: 'metrics.regulations_sub',
    defaultSublabel: 'Central, State & Municipal Rules',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    id: 'speed',
    targetNumber: 70,
    prefix: '',
    suffix: '%',
    labelKey: 'metrics.speed',
    defaultLabel: 'Faster Approvals',
    sublabelKey: 'metrics.speed_sub',
    defaultSublabel: 'Reduced Filing & Review Friction',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    id: 'india',
    targetNumber: 100,
    prefix: '',
    suffix: '%',
    labelKey: 'metrics.india',
    defaultLabel: 'Built for a Compliant India',
    sublabelKey: 'metrics.india_sub',
    defaultSublabel: 'Aligned with National Single Window',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
];

const CounterDisplay: React.FC<{ target: number; prefix?: string | undefined; suffix: string }> = ({
  target,
  prefix = '',
  suffix,
}) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 1400;
          const steps = 40;
          const increment = target / steps;
          let current = 0;

          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);

          return () => clearInterval(timer);
        }
      },
      { threshold: 0.1 },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, hasAnimated]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
};

export const MetricsStrip: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="relative z-10 -mt-6 sm:-mt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-ocean-900/5 border border-ocean-200/80 p-6 sm:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-ocean-100">
          {METRICS.map((metric) => (
            <div
              key={metric.id}
              className="flex items-center gap-4 pt-4 sm:pt-0 sm:pl-6 first:pl-0 first:pt-0 group transition-all"
            >
              <div
                className={`w-12 h-12 rounded-2xl bg-ocean-50 text-ocean-700 border border-ocean-200/60 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 group-hover:bg-ocean-100 group-hover:shadow-glow-cyan transition-all duration-300`}
              >
                {metric.icon}
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-editorial">
                  <CounterDisplay
                    target={metric.targetNumber}
                    prefix={metric.prefix}
                    suffix={metric.suffix}
                  />
                </div>
                <div className="text-xs sm:text-sm font-semibold text-ink-soft">
                  {t(metric.labelKey, metric.defaultLabel)}
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5 font-normal hidden sm:block">
                  {t(metric.sublabelKey, metric.defaultSublabel)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
