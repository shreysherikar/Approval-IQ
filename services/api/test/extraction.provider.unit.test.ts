import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { ExtractionHandler, REALISTIC_DEMO_TRADE_LICENCE_TEXT } from '../src/jobs/extraction.handler';
import { AnthropicExtractionProvider, toExtractionOutput, compare, DEFAULT_AREA_TOLERANCE_PCT } from '@approvaliq/document-engine';

describe('Feature #5: Document Extraction Provider Configuration & Validation', () => {
  it('defaults to mock provider and extracts realistic trade licence fixture', async () => {
    const config = new ConfigService({
      LLM_PROVIDER: 'mock',
    });

    // Mock dependencies: ExtractionHandler only needs config for runProvider
    const handler = new ExtractionHandler({} as never, {} as never, config);
    const runProvider = (handler as unknown as {
      runProvider: (name: string, buffer: Buffer, mimeType: string) => Promise<{
        fields: Array<{ name: string; value: string }>;
        modelProvider: string;
      }>;
    }).runProvider.bind(handler);

    const buffer = Buffer.from(REALISTIC_DEMO_TRADE_LICENCE_TEXT, 'utf8');
    const result = await runProvider('mock', buffer, 'text/plain');

    assert.equal(result.modelProvider, 'mock');
    const docType = result.fields.find((f) => f.name === 'documentType');
    assert.equal(docType?.value, 'trade_licence');
    const area = result.fields.find((f) => f.name === 'area');
    assert.equal(area?.value, '5000');
    const jurisdiction = result.fields.find((f) => f.name === 'jurisdiction');
    assert.equal(jurisdiction?.value, 'Maharashtra');
  });

  it('fails fast when LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY is missing', async () => {
    const config = new ConfigService({
      LLM_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: '',
    });

    const handler = new ExtractionHandler({} as never, {} as never, config);
    const runProvider = (handler as unknown as {
      runProvider: (name: string, buffer: Buffer, mimeType: string) => Promise<unknown>;
    }).runProvider.bind(handler);

    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await assert.rejects(
        () => runProvider('anthropic', Buffer.from('sample doc'), 'text/plain'),
        /ANTHROPIC_API_KEY is not set/,
      );
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it('falls back gracefully to mock provider when LLM_FALLBACK_TO_MOCK=true', async () => {
    const config = new ConfigService({
      LLM_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: '',
      LLM_FALLBACK_TO_MOCK: 'true',
    });

    const handler = new ExtractionHandler({} as never, {} as never, config);
    const runProvider = (handler as unknown as {
      runProvider: (name: string, buffer: Buffer, mimeType: string) => Promise<{
        fields: Array<{ name: string; value: string }>;
        modelProvider: string;
      }>;
    }).runProvider.bind(handler);

    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const buffer = Buffer.from(REALISTIC_DEMO_TRADE_LICENCE_TEXT, 'utf8');
      const result = await runProvider('anthropic', buffer, 'text/plain');
      // Gracefully fell back to mock provider
      assert.equal(result.modelProvider, 'mock');
      assert.equal(result.fields.find((f) => f.name === 'area')?.value, '5000');
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it('supports Anthropic provider constructor options and parses real LLM response structure', () => {
    const provider = new AnthropicExtractionProvider({
      apiKey: 'test-anthropic-key',
      model: 'claude-sonnet-4-5-20250929',
    });
    assert.equal(provider.providerName, 'anthropic');

    const fakeApiResponse = {
      content: [
        {
          type: 'text' as const,
          text: `Here is the extracted document data:
\`\`\`json
{
  "documentType": "trade_licence",
  "entityName": "Pune Brewing Co.",
  "issuingAuthority": "Pune Municipal Corporation",
  "documentNumber": "TL-2024-001",
  "area": "5000",
  "areaUnits": "sqft",
  "jurisdiction": "Maharashtra",
  "activityIndustry": "brewery"
}
\`\`\``,
        },
      ],
    };

    const output = toExtractionOutput(fakeApiResponse, 'claude-sonnet-4-5-20250929');
    assert.equal(output.modelProvider, 'anthropic');
    assert.equal(output.modelVersion, 'claude-sonnet-4-5-20250929');
    assert.equal(output.promptVersion, 'anthropic-json-v1');

    const areaField = output.fields.find((f) => f.name === 'area');
    assert.equal(areaField?.value, '5000');

    // Feeds directly into the consistency check comparator
    const outcome = compare(
      { status: 'known', value: 6000 },
      { status: 'known', value: 5000 },
      'numeric_tolerance',
      { tolerancePct: DEFAULT_AREA_TOLERANCE_PCT },
    );
    assert.equal(outcome, 'mismatch', 'Deliberate area mismatch verified');
  });
});
