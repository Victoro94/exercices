import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  async getMetrics() {
    return this.svc.registry.metrics();
  }
}
