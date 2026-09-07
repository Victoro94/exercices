/**
 * Tests HTTP : au moins un test par code retour de l'API.
 * App Nest complète (supertest), Prisma remplacé par un fake en mémoire,
 * stockage objet mocké. Couvre 200 / 201 / 400 / 401 / 403 / 404 / 429.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getStorageToken } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './storage/storage.service';

process.env.JWT_SECRET = 'test-secret';

function makeFakeDb() {
  const state: { users: any[]; requests: any[]; documents: any[]; audit: any[]; seq: number } = {
    users: [
      {
        id: 'u1',
        email: 'avocat@example.test',
        passwordHash: bcrypt.hashSync('Secret123!', 4),
      },
    ],
    requests: [],
    documents: [],
    audit: [],
    seq: 1,
  };
  const readyCount = (requestId: string) =>
    state.documents.filter((d) => d.requestId === requestId && d.status === 'READY').length;
  const withCount = (r: any) => (r ? { ...r, _count: { documents: readyCount(r.id) } } : r);
  const matches = (row: any, where: any) =>
    Object.entries(where ?? {}).every(([k, v]) => row[k] === v);

  return {
    state,
    user: {
      findUnique: async ({ where }: any) =>
        state.users.find((u) => u.email === where.email) ?? null,
    },
    depositRequest: {
      create: async ({ data }: any) => {
        const r = {
          id: `r${state.seq++}`,
          failedAttempts: 0,
          lockedUntil: null,
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.requests.push(r);
        return r;
      },
      findUnique: async ({ where }: any) =>
        withCount(state.requests.find((r) => matches(r, where)) ?? null),
      findFirst: async ({ where }: any) =>
        withCount(state.requests.find((r) => matches(r, where)) ?? null),
      findMany: async ({ where }: any) =>
        state.requests.filter((r) => matches(r, where)).map(withCount),
      update: async ({ where, data }: any) => {
        const r = state.requests.find((x) => matches(x, where));
        Object.assign(r, data);
        return r;
      },
      deleteMany: async ({ where }: any) => {
        const before = state.requests.length;
        state.requests = state.requests.filter((r) => !matches(r, where));
        return { count: before - state.requests.length };
      },
    },
    document: {
      create: async ({ data }: any) => {
        const d = { status: 'PENDING', createdAt: new Date(), ...data };
        state.documents.push(d);
        return d;
      },
      findFirst: async ({ where }: any) =>
        state.documents.find((d) => matches(d, where)) ?? null,
      update: async ({ where, data }: any) => {
        const d = state.documents.find((x) => matches(x, where));
        Object.assign(d, data);
        return d;
      },
      count: async ({ where }: any) => state.documents.filter((d) => matches(d, where)).length,
    },
    auditLog: {
      create: async ({ data }: any) => {
        const a = { id: `a${state.seq++}`, createdAt: new Date(), ...data };
        state.audit.push(a);
        return a;
      },
    },
  };
}

describe('API : un test par code HTTP', () => {
  let app: INestApplication;
  let fake: ReturnType<typeof makeFakeDb>;
  let storageMock: any;
  let lawyerToken = '';
  let tokenA = '';
  let sessionA = '';

  beforeAll(async () => {
    fake = makeFakeDb();
    // Demandes pré-existantes : une expirée, une verrouillée (403)
    const pinHash = bcrypt.hashSync('9999', 4);
    fake.state.requests.push(
      {
        id: 'rx',
        title: 'Expirée',
        token: 'expiredtok',
        pinHash,
        expectedDocs: 4,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000),
        failedAttempts: 0,
        lockedUntil: null,
        userId: 'u1',
        createdAt: new Date(),
      },
      {
        id: 'rl',
        title: 'Verrouillée',
        token: 'lockedtokk',
        pinHash,
        expectedDocs: 4,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() + 600000),
        userId: 'u1',
        createdAt: new Date(),
      },
    );
    storageMock = {
      ensureBucket: jest.fn(),
      presignPut: jest.fn(async () => 'http://minio.test/put'),
      exists: jest.fn(async () => true),
      s3KeyFor: jest.fn((t: string, id: string, f: string) => `${t}/${id}-${f}`),
      bucketName: 'test',
    };

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fake)
      .overrideProvider(StorageService)
      .useValue(storageMock)
      // Le rate-limit est testé à part sur une app dédiée (compteur partagé sinon).
      // On neutralise le storage du throttle : jamais bloqué sur l'app principale.
      .overrideProvider(getStorageToken())
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 60,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ---- 200 ----
  it('GET /api/health -> 200', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('GET /api/metrics -> 200', async () => {
    await request(app.getHttpServer()).get('/api/metrics').expect(200);
  });

  it('POST /api/auth/login OK -> 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'avocat@example.test', password: 'Secret123!' })
      .expect(200);
    expect(res.body.access_token).toBeDefined();
    lawyerToken = res.body.access_token;
  });

  // ---- 201 ----
  it('POST /api/requests OK -> 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/requests')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ title: 'Dossier A', pin: '4816', expectedDocs: 4 })
      .expect(201);
    expect(res.body.publicUrlPath).toMatch(/^\/d\//);
    tokenA = res.body.token;
  });

  it('GET /api/requests -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/requests')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/public/:token/unlock OK -> 200', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/unlock`)
      .send({ pin: '4816' })
      .expect(200);
    expect(res.body.session).toBeDefined();
    sessionA = res.body.session;
  });

  it('POST /api/public/:token/files/presign OK -> 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/files/presign`)
      .set('Authorization', `Bearer ${sessionA}`)
      .send({ filename: 'a.pdf', mime: 'application/pdf', size: 100 })
      .expect(201);
    expect(res.body.uploadUrl).toBe('http://minio.test/put');
  });

  // ---- 400 ----
  it('POST /api/requests PIN invalide -> 400', async () => {
    await request(app.getHttpServer())
      .post('/api/requests')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ title: 'Dossier B', pin: '12' })
      .expect(400);
  });

  it('POST unlock PIN mal formé -> 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/unlock`)
      .send({ pin: 'abc' })
      .expect(400);
  });

  it('POST presign mime refusé -> 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/files/presign`)
      .set('Authorization', `Bearer ${sessionA}`)
      .send({ filename: 'a.exe', mime: 'application/x-msdownload', size: 10 })
      .expect(400);
  });

  it('POST complete objet absent de MinIO -> 400', async () => {
    const pre = await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/files/presign`)
      .set('Authorization', `Bearer ${sessionA}`)
      .send({ filename: 'b.pdf', mime: 'application/pdf', size: 10 })
      .expect(201);
    storageMock.exists.mockResolvedValueOnce(false);
    await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/files/${pre.body.documentId}/complete`)
      .set('Authorization', `Bearer ${sessionA}`)
      .send({})
      .expect(400);
  });

  // ---- 401 ----
  it('POST /api/auth/login mauvais password -> 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'avocat@example.test', password: 'Mauvais123!' })
      .expect(401);
  });

  it('GET /api/requests sans JWT -> 401', async () => {
    await request(app.getHttpServer()).get('/api/requests').expect(401);
  });

  it('POST unlock mauvais PIN -> 401', async () => {
    await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/unlock`)
      .send({ pin: '0000' })
      .expect(401);
  });

  it('POST presign sans session publique -> 401', async () => {
    await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/files/presign`)
      .send({ filename: 'a.pdf', mime: 'application/pdf', size: 10 })
      .expect(401);
  });

  it('POST presign avec JWT avocat (mauvais scope) -> 401', async () => {
    await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/files/presign`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ filename: 'a.pdf', mime: 'application/pdf', size: 10 })
      .expect(401);
  });

  // ---- 403 ----
  it('POST unlock lien expiré -> 403', async () => {
    await request(app.getHttpServer())
      .post('/api/public/expiredtok/unlock')
      .send({ pin: '9999' })
      .expect(403);
  });

  it('POST unlock lien verrouillé -> 403', async () => {
    await request(app.getHttpServer())
      .post('/api/public/lockedtokk/unlock')
      .send({ pin: '9999' })
      .expect(403);
  });

  it('POST presign sur lien expiré -> 403', async () => {
    const jwt = new JwtService({ secret: 'test-secret' });
    const session = await jwt.signAsync(
      { scope: 'public-deposit', token: 'expiredtok' },
      { expiresIn: '15m' },
    );
    await request(app.getHttpServer())
      .post('/api/public/expiredtok/files/presign')
      .set('Authorization', `Bearer ${session}`)
      .send({ filename: 'a.pdf', mime: 'application/pdf', size: 10 })
      .expect(403);
  });

  // ---- 404 ----
  it('GET /api/public/:token inconnu -> 404', async () => {
    await request(app.getHttpServer()).get('/api/public/nope-nope').expect(404);
  });

  it('POST unlock token inconnu -> 404', async () => {
    await request(app.getHttpServer())
      .post('/api/public/nope-nope/unlock')
      .send({ pin: '1234' })
      .expect(404);
  });

  it('GET /api/requests/:id inconnu -> 404', async () => {
    await request(app.getHttpServer())
      .get('/api/requests/req-inexistante')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .expect(404);
  });

  it('POST complete document inconnu -> 404', async () => {
    await request(app.getHttpServer())
      .post(`/api/public/${tokenA}/files/doc-inconnu/complete`)
      .set('Authorization', `Bearer ${sessionA}`)
      .send({})
      .expect(404);
  });

  it('route inconnue -> 404', async () => {
    await request(app.getHttpServer()).get('/api/route-inexistante').expect(404);
  });

  // ---- 200 (fin de parcours) + 429 ----
  it('parcours complet : complete OK -> 200 COMPLETE', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/requests')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ title: 'Dossier Solo', pin: '1357', expectedDocs: 1 })
      .expect(201);
    const unlocked = await request(app.getHttpServer())
      .post(`/api/public/${created.body.token}/unlock`)
      .send({ pin: '1357' })
      .expect(200);
    const pre = await request(app.getHttpServer())
      .post(`/api/public/${created.body.token}/files/presign`)
      .set('Authorization', `Bearer ${unlocked.body.session}`)
      .send({ filename: 'solo.pdf', mime: 'application/pdf', size: 10 })
      .expect(201);
    const done = await request(app.getHttpServer())
      .post(`/api/public/${created.body.token}/files/${pre.body.documentId}/complete`)
      .set('Authorization', `Bearer ${unlocked.body.session}`)
      .send({})
      .expect(200);
    expect(done.body).toMatchObject({ status: 'COMPLETE', readyCount: 1 });
  });

  it('flood unlock (6 tentatives) -> 429', async () => {
    // App dédiée au rate-limit : le compteur du throttle est par instance,
    // sur l'app principale les autres tests l'auraient déjà consommé.
    const fake2 = makeFakeDb();
    const module2 = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fake2)
      .overrideProvider(StorageService)
      .useValue(storageMock)
      .compile();
    const app2 = module2.createNestApplication();
    app2.setGlobalPrefix('api');
    app2.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app2.init();
    try {
      const login = await request(app2.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'avocat@example.test', password: 'Secret123!' })
        .expect(200);
      const created = await request(app2.getHttpServer())
        .post('/api/requests')
        .set('Authorization', `Bearer ${login.body.access_token}`)
        .send({ title: 'Dossier Flood', pin: '2468' })
        .expect(201);
      const codes: number[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await request(app2.getHttpServer())
          .post(`/api/public/${created.body.token}/unlock`)
          .send({ pin: '0000' });
        codes.push(r.status);
      }
      expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(codes[5]).toBe(429);
    } finally {
      await app2.close();
    }
  });
});
