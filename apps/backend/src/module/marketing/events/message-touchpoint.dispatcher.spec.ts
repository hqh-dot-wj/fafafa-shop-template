import { RedisService } from 'src/module/common/redis/redis.service';
import { MessageTouchpointDispatcher } from './message-touchpoint.dispatcher';
import { MarketingEvent, MarketingEventType } from './marketing-event.types';
import { TouchpointOrchestratorService } from './touchpoint-orchestrator.service';

describe('MessageTouchpointDispatcher', () => {
  let dispatcher: MessageTouchpointDispatcher;
  let redisService: { getClient: jest.Mock };
  let touchpointOrchestrator: { dispatch: jest.Mock };
  let redisClient: { multi: jest.Mock };
  let multi: {
    incr: jest.Mock;
    lpush: jest.Mock;
    ltrim: jest.Mock;
    expire: jest.Mock;
    exec: jest.Mock;
  };

  const buildEvent = (type: MarketingEventType): MarketingEvent => ({
    type,
    tenantId: 'tenant-1',
    instanceId: 'instance-1',
    configId: 'config-1',
    memberId: 'member-1',
    payload: { amount: 100 },
    timestamp: new Date('2026-05-15T12:00:00.000Z'),
  });

  beforeEach(() => {
    multi = {
      incr: jest.fn().mockReturnThis(),
      lpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redisClient = {
      multi: jest.fn().mockReturnValue(multi),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    };
    touchpointOrchestrator = {
      dispatch: jest.fn().mockResolvedValue({ planned: 1, sent: 1, skipped: 0 }),
    };
    dispatcher = new MessageTouchpointDispatcher(
      redisService as unknown as RedisService,
      touchpointOrchestrator as unknown as TouchpointOrchestratorService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records stats and dispatches touchpoint events', async () => {
    const event = buildEvent(MarketingEventType.INSTANCE_PAID);

    await dispatcher.dispatch(event);

    expect(multi.incr).toHaveBeenCalledWith('mkt:event:stats:tenant-1:20260515:total');
    expect(multi.incr).toHaveBeenCalledWith(`mkt:event:stats:tenant-1:20260515:${MarketingEventType.INSTANCE_PAID}`);
    expect(multi.lpush).toHaveBeenCalledWith(
      'mkt:event:recent:tenant-1',
      expect.stringContaining('"type":"instance.paid"'),
    );
    expect(multi.exec).toHaveBeenCalledTimes(1);
    expect(touchpointOrchestrator.dispatch).toHaveBeenCalledWith({ event });
  });

  it('records stats but skips non-touchpoint events', async () => {
    const event = buildEvent(MarketingEventType.INSTANCE_CREATED);

    await dispatcher.dispatch(event);

    expect(multi.exec).toHaveBeenCalledTimes(1);
    expect(touchpointOrchestrator.dispatch).not.toHaveBeenCalled();
  });

  it('does not throw when touchpoint orchestration fails', async () => {
    const event = buildEvent(MarketingEventType.INSTANCE_PAID);
    touchpointOrchestrator.dispatch.mockRejectedValueOnce(new Error('orchestrator failed'));

    await expect(dispatcher.dispatch(event)).resolves.toBeUndefined();

    expect(multi.exec).toHaveBeenCalledTimes(1);
  });

  it('does not throw when stats recording fails', async () => {
    const event = buildEvent(MarketingEventType.INSTANCE_PAID);
    multi.exec.mockRejectedValueOnce(new Error('redis failed'));

    await expect(dispatcher.dispatch(event)).resolves.toBeUndefined();

    expect(touchpointOrchestrator.dispatch).toHaveBeenCalledWith({ event });
  });
});
