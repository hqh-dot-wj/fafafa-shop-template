import { Result } from 'src/common/response';
import { EntitlementCompileVo } from './vo/entitlement-compile.vo';
import { EntitlementDefinitionVo } from './vo/entitlement-definition.vo';
import { EntitlementController } from './entitlement.controller';
import { EntitlementService } from './entitlement.service';

describe('EntitlementController', () => {
  let controller: EntitlementController;
  let service: jest.Mocked<
    Pick<
      EntitlementService,
      'getDefinition' | 'compile' | 'listPools' | 'createPool' | 'updatePool' | 'removePool'
    >
  >;

  const definition: EntitlementDefinitionVo = {
    version: '2026-04-19',
    poolTypes: ['PRODUCT', 'COUPON', 'POINTS'],
    compileTargets: {
      product: {
        owner: 'pms / product-activity-view / resolution',
        runtimeArtifacts: ['product-candidate', 'activity-card', 'scene-view'],
      },
      coupon: {
        owner: 'marketing coupon',
        runtimeArtifacts: ['coupon-template', 'distribution-rule', 'claim-link'],
      },
      points: {
        owner: 'marketing points',
        runtimeArtifacts: ['points-rule', 'points-task', 'points-account'],
      },
    },
    disallowedScopes: ['notification', 'share'],
  };

  const compileResult: EntitlementCompileVo = {
    pools: [],
    owners: ['marketing coupon'],
    riskSummary: ['risk-1'],
  };

  beforeEach(() => {
    service = {
      getDefinition: jest.fn().mockReturnValue(definition),
      compile: jest.fn().mockResolvedValue(compileResult),
      listPools: jest.fn(),
      createPool: jest.fn(),
      updatePool: jest.fn(),
      removePool: jest.fn(),
    };

    controller = new EntitlementController(service as unknown as EntitlementService);
  });

  it('should expose definition payload in standard result envelope', async () => {
    const result = await controller.getDefinition();

    expect(service.getDefinition).toHaveBeenCalledTimes(1);
    expect(result).toEqual(Result.ok(definition));
  });

  it('should run compile with tenant context from current user', async () => {
    const input = {
      touchpoints: ['product'],
      pools: [{ poolType: 'PRODUCT', sourceType: 'SCENE' }],
    } as never;
    const user = {
      user: {
        tenantId: 'tenant-1',
      },
    } as never;

    const result = await controller.compile(input, user);

    expect(service.compile).toHaveBeenCalledTimes(1);
    expect(service.compile).toHaveBeenCalledWith(input);
    expect(result).toEqual(Result.ok(compileResult));
    expect(result.data).toEqual(compileResult);
  });

  it('should fallback to super tenant when user tenantId is absent', async () => {
    const input = { touchpoints: ['coupon'], pools: [{ poolType: 'COUPON', templateId: 'tpl-1' }] } as never;
    const user = {} as never;

    const result = await controller.compile(input, user);

    expect(service.compile).toHaveBeenCalledTimes(1);
    expect(service.compile).toHaveBeenCalledWith(input);
    expect((result as { data?: unknown }).data).toBeDefined();
  });
});
