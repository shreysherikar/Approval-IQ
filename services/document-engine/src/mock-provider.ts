import { createHash } from 'node:crypto';
import {
  EXTRACTION_FIELD_NAMES,
  TransientExtractionError,
  UnreadableDocumentError,
  unknownField,
  type ExtractedField,
  type ExtractionOutput,
  type ExtractionProvider,
} from './types.ts';

/**
 * MockExtractionProvider — deterministic, keyed by fileHash against a small
 * fixture map. The ONLY provider actually called this sprint: zero SDK
 * dependency, zero API cost.
 *
 * Fixture contract: fixtures map a sha256 fileHash to a partial field map.
 * Any field NOT in the fixture comes back explicit "unknown" (never guessed).
 */
export type MockFixtureFields = Record<string, { value: string; confidence: number; evidenceLocation?: string | null }>;

export class MockExtractionProvider implements ExtractionProvider {
  readonly providerName = 'mock';
  private fixtures = new Map<string, MockFixtureFields>();

  registerFixture(fileHash: string, fields: MockFixtureFields): void {
    this.fixtures.set(fileHash, fields);
  }

  clearFixtures(): void {
    this.fixtures.clear();
  }

  async extract(fileBuffer: Buffer, _mimeType: string): Promise<ExtractionOutput> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new UnreadableDocumentError('Empty file: nothing to extract');
    }
    if (fileBuffer.toString('utf8').includes('__TRANSIENT_FAIL__')) {
      throw new TransientExtractionError('Simulated transient provider failure');
    }
    if (fileBuffer.toString('utf8').includes('__CORRUPT__')) {
      throw new UnreadableDocumentError('Simulated unreadable/corrupt file');
    }
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    const fixture = this.fixtures.get(hash);
    const fields: ExtractedField[] = EXTRACTION_FIELD_NAMES.map((name) => {
      const hit = fixture?.[name];
      if (hit) {
        return {
          name,
          value: hit.value,
          confidence: hit.confidence,
          evidenceLocation: hit.evidenceLocation ?? null,
        };
      }
      return unknownField(name);
    });
    return {
      fields,
      modelProvider: 'mock',
      modelVersion: 'mock-1.0.0',
      promptVersion: 'n/a',
      extractedAt: new Date().toISOString(),
    };
  }
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
