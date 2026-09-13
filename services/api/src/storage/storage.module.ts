import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER, StorageProviderLike } from './storage.token';

/**
 * Provides the single StorageProvider for the app, selected by the
 * STORAGE_PROVIDER env var:
 *   - "local" (default) — filesystem adapter rooted at STORAGE_LOCAL_PATH.
 *   - "s3" — stub that throws "not configured — Phase 15" if selected.
 *
 * The concrete provider lives in @approvaliq/storage and is loaded with a
 * dynamic import so the API's compile never depends on that package's source
 * layout (same pattern as @approvaliq/contracts / @approvaliq/approval-engine).
 */
type StorageModuleType = {
  LocalStorageProvider: new (root: string) => StorageProviderLike;
  S3StorageProvider: new () => StorageProviderLike;
};

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<StorageProviderLike> => {
        const name = config.get<string>('STORAGE_PROVIDER') ?? 'local';
        const storage = (await import('@approvaliq/storage' as string)) as StorageModuleType;
        if (name === 's3') {
          return new storage.S3StorageProvider();
        }
        if (name !== 'local') {
          throw new Error(`Unknown STORAGE_PROVIDER: "${name}"`);
        }
        const root = config.get<string>('STORAGE_LOCAL_PATH') ?? './data/storage';
        return new storage.LocalStorageProvider(root);
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}