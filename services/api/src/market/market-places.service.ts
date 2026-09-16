import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Feature 2 — Resource & Competitor Intelligence.
 *
 * Google Maps / Places integration (Places API New, REST):
 *  - Location search  → POST places.googleapis.com/v1/places:searchText
 *  - Nearby competitors → POST places.googleapis.com/v1/places:searchNearby
 *  - Place details + reviews → GET places.googleapis.com/v1/places/{id}
 *
 * The API key lives ONLY in the server env (GOOGLE_MAPS_API_KEY) and is never
 * returned to the client. No HTML scraping, no fabricated data: every value
 * shown to the user comes from a validated Places API response, and review
 * analysis runs over the review texts the API actually returned (the Places
 * API exposes only a limited sample of reviews per place — the UI states that
 * scope explicitly).
 */

const PLACES_BASE = 'https://places.googleapis.com/v1';

export interface PlacesApiPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string | number;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  currentOpeningHours?: { openNow?: boolean };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  reviews?: Array<{
    name?: string;
    relativePublishTimeDescription?: string;
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string };
  }>;
}

// Places API (New) price-level enum values.
const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export class PlacesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly userMessage: string,
  ) {
    super(message);
    this.name = 'PlacesApiError';
  }
}

@Injectable()
export class MarketIntelligenceService {
  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(this.config.get<string>('GOOGLE_MAPS_API_KEY'));
  }

  private key(): string {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!key) {
      throw new ServiceUnavailableException(
        'Market intelligence is not configured: set GOOGLE_MAPS_API_KEY in the API environment to enable Google Places data. No demo or fallback data is shown by design.',
      );
    }
    return key;
  }

  private async callPlaces<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown; fieldMask: string[]; query?: Record<string, string> },
  ): Promise<T> {
    const key = this.key();
    const url = new URL(`${PLACES_BASE}${path}`);
    if (init.query) {
      for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
    }
    const headers: Record<string, string> = {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': init.fieldMask.join(','),
      'Content-Type': 'application/json',
    };
    const fetchInit: RequestInit = {
      method: init.method,
      headers,
    };
    if (init.method === 'POST') fetchInit.body = JSON.stringify(init.body ?? {});
    let res: Response;
    try {
      res = await fetch(url.toString(), fetchInit);
    } catch (err) {
      throw new PlacesApiError(
        `Google Places API request failed: ${err instanceof Error ? err.message : String(err)}`,
        0,
        'Could not reach the Google Places API (network error). Please try again in a moment.',
      );
    }
    if (!res.ok) {
      let errBody: { error?: { message?: string; status?: string } } = {};
      try {
        errBody = (await res.json()) as typeof errBody;
      } catch {
        // non-JSON error body
      }
      const apiMessage = errBody?.error?.message ?? res.statusText;
      let userMessage: string;
      if (res.status === 403) {
        userMessage =
          'The Places API key was rejected (permission denied). Check that Places API (New) is enabled for the key and that billing is active.';
      } else if (res.status === 429) {
        userMessage = 'Rate limit reached on the Places API. Please wait a moment and try again.';
      } else if (res.status === 400) {
        userMessage = `Places API rejected the request: ${apiMessage}`;
      } else {
        userMessage = `Google Places API error (${res.status}): ${apiMessage}`;
      }
      throw new PlacesApiError(`Places API ${res.status}: ${apiMessage}`, res.status, userMessage);
    }
    return (await res.json()) as T;
  }

  // -------------------------------------------------------------------------
  // Location search: resolve a free-text place ("Marathahalli, Bangalore").
  // -------------------------------------------------------------------------
  async searchLocations(query: string): Promise<Array<{ placeId: string; name: string; address: string | null; location: { lat: number; lng: number } }>> {
    const q = query.trim();
    if (q.length < 2) throw new BadRequestException('Location query is too short.');
    const data = await this.callPlaces<{ places?: PlacesApiPlace[] }>('/places:searchText', {
      method: 'POST',
      fieldMask: ['places.id', 'places.displayName', 'places.formattedAddress', 'places.location'],
      body: { textQuery: q, maxResultCount: 6 },
    });
    return (data.places ?? [])
      .filter((p) => p.id && p.location?.latitude !== undefined && p.location?.longitude !== undefined)
      .map((p) => ({
        placeId: p.id as string,
        name: p.displayName?.text ?? q,
        address: p.formattedAddress ?? null,
        location: { lat: p.location?.latitude as number, lng: p.location?.longitude as number },
      }));
  }

  // -------------------------------------------------------------------------
  // Nearby competitor discovery via searchNearby (permitted Places API usage).
  // -------------------------------------------------------------------------
  private placeTypeFor(businessType: string): string {
    const t = businessType.trim().toLowerCase();
    // Places API (New) included types — mapped from common business types.
    if (t.includes('restaurant') || t.includes('cafe') || t.includes('coffee')) return 'restaurant';
    if (t.includes('brewery')) return 'brewery';
    if (t.includes('bar') || t.includes('pub')) return 'bar';
    if (t.includes('bakery')) return 'bakery';
    if (t.includes('salon')) return 'beauty_salon';
    if (t.includes('gym')) return 'gym';
    if (t.includes('hotel')) return 'hotel';
    if (t.includes('store') || t.includes('retail') || t.includes('shop')) return 'store';
    if (t.includes('pharmacy')) return 'pharmacy';
    if (t.includes('school')) return 'school';
    if (t.includes('dentist')) return 'dentist';
    if (t.includes('laundry')) return 'laundry';
    return 'restaurant';
  }

  async nearbyCompetitors(
    lat: number,
    lng: number,
    businessType: string,
    radiusMeters: number,
  ): Promise<Array<CompetitorDto>> {
    const includedType = this.placeTypeFor(businessType);
    const data = await this.callPlaces<{ places?: PlacesApiPlace[] }>('/places:searchNearby', {
      method: 'POST',
      fieldMask: [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.primaryTypeDisplayName',
        'places.currentOpeningHours.openNow',
        'places.websiteUri',
        'places.nationalPhoneNumber',
        'places.googleMapsUri',
        'places.businessStatus',
      ],
      body: {
        includedTypes: [includedType],
        maxResultCount: 20,
        rankPreference: 'POPULARITY',
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(50_000, Math.max(100, radiusMeters)),
          },
        },
      },
    });
    return (data.places ?? []).map((p) => ({
      placeId: p.id ?? '',
      name: p.displayName?.text ?? 'Unknown place',
      address: p.formattedAddress ?? null,
      location: { lat: p.location?.latitude ?? lat, lng: p.location?.longitude ?? lng },
      rating: p.rating ?? null,
      userRatingsTotal: p.userRatingCount ?? null,
      priceLevel: p.priceLevel ? (PRICE_LEVELS[String(p.priceLevel)] ?? null) : null,
      category: p.primaryTypeDisplayName?.text ?? null,
      openNow: p.currentOpeningHours?.openNow ?? null,
      distanceMeters: haversineMeters(lat, lng, p.location?.latitude ?? lat, p.location?.longitude ?? lng),
      websiteUri: p.websiteUri ?? null,
      phone: p.nationalPhoneNumber ?? null,
      mapsUri: p.googleMapsUri ?? null,
      businessStatus: p.businessStatus ?? null,
    }));
  }

  // -------------------------------------------------------------------------
  // Place details incl. the review sample the API returns (max 5 per place).
  // -------------------------------------------------------------------------
  async placeReviews(placeId: string): Promise<{
    placeId: string;
    name: string;
    rating: number | null;
    userRatingsTotal: number | null;
    reviews: Array<{ author: string | null; rating: number | null; text: string; relativeTime: string | null }>;
    reviewsLimitedNote: string | null;
  }> {
    if (!/^[A-Za-z0-9_-]+$/.test(placeId)) throw new BadRequestException('Invalid place id.');
    const data = await this.callPlaces<PlacesApiPlace>(`/places/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      query: { languageCode: 'en' },
      fieldMask: [
        'id',
        'displayName',
        'rating',
        'userRatingCount',
        'reviews',
      ],
    });
    const reviews = (data.reviews ?? [])
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? null,
        rating: r.rating ?? null,
        text: r.text?.text ?? r.originalText?.text ?? '',
        relativeTime: r.relativePublishTimeDescription ?? null,
      }))
      .filter((r) => r.text.trim().length > 0);
    const total = data.userRatingCount ?? 0;
    return {
      placeId,
      name: data.displayName?.text ?? placeId,
      rating: data.rating ?? null,
      userRatingsTotal: total,
      reviews,
      reviewsLimitedNote:
        total > reviews.length
          ? `This place has ${total} reviews on Google; the Places API returned a sample of ${reviews.length}. Insights below are based only on that available sample.`
          : null,
    };
  }

  // -------------------------------------------------------------------------
  // Nearby resources (offices, colleges, transit, ...) for location analysis.
  // -------------------------------------------------------------------------
  async nearbyResources(lat: number, lng: number, radiusMeters: number): Promise<ResourceCategoryDto[]> {
    const searches: Array<{ label: string; types: string[] }> = [
      { label: 'Offices & workplaces', types: ['corporate_office', 'office'] },
      { label: 'Education', types: ['university', 'college', 'school'] },
      { label: 'Hotels & stays', types: ['lodging', 'hotel'] },
      { label: 'Shopping & retail', types: ['shopping_mall', 'department_store', 'supermarket'] },
      { label: 'Transport hubs', types: ['transit_station', 'train_station', 'subway_station', 'bus_station', 'airport'] },
      { label: 'Parking', types: ['parking'] },
      { label: 'Complementary businesses', types: ['movie_theater', 'tourist_attraction', 'gym', 'hospital'] },
    ];
    const out: ResourceCategoryDto[] = [];
    for (const s of searches) {
      try {
        const data = await this.callPlaces<{ places?: PlacesApiPlace[] }>('/places:searchNearby', {
          method: 'POST',
          fieldMask: ['places.id', 'places.displayName', 'places.formattedAddress', 'places.location'],
          body: {
            includedTypes: s.types,
            maxResultCount: 20,
            locationRestriction: {
              circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(50_000, Math.max(100, radiusMeters)) },
            },
          },
        });
        const places = data.places ?? [];
        if (places.length > 0) {
          out.push({
            category: s.label,
            count: places.length,
            examples: places.slice(0, 3).map((p) => ({
              name: p.displayName?.text ?? 'Unknown',
              vicinity: p.formattedAddress ?? null,
            })),
          });
        }
      } catch (err) {
        if (err instanceof PlacesApiError && err.status === 429) throw err;
        // Individual resource searches failing should not kill the whole report.
      }
    }
    return out;
  }
}

export interface CompetitorDto {
  placeId: string;
  name: string;
  address: string | null;
  location: { lat: number; lng: number };
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  category: string | null;
  openNow: boolean | null;
  distanceMeters: number | null;
  websiteUri: string | null;
  phone: string | null;
  mapsUri: string | null;
  businessStatus: string | null;
}

export interface ResourceCategoryDto {
  category: string;
  count: number;
  examples: Array<{ name: string; vicinity: string | null }>;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
