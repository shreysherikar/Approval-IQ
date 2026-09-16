import { BadRequestException, Body, Controller, Get, HttpException, Inject, Param, Post, Query, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  MarketIntelligenceService,
  PlacesApiError,
  type CompetitorDto,
  type ResourceCategoryDto,
} from './market-places.service';
import { MarketAnalysisService, type CompetitorAnalysisDto } from './market-analysis.service';

/**
 * Feature 2 — Resource & Competitor Intelligence endpoints.
 * All routes require a valid JWT (the analysis is a paid-API-backed feature,
 * so anonymous calls are rejected). No project scoping: market research is
 * user-level, not project-level.
 */
@ApiTags('market')
@Controller('market')
@UseGuards(JwtAuthGuard)
export class MarketController {
  constructor(
    @Inject(MarketIntelligenceService) private readonly places: MarketIntelligenceService,
    @Inject(MarketAnalysisService) private readonly analysis: MarketAnalysisService,
  ) {}

  /** GET /market/status — lets the UI distinguish "not configured" from errors. */
  @Get('status')
  @ApiOperation({ summary: 'Whether the Google Places integration is configured' })
  status(): { configured: boolean } {
    return { configured: this.places.configured };
  }

  @Get('locations')
  @ApiOperation({ summary: 'Location search (Google Places Text Search)' })
  async locations(
    @Query('q') q?: string,
  ): Promise<{ results: Array<{ placeId: string; name: string; address: string | null; location: { lat: number; lng: number } }> }> {
    try {
      return { results: await this.places.searchLocations(q ?? '') };
    } catch (err) {
      throw this.toHttp(err);
    }
  }

  /**
   * POST /market/analyze — competitors around a selected location for a
   * business type. Deliberately returns raw competitor data only; review
   * analysis is a separate per-place call so the UI stays responsive and
   * quota usage is bounded by what the user actually opens.
   */
  @Post('analyze')
  @ApiOperation({ summary: 'Nearby competitor discovery (Google Places Nearby Search)' })
  async analyze(
    @Body() body: { placeId?: string; locationName?: string; businessType?: string; lat?: number; lng?: number; radiusMeters?: number },
  ): Promise<{ location: { placeId: string; name: string; address: string | null; location: { lat: number; lng: number } }; competitors: CompetitorDto[] }> {
    const businessType = (body.businessType ?? '').trim();
    if (businessType.length === 0) {
      return this.toHttp(new PlacesApiError('businessType required', 400, 'Specify a business type (e.g. Restaurant).')) as never;
    }
    try {
      let location: { placeId: string; name: string; address: string | null; location: { lat: number; lng: number } } | null = null;
      if (typeof body.lat === 'number' && typeof body.lng === 'number' && Number.isFinite(body.lat) && Number.isFinite(body.lng)) {
        location = {
          placeId: body.placeId ?? '',
          name: body.locationName ?? `${body.lat}, ${body.lng}`,
          address: null,
          location: { lat: body.lat, lng: body.lng },
        };
      } else if (body.locationName && body.locationName.trim().length >= 2) {
        const results = await this.places.searchLocations(body.locationName);
        location = results[0] ?? null;
      }
      if (!location) {
        throw new PlacesApiError('location not resolved', 400, 'Could not resolve that location. Try searching again and picking a suggestion.');
      }
      const competitors = await this.places.nearbyCompetitors(
        location.location.lat,
        location.location.lng,
        businessType,
        typeof body.radiusMeters === 'number' ? body.radiusMeters : 1500,
      );
      return { location, competitors };
    } catch (err) {
      throw this.toHttp(err);
    }
  }

  /** POST /market/competitors/:placeId/reviews — the API-returned review sample, analyzed. */
  @Post('competitors/:placeId/reviews')
  @ApiOperation({ summary: 'Available review data for one place, with theme analysis' })
  async reviews(@Param('placeId') placeId: string): Promise<CompetitorAnalysisDto> {
    try {
      const raw = await this.places.placeReviews(placeId);
      return this.analysis.analyzeCompetitor(raw, raw.reviews, raw.reviewsLimitedNote);
    } catch (err) {
      throw this.toHttp(err);
    }
  }

  /** POST /market/resources — nearby complementary places for location analysis. */
  @Post('resources')
  @ApiOperation({ summary: 'Nearby resources (offices, colleges, transit, ...)' })
  async resources(
    @Body() body: { lat?: number; lng?: number; radiusMeters?: number },
  ): Promise<{ resources: ResourceCategoryDto[] }> {
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number' || !Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
      return { resources: [] };
    }
    try {
      return {
        resources: await this.places.nearbyResources(body.lat, body.lng, body.radiusMeters ?? 2000),
      };
    } catch (err) {
      throw this.toHttp(err);
    }
  }

  /** Maps Places API failures to honest HTTP errors (no fake fallback data). */
  private toHttp(err: unknown): Error {
    if (err instanceof PlacesApiError) {
      const status = err.status === 0 ? 502 : err.status;
      return new HttpException(err.userMessage, status);
    }
    if (err instanceof BadRequestException || err instanceof ServiceUnavailableException) {
      return err;
    }
    return new ServiceUnavailableException(
      'Market intelligence lookup failed. Please try again shortly — no fallback competitor data is shown by design.',
    );
  }
}
