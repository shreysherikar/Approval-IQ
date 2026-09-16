import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { AssistantService } from './assistant.service';

/**
 * ApprovalIQ Assistant — grounded project chat.
 * Same authorization shape as roadmap/profile/time-cost: JwtAuthGuard (who
 * are you?) + ProjectMemberGuard (are you a member of :projectId?), so the
 * assistant can never leak one applicant's project data to another.
 */
@ApiTags('assistant')
@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Get('status')
  @ApiOperation({ summary: 'Assistant mode (llm | offline) for the UI badge' })
  status(): { mode: 'llm' | 'offline' } {
    return { mode: this.service.mode };
  }

  @Post('projects/:projectId/chat')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({
    summary:
      'One grounded chat turn about a project — answers are derived from the project knowledge snapshot (profile, evaluations, time/cost prediction, documents).',
  })
  async chat(
    @Param('projectId') projectId: string,
    @Body() body: { message?: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> },
  ): Promise<{ reply: string; mode: 'llm' | 'offline' }> {
    const message = (body?.message ?? '').trim();
    const history = Array.isArray(body?.history) ? body.history : [];
    return this.service.chat(projectId, message, history);
  }
}
