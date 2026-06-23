import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantContext } from 'src/common/tenant';
import { MarketingEventType } from '../events/marketing-event.types';
import { MarketingPolicyRepository } from './policy.repository';
import {
  SaveSourcePolicyDto,
  SaveResolverPolicyDto,
  SaveAudiencePolicyDto,
  SaveSortPolicyDto,
  SaveCardTemplateDto,
  ListPolicyDto,
} from './dto/policy.dto';

@Injectable()
export class MarketingPolicyService {
  constructor(
    private readonly repo: MarketingPolicyRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(query: ListPolicyDto) {
    const { rows, total } = await this.repo.list(query);
    return { rows, total };
  }

  async saveSourcePolicy(dto: SaveSourcePolicyDto) {
    BusinessException.throwIf(dto.clauses.length === 0, '商品池策略至少需要一个召回子句');
    const policy = await this.repo.upsertSourcePolicy(dto);
    this.emitPolicyChanged(dto.policyCode, 'SOURCE');
    return policy;
  }

  async saveResolverPolicy(dto: SaveResolverPolicyDto) {
    BusinessException.throwIf(
      dto.primaryOfferTypes.length === 0 || !dto.conflictMatrix,
      '裁决策略缺少主活动优先级或冲突矩阵',
    );
    const policy = await this.repo.upsertResolverPolicy(dto);
    this.emitPolicyChanged(dto.policyCode, 'RESOLVER');
    return policy;
  }

  async saveAudiencePolicy(dto: SaveAudiencePolicyDto) {
    const policy = await this.repo.upsertAudiencePolicy(dto);
    this.emitPolicyChanged(dto.policyCode, 'AUDIENCE');
    return policy;
  }

  async saveSortPolicy(dto: SaveSortPolicyDto) {
    const policy = await this.repo.upsertSortPolicy(dto);
    this.emitPolicyChanged(dto.policyCode, 'SORT');
    return policy;
  }

  async saveCardTemplate(dto: SaveCardTemplateDto) {
    const policy = await this.repo.upsertCardTemplate(dto);
    this.emitPolicyChanged(dto.policyCode, 'CARD_TEMPLATE');
    return policy;
  }

  private emitPolicyChanged(
    policyCode: string,
    policyType: 'SOURCE' | 'RESOLVER' | 'AUDIENCE' | 'SORT' | 'CARD_TEMPLATE',
  ) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    void this.eventEmitter.emit(MarketingEventType.POLICY_CONFIG_CHANGED, {
      tenantId,
      policyCode,
      policyType,
    });
  }
}
