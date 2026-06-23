import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from 'src/common/exceptions';
import { ActivityRepository } from '../activity.repository';
import { TouchpointRepository } from '../touchpoint.repository';
import { TouchpointService } from '../touchpoint.service';

describe('TouchpointService', () => {
  let service: TouchpointService;

  const mockActivityRepository = {
    findById: jest.fn(),
  };

  const mockTouchpointRepository = {
    upsert: jest.fn(),
    listByActivityId: jest.fn(),
    findRuntimeTouchpointsByActivityType: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TouchpointService,
        { provide: ActivityRepository, useValue: mockActivityRepository },
        { provide: TouchpointRepository, useValue: mockTouchpointRepository },
      ],
    }).compile();

    service = module.get<TouchpointService>(TouchpointService);
    jest.clearAllMocks();

    mockActivityRepository.findById.mockResolvedValue({
      id: 'activity_001',
      tenantId: 'tenant_001',
    });
  });

  it('stores message and share touchpoints and rejects invalid kind', async () => {
    mockTouchpointRepository.upsert.mockResolvedValueOnce({
      id: 'tp_1',
      tenantId: 'tenant_001',
      activityId: 'activity_001',
      kind: 'MESSAGE',
      code: 'SUCCESS_WELCOME',
      name: 'payment success notice',
      config: {
        triggerMoment: 'INSTANCE_SUCCESS',
        channels: ['IN_APP', 'APP_PUSH'],
        templateCode: 'MKT_ACTIVITY_SUCCESS_V1',
        templateVersion: 'v1',
        consentRequired: true,
      },
      isEnabled: true,
      createTime: new Date('2026-04-19T10:00:00.000Z'),
      updateTime: new Date('2026-04-19T10:00:00.000Z'),
    });

    mockTouchpointRepository.upsert.mockResolvedValueOnce({
      id: 'tp_2',
      tenantId: 'tenant_001',
      activityId: 'activity_001',
      kind: 'SHARE',
      code: 'SHARE_HOME',
      name: 'activity share card',
      config: {
        shareChannels: ['MINIAPP', 'H5'],
        landingPagePath: '/pages/marketing/share/index',
        attributionWindowMinutes: 4320,
        bindingMode: 'RECOMMEND_CODE',
        frequencyLimit: {
          perUserPerDay: 3,
          perActivityPerDay: 1000,
        },
        suppressions: ['INVENTORY_LOCKED'],
      },
      isEnabled: true,
      createTime: new Date('2026-04-19T10:00:00.000Z'),
      updateTime: new Date('2026-04-19T10:00:00.000Z'),
    });

    await expect(
      service.upsert(
        'activity_001',
        {
          kind: 'MESSAGE',
          code: 'SUCCESS_WELCOME',
          name: 'payment success notice',
          config: {
            triggerMoment: 'INSTANCE_SUCCESS',
            channels: ['IN_APP', 'APP_PUSH'],
            templateCode: 'MKT_ACTIVITY_SUCCESS_V1',
            templateVersion: 'v1',
            consentRequired: true,
          },
        },
        'admin_1',
      ),
    ).resolves.toMatchObject({
      data: {
        kind: 'MESSAGE',
        code: 'SUCCESS_WELCOME',
      },
    });

    await expect(
      service.upsert(
        'activity_001',
        {
          kind: 'SHARE',
          code: 'SHARE_HOME',
          name: 'activity share card',
          config: {
            shareChannels: ['MINIAPP', 'H5'],
            landingPagePath: '/pages/marketing/share/index',
            attributionWindowMinutes: 4320,
            bindingMode: 'RECOMMEND_CODE',
            frequencyLimit: {
              perUserPerDay: 3,
              perActivityPerDay: 1000,
            },
            suppressions: ['INVENTORY_LOCKED'],
          },
        },
        'admin_1',
      ),
    ).resolves.toMatchObject({
      data: {
        kind: 'SHARE',
        code: 'SHARE_HOME',
      },
    });

    await expect(
      service.upsert(
        'activity_001',
        {
          kind: 'INVALID' as never,
          code: 'BAD_KIND',
          name: 'invalid kind',
          config: {},
        },
        'admin_1',
      ),
    ).rejects.toThrow(BusinessException);
  });

  it('rejects invalid share landingPagePath and suppressions config', async () => {
    await expect(
      service.upsert(
        'activity_001',
        {
          kind: 'SHARE',
          code: 'SHARE_BAD_PATH',
          name: 'invalid share path',
          config: {
            shareChannels: ['MINIAPP'],
            landingPagePath: '',
            attributionWindowMinutes: 4320,
            bindingMode: 'RECOMMEND_CODE',
          },
        },
        'admin_1',
      ),
    ).rejects.toThrow(BusinessException);

    await expect(
      service.upsert(
        'activity_001',
        {
          kind: 'SHARE',
          code: 'SHARE_BAD_SUPPRESS',
          name: 'invalid share suppressions',
          config: {
            shareChannels: ['MINIAPP'],
            landingPagePath: '/pages/marketing/share/index',
            attributionWindowMinutes: 4320,
            bindingMode: 'RECOMMEND_CODE',
            suppressions: ['VALID', 1] as unknown as string[],
          },
        },
        'admin_1',
      ),
    ).rejects.toThrow(BusinessException);
  });
});
