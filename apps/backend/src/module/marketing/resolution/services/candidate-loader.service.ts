import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorePlayConfig } from '@prisma/client';

@Injectable()
export class CandidateLoaderService {
  private readonly logger = new Logger(CandidateLoaderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 加载单个商品的候选活动配置
   *
   * @param tenantId - 租户 ID
   * @param productId - 商品 ID
   * @returns 上架且未删除的活动配置列表（含目标 SKU）
   */
  async loadCandidates(tenantId: string, productId: string): Promise<StorePlayConfig[]> {
    return this.prisma.storePlayConfig.findMany({
      where: { tenantId, serviceId: productId, status: 'ON_SHELF', delFlag: 'NORMAL' },
      include: { targetSkus: true },
    });
  }

  /**
   * 批量加载多个商品的候选活动配置，按商品 ID 分组
   *
   * @param tenantId - 租户 ID
   * @param productIds - 商品 ID 列表
   * @returns 按商品 ID 分组的活动配置 Map
   */
  async loadCandidatesForProducts(tenantId: string, productIds: string[]): Promise<Map<string, StorePlayConfig[]>> {
    const configs = await this.prisma.storePlayConfig.findMany({
      where: { tenantId, serviceId: { in: productIds }, status: 'ON_SHELF', delFlag: 'NORMAL' },
      include: { targetSkus: true },
    });
    const map = new Map<string, StorePlayConfig[]>();
    for (const config of configs) {
      const list = map.get(config.serviceId) ?? [];
      list.push(config);
      map.set(config.serviceId, list);
    }
    return map;
  }
}
