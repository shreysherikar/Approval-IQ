import type { ExtractionProvider } from './types.ts';

/**
 * AnthropicExtractionProvider — STUB ONLY, not wired to real calls.
 * `extract()` always throws "not enabled this sprint". This file is the ONLY
 * one allowed to reference the Anthropic SDK, and nothing imports it by
 * default — the boundary exists so the switch can be flipped later.
 */
export class AnthropicExtractionProvider implements ExtractionProvider {
  readonly providerName = 'anthropic';
  async extract(): Promise<never> {
    throw new Error('AnthropicExtractionProvider: not enabled this sprint');
  }
}
