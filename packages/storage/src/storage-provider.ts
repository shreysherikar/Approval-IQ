import { randomUUID } from 'node:crypto';

/**
 * A provider name. Env var STORAGE_PROVIDER selects between `local` (the only
 * implementation today) and `s3` (stubbed — Phase 15).
 */
export type StorageProviderName = 'local' | 's3';

/** Result of a successful write. */
export interface StoragePutResult {
  /**
   * Opaque key used later with {@link StorageProvider.get}. It is deliberately
   * NOT a directly-fetchable URL: no `/static/uploads/...` mount exists, so a
   * raw key cannot be used to bypass authorization. All reads must go through
   * the authorized download endpoint.
   */
  readonly storageKey: string;
}

/**
 * StorageProvider — the thin seam between object storage and the rest of the
 * app (defined as an abstract class, not an interface, so it can be used
 * directly as a NestJS dependency-injection token).
 *
 * Contract notes:
 *  - `storageKey` is opaque and MUST NOT be handed out to clients as a URL.
 *    A raw static path would bypass the object-level authorization check: anyone
 *    who obtains the key (a shared link, browser history, a referrer header)
 *    could fetch the file with no auth at all.
 *  - There is deliberately NO delete method. Original files are never deleted at
 *    the storage layer — superseding a document happens at the
 *    Document/DocumentVersion layer (an old version is marked "superseded",
 *    its byte blob is retained).
 *  - When the S3 adapter lands (Phase 15), the download endpoint will generate
 *    a short-lived presigned URL ONLY AFTER the auth check passes. The
 *    presigned URL is never handed out before authorization is confirmed.
 */
export abstract class StorageProvider {
  abstract readonly name: StorageProviderName;

  /**
   * Writes `buffer` and returns an opaque storageKey.
   *
   * `projectId` classifies the write into a per-project namespace so bytes from
   * different projects are physically separated on disk / in the bucket.
   * `key` is an opaque, caller-chosen logical id (the DocumentVersion id); the
   * caller must generate a fresh, unguessable one per write.
   */
  abstract put(projectId: string, key: string, buffer: Buffer): Promise<StoragePutResult>;

  /** Reads the bytes previously written for `storageKey`. */
  abstract get(storageKey: string): Promise<Buffer>;
}

/** Generates a fresh, unguessable logical key (e.g. a UUID v4). */
export function newStorageKey(): string {
  return randomUUID();
}