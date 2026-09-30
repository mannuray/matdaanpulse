import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Paginated, paginated } from '../../../common/paginated';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class MapToDtoInterceptor implements NestInterceptor {
  constructor(private readonly dto: any) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (!data) return data;

        if (data instanceof Paginated) {
          return paginated(plainToInstance(this.dto, data.data, { excludeExtraneousValues: true }) as any[], data.meta);
        }

        return plainToInstance(this.dto, data, { excludeExtraneousValues: true });
      }),
    );
  }
}
