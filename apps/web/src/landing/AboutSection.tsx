import React from 'react';
import { Link } from 'react-router-dom';

const PILLARS = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: 'Statutory Clarity for Indian Enterprises',
    desc: 'Navigating India’s multi-tiered regulatory framework across central ministries, state pollution boards, municipal councils, and safety inspectorates requires deep clarity. We transform fragmented acts into structured, actionable graphs.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: '70% Faster Turnaround Velocity',
    desc: 'By pre-auditing affidavits, validating site metrics, and generating error-free dossier packs prior to submission, ApprovalIQ eliminates bureaucratic back-and-forth and avoidable delays.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Enterprise-Grade Security & Integrity',
    desc: 'All company data, financial declarations, and proprietary industrial plans are secured with AES-256 encryption at rest and in transit, with full audit trail logging and ISO-grade compliance.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Built with Pride for Bharat',
    desc: 'We are committed to empowering Indian founders, MSMEs, and heavy industrial conglomerates to establish compliant, safe, and innovative manufacturing hubs across all 28 states and 8 union territories.',
  },
];

const LEADERSHIP = [
  {
    name: 'Aarav Sharma',
    role: 'Founder & Chief Executive Officer',
    bio: 'Former regulatory advisor with 14+ years advising industrial setups across Karnataka, Gujarat, and Maharashtra.',
    avatarBg: 'bg-gradient-to-tr from-blue-600 to-indigo-600',
  },
  {
    name: 'Dr. Priya Nambiar',
    role: 'Head of Regulatory Policy',
    bio: 'Ph.D. in Environmental Law; specialized in SPCB Consent to Establish (CTE) frameworks and MoEFCC clearances.',
    avatarBg: 'bg-gradient-to-tr from-purple-600 to-pink-600',
  },
  {
    name: 'Rohan Mehra',
    role: 'VP of AI Architecture',
    bio: 'Pioneered document OCR parsing and semantic rule graph engines for enterprise compliance infrastructure.',
    avatarBg: 'bg-gradient-to-tr from-emerald-600 to-teal-600',
  },
  {
    name: 'Sneha Kulkarni',
    role: 'Director of Customer Success',
    bio: 'Led operations for 500+ industrial permit filings across pharma, food processing, and chemical sectors.',
    avatarBg: 'bg-gradient-to-tr from-amber-600 to-orange-600',
  },
];

export const AboutSection: React.FC = () => {
  return (
    <section id="about" className="py-20 lg:py-28 bg-white relative overflow-hidden border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 shadow-xs mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-semibold text-blue-900 tracking-wide">
              About ApprovalIQ
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Catalyzing India's Industrial Growth Through{' '}
            <span className="text-gradient-primary">Intelligent Compliance.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            ApprovalIQ builds the intelligence layer for statutory permissions in India, replacing bureaucratic friction with AI-assisted clarity.
          </p>
        </div>

        {/* Mission Card & Numbers */}
        <div className="bg-[#0b1329] rounded-3xl p-8 sm:p-12 text-white shadow-2xl border border-indigo-900/40 relative overflow-hidden mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">
                OUR MISSION
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold leading-snug">
                "Empower every entrepreneur in Bharat to navigate regulatory requirements with total certainty."
              </h3>
              <p className="mt-4 text-slate-300 text-sm leading-relaxed">
                ApprovalIQ synthesizes central, state, and district rules into a unified, step-by-step roadmap so you can build with speed and safety.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-center">
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
                <div className="text-2xl sm:text-3xl font-black text-white">10,000+</div>
                <div className="text-xs text-slate-400 mt-1 font-sans">Statutes Mapped</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
                <div className="text-2xl sm:text-3xl font-black text-emerald-400">28 States</div>
                <div className="text-xs text-slate-400 mt-1 font-sans">& 8 UTs</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
                <div className="text-2xl sm:text-3xl font-black text-blue-400">70%</div>
                <div className="text-xs text-slate-400 mt-1 font-sans">Faster Clearance</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
                <div className="text-2xl sm:text-3xl font-black text-indigo-400">100%</div>
                <div className="text-xs text-slate-400 mt-1 font-sans">Single Window</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {PILLARS.map((pillar, idx) => (
            <div
              key={idx}
              className="bg-slate-50/70 rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 hover:bg-white"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-5">
                {pillar.icon}
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">{pillar.title}</h4>
              <p className="text-slate-600 text-sm leading-relaxed">{pillar.desc}</p>
            </div>
          ))}
        </div>

        {/* Leadership Team Grid */}
        <div>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h3 className="text-2xl font-bold text-slate-900">
              Backed by Regulatory Experts & Engineers
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              A multidisciplinary team passionate about accelerating ease of doing business in India.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {LEADERSHIP.map((member, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 border border-slate-200 text-center flex flex-col items-center shadow-xs hover:shadow-md transition-all"
              >
                <div
                  className={`w-14 h-14 rounded-2xl ${member.avatarBg} text-white font-bold text-lg flex items-center justify-center shadow-sm mb-3`}
                >
                  {member.name.charAt(0)}
                </div>
                <h5 className="text-sm font-bold text-slate-900">{member.name}</h5>
                <div className="text-xs font-medium text-blue-600 mt-0.5">{member.role}</div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <span>Learn more about our company & milestones</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
};
