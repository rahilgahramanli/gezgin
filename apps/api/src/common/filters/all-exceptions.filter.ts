import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@gezgin/shared';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
  requestId?: string;
}

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: ERROR_CODES.VALIDATION_FAILED,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  413: ERROR_CODES.UPLOAD_TOO_LARGE,
  415: ERROR_CODES.UNSUPPORTED_MEDIA,
  429: ERROR_CODES.RATE_LIMITED,
};

/**
 * Bütün xətaları vahid formata salır — mobil tərəf `code` sahəsinə görə
 * istifadəçiyə tərcümə göstərir, `message` yalnız developer üçündür.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERROR_CODES.INTERNAL;
    let message = 'Gözlənilməz xəta baş verdi';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_TO_CODE[status] ?? ERROR_CODES.INTERNAL;
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const p = payload as Record<string, unknown>;
        if (typeof p.code === 'string') code = p.code;
        message = typeof p.message === 'string' ? p.message : Array.isArray(p.message) ? 'Validasiya xətası' : message;
        if (Array.isArray(p.message)) details = p.message;
        if (p.details !== undefined) details = p.details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status} ${code}`, exception instanceof Error ? exception.stack : undefined);
    }

    const body: ErrorBody = {
      statusCode: status,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string | undefined,
    };

    res.status(status).json(body);
  }
}
