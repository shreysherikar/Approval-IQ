import test from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicExtractionProvider } from '../src/index.ts';

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
