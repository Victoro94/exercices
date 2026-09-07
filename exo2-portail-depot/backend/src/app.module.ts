import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RequestsModule } from './requests/requests.module';
import { PublicDepositModule } from './public-deposit/public-deposit.module';
import { StorageModule } from './storage/storage.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
      { name: 'unlock', ttl: 60_000, limit: 5 },
    ]),
    PrismaModule,
    AuthModule,
    RequestsModule,
    PublicDepositModule,
    StorageModule,
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
