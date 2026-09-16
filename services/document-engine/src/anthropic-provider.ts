import type {
  ContentBlockParam,
  Message,
} from '@anthropic-ai/sdk/resources/messages';
import {
  EXTRACTION_FIELD_NAMES,
  TransientExtractionError,
  UnreadableDocumentError,
  unknownField,
  type ExtractedField,
  type ExtractionOutput,
  type ExtractionProvider,
} from './types.ts';

export interface AnthropicExtractionProviderOptions {
  apiKey?: string | undefined;
  model?: string | undefined;
}

/**
 * AnthropicExtractionProvider — adapter for the real Anthropic extraction
 * path (blueprint §17.3-17.4: provider-neutral ExtractionProvider interface;
 * the rest of the application never depends directly on a particular
 * provider). Selected via LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY.
 *
 * Default remains the MockExtractionProvider (LLM_PROVIDER=mock): zero SDK
 * dependency, zero API cost. This adapter throws a clear configuration error
 * when the key/model is missing instead of silently falling back, so a
 * misconfigured production deploy fails fast rather than returning mock data.
 */
export class AnthropicExtractionProvider implements ExtractionProvider {
  readonly providerName = 'anthropic';
  private readonly configuredApiKey?: string | undefined;
  private readonly configuredModel?: string | undefined;

  constructor(options?: AnthropicExtractionProviderOptions) {
    this.configuredApiKey = options?.apiKey;
    this.configuredModel = options?.model;
  }

  async extract(fileBuffer: Buffer, mimeType: string): Promise<ExtractionOutput> {
    const apiKey = this.configuredApiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        'AnthropicExtractionProvider: ANTHROPIC_API_KEY is not set (LLM_PROVIDER=anthropic requires it)',
      );
    }
    const model = this.configuredModel ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20250929';
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const document = toAnthropicDocument(fileBuffer, mimeType);
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system:
          'Extract the fixed document schema as JSON. ' +
          'Respond with a single JSON object mapping each of these fields to its extracted string value: ' +
          EXTRACTION_FIELD_NAMES.join(', ') +
          '. Use the literal string "unknown" for any field you cannot find. Do not guess.',
        messages: [
          {
            role: 'user',
            content: [
              document,
              {
                type: 'text',
                text: 'Extract the schema fields from this document as one JSON object.',
              },
            ],
          },
        ],
      });
      return toExtractionOutput(response, model);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const msg = err instanceof Error ? err.message : String(err);
      if (status === 429 || (status !== undefined && status >= 500)) {
        throw new TransientExtractionError(`Anthropic transient error (${status}): ${msg}`);
      }
      if (status === 400 && msg.includes('unreadable')) {
        throw new UnreadableDocumentError(`Anthropic unreadable document: ${msg}`);
      }
      throw err;
    }
  }
}

/** Minimal structural view of the Anthropic messages response we consume. */
export type AnthropicMessageResponse =
  | Pick<Message, 'content'>
  | { content: Array<{ type: string; text?: string }> };

/**
 * Maps a file buffer to an Anthropic document content block. PDFs go through
 * as base64 documents; images go through as base64 images; anything else is
 * sent as plain text (the provider then returns "unknown" for fields it
 * cannot find — never a guess).
 */
function toAnthropicDocument(fileBuffer: Buffer, mimeType: string): ContentBlockParam {
  const base64 = fileBuffer.toString('base64');
  if (mimeType === 'application/pdf') {
    // If buffer is a true PDF (starts with '%PDF'), send as document block.
    // Otherwise fallback to text to prevent Anthropic 400 'invalid PDF' on text fixtures.
    const isPdf = fileBuffer.subarray(0, 5).toString('ascii').startsWith('%PDF');
    if (isPdf) {
      return {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      };
    }
    return { type: 'text', text: fileBuffer.toString('utf8') };
  }
  if (mimeType.startsWith('image/')) {
    const mediaType = (
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
    ).find((m) => m === mimeType);
    if (mediaType) {
      return {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      };
    }
  }
  return { type: 'text', text: fileBuffer.toString('utf8') };
}

/**
 * Converts the model's JSON-object reply into an ExtractionOutput. Every
 * schema field missing/blank in the reply becomes an explicit unknown with
 * zero confidence; the raw reply is never trusted to invent extra fields.
 */
export function toExtractionOutput(
  response: AnthropicMessageResponse,
  model: string,
): ExtractionOutput {
  const text = response.content
    .filter(
      (b): b is { type: 'text'; text: string } =>
        b.type === 'text' && typeof b.text === 'string',
    )
    .map((b) => b.text)
    .join('\n');
  let parsed: Record<string, unknown> = {};
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = (fenced?.[1] ?? text).trim();
    const jsonMatch = candidate.match(/(\{[\s\S]*\})/);
    const toParse = jsonMatch && jsonMatch[1] ? jsonMatch[1] : candidate;
    parsed = JSON.parse(toParse) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null) parsed = {};
  } catch {
    parsed = {};
  }
  const fields: ExtractedField[] = EXTRACTION_FIELD_NAMES.map((name) => {
    const raw = parsed[name];
    let val: string | undefined;
    let confidence = 0.85;
    let evidenceLocation: string | null = null;

    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>;
      if (obj.value !== undefined && obj.value !== null) {
        val = String(obj.value);
      }
      if (typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)) {
        confidence = obj.confidence;
      }
      if (typeof obj.evidenceLocation === 'string') {
        evidenceLocation = obj.evidenceLocation;
      }
    } else if (typeof raw === 'string') {
      val = raw;
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      val = String(raw);
    }

    if (val !== undefined && val.trim() !== '' && val.trim().toLowerCase() !== 'unknown') {
      return {
        name,
        value: val.trim(),
        confidence,
        evidenceLocation,
      };
    }
    return unknownField(name);
  });
  return {
    fields,
    modelProvider: 'anthropic',
    modelVersion: model,
    promptVersion: 'anthropic-json-v1',
    extractedAt: new Date().toISOString(),
  };
}
