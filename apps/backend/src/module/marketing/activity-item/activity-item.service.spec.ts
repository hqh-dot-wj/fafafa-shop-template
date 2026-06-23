import { ActivityItemService } from './activity-item.service';
import { ActivityRepository } from '../activity/activity.repository';
import { ActivityItemRepository } from './activity-item.repository';

describe('ActivityItemService', () => {
  let service: ActivityItemService;

  const mockItemRepo = {
    findActivityById: jest.fn(),
    saveActivityItems: jest.fn(),
  } as unknown as jest.Mocked<Pick<ActivityItemRepository, 'findActivityById' | 'saveActivityItems'>>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ActivityItemService({} as ActivityRepository, mockItemRepo as unknown as ActivityItemRepository);
  });

  it('list should read activityItems from rules', async () => {
    mockItemRepo.findActivityById.mockResolvedValue({
      id: 'act-1',
      stagesJson: {
        activityItems: [
          {
            id: 'item-1',
            itemType: 'PRODUCT',
            itemCode: 'P001',
            itemName: 'item',
            enabled: true,
            sort: 1,
            config: { productId: 'p1' },
            ext: {},
            createTime: '2026-01-01T00:00:00.000Z',
            updateTime: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    } as any);

    const result = await service.list('act-1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'item-1',
      itemType: 'PRODUCT',
      itemCode: 'P001',
    });
  });

  it('create should append item and persist into rules.activityItems', async () => {
    mockItemRepo.findActivityById.mockResolvedValue({
      id: 'act-1',
      stagesJson: {},
    } as any);
    mockItemRepo.saveActivityItems.mockResolvedValue(undefined);

    const result = await service.create(
      'act-1',
      {
        itemType: 'SKU',
        itemCode: 'SKU-001',
        itemName: 'sku item',
        enabled: true,
        sort: 1,
        config: { skuId: 'sku-1' },
      },
      'u-1',
    );

    expect(result.data).toMatchObject({
      itemType: 'SKU',
      itemCode: 'SKU-001',
      itemName: 'sku item',
      enabled: true,
      sort: 1,
    });
    expect(mockItemRepo.saveActivityItems).toHaveBeenCalledWith(
      'act-1',
      {},
      expect.arrayContaining([
        expect.objectContaining({
          itemType: 'SKU',
          itemCode: 'SKU-001',
        }),
      ]),
      'u-1',
    );
  });

  it('update should patch target item and persist', async () => {
    const currentRules = {
      activityItems: [
        {
          id: 'item-1',
          itemType: 'PRODUCT',
          itemCode: 'P001',
          itemName: 'old',
          enabled: true,
          sort: 1,
          config: {},
          ext: {},
          createTime: '2026-01-01T00:00:00.000Z',
          updateTime: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    mockItemRepo.findActivityById.mockResolvedValue({
      id: 'act-1',
      stagesJson: currentRules,
    } as any);
    mockItemRepo.saveActivityItems.mockResolvedValue(undefined);

    const result = await service.update(
      'act-1',
      'item-1',
      {
        itemName: 'new-name',
        enabled: false,
      },
      'u-2',
    );

    expect(result.data).toMatchObject({
      id: 'item-1',
      itemName: 'new-name',
      enabled: false,
    });
    expect(mockItemRepo.saveActivityItems).toHaveBeenCalledWith(
      'act-1',
      currentRules,
      [
        expect.objectContaining({
          id: 'item-1',
          itemName: 'new-name',
          enabled: false,
        }),
      ],
      'u-2',
    );
  });

  it('remove should delete target item from rules.activityItems', async () => {
    const currentRules = {
      activityItems: [
        {
          id: 'item-1',
          itemType: 'PRODUCT',
          itemCode: 'P001',
          itemName: 'item-1',
          enabled: true,
          sort: 1,
          config: {},
          ext: {},
          createTime: '2026-01-01T00:00:00.000Z',
          updateTime: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'item-2',
          itemType: 'PRODUCT',
          itemCode: 'P002',
          itemName: 'item-2',
          enabled: true,
          sort: 2,
          config: {},
          ext: {},
          createTime: '2026-01-01T00:00:00.000Z',
          updateTime: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    mockItemRepo.findActivityById.mockResolvedValue({
      id: 'act-1',
      stagesJson: currentRules,
    } as any);
    mockItemRepo.saveActivityItems.mockResolvedValue(undefined);

    await service.remove('act-1', 'item-1', 'u-3');

    expect(mockItemRepo.saveActivityItems).toHaveBeenCalledWith(
      'act-1',
      currentRules,
      [expect.objectContaining({ id: 'item-2' })],
      'u-3',
    );
  });
});
