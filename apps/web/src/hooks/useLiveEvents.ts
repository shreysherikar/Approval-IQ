import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth';
import { API_BASE_URL } from '../api-client';

export function useLiveProjectEvents(projectId?: string | null): void {
  const queryClient = useQueryClient();
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!projectId || !accessToken) return;

    // Connect to Server-Sent Events (SSE) stream
    // Note: native EventSource doesn't support Authorization headers directly,
    // so we pass the token as a query param or fall back gracefully
    const sseUrl = `${API_BASE_URL}/projects/${projectId}/events?token=${encodeURIComponent(accessToken)}`;
    
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type) {
            // Invalidate relevant query keys instantly
            if (payload.type === 'roadmap_updated') {
              void queryClient.invalidateQueries({ queryKey: ['roadmap', projectId] });
            } else if (payload.type === 'clarification_updated') {
              void queryClient.invalidateQueries({ queryKey: ['clarifications', projectId] });
            } else if (payload.type === 'grievance_updated') {
              void queryClient.invalidateQueries({ queryKey: ['grievances', projectId] });
            } else if (payload.type === 'inspection_updated') {
              void queryClient.invalidateQueries({ queryKey: ['inspections', projectId] });
            } else if (payload.type === 'document_updated') {
              void queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
            }
          }
        } catch {
          // Ignore non-json ping events
        }
      };

      eventSource.onerror = () => {
        // SSE connection dropped — EventSource will automatically retry with exponential backoff
      };
    } catch {
      // Fall back silently to React Query polling
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [projectId, accessToken, queryClient]);
}
