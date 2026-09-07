import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

/**
 * Prisma BigInt və Decimal dəyərlərini JSON-a çevirir.
 * BigInt → string (JSON.stringify onu dəstəkləmir), Decimal → number.
 */
function serialize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Prisma Decimal — toFixed metodu var
    if (typeof (obj as { toFixed?: unknown }).toFixed === 'function' && typeof (obj as { toNumber?: unknown }).toNumber === 'function') {
      return (obj as { toNumber: () => number }).toNumber();
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serialize(v);
    return out;
  }
  return value;
}

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(serialize));
  }
}
