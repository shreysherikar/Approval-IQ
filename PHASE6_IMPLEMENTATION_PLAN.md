# Phase 6 Implementation Plan: Document Intelligence

## Overview
Implement asynchronous document extraction pipeline with job queue, extraction providers (mock + stub), manual correction/verification UI endpoints, and approval instance document references.

---

## 1. Database Schema Changes (Prisma)

### New Models

#### Job Table (Prompt 4.1 - Section 20.2)
```prisma
model Job {
  id                   String   @id @default(uuid())
  type                 String   // e.g., "document_extraction"
  payloadSchemaVersion Int      @default(1)
  attemptCount         Int      @default(0)
  idempotencyKey       String   @unique
  status               JobStatus @default(pending)
  errorDetails         Json?    @db.JsonB
  retryPolicy          Json     @db.JsonB // { maxAttempts, backoffStrategy }
  createdAt            DateTime @default(now()) @map("created_at")
  completedAt          DateTime? @map("completed_at")

  @@index([status])
  @@index([type])
  @@map("jobs")
}

enum JobStatus {
  pending
  processing
  completed
  failed
  dead_letter
}
```

#### ExtractionResult Table (Prompt 4.2)
```prisma
model ExtractionResult {
  id                String   @id @default(uuid())
  documentVersionId String   @unique @map("document_version_id")
  documentVersion   DocumentVersion @relation(fields: [documentVersionId], references: [id], onDelete: Cascade)
  fields            Json     @db.JsonB // Array of { name, value, confidence, evidenceLocation, source }
  modelProvider     String   @map("model_provider")
  modelVersion      String   @map("model_version")
  promptVersion     String   @map("prompt_version")
  extractedAt       DateTime @default(now()) @map("extracted_at")

  @@map("extraction_results")
}
```

#### VerificationRecord Table (Prompt 4.3)
```prisma
model VerificationRecord {
  id                  String   @id @default(uuid())
  documentVersionId   String   @map("document_version_id")
  documentVersion     DocumentVersion @relation(fields: [documentVersionId], references: [id], onDelete: Cascade)
  verifierUserId      String   @map("verifier_user_id")
  verifier            User     @relation(fields: [verifierUserId], references: [id], onDelete: Restrict)
  verifiedAt          DateTime @default(now()) @map("verified_at")
  fieldsVerified      Json     @db.JsonB // Array of field names that were verified
  notes               String?  @db.Text
  method              String   @default("manual_review")
  evidenceInspected   Boolean  @default(false) @map("evidence_inspected")
  verifiedBy          String   @default("applicant") @map("verified_by") // "applicant" for Phase 6

  @@map("verification_records")
}
```

#### ApprovalInstanceDocument Join Table (Prompt 4.3)
```prisma
model ApprovalInstanceDocument {
  id                  String           @id @default(uuid())
  approvalInstanceId  String           @map("approval_instance_id")
  approvalInstance    ApprovalInstance @relation(fields: [approvalInstanceId], references: [id], onDelete: Cascade)
  documentId          String           @map("document_id")
  document            Document         @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([approvalInstanceId, documentId])
  @@map("approval_instance_documents")
}
```

### DocumentVersion Updates
- Add relation to ExtractionResult (1:1)
- Add relation to VerificationRecord (1:many)
- State enum already has all required states

---

## 2. @approvaliq/document-engine Package

### Structure
```
services/document-engine/
├── src/
│   ├── index.ts                    // Public exports
│   ├── extraction-provider.ts      // Interface definition
│   ├── mock-extraction-provider.ts // Mock provider implementation
│   ├── anthropic-extraction-provider.ts // Stub provider
│   └── test/
│       └── fixtures/
│           ├── fixture-map.ts      // fileHash -> extraction result
│           └── sample-files/       // Sample PDFs/images for testing
├── package.json
├── tsconfig.json
└── README.md
```

### ExtractionProvider Interface
```typescript
interface ExtractionProvider {
  extract(fileBuffer: Buffer, mimeType: string): Promise<ExtractionResult>;
}

interface ExtractionResult {
  fields: ExtractedField[];
  modelProvider: string;
  modelVersion: string;
  promptVersion: string;
  extractedAt: Date;
}

interface ExtractedField {
  name: string;
  value: string | null; // null = "unknown"
  confidence: number;   // 0.0 - 1.0
  evidenceLocation?: {
    page?: number;
    paragraph?: number;
    bbox?: [number, number, number, number]; // x, y, width, height
  };
  source: 'extracted' | 'user_corrected'; // Track origin
}
```

### Field Set (per Blueprint)
- document_type
- organization_name / individual_name
- issuing_authority
- document_number
- issue_date
- expiry_date
- address
- property_project_identifiers
- area_value + area_units
- owner_holder
- purpose
- jurisdiction
- activity_industry
- relevant_conditions

**Rule**: Missing fields return `value: null, confidence: 0, source: 'extracted'` — never inferred.

### MockExtractionProvider
- Deterministic, keyed by `fileHash` (sha256 of file buffer)
- Fixture map in `test/fixtures/fixture-map.ts`
- Returns predefined extraction results for known test files
- Zero external dependencies, zero API cost

### AnthropicExtractionProvider (Stub)
- Implements same interface
- `extract()` throws `"not enabled this sprint"`
- Only file allowed to import Anthropic SDK (when enabled)
- Selected via `LLM_PROVIDER` env var (defaults to "mock")

---

## 3. Job Queue Worker (Prompt 4.1)

### Design Decision: Standalone Entrypoint
**Choice**: Separate worker process (`services/api/src/worker/worker.ts`) — not a mode of the API server.

**Reasoning**:
- Clear separation of concerns (API serves requests, worker processes async jobs)
- Can scale independently
- Easier to test and debug
- Matches Phase 15 migration path (separate worker fleet)
- Avoids blocking API event loop with long-running extraction

### Worker Logic
```typescript
// Polling interval: 5 seconds (configurable)
async function runWorker() {
  while (true) {
    const job = await prisma.job.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });

    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // Mark processing
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'processing', attemptCount: { increment: 1 } },
    });

    try {
      const handler = JOB_HANDLERS[job.type];
      if (!handler) throw new Error(`No handler for job type: ${job.type}`);
      
      await handler(job.payload);
      
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'completed', completedAt: new Date() },
      });
    } catch (error) {
      await handleJobFailure(job, error);
    }
  }
}

async function handleJobFailure(job: Job, error: Error) {
  const maxAttempts = job.retryPolicy?.maxAttempts ?? 3;
  const backoff = job.retryPolicy?.backoffStrategy ?? 'exponential';
  
  if (job.attemptCount >= maxAttempts) {
    await prisma.job.update({
      where: { id: job.id },
      data: { 
        status: 'dead_letter', 
        errorDetails: { message: error.message, stack: error.stack },
        completedAt: new Date(),
      },
    });
  } else {
    // Calculate backoff delay
    const delay = calculateBackoff(job.attemptCount, backoff);
    await prisma.job.update({
      where: { id: job.id },
      data: { 
        status: 'pending', // Re-queue for retry
        errorDetails: { message: error.message, stack: error.stack },
      },
    });
    await sleep(delay);
  }
}
```

### Idempotency
- `idempotencyKey` unique constraint prevents duplicate job creation
- Handler must be idempotent: use `documentVersionId` + `fileHash` to detect re-runs
- Test: Submit same job twice → only one ExtractionResult created

---

## 4. API Endpoints

### POST /projects/:projectId/documents/:documentId/extract
- Enqueues "document_extraction" job
- Payload: `{ documentVersionId, fileHash }`
- Idempotency key: `extract:{documentVersionId}:{fileHash}`
- Returns: `{ jobId, status: "queued" }`

### PATCH /projects/:projectId/documents/:documentId (Prompt 4.1)
- Allows manual override of `documentDefinitionId` and free-text metadata
- Records `source: "manual_override"` on any field changed
- Manual override always wins over auto-classification
- Available permanently (even after Phase 6 auto-classification)

### GET /projects/:projectId/documents/:documentId/extraction
- Returns ExtractionResult for current version (if exists)
- Includes fields with confidence, evidenceLocation, source

### POST /projects/:projectId/documents/:documentId/fields/:fieldName/correct
- Stores user correction as separate record (source: "user_corrected")
- Does NOT overwrite original extraction result
- Body: `{ value: string, confidence: 1.0 }`

### POST /projects/:projectId/documents/:documentId/verify
- Creates VerificationRecord
- Transitions DocumentVersion.state: needs_verification → verified
- Body: `{ fieldsVerified: string[], notes?: string, evidenceInspected: boolean }`
- Returns VerificationRecord

---

## 5. Document State Transitions (Phase 6)

```
uploaded → queued → processing → extracted → needs_verification → verified
                              ↓ (transient failure)
                              → processing (retry)
                              ↓ (permanent failure after maxAttempts)
                              → rejected
```

**Failure Handling**:
- Transient (network/timeout): Retry per retryPolicy, state stays "processing" or reverts to "queued"
- Permanent (corrupt file): After maxAttempts → "rejected" with errorDetails
- Never corrupt existing metadata on failure

---

## 6. Implementation Order

1. **Prisma Schema + Migration** — Add all new models
2. **document-engine package** — Interface, Mock provider, Anthropic stub, fixtures
3. **Job Queue Worker** — Standalone polling worker with retry/backoff/idempotency
4. **API Endpoints** — Extract, PATCH override, correction, verification
5. **DocumentsService Updates** — New methods for extraction, correction, verification
6. **Integration Tests** — Full pipeline test + idempotency test
7. **Verification** — Run lint, typecheck, tests

---

## 7. Configuration

### Environment Variables (already in env.validation.ts)
- `LLM_PROVIDER` — "mock" | "anthropic" (default: "mock")

### New Constants
- `EXTRACTION_REVIEW_THRESHOLD` = 0.7 (Decision #6) — UI flag threshold
- `JOB_POLL_INTERVAL_MS` = 5000
- `DEFAULT_RETRY_POLICY` = { maxAttempts: 3, backoffStrategy: 'exponential' }

---

## 8. Exit Criteria (from Blueprint)

- [ ] Upload fixture file, trigger extraction against mock provider, see fields populate with confidence
- [ ] Deliberately-absent field renders as "unknown," not a guess
- [ ] Verify document, confirm state moves to verified and verification record is queryable
- [ ] Kill worker mid-job and restart — confirm job resumes/retries rather than corrupting document
- [ ] Idempotency test: run same job twice → one ExtractionResult row
- [ ] ApprovalInstanceDocument join table works for multi-instance document references