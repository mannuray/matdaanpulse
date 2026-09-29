import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

export interface Response<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
  pagination?: any;
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

    return next.handle().pipe(
      map((data) => {
        const meta = { requestId, timestamp: new Date().toISOString() };

        // If data is already wrapped or null, handle accordingly
        if (data && data.success !== undefined) {
          return { ...data, ...meta };
        }

        // Handle paginated responses from our services
        if (data && data.data !== undefined && data.total !== undefined) {
          const { data: list, total, page, limit } = data;
          return {
            success: true,
            data: list,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
            ...meta,
          };
        }

        return {
          success: true,
          data: data,
          ...meta,
        };
      }),
    );
  }
}
