import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  constructor(private readonly metrics: MetricsService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
