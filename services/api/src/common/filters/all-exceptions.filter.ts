import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Returns a consistent error envelope and never leaks stack traces:
 *   { "error": { "code": "...", "message": "...", "details?": ... } }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status: (code: number) => { json: (body: ErrorEnvelope) => void } }>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = this.codeForStatus(status);
      } else if (typeof body === 'object' && body !== null) {
        const payload = body as Record<string, unknown>;
        // Express/Nest built-in errors carry { statusCode, message, error: "Bad Request" }.
        // Normalize the human `error` string to our SCREAMING code scheme.
        code = this.codeForStatus(status);
        if (Array.isArray(payload['message'])) {
          // class-validator ValidationPipe errors
          code = 'VALIDATION_ERROR';
          message = 'Validation failed';
          details = payload['message'];
        } else if (typeof payload['message'] === 'string') {
          message = payload['message'];
        }
        // A service can pin an explicit domain code and structured details on the
        // exception body (e.g. roadmap_unavailable with the offending cycle). Honor
        // them instead of falling back to the status-derived code.
        if (typeof payload['code'] === 'string' && payload['code'].length > 0) {
          code = payload['code'];
        }
        if (payload['details'] !== undefined) {
          details = payload['details'];
        }
      }
    }

    // Logged server-side only — never included in the response body.
    console.error(`[${request.method} ${request.url}]`, exception);

    response.status(status).json({
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    });
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
    }
  }
}
