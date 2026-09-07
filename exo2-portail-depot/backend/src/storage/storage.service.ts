import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  private bucket!: string;
  private publicEndpoint!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = this.config.get<string>('S3_ENDPOINT') ?? 'http://minio:9000';
    const region = this.config.get<string>('S3_REGION') ?? 'eu-west-1';
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY') ?? 'minioadmin';
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY') ?? 'minioadmin';
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'deposit-documents';
    this.publicEndpoint = this.config.get<string>('S3_PUBLIC_ENDPOINT') ?? endpoint;

    this.client = new S3Client({
      endpoint,
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
  }

  s3KeyFor(token: string, documentId: string, filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
    return `${token}/${documentId}-${safe}`;
  }

  async presignPut(s3Key: string, mime: string, expiresIn = 300): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: s3Key, ContentType: mime });
    const url = await getSignedUrl(this.client, cmd, { expiresIn });
    const internalEndpoint = this.config.get<string>('S3_ENDPOINT') ?? 'http://minio:9000';
    if (this.publicEndpoint !== internalEndpoint) {
      return url.replace(internalEndpoint, this.publicEndpoint);
    }
    return url;
  }

  async exists(s3Key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: s3Key }));
      return true;
    } catch {
      return false;
    }
  }

  get bucketName(): string {
    return this.bucket;
  }
}
