import { EntitlementService } from '../entitlement.service';

describe('EntitlementService', () => {
  const productPoolAdapter = {
    compile: jest.fn(),
  };
  const couponPoolAdapter = {
    compile: jest.fn(),
  };
  const pointsPoolAdapter = {
    compile: jest.fn(),
  };
  const entitlementPoolRepository = {
    search: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  let service: EntitlementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EntitlementService(
      productPoolAdapter as never,
      couponPoolAdapter as never,
      pointsPoolAdapter as never,
      entitlementPoolRepository as never,
    );
  });

  it('should expose canonical pool matrix and compile targets', () => {
    const definition = service.getDefinition();

    expect(definition.poolTypes).toEqual(['PRODUCT', 'COUPON', 'POINTS']);
    expect(definition.compileTargets.product.owner).toBe('pms / product-activity-view / resolution');
    expect(definition.compileTargets.coupon.owner).toBe('marketing coupon');
    expect(definition.compileTargets.points.owner).toBe('marketing points');
    expect(definition.disallowedScopes).toEqual(expect.arrayContaining(['notification', 'share']));
  });

  it('should reject notification and share in entitlement scope', () => {
    expect(() =>
      service.assertScope({
        touchpoints: ['notification', 'share'],
      } as never),
    ).toThrow('本计划不包含 notification / share 触点');
  });

  it('should compile all pools and aggregate owners and risk summary', async () => {
    productPoolAdapter.compile.mockResolvedValue({
      poolType: 'PRODUCT',
      poolId: 'product-scene-newcomer',
      compileTarget: {
        owner: 'pms / product-activity-view / resolution',
        runtimeArtifacts: ['scene-candidate', 'activity-card', 'final-display-view'],
        forbiddenFacts: ['marketing-self-wide-product-ledger'],
      },
      preview: {
        rows: [],
        total: 0,
      },
      riskSummary: ['场景商品池未命中任何商品'],
    });
    couponPoolAdapter.compile.mockResolvedValue({
      poolType: 'COUPON',
      poolId: 'coupon-tpl-001',
      compileTarget: {
        owner: 'marketing coupon',
        runtimeArtifacts: ['coupon-template', 'distribution-rule', 'claim-link'],
        forbiddenFacts: ['coupon-stock-ledger', 'coupon-state-machine'],
      },
      preview: {
        templateId: 'tpl-001',
      },
      riskSummary: ['券池仅输出模板与发券链路映射，不新增独立券库存账'],
    });
    pointsPoolAdapter.compile.mockResolvedValue({
      poolType: 'POINTS',
      poolId: 'points-task-signin',
      compileTarget: {
        owner: 'marketing points',
        runtimeArtifacts: ['points-rule', 'points-task', 'points-account'],
        forbiddenFacts: ['points-ledger', 'points-engine'],
      },
      preview: {
        taskId: 'task-signin',
      },
      riskSummary: ['积分池仅输出规则+任务快照与约束建议，不接管积分账本'],
    });

    const result = await service.compile({
      touchpoints: ['product', 'coupon', 'points'],
      pools: [
        { poolType: 'PRODUCT', sourceType: 'SCENE', sourceKey: 'newcomer', memberId: 'member-1' },
        { poolType: 'COUPON', templateId: 'tpl-001' },
        { poolType: 'POINTS', taskId: 'task-signin' },
      ] as never,
    });

    expect(productPoolAdapter.compile).toHaveBeenCalledTimes(1);
    expect(couponPoolAdapter.compile).toHaveBeenCalledTimes(1);
    expect(pointsPoolAdapter.compile).toHaveBeenCalledTimes(1);
    expect(result.owners).toEqual(
      expect.arrayContaining([
        'pms / product-activity-view / resolution',
        'marketing coupon',
        'marketing points',
      ]),
    );
    expect(result.riskSummary).toEqual(
      expect.arrayContaining([
        '场景商品池未命中任何商品',
        '券池仅输出模板与发券链路映射，不新增独立券库存账',
        '积分池仅输出规则+任务快照与约束建议，不接管积分账本',
      ]),
    );
  });
});
