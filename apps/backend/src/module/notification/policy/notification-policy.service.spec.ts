import { NotificationDispatchContext } from '../interfaces/notification-dispatch-context.types';
import { NotificationPolicyService } from './notification-policy.service';

describe('NotificationPolicyService', () => {
  let service: NotificationPolicyService;

  const baseContext: NotificationDispatchContext = {
    tenantId: '000000',
    bizType: 'MARKETING_ACTIVITY',
    bizRefId: 'activity_001',
    activityId: 'activity_001',
    touchpointCode: 'SUCCESS_WELCOME',
    touchpointKind: 'MESSAGE',
    channel: 'IN_APP',
    templateCode: 'MKT_ACTIVITY_SUCCESS_V1',
    templateVersion: 'v1',
    consentGranted: true,
    requestedAt: new Date('2026-04-19T10:00:00+08:00'),
  };

  beforeEach(() => {
    service = new NotificationPolicyService();
  });

  it('rejects notification in quiet hours', () => {
    const decision = service.evaluate({
      ...baseContext,
      requestedAt: new Date('2026-04-19T23:15:00+08:00'),
      quietHours: { start: '22:00', end: '08:00', timezone: 'Asia/Shanghai' },
      frequency: { key: 'mkt:activity_001:SUCCESS_WELCOME', limitPerDay: 3, sentToday: 0 },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('QUIET_HOURS');
    expect(decision.snapshot.quietHoursMatched).toBe(true);
  });

  it('rejects notification when consent is missing', () => {
    const decision = service.evaluate({
      ...baseContext,
      consentGranted: false,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('CONSENT_REQUIRED');
    expect(decision.snapshot.consentGranted).toBe(false);
  });

  it('rejects notification when frequency is exceeded', () => {
    const decision = service.evaluate({
      ...baseContext,
      frequency: { key: 'mkt:activity_001:SUCCESS_WELCOME', limitPerDay: 2, sentToday: 2 },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('FREQUENCY_LIMIT');
    expect(decision.snapshot.frequencyExceeded).toBe(true);
  });

  it('rejects notification when suppression is matched', () => {
    const decision = service.evaluate({
      ...baseContext,
      suppression: { suppressed: true, reason: 'blacklist' },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('SUPPRESSED');
    expect(decision.snapshot.suppressionMatched).toBe(true);
  });

  it('allows notification when all checks pass', () => {
    const decision = service.evaluate({
      ...baseContext,
      quietHours: { start: '22:00', end: '08:00', timezone: 'Asia/Shanghai' },
      frequency: { key: 'mkt:activity_001:SUCCESS_WELCOME', limitPerDay: 3, sentToday: 1 },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
    expect(decision.snapshot.allowed).toBe(true);
  });
});
