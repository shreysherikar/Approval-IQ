import test from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicExtractionProvider, toExtractionOutput } from '../src/index.ts';

test('anthropic adapter requires file args (interface) and fails fast without a key', async () => {
  const p = new AnthropicExtractionProvider();
  assert.equal(p.providerName, 'anthropic');
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(
      () => p.extract(Buffer.from('hello'), 'text/plain'),
      /ANTHROPIC_API_KEY is not set/,
    );
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test('anthropic adapter accepts constructor options', () => {
  const p = new AnthropicExtractionProvider({ apiKey: 'test-key', model: 'test-model' });
  assert.equal(p.providerName, 'anthropic');
});

test('toExtractionOutput parses json inside markdown fences and sets unknowns with 0 confidence', () => {
  const mockResponse = {
    content: [
      {
        type: 'text' as const,
        text: 'Here is the extracted data:\n```json\n{"documentType": "trade_licence", "entityName": "Pune Brewing Co.", "area": 5000, "jurisdiction": "Maharashtra"}\n```',
      },
    ],
  };
  const out = toExtractionOutput(mockResponse, 'claude-sonnet-4-5-20250929');
  assert.equal(out.modelProvider, 'anthropic');
  assert.equal(out.modelVersion, 'claude-sonnet-4-5-20250929');
  assert.equal(out.promptVersion, 'anthropic-json-v1');
  assert.equal(out.fields.find((f) => f.name === 'documentType')?.value, 'trade_licence');
  assert.equal(out.fields.find((f) => f.name === 'entityName')?.value, 'Pune Brewing Co.');
  assert.equal(out.fields.find((f) => f.name === 'area')?.value, '5000');
  assert.equal(out.fields.find((f) => f.name === 'jurisdiction')?.value, 'Maharashtra');
  const expiry = out.fields.find((f) => f.name === 'expiryDate');
  assert.equal(expiry?.value, 'unknown');
  assert.equal(expiry?.confidence, 0);
});

test('toExtractionOutput parses unfenced JSON with preambles and structured field objects', () => {
  const structuredResponse = {
    content: [
      {
        type: 'text' as const,
        text: 'Analysis result: {"documentType": {"value": "trade_licence", "confidence": 0.98, "evidenceLocation": "page 1, top"}, "area": {"value": "5000", "confidence": 0.92, "evidenceLocation": "schedule A"}}',
      },
    ],
  };
  const out = toExtractionOutput(structuredResponse, 'claude-sonnet-4-5-20250929');
  const docType = out.fields.find((f) => f.name === 'documentType');
  assert.equal(docType?.value, 'trade_licence');
  assert.equal(docType?.confidence, 0.98);
  assert.equal(docType?.evidenceLocation, 'page 1, top');

  const area = out.fields.find((f) => f.name === 'area');
  assert.equal(area?.value, '5000');
  assert.equal(area?.confidence, 0.92);
  assert.equal(area?.evidenceLocation, 'schedule A');

  const unmentioned = out.fields.find((f) => f.name === 'documentNumber');
  assert.equal(unmentioned?.value, 'unknown');
  assert.equal(unmentioned?.confidence, 0);
});
