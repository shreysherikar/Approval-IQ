import { Injectable } from '@nestjs/common';
import type { CompetitorDto } from './market-places.service';

/**
 * Feature 2 — Review/theme analysis + market-wide snapshot + gaps +
 * recommendations. Every insight is derived ONLY from the review texts the
 * Places API actually returned; when evidence is missing the analysis says so
 * ("Insufficient review evidence") instead of inventing it.
 */

export interface ThemeMentionDto {
  theme: string;
  count: number;
  kind: 'positive' | 'negative' | 'neutral';
  evidence: string[];
}

export interface CompetitorAnalysisDto {
  placeId: string;
  name: string;
  overallRating: number | null;
  reviewVolume: number | null;
  positiveThemes: ThemeMentionDto[];
  negativeThemes: ThemeMentionDto[];
  experienceThemes: string[];
  observation: string | null;
  insufficientData: boolean;
  reviewsAnalyzed: number;
  scopeNote: string;
}

export interface MarketGapDto {
  gap: string;
  evidence: string;
  relatedComplaints: number;
}

export interface MarketSnapshotDto {
  competitorsFound: number;
  averageRating: number | null;
  averageReviewVolume: number | null;
  frequentlyPraised: ThemeMentionDto[];
  frequentlyComplained: ThemeMentionDto[];
  potentialGaps: MarketGapDto[];
}

export interface RecommendationDto {
  observation: string;
  recommendation: string;
}

export interface MarketAnalysisDto {
  snapshot: MarketSnapshotDto;
  recommendations: RecommendationDto[];
  nextSteps: string[];
}

/** Recurring review themes: keyword groups per theme (English review text). */
const THEME_RULES: Array<{
  theme: string;
  positive: string[];
  negative: string[];
}> = [
  {
    theme: 'Food Quality & Taste',
    positive: ['delicious', 'tasty', 'great food', 'amazing food', 'food was', 'flavour', 'flavor', 'fresh', 'yummy', 'best food'],
    negative: ['bland', 'stale', 'cold food', 'raw', 'undercooked', 'tasteless', 'bad food', 'worse', 'food was cold', 'not fresh'],
  },
  {
    theme: 'Hygiene',
    positive: ['clean', 'hygienic', 'spotless', 'tidy'],
    negative: ['dirty', 'unclean', 'unhygienic', 'cockroach', 'pest', 'smell', 'filthy', 'hair in'],
  },
  {
    theme: 'Service & Staff',
    positive: ['friendly', 'attentive', 'great service', 'staff was', 'polite', 'helpful', 'hospitable', 'quick service'],
    negative: ['rude', 'slow service', 'ignor', 'unfriendly', 'arrogant', 'no response', 'staff behaviour', 'worst service', 'poor service', 'never came'],
  },
  {
    theme: 'Pricing & Value',
    positive: ['reasonable', 'value for money', 'affordable', 'worth the price', 'fair price', 'cheap'],
    negative: ['overpriced', 'expensive', 'costly', 'not worth', 'rip off', 'pricey'],
  },
  {
    theme: 'Ambience',
    positive: ['ambience', 'cosy', 'cozy', 'decor', 'atmosphere', 'vibe', 'aesthetic', 'beautiful place'],
    negative: ['cramped', 'noisy', 'loud', 'shabby', 'dated', 'smelly'],
  },
  {
    theme: 'Waiting Time',
    positive: ['no wait', 'seated immediately', 'quick'],
    negative: ['wait', 'waiting', 'queue', 'long time', 'delay', 'took forever', 'slow'],
  },
  {
    theme: 'Parking',
    positive: ['parking available', 'easy parking', 'valet'],
    negative: ['no parking', 'parking problem', 'parking issue', 'hard to park', 'parking is a nightmare'],
  },
  {
    theme: 'Location & Accessibility',
    positive: ['easy to find', 'well located', 'great location', 'prime location'],
    negative: ['hard to find', 'traffic', 'crowded area', 'difficult to reach'],
  },
  {
    theme: 'Delivery',
    positive: ['fast delivery', 'delivered hot', 'packaging was good'],
    negative: ['late delivery', 'delivery', 'cold on arrival', 'spilled'],
  },
  {
    theme: 'Portion Size',
    positive: ['generous portion', 'good portion', 'filling', 'large portion'],
    negative: ['small portion', 'portion size', 'skimpy', 'less quantity', 'quantity is less'],
  },
  {
    theme: 'Menu Variety',
    positive: ['varied menu', 'lots of options', 'wide range', 'extensive menu', 'many choices'],
    negative: ['limited menu', 'few options', 'nothing for', 'no variety', 'options were limited'],
  },
];

function lower(t: string): string {
  return t.toLowerCase();
}

/** Counts positive/negative theme mentions across review texts with evidence. */
function extractThemes(reviews: Array<{ text: string; rating: number | null }>): {
  positive: ThemeMentionDto[];
  negative: ThemeMentionDto[];
  experienceThemes: string[];
} {
  const posHits = new Map<string, ThemeMentionDto>();
  const negHits = new Map<string, ThemeMentionDto>();
  for (const rule of THEME_RULES) {
    posHits.set(rule.theme, { theme: rule.theme, count: 0, kind: 'positive', evidence: [] });
    negHits.set(rule.theme, { theme: rule.theme, count: 0, kind: 'negative', evidence: [] });
  }
  for (const r of reviews) {
    const text = lower(r.text);
    for (const rule of THEME_RULES) {
      const hasPos = rule.positive.some((kw) => text.includes(kw));
      const hasNeg = rule.negative.some((kw) => text.includes(kw));
      // A review mentioning both sides of a theme counts the sentiment the
      // review's own rating leans toward (or negative when unrated).
      if (hasPos && hasNeg) {
        const leansNegative = r.rating !== null ? r.rating <= 3 : true;
        const target = leansNegative ? negHits : posHits;
        const entry = target.get(rule.theme);
        if (entry) {
          entry.count += 1;
          if (entry.evidence.length < 2) entry.evidence.push(r.text.slice(0, 140));
        }
      } else if (hasPos) {
        const entry = posHits.get(rule.theme);
        if (entry) {
          entry.count += 1;
          if (entry.evidence.length < 2) entry.evidence.push(r.text.slice(0, 140));
        }
      } else if (hasNeg) {
        const entry = negHits.get(rule.theme);
        if (entry) {
          entry.count += 1;
          if (entry.evidence.length < 2) entry.evidence.push(r.text.slice(0, 140));
        }
      }
    }
  }
  const positive = [...posHits.values()].filter((t) => t.count > 0).sort((a, b) => b.count - a.count);
  const negative = [...negHits.values()].filter((t) => t.count > 0).sort((a, b) => b.count - a.count);
  const experienceThemes = [...positive, ...negative]
    .slice(0, 8)
    .map((t) => `${t.theme} (${t.kind === 'positive' ? 'mostly praised' : 'flagged in complaints'} · ${t.count} mention${t.count > 1 ? 's' : ''})`);
  return { positive, negative, experienceThemes };
}

@Injectable()
export class MarketAnalysisService {
  /** Per-competitor review analysis over the API-returned review sample. */
  analyzeCompetitor(
    competitor: { placeId: string; name: string; rating: number | null; userRatingsTotal: number | null },
    reviews: Array<{ author: string | null; rating: number | null; text: string; relativeTime: string | null }>,
    reviewsLimitedNote: string | null,
  ): CompetitorAnalysisDto {
    const cleaned = reviews.filter((r) => r.text.trim().length > 0);
    if (cleaned.length < 2) {
      return {
        placeId: competitor.placeId,
        name: competitor.name,
        overallRating: competitor.rating,
        reviewVolume: competitor.userRatingsTotal,
        positiveThemes: [],
        negativeThemes: [],
        experienceThemes: [],
        observation: null,
        insufficientData: true,
        reviewsAnalyzed: cleaned.length,
        scopeNote:
          reviewsLimitedNote ??
          'Insufficient review evidence — the available review data through the connected source is too small to analyze themes.',
      };
    }
    const { positive, negative, experienceThemes } = extractThemes(cleaned);
    const avg = competitor.rating;
    let observation: string | null = null;
    if (negative.length > 0 && negative[0] && negative[0].count >= 2) {
      observation = `The dominant complaint theme in the available review sample is "${negative[0].theme}" (${negative[0].count} of ${cleaned.length} sampled reviews). Addressing it may represent a differentiation opportunity based on recurring customer feedback.`;
    } else if (positive.length > 0 && positive[0] && avg !== null && avg >= 4.3) {
      observation = `The available review evidence is largely positive — "${positive[0].theme}" is the most-mentioned strength. Matching this standard would be table stakes; differentiation is more likely to come from competitors' complaints.`;
    } else if (positive.length === 0 && negative.length === 0) {
      observation = 'Reviews exist but no recurring themes were detected in the available sample — read the raw reviews before drawing conclusions.';
    }
    return {
      placeId: competitor.placeId,
      name: competitor.name,
      overallRating: competitor.rating,
      reviewVolume: competitor.userRatingsTotal,
      positiveThemes: positive,
      negativeThemes: negative,
      experienceThemes,
      observation,
      insufficientData: false,
      reviewsAnalyzed: cleaned.length,
      scopeNote:
        reviewsLimitedNote ??
        `Insights are based on the customer review data available through the connected source (${cleaned.length} reviews analyzed).`,
    };
  }

  /**
   * Market-wide snapshot: aggregates theme mentions across every analyzed
   * competitor and derives potential gaps from recurring complaints, using
   * evidence-based language only.
   */
  marketSnapshot(competitors: CompetitorDto[], analyses: CompetitorAnalysisDto[]): MarketAnalysisDto {
    const rated = competitors.filter((c) => c.rating !== null);
    const averageRating =
      rated.length > 0 ? Math.round((rated.reduce((s, c) => s + (c.rating ?? 0), 0) / rated.length) * 100) / 100 : null;
    const withVolume = competitors.filter((c) => c.userRatingsTotal !== null);
    const averageReviewVolume =
      withVolume.length > 0
        ? Math.round(withVolume.reduce((s, c) => s + (c.userRatingsTotal ?? 0), 0) / withVolume.length)
        : null;

    // Aggregate complaint/positive counts across analyzed competitors.
    const complaintAgg = new Map<string, { count: number; competitors: Set<string>; evidence: string[] }>();
    const praiseAgg = new Map<string, { count: number; competitors: Set<string>; evidence: string[] }>();
    for (const a of analyses) {
      if (a.insufficientData) continue;
      for (const t of a.negativeThemes) {
        const e = complaintAgg.get(t.theme) ?? { count: 0, competitors: new Set<string>(), evidence: [] };
        e.count += t.count;
        e.competitors.add(a.name);
        for (const ev of t.evidence) if (e.evidence.length < 2) e.evidence.push(ev);
        complaintAgg.set(t.theme, e);
      }
      for (const t of a.positiveThemes) {
        const e = praiseAgg.get(t.theme) ?? { count: 0, competitors: new Set<string>(), evidence: [] };
        e.count += t.count;
        e.competitors.add(a.name);
        for (const ev of t.evidence) if (e.evidence.length < 2) e.evidence.push(ev);
        praiseAgg.set(t.theme, e);
      }
    }

    const toMentions = (m: Map<string, { count: number; competitors: Set<string>; evidence: string[] }>, kind: 'positive' | 'negative'): ThemeMentionDto[] =>
      [...m.entries()]
        .map(([theme, v]) => ({ theme, count: v.count, kind, evidence: v.evidence }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const frequentlyComplained = toMentions(complaintAgg, 'negative');
    const frequentlyPraised = toMentions(praiseAgg, 'positive');

    // Gap heuristics (evidence-based, hedged language):
    const potentialGaps: MarketGapDto[] = [];
    for (const c of frequentlyComplained) {
      const names = analyses.filter((a) => a.negativeThemes.some((t) => t.theme === c.theme)).map((a) => a.name);
      if (c.count >= 2 && names.length >= 2) {
        potentialGaps.push({
          gap: `${c.theme.toLowerCase()} may represent a potential differentiation opportunity based on recurring customer feedback across ${names.length} competitors.`,
          evidence: `Recurring complaint theme in the available review data: ${names.slice(0, 3).join(', ')}. ${c.evidence[0] ? `Example: "${c.evidence[0]}"` : ''}`.trim(),
          relatedComplaints: c.count,
        });
      }
    }
    // Low overall quality (avg rating < 3.9 with enough data) is itself a gap.
    if (averageRating !== null && averageRating < 3.9 && competitors.length >= 5) {
      potentialGaps.push({
        gap: 'The area’s average rating is below the typical “great” threshold — a consistently excellent operator may stand out, based on the available data.',
        evidence: `Average competitor rating is ${averageRating} across ${rated.length} rated places returned in the search area.`,
        relatedComplaints: competitors.filter((c) => (c.rating ?? 5) < 3.9).length,
      });
    }
    // Sparse review volume in a busy market can hint at an engagement gap.
    if (averageReviewVolume !== null && averageReviewVolume < 40 && competitors.length >= 8) {
      potentialGaps.push({
        gap: 'Competitors have low review engagement relative to their count — strong service plus review generation may be an underserved lever, based on the available data.',
        evidence: `Average review volume is ${averageReviewVolume} across ${competitors.length} places.`,
        relatedComplaints: 0,
      });
    }

    // Recommendations: observation → action, always paired.
    const recommendations: RecommendationDto[] = [];
    for (const gap of potentialGaps.slice(0, 4)) {
      const theme = gap.gap.split(' may represent')[0] ?? gap.gap;
      recommendations.push({
        observation: gap.evidence,
        recommendation: `Consider designing your operating plan around ${theme.toLowerCase()} — e.g. staff training, process checks, and customer feedback loops targeting that theme before launch.`,
      });
    }
    const topPraised = frequentlyPraised[0];
    if (topPraised) {
      recommendations.push({
        observation: `"${topPraised.theme}" is the most frequently praised theme across the analyzed competitors (${topPraised.count} mentions in the available sample).`,
        recommendation: `Treat ${topPraised.theme.toLowerCase()} as a baseline expectation — plan to meet this standard from day one rather than treating it as a differentiator.`,
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        observation: 'The available competitor data did not surface recurring complaint or praise themes.',
        recommendation: 'Gather first-hand evidence: visit the top competitors at peak hours and note service speed, hygiene and menu gaps before finalizing your positioning.',
      });
    }

    const nextSteps = [
      'Review the top competitors on the map and shortlist the 3 closest to your proposed location.',
      'Identify the recurring customer complaints above and confirm them with your own visits.',
      'Select 2–3 potential market gaps that match your strengths.',
      'Define your differentiation strategy around the selected gaps.',
      'Estimate your setup time and cost with the connected Time & Cost Prediction page.',
      'Validate your legal requirements in the existing Approval Roadmap for your project.',
      'Build the business plan around the identified opportunities and revisit this analysis quarterly.',
    ];

    return {
      snapshot: {
        competitorsFound: competitors.length,
        averageRating,
        averageReviewVolume,
        frequentlyPraised,
        frequentlyComplained,
        potentialGaps,
      },
      recommendations,
      nextSteps,
    };
  }
}
