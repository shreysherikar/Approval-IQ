import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantContextService } from './assistant-context.service';

/**
 * ApprovalIQ Assistant — grounded project chat.
 *
 * One POST /assistant/projects/:projectId/chat turn:
 * 1. Pulls the project Knowledge Snapshot (profile, evaluations, prediction,
 *    documents) from AssistantContextService — real DB data, no fabrication.
 * 2. If ANTHROPIC_API_KEY is configured, calls Claude with a strict
 *    answer-only-from-context system prompt.
 * 3. Otherwise answers from the snapshot directly (offline summary mode) —
 *    the chat is always usable, but never fabricates.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly context: AssistantContextService,
    private readonly config: ConfigService,
  ) {}

  /** Whether a real LLM is configured (drives the UI badge). */
  get mode(): 'llm' | 'offline' {
    return this.config.get<string>('ANTHROPIC_API_KEY') ? 'llm' : 'offline';
  }

  async chat(
    projectId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<{ reply: string; mode: 'llm' | 'offline' }> {
    const snapshot = await this.context.buildSnapshot(projectId);
    const compact = JSON.stringify(snapshot);

    if (this.mode === 'llm') {
      const reply = await this.callClaude(compact, message, history);
      return { reply, mode: 'llm' };
    }

    return { reply: offlineAnswer(snapshot, message), mode: 'offline' };
  }

  private async callClaude(
    snapshotJson: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('Assistant LLM not configured');
    const model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5-20250929';

    const system = [
      'You are the ApprovalIQ Assistant, embedded in the ApprovalIQ compliance platform.',
      'You answer questions about the user\'s project using ONLY the PROJECT KNOWLEDGE SNAPSHOT provided and your knowledge of ApprovalIQ itself.',
      'Never invent approvals, fees, timelines, ratings or market facts. If a value is "null" or missing in the snapshot, say it is not configured rather than guessing.',
      'When the snapshot contains a timeCostPrediction, cite its numbers (day ranges, cost ranges, critical path) exactly as given.',
      'Be concise and concrete: short paragraphs or bullet lists, max ~180 words unless the user asks for detail.',
      'If asked about ApprovalIQ product features, explain: the Business Profile intake, the deterministic rules engine and approval evaluation, the approval roadmap with dependency graph, the document vault with AI extraction, officer clarifications, joint inspections, regulatory-change impact analysis, compliance recovery plans, and the Business Intelligence pages (Time & Cost Prediction, Market & Competitor Intelligence).',
      'Suggest the relevant ApprovalIQ page for follow-up actions when useful.',
      '',
      'PROJECT KNOWLEDGE SNAPSHOT:',
      snapshotJson,
    ].join('\n');

    const messages = [
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content.slice(0, 2000) })),
      { role: 'user' as const, content: message.slice(0, 2000) },
    ];

    // Direct Messages-API call (no SDK dependency — same API the
    // document-engine's Anthropic adapter uses, via plain fetch).
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: 1024, system, messages }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Assistant LLM call failed (${res.status}). ${detail.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('');
    return text.trim() || 'I could not generate a response — please try again.';
  }
}

/** Deterministic snapshot answers for offline mode (no key configured). */
function offlineAnswer(snapshot: Record<string, unknown>, message: string): string {
  const q = message.toLowerCase();
  const project = snapshot.project as { name?: string; industry?: string } | undefined;
  const profile = snapshot.businessProfile as { values?: Record<string, unknown> } | undefined;
  const pred = snapshot.timeCostPrediction as Record<string, unknown> | undefined;
  const lines: string[] = [];

  const aboutProduct = /approvaliq|what can you|features|how does this work|who are you/.test(q);
  if (aboutProduct) {
    lines.push(
      `I'm the ApprovalIQ Assistant for "${project?.name ?? 'your project'}". ApprovalIQ turns your business profile into a deterministic approval evaluation, a dependency-aware roadmap, document management with AI extraction, officer clarifications, inspections, regulatory-change impact analysis, recovery plans, and Business Intelligence pages for Time & Cost Prediction and Market & Competitor Intelligence.`,
    );
  }

  if (pred && (/time|how long|days|duration|timeline|cost|fee|price|₹/.test(q) || lines.length === 0)) {
    const time = pred.time as { estimatedMinWorkingDays?: number; estimatedMaxWorkingDays?: number; criticalPath?: string[] } | undefined;
    const cost = pred.cost as { total?: { min?: number | null; max?: number | null } } | undefined;
    if (time?.estimatedMinWorkingDays != null) {
      lines.push(
        `Estimated legal readiness for ${project?.name ?? 'this project'}: ${time.estimatedMinWorkingDays}–${time.estimatedMaxWorkingDays} working days. Critical path: ${(time.criticalPath ?? []).join(' → ') || 'n/a'}.`,
      );
    }
    if (cost?.total?.min != null) {
      lines.push(`Estimated total compliance cost: ₹${cost.total.min} – ₹${cost.total.max} (configured evidence only).`);
    }
  }

  if (profile?.values && /profile|business|industry|state|district|area|investment|employee/.test(q)) {
    lines.push(`Business profile: ${Object.entries(profile.values).map(([k, v]) => `${k}=${String(v)}`).join(', ')}.`);
  }

  const docs = snapshot.documents as { total?: number } | undefined;
  if (docs && /document|upload|vault/.test(q)) {
    lines.push(`Documents in the vault: ${docs.total ?? 0}.`);
  }

  if (lines.length === 0) {
    lines.push(
      `I can answer from your project data: timeline and critical path, compliance cost, business profile, documents and clarifications — or explain ApprovalIQ's features. The AI model is not configured on this deployment (set ANTHROPIC_API_KEY to enable full conversational answers), but all figures I share come from the real project snapshot.`,
    );
  }
  return lines.join('\n\n');
}
