import { MktCampaignKind, MktCampaignStatus, MktCampaignReleaseStatus, MktEntitlementPoolStatus } from '@prisma/client';
import { CampaignRepository } from './campaign.repository';
import { CampaignShellService } from './campaign-shell.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('CampaignShellService', () => {
  const campaign = {
    id: 'cmp_001',
    tenantId: '000000',
    name: '营销活动A',
    type: 'FLASH_SALE',
    kind: MktCampaignKind.HANDLER,
    description: null,
    status: MktCampaignStatus.PUBLISHED,
    startTime: new Date('2026-04-20T00:00:00.000Z'),
    endTime: new Date('2026-04-30T23:59:59.000Z'),
    priority: 0,
    policyJson: null,
    foundationJson: { startTime: '2026-04-20T00:00:00.000Z', endTime: '2026-04-30T23:59:59.000Z' },
    audienceJson: { memberTags: ['new'] },
    rightsJson: {},
    stagesJson: {},
    deliveryJson: { scene: 'HOME' },
    constraintsJson: {},
    ownerUserId: null,
    version: 1,
    createdBy: 'seed',
    updatedBy: 'seed',
    createTime: new Date('2026-04-20T00:00:00.000Z'),
    updateTime: new Date('2026-04-20T01:00:00.000Z'),
  };

  const repository = {
    findOne: jest.fn().mockResolvedValue(campaign),
  } as unknown as CampaignRepository;

  const prisma = {
    mktCampaignRelease: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'rel_001',
        releaseNo: 1,
        status: MktCampaignReleaseStatus.PUBLISHED,
        createdBy: 'seed',
        publishedAt: new Date('2026-04-20T02:00:00.000Z'),
        createTime: new Date('2026-04-20T02:00:00.000Z'),
      }),
    },
    mktCampaignEntitlementPool: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { pool: { id: 'pool_1', status: MktEntitlementPoolStatus.COMPILED } },
          { pool: { id: 'pool_2', status: MktEntitlementPoolStatus.DRAFT } },
        ]),
    },
  } as unknown as PrismaService;

  const service = new CampaignShellService(repository, prisma);

  it('应返回 7 步向导壳子定义，并且不包含权益池/试跑中心深水区', () => {
    const shell = service.getWizardShell();

    expect(shell.steps).toHaveLength(7);
    expect(shell.steps.map((item) => item.key)).toEqual([
      'foundation',
      'audience',
      'rights',
      'stages',
      'delivery',
      'precheck',
      'publish',
    ]);
    expect(shell.excludedDomains).toEqual(expect.arrayContaining(['entitlement-pool', 'test-run-center']));
  });

  it('应返回 7 个工作台 Tab，且 data-execution 只读', async () => {
    const shell = await service.getWorkbenchShell({ campaignId: 'cmp_001' });

    expect(shell.tabs.map((item) => item.key)).toEqual([
      'overview',
      'audience-rights',
      'stages-triggers',
      'delivery-scenes',
      'precheck-limits',
      'data-execution',
      'approval-logs',
    ]);
    expect(shell.tabs.find((item) => item.key === 'data-execution')?.editable).toBe(false);
  });

  it('应返回审批日志与预检发布壳子摘要', async () => {
    const approval = await service.getApprovalLogShell({ campaignId: 'cmp_001' });
    const precheck = await service.getPrecheckShell({ campaignId: 'cmp_001' });

    expect(approval).toMatchObject({
      campaignId: 'cmp_001',
      readonly: false,
    });
    expect(precheck).toMatchObject({
      campaignId: 'cmp_001',
      publishReady: true,
    });
  });
});
