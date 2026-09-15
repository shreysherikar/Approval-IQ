import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, MapPin, Building2, Phone, Mail } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    industry: 'Brewery & Distilleries',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-20 lg:py-28 bg-slate-50 relative overflow-hidden border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 shadow-xs mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-semibold text-blue-900 tracking-wide">
              Contact & Advisory Desk
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Let's Discuss Your <span className="text-gradient-primary">Regulatory Strategy.</span>
          </h2>
          <p className="mt-3 text-base text-slate-600 max-w-xl mx-auto">
            Have questions about statutory permissions, state-specific requirements, or enterprise pilots? Our compliance architects are ready to assist.
          </p>
        </div>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Form (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl shadow-slate-200/40">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Send Us an Inquiry</h3>
            <p className="text-xs text-slate-500 mb-6">
              Schedule a personalized compliance walkthrough for your manufacturing or industrial project.
            </p>

            {submitted ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3 animate-fade-in">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="text-lg font-bold text-emerald-900">Inquiry Received Successfully!</h4>
                <p className="text-xs text-emerald-700 max-w-md mx-auto leading-relaxed">
                  Thank you, <span className="font-semibold">{formData.name}</span>. An ApprovalIQ regulatory solutions advisor will reach out to <span className="font-semibold">{formData.email}</span> within 4 business hours.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: '', email: '', phone: '', company: '', industry: 'Brewery & Distilleries', message: '' });
                  }}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Vikram Singhania"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="vikram@enterprise.in"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Singhania Bio-Foods Ltd."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Industry Sector
                  </label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Project Overview / Query *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about your project location, proposed capacity, or any specific compliance queries..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all hover:scale-[1.01]"
                >
                  Submit Advisory Request →
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Office Directory & Details (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#0b1329] text-white rounded-3xl p-6 shadow-xl border border-indigo-900/40 space-y-4">
              <h4 className="text-base font-bold text-white">Direct Advisory Support</h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Bengaluru Headquarters</div>
                    <div className="text-slate-300">Outer Ring Road, Tech Corridor, Bengaluru 560103</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Mumbai Regional Hub</div>
                    <div className="text-slate-300">Bandra Kurla Complex (BKC), Mumbai 400051</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-slate-800">
                  <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Helplines</div>
                    <div className="text-slate-300">Toll Free: 1800-200-APPR • Direct: +91 (080) 4129-8800</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Direct Email</div>
                    <div className="text-slate-300">contact@approvaliq.in • enterprise@approvaliq.in</div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Working Hours</span>
                <span className="text-emerald-400 font-semibold">Mon–Sat • 9 AM–7 PM IST</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span>Looking for detailed FAQs & office maps?</span>
              <Link to="/contact" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
                View full Contact Hub →
              </Link>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
