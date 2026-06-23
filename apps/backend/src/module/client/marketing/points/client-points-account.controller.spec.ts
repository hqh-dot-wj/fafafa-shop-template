import { ClientPointsAccountController } from './client-points-account.controller';

describe('ClientPointsAccountController', () => {
  const accountService = {
    getBalance: jest.fn(),
    getTransactions: jest.fn(),
    getExpiringPoints: jest.fn(),
  };
  const assetQueryService = {
    getLots: jest.fn(),
    getFreezeAllocations: jest.fn(),
    getConsumeAllocations: jest.fn(),
    getRefundAllocations: jest.fn(),
  };

  let controller: ClientPointsAccountController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ClientPointsAccountController(accountService as never, assetQueryService as never);
  });

  it('should force client asset queries to current member', async () => {
    assetQueryService.getLots.mockResolvedValue({ data: { rows: [] } });
    assetQueryService.getConsumeAllocations.mockResolvedValue({ data: { rows: [] } });
    assetQueryService.getRefundAllocations.mockResolvedValue({ data: { rows: [] } });

    await controller.getLots('member-current', { memberId: 'member-other', pageNum: 1 });
    await controller.getConsumeAllocations('member-current', { memberId: 'member-other', relatedId: 'order-1' });
    await controller.getRefundAllocations('member-current', { memberId: 'member-other', relatedId: 'order-1' });

    expect(assetQueryService.getLots).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'member-current', pageNum: 1 }),
    );
    expect(assetQueryService.getConsumeAllocations).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'member-current', relatedId: 'order-1' }),
    );
    expect(assetQueryService.getRefundAllocations).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'member-current', relatedId: 'order-1' }),
    );
  });
});
