import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('les compteurs et jauges remontent dans le registre', async () => {
    const svc = new MetricsService();
    svc.incRequestCreated();
    svc.incPinFail();
    svc.incPinLockout();
    svc.incUploadFail('mime');
    svc.requestsByStatus.set({ status: 'PENDING' }, 2);

    const out = await svc.registry.metrics();
    expect(out).toContain('deposit_requests_created_total 1');
    expect(out).toContain('pin_unlock_fail_total 1');
    expect(out).toContain('pin_lockout_total 1');
    expect(out).toContain('upload_fail_total{reason="mime"} 1');
    expect(out).toContain('deposit_requests_by_status{status="PENDING"} 2');
  });
});
