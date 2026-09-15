import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { IndiaVectorMap, MapStateData } from './IndiaVectorMap';

const INITIAL_STATES: MapStateData[] = [
  { stateCode: 'MH', stateName: 'Maharashtra', count: 1284, percentage: 21.4, densityScore: 'very_high' },
  { stateCode: 'KA', stateName: 'Karnataka', count: 942, percentage: 15.7, densityScore: 'very_high' },
  { stateCode: 'GJ', stateName: 'Gujarat', count: 817, percentage: 13.6, densityScore: 'very_high' },
  { stateCode: 'TN', stateName: 'Tamil Nadu', count: 731, percentage: 12.2, densityScore: 'high' },
  { stateCode: 'TS', stateName: 'Telangana', count: 604, percentage: 10.1, densityScore: 'high' },
  { stateCode: 'DL', stateName: 'Delhi NCR', count: 540, percentage: 9.0, densityScore: 'high' },
  { stateCode: 'UP', stateName: 'Uttar Pradesh', count: 420, percentage: 7.0, densityScore: 'medium' },
  { stateCode: 'RJ', stateName: 'Rajasthan', count: 350, percentage: 5.8, densityScore: 'medium' },
  { stateCode: 'WB', stateName: 'West Bengal', count: 310, percentage: 5.2, densityScore: 'medium' },
];

const SUGGESTIONS = [
  'Craft Breweries',
  'Pharmaceuticals',
  'Specialty Chemicals',
  'Food Processing & FMCG',
  'Solar & Clean Energy',
  'Cold Storage Logistics',
];

export const BusinessMapSection: React.FC = () => {
  const [query, setQuery] = useState('Craft Breweries');
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>('MH');
  const [hoveredStateCode, setHoveredStateCode] = useState<string | null>(null);
  const [states, setStates] = useState<MapStateData[]>(INITIAL_STATES);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    setIsLoading(true);
    setTimeout(() => {
      // Modulate numbers based on query for realistic interactive feel
      const multiplier = newQuery.toLowerCase().includes('pharma')
        ? 1.6
        : newQuery.toLowerCase().includes('chem')
        ? 1.4
        : newQuery.toLowerCase().includes('food')
        ? 2.1
        : 1.0;

      const updated = INITIAL_STATES.map((st) => ({
        ...st,
        count: Math.round(st.count * multiplier),
      }));
      setStates(updated);
      setIsLoading(false);
    }, 400);
  };

  const activeState = states.find((s) => s.stateCode === (hoveredStateCode || selectedStateCode)) || states[0]!;

  return (
    <section id="business-map" className="py-20 lg:py-28 bg-[#070d1e] text-white relative overflow-hidden border-t border-slate-800">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/3 w-[30rem] h-[30rem] bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/90 border border-blue-800 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            MAP YOUR BUSINESS
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Where Does Your Industry Live in India?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
            Search any business sector, category, or niche and explore geographic density across Indian states before deciding where to establish your facility.
          </p>
        </div>

        {/* Live Search Bar + Quick Chips */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="relative flex items-center bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2 shadow-2xl backdrop-blur-xl">
            <svg className="w-6 h-6 text-slate-400 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search an industry, business category, or niche (e.g. craft breweries)..."
              className="w-full bg-transparent px-3 py-2 text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none"
            />
            {isLoading && (
              <div className="mr-3">
                <span className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin inline-block" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
            <span className="text-slate-400">Popular searches:</span>
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleSearch(item)}
                className={`px-3 py-1 rounded-full transition-colors ${
                  query === item
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Map & Density Ranking Grid */}
        <div className="bg-[#0b1329]/95 border border-slate-700/80 rounded-3xl p-6 sm:p-10 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Column: Interactive Vector Map (7 cols) */}
          <div className="lg:col-span-7 relative flex flex-col items-center justify-center min-h-[420px] bg-slate-950/60 rounded-2xl p-6 border border-slate-800">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Query: "{query}"</span>
            </div>

            <IndiaVectorMap
              states={states}
              selectedStateCode={selectedStateCode}
              hoveredStateCode={hoveredStateCode}
              onSelectState={(code) => setSelectedStateCode(code)}
              onHoverState={(code) => setHoveredStateCode(code)}
            />

            {/* Density scale legend */}
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
              <span>Low Density</span>
              <div className="flex gap-1">
                <span className="w-4 h-2.5 rounded-sm bg-[#1e3a8a]" />
                <span className="w-4 h-2.5 rounded-sm bg-[#3b82f6]" />
                <span className="w-4 h-2.5 rounded-sm bg-[#2563eb]" />
                <span className="w-4 h-2.5 rounded-sm bg-[#1d4ed8]" />
              </div>
              <span>Very High</span>
            </div>
          </div>

          {/* Right Column: State Intelligence Card & Rankings (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Active State Highlight Box */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-950/60 to-slate-900 border border-blue-800/80 shadow-lg text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-blue-400 tracking-wider">
                  State Focus • {activeState.stateCode}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
                  {activeState.densityScore.replace('_', ' ').toUpperCase()} DENSITY
                </span>
              </div>

              <h3 className="text-2xl font-extrabold text-white">
                {activeState.stateName}
              </h3>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-400">
                  {activeState.count.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">
                  mapped places ({activeState.percentage}% of India)
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-300">
                <span className="text-slate-400">Top Hubs: </span>
                <span>
                  {activeState.stateCode === 'MH'
                    ? 'Mumbai (482), Pune (316), Nagpur (141)'
                    : activeState.stateCode === 'KA'
                    ? 'Bengaluru (512), Mysuru (184), Mangaluru (96)'
                    : activeState.stateCode === 'GJ'
                    ? 'Ahmedabad (340), Surat (210), Vadodara (165)'
                    : 'Tier-1 & Tier-2 industrial clusters'}
                </span>
              </div>
            </div>

            {/* Top States Proportion Bar List */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Top State Concentrations
              </div>
              {states.slice(0, 4).map((st) => (
                <div
                  key={st.stateCode}
                  onClick={() => setSelectedStateCode(st.stateCode)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all border ${
                    selectedStateCode === st.stateCode
                      ? 'bg-blue-900/40 border-blue-600 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-200">{st.stateName}</span>
                    <span className="font-mono text-blue-400 font-bold">{st.count} places</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (st.count / states[0]!.count) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* CTA to Full Page Business Map */}
            <div className="pt-2">
              <Link
                to={`/business-map?q=${encodeURIComponent(query)}`}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all hover:scale-105"
              >
                <span>Launch Full-Screen Business Map →</span>
              </Link>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
