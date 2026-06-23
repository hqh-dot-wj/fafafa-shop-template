import { CouponTemplateService } from '../../../marketing/coupon/template/template.service';
import { CouponPoolAdapter } from '../coupon-pool.adapter';

describe('CouponPoolAdapter', () => {
  let adapter: CouponPoolAdapter;
  const templateService = {
    findOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new CouponPoolAdapter(templateService as unknown as CouponTemplateService);
  });

  it('should compile coupon pool with template runtime and risk hints', async () => {
    templateService.findOne.mockResolvedValue({
      data: {
        id: 'tpl-001',
        status: 'ACTIVE',
        totalStock: 500,
        remainingStock: 300,
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-12-31T23:59:59.000Z',
      },
    });

    const result = await adapter.compile({
      poolType: 'COUPON',
      templateId: 'tpl-001',
    });

    expect(templateService.findOne).toHaveBeenCalledTimes(1);
    expect(templateService.findOne).toHaveBeenCalledWith('tpl-001');
    expect(result.poolType).toBe('COUPON');
    expect(result.poolId).toBe('tpl-001');
    expect(result.compileTarget.owner).toBe('marketing coupon');
    expect(result.preview.templateId).toBe('tpl-001');
    expect(result.preview.template).toMatchObject({ id: 'tpl-001', status: 'ACTIVE' });
    expect(Array.isArray(result.riskSummary)).toBe(true);
    expect(result.riskSummary.length).toBeGreaterThan(0);
  });

  it('should fallback to generic template id and keep risk summary when template service returns empty', async () => {
    templateService.findOne.mockResolvedValue({ data: null });

    const result = await adapter.compile({
      poolType: 'COUPON',
      templateId: '',
    });

    expect(templateService.findOne).toHaveBeenCalledWith('');
    expect(result.poolId).toBe('unknown-template');
    expect(result.compileTarget.forbiddenFacts).toEqual(expect.arrayContaining(['coupon-stock-ledger', 'coupon-state-machine']));
    expect(result.preview.templateId).toBe('');
    expect(Array.isArray(result.riskSummary)).toBe(true);
    expect(result.riskSummary.length).toBeGreaterThan(0);
  });
});
