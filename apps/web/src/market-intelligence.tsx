import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Star,
  Store,
  TrendingUp,
  Lightbulb,
  ListChecks,
  ArrowLeftRight,
  AlertTriangle,
  Info,
  Search,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Building2,
  GraduationCap,
  BedDouble,
  ShoppingBag,
  TrainFront,
  SquareParking,
  Handshake,
  Loader2,
  Clock,
  Phone,
  Globe,
  Navigation,
  Wallet,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from './auth';
import { API_BASE_URL } from './api-client';
import { marketApi } from './bi-api';
import type {
  Competitor,
  CompetitorAnalysis,
  MarketSearchResponse,
  PlaceSearchResult,
  ResourceCategory,
} from './bi-api';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fmtDistance(m: number | null): string {
  if (m === null) return '—';
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function PriceLevel({ level }: { level: number | null }): JSX.Element | null {
  if (level === null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500" title={`Price level ${level}/4`}>
      <Wallet className="w-3 h-3" /> {'₹'.repeat(Math.max(1, level))}
    </span>
  );
}

function Stars({ rating }: { rating: number | null }): JSX.Element {
  if (rating === null) return <span className="text-xs text-slate-400 italic">no rating</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      {rating.toFixed(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Interactive Leaflet map: proposed location + competitor markers
// ---------------------------------------------------------------------------

interface CompetitorWithAnalysis extends Competitor {
  analysis?: CompetitorAnalysis | null;
  analysisLoading?: boolean;
}

function CompetitorMap({
  center,
  competitors,
  selectedId,
  onSelect,
  businessType,
}: {
  center: { lat: number; lng: number; name: string };
  competitors: CompetitorWithAnalysis[];
  selectedId: string | null;
  onSelect: (placeId: string) => void;
  businessType: string;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [center.lat, center.lng], zoom: 15, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Recenter when the location changes.
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.setView([center.lat, center.lng], 15);
  }, [center.lat, center.lng]);

  // Redraw markers.
  useEffect(() => {
    const group = layersRef.current;
    if (!group) return;
    group.clearLayers();

    // Proposed business location marker.
    const homeIcon = L.divIcon({
      className: 'bi-home-marker',
      html: `<div style="position:relative;cursor:pointer;"><div style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(37,99,235,.25);"></div>
        <div style="width:26px;height:26px;border-radius:9999px;background:linear-gradient(135deg,#2563eb,#4f46e5);border:2px solid #fff;box-shadow:0 4px 12px rgba(37,99,235,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;">📍</div></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    L.marker([center.lat, center.lng], { icon: homeIcon, zIndexOffset: 1000 })
      .bindPopup(
        `<div style="min-width:180px;font-family:system-ui"><div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:#2563eb;text-transform:uppercase">Proposed Business Location</div>
         <div style="font-weight:700;font-size:13px;margin-top:2px">${center.name}</div>
         <div style="font-size:11px;color:#64748b;margin-top:2px">Business type: ${businessType}</div></div>`,
      )
      .addTo(group);

    for (const c of competitors) {
      const isSel = c.placeId === selectedId;
      const icon = L.divIcon({
        className: 'bi-competitor-marker',
        html: `<div style="position:relative;cursor:pointer;"><div style="width:20px;height:20px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:${isSel ? '#0f766e' : c.rating !== null && c.rating >= 4.3 ? '#059669' : c.rating !== null && c.rating < 3.8 ? '#dc2626' : '#64748b'};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 18],
      });
      const ratingLine = c.rating !== null ? `⭐ ${c.rating.toFixed(1)} (${c.userRatingsTotal ?? 0})` : 'No rating';
      const marker = L.marker([c.location.lat, c.location.lng], { icon })
        .bindPopup(
          `<div style="min-width:200px;font-family:system-ui">
            <div style="font-weight:700;font-size:13px">${c.name}</div>
            <div style="font-size:11px;color:#334155;margin-top:2px">${ratingLine}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">${c.category ?? ''}${c.distanceMeters !== null ? ` · ${fmtDistance(c.distanceMeters)}` : ''}</div>
            ${c.mapsUri ? `<a href="${c.mapsUri}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:11px;color:#2563eb;font-weight:600">Open in Google Maps ↗</a>` : ''}
          </div>`,
        )
        .addTo(group);
      marker.on('click', () => onSelect(c.placeId));
    }
  }, [competitors, selectedId, center.lat, center.lng, center.name, businessType, onSelect]);

  return <div ref={containerRef} className="w-full h-[420px] rounded-2xl border border-slate-200 shadow-sm z-0" />;
}

// ---------------------------------------------------------------------------
// Resource icon helper
// ---------------------------------------------------------------------------

function ResourceIcon({ label }: { label: string }): JSX.Element {
  const cls = 'w-4 h-4 text-slate-600';
  if (label.includes('Office')) return <Building2 className={cls} />;
  if (label.includes('Education')) return <GraduationCap className={cls} />;
  if (label.includes('Hotel')) return <BedDouble className={cls} />;
  if (label.includes('Shopping')) return <ShoppingBag className={cls} />;
  if (label.includes('Transport')) return <TrainFront className={cls} />;
  if (label.includes('Parking')) return <SquareParking className={cls} />;
  return <Handshake className={cls} />;
}

// ---------------------------------------------------------------------------
// Competitor analysis panel (2.9)
// ---------------------------------------------------------------------------

function AnalysisPanel({ analysis }: { analysis: CompetitorAnalysis | null }): JSX.Element {
  if (!analysis) return <div />;
  if (analysis.insufficientData) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
        <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
          <HelpCircle className="w-4 h-4" /> Insufficient review evidence
        </div>
        <p className="text-xs">{analysis.scopeNote}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-center px-3">
          <div className="text-2xl font-black text-slate-900">{analysis.overallRating?.toFixed(1) ?? '—'}</div>
          <div className="text-[9px] uppercase font-mono text-slate-400 font-bold">Overall Rating</div>
        </div>
        <div className="text-center px-3 border-l border-slate-200">
          <div className="text-2xl font-black text-slate-900">{analysis.reviewVolume?.toLocaleString('en-IN') ?? '—'}</div>
          <div className="text-[9px] uppercase font-mono text-slate-400 font-bold">Review Volume</div>
        </div>
        <p className="text-[10px] text-slate-500 flex-1 min-w-[180px]">{analysis.scopeNote}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
            <ThumbsUp className="w-3.5 h-3.5" /> Frequently Mentioned Positives
          </div>
          {analysis.positiveThemes.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No recurring positives in the available sample.</p>
          ) : (
            <ul className="space-y-1.5">
              {analysis.positiveThemes.slice(0, 5).map((t) => (
                <li key={t.theme} className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs">
                  <span className="font-bold text-emerald-900">{t.theme}</span>
                  <span className="text-emerald-600 font-mono text-[10px] ml-1.5">×{t.count}</span>
                  {t.evidence[0] && <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2">“{t.evidence[0]}”</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 mb-1.5">
            <ThumbsDown className="w-3.5 h-3.5" /> Recurring Complaints
          </div>
          {analysis.negativeThemes.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No recurring complaints in the available sample.</p>
          ) : (
            <ul className="space-y-1.5">
              {analysis.negativeThemes.slice(0, 5).map((t) => (
                <li key={t.theme} className="p-2 rounded-xl bg-rose-50/70 border border-rose-100 text-xs">
                  <span className="font-bold text-rose-900">{t.theme}</span>
                  <span className="text-rose-600 font-mono text-[10px] ml-1.5">×{t.count}</span>
                  {t.evidence[0] && <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2">“{t.evidence[0]}”</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {analysis.experienceThemes.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Customer Experience Themes</div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.experienceThemes.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.observation && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
          <span className="font-bold">Potential business observation: </span>
          {analysis.observation}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const SORTS = [
  { id: 'distance', label: 'Distance' },
  { id: 'rating', label: 'Rating' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'price', label: 'Price' },
] as const;

export function MarketIntelligencePage(): JSX.Element {
  const { accessToken } = useAuth();
  const [params] = useSearchParams();

  // Context carried over from Time & Cost Prediction (2.17).
  const [businessType, setBusinessType] = useState(params.get('businessType') ?? 'Restaurant');
  const [locationQuery, setLocationQuery] = useState(params.get('location') ?? '');
  const [location, setLocation] = useState<PlaceSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [configured, setConfigured] = useState(false);

  const [result, setResult] = useState<MarketSearchResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<(typeof SORTS)[number]['id']>('distance');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, CompetitorAnalysis | null>>({});
  const [analysisLoading, setAnalysisLoading] = useState<Record<string, boolean>>({});
  const [resources, setResources] = useState<ResourceCategory[] | null>(null);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // Is the Places integration configured? (drives the honest "not configured" state)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/market/status`);
        const data = (await res.json()) as { configured?: boolean };
        if (!cancelled) setConfigured(Boolean(data.configured));
      } catch {
        if (!cancelled) setConfigured(false);
      } finally {
        if (!cancelled) setStatusChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const doSearch = useCallback(async () => {
    setSearching(true);
    setSearchError(null);
    setResult(null);
    setAnalyses({});
    setSelectedId(null);
    setResources(null);
    try {
      const res = await marketApi.searchLocations(locationQuery, accessToken ?? undefined);
      if (res.results.length === 0) {
        setSearchError('No matching location was found. Try a more specific search (e.g. “Marathahalli, Bangalore”).');
        return;
      }
      setLocation(res.results[0] as PlaceSearchResult);
      setAnalyzing(true);
      const analyzed = await marketApi.analyze(
        { placeId: res.results[0]!.placeId, locationName: res.results[0]!.name, businessType },
        accessToken ?? undefined,
      );
      setResult(analyzed);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Location search failed.');
    } finally {
      setSearching(false);
      setAnalyzing(false);
    }
  }, [locationQuery, businessType, accessToken]);

  // Auto-run when navigated from Time & Cost with a location preset.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (!statusChecked) return;
    if (params.get('location') && configured) {
      autoRan.current = true;
      void doSearch();
    }
  }, [statusChecked, configured, params, doSearch]);

  // Fetch per-competitor review analysis when one is selected.
  const fetchAnalysis = useCallback(
    async (placeId: string) => {
      if (analyses[placeId] !== undefined || analysisLoading[placeId]) return;
      setAnalysisLoading((s) => ({ ...s, [placeId]: true }));
      try {
        const a: CompetitorAnalysis = await marketApi.reviews(placeId, accessToken ?? undefined);
        setAnalyses((s) => ({ ...s, [placeId]: a }));
      } catch (err) {
        setAnalyses((s) => ({ ...s, [placeId]: null }));
        setAnalyzeError(err instanceof Error ? err.message : 'Review analysis failed for this competitor.');
      } finally {
        setAnalysisLoading((s) => ({ ...s, [placeId]: false }));
      }
    },
    [analyses, analysisLoading, accessToken],
  );

  const onSelectCompetitor = useCallback(
    (placeId: string) => {
      setSelectedId(placeId);
      void fetchAnalysis(placeId);
    },
    [fetchAnalysis],
  );

  // Nearby resources once competitors are known.
  useEffect(() => {
    if (!result || resources !== null || resourcesLoading) return;
    setResourcesLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/market/resources`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ lat: result.location.location.lat, lng: result.location.location.lng, radiusMeters: 2000 }),
        });
        if (res.ok) {
          const data = (await res.json()) as { resources: ResourceCategory[] };
          setResources(data.resources ?? []);
        } else {
          setResources([]);
        }
      } catch {
        setResources([]);
      } finally {
        setResourcesLoading(false);
      }
    })();
  }, [result, resources, resourcesLoading, accessToken]);

  const competitors = useMemo<CompetitorWithAnalysis[]>(() => {
    if (!result) return [];
    const list = [...result.competitors];
    list.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.rating ?? -1) - (a.rating ?? -1);
        case 'reviews':
          return (b.userRatingsTotal ?? -1) - (a.userRatingsTotal ?? -1);
        case 'price':
          return (a.priceLevel ?? 99) - (b.priceLevel ?? 99);
        default:
          return (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER);
      }
    });
    return list.map((c) => ({ ...c, analysis: analyses[c.placeId] ?? null, analysisLoading: analysisLoading[c.placeId] ?? false }));
  }, [result, sortBy, analyses, analysisLoading]);

  const selected = competitors.find((c) => c.placeId === selectedId) ?? null;
  const selectedAnalysis = selectedId ? analyses[selectedId] : undefined;
  const analysisAvailable = Object.values(analyses).filter((a) => a && !a.insufficientData).length;

  // ---------------------------------------------------------------------------
  if (!statusChecked) return <LoadingSpinner label="Checking market intelligence configuration…" />;

  if (!configured) {
    return (
      <div className="space-y-6 pb-16">
        <Header projectId={params.get('projectId') ?? undefined} />
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-sm text-amber-900 max-w-2xl">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertTriangle className="w-4 h-4" /> Google Places integration not configured
          </div>
          <p className="text-xs leading-relaxed">
            This feature uses the official Google Maps Platform Places API for location search, competitor discovery and
            review data. Set <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_MAPS_API_KEY</code> in the API's
            environment (enable “Places API (New)” and attach billing in Google Cloud Console), then restart the API.
            No demo or fallback competitor data is shown by design — this page only displays real API responses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 font-sans">
      <Header projectId={params.get('projectId') ?? undefined} />

      {/* 1. Business Type + Location */}
      <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Business type</span>
            <input
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. Restaurant"
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Location</span>
            <div className="relative mt-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void doSearch()}
                placeholder="e.g. Marathahalli, Bangalore"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </label>
          <button
            type="button"
            disabled={searching || analyzing || locationQuery.trim().length < 2}
            onClick={() => void doSearch()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-2"
          >
            {searching || analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {analyzing ? 'Analyzing…' : 'Analyze Market'}
          </button>
        </div>
        {searchError && (
          <div className="mt-3">
            <ErrorBanner message={searchError} />
          </div>
        )}
        {location && !result && !analyzing && (
          <p className="mt-2 text-xs text-slate-500">
            Location selected: <strong>{location.name}</strong>
            {location.address ? ` — ${location.address}` : ''}
          </p>
        )}
      </section>

      {analyzing && <LoadingSpinner label={`Finding ${businessType.toLowerCase()} competitors and analyzing the local market…`} />}

      {result && (
        <>
          {/* 2. Map + 3. Competitor list */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <section className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-700" /> Interactive Map
                </h2>
                <span className="text-[10px] font-mono text-slate-400">{competitors.length} competitors · click a marker for details</span>
              </div>
              <CompetitorMap
                center={{ lat: result.location.location.lat, lng: result.location.location.lng, name: result.location.name }}
                competitors={competitors}
                selectedId={selectedId}
                onSelect={onSelectCompetitor}
                businessType={businessType}
              />
              <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" /> proposed location</span>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" /> rated ≥ 4.3</span>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-600 inline-block" /> rated &lt; 3.8</span>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-500 inline-block" /> other / unrated</span>
              </div>
            </section>

            <section className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-slate-700" /> Competitors
                </h2>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {SORTS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSortBy(s.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${sortBy === s.id ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {competitors.length === 0 ? (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
                  No competitor data could be retrieved for this location. Please try another location or verify the map configuration.
                </div>
              ) : (
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {competitors.map((c) => (
                    <button
                      key={c.placeId}
                      type="button"
                      onClick={() => onSelectCompetitor(c.placeId)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                        selectedId === c.placeId
                          ? 'bg-teal-50/60 border-teal-500 ring-1 ring-teal-400'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{c.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{c.category ?? businessType} · {fmtDistance(c.distanceMeters)}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <Stars rating={c.rating} />
                          {c.userRatingsTotal !== null && <div className="text-[10px] text-slate-400 font-mono">{c.userRatingsTotal.toLocaleString('en-IN')} reviews</div>}
                          <PriceLevel level={c.priceLevel} />
                        </div>
                      </div>
                      {c.businessStatus && c.businessStatus !== 'OPERATIONAL' && (
                        <div className="mt-1 text-[10px] font-bold text-amber-600">⚠ {c.businessStatus.replaceAll('_', ' ').toLowerCase()}</div>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500">
                        {c.openNow !== null && (
                          <span className={`inline-flex items-center gap-1 font-semibold ${c.openNow ? 'text-emerald-600' : 'text-slate-500'}`}>
                            <Clock className="w-3 h-3" /> {c.openNow ? 'Open now' : 'Closed now'}
                          </span>
                        )}
                        {c.mapsUri && (
                          <a
                            href={c.mapsUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" /> Maps
                          </a>
                        )}
                        <span className="ml-auto text-teal-700 font-bold">Analyze →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* 4. Competitor details + 5. Review intelligence */}
          {selected && (
            <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Competitor Analysis — {selected.name}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.address ?? fmtDistance(selected.distanceMeters)}</span>
                    <Stars rating={selected.rating} />
                    {selected.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {selected.phone}</span>}
                    {selected.websiteUri && (
                      <a href={selected.websiteUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <Globe className="w-3 h-3" /> Website
                      </a>
                    )}
                    {selected.mapsUri && (
                      <a href={selected.mapsUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <Navigation className="w-3 h-3" /> Open in Google Maps
                      </a>
                    )}
                  </div>
                </div>
                {analysisLoading[selected.placeId] && (
                  <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing reviews…
                  </span>
                )}
              </div>
              {analyzeError && <div className="mb-3"><ErrorBanner message={analyzeError} /></div>}
              {selectedAnalysis !== undefined ? (
                <AnalysisPanel analysis={selectedAnalysis} />
              ) : (
                <p className="text-xs text-slate-500 italic">Select “Analyze” on a competitor to load its available review intelligence.</p>
              )}
            </section>
          )}

          {/* 6. Market snapshot + 8. Location/resource intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-extrabold text-slate-900">Local Market Snapshot</h2>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mb-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xl font-black text-slate-900">{result.competitors.length}</div>
                  <div className="text-[9px] uppercase font-mono text-slate-400 font-bold">Competitors Found</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xl font-black text-slate-900">
                    {result.competitors.some((c) => c.rating !== null)
                      ? (result.competitors.filter((c) => c.rating !== null).reduce((s, c) => s + (c.rating ?? 0), 0) / result.competitors.filter((c) => c.rating !== null).length).toFixed(1)
                      : '—'}
                  </div>
                  <div className="text-[9px] uppercase font-mono text-slate-400 font-bold">Avg Rating</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xl font-black text-slate-900">
                    {result.competitors.some((c) => c.userRatingsTotal !== null)
                      ? Math.round(result.competitors.filter((c) => c.userRatingsTotal !== null).reduce((s, c) => s + (c.userRatingsTotal ?? 0), 0) / result.competitors.filter((c) => c.userRatingsTotal !== null).length).toLocaleString('en-IN')
                      : '—'}
                  </div>
                  <div className="text-[9px] uppercase font-mono text-slate-400 font-bold">Avg Reviews</div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
                    <ThumbsUp className="w-3.5 h-3.5" /> Frequently Praised
                  </div>
                  {analysisAvailable === 0 ? (
                    <p className="text-slate-400 italic">Analyze competitors to aggregate praise themes.</p>
                  ) : (
                    <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                      {Object.values(analyses)
                        .filter((a): a is CompetitorAnalysis => Boolean(a && !a.insufficientData))
                        .flatMap((a) => a.positiveThemes.slice(0, 2))
                        .reduce<Array<{ theme: string; count: number }>>((acc, t) => {
                          const found = acc.find((x) => x.theme === t.theme);
                          if (found) found.count += t.count;
                          else acc.push({ theme: t.theme, count: t.count });
                          return acc;
                        }, [])
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 4)
                        .map((t) => (
                          <li key={t.theme}>{t.theme} <span className="font-mono text-[10px] text-slate-400">×{t.count}</span></li>
                        ))}
                    </ol>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-rose-700 mb-1.5">
                    <ThumbsDown className="w-3.5 h-3.5" /> Frequently Mentioned Complaints
                  </div>
                  {analysisAvailable === 0 ? (
                    <p className="text-slate-400 italic">Analyze competitors to aggregate complaint themes.</p>
                  ) : (
                    <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                      {Object.values(analyses)
                        .filter((a): a is CompetitorAnalysis => Boolean(a && !a.insufficientData))
                        .flatMap((a) => a.negativeThemes.slice(0, 2))
                        .reduce<Array<{ theme: string; count: number }>>((acc, t) => {
                          const found = acc.find((x) => x.theme === t.theme);
                          if (found) found.count += t.count;
                          else acc.push({ theme: t.theme, count: t.count });
                          return acc;
                        }, [])
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 4)
                        .map((t) => (
                          <li key={t.theme}>{t.theme} <span className="font-mono text-[10px] text-slate-400">×{t.count}</span></li>
                        ))}
                    </ol>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[10px] text-slate-400 font-mono">
                Scope: insights are based on the customer review data available through the connected source (Places API sample per place), not all Google reviews.
              </p>
            </section>

            <section className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-indigo-700" />
                <h2 className="text-sm font-extrabold text-slate-900">Location Intelligence</h2>
              </div>
              <div className="space-y-1.5 text-xs mb-4">
                <div><span className="text-slate-400 font-mono text-[10px] uppercase font-bold">Location:</span> <span className="font-bold text-slate-900">{result.location.name}</span>{result.location.address ? <span className="text-slate-500"> — {result.location.address}</span> : null}</div>
                <div><span className="text-slate-400 font-mono text-[10px] uppercase font-bold">Business type:</span> <span className="font-bold text-slate-900">{businessType}</span></div>
                <div>
                  <span className="text-slate-400 font-mono text-[10px] uppercase font-bold">Competitive pressure:</span>{' '}
                  <span className={`font-bold ${result.competitors.length >= 15 ? 'text-rose-600' : result.competitors.length >= 8 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {result.competitors.length >= 15 ? 'High' : result.competitors.length >= 8 ? 'Moderate' : 'Low'}
                  </span>
                </div>
              </div>

              {/* FACT vs INFERENCE (2.14) */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900 mb-2">
                <span className="font-bold uppercase text-[10px] font-mono tracking-wider block mb-0.5">Fact</span>
                {result.competitors.length} {businessType.toLowerCase()} places were returned by the Places API within the selected search area.
                {resources !== null && resources.length > 0 && ` ${resources.reduce((s, r) => s + r.count, 0)} nearby relevant places were found across ${resources.length} resource categories.`}
              </div>
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 mb-3">
                <span className="font-bold uppercase text-[10px] font-mono tracking-wider block mb-0.5">Inference</span>
                {result.competitors.length >= 15
                  ? 'The high number of nearby competitors indicates strong local competition.'
                  : result.competitors.length >= 8
                    ? 'The moderate competitor count suggests an active but not saturated local market.'
                    : 'The low competitor count may indicate an underserved market — or simply a narrow search area; verify with a wider radius.'}
                {resources !== null && resources.some((r) => r.category.includes('Office') || r.category.includes('Transport')) && ' Nearby offices and transport hubs suggest steady weekday footfall potential.'}
              </div>

              {/* Resources */}
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                Nearby Relevant Places {resourcesLoading && <Loader2 className="w-3 h-3 inline animate-spin" />}
              </div>
              {resources === null ? (
                <p className="text-xs text-slate-400 italic">Loading nearby resources…</p>
              ) : resources.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No nearby resource categories were returned by the Places API for this location.</p>
              ) : (
                <div className="space-y-1.5">
                  {resources.map((r) => (
                    <div key={r.category} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                        <ResourceIcon label={r.category} /> {r.category}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* 9. Market gaps */}
          {analysisAvailable > 0 && (() => {
            const gaps = Object.values(analyses)
              .filter((a): a is CompetitorAnalysis => Boolean(a && !a.insufficientData))
              .flatMap((a) => a.negativeThemes.slice(0, 3))
              .reduce<Array<{ theme: string; count: number; competitors: Set<string> }>>((acc, t) => {
                const found = acc.find((x) => x.theme === t.theme);
                if (found) { found.count += t.count; }
                return acc;
              }, [])
              .filter((t) => t.count >= 2)
              .sort((a, b) => b.count - a.count)
              .slice(0, 4);
            return (
              <section className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950 to-slate-900 text-white shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-300" />
                  <h2 className="text-sm font-extrabold">Potential Market Gaps</h2>
                  <span className="ml-auto text-[10px] font-mono text-slate-400">evidence-based · from recurring feedback</span>
                </div>
                {gaps.length === 0 ? (
                  <p className="text-xs text-slate-300">No strongly recurring complaint themes emerged from the analyzed competitors so far. Analyze more competitors to surface gaps.</p>
                ) : (
                  <ol className="list-decimal pl-5 space-y-2 text-sm">
                    {gaps.map((g) => (
                      <li key={g.theme}>
                        <span className="font-bold">{g.theme}</span>
                        <span className="text-slate-300 text-xs"> — this appears to be a potential opportunity based on recurring feedback in the available competitor data ({g.count} complaint mentions across analyzed competitors).</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })()}

          {/* 10. Recommendations + 11. Next steps */}
          {analysisAvailable > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <section className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowLeftRight className="w-4 h-4 text-blue-700" />
                  <h2 className="text-sm font-extrabold text-slate-900">Business Recommendations</h2>
                </div>
                <div className="space-y-3">
                  {Object.values(analyses)
                    .filter((a): a is CompetitorAnalysis => Boolean(a && !a.insufficientData))
                    .flatMap((a) => a.negativeThemes.slice(0, 1))
                    .slice(0, 4)
                    .map((t) => (
                      <div key={t.theme} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="font-bold text-slate-800 mb-0.5">
                          <span className="text-[9px] uppercase font-mono text-slate-400 tracking-wider mr-1.5">Observation</span>
                          Several competitors show recurring “{t.theme}” complaints ({t.count}+ mentions in the available sample).
                        </div>
                        <div className="text-blue-900">
                          <span className="text-[9px] uppercase font-mono text-blue-400 tracking-wider mr-1.5">Recommendation</span>
                          Consider designing staffing, training and quality checks around {t.theme.toLowerCase()} before launch — it is the recurring weakness in this market's available review data.
                        </div>
                      </div>
                    ))}
                  {Object.values(analyses).every((a) => !a || a.insufficientData) && (
                    <p className="text-xs text-slate-400 italic">Analyze competitors to generate evidence-based recommendations.</p>
                  )}
                </div>
              </section>

              <section className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="w-4 h-4 text-emerald-700" />
                  <h2 className="text-sm font-extrabold text-slate-900">Recommended Next Steps</h2>
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700">
                  <li>Review the top competitors on the map and shortlist the 3 closest to your proposed location.</li>
                  <li>Identify the recurring customer complaints and confirm them with your own visits.</li>
                  <li>Select 2–3 potential market gaps that match your strengths.</li>
                  <li>Define your differentiation strategy around the selected gaps.</li>
                  <li>
                    Estimate setup time and cost:{' '}
                    <Link to={`/time-cost-prediction?projectId=${params.get('projectId') ?? ''}`} className="text-blue-700 font-bold hover:underline">
                      open Time &amp; Cost Prediction →
                    </Link>
                  </li>
                  <li>Validate your legal requirements in your project's Approval Roadmap.</li>
                  <li>Build the business plan around the identified opportunities.</li>
                </ol>
                <p className="mt-3 text-[10px] text-slate-400">These are recommendations, not guarantees — every suggestion traces to an observation in the available data.</p>
              </section>
            </div>
          )}

          {/* 12. Cross-link back to Feature 1 */}
          <section className="p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 font-mono mb-1">Next Step</div>
              <h3 className="text-lg font-black">Estimate Setup Time &amp; Cost</h3>
              <p className="text-xs text-slate-300 mt-0.5 max-w-lg">
                Continue with the regulatory side: compute your legal-readiness timeline and compliance cost for the same business context ({businessType} in {result.location.name}).
              </p>
            </div>
            <Link
              to={`/time-cost-prediction?projectId=${params.get('projectId') ?? ''}`}
              className="px-5 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow-lg transition-colors shrink-0"
            >
              Estimate Setup Time &amp; Cost →
            </Link>
          </section>
        </>
      )}

      {!result && !analyzing && !searchError && (
        <div className="max-w-2xl">
          <EmptyState
            title="Search a location to begin"
            description="Enter a business type and a location (e.g. Restaurant in Marathahalli, Bangalore), then run the analysis. Competitor data comes live from the Google Places API — nothing here is pre-seeded."
          />
        </div>
      )}

      <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
        <Info className="w-3 h-3" />
        Data source: Google Maps Platform Places API (New) — only information actually returned by the API is displayed. Review insights use the per-place review sample the API exposes.
      </p>
    </div>
  );
}

function Header({ projectId }: { projectId?: string | undefined }): JSX.Element {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider font-mono mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Business Intelligence
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Market &amp; Competitor Intelligence</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-2xl">
          Understand your local market, competitors, customer feedback and potential business opportunities.
        </p>
      </div>
      <Link
        to={`/time-cost-prediction${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-700 transition-colors shrink-0 self-start"
      >
        <Clock className="w-3.5 h-3.5" />
        Time &amp; Cost Prediction →
      </Link>
    </div>
  );
}
