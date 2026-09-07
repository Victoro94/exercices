import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL manquante. Copie backend/.env.example vers backend/.env (cp .env.example .env).',
    );
  }
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: false,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Backend listening on :${port}`);
}
bootstrap();
