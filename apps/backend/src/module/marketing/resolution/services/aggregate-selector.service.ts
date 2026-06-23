import { Injectable, Logger } from '@nestjs/common';
import { StorePlayConfig, MktActivityPriorityRule } from '@prisma/client';
import { ResolutionRepository } from '../resolution.repository';

@Injectable()
export class AggregateSelectorService {
  private readonly logger = new Logger(AggregateSelectorService.name);
  constructor(private readonly repository: ResolutionRepository) {}

  /**
   * 从有资格的候选活动中选出优先级最高的主活动
   *
   * @param tenantId - 租户 ID
   * @param eligibleCandidates - 通过资格过滤的候选活动列表
   * @returns 优先级最高的活动配置，无候选则返回 null
   */
  async selectMainActivity(tenantId: string, eligibleCandidates: StorePlayConfig[]): Promise<StorePlayConfig | null> {
    if (eligibleCandidates.length === 0) return null;
    const priorityRules = await this.loadPriorityRules(tenantId);
    const priorityMap = new Map(priorityRules.map((r) => [r.activityType, r.priority]));
    const sorted = [...eligibleCandidates].sort((a, b) => {
      const aPriority = priorityMap.get(a.templateCode) ?? 0;
      const bPriority = priorityMap.get(b.templateCode) ?? 0;
      if (bPriority !== aPriority) return bPriority - aPriority;
      return (b.displayPriority ?? 0) - (a.displayPriority ?? 0);
    });
    return sorted[0];
  }

  /**
   * 批量为多个商品选出各自的主活动
   *
   * @param tenantId - 租户 ID
   * @param candidatesByProduct - 按商品 ID 分组的候选活动 Map
   * @returns 按商品 ID 分组的主活动 Map
   */
  async selectMainActivitiesForProducts(
    tenantId: string,
    candidatesByProduct: Map<string, StorePlayConfig[]>,
  ): Promise<Map<string, StorePlayConfig | null>> {
    const priorityRules = await this.loadPriorityRules(tenantId);
    const priorityMap = new Map(priorityRules.map((r) => [r.activityType, r.priority]));
    const result = new Map<string, StorePlayConfig | null>();
    for (const [productId, candidates] of candidatesByProduct) {
      if (candidates.length === 0) {
        result.set(productId, null);
        continue;
      }
      const sorted = [...candidates].sort((a, b) => {
        const aPriority = priorityMap.get(a.templateCode) ?? 0;
        const bPriority = priorityMap.get(b.templateCode) ?? 0;
        if (bPriority !== aPriority) return bPriority - aPriority;
        return (b.displayPriority ?? 0) - (a.displayPriority ?? 0);
      });
      result.set(productId, sorted[0]);
    }
    return result;
  }

  private async loadPriorityRules(tenantId: string): Promise<MktActivityPriorityRule[]> {
    return this.repository.findPriorityRulesByTenant(tenantId);
  }
}
