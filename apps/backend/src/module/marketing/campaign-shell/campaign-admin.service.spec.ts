import { MktCampaignStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { CampaignAdminService } from './campaign-admin.service';

const createCampaignRow = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'campaign-1',
    tenantId: 'tenant-1',
    type: 'FULL_REDUCTION',
    kind: 'POLICY',
    name: 'Campaign',
    description: null,
    status: MktCampaignStatus.PUBLISHED,
    startTime: null,
    endTime: null,
    priority: 0,
    policyJson: {},
    foundationJson: {},
    audienceJson: {},
    rightsJson: {},
    stagesJson: {},
    deliveryJson: {},
    constraintsJson: {},
    ownerUserId: null,
    createdBy: 'admin',
    updatedBy: 'admin',
    createTime: new Date('2026-05-01T00:00:00.000Z'),
    updateTime: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  }) as any;

describe('CampaignAdminService', () => {
  const repository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const prisma = {
    sysTenant: {
      findMany: jest.fn(),
    },
  };
  let service: CampaignAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CampaignAdminService(repository as never, prisma as never);
  });

  describe('invariants', () => {
    it('rejects duplicate activity item ids without updating the campaign', async () => {
      repository.findOne.mockResolvedValue(
        createCampaignRow({
          stagesJson: {
            activityItems: [
              { id: 'item-1', itemType: 'SKU', itemCode: 'sku-1', itemName: 'A', enabled: true, sort: 1 },
            ],
          },
        }),
      );

      await expect(service.createItem('campaign-1', { activityItemId: 'item-1' }, 'admin')).rejects.toThrow(
        BusinessException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('stores activity items sorted by sort value', async () => {
      repository.findOne.mockResolvedValue(
        createCampaignRow({
          stagesJson: {
            activityItems: [
              { id: 'item-2', itemType: 'SKU', itemCode: 'sku-2', itemName: 'B', enabled: true, sort: 20 },
            ],
          },
        }),
      );
      repository.update.mockResolvedValue(createCampaignRow());

      await service.createItem('campaign-1', { activityItemId: 'item-1', sort: 10 }, 'admin');

      expect(repository.update).toHaveBeenCalledWith(
        'campaign-1',
        expect.objectContaining({
          stagesJson: expect.objectContaining({
            activityItems: [expect.objectContaining({ id: 'item-1' }), expect.objectContaining({ id: 'item-2' })],
          }),
          updatedBy: 'admin',
        }),
      );
    });
  });

  describe('boundary conditions', () => {
    it('defaults blank activity item fields to stable values', async () => {
      repository.findOne.mockResolvedValue(createCampaignRow({ stagesJson: {} }));
      repository.update.mockResolvedValue(createCampaignRow());

      const result = await service.createItem(
        'campaign-1',
        { activityItemId: 'item-1', itemType: ' ', itemCode: '', enabled: undefined },
        'admin',
      );

      expect(result.data).toMatchObject({
        id: 'item-1',
        itemType: 'GENERIC',
        itemCode: 'item-1',
        enabled: true,
        sort: 1,
      });
    });
  });
});
