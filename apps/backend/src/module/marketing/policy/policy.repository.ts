import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantContext } from 'src/common/tenant';
import {
  SaveSourcePolicyDto,
  SaveResolverPolicyDto,
  SaveAudiencePolicyDto,
  SaveSortPolicyDto,
  SaveCardTemplateDto,
  ListPolicyDto,
} from './dto/policy.dto';

const POLICY_TYPE = {
  SOURCE: 'SOURCE',
  RESOLVER: 'RESOLVER',
  AUDIENCE: 'AUDIENCE',
  SORT: 'SORT',
  CARD_TEMPLATE: 'CARD_TEMPLATE',
} as const;

@Injectable()
export class MarketingPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get tenantId() {
    return TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
  }

  async list(query: ListPolicyDto) {
    const where = {
      tenantId: this.tenantId,
      ...(query.policyType && { policyType: query.policyType }),
      ...(query.status && { status: query.status }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.mktPolicy.findMany({
        where,
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.mktPolicy.count({ where }),
    ]);
    return { rows, total };
  }

  async upsertSourcePolicy(dto: SaveSourcePolicyDto) {
    return this.upsert(
      dto.policyCode,
      dto.policyName,
      POLICY_TYPE.SOURCE,
      { clauses: dto.clauses },
      dto.status,
    );
  }

  async upsertResolverPolicy(dto: SaveResolverPolicyDto) {
    return this.upsert(
      dto.policyCode,
      dto.policyName,
      POLICY_TYPE.RESOLVER,
      {
        primaryOfferTypes: dto.primaryOfferTypes,
        conflictMatrix: dto.conflictMatrix,
      },
      dto.status,
    );
  }

  async upsertAudiencePolicy(dto: SaveAudiencePolicyDto) {
    return this.upsert(
      dto.policyCode,
      dto.policyName,
      POLICY_TYPE.AUDIENCE,
      { rules: dto.rules },
      dto.status,
    );
  }

  async upsertSortPolicy(dto: SaveSortPolicyDto) {
    return this.upsert(
      dto.policyCode,
      dto.policyName,
      POLICY_TYPE.SORT,
      { sortRules: dto.sortRules },
      dto.status,
    );
  }

  async upsertCardTemplate(dto: SaveCardTemplateDto) {
    return this.upsert(
      dto.policyCode,
      dto.policyName,
      POLICY_TYPE.CARD_TEMPLATE,
      { templateConfig: dto.templateConfig },
      dto.status,
    );
  }

  /**
   * 通用 upsert 辅助方法。
   * 注意：policyType 在 update 分支中刻意省略——策略类型在首次创建后不可更改。
   */
  private async upsert(
    policyCode: string,
    policyName: string,
    policyType: string,
    config: object,
    status?: string,
  ) {
    return this.prisma.mktPolicy.upsert({
      where: { tenantId_policyCode: { tenantId: this.tenantId, policyCode } },
      create: {
        tenantId: this.tenantId,
        policyCode,
        policyName,
        policyType,
        config,
        status: status ?? 'ACTIVE',
      },
      update: { policyName, config, ...(status && { status }) },
    });
  }
}
