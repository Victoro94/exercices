import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { computeStatus } from './logic/deposit-status';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  private newToken(): string {
    return randomBytes(5).toString('hex');
  }

  async create(userId: string, dto: { title: string; pin: string; expectedDocs?: number; expiresInDays?: number }) {
    const expectedDocs = dto.expectedDocs ?? 4;
    const expiresInDays = dto.expiresInDays ?? 7;
    const token = this.newToken();
    const pinHash = await bcrypt.hash(dto.pin, 10);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000);

    const created = await this.prisma.depositRequest.create({
      data: {
        title: dto.title,
        token,
        pinHash,
        expectedDocs,
        expiresAt,
        userId,
        status: 'PENDING',
      },
      include: { _count: { select: { documents: true } } },
    });
    this.metrics.incRequestCreated();
    return this.toPublic(created, 0);
  }

  async list(userId: string) {
    const rows = await this.prisma.depositRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { documents: { where: { status: 'READY' } } } },
      },
    });
    const now = new Date();
    const out: unknown[] = [];
    for (const r of rows) {
      const status = computeStatus(r.expiresAt, r._count.documents, r.expectedDocs, now);
      if (status !== r.status) {
        await this.prisma.depositRequest.update({ where: { id: r.id }, data: { status } });
      }
      out.push(this.toPublic(r, r._count.documents, status));
    }
    return out;
  }

  async getOne(userId: string, id: string) {
    const r = await this.prisma.depositRequest.findFirst({
      where: { id, userId },
      include: {
        _count: { select: { documents: { where: { status: 'READY' } } } },
        documents: { where: { status: 'READY' }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!r) return null;
    const status = computeStatus(r.expiresAt, r._count.documents, r.expectedDocs);
    return this.toPublic(r, r._count.documents, status);
  }

  async remove(userId: string, id: string) {
    await this.prisma.depositRequest.deleteMany({ where: { id, userId } });
    return { deleted: true };
  }

  @Cron('*/5 * * * *')
  async expireOverdue() {
    const overdue = await this.prisma.depositRequest.findMany({
      where: { status: { not: 'EXPIRED' }, expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    for (const r of overdue) {
      await this.prisma.depositRequest.update({ where: { id: r.id }, data: { status: 'EXPIRED' } });
    }
  }

  private toPublic(r: Record<string, unknown>, readyCount: number, status?: string) {
    const s = (status ?? (r['status'] as string)) as string;
    return {
      id: r['id'],
      title: r['title'],
      token: r['token'],
      expectedDocs: r['expectedDocs'],
      readyCount,
      status: s,
      expiresAt: r['expiresAt'],
      createdAt: r['createdAt'],
      publicUrlPath: `/d/${r['token']}`,
    };
  }
}
