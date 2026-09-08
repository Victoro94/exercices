import * as bcrypt from 'bcryptjs';
import { RequestsService } from '../../src/requests/requests.service';

describe('RequestsService', () => {
  const metrics = { incRequestCreated: jest.fn() };
  const storage = { presignGet: jest.fn().mockResolvedValue('https://minio/get-url') };
  const prisma: any = {
    depositRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    document: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
  let svc: RequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new RequestsService(prisma, metrics as any, storage as any);
  });

  it('create génère un token hex, hash le PIN, expire à J+7', async () => {
    prisma.depositRequest.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      id: 'r1',
      createdAt: new Date(),
    }));
    const r: any = await svc.create('u1', { title: 'Dossier X', pin: '4816' });

    expect(r.token).toMatch(/^[0-9a-f]{10}$/);
    const stored = prisma.depositRequest.create.mock.calls[0][0].data;
    expect(stored.pinHash).not.toContain('4816');
    await expect(bcrypt.compare('4816', stored.pinHash)).resolves.toBe(true);
    const days = (new Date(stored.expiresAt).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    expect(stored.status).toBe('PENDING');
    expect(r.publicUrlPath).toBe(`/d/${r.token}`);
    expect(metrics.incRequestCreated).toHaveBeenCalledTimes(1);
  });

  it('list bascule en EXPIRED et persiste le drift', async () => {
    prisma.depositRequest.findMany.mockResolvedValue([
      {
        id: 'r1',
        title: 'Vieux',
        token: 'abc',
        expectedDocs: 4,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
        _count: { documents: 4 },
      },
    ]);
    const rows: any[] = (await svc.list('u1')) as any[];
    expect(rows[0].status).toBe('EXPIRED');
    expect(prisma.depositRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'EXPIRED' },
    });
  });

  it('list ne persiste rien quand le statut est déjà correct', async () => {
    prisma.depositRequest.findMany.mockResolvedValue([
      {
        id: 'r2',
        title: 'En cours',
        token: 'def',
        expectedDocs: 4,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        _count: { documents: 1 },
      },
    ]);
    const rows: any[] = (await svc.list('u1')) as any[];
    expect(rows[0].status).toBe('PENDING');
    expect(prisma.depositRequest.update).not.toHaveBeenCalled();
  });

  it('update prolonge l’expiration et réveille une demande expirée', async () => {
    prisma.depositRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: 'Vieux',
      token: 'abc',
      expectedDocs: 4,
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      _count: { documents: 0 },
    });
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    prisma.depositRequest.update.mockResolvedValue({ expiresAt: new Date(future) });
    const r: any = await svc.update('u1', 'r1', { expiresAt: future });
    expect(prisma.depositRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { expiresAt: new Date(future) },
    });
    expect(r.status).toBe('PENDING');
    expect(r.expiresAt).toEqual(new Date(future));
  });

  it('update sur demande inconnue -> 404', async () => {
    prisma.depositRequest.findFirst.mockResolvedValue(null);
    await expect(svc.update('u1', 'nope', { title: 'X' })).rejects.toThrow('Demande inconnue');
  });

  it('listFiles avocat : ownership + sans s3Key, 404 si pas à lui', async () => {
    prisma.depositRequest.findFirst.mockResolvedValue({ id: 'r1' });
    prisma.document.findMany.mockResolvedValue([
      { id: 'd1', filename: 'a.pdf', mime: 'application/pdf', size: 10, s3Key: 'k', createdAt: new Date() },
    ]);
    const rows = await svc.listFiles('u1', 'r1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('s3Key');

    prisma.depositRequest.findFirst.mockResolvedValue(null);
    await expect(svc.listFiles('u1', 'nope')).rejects.toThrow('Demande inconnue');
  });

  it('downloadFile avocat : URL presignée, 404 si doc ou demande inconnus', async () => {
    prisma.depositRequest.findFirst.mockResolvedValue({ id: 'r1' });
    prisma.document.findFirst.mockResolvedValue({ id: 'd1', filename: 'a.pdf', mime: 'application/pdf', s3Key: 'k' });
    const r = await svc.downloadFile('u1', 'r1', 'd1');
    expect(r).toMatchObject({ downloadUrl: 'https://minio/get-url', filename: 'a.pdf' });
    expect(storage.presignGet).toHaveBeenCalledWith('k', 'a.pdf');

    prisma.document.findFirst.mockResolvedValue(null);
    await expect(svc.downloadFile('u1', 'r1', 'nope')).rejects.toThrow('Document inconnu');
  });

  it('getOne inclut les documents sans s3Key', async () => {
    prisma.depositRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: 'D',
      token: 'tok',
      expectedDocs: 4,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      _count: { documents: 1 },
      documents: [
        { id: 'd1', filename: 'a.pdf', mime: 'application/pdf', size: 10, s3Key: 'k', createdAt: new Date() },
      ],
    });
    const r: any = await svc.getOne('u1', 'r1');
    expect(r.documents).toHaveLength(1);
    expect(r.documents[0]).not.toHaveProperty('s3Key');
  });

  it('update peut basculer COMPLETE en réduisant expectedDocs', async () => {
    prisma.depositRequest.findFirst.mockResolvedValue({
      id: 'r1',
      title: 'D',
      token: 'tok',
      expectedDocs: 4,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      _count: { documents: 2 },
    });
    prisma.depositRequest.update.mockResolvedValue({ expectedDocs: 2 });
    const r: any = await svc.update('u1', 'r1', { expectedDocs: 2 });
    expect(r.status).toBe('COMPLETE');
  });

  it('remove supprime en scopant par avocat', async () => {
    prisma.depositRequest.deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const r = await svc.remove('u1', 'r1');
    expect(r).toEqual({ deleted: true });
    expect(prisma.depositRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: 'r1', userId: 'u1' },
    });
  });

  it('expireOverdue bascule les demandes périmées', async () => {
    prisma.depositRequest.findMany.mockResolvedValue([{ id: 'rx' }]);
    await svc.expireOverdue();
    expect(prisma.depositRequest.update).toHaveBeenCalledWith({
      where: { id: 'rx' },
      data: { status: 'EXPIRED' },
    });
  });
});
