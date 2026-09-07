import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL') ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL manquante. Copie backend/.env.example vers backend/.env puis renseigne la connexion Postgres.',
      );
    }
    super({ datasourceUrl: url });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
