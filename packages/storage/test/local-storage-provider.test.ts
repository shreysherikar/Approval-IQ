/**
 * Unit tests for @approvaliq/storage.
 *
 * Runs standalone with zero other services: `node --test test/local-storage-provider.test.ts`
 * (Node 22+ native TypeScript). Uses a throwaway temp dir as the storage root.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { LocalStorageProvider } from '../src/local-storage-provider.ts';
import { S3StorageProvider } from '../src/s3-storage-provider.ts';

/** Each test gets its own temp dir so runs are isolated. */
let root: string;
beforeEach(async () => {
  root = await mkdtemp('approvaliq-storage-');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test('put returns an opaque storageKey and get round-trips the bytes', async () => {
  const provider = new LocalStorageProvider(root);
  const bytes = Buffer.from('hello world');
  const { storageKey } = await provider.put('proj-1', 'version-1', bytes);

  assert.match(storageKey, /^proj-1\/[^/]+\.blob$/, 'storageKey is a per-project opaque key');
  const roundTripped = await provider.get(storageKey);
  assert.ok(roundTripped.equals(bytes), 'get returns the same bytes that were put');
});

test('projects are written to separate subdirectories', async () => {
  const provider = new LocalStorageProvider(root);
  await provider.put('proj-1', 'v1', Buffer.from('a'));
  await provider.put('proj-2', 'v1', Buffer.from('b'));

  const a = await provider.get('proj-1/v1.blob');
  assert.equal(a.toString(), 'a');
  const b = await provider.get('proj-2/v1.blob');
  assert.equal(b.toString(), 'b');
});

test('get refuses storageKeys that would escape the root (path traversal)', async () => {
  const provider = new LocalStorageProvider(root);
  await provider.put('proj-1', 'v1', Buffer.from('secret'));

  for (const evil of [
    '../outside.blob',
    '..%2Foutside.blob',
    'proj-1/../../etc/passwd',
    'proj-1/../proj-2/v1.blob',
  ]) {
    await assert.rejects(provider.get(evil), undefined, `get(${evil}) must be rejected`);
  }
  // The sibling project is still reachable by its correct relative key, but a
  // traversal that points at another project's file via ".." must not resolve.
  const legit = await provider.get('proj-1/v1.blob');
  assert.equal(legit.toString(), 'secret');
});

test('put rejects segments with separators or dot segments', async () => {
  const provider = new LocalStorageProvider(root);
  await assert.rejects(
    provider.put('../evil', 'v1', Buffer.from('x')),
    undefined,
    'projectId must not traverse',
  );
  await assert.rejects(
    provider.put('proj-1', 'a/b', Buffer.from('x')),
    undefined,
    'key must not contain separators',
  );
  await assert.rejects(
    provider.put('proj-1', '..', Buffer.from('x')),
    undefined,
    'key must not be a dot segment',
  );
});

test('s3 provider is a stub that throws "not configured — Phase 15"', async () => {
  const provider = new S3StorageProvider();
  await assert.rejects(provider.put('p', 'k', Buffer.from('x')), (err: Error) =>
    err.message.includes('not configured') && err.message.includes('Phase 15'),
  );
  await assert.rejects(provider.get('p/k'), (err: Error) =>
    err.message.includes('not configured') && err.message.includes('Phase 15'),
  );
});

test('local provider rejects an empty storage root', async () => {
  assert.throws(() => new LocalStorageProvider(''), /non-empty path/);
});

test('storage keys with a missing root still resolve safely (absolute root)', async () => {
  // sanity: a project id that is a valid uuid is not treated as an absolute path
  const provider = new LocalStorageProvider(join(root, 'nested', 'root'));
  const { storageKey } = await provider.put('proj-1', 'v1', Buffer.from('x'));
  assert.ok((await provider.get(storageKey)).equals(Buffer.from('x')));
});