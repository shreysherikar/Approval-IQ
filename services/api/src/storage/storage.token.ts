/**
 * DI token + the small structural type the API relies on from the storage
 * package. @approvaliq/storage is loaded via dynamic import (so its
 * `.ts`-extension internal imports never leak into the API's compile — same
 * convention as @approvaliq/contracts / @approvaliq/approval-engine), so the
 * injection token is a Symbol and the compile-time dependency is this interface.
 */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

/** Structural shape of the runtime StorageProvider (put/get). */
export interface StorageProviderLike {
  readonly name: 'local' | 's3';
  put(projectId: string, key: string, buffer: Buffer): Promise<{ storageKey: string }>;
  get(storageKey: string): Promise<Buffer>;
}