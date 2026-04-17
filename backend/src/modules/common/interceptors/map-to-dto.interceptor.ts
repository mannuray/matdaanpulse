import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class MapToDtoInterceptor implements NestInterceptor {
  constructor(private readonly dto: any) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (!data) return data;

        // If it's a paginated response { data: [], total, ... }
        if (data.data && Array.isArray(data.data)) {
          return {
            ...data,
            data: plainToInstance(this.dto, data.data, { excludeExtraneousValues: true }),
          };
        }

        return plainToInstance(this.dto, data, { excludeExtraneousValues: true });
      }),
    );
  }
}
