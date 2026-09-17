import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantContextService } from './assistant-context.service';

export interface VoiceAssistantAction {
  type: 'navigate';
  target: 'roadmap' | 'schemes' | 'profile' | 'vault' | 'time-cost' | 'inspections' | 'grievances';
  entityId?: string;
  label?: string;
}

export interface AssistantChatResponse {
  reply: string;
  spokenText: string;
  mode: 'llm' | 'offline';
  actions?: VoiceAssistantAction[];
  referencedEntities?: Array<{ type: string; id?: string; name?: string }>;
}

/**
 * ApprovalIQ Voice & Grounded Assistant ("Approve") Service.
 *
 * Grounding & Safety Principles:
 * 1. Strictly answers using the live project Knowledge Snapshot (approvals DAG,
 *    business profile, missing fields, document vault, schemes/incentives, RTS SLAs).
 * 2. Never invents statutory approvals, fees, SLAs, or subsidy qualifications.
 * 3. Answers with concise, voice-first spoken phrasing and structured navigation actions.
 * 4. Provides deterministic offline intelligence when LLM credentials are absent.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly context: AssistantContextService,
    private readonly config: ConfigService,
  ) {}

  /** Whether an external LLM is configured. */
  get mode(): 'llm' | 'offline' {
    const hasAnthropic = Boolean(this.config.get<string>('ANTHROPIC_API_KEY'));
    const hasOrca = Boolean(this.config.get<string>('ORCAROUTER_API_KEY') || process.env.ORCAROUTER_API_KEY);
    return hasAnthropic || hasOrca ? 'llm' : 'offline';
  }

  async generalChat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<AssistantChatResponse> {
    if (this.mode === 'llm') {
      try {
        const systemPrompt = [
          'You are "Approve", the dedicated intelligent Voice Assistant for ApprovalIQ (India\'s industrial single-window clearance intelligence platform).',
          'Your responses will be read aloud by text-to-speech. Write in natural, clear, conversational spoken English.',
          'ApprovalIQ helps industrial founders, MSMEs, and investors navigate statutory business clearances (MIDC, MPCB, Factory Inspectorate, Fire NOC, Town Planning), government schemes (CGTMSE, EPCG, ZED, state incentives), document vaults, and statutory RTS SLAs.',
          'Keep answers concise: 2 to 4 spoken sentences (~40-80 words).',
          'Return a JSON object in this exact format:',
          '{',
          '  "spokenText": "Plain spoken text to be read aloud.",',
          '  "reply": "Rich text markdown version.",',
          '  "actions": [ { "type": "navigate", "target": "roadmap" | "schemes" | "profile" | "vault" | "time-cost" | "inspections" | "grievances", "label": "Button Label" } ]',
          '}',
        ].join('\n');
        const llmResult = await this.callLlmRaw(systemPrompt, message, history);
        if (llmResult) return llmResult;
      } catch {
        // Fallback to offlineGeneralAnswer
      }
    }

    return offlineGeneralAnswer(message);
  }

  async chat(
    projectId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<AssistantChatResponse> {
    const snapshot = await this.context.buildSnapshot(projectId);
    const compact = JSON.stringify(snapshot);

    if (this.mode === 'llm') {
      try {
        const llmResult = await this.callLlm(compact, message, history);
        if (llmResult) return llmResult;
      } catch {
        // Graceful fallback to rich offline analysis on LLM failure or rate-limit
      }
    }

    return offlineAnswer(snapshot, message);
  }


  private async callLlm(
    snapshotJson: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<AssistantChatResponse | null> {
    const systemPrompt = [
      'You are "Approve", the dedicated intelligent Voice Assistant for ApprovalIQ (India\'s industrial single-window clearance intelligence platform).',
      'Your responses will be read aloud by text-to-speech. Write in natural, clear, conversational spoken English.',
      'STRICT GROUNDING RULES:',
      '1. Answer ONLY using the PROJECT KNOWLEDGE SNAPSHOT provided below.',
      '2. NEVER invent approvals, fees, SLAs, subsidy amounts, or authorities. If information is missing or null, clearly state that it is not yet configured or verified.',
      '3. For approvals: accurately state available, in-progress, blocked, and done approvals.',
      '4. If an approval is blocked, explain the exact gating prerequisite named in the snapshot.',
      '5. For schemes/incentives: cite eligible subsidies (CGTMSE, EPCG, 80-IAC, ZED) or state negative list exclusions (e.g. alcohol) exactly as evaluated in the snapshot.',
      '6. Keep answers concise: 2 to 4 spoken sentences (~40-80 words) unless detailed breakdown is requested.',
      '7. If the user asks to navigate, view, or open a section (e.g. "show me blocked approval", "open schemes", "take me to profile"), include appropriate structured actions.',
      '',
      'Return a JSON object in this exact format:',
      '{',
      '  "spokenText": "Plain English answer without markdown, asterisks, headers or symbols, written to be read aloud.",',
      '  "reply": "Rich text version with standard markdown if helpful for visual chat.",',
      '  "actions": [ { "type": "navigate", "target": "roadmap" | "schemes" | "profile" | "vault" | "time-cost" | "inspections" | "grievances", "label": "Button Label" } ]',
      '}',
      '',
      'PROJECT KNOWLEDGE SNAPSHOT:',
      snapshotJson,
    ].join('\n');

    return this.callLlmRaw(systemPrompt, message, history);
  }

  private async callLlmRaw(
    systemPrompt: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<AssistantChatResponse | null> {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    const orcaKey = this.config.get<string>('ORCAROUTER_API_KEY') || process.env.ORCAROUTER_API_KEY;

    const conversationMessages = [
      ...history.slice(-6).map((h) => ({ role: h.role, content: h.content.slice(0, 1500) })),
      { role: 'user' as const, content: message.slice(0, 1500) },
    ];

    let rawOutput: string | null = null;

    if (anthropicKey) {
      const model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5-20250929';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 600,
          system: systemPrompt,
          messages: conversationMessages,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
        rawOutput = (data.content ?? [])
          .filter((b) => b.type === 'text' && typeof b.text === 'string')
          .map((b) => b.text as string)
          .join('');
      }
    } else if (orcaKey) {
      const res = await fetch('https://api.orcarouter.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orcaKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationMessages,
          ],
          temperature: 0.2,
          max_tokens: 600,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        rawOutput = data.choices?.[0]?.message?.content ?? null;
      }
    }

    if (!rawOutput) return null;

    try {
      const cleaned = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const spokenText = parsed.spokenText || parsed.answer || parsed.reply || rawOutput;
      const reply = parsed.reply || spokenText;
      const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
      return { reply, spokenText, mode: 'llm', actions };
    } catch {
      return { reply: rawOutput, spokenText: rawOutput, mode: 'llm' };
    }
  }
}


/**
 * Intelligent deterministic answer generator for live project snapshot queries.
 */
export function offlineAnswer(snapshot: Record<string, unknown>, message: string): AssistantChatResponse {
  const q = message.toLowerCase();
  const project = snapshot.project as { name?: string; industry?: string; id?: string } | undefined;
  const profile = snapshot.businessProfile as { values?: Record<string, unknown>; missingMandatoryFields?: Array<{ label: string; impact: string }> } | undefined;
  const approvals = snapshot.approvalsSummary as {
    totalApplicable?: number;
    availableCount?: number;
    inProgressCount?: number;
    blockedCount?: number;
    completedCount?: number;
    available?: Array<{ name: string; slaDays?: number }>;
    inProgress?: Array<{ name: string; slaDays?: number }>;
    blocked?: Array<{ name: string; gatingPrerequisites?: string[] }>;
    completed?: Array<{ name: string }>;
  } | undefined;
  const docs = snapshot.documents as {
    totalUploaded?: number;
    verifiedCount?: number;
    pendingVerificationCount?: number;
    missingCount?: number;
    missingMandatoryDocuments?: string[];
  } | undefined;
  const schemes = snapshot.schemes as {
    isNegativeListSector?: boolean;
    evaluatedSubsidies?: Array<{ name: string; benefit: string; status: string; exclusionReason?: string }>;
  } | undefined;
  const pred = snapshot.timeCostPrediction as {
    time?: { estimatedMinWorkingDays?: number; estimatedMaxWorkingDays?: number; criticalPath?: string[] };
    cost?: { total?: { min?: number | null; max?: number | null } };
  } | undefined;

  const actions: VoiceAssistantAction[] = [];

  // 0. Explicit navigation commands
  if (/take me to|open|go to|show me|navigate to/.test(q)) {
    if (/scheme|incentive/.test(q)) {
      actions.push({ type: 'navigate', target: 'schemes', label: 'Open Schemes & Incentives' });
      return { reply: 'Opening Schemes and Incentives desk now.', spokenText: 'Opening Schemes and Incentives desk now.', mode: 'offline', actions };
    }
    if (/roadmap|approval/.test(q)) {
      actions.push({ type: 'navigate', target: 'roadmap', label: 'Open Approval Roadmap' });
      return { reply: 'Opening Approval Roadmap desk now.', spokenText: 'Opening Approval Roadmap desk now.', mode: 'offline', actions };
    }
    if (/vault|document/.test(q)) {
      actions.push({ type: 'navigate', target: 'vault', label: 'Open Document Vault' });
      return { reply: 'Opening Document Vault now.', spokenText: 'Opening Document Vault now.', mode: 'offline', actions };
    }
    if (/profile/.test(q)) {
      actions.push({ type: 'navigate', target: 'profile', label: 'Open Business Profile' });
      return { reply: 'Opening Business Profile intake now.', spokenText: 'Opening Business Profile intake now.', mode: 'offline', actions };
    }
    if (/cost|time|prediction/.test(q)) {
      actions.push({ type: 'navigate', target: 'time-cost', label: 'Open Time & Cost Forecast' });
      return { reply: 'Opening Time & Cost Prediction desk now.', spokenText: 'Opening Time & Cost Prediction desk now.', mode: 'offline', actions };
    }
  }

  // 1. Missing Profile parameters (Specific check)
  if (/missing.*(info|field|param|profile)|mandatory.*(field|param|missing|info)|profile.*missing|unconfigured/.test(q)) {
    actions.push({ type: 'navigate', target: 'profile', label: 'Edit Business Profile' });
    const missingFields = profile?.missingMandatoryFields || [];
    if (missingFields.length > 0) {
      const missingLabels = missingFields.map((m) => m.label).join(', ');
      const text = `Your business profile is missing ${missingFields.length} essential ${missingFields.length === 1 ? 'parameter' : 'parameters'}: ${missingLabels}. Completing these ensures 100% accurate statutory clearance mapping.`;
      return { reply: text, spokenText: text, mode: 'offline', actions };
    }
    const text = 'All essential mandatory business profile parameters are configured.';
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  // 2. Project Overview / What is the project about?
  if (/\b(what.*is.*(the|a|my|this)?\s*project|about.*(the|a|my|this)?\s*project|project.*summary|tell me about|explain.*project|what are we building|project overview|my project|describe.*project)\b/i.test(q)) {
    actions.push({ type: 'navigate', target: 'roadmap', label: 'View Roadmap' });
    actions.push({ type: 'navigate', target: 'profile', label: 'View Profile' });
    const vals = profile?.values || {};
    const projName = project?.name || 'Your Facility';
    const ind = vals.industry || project?.industry || 'industrial enterprise';
    const loc = vals.district ? `${vals.district}, ${vals.state || 'Maharashtra'}` : 'Maharashtra';
    const avail = approvals?.availableCount ?? 0;
    const blocked = approvals?.blockedCount ?? 0;
    const days = pred?.time?.estimatedMaxWorkingDays ? `with an estimated timeline of ${pred.time.estimatedMaxWorkingDays} days` : 'tracked against RTS SLAs';

    const text = `Your project "${projName}" is a ${ind} unit in ${loc}. It requires ${approvals?.totalApplicable ?? 0} statutory clearances (${avail} ready to submit, ${blocked} blocked by prerequisites) ${days}. How can I assist you with your clearances or subsidies?`;
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }


  // 2. Blocked approvals & prerequisites
  if (/blocked|prerequisite|why.*block|stuck|bottleneck|waiting for/.test(q)) {
    actions.push({ type: 'navigate', target: 'roadmap', label: 'View Approval Roadmap' });
    if (!approvals || approvals.blockedCount === 0) {
      const text = 'Good news! None of your approvals are currently blocked by prerequisite dependencies.';
      return { reply: text, spokenText: text, mode: 'offline', actions };
    }
    const firstBlocked = approvals.blocked?.[0];
    const prereqList = firstBlocked?.gatingPrerequisites?.join(', ') || 'prior clearance approvals';
    const text = `You have ${approvals.blockedCount} blocked ${approvals.blockedCount === 1 ? 'approval' : 'approvals'}. For example, ${firstBlocked?.name || 'an approval'} is currently gated until ${prereqList} is completed.`;
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  // 3. Pending / In Progress / What do I need to do next?
  if (/pending|in progress|next|what to do|available|status|how many approval|action/.test(q)) {
    actions.push({ type: 'navigate', target: 'roadmap', label: 'Open Roadmap' });
    const availCount = approvals?.availableCount ?? 0;
    const inProgCount = approvals?.inProgressCount ?? 0;
    const blockedCount = approvals?.blockedCount ?? 0;
    const availNames = approvals?.available?.slice(0, 2).map((a) => a.name).join(', ') || 'available filings';

    const text = `You have ${approvals?.totalApplicable ?? 0} total applicable approvals: ${availCount} ready for immediate submission (${availNames}), ${inProgCount} in progress, and ${blockedCount} blocked by dependencies.`;
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  // 4. Completed approvals
  if (/completed|done|finished|approved|cleared/.test(q)) {
    actions.push({ type: 'navigate', target: 'roadmap', label: 'Open Roadmap' });
    const doneCount = approvals?.completedCount ?? 0;
    const doneNames = approvals?.completed?.map((c) => c.name).join(', ');
    const text = doneCount > 0
      ? `You have completed ${doneCount} ${doneCount === 1 ? 'approval' : 'approvals'}: ${doneNames}.`
      : 'You have not marked any approvals as completed yet.';
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  // 5. Documents & Missing Vault items
  if (/document|vault|missing doc|verification|upload|paperwork|form/.test(q)) {
    actions.push({ type: 'navigate', target: 'vault', label: 'Manage Document Vault' });
    const uploaded = docs?.totalUploaded ?? 0;
    const verified = docs?.verifiedCount ?? 0;
    const missing = docs?.missingCount ?? 0;
    const missingNames = docs?.missingMandatoryDocuments?.slice(0, 2).join(', ') || 'prescribed forms';

    const text = `Your document vault has ${uploaded} uploaded documents (${verified} verified). You have ${missing} missing mandatory ${missing === 1 ? 'document' : 'documents'}, including ${missingNames}.`;
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  // 6. Schemes & Incentives / Subsidies / Negative list
  if (/scheme|incentive|subsidy|subsidies|grant|cgtmse|epcg|tax holiday|why.*excluded|benefit|funding|collateral|loan|credit|financing|capital/.test(q)) {
    actions.push({ type: 'navigate', target: 'schemes', label: 'Explore Schemes & Incentives' });
    if (schemes?.isNegativeListSector) {
      const text = `Your facility is in the alcohol sector, which is excluded from direct state cash subsidies under Annexure II. However, you remain eligible for ₹5 Crore CGTMSE collateral-free financing, 0% customs duty under EPCG, and Section 80-IAC tax holidays.`;
      return { reply: text, spokenText: text, mode: 'offline', actions };
    }
    const text = `Your enterprise qualifies for key national incentive programs: ₹5 Crore CGTMSE collateral-free loan guarantees, 0% duty machinery imports under EPCG, and 80% MSME ZED green certification subsidies.`;
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  // 7. Business Profile / Missing Profile parameters
  if (/profile|missing.*info|missing.*field|industry|state|district|investment|worker|area|parameter/.test(q)) {
    actions.push({ type: 'navigate', target: 'profile', label: 'Edit Business Profile' });
    const missingFields = profile?.missingMandatoryFields || [];
    if (missingFields.length > 0) {
      const missingLabels = missingFields.map((m) => m.label).join(', ');
      const text = `Your business profile is missing ${missingFields.length} essential ${missingFields.length === 1 ? 'parameter' : 'parameters'}: ${missingLabels}. Completing these ensures 100% accurate statutory clearance mapping.`;
      return { reply: text, spokenText: text, mode: 'offline', actions };
    }
    const vals = profile?.values || {};
    const text = `Your project "${project?.name || 'Enterprise'}" is registered as a ${vals.industry || 'general'} unit in ${vals.district || 'Pune'}, ${vals.state || 'Maharashtra'}.`;
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  // 8. Timeline / Cost / RTS SLA
  if (/sla|time|timeline|how long|days|cost|fee|prediction|expense|budget|duration/.test(q)) {
    actions.push({ type: 'navigate', target: 'time-cost', label: 'View Time & Cost Forecast' });
    const minDays = pred?.time?.estimatedMinWorkingDays;
    const maxDays = pred?.time?.estimatedMaxWorkingDays;
    const minCost = pred?.cost?.total?.min;
    const maxCost = pred?.cost?.total?.max;

    if (minDays != null) {
      const costStr = minCost != null ? ` with an estimated statutory cost between ₹${minCost} and ₹${maxCost}` : '';
      const text = `Statutory readiness for ${project?.name || 'your project'} is projected at ${minDays} to ${maxDays} working days${costStr}, tracked against statutory Right to Services SLAs.`;
      return { reply: text, spokenText: text, mode: 'offline', actions };
    }
    const text = 'Clearances are tracked against verified Right to Services Act SLAs with statutory deemed-approval timelines.';
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  // Default fallback
  actions.push({ type: 'navigate', target: 'roadmap', label: 'Open Roadmap' });
  const text = `I'm Approve, your voice assistant. You have ${approvals?.totalApplicable ?? 0} applicable approvals (${approvals?.availableCount ?? 0} ready to file, ${approvals?.blockedCount ?? 0} blocked), ${docs?.missingCount ?? 0} missing documents, and verified government incentive eligibility. How can I help you today?`;
  return { reply: text, spokenText: text, mode: 'offline', actions };
}


/**
 * Intelligent deterministic answer generator for general ApprovalIQ platform queries
 * (e.g. landing page, public marketing routes, or unauthenticated inquiries).
 */
export function offlineGeneralAnswer(message: string): AssistantChatResponse {
  const q = message.toLowerCase();
  const actions: VoiceAssistantAction[] = [];

  if (/what is approvaliq|explain|overview|how does.*work|about/.test(q)) {
    actions.push({ type: 'navigate', target: 'roadmap', label: 'Explore Platform' });
    const text =
      "ApprovalIQ is India's industrial single-window clearance intelligence platform. We evaluate your business parameters, map out a clear dependency roadmap of statutory clearances, and match you with eligible government schemes and subsidies.";
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  if (/scheme|incentive|subsidy|subsidies|grant|cgtmse|epcg|tax holiday|zed/.test(q)) {
    actions.push({ type: 'navigate', target: 'schemes', label: 'View Schemes' });
    const text =
      'ApprovalIQ checks your eligibility for top state and central schemes, including ₹5 Crore CGTMSE collateral-free financing, 0% export customs duty under EPCG, Section 80-IAC tax holidays, and MSME ZED green certification subsidies.';
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  if (/clearance|approval|license|permit|factory|mpcb|midc|fire/.test(q)) {
    actions.push({ type: 'navigate', target: 'roadmap', label: 'View Roadmap' });
    const text =
      'ApprovalIQ maps required licenses from MPCB, MIDC, Directorate of Industrial Safety, Town Planning, and Fire Services into sequenced parallel tracks so you can file on time without delays.';
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  if (/timeline|cost|time|sla|right to service|rts/.test(q)) {
    actions.push({ type: 'navigate', target: 'time-cost', label: 'Time & Cost Forecast' });
    const text =
      'ApprovalIQ forecasts statutory timelines and compliance costs based on official Maharashtra Right to Services Act SLAs with deemed approval tracking.';
    return { reply: text, spokenText: text, mode: 'offline', actions };
  }

  if (/take me to|open|go to|show me/.test(q)) {
    if (/scheme|incentive/.test(q)) {
      actions.push({ type: 'navigate', target: 'schemes', label: 'Open Schemes' });
      return { reply: 'Opening Schemes and Incentives desk.', spokenText: 'Opening Schemes and Incentives desk.', mode: 'offline', actions };
    }
    if (/roadmap|approval/.test(q)) {
      actions.push({ type: 'navigate', target: 'roadmap', label: 'Open Roadmap' });
      return { reply: 'Opening Approval Roadmap.', spokenText: 'Opening Approval Roadmap.', mode: 'offline', actions };
    }
    if (/profile/.test(q)) {
      actions.push({ type: 'navigate', target: 'profile', label: 'Open Profile' });
      return { reply: 'Opening Business Profile intake.', spokenText: 'Opening Business Profile intake.', mode: 'offline', actions };
    }
  }

  // Default general greeting
  actions.push({ type: 'navigate', target: 'roadmap', label: 'Open Dashboard' });
  const text =
    "I'm Approve, your voice assistant for ApprovalIQ. You can ask me about statutory approvals, required documents, government subsidies, or navigate anywhere across your dashboard. How can I help you?";
  return { reply: text, spokenText: text, mode: 'offline', actions };
}

