import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PublicDepositController } from './public-deposit.controller';
import { PublicDepositService } from './public-deposit.service';
import { PublicSessionGuard } from './public-session.guard';
import { StorageModule } from '../storage/storage.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
      }),
    }),
    StorageModule,
    MetricsModule,
  ],
  controllers: [PublicDepositController],
  providers: [PublicDepositService, PublicSessionGuard],
})
export class PublicDepositModule {}
