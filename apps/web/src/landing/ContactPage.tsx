import React, { useState } from 'react';
import { Check, MapPin, Building2, Phone, Mail } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ScrollProgressBar } from './ScrollProgressBar';

const FAQS = [
  {
    q: 'How fast can ApprovalIQ map regulations for my specific project?',
    a: 'Once you provide basic project parameters (industry category, state, proposed scale, and location), our AI regulatory graph generates your preliminary compliance dossier and required permits list in under 60 seconds.',
  },
  {
    q: 'Do you support single-window central and state clearances?',
    a: 'Yes. ApprovalIQ is designed to map and integrate directly with state single window systems (e.g. Karnataka eBiz/DPIIT, Gujarat IFP, Maharashtra MAITRI) and central portals (MoEFCC PARIVESH, FSSAI FoSCoS, CDSCO SUGAM, and ICEGATE).',
  },
  {
    q: 'Can our regulatory consulting team or CA/CS firm use ApprovalIQ for clients?',
    a: 'Absolutely. We offer dedicated multi-client workspaces for compliance firms, chartered accountants, and environmental consultants to manage bulk filings with centralized tracking.',
  },
  {
    q: 'What level of data security and confidentiality is provided?',
    a: 'All project data, financial records, and site plans are protected with AES-256 encryption at rest and TLS 1.3 in transit. Our infrastructure is ISO 27001 and SOC2 aligned with immutable audit trails.',
  },
];

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    industry: 'Brewery & Distilleries',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      <ScrollProgressBar />
      <Navbar />

      <main className="flex-1 pt-28 pb-20">
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 shadow-xs mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-semibold text-blue-900 tracking-wide">
              Contact & Advisory Support
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Let's Discuss Your <span className="text-gradient-primary">Regulatory Strategy.</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Have questions about statutory permits, state-specific requirements, or enterprise pilots? Our compliance architects are ready to assist.
          </p>
        </section>

        {/* Contact Grid: Form + Office Locations */}
        <section className="mt-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Left Column: Interactive Contact Form (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl shadow-slate-200/40">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Send Us an Inquiry</h2>
              <p className="text-sm text-slate-500 mb-8">
                Fill in your project details and we will schedule an introductory compliance walkthrough.
              </p>

              {submitted ? (
                <div className="p-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4 animate-fade-in">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Check className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-900">Inquiry Received Successfully!</h3>
                  <p className="text-sm text-emerald-700 max-w-md mx-auto leading-relaxed">
                    Thank you, <span className="font-semibold">{formData.name}</span>. An ApprovalIQ regulatory solutions advisor will reach out to <span className="font-semibold">{formData.email}</span> within 4 business hours.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: '', email: '', phone: '', company: '', industry: 'Brewery & Distilleries', message: '' });
                    }}
                    className="mt-4 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Vikram Singhania"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Work Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="vikram@enterprise.in"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Company / Organization
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="e.g. Singhania Bio-Foods Ltd."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Target Industry Sector
                    </label>
                    <select
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
                    >
                      <option value="Brewery & Distilleries">Brewery & Distilleries</option>
                      <option value="Food Processing">Food Processing & FMCG</option>
                      <option value="Chemical Manufacturing">Chemical & Hazardous Materials</option>
                      <option value="Pharmaceuticals & Biotech">Pharmaceuticals & Life Sciences</option>
                      <option value="Logistics & Warehousing">Logistics, Cold Storage & Warehousing</option>
                      <option value="Clean Energy & Solar">Renewable Energy & Solar Parks</option>
                      <option value="Imports & Trading">Imports, Exports & Customs (ICEGATE)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Project Overview / Query *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us about your project location, proposed capacity, or any specific compliance queries..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all hover:scale-[1.01]"
                  >
                    Submit Advisory Request →
                  </button>
                </form>
              )}
            </div>

            {/* Right Column: Corporate Info & Direct Contacts (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Office Details Card */}
              <div className="bg-[#0b1329] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/40 space-y-6">
                <h3 className="text-xl font-bold text-white">ApprovalIQ Offices</h3>

                <div className="space-y-4 text-xs sm:text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-900/60 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Technology Headquarters</div>
                      <div className="text-slate-300 mt-0.5">
                        ApprovalIQ Technologies Pvt. Ltd.
                        <br />
                        Outer Ring Road, Tech Corridor
                        <br />
                        Bengaluru, Karnataka 560103, India
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-900/60 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Western Regional Hub</div>
                      <div className="text-slate-300 mt-0.5">
                        Bandra Kurla Complex (BKC)
                        <br />
                        Mumbai, Maharashtra 400051, India
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-3 border-t border-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-emerald-900/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Phone className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Direct Advisory Helplines</div>
                      <div className="text-slate-300 mt-0.5">
                        Toll-Free: <span className="font-mono text-emerald-400">1800-200-APPR</span>
                        <br />
                        Direct: <span className="font-mono">+91 (080) 4129-8800</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-900/60 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Mail className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Electronic Mail</div>
                      <div className="text-slate-300 mt-0.5">
                        General: <span className="text-blue-400">contact@approvaliq.in</span>
                        <br />
                        Enterprise Pilots: <span className="text-blue-400">enterprise@approvaliq.in</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Support Availability</span>
                  <span className="text-emerald-400 font-semibold">Mon–Sat • 9 AM–7 PM IST</span>
                </div>
              </div>

              {/* Quick Advisory Guarantee */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  NDA & Confidentiality Assurance
                </div>
                <p>
                  All project blueprints, feasibility summaries, and statutory discussions are conducted under strict mutual non-disclosure agreements.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* FAQs Accordion Section */}
        <section className="mt-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
              FREQUENTLY ASKED QUESTIONS
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Common Questions About ApprovalIQ
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full text-left p-5 flex items-center justify-between font-semibold text-slate-900 text-sm sm:text-base hover:bg-slate-50/80 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};
