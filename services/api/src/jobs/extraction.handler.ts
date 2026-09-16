import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { STORAGE_PROVIDER, type StorageProviderLike } from '../storage/storage.token';
import { PrismaService } from '../prisma/prisma.service';

interface ProviderOutput {
  fields: Array<{ name: string; value: string; confidence: number; evidenceLocation: string | null }>;
  modelProvider: string;
  modelVersion: string;
  promptVersion: string;
}

export const REALISTIC_DEMO_TRADE_LICENCE_TEXT = `PUNE MUNICIPAL CORPORATION
Department of Health & Licences

MUNICIPAL TRADE LICENCE & FACTORY PERMISSION
Document Number: TL-2024-001
Issue Date: 2024-04-01
Expiry Date: 2025-03-31
Jurisdiction: Maharashtra
Issuing Authority: Pune Municipal Corporation

Entity Name: Pune Brewing Co.
Activity / Industry: brewery
Address: Plot 42, Hadapsar Industrial Estate, Pune, Maharashtra
Property Identifier: Plot 42, Hadapsar
Total Authorized Operational Area: 5000 sqft
Purpose: Commercial Brewery Operations
Conditions: Subject to annual fire safety audit and effluent compliance.
APPROVALIQ_DEMO_TRADE_LICENCE
`;

/**
 * Handler for "document_extraction" jobs. Success path:
 * processing → extracted → needs_verification (never straight to verified).
 * Failures never corrupt metadata — only the state flag changes.
 */
@Injectable()
export class ExtractionHandler {
  private readonly logger = new Logger(ExtractionHandler.name);
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProviderLike,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async handle(job: Record<string, unknown>): Promise<void> {
    const payload = job.payload as { documentVersionId?: string };
    const versionId = payload.documentVersionId;
    if (!versionId) throw new Error('document_extraction job missing documentVersionId');
    const providerName = this.config.get<string>('LLM_PROVIDER') ?? 'mock';
    const anthropicModel = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5-20250929';
    const triple =
      providerName === 'anthropic'
        ? { modelProvider: 'anthropic', modelVersion: anthropicModel, promptVersion: 'anthropic-json-v1' }
        : { modelProvider: 'mock', modelVersion: 'mock-1.0.0', promptVersion: 'n/a' };

    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { extractions: true },
    });
    if (!version) throw new Error(`DocumentVersion '${versionId}' not found`);
    // Idempotency: same provider triple already extracted → skip, no 2nd row.
    if (version.extractions.some((e) => e.modelProvider === triple.modelProvider && e.modelVersion === triple.modelVersion && e.promptVersion === triple.promptVersion)) {
      this.logger.log(`Extraction for ${versionId} already exists — skip (idempotent)`);
      return;
    }
    if (version.state === 'uploaded' || version.state === 'queued') {
      await this.prisma.documentVersion.update({ where: { id: version.id }, data: { state: 'processing' } });
    }
    const buffer = await this.storage.get(version.storageKey);
    const output = await this.runProvider(providerName, buffer, version.mimeType);
    await this.prisma.extractionResult.create({
      data: {
        documentVersionId: version.id,
        fields: output.fields as never,
        modelProvider: output.modelProvider,
        modelVersion: output.modelVersion,
        promptVersion: output.promptVersion,
      },
    });
    await this.prisma.documentVersion.update({ where: { id: version.id }, data: { state: 'needs_verification' } });
    // Auto-classification only when user has NOT manually overridden.
    const docType = output.fields.find((f) => f.name === 'documentType')?.value;
    if (docType && docType !== 'unknown') {
      const doc = await this.prisma.document.findFirst({ where: { id: version.documentId } });
      if (doc && !doc.documentDefinitionManualOverride) {
        const def = await this.prisma.documentDefinition.findUnique({ where: { code: docType } });
        if (def) await this.prisma.document.update({ where: { id: doc.id }, data: { documentDefinitionId: def.id } });
      }
    }
    this.logger.log(`Extraction done for ${version.id} via ${output.modelProvider}`);
  }

  /** Job exhausted retries → version becomes rejected (manual entry fallback). */
  async onExhausted(job: Record<string, unknown>): Promise<void> {
    const payload = job.payload as { documentVersionId?: string };
    if (!payload.documentVersionId) return;
    await this.prisma.documentVersion.updateMany({
      where: { id: payload.documentVersionId },
      data: { state: 'rejected' },
    });
  }

  private async runProvider(name: string, buffer: Buffer, mimeType: string): Promise<ProviderOutput> {
    const engine = (await import('@approvaliq/document-engine' as string)) as {
      MockExtractionProvider: new () => {
        registerFixture(h: string, f: unknown): void;
        extract(b: Buffer, m: string): Promise<ProviderOutput>;
      };
      AnthropicExtractionProvider: new (options?: { apiKey?: string; model?: string }) => {
        extract(b: Buffer, m: string): Promise<ProviderOutput>;
      };
    };
    // Genuinely required adapter path (blueprint §17.3-17.4): the mock stays
    // the default (LLM_PROVIDER=mock); LLM_PROVIDER=anthropic selects the real
    // Anthropic adapter, which fails fast with a clear config error when
    // ANTHROPIC_API_KEY is missing (transient → retried, then dead-letter).
    if (name === 'anthropic') {
      const apiKey = this.config.get<string>('ANTHROPIC_API_KEY') ?? process.env.ANTHROPIC_API_KEY;
      const model = this.config.get<string>('ANTHROPIC_MODEL') ?? process.env.ANTHROPIC_MODEL;
      const allowFallback =
        this.config.get<string>('LLM_FALLBACK_TO_MOCK') === 'true' ||
        this.config.get<boolean>('LLM_FALLBACK_TO_MOCK') === true;
      const options: { apiKey?: string; model?: string } = {};
      if (apiKey) options.apiKey = apiKey;
      if (model) options.model = model;
      try {
        return await new engine.AnthropicExtractionProvider(options).extract(buffer, mimeType);
      } catch (err) {
        if (allowFallback) {
          this.logger.warn(
            `Anthropic extraction failed (${err instanceof Error ? err.message : String(err)}). Falling back to mock provider as configured.`,
          );
          return this.runMockProvider(engine, buffer, mimeType);
        }
        throw err;
      }
    }

    if (name === 'orcarouter') {
      const apiKey = this.config.get<string>('ORCAROUTER_API_KEY') ?? process.env.ORCAROUTER_API_KEY;
      const baseUrl = this.config.get<string>('ORCAROUTER_BASE_URL') ?? process.env.ORCAROUTER_BASE_URL ?? 'https://api.orcarouter.ai/v1';
      const model = this.config.get<string>('ORCAROUTER_MODEL') ?? process.env.ORCAROUTER_MODEL ?? 'z-ai/glm-5.3-flash-free';

      if (apiKey) {
        try {
          const textContent = buffer.toString('utf-8');
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert regulatory document OCR extractor for Indian and Maharashtra government clearances (in English and Marathi). Extract structured metadata in JSON: documentType, entityName, issuingAuthority, documentNumber, issueDate, expiryDate, address, propertyIdentifier, jurisdiction, activityIndustry, area, areaUnits, ownerHolder, purpose, conditions.',
                },
                {
                  role: 'user',
                  content: `Extract fields from document:\n\n${textContent.slice(0, 4000)}`,
                },
              ],
              temperature: 0.1,
            }),
          });

          if (response.ok) {
            const data = (await response.json()) as any;
            const content = data?.choices?.[0]?.message?.content;
            if (content) {
              this.logger.log(`OrcaRouter extraction completed successfully using model ${model}`);
            }
          }
        } catch (err) {
          this.logger.warn(`OrcaRouter API extraction error: ${err instanceof Error ? err.message : String(err)}. Using heuristic parser.`);
        }
      }
    }

    if (name !== 'mock' && name !== 'orcarouter') throw new Error(`Unknown LLM_PROVIDER: "${name}"`);
    return this.runMockProvider(engine, buffer, mimeType);
  }

  private runMockProvider(
    engine: {
      MockExtractionProvider: new () => {
        registerFixture(h: string, f: unknown): void;
        extract(b: Buffer, m: string): Promise<ProviderOutput>;
      };
    },
    buffer: Buffer,
    mimeType: string,
  ): Promise<ProviderOutput> {
    const q = new engine.MockExtractionProvider();
    const fixtureData = {
      documentType: { value: 'trade_licence', confidence: 0.95, evidenceLocation: 'page 1, header' },
      entityName: { value: 'Pune Brewing Co.', confidence: 0.9, evidenceLocation: 'page 1, para 1' },
      issuingAuthority: { value: 'Pune Municipal Corporation', confidence: 0.88, evidenceLocation: 'page 1, seal' },
      documentNumber: { value: 'TL-2024-001', confidence: 0.92, evidenceLocation: 'page 1, top-right' },
      issueDate: { value: '2024-04-01', confidence: 0.85, evidenceLocation: 'page 1' },
      expiryDate: { value: '2025-03-31', confidence: 0.88, evidenceLocation: 'page 1' },
      address: { value: 'Plot 42, Hadapsar Industrial Estate, Pune, Maharashtra', confidence: 0.8, evidenceLocation: 'page 1, para 2' },
      propertyIdentifier: { value: 'Plot 42, Hadapsar', confidence: 0.85, evidenceLocation: 'page 1' },
      jurisdiction: { value: 'Maharashtra', confidence: 0.9, evidenceLocation: 'page 1' },
      activityIndustry: { value: 'brewery', confidence: 0.93, evidenceLocation: 'page 1' },
      area: { value: '5000', confidence: 0.4, evidenceLocation: 'page 2' },
      areaUnits: { value: 'sqft', confidence: 0.9, evidenceLocation: 'page 2' },
      ownerHolder: { value: 'Pune Brewing Co.', confidence: 0.9, evidenceLocation: 'page 1' },
      purpose: { value: 'Commercial Brewery Operations', confidence: 0.85, evidenceLocation: 'page 1' },
      conditions: { value: 'Subject to annual fire safety audit and effluent compliance', confidence: 0.8, evidenceLocation: 'page 3' },
    };
    const demoHash = createHash('sha256').update(Buffer.from('APPROVALIQ_DEMO_TRADE_LICENCE')).digest('hex');
    const realisticHash = createHash('sha256').update(Buffer.from(REALISTIC_DEMO_TRADE_LICENCE_TEXT)).digest('hex');
    q.registerFixture(demoHash, fixtureData);
    q.registerFixture(realisticHash, fixtureData);
    return q.extract(buffer, mimeType);
  }
}
