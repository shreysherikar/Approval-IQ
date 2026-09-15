import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ScrollProgressBar } from './ScrollProgressBar';

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
    bio: 'Former regulatory advisor with 14+ years advising industrial manufacturing setups across Karnataka, Gujarat, and Maharashtra.',
    avatarBg: 'bg-gradient-to-tr from-blue-600 to-indigo-600',
  },
  {
    name: 'Dr. Priya Nambiar',
    role: 'Head of Regulatory Intelligence & Policy',
    bio: 'Ph.D. in Environmental Law; specialized in SPCB Consent to Establish (CTE) frameworks and National Green Tribunal guidelines.',
    avatarBg: 'bg-gradient-to-tr from-purple-600 to-pink-600',
  },
  {
    name: 'Rohan Mehra',
    role: 'VP of AI & Systems Architecture',
    bio: 'Pioneered document OCR parsing and semantic rule graph engines for enterprise fintech and compliance infrastructure.',
    avatarBg: 'bg-gradient-to-tr from-emerald-600 to-teal-600',
  },
  {
    name: 'Sneha Kulkarni',
    role: 'Director of Customer Success & Operations',
    bio: 'Led operations for 500+ industrial permit filings across pharma, food processing, and chemical sectors.',
    avatarBg: 'bg-gradient-to-tr from-amber-600 to-orange-600',
  },
];

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      <ScrollProgressBar />
      <Navbar />

      <main className="flex-1 pt-28 pb-20">
        {/* Hero Section */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 shadow-xs mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-semibold text-blue-900 tracking-wide">
              About ApprovalIQ
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
            Catalyzing India's Industrial Growth Through{' '}
            <span className="text-gradient-primary">Intelligent Compliance.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            ApprovalIQ is building the intelligence layer for statutory permissions in India. We replace bureaucratic friction with AI-assisted clarity, enabling founders and operators to launch faster and remain compliant.
          </p>
        </section>

        {/* Mission & Vision Showcase */}
        <section className="mt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#0b1329] rounded-3xl p-8 sm:p-14 text-white shadow-2xl border border-indigo-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">
                  OUR MISSION
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
                  "Empower every entrepreneur in Bharat to navigate regulatory requirements with total certainty."
                </h2>
                <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed">
                  Setting up a pharmaceutical facility, distillery, chemical processing plant, or logistics hub shouldn't require months of deciphering opaque gazette notifications. ApprovalIQ synthesizes central, state, and district rules into a unified, step-by-step roadmap.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-center">
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
                  <div className="text-3xl sm:text-4xl font-black text-white">10,000+</div>
                  <div className="text-xs text-slate-400 mt-1 font-sans">Statutes Mapped</div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
                  <div className="text-3xl sm:text-4xl font-black text-emerald-400">28 States</div>
                  <div className="text-xs text-slate-400 mt-1 font-sans">& 8 Union Territories</div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
                  <div className="text-3xl sm:text-4xl font-black text-blue-400">70%</div>
                  <div className="text-xs text-slate-400 mt-1 font-sans">Faster Clearance</div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
                  <div className="text-3xl sm:text-4xl font-black text-indigo-400">100%</div>
                  <div className="text-xs text-slate-400 mt-1 font-sans">Single Window Aligned</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 Core Pillars */}
        <section className="mt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
              WHY APPROVALIQ
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              The Four Pillars of Our Regulatory Platform
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {PILLARS.map((pillar, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-8 border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {pillar.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{pillar.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Leadership Team Section */}
        <section className="mt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
              OUR TEAM
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Backed by Regulatory Experts & Engineers
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              A multidisciplinary team passionate about accelerating ease of doing business in India.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {LEADERSHIP.map((member, idx) => (
              <div
                key={idx}
                className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center flex flex-col items-center hover:bg-white hover:shadow-lg transition-all"
              >
                <div
                  className={`w-16 h-16 rounded-2xl ${member.avatarBg} text-white font-bold text-xl flex items-center justify-center shadow-md mb-4`}
                >
                  {member.name.charAt(0)}
                </div>
                <h4 className="text-base font-bold text-slate-900">{member.name}</h4>
                <div className="text-xs font-semibold text-blue-600 mt-0.5">{member.role}</div>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-8 sm:p-12 text-white text-center shadow-2xl flex flex-col items-center justify-center">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight max-w-2xl">
              Ready to streamline your regulatory journey?
            </h3>
            <p className="mt-3 text-blue-100 text-sm sm:text-base max-w-xl">
              Join thousands of Indian enterprises building a compliant future with ApprovalIQ.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Link
                to="/register"
                className="px-6 py-3 rounded-xl bg-white text-blue-900 font-bold text-sm shadow-md hover:bg-slate-100 transition-colors"
              >
                Get Started Free →
              </Link>
              <Link
                to="/contact"
                className="px-6 py-3 rounded-xl bg-blue-800/80 hover:bg-blue-800 text-white font-bold text-sm border border-blue-400/40 transition-colors"
              >
                Contact Our Team
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};
