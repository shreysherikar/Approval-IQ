/**
 * @approvaliq/storage — the storage seam between object storage and the app.
 *
 * See ADR 0002, Decision #1: a `local` filesystem adapter behind a
 * StorageProvider interface, with `s3` stubbed to throw "not configured". All
 * reads go through an authorized download endpoint — there is no static file
 * mount and no directly-fetchable URL for a storageKey.
 */
export { StorageProvider, newStorageKey } from './storage-provider.ts';
export type { StorageProviderName, StoragePutResult } from './storage-provider.ts';
export { LocalStorageProvider } from './local-storage-provider.ts';
export { S3StorageProvider } from './s3-storage-provider.ts';