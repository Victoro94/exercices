import * as bcrypt from 'bcryptjs';
import { RequestsService } from './requests.service';

describe('RequestsService', () => {
  const metrics = { incRequestCreated: jest.fn() };
  const prisma: any = {
    depositRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  let svc: RequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new RequestsService(prisma, metrics as any);
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
});
