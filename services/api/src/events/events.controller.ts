import { Controller, Param, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('projects/:projectId/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse()
  @UseGuards(JwtAuthGuard)
  streamEvents(@Param('projectId') projectId: string): Observable<MessageEvent> {
    return this.eventsService.getProjectStream(projectId);
  }
}
