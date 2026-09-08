import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, ALLOWED_MIMES, MAX_FILE_BYTES } from '../storage/storage.service';
import { computeStatus, isExpired, isLocked, nextLockoutDate, shouldLockout } from '../requests/logic/deposit-status';
import { MetricsService } from '../metrics/metrics.service';

function hashIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

@Injectable()
export class PublicDepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly metrics: MetricsService,
  ) {}

  private async findByToken(token: string) {
    const r = await this.prisma.depositRequest.findUnique({
      where: { token },
      include: { _count: { select: { documents: { where: { status: 'READY' } } } } },
    });
    if (!r) throw new NotFoundException('Lien inconnu');
    return r;
  }

  // Recompte les READY et persiste le statut. Point unique de vérité,
  // appelé après chaque mutation (complete, removeFile).
  private async refreshStatus(requestId: string) {
    const r = await this.prisma.depositRequest.findUnique({ where: { id: requestId } });
    if (!r) throw new NotFoundException('Demande inconnue');
    const count = await this.prisma.document.count({
      where: { requestId, status: 'READY' },
    });
    const status = computeStatus(r.expiresAt, count, r.expectedDocs);
    await this.prisma.depositRequest.update({ where: { id: requestId }, data: { status } });
    this.metrics.requestsByStatus.set({ status }, 1);
    return { readyCount: count, expectedDocs: r.expectedDocs, status };
  }

  async getMeta(token: string) {
    const r = await this.findByToken(token);
    const status = computeStatus(r.expiresAt, r._count.documents, r.expectedDocs);
    return {
      title: r.title,
      expectedDocs: r.expectedDocs,
      readyCount: r._count.documents,
      status,
      expiresAt: r.expiresAt,
    };
  }

  async unlock(token: string, pin: string, ip?: string) {
    const r = await this.findByToken(token);
    const now = new Date();

    if (isExpired(r.expiresAt, now)) {
      if (r.status !== 'EXPIRED') {
        await this.prisma.depositRequest.update({ where: { id: r.id }, data: { status: 'EXPIRED' } });
      }
      throw new ForbiddenException('Lien expiré');
    }
    if (isLocked(r.lockedUntil, now)) {
      throw new ForbiddenException('Trop de tentatives, réessaie plus tard');
    }

    const ok = await bcrypt.compare(pin, r.pinHash);
    if (!ok) {
      this.metrics.incPinFail();
      const failedAttempts = r.failedAttempts + 1;
      const lock = shouldLockout(r.failedAttempts);
      await this.prisma.depositRequest.update({
        where: { id: r.id },
        data: {
          failedAttempts,
          ...(lock ? { lockedUntil: nextLockoutDate(now) } : {}),
        },
      });
      await this.prisma.auditLog.create({
        data: { requestId: r.id, ipHash: hashIp(ip), action: 'UNLOCK_FAIL' },
      });
      if (lock) this.metrics.incPinLockout();
      throw new UnauthorizedException('PIN incorrect');
    }

    await this.prisma.depositRequest.update({
      where: { id: r.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    await this.prisma.auditLog.create({
      data: { requestId: r.id, ipHash: hashIp(ip), action: 'UNLOCK_OK' },
    });
    this.metrics.incUnlockOk();

    const session = await this.jwt.signAsync(
      { scope: 'public-deposit', token },
      {
        secret: this.config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
        expiresIn: '15m',
      },
    );
    const meta = await this.getMeta(token);
    return { session, ...meta };
  }

  async presign(token: string, dto: { filename: string; mime: string; size: number }) {
    const r = await this.findByToken(token);
    if (isExpired(r.expiresAt)) throw new ForbiddenException('Lien expiré');
    if (!ALLOWED_MIMES.includes(dto.mime)) {
      this.metrics.incUploadFail('mime');
      throw new BadRequestException('Type de fichier refusé (PDF, JPG, PNG uniquement)');
    }
    if (dto.size > MAX_FILE_BYTES) {
      this.metrics.incUploadFail('size');
      throw new BadRequestException('Fichier trop volumineux (20 Mo max)');
    }

    const documentId = randomUUID();
    const s3Key = this.storage.s3KeyFor(token, documentId, dto.filename);
    await this.prisma.document.create({
      data: {
        id: documentId,
        requestId: r.id,
        filename: dto.filename,
        mime: dto.mime,
        size: dto.size,
        s3Key,
        status: 'PENDING',
      },
    });
    await this.storage.ensureBucket();
    const uploadUrl = await this.storage.presignPut(s3Key, dto.mime);
    return { documentId, s3Key, uploadUrl, expiresIn: 300 };
  }

  async complete(token: string, documentId: string, ip?: string) {
    const r = await this.findByToken(token);
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, requestId: r.id } });
    if (!doc) throw new NotFoundException('Document inconnu');

    const ok = await this.storage.exists(doc.s3Key);
    if (!ok) {
      this.metrics.incUploadFail('missing-object');
      throw new BadRequestException("Upload introuvable côté stockage, réessaie l'envoi");
    }
    await this.prisma.document.update({ where: { id: doc.id }, data: { status: 'READY' } });
    await this.prisma.auditLog.create({
      data: { requestId: r.id, ipHash: hashIp(ip), action: 'UPLOAD_OK' },
    });
    return this.refreshStatus(r.id);
  }

  async listFiles(token: string) {
    const r = await this.findByToken(token);
    const docs = await this.prisma.document.findMany({
      where: { requestId: r.id, status: 'READY' },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d: { id: string; filename: string; mime: string; size: number; createdAt: Date }) => ({
      id: d.id,
      filename: d.filename,
      mime: d.mime,
      size: d.size,
      createdAt: d.createdAt,
    }));
  }

  async removeFile(token: string, documentId: string, ip?: string) {
    const r = await this.findByToken(token);
    if (isExpired(r.expiresAt)) throw new ForbiddenException('Lien expiré');
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, requestId: r.id } });
    if (!doc) throw new NotFoundException('Document inconnu');

    await this.storage.remove(doc.s3Key);
    await this.prisma.document.delete({ where: { id: doc.id } });
    await this.prisma.auditLog.create({
      data: { requestId: r.id, ipHash: hashIp(ip), action: 'DELETE_OK' },
    });
    return this.refreshStatus(r.id);
  }

  async downloadFile(token: string, documentId: string) {
    const r = await this.findByToken(token);
    if (isExpired(r.expiresAt)) throw new ForbiddenException('Lien expiré');
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, requestId: r.id, status: 'READY' },
    });
    if (!doc) throw new NotFoundException('Document inconnu');
    const downloadUrl = await this.storage.presignGet(doc.s3Key, doc.filename);
    return { downloadUrl, filename: doc.filename, mime: doc.mime, expiresIn: 300 };
  }
}
