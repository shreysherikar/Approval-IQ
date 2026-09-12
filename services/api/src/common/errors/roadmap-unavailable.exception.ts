import { HttpException, HttpStatus } from '@nestjs/common';

/** Stable client-facing code the frontend can branch on (never renders a graph). */
export const ROADMAP_UNAVAILABLE_CODE = 'roadmap_unavailable';

/**
 * Thrown by the roadmap GET handler when the exact subset of approval
 * instances + depends_on edges it is about to return contains a dependency
 * cycle.
 *
 * This is provably impossible after Phase 1 import cycle detection, so it is
 * treated as a server/data-integrity assertion failure: the roadmap graph is
 * withheld (never rendered to a user, where it would show an infinite loop or
 * a broken layering) and a severity alert is logged.
 */
export class RoadmapUnavailableException extends HttpException {
  constructor(
    projectId: string,
    cycleApprovalIds: readonly string[],
    cycleDescription: string,
  ) {
    super(
      {
        code: ROADMAP_UNAVAILABLE_CODE,
        message:
          'Roadmap unavailable — a dependency cycle was detected in this project\u2019s approval roadmap. The graph is not being rendered (this should be impossible after import-phase cycle validation; it is treated as a data-integrity alert).',
        details: { projectId, cycleDescription, cycleApprovalIds },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}