import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { MetricsModule } from '../metrics/metrics.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [MetricsModule, StorageModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
