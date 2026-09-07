import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const route = (req.route?.path as string) ?? req.path;
      const labels = { method: req.method, route, status: String(res.statusCode) };
      this.metrics.httpRequests.inc(labels);
      const dur = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.httpDuration.observe({ method: req.method, route }, dur);
    });
    next();
  }
}
