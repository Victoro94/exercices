import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
      // Limiteur global : 60 req/min par route. Le 5/min strict du PIN
      // est un override local sur la route unlock (voir controller).
      { name: 'default', ttl: 60_000, limit: 60 },
    ]),
    PrismaModule,
    AuthModule,
    RequestsModule,
    PublicDepositModule,
    StorageModule,
    MetricsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
