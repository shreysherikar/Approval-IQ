import React from 'react';

export interface MapStateData {
  stateCode: string;
  stateName: string;
  count: number;
  percentage: number;
  densityScore: 'very_high' | 'high' | 'medium' | 'low';
}

interface IndiaVectorMapProps {
  states: MapStateData[];
  selectedStateCode?: string | null;
  hoveredStateCode?: string | null;
  onSelectState: (stateCode: string) => void;
  onHoverState: (stateCode: string | null) => void;
  className?: string;
}

// Geometric polygon paths and centroid pins for Indian states & union territories
const STATE_PATHS: { code: string; name: string; path: string; labelX: number; labelY: number }[] = [
  {
    code: 'MH',
    name: 'Maharashtra',
    path: 'M 190 280 L 260 260 L 310 280 L 290 350 L 220 370 L 170 330 Z',
    labelX: 240,
    labelY: 310,
  },
  {
    code: 'GJ',
    name: 'Gujarat',
    path: 'M 110 240 L 180 220 L 200 270 L 160 300 L 100 270 Z',
    labelX: 145,
    labelY: 260,
  },
  {
    code: 'KA',
    name: 'Karnataka',
    path: 'M 200 370 L 250 360 L 270 440 L 220 480 L 190 420 Z',
    labelX: 230,
    labelY: 420,
  },
  {
    code: 'TN',
    name: 'Tamil Nadu',
    path: 'M 250 440 L 300 430 L 290 520 L 240 530 L 230 480 Z',
    labelX: 265,
    labelY: 480,
  },
  {
    code: 'TS',
    name: 'Telangana',
    path: 'M 260 320 L 310 310 L 320 370 L 260 380 Z',
    labelX: 285,
    labelY: 345,
  },
  {
    code: 'AP',
    name: 'Andhra Pradesh',
    path: 'M 280 370 L 350 330 L 360 410 L 290 440 Z',
    labelX: 320,
    labelY: 385,
  },
  {
    code: 'RJ',
    name: 'Rajasthan',
    path: 'M 140 160 L 220 140 L 240 210 L 170 240 L 130 190 Z',
    labelX: 185,
    labelY: 185,
  },
  {
    code: 'MP',
    name: 'Madhya Pradesh',
    path: 'M 210 220 L 330 210 L 340 280 L 230 290 Z',
    labelX: 275,
    labelY: 250,
  },
  {
    code: 'UP',
    name: 'Uttar Pradesh',
    path: 'M 240 140 L 360 130 L 370 200 L 250 210 Z',
    labelX: 300,
    labelY: 170,
  },
  {
    code: 'DL',
    name: 'Delhi NCR',
    path: 'M 230 145 L 250 140 L 255 155 L 235 160 Z',
    labelX: 245,
    labelY: 150,
  },
  {
    code: 'HR',
    name: 'Haryana',
    path: 'M 210 120 L 250 115 L 245 160 L 205 150 Z',
    labelX: 225,
    labelY: 135,
  },
  {
    code: 'PB',
    name: 'Punjab',
    path: 'M 190 90 L 230 85 L 225 125 L 185 120 Z',
    labelX: 205,
    labelY: 105,
  },
  {
    code: 'WB',
    name: 'West Bengal',
    path: 'M 380 190 L 420 180 L 410 270 L 370 260 Z',
    labelX: 395,
    labelY: 225,
  },
  {
    code: 'OD',
    name: 'Odisha',
    path: 'M 330 270 L 400 260 L 380 340 L 320 320 Z',
    labelX: 360,
    labelY: 295,
  },
  {
    code: 'KL',
    name: 'Kerala',
    path: 'M 210 470 L 235 460 L 240 530 L 215 540 Z',
    labelX: 225,
    labelY: 500,
  },
];

export const IndiaVectorMap: React.FC<IndiaVectorMapProps> = ({
  states,
  selectedStateCode,
  hoveredStateCode,
  onSelectState,
  onHoverState,
  className = '',
}) => {
  const stateMap = new Map(states.map((s) => [s.stateCode, s]));

  const getFillColor = (code: string, isHovered: boolean, isSelected: boolean) => {
    if (isSelected) return '#3b82f6'; // Bright blue
    if (isHovered) return '#60a5fa'; // Light blue hover

    const data = stateMap.get(code);
    if (!data) return '#1e293b'; // Slate 800 neutral

    switch (data.densityScore) {
      case 'very_high':
        return '#1d4ed8'; // Royal Deep Blue
      case 'high':
        return '#2563eb'; // Indigo Blue
      case 'medium':
        return '#3b82f6'; // Medium Blue
      case 'low':
      default:
        return '#1e3a8a'; // Navy Blue
    }
  };

  return (
    <div className={`relative w-full h-full flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="80 50 380 520"
        className="w-full h-full max-h-[580px] drop-shadow-2xl overflow-visible"
      >
        {/* Subtle Map Ambient Glow Filter */}
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer India Blueprint Grid */}
        <g opacity="0.15">
          <line x1="80" y1="150" x2="440" y2="150" stroke="#94a3b8" strokeDasharray="3 3" />
          <line x1="80" y1="300" x2="440" y2="300" stroke="#94a3b8" strokeDasharray="3 3" />
          <line x1="80" y1="450" x2="440" y2="450" stroke="#94a3b8" strokeDasharray="3 3" />
          <line x1="200" y1="50" x2="200" y2="550" stroke="#94a3b8" strokeDasharray="3 3" />
          <line x1="320" y1="50" x2="320" y2="550" stroke="#94a3b8" strokeDasharray="3 3" />
        </g>

        {/* State Polygonal Regions */}
        {STATE_PATHS.map((st) => {
          const isSelected = selectedStateCode === st.code;
          const isHovered = hoveredStateCode === st.code;
          const data = stateMap.get(st.code);
          const fillColor = getFillColor(st.code, isHovered, isSelected);

          return (
            <g
              key={st.code}
              className="cursor-pointer transition-all duration-300 group"
              onClick={() => onSelectState(st.code)}
              onMouseEnter={() => onHoverState(st.code)}
              onMouseLeave={() => onHoverState(null)}
            >
              <path
                d={st.path}
                fill={fillColor}
                stroke={isSelected ? '#ffffff' : '#334155'}
                strokeWidth={isSelected ? '2.5' : '1.2'}
                className="transition-all duration-300 hover:opacity-90"
              />

              {/* State Label & Pin */}
              <text
                x={st.labelX}
                y={st.labelY}
                textAnchor="middle"
                className={`text-[10px] font-bold pointer-events-none transition-colors ${
                  isSelected || isHovered ? 'fill-white font-extrabold' : 'fill-slate-200'
                }`}
              >
                {st.code}
              </text>

              {data && (
                <circle
                  cx={st.labelX}
                  cy={st.labelY + 12}
                  r={isSelected ? 4.5 : 3}
                  className={`pointer-events-none transition-all ${
                    data.densityScore === 'very_high'
                      ? 'fill-amber-400 animate-pulse'
                      : data.densityScore === 'high'
                      ? 'fill-blue-300'
                      : 'fill-slate-400'
                  }`}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
