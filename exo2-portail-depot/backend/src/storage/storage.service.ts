import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  private presignClient!: S3Client;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = this.config.get<string>('S3_ENDPOINT') ?? 'http://minio:9000';
    const publicEndpoint = this.config.get<string>('S3_PUBLIC_ENDPOINT') ?? endpoint;
    const region = this.config.get<string>('S3_REGION') ?? 'eu-west-1';
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY') ?? 'minioadmin';
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY') ?? 'minioadmin';
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'deposit-documents';

    // Client interne : appels API (Head, CreateBucket...), jamais exposé au browser.
    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    // Client de signature : la signature SigV4 couvre le host, donc on signe
    // directement avec l'URL publique qu'utilisera le navigateur. Aucune
    // connexion n'est établie ici, c'est de la crypto locale.
    this.presignClient = new S3Client({
      endpoint: publicEndpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  async ensureBucket() {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name !== 'BucketAlreadyOwnedByYou' && err?.name !== 'BucketAlreadyExists') {
        this.logger.warn(`ensureBucket: ${(e as Error).message}`);
      }
    }
    // CORS indispensable au PUT direct depuis le navigateur (preflight OPTIONS).
    // Best-effort : si le stockage ne supporte pas PutBucketCors, on loggue.
    try {
      const origins = (this.config.get<string>('CORS_ORIGINS') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: origins.length > 0 ? origins : ['*'],
                AllowedMethods: ['PUT', 'GET', 'HEAD'],
                AllowedHeaders: ['*'],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3000,
              },
            ],
          },
        }),
      );
    } catch (e: unknown) {
      this.logger.warn(`ensureBucket CORS: ${(e as Error).message}`);
    }
  }

  s3KeyFor(token: string, documentId: string, filename: string): string {
    const safe = filename
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/\.{2,}/g, '.')
      .slice(0, 120);
    return `${token}/${documentId}-${safe}`;
  }

  async presignPut(s3Key: string, mime: string, expiresIn = 300): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: s3Key, ContentType: mime });
    return getSignedUrl(this.presignClient, cmd, { expiresIn });
  }

  // URL de re-téléchargement : le navigateur GET directement depuis MinIO,
  // le fichier ne transite jamais par l'API. Content-Disposition: attachment
  // pour forcer le téléchargement avec le nom d'origine.
  async presignGet(s3Key: string, filename: string, expiresIn = 300): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    });
    return getSignedUrl(this.presignClient, cmd, { expiresIn });
  }

  async exists(s3Key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: s3Key }));
      return true;
    } catch {
      return false;
    }
  }

  // Suppression best-effort : même si l'objet a déjà disparu, on ne bloque pas.
  async remove(s3Key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: s3Key }));
    } catch (e: unknown) {
      this.logger.warn(`remove ${s3Key}: ${(e as Error).message}`);
    }
  }

  get bucketName(): string {
    return this.bucket;
  }
}
