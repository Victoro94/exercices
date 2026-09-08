import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route'],
    registers: [this.registry],
  });

  readonly pinFail = new Counter({
    name: 'pin_unlock_fail_total',
    help: 'Failed PIN unlock attempts',
    registers: [this.registry],
  });

  readonly unlockOk = new Counter({
    name: 'public_unlock_ok_total',
    help: 'Successful public PIN unlocks (anonymous clients)',
    registers: [this.registry],
  });

  readonly pinLockout = new Counter({
    name: 'pin_lockout_total',
    help: 'PIN lockouts triggered',
    registers: [this.registry],
  });

  readonly uploadFail = new Counter({
    name: 'upload_fail_total',
    help: 'Failed document uploads',
    labelNames: ['reason'],
    registers: [this.registry],
  });

  readonly requestsCreated = new Counter({
    name: 'deposit_requests_created_total',
    help: 'Deposit requests created',
    registers: [this.registry],
  });

  readonly requestsByStatus = new Gauge({
    name: 'deposit_requests_by_status',
    help: 'Deposit requests by status (last computed)',
    labelNames: ['status'],
    registers: [this.registry],
  });

  incRequestCreated() {
    this.requestsCreated.inc();
  }
  incPinFail() {
    this.pinFail.inc();
  }
  incUnlockOk() {
    this.unlockOk.inc();
  }
  incPinLockout() {
    this.pinLockout.inc();
  }
  incUploadFail(reason: string) {
    this.uploadFail.inc({ reason });
  }
}
