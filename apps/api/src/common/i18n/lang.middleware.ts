import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { parseLang, runWithLang } from './lang';

/**
 * Sorğunun qalan hissəsini (guard, controller, servis) `Accept-Language`
 * dilinin kontekstində işlədir — `currentLang()` harada çağırılsa düzgün dili verir.
 */
@Injectable()
export class LangMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    runWithLang(parseLang(req.headers['accept-language']), next);
  }
}
