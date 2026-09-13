import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { STORAGE_PROVIDER } from '../storage/storage.token';
import type { StorageProviderLike } from '../storage/storage.token';
import { PrismaService } from '../prisma/prisma.service';

/** The multipart file shape Nest/multer hands us (memory storage). */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface DownloadResult {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
}

/** Input for PATCH /documents/:documentId — manual override of classification & metadata. */
export interface UpdateDocumentInput {
  documentDefinitionId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Structural shape of a DocumentVersion row for serialization. */
interface VersionRow {
  id: string;
  versionNumber: number;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  uploadedByUserId: string;
  uploadedAt: Date;
  state: string;
}

/** MIME types accepted for uploads (Phase 5: common brewery paperwork). */
const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'image/png',
  'image/jpeg',
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MiB

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProviderLike,
  ) {}

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  async list(projectId: string): Promise<Record<string, unknown>[]> {
    await this.assertProject(projectId);
    const docs = await this.prisma.document.findMany({
      where: { projectId },
      include: { currentVersion: true, documentDefinition: { select: { code: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return docs.map((doc) => this.serializeDocument(doc, doc.currentVersion));
  }
  // --------------------------------------------------------------------------
  // Writes
  // --------------------------------------------------------------------------

  /**
   * Uploads an original document: validates type/size, computes the sha256,
   * stores the bytes via StorageProvider, then creates the Document and its
   * first DocumentVersion (state = "uploaded").
   */
  async create(
    projectId: string,
    file: UploadedFile,
    documentDefinitionId: string | undefined,
    userId: string,
  ): Promise<Record<string, unknown>> {
    await this.assertProject(projectId);
    this.validateFile(file);
    const canonicalDefinitionId = documentDefinitionId
      ? await this.resolveDocumentDefinitionId(documentDefinitionId)
      : undefined;

    const documentId = randomUUID();
    const versionId = randomUUID();
    const fileHash = this.sha256(file.buffer);

    // Store bytes first so the storageKey exists before we persist the row.
    const { storageKey } = await this.storage.put(projectId, versionId, file.buffer);

    await this.prisma.$transaction(async (tx) => {
      await tx.document.create({
        data: {
          id: documentId,
          projectId,
          documentDefinitionId: canonicalDefinitionId ?? null,
          // currentVersionId set after the version row exists to satisfy the FK.
        },
      });
      await tx.documentVersion.create({
        data: {
          id: versionId,
          documentId,
          versionNumber: 1,
          storageKey,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          fileHash,
          uploadedByUserId: userId,
          state: 'uploaded',
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionId: versionId },
      });
    });

    return this.listOne(documentId);
  }

  /**
   * Updates a document's classification (documentDefinitionId) and/or free-text metadata.
   * Manual override always wins — sets documentDefinitionManualOverride = true when
   * documentDefinitionId is provided, so auto-classification (Phase 6+) never silently
   * overwrites a user's correction.
   */
  async update(
    projectId: string,
    documentId: string,
    input: UpdateDocumentInput,
  ): Promise<Record<string, unknown>> {
    await this.assertProject(projectId);
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, projectId: true },
    });
    if (!doc || doc.projectId !== projectId) {
      throw new NotFoundException(`Document '${documentId}' not found in project '${projectId}'`);
    }

    let canonicalDefinitionId: string | null | undefined;
    if (input.documentDefinitionId !== undefined) {
      canonicalDefinitionId = input.documentDefinitionId
        ? await this.resolveDocumentDefinitionId(input.documentDefinitionId)
        : input.documentDefinitionId;
    }

    const updateData: Record<string, unknown> = {};

    if (canonicalDefinitionId !== undefined) {
      updateData.documentDefinitionId = canonicalDefinitionId;
      // Manual override flag: true when user explicitly sets/corrects the value.
      // This ensures auto-classification (Phase 6+) never silently overwrites it.
      updateData.documentDefinitionManualOverride = true;
    }

    if (input.metadata !== undefined) {
      updateData.metadata = input.metadata;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: updateData,
      });
    }

    return this.listOne(documentId);
  }

  /**
   * Uploads a replacement version for a document. NEVER mutates or deletes the
   * prior version — it is only marked "superseded", and a new version becomes
   * the document's current version.
   */
  async addVersion(
    projectId: string,
    documentId: string,
    file: UploadedFile,
    userId: string,
  ): Promise<Record<string, unknown>> {
    await this.assertProject(projectId);
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        projectId: true,
        documentDefinitionId: true,
        currentVersion: { select: { id: true, versionNumber: true } },
      },
    });
    if (!doc || doc.projectId !== projectId) {
      throw new NotFoundException(`Document '${documentId}' not found in project '${projectId}'`);
    }
    this.validateFile(file);

    const versionId = randomUUID();
    const fileHash = this.sha256(file.buffer);
    const { storageKey } = await this.storage.put(projectId, versionId, file.buffer);
    const versionNumber = (doc.currentVersion?.versionNumber ?? 0) + 1;

    await this.prisma.$transaction(async (tx) => {
      if (doc.currentVersion) {
        await tx.documentVersion.update({
          where: { id: doc.currentVersion.id },
          data: { state: 'superseded' },
        });
      }
      await tx.documentVersion.create({
        data: {
          id: versionId,
          documentId,
          versionNumber,
          storageKey,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          fileHash,
          uploadedByUserId: userId,
          state: 'uploaded',
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionId: versionId },
      });
    });

    return this.listOne(documentId);
  }
  // --------------------------------------------------------------------------
  // Reads
  // --------------------------------------------------------------------------

  /**
   * Reads a version's bytes through the StorageProvider for the authorized
   * download endpoint. The caller (ProjectMemberGuard) is responsible for the
   * object-level auth check — this only resolves the row + fetches the blob.
   */
  async download(
    projectId: string,
    documentId: string,
    versionId: string,
  ): Promise<DownloadResult> {
    await this.assertProject(projectId);
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, document: { id: documentId, projectId } },
      select: { storageKey: true, originalFilename: true, mimeType: true },
    });
    if (!version) {
      throw new NotFoundException(
        `Version '${versionId}' not found for document '${documentId}'`,
      );
    }
    const buffer = await this.storage.get(version.storageKey);
    return {
      buffer,
      originalFilename: version.originalFilename,
      mimeType: version.mimeType,
    };
  }
  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async listOne(documentId: string): Promise<Record<string, unknown>> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { currentVersion: true, documentDefinition: { select: { code: true } } },
    });
    if (!doc) throw new NotFoundException(`Document '${documentId}' not found`);
    return this.serializeDocument(doc, doc.currentVersion);
  }

  private serializeDocument(
    doc: {
      id: string;
      projectId: string;
      documentDefinitionId: string | null;
      documentDefinitionManualOverride: boolean;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
      documentDefinition?: { code: string } | null;
    },
    currentVersion: VersionRow | null,
  ): Record<string, unknown> {
    return {
      id: doc.id,
      projectId: doc.projectId,
      documentDefinitionId: doc.documentDefinitionId,
      // Stable public identifier the roadmap emits (DocumentDefinition.code).
      // Additive (nullable) — lets the UI match an uploaded row back to its
      // required document without changing the FK contract.
      documentDefinitionCode: doc.documentDefinition?.code ?? null,
      documentDefinitionManualOverride: doc.documentDefinitionManualOverride,
      metadata: doc.metadata,
      currentVersion: currentVersion ? this.serializeVersion(currentVersion) : null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private serializeVersion(v: VersionRow): Record<string, unknown> {
    return {
      id: v.id,
      versionNumber: v.versionNumber,
      // storageKey is deliberately OPAQUE: it is NOT a fetchable URL and must
      // only ever be read back through the authorized download endpoint.
      storageKey: v.storageKey,
      originalFilename: v.originalFilename,
      mimeType: v.mimeType,
      sizeBytes: v.sizeBytes,
      fileHash: v.fileHash,
      uploadedByUserId: v.uploadedByUserId,
      uploadedAt: v.uploadedAt,
      state: v.state,
    };
  }

  private async assertProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException(`Project '${projectId}' not found`);
  }

  private async resolveDocumentDefinitionId(documentDefinitionId: string): Promise<string> {
    const byId = await this.prisma.documentDefinition.findUnique({
      where: { id: documentDefinitionId },
      select: { id: true },
    });
    if (byId) return byId.id;
    const byCode = await this.prisma.documentDefinition.findUnique({
      where: { code: documentDefinitionId },
      select: { id: true },
    });
    if (byCode) return byCode.id;
    throw new NotFoundException(`DocumentDefinition '${documentDefinitionId}' not found`);
  }

  private validateFile(file: UploadedFile): void {
    if (!file || typeof file.buffer === 'undefined') {
      throw new BadRequestException('A file upload is required (multipart field "file")');
    }
    if (typeof file.size !== 'number' || file.size <= 0) {
      throw new BadRequestException('Uploaded file is empty');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large: ${file.size} bytes (max ${MAX_FILE_SIZE_BYTES})`,
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: ` +
          `${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }
  }

  private sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}