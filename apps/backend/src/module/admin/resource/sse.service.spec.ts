import { SseService } from './sse.service';

describe('SseService', () => {
  let service: SseService;

  beforeEach(() => {
    service = new SseService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('Given target 为纯数字, When pushInAppNotification, Then 向对应 userId 连接推送', (done) => {
    const obs = service.addClient('c1', 5, '000000');
    obs.subscribe({
      next: (ev) => {
        expect((ev as MessageEvent).data).toContain('in_app_message');
        done();
      },
    });

    service.pushInAppNotification({
      target: '5',
      tenantId: '000000',
      payload: JSON.stringify({ kind: 'in_app_message' }),
    });
  });

  it('Given target 与 tenantId 相同, When pushInAppNotification, Then 向该租户下连接推送', (done) => {
    const obs = service.addClient('c2', 9, '000000');
    obs.subscribe({
      next: (ev) => {
        expect((ev as MessageEvent).data).toBe('tenant-wide');
        done();
      },
    });

    service.pushInAppNotification({
      target: '000000',
      tenantId: '000000',
      payload: 'tenant-wide',
    });
  });

  it('Given target 与 tenantId 相同但连接租户不一致, When pushInAppNotification, Then 不推送', (done) => {
    const obs = service.addClient('c3', 9, '111111');
    const received: string[] = [];
    const sub = obs.subscribe({
      next: (ev) => {
        received.push(String((ev as MessageEvent).data));
      },
    });

    service.pushInAppNotification({
      target: '000000',
      tenantId: '000000',
      payload: 'x',
    });

    setImmediate(() => {
      expect(received).toHaveLength(0);
      sub.unsubscribe();
      done();
    });
  });
});
