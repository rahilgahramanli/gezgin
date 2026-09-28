import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@gezgin/shared';
import type { Request, Response } from 'express';
import { parseLang, type Lang } from '../i18n/lang';
import { translateDetails, translateMessage } from '../i18n/messages';
import { socketLang, type SocketLike } from '../i18n/socket-lang';

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
 *
 * `message` və `details` sətirləri `Accept-Language`-ə görə tərcümə olunur
 * (kataloq: `common/i18n/messages.ts`). az-da mətn toxunulmaz qalır.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
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

    // WebSocket (çat) kontekstində HTTP cavab obyekti yoxdur — `res.status()`
    // çağırışı ikinci xəta atıb bağlantını qırardı. Xəta müştəriyə Nest-in
    // öz konvensiyası ilə `exception` hadisəsi kimi gedir.
    if (host.getType() !== 'http') {
      if (status >= 500) {
        this.logger.error(`WS → ${status} ${code}`, exception instanceof Error ? exception.stack : undefined);
      }
      const client = host.switchToWs().getClient<SocketLike & { emit?: (event: string, payload: unknown) => void }>();
      const lang = socketLang(client);
      const localized = this.localize(message, details, lang);
      client.emit?.('exception', {
        statusCode: status,
        code,
        message: localized.message,
        ...(localized.details !== undefined ? { details: localized.details } : {}),
      });
      return;
    }

    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status} ${code}`, exception instanceof Error ? exception.stack : undefined);
    } else if (status === HttpStatus.BAD_REQUEST && details !== undefined) {
      // Hansı sahənin validasiyanı keçmədiyi loqda görünsün — əks halda
      // mobil tərəfdə yalnız "Validasiya xətası" görünür və səbəb itir.
      this.logger.warn(`${req.method} ${req.url} → 400 ${JSON.stringify(details)}`);
    }

    const localized = this.localize(message, details, parseLang(req.headers['accept-language']));
    const body: ErrorBody = {
      statusCode: status,
      code,
      message: localized.message,
      ...(localized.details !== undefined ? { details: localized.details } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string | undefined,
    };

    res.status(status).json(body);
  }

  /** Loqa orijinal (az) mətn düşür, müştəriyə isə tərcümə. */
  private localize(message: string, details: unknown, lang: Lang): { message: string; details: unknown } {
    return { message: translateMessage(message, lang), details: translateDetails(details, lang) };
  }
}
