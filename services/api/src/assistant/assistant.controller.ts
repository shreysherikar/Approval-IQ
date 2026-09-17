import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { AssistantService, type AssistantChatResponse } from './assistant.service';

/**
 * ApprovalIQ Voice & Grounded Assistant ("Approve") — Project Chat & Voice Navigation.
 */
@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Get('status')
  @ApiOperation({ summary: 'Assistant mode (llm | offline) for the UI badge' })
  status(): { mode: 'llm' | 'offline' } {
    return { mode: this.service.mode };
  }

  @Post('chat')
  @ApiOperation({
    summary:
      'General voice/text assistant turn about ApprovalIQ, state single-window regulations, clearances, and platform navigation.',
  })
  async generalChat(
    @Body() body: { message?: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> },
  ): Promise<AssistantChatResponse> {
    const message = (body?.message ?? '').trim();
    const history = Array.isArray(body?.history) ? body.history : [];
    return this.service.generalChat(message, history);
  }

  @Post('projects/:projectId/chat')
  @UseGuards(JwtAuthGuard, ProjectMemberGuard)
  @ApiOperation({
    summary:
      'One grounded voice/text turn about a project — answers are strictly derived from the live project snapshot with structured navigation actions.',
  })
  async chat(
    @Param('projectId') projectId: string,
    @Body() body: { message?: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> },
  ): Promise<AssistantChatResponse> {
    const message = (body?.message ?? '').trim();
    const history = Array.isArray(body?.history) ? body.history : [];
    return this.service.chat(projectId, message, history);
  }
}

