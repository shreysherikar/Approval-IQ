import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { DocumentsService, UploadedFile as UploadedFileShape, type UpdateDocumentInput } from './documents.service';

/**
 * Document Vault endpoints (Phase 5).
 *
 * AUTH: every route runs JwtAuthGuard (who are you?) THEN ProjectMemberGuard
 * (are you a member of :projectId?). The object-level membership check is what
 * prevents a valid JWT from another user's token from touching another user's
 * documents — "has a valid JWT" alone is NOT sufficient authorization.
 *
 * All file reads happen ONLY through the download endpoint below, never through
 * a static path. storageKey values are opaque and are not served as URLs.
 */
@ApiTags('documents')
@Controller('projects/:projectId/documents')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents in a project (with their current version)' })
  list(@Param('projectId') projectId: string) {
    return this.documents.list(projectId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload an original document (multipart field "file")' })
  async upload(
    @Param('projectId') projectId: string,
    @UploadedFile() file: unknown,
    @Body('documentDefinitionId') documentDefinitionId: string | undefined,
    @Req() req: Request,
  ) {
    const { userId } = req.user as { userId: string };
    return this.documents.create(projectId, this.toUpload(file), documentDefinitionId, userId);
  }

  @Patch(':documentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update document classification and/or free-text metadata (manual override)',
    description:
      'Sets documentDefinitionId and/or metadata. When documentDefinitionId is provided, ' +
      'documentDefinitionManualOverride is set to true so auto-classification (Phase 6+) never silently overwrites a user correction.',
  })
  async update(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() body: UpdateDocumentInput,
  ) {
    return this.documents.update(projectId, documentId, body);
  }

  @Post(':documentId/versions')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a replacement version (prior version is superseded)' })
  async addVersion(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @UploadedFile() file: unknown,
    @Req() req: Request,
  ) {
    const { userId } = req.user as { userId: string };
    return this.documents.addVersion(projectId, documentId, this.toUpload(file), userId);
  }

  @Get(':documentId/versions/:versionId/download')
  @ApiOperation({ summary: 'Download a specific version through the authorized endpoint' })
  async download(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @Res() res: Response,
  ) {
    const { buffer, originalFilename, mimeType } = await this.documents.download(
      projectId,
      documentId,
      versionId,
    );
    res.contentType(mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }

  /**
   * Normalizes the multer file object into the shape the service expects. An
   * absent/invalid file becomes an empty placeholder so the service can raise a
   * consistent 400.
   */
  private toUpload(file: unknown): UploadedFileShape {
    if (typeof file !== 'object' || file === null) {
      return { originalname: '', mimetype: '', size: 0, buffer: Buffer.from('') };
    }
    const f = file as { originalname?: unknown; mimetype?: unknown; size?: unknown; buffer?: unknown };
    return {
      originalname: typeof f.originalname === 'string' ? f.originalname : '',
      mimetype: typeof f.mimetype === 'string' ? f.mimetype : '',
      size: typeof f.size === 'number' ? f.size : 0,
      buffer: f.buffer instanceof Buffer ? f.buffer : Buffer.from(''),
    };
  }
}