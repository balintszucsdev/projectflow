import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service.js';

interface MetricsHttpRequest {
  method: string;
  path: string;
  route?: {
    path?: string;
  };
}

interface MetricsHttpResponse {
  statusCode: number;
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor<unknown, unknown> {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const httpContext = context.switchToHttp();

    const request = httpContext.getRequest<MetricsHttpRequest>();
    const response = httpContext.getResponse<MetricsHttpResponse>();

    // A Prometheus saját scrape kéréseit ne számoljuk bele
    // az alkalmazás HTTP forgalmába.
    if (request.path === '/metrics') {
      return next.handle();
    }

    const start = process.hrtime.bigint();

    let statusCode = response.statusCode;

    return next.handle().pipe(
      tap({
        next: () => {
          statusCode = response.statusCode;
        },
        error: (error: unknown) => {
          statusCode =
            error instanceof HttpException
              ? error.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR;
        },
      }),

      finalize(() => {
        const durationSeconds =
          Number(process.hrtime.bigint() - start) / 1_000_000_000;

        const route =
          typeof request.route?.path === 'string'
            ? request.route.path
            : request.path;

        this.metricsService.observeHttpRequest(
          request.method,
          route,
          statusCode,
          durationSeconds,
        );
      }),
    );
  }
}
