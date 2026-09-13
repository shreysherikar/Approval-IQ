import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MockExtractionProvider } from '../src/index.ts';

test('mock provider: unknown stays unknown, never guessed', async () => {
  const p = new MockExtractionProvider();
  const buf = Buffer.from('some random doc with no fixture');
  const out = await p.extract(buf, 'application/pdf');
  assert.equal(out.modelProvider, 'mock');
  assert.equal(out.promptVersion, 'n/a');
  assert.ok(out.fields.length > 0);
  for (const f of out.fields) {
    assert.equal(f.value, 'unknown');
    assert.equal(f.confidence, 0);
  }
});

test('mock provider: fixture fills known fields, rest stay unknown', async () => {
  const p = new MockExtractionProvider();
  const buf = Buffer.from('hello fixture');
  const hash = createHash('sha256').update(buf).digest('hex');
  p.registerFixture(hash, {
    entityName: { value: 'Pune Brewing Co.', confidence: 0.9, evidenceLocation: 'p1' },
  });
  const out = await p.extract(buf, 'application/pdf');
  const entity = out.fields.find((f) => f.name === 'entityName');
  assert.equal(entity?.value, 'Pune Brewing Co.');
  const expiry = out.fields.find((f) => f.name === 'expiryDate');
  assert.equal(expiry?.value, 'unknown');
});

test('mock provider: corrupt and transient errors are distinct', async () => {
  const p = new MockExtractionProvider();
  await assert.rejects(() => p.extract(Buffer.from('x __CORRUPT__ y'), 'application/pdf'), /UnreadableDocumentError/);
  await assert.rejects(() => p.extract(Buffer.from('x __TRANSIENT_FAIL__ y'), 'application/pdf'), /TransientExtractionError/);
  await assert.rejects(() => p.extract(Buffer.from(''), 'application/pdf'), /UnreadableDocumentError/);
});
