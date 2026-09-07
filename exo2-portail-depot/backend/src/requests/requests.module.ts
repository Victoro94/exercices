import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
