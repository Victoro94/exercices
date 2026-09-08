import { StorageService } from '../../src/storage/storage.service';

function configStub(values: Record<string, string>) {
  return { get: (k: string) => values[k] } as never;
}

describe('StorageService (signature presignée)', () => {
  it('signe avec l’endpoint public : le host de l’URL correspond à celui du navigateur', async () => {
    const svc = new StorageService(
      configStub({
        S3_ENDPOINT: 'http://minio:9000',
        S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
        S3_REGION: 'eu-west-1',
        S3_ACCESS_KEY: 'minioadmin',
        S3_SECRET_KEY: 'minioadmin',
        S3_BUCKET: 'deposit-documents',
      }),
    );
    svc.onModuleInit();
    const url = await svc.presignPut('tok/id-f.pdf', 'application/pdf');
    // Pas de réécriture de host après signature : la SigV4 couvre le host,
    // l'URL doit donc naître directement avec le host public.
    expect(url.startsWith('http://localhost:9000/')).toBe(true);
    expect(url).not.toContain('minio:9000');
  });

  it('s3KeyFor neutralise les noms de fichiers dangereux', () => {
    const svc = new StorageService(configStub({}));
    const key = svc.s3KeyFor('tok', 'id', '../../etc/passwd;.pdf');
    const filename = key.slice('tok/id-'.length);
    expect(key.startsWith('tok/id-')).toBe(true);
    expect(filename).not.toContain('..');
    expect(filename).not.toContain('/');
  });

  it('ensureBucket crée le bucket puis pose la règle CORS', async () => {
    const svc = new StorageService(
      configStub({
        S3_ENDPOINT: 'http://minio:9000',
        S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
        S3_BUCKET: 'deposit-documents',
        CORS_ORIGINS: 'http://localhost:8080,https://exemple.test',
      }),
    );
    svc.onModuleInit();
    const send = jest.fn().mockResolvedValue({});
    (svc as unknown as { client: unknown }).client = { send };
    await svc.ensureBucket();
    expect(send).toHaveBeenCalledTimes(2);
    const corsCall = send.mock.calls[1][0];
    expect(corsCall.input.Bucket).toBe('deposit-documents');
    expect(corsCall.input.CORSConfiguration.CORSRules[0].AllowedOrigins).toEqual([
      'http://localhost:8080',
      'https://exemple.test',
    ]);
    expect(corsCall.input.CORSConfiguration.CORSRules[0].AllowedMethods).toContain('PUT');
  });
});
