import type {
  ContentBlockParam,
  Message,
} from '@anthropic-ai/sdk/resources/messages';
import {
  EXTRACTION_FIELD_NAMES,
  unknownField,
  type ExtractedField,
  type ExtractionOutput,
  type ExtractionProvider,
} from './types.ts';

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

  async extract(fileBuffer: Buffer, mimeType: string): Promise<ExtractionOutput> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'AnthropicExtractionProvider: ANTHROPIC_API_KEY is not set (LLM_PROVIDER=anthropic requires it)',
      );
    }
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20250929';
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const document = toAnthropicDocument(fileBuffer, mimeType);
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
  }
}

/** Minimal structural view of the Anthropic messages response we consume. */
type AnthropicMessageResponse = Pick<Message, 'content'>;

/**
 * Maps a file buffer to an Anthropic document content block. PDFs go through
 * as base64 documents; images go through as base64 images; anything else is
 * sent as plain text (the provider then returns "unknown" for fields it
 * cannot find — never a guess).
 */
function toAnthropicDocument(fileBuffer: Buffer, mimeType: string): ContentBlockParam {
  const base64 = fileBuffer.toString('base64');
  if (mimeType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
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
function toExtractionOutput(
  response: AnthropicMessageResponse,
  model: string,
): ExtractionOutput {
  const text = response.content
    .filter((b): b is Extract<Message['content'][number], { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  let parsed: Record<string, unknown> = {};
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    parsed = JSON.parse((fenced?.[1] ?? text).trim()) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null) parsed = {};
  } catch {
    parsed = {};
  }
  const fields: ExtractedField[] = EXTRACTION_FIELD_NAMES.map((name) => {
    const raw = parsed[name];
    if (typeof raw === 'string' && raw.trim() !== '' && raw.trim().toLowerCase() !== 'unknown') {
      return {
        name,
        value: raw.trim(),
        confidence: 0.85,
        evidenceLocation: null,
      };
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return { name, value: String(raw), confidence: 0.85, evidenceLocation: null };
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
