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
  description: string;
  stateAuthority: string;
  environmentalZoning: string;
  powerGrid: string;
  connectivity: string;
  incentiveScheme: string;
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
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    subdomains: '',
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
  const selectedCityRef = useRef<string | null>(selectedCityId);

  selectedCityRef.current = selectedCityId;

  // 1. Initialize Leaflet Map
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
      maxBoundsViscosity: 0.85,
    });

    // Custom Zoom control in bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile layer
    const layerConfig = TILE_LAYERS[tileStyle] || TILE_LAYERS.dark;
    const tileLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      subdomains: layerConfig.subdomains || 'abc',
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

  // 2. Update Tile Layer dynamically on style toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    const layerConfig = TILE_LAYERS[tileStyle] || TILE_LAYERS.dark;
    const newTileLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      subdomains: layerConfig.subdomains || 'abc',
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [tileStyle]);

  // 3. Smooth flyTo when selectedCityId changes externally
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedCityId) return;

    const targetCity = cities.find((c) => c.id === selectedCityId);
    if (targetCity) {
      map.flyTo([targetCity.lat, targetCity.lng], Math.max(map.getZoom(), 7), {
        animate: true,
        duration: 1.2,
      });
    }
  }, [selectedCityId, cities]);

  // 4. Render interactive cluster pins with animated ripples and custom popups
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    const maxCount = Math.max(...cities.map((c) => c.count), 1);

    cities.forEach((city) => {
      const isSelected = city.id === selectedCityId;
      const isStateMatched = !selectedStateCode || city.stateCode === selectedStateCode;

      // Calculate size dynamically
      const ratio = city.count / maxCount;
      const markerSize = Math.max(36, Math.min(56, Math.round(36 + ratio * 20)));

      // Custom animated HTML pin
      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group" style="width: ${markerSize}px; height: ${markerSize}px;">
          ${
            isSelected
              ? '<div class="absolute -inset-3 rounded-full bg-cyan-400/40 animate-ping pointer-events-none"></div>'
              : isStateMatched
              ? '<div class="absolute -inset-1 rounded-full bg-ocean-400/20 group-hover:bg-cyan-400/40 animate-pulse pointer-events-none"></div>'
              : ''
          }
          <div class="absolute inset-0 rounded-full ${
            isSelected
              ? 'bg-gradient-to-br from-cyan-400 via-ocean-500 to-ocean-800 ring-4 ring-cyan-300 shadow-xl shadow-cyan-500/60 scale-110'
              : isStateMatched
              ? 'bg-gradient-to-br from-ocean-600 to-ocean-900 ring-2 ring-cyan-400/80 hover:ring-cyan-300 shadow-lg shadow-ocean-950/80 hover:scale-110'
              : 'bg-slate-800/90 ring-1 ring-slate-600 opacity-60 hover:opacity-100 hover:scale-105'
          } transition-all duration-300 flex flex-col items-center justify-center text-white border border-white/30">
            <span class="font-extrabold text-[12px] leading-none tracking-tight">${city.count}</span>
            <span class="text-[7px] uppercase font-mono tracking-tighter opacity-90 mt-0.5 font-bold">units</span>
          </div>
          <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md bg-ocean-950/95 text-[10px] font-bold text-white border border-ocean-600/70 shadow-lg pointer-events-none transition-all duration-200 ${
            isSelected ? 'opacity-100 ring-1 ring-cyan-300 scale-105' : 'opacity-85 group-hover:opacity-100 group-hover:scale-105'
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

      // Rich informative popup
      const popupHtml = `
        <div style="min-width: 260px; font-family: 'Hanken Grotesk', system-ui, sans-serif; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid rgba(56, 172, 204, 0.25); padding-bottom: 6px;">
            <div>
              <span style="font-size: 10px; font-weight: 800; color: #38ACCC; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace;">${city.stateName} • Cluster</span>
              <h4 style="margin: 2px 0 0 0; font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em;">${city.name}</h4>
            </div>
            <span style="font-size: 11px; font-weight: 800; background: linear-gradient(135deg, #0E8BB2, #085375); color: #ffffff; padding: 3px 8px; border-radius: 8px; border: 1px solid #38ACCC; box-shadow: 0 2px 8px rgba(14,139,178,0.4);">${city.count} Units</span>
          </div>

          <p style="font-size: 11px; color: #CFE6EE; margin: 0 0 8px 0; line-height: 1.45;">
            ${city.description}
          </p>

          <div style="background: rgba(6, 33, 43, 0.85); border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; border: 1px solid rgba(14, 139, 178, 0.3);">
            <div style="font-size: 9px; text-transform: uppercase; color: #7ECBE0; font-weight: 700; font-family: monospace; margin-bottom: 2px;">Prominent Hubs:</div>
            <div style="font-size: 11px; color: #F4FAFC; font-weight: 600;">
              ${city.industrialParks.slice(0, 2).join(' • ')}
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-bottom: 8px; padding: 4px 6px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.3);">
            <span style="color: #F4FAFC;">Avg Regulatory SLA:</span>
            <span style="color: #F59E0B; font-weight: 800; font-family: monospace;">~${city.avgClearanceDays} Working Days</span>
          </div>

          <a href="/register?state=${city.stateCode}&industry=${encodeURIComponent(domainName)}&city=${encodeURIComponent(city.name)}"
             style="display: block; text-align: center; background: linear-gradient(135deg, #0E8BB2, #085375); color: #ffffff; text-decoration: none; font-size: 11px; font-weight: 700; padding: 8px 12px; border-radius: 8px; box-shadow: 0 4px 14px rgba(14,139,178,0.4); border: 1px solid #38ACCC; transition: transform 0.2s;">
            Build Regulatory Roadmap for ${city.name} →
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
    <div className="relative w-full h-full min-h-[600px] rounded-3xl overflow-hidden border border-ocean-700/80 shadow-2xl bg-ocean-950">
      {/* Real Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[600px] z-10" />

      {/* Embedded Leaflet Custom CSS */}
      <style>{`
        .custom-leaflet-marker {
          background: transparent;
          border: none;
        }
        .leaflet-container {
          background: #04161F;
          font-family: inherit;
        }
        .custom-glass-leaflet-popup .leaflet-popup-content-wrapper {
          background: rgba(6, 33, 43, 0.95);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(56, 172, 204, 0.45);
          border-radius: 16px;
          box-shadow: 0 24px 48px -12px rgba(4, 22, 31, 0.9), 0 0 20px rgba(56, 172, 204, 0.25);
          color: #fff;
          padding: 8px;
        }
        .custom-glass-leaflet-popup .leaflet-popup-tip {
          background: rgba(6, 33, 43, 0.95);
          border: 1px solid rgba(56, 172, 204, 0.45);
        }
        .leaflet-popup-close-button {
          color: #7ECBE0 !important;
          padding: 8px !important;
        }
        .leaflet-popup-close-button:hover {
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
};
