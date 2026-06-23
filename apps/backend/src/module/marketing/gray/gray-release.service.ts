import { Injectable, Logger } from '@nestjs/common';
import { StorePlayConfig } from '@prisma/client';
import * as crypto from 'crypto';

export interface GrayReleaseConfig {
  enabled: boolean;
  whitelistUserIds: string[];
  whitelistTenantIds?: string[];
  /** 兼容历史配置，旧字段仍表示租户 ID 列表。 */
  whitelistStoreIds?: string[];
  percentage: number;
}

@Injectable()
export class GrayReleaseService {
  private readonly logger = new Logger(GrayReleaseService.name);

  async isInGrayRelease(config: StorePlayConfig | any, memberId: string, tenantId: string): Promise<boolean> {
    const grayConfig = config.grayRelease as GrayReleaseConfig | null;

    if (!grayConfig || !grayConfig.enabled) {
      this.logger.debug(`[灰度检查] 活动 ${config.id} 未启用灰度，全量放开`);
      return true;
    }

    if (grayConfig.whitelistUserIds?.includes(memberId)) {
      this.logger.debug(`[灰度检查] 用户 ${memberId} 在白名单中，允许参与活动 ${config.id}`);
      return true;
    }

    const whitelistTenantIds = this.getWhitelistTenantIds(grayConfig);
    if (whitelistTenantIds.includes(tenantId)) {
      this.logger.debug(`[灰度检查] 租户 ${tenantId} 在白名单中，允许用户 ${memberId} 参与活动 ${config.id}`);
      return true;
    }

    const percentage = grayConfig.percentage || 0;
    const userHash = this.hashUserId(memberId);
    const inGrayRange = userHash < percentage;

    this.logger.debug(
      `[灰度检查] 用户 ${memberId} 哈希值 ${userHash}，灰度比例 ${percentage}%，${inGrayRange ? '在' : '不在'}灰度范围内`,
    );

    return inGrayRange;
  }

  private hashUserId(memberId: string): number {
    const hash = crypto.createHash('md5').update(memberId).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    return hashValue % 100;
  }

  getGrayConfig(config: StorePlayConfig | any): GrayReleaseConfig {
    const grayConfig = config.grayRelease as GrayReleaseConfig | null;

    if (!grayConfig) {
      return {
        enabled: false,
        whitelistUserIds: [],
        whitelistTenantIds: [],
        percentage: 0,
      };
    }

    return grayConfig;
  }

  validateGrayConfig(grayConfig: GrayReleaseConfig): void {
    if (grayConfig.percentage < 0 || grayConfig.percentage > 100) {
      throw new Error('灰度比例必须在 0-100 之间');
    }

    if (!Array.isArray(grayConfig.whitelistUserIds)) {
      throw new Error('whitelistUserIds 必须是数组');
    }

    if (grayConfig.whitelistTenantIds !== undefined && !Array.isArray(grayConfig.whitelistTenantIds)) {
      throw new Error('whitelistTenantIds 必须是数组');
    }

    if (grayConfig.whitelistStoreIds !== undefined && !Array.isArray(grayConfig.whitelistStoreIds)) {
      throw new Error('whitelistStoreIds 必须是数组');
    }
  }

  private getWhitelistTenantIds(grayConfig: GrayReleaseConfig): string[] {
    if (Array.isArray(grayConfig.whitelistTenantIds)) {
      return grayConfig.whitelistTenantIds;
    }

    if (Array.isArray(grayConfig.whitelistStoreIds)) {
      return grayConfig.whitelistStoreIds;
    }

    return [];
  }
}
