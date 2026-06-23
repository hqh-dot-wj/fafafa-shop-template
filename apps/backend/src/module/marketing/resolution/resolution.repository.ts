import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ResolutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建裁决审计记录
   *
   * @param data - 审计数据（租户、商品、会员、场景、快照等）
   * @returns 创建的审计记录
   */
  async createAudit(data: {
    tenantId: string;
    productId: string;
    memberId: string;
    scene: string;
    candidateSnapshot: unknown;
    filteredSnapshot: unknown;
    selectedActivityType: string | null;
    selectedConfigId: string | null;
  }) {
    return this.prisma.mktResolutionAudit.create({ data });
  }

  /**
   * 查询租户的活动类型优先级规则
   *
   * @param tenantId - 租户 ID
   * @returns 按优先级降序排列的规则列表
   */
  async findPriorityRulesByTenant(tenantId: string) {
    return this.prisma.mktActivityPriorityRule.findMany({
      where: { tenantId },
      orderBy: { priority: 'desc' },
    });
  }
}
