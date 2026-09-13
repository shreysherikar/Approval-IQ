import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, normalize, resolve, sep } from 'node:path';
import { StorageProvider } from './storage-provider.ts';
import type { StorageProviderName, StoragePutResult } from './storage-provider.ts';

/**
 * Filesystem-backed storage provider (the only implementation today).
 *
 * Layout: files are written under `<root>/<projectId>/<key>.blob`, giving each
 * project its own subdirectory. The returned storageKey is the relative path
 * `<projectId>/<key>.blob`, which is opaque to clients and never served as a
 * static URL.
 *
 * Security: {@link get} resolves the storageKey against the configured root and
 * refuses any key that would escape the root (path traversal). The application
 * layer is still responsible for the object-level *authorization* check — this
 * class only guarantees bytes stay inside the storage root.
 */
export class LocalStorageProvider extends StorageProvider {
  readonly name: StorageProviderName = 'local';

  private readonly root: string;

  constructor(root: string) {
    super();
    if (typeof root !== 'string' || root.length === 0) {
      throw new Error(`STORAGE_LOCAL_PATH must be a non-empty path, got: ${root}`);
    }
    this.root = resolve(normalize(root));
  }

  async put(projectId: string, key: string, buffer: Buffer): Promise<StoragePutResult> {
    this.assertPathSegment(projectId);
    this.assertPathSegment(key);

    const storageKey = this.toStorageKey(projectId, key);
    await mkdir(join(this.root, projectId), { recursive: true });
    await writeFile(this.resolveUnderRoot(storageKey), buffer);
    return { storageKey };
  }

  async get(storageKey: string): Promise<Buffer> {
    // resolveUnderRoot both prevents traversal and validates the key syntax.
    return readFile(this.resolveUnderRoot(storageKey));
  }

  /** Rejects a path segment that could corrupt the layout or traverse. */
  private assertPathSegment(segment: string): void {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      throw new Error(`Invalid storage path segment: "${segment}"`);
    }
    if (segment.includes('/') || segment.includes('\\')) {
      throw new Error(`Storage path segment must not contain separators: "${segment}"`);
    }
  }

  /** `<projectId>/<key>.blob` — always forward slashes, OS-portable. */
  private toStorageKey(projectId: string, key: string): string {
    return `${projectId}/${key}.blob`;
  }

  /**
   * Maps an (assumed relative) storageKey to an absolute path that is
   * guaranteed to live under the configured root.
   */
  private resolveUnderRoot(storageKey: string): string {
    const candidate = resolve(this.root, storageKey);
    const rootWithSep = this.root.endsWith(sep) ? this.root : `${this.root}${sep}`;
    if (candidate !== this.root && !candidate.startsWith(rootWithSep)) {
      throw new Error(`storageKey escapes storage root: "${storageKey}"`);
    }
    return candidate;
  }
}