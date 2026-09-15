import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface CityMarkerData {
  id: string;
  name: string;
  stateCode: string;
  stateName: string;
  lat: number;
  lng: number;
  count: number;
  industrialParks: string[];
  avgClearanceDays: number;
  topClearances: string[];
}

export interface RealIndiaLeafletMapProps {
  cities: CityMarkerData[];
  selectedCityId: string | null;
  selectedStateCode: string | null;
  onSelectCity: (city: CityMarkerData) => void;
  tileStyle: 'dark' | 'satellite' | 'street' | 'light';
  domainName: string;
}

const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
};

export const RealIndiaLeafletMap: React.FC<RealIndiaLeafletMapProps> = ({
  cities,
  selectedCityId,
  selectedStateCode,
  onSelectCity,
  tileStyle,
  domainName,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on India [21.5, 78.9] at zoom level 5
    const map = L.map(mapContainerRef.current, {
      center: [21.8, 79.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 14,
      zoomControl: false,
      maxBounds: [
        [6.0, 66.0], // South-West India
        [37.5, 98.0], // North-East India
      ],
      maxBoundsViscosity: 0.8,
    });

    // Add custom zoom control in bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile layer
    const layerConfig = TILE_LAYERS[tileStyle] || TILE_LAYERS.dark;
    const tileLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Markers layer group
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Update Tile Layer on style switch
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    const layerConfig = TILE_LAYERS[tileStyle] || TILE_LAYERS.dark;
    const newTileLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [tileStyle]);

  // 3. Update Markers with dynamic business counts & custom glowing pulse pins
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // Determine max count for scale calculation
    const maxCount = Math.max(...cities.map((c) => c.count), 1);

    cities.forEach((city) => {
      const isSelected = city.id === selectedCityId;
      const isStateMatched = !selectedStateCode || city.stateCode === selectedStateCode;
      
      // Calculate visual size based on business count
      const ratio = city.count / maxCount;
      const markerSize = Math.max(34, Math.min(54, Math.round(34 + ratio * 20)));

      // Custom HTML Marker with glowing pulse and exact count
      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group" style="width: ${markerSize}px; height: ${markerSize}px;">
          ${
            isSelected
              ? '<div class="absolute -inset-2 rounded-full bg-cyan-400/40 animate-ping"></div>'
              : ''
          }
          <div class="absolute inset-0 rounded-full ${
            isSelected
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 ring-4 ring-cyan-300 shadow-xl shadow-cyan-500/50'
              : isStateMatched
              ? 'bg-gradient-to-r from-blue-600 to-indigo-700 ring-2 ring-blue-400/80 hover:ring-cyan-300 shadow-lg shadow-blue-900/60 hover:scale-110'
              : 'bg-slate-800/80 ring-1 ring-slate-600 opacity-60 hover:opacity-100'
          } transition-all duration-300 flex flex-col items-center justify-center text-white">
            <span class="font-extrabold text-[11px] leading-none tracking-tight">${city.count}</span>
            <span class="text-[7px] uppercase font-mono tracking-tighter opacity-80 mt-0.5">units</span>
          </div>
          <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md bg-slate-950/90 text-[10px] font-bold text-slate-200 border border-slate-700/80 shadow-md pointer-events-none transition-opacity duration-200 ${
            isSelected ? 'opacity-100 ring-1 ring-cyan-400' : 'opacity-85 group-hover:opacity-100'
          }">
            ${city.name}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: iconHtml,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
      });

      const marker = L.marker([city.lat, city.lng], { icon: customIcon });

      marker.on('click', () => {
        onSelectCity(city);
        map.flyTo([city.lat, city.lng], 8, {
          animate: true,
          duration: 1.0,
        });
      });

      // Bind rich popup
      const popupHtml = `
        <div style="min-width: 240px; font-family: system-ui, sans-serif; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
            <div>
              <span style="font-size: 10px; font-weight: bold; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">${city.stateName}</span>
              <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #f8fafc;">${city.name}</h4>
            </div>
            <span style="font-size: 12px; font-weight: 900; background: #0284c7; color: #ffffff; padding: 2px 7px; border-radius: 9999px;">${city.count} Units</span>
          </div>

          <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 8px 0; line-height: 1.4;">
            Mapped <strong>${domainName}</strong> establishments in this cluster.
          </p>

          <div style="background: #0f172a; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; border: 1px solid #1e293b;">
            <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px;">Key Industrial Hubs:</div>
            <div style="font-size: 11px; color: #cbd5e1; font-weight: 500;">
              ${city.industrialParks.slice(0, 2).join(' • ')}
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; margin-bottom: 8px;">
            <span style="color: #94a3b8;">Avg Regulatory SLA:</span>
            <span style="color: #fbbf24; font-weight: 700;">~${city.avgClearanceDays} Days</span>
          </div>

          <a href="/register?state=${city.stateCode}&industry=${encodeURIComponent(domainName)}&city=${encodeURIComponent(city.name)}"
             style="display: block; text-align: center; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; text-decoration: none; font-size: 11px; font-weight: 700; padding: 7px 10px; border-radius: 8px; box-shadow: 0 4px 10px rgba(37,99,235,0.3);">
            Build Approval Roadmap for ${city.name} →
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'custom-glass-leaflet-popup',
        closeButton: true,
      });

      markersGroup.addLayer(marker);
    });
  }, [cities, selectedCityId, selectedStateCode, domainName]);

  return (
    <div className="relative w-full h-full min-h-[580px] rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950">
      {/* Real Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[580px] z-10" />

      {/* Embedded Leaflet Custom CSS */}
      <style>{`
        .custom-leaflet-marker {
          background: transparent;
          border: none;
        }
        .leaflet-container {
          background: #070d1e;
          font-family: inherit;
        }
        .custom-glass-leaflet-popup .leaflet-popup-content-wrapper {
          background: rgba(11, 19, 41, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 16px;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.7);
          color: #fff;
          padding: 8px;
        }
        .custom-glass-leaflet-popup .leaflet-popup-tip {
          background: rgba(11, 19, 41, 0.95);
          border: 1px solid rgba(56, 189, 248, 0.3);
        }
        .leaflet-popup-close-button {
          color: #94a3b8 !important;
          padding: 8px !important;
        }
        .leaflet-popup-close-button:hover {
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
};
