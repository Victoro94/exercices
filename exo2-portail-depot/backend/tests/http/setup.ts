import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getStorageToken } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { StorageService } from '../../src/storage/storage.service';
import type { FakeDb } from './fake-db';

process.env.JWT_SECRET = 'test-secret';

export function makeStorageMock() {
  return {
    ensureBucket: jest.fn(),
    presignPut: jest.fn(async () => 'http://minio.test/put'),
    presignGet: jest.fn(async () => 'http://minio.test/get'),
    exists: jest.fn(async () => true),
    remove: jest.fn(async () => undefined),
    s3KeyFor: jest.fn((t: string, id: string, f: string) => `${t}/${id}-${f}`),
    bucketName: 'test',
  };
}

/**
 * Monte l'app Nest complète (supertest) avec Prisma et S3 mockés.
 * throttle=false neutralise le rate-limit (compteur partagé entre tests) ;
 * laisser true pour tester le 429 sur une app dédiée.
 */
export async function createTestApp(
  fake: FakeDb,
  storageMock: unknown,
  throttle = false,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(fake)
    .overrideProvider(StorageService)
    .useValue(storageMock);
  if (!throttle) {
    builder = builder
      .overrideProvider(getStorageToken())
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 60,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      });
  }
  const module = await builder.compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
}

export async function loginAsLawyer(server: any): Promise<string> {
  const res = await request(server)
    .post('/api/auth/login')
    .send({ email: 'avocat@example.test', password: 'Secret123!' })
    .expect(200);
  return res.body.access_token as string;
}

export async function createDeposit(server: any, token: string, dto: object): Promise<any> {
  const res = await request(server)
    .post('/api/requests')
    .set('Authorization', `Bearer ${token}`)
    .send(dto)
    .expect(201);
  return res.body;
}
