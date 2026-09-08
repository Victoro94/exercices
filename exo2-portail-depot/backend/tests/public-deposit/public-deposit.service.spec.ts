import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PublicDepositService } from '../../src/public-deposit/public-deposit.service';

function reqFixture(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    title: 'Dossier Martin',
    token: 'tok123',
    expectedDocs: 4,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 86400000),
    failedAttempts: 0,
    lockedUntil: null,
    _count: { documents: 0 },
    ...over,
  };
}

describe('PublicDepositService', () => {
  let prisma: any;
  let jwt: any;
  let config: any;
  let storage: any;
  let metrics: any;
  let svc: PublicDepositService;
  let pinHash: string;

  beforeAll(async () => {
    pinHash = await bcrypt.hash('4816', 4);
  });

  beforeEach(() => {
    prisma = {
      depositRequest: { findUnique: jest.fn(), update: jest.fn() },
      document: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('public-session') };
    config = { get: jest.fn().mockReturnValue('test-secret') };
    storage = {
      ensureBucket: jest.fn(),
      presignPut: jest.fn().mockResolvedValue('https://minio/put-url'),
      presignGet: jest.fn().mockResolvedValue('https://minio/get-url'),
      exists: jest.fn(),
      remove: jest.fn(),
      s3KeyFor: jest.fn((t: string, id: string, f: string) => `${t}/${id}-${f}`),
    };
    metrics = {
      incPinFail: jest.fn(),
      incUnlockOk: jest.fn(),
      incPinLockout: jest.fn(),
      incUploadFail: jest.fn(),
      requestsByStatus: { set: jest.fn() },
    };
    svc = new PublicDepositService(prisma, jwt, config, storage, metrics);
  });

  it('unlock succès : reset échecs + session + audit', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(reqFixture({ pinHash }));
    const r = await svc.unlock('tok123', '4816', '1.2.3.4');
    expect(r.session).toBe('public-session');
    expect(r.title).toBe('Dossier Martin');
    expect(metrics.incUnlockOk).toHaveBeenCalledTimes(1);
    expect(prisma.depositRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'UNLOCK_OK' }) }),
    );
  });

  it('unlock mauvais PIN : 401 + compteur +1 sans lock', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(reqFixture({ pinHash }));
    await expect(svc.unlock('tok123', '0000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(metrics.incPinFail).toHaveBeenCalledTimes(1);
    expect(prisma.depositRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { failedAttempts: 1 },
    });
    expect(metrics.incPinLockout).not.toHaveBeenCalled();
  });

  it('5e échec : lockout 15min + métrique', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(
      reqFixture({ pinHash, failedAttempts: 4 }),
    );
    await expect(svc.unlock('tok123', '0000')).rejects.toBeInstanceOf(UnauthorizedException);
    const data = prisma.depositRequest.update.mock.calls[0][0].data;
    expect(data.failedAttempts).toBe(5);
    expect(new Date(data.lockedUntil).getTime()).toBeGreaterThan(Date.now());
    expect(metrics.incPinLockout).toHaveBeenCalledTimes(1);
  });

  it('lien verrouillé : 403 avant toute comparaison (aucune écriture)', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(
      reqFixture({ pinHash, failedAttempts: 5, lockedUntil: new Date(Date.now() + 60000) }),
    );
    await expect(svc.unlock('tok123', '4816')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.depositRequest.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('lien expiré : 403 + flip EXPIRED', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(
      reqFixture({ pinHash, expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(svc.unlock('tok123', '4816')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.depositRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'EXPIRED' },
    });
  });

  it('presign refuse mime et taille, avec métriques', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(reqFixture({ pinHash }));
    await expect(
      svc.presign('tok123', { filename: 'a.exe', mime: 'application/x-msdownload', size: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.presign('tok123', { filename: 'a.pdf', mime: 'application/pdf', size: 21 * 1024 * 1024 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(metrics.incUploadFail).toHaveBeenCalledWith('mime');
    expect(metrics.incUploadFail).toHaveBeenCalledWith('size');
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('presign OK crée le Document PENDING et retourne l’URL', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(reqFixture({ pinHash }));
    const r = await svc.presign('tok123', {
      filename: 'contrat.pdf',
      mime: 'application/pdf',
      size: 1024,
    });
    expect(r.uploadUrl).toBe('https://minio/put-url');
    expect(r.expiresIn).toBe(300);
    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', mime: 'application/pdf' }),
      }),
    );
  });

  it('complete exige l’objet côté MinIO puis passe COMPLETE', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(
      reqFixture({ pinHash, expectedDocs: 1, _count: { documents: 0 } }),
    );
    prisma.document.findFirst.mockResolvedValue({ id: 'd1', s3Key: 'k' });
    storage.exists.mockResolvedValueOnce(false);
    await expect(svc.complete('tok123', 'd1')).rejects.toBeInstanceOf(BadRequestException);

    storage.exists.mockResolvedValueOnce(true);
    prisma.document.count.mockResolvedValue(1);
    const r = await svc.complete('tok123', 'd1');
    expect(r).toMatchObject({ readyCount: 1, expectedDocs: 1, status: 'COMPLETE' });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'READY' },
    });
  });

  it('listFiles retourne les documents READY sans secret', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(reqFixture({ pinHash }));
    prisma.document.findMany.mockResolvedValue([
      { id: 'd1', filename: 'a.pdf', mime: 'application/pdf', size: 10, s3Key: 'k1', createdAt: new Date() },
    ]);
    const rows = await svc.listFiles('tok123');
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('s3Key');
    expect(rows[0]).toMatchObject({ id: 'd1', filename: 'a.pdf' });
  });

  it('removeFile supprime S3 + ligne DB, recalcule et audite', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(
      reqFixture({ pinHash, expectedDocs: 1, _count: { documents: 1 } }),
    );
    prisma.document.findFirst.mockResolvedValue({ id: 'd1', s3Key: 'k1' });
    prisma.document.count.mockResolvedValue(0);
    const r = await svc.removeFile('tok123', 'd1');
    expect(storage.remove).toHaveBeenCalledWith('k1');
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'DELETE_OK' }) }),
    );
    expect(r).toMatchObject({ readyCount: 0, status: 'PENDING' });
  });

  it('removeFile refuse sur lien expiré et document inconnu', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(
      reqFixture({ pinHash, expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(svc.removeFile('tok123', 'd1')).rejects.toBeInstanceOf(ForbiddenException);

    prisma.depositRequest.findUnique.mockResolvedValue(reqFixture({ pinHash }));
    prisma.document.findFirst.mockResolvedValue(null);
    await expect(svc.removeFile('tok123', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });

  it('downloadFile retourne une URL presignée, 404 si inconnu, 403 si expiré', async () => {
    prisma.depositRequest.findUnique.mockResolvedValue(reqFixture({ pinHash }));
    prisma.document.findFirst.mockResolvedValue({
      id: 'd1',
      filename: 'a.pdf',
      mime: 'application/pdf',
      s3Key: 'k1',
    });
    const r = await svc.downloadFile('tok123', 'd1');
    expect(r).toMatchObject({ downloadUrl: 'https://minio/get-url', filename: 'a.pdf' });
    expect(storage.presignGet).toHaveBeenCalledWith('k1', 'a.pdf');

    prisma.document.findFirst.mockResolvedValue(null);
    await expect(svc.downloadFile('tok123', 'nope')).rejects.toBeInstanceOf(NotFoundException);

    prisma.depositRequest.findUnique.mockResolvedValue(
      reqFixture({ pinHash, expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(svc.downloadFile('tok123', 'd1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
