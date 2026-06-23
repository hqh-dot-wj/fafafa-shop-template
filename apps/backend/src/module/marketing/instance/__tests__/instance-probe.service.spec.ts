import { Test, TestingModule } from '@nestjs/testing';
import { PlayInstanceStatus } from '@prisma/client';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PlayInstanceRepository } from '../instance.repository';
import { InstanceProbeService } from '../instance-probe.service';

describe('InstanceProbeService', () => {
  let service: InstanceProbeService;

  const mockRepo = {
    findProbeBase: jest.fn(),
  };

  const mockRedisClient = {
    lrange: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const buildSnapshot = (type: string, timestamp: string, sourceStep: string) =>
    JSON.stringify({
      type,
      instanceId: 'ins-1',
      configId: 'cfg-1',
      memberId: 'm-1',
      traceId: 'trace-001',
      sourceStep,
      payload: { step: sourceStep },
      timestamp,
    });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstanceProbeService,
        { provide: PlayInstanceRepository, useValue: mockRepo },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get(InstanceProbeService);
    jest.clearAllMocks();
  });

  it('Given recent events 包含创建/支付/成功, When getProbe, Then timeline 按时间排序且 code 正确映射', async () => {
    mockRepo.findProbeBase.mockResolvedValue({
      id: 'ins-1',
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.SUCCESS,
      orderSn: 'SO-1',
      orderId: 'ORD-1',
      createTime: new Date('2026-03-02T08:00:00.000Z'),
      payTime: new Date('2026-03-02T09:00:00.000Z'),
      endTime: new Date('2026-03-02T10:00:00.000Z'),
      updateTime: new Date('2026-03-02T10:01:00.000Z'),
      instanceData: {},
    });
    mockRedisClient.lrange.mockResolvedValue([
      buildSnapshot('instance.success', '2026-03-02T10:00:00.000Z', 'instance.success'),
      buildSnapshot('instance.paid', '2026-03-02T09:00:00.000Z', 'instance.paid'),
      buildSnapshot('instance.created', '2026-03-02T08:00:00.000Z', 'instance.create'),
    ]);

    const result = await service.getProbe({ tenantId: 't-1', instanceId: 'ins-1' });

    expect(mockRepo.findProbeBase).toHaveBeenCalledWith('t-1', 'ins-1');
    expect(result.data.timeline.map((item) => item.code)).toEqual([
      'INSTANCE_CREATED',
      'INSTANCE_PAID',
      'INSTANCE_SUCCESS',
    ]);
    expect(result.data.timeline.map((item) => item.sourceStep)).toEqual([
      'instance.create',
      'instance.paid',
      'instance.success',
    ]);
  });

  it('Given 时间线完整且状态一致, When getProbe, Then 不返回异常', async () => {
    mockRepo.findProbeBase.mockResolvedValue({
      id: 'ins-1',
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.SUCCESS,
      createTime: new Date('2026-03-02T08:00:00.000Z'),
      payTime: new Date('2026-03-02T09:00:00.000Z'),
      endTime: new Date('2026-03-02T10:00:00.000Z'),
      updateTime: new Date('2026-03-02T10:01:00.000Z'),
      instanceData: {},
    });
    mockRedisClient.lrange.mockResolvedValue([
      buildSnapshot('instance.success', '2026-03-02T10:00:00.000Z', 'instance.success'),
      buildSnapshot('instance.paid', '2026-03-02T09:00:00.000Z', 'instance.paid'),
      buildSnapshot('instance.created', '2026-03-02T08:00:00.000Z', 'instance.create'),
    ]);

    const result = await service.getProbe({ tenantId: 't-1', instanceId: 'ins-1' });

    expect(result.data.hasAbnormalities).toBe(false);
    expect(result.data.abnormalities).toEqual([]);
  });

  it('Given 成功状态缺少支付/成功事件, When getProbe, Then 返回异常', async () => {
    mockRepo.findProbeBase.mockResolvedValue({
      id: 'ins-1',
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.SUCCESS,
      createTime: new Date('2026-03-02T08:00:00.000Z'),
      payTime: new Date('2026-03-02T09:00:00.000Z'),
      endTime: new Date('2026-03-02T10:00:00.000Z'),
      updateTime: new Date('2026-03-02T10:01:00.000Z'),
      instanceData: {},
    });
    mockRedisClient.lrange.mockResolvedValue([
      buildSnapshot('instance.created', '2026-03-02T08:00:00.000Z', 'instance.create'),
    ]);

    const result = await service.getProbe({ tenantId: 't-1', instanceId: 'ins-1' });

    expect(result.data.hasAbnormalities).toBe(true);
    expect(result.data.abnormalities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PROBE_STEP_MISSING', message: '缺少实例支付事件' }),
        expect.objectContaining({ code: 'PROBE_STEP_MISSING', message: '缺少实例成功事件' }),
      ]),
    );
  });
});
