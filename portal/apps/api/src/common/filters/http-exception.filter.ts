import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Converts every thrown exception into the API error envelope: { ok: false, error: string }.
 * Pairs with ResponseInterceptor, which wraps successes as { ok: true, data }. Mirrors
 * LGDesk's apps/api/src/common/filters/http-exception.filter.ts exactly.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal server error';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        error = body;
      } else if (body && typeof body === 'object') {
        const message = (body as Record<string, unknown>).message;
        if (Array.isArray(message)) error = String(message[0]);
        else if (typeof message === 'string') error = message;
        else error = String((body as Record<string, unknown>).error ?? exception.message);
        // Optional passthrough: an exception thrown as new SomeException({ code, message })
        // keeps its `code` in the response body so a caller can distinguish failure modes
        // that share an HTTP status (e.g. Google Sign-In's NO_ACCOUNT vs a bad token).
        const bodyCode = (body as Record<string, unknown>).code;
        if (typeof bodyCode === 'string') code = bodyCode;
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack ?? exception.message : String(exception),
      );
    }

    res.status(status).json({ ok: false, error, ...(code ? { code } : {}) });
  }
}
