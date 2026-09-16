import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface ProjectEventPayload {
  projectId: string;
  type: 'roadmap_updated' | 'clarification_updated' | 'grievance_updated' | 'inspection_updated' | 'document_updated';
  timestamp: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class EventsService {
  private readonly events$ = new Subject<ProjectEventPayload>();

  emit(event: Omit<ProjectEventPayload, 'timestamp'>): void {
    this.events$.next({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  getProjectStream(projectId: string): Observable<MessageEvent> {
    return this.events$.asObservable().pipe(
      filter((e) => e.projectId === projectId || e.projectId === '*'),
      map((e) => ({
        data: JSON.stringify(e),
        type: e.type,
      } as MessageEvent)),
    );
  }
}
