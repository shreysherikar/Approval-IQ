import test from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicExtractionProvider } from '../src/index.ts';

test('anthropic stub throws not-enabled and is never wired by default', async () => {
  const p = new AnthropicExtractionProvider();
  await assert.rejects(() => p.extract(), /not enabled this sprint/);
});
