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
 * Pairs with ResponseInterceptor, which wraps successes as { ok: true, data }.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal server error';

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
      }
    } else {
      // Unexpected (non-HTTP) error: log server-side for observability, but never
      // leak the internal message/stack to the client.
      this.logger.error(
        exception instanceof Error ? exception.stack ?? exception.message : String(exception),
      );
    }

    res.status(status).json({ ok: false, error });
  }
}
