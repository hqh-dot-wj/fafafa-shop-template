import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { MarketingPolicyService } from '../policy.service';
import { MarketingPolicyRepository } from '../policy.repository';
import { MarketingEventType } from '../../events/marketing-event.types';

describe('MarketingPolicyService', () => {
  let service: MarketingPolicyService;
  let eventEmitter: { emit: jest.Mock };
  let repo: {
    list: jest.Mock;
    upsertSourcePolicy: jest.Mock;
    upsertResolverPolicy: jest.Mock;
    upsertAudiencePolicy: jest.Mock;
    upsertSortPolicy: jest.Mock;
    upsertCardTemplate: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      list: jest.fn().mockResolvedValue([]),
      upsertSourcePolicy: jest.fn().mockResolvedValue({ id: 'p1' }),
      upsertResolverPolicy: jest.fn().mockResolvedValue({ id: 'p2' }),
      upsertAudiencePolicy: jest.fn().mockResolvedValue({ id: 'p3' }),
      upsertSortPolicy: jest.fn().mockResolvedValue({ id: 'p4' }),
      upsertCardTemplate: jest.fn().mockResolvedValue({ id: 'p5' }),
    };
    eventEmitter = {
      emit: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        MarketingPolicyService,
        { provide: MarketingPolicyRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = module.get(MarketingPolicyService);
  });

  it('保存 resolver policy 时必须带 primaryOfferTypes 与 conflictMatrix', async () => {
    const err = await service.saveResolverPolicy({
      policyCode: 'HOME_DEFAULT',
      policyName: '首页默认裁决',
      primaryOfferTypes: [],
      conflictMatrix: null as never,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ msg: '裁决策略缺少主活动优先级或冲突矩阵' });
  });

  it('saveSourcePolicy 空 clauses 时抛出异常', async () => {
    const err = await service.saveSourcePolicy({
      policyCode: 'P1',
      policyName: '商品池1',
      clauses: [],
    }).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ msg: '商品池策略至少需要一个召回子句' });
  });

  it('saveSourcePolicy 有效时委托给 repo.upsertSourcePolicy', async () => {
    const dto = { policyCode: 'P1', policyName: '商品池1', clauses: [{ type: 'ALL' }] };
    await service.saveSourcePolicy(dto);
    expect(repo.upsertSourcePolicy).toHaveBeenCalledWith(dto);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      MarketingEventType.POLICY_CONFIG_CHANGED,
      expect.objectContaining({ policyCode: 'P1', policyType: 'SOURCE' }),
    );
  });

  it('saveAudiencePolicy 委托给 repo.upsertAudiencePolicy', async () => {
    const dto = { policyCode: 'A1', policyName: '受众1', rules: { tag: 'VIP' } };
    await service.saveAudiencePolicy(dto);
    expect(repo.upsertAudiencePolicy).toHaveBeenCalledWith(dto);
  });
});
