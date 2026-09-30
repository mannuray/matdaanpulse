import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Paginated } from '../paginated';
import { v4 as uuidv4 } from 'uuid';

export interface Response<T> {
  success: boolean;
  data: T;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * The success envelope. It holds no per-request values (request id, time) so
 * identical data gives identical bytes — CDN- and ETag-friendly. The request id
 * travels in the X-Request-ID header and the time in the standard Date header.
 */
export function successEnvelope<T>(data: T): Response<T> {
  if (data instanceof Paginated) {
    const { page, limit, total } = data.meta;
    return {
      success: true,
      data: data.data as unknown as T,
      pagination: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 },
    };
  }
  return { success: true, data };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    // SSE handlers emit MessageEvent objects that Nest serialises onto the wire
    // itself (event: / data: lines). Wrapping them would break named events.
    if (Reflect.getMetadata(SSE_METADATA, context.getHandler())) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const requestId = (request?.headers?.['x-request-id'] as string) || uuidv4();
    if (request?.res) request.res.setHeader('X-Request-ID', requestId);

    return next.handle().pipe(map((data) => successEnvelope<T>(data)));
  }
}
