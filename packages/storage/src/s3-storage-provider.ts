import { StorageProvider } from './storage-provider.ts';
import type { StorageProviderName, StoragePutResult } from './storage-provider.ts';

/**
 * S3 storage provider — STUB ONLY.
 *
 * The interface boundary exists so the rest of the app never thinks about which
 * backend it is on, but S3 is NOT implemented (Phase 15 Terraform/AWS work).
 * Selecting it throws a clear error instead of pretending the support exists.
 */
export class S3StorageProvider extends StorageProvider {
  readonly name: StorageProviderName = 's3';

  private static readonly NOT_CONFIGURED =
    'S3 storage provider is not configured — Phase 15. Set STORAGE_PROVIDER=local ' +
    '(the only implemented provider) or build the S3 adapter in Phase 15.';

  async put(_projectId: string, _key: string, _buffer: Buffer): Promise<StoragePutResult> {
    throw new Error(S3StorageProvider.NOT_CONFIGURED);
  }

  async get(_storageKey: string): Promise<Buffer> {
    throw new Error(S3StorageProvider.NOT_CONFIGURED);
  }
}