import { DistShareAttributionMode, DistShareBindingMode, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { BusinessConstants } from 'src/common/constants/business.constants';
import { Result } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateSharePolicyDto } from '../dto/update-share-policy.dto';
import { SharePolicyVo } from '../vo/share-policy.vo';

@Injectable()
export class SharePolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async getPolicy(tenantId: string): Promise<Result<SharePolicyVo>> {
    const policy = await this.prisma.sysDistSharePolicy.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysDistSharePolicy', {
        tenantId,
      }) as Prisma.SysDistSharePolicyWhereInput,
    });

    if (!policy) {
      return Result.ok(this.buildDefaultPolicy(tenantId));
    }

    return Result.ok(this.toPolicyVo(policy));
  }

  async updatePolicy(tenantId: string, dto: UpdateSharePolicyDto, operator: string): Promise<Result<SharePolicyVo>> {
    const policy = await this.prisma.sysDistSharePolicy.upsert({
      where: { tenantId },
      update: {
        linkExpireMinutes: dto.linkExpireMinutes,
        maxClickCount: dto.maxClickCount,
        maxBindCount: dto.maxBindCount,
        maxOrderCount: dto.maxOrderCount,
        bindingMode: dto.bindingMode,
        attributionMode: dto.attributionMode,
        attributionWindowMinutes: dto.attributionWindowMinutes,
        enableCrossTenantBind: dto.enableCrossTenantBind,
        isActive: dto.isActive,
        updateBy: operator,
      },
      create: {
        tenantId,
        linkExpireMinutes: dto.linkExpireMinutes,
        maxClickCount: dto.maxClickCount,
        maxBindCount: dto.maxBindCount,
        maxOrderCount: dto.maxOrderCount,
        bindingMode: dto.bindingMode,
        attributionMode: dto.attributionMode,
        attributionWindowMinutes: dto.attributionWindowMinutes,
        enableCrossTenantBind: dto.enableCrossTenantBind,
        isActive: dto.isActive,
        createBy: operator,
        updateBy: operator,
      },
    });

    return Result.ok(this.toPolicyVo(policy), '更新成功');
  }

  private buildDefaultPolicy(tenantId: string): SharePolicyVo {
    const now = new Date().toISOString();
    return {
      id: 0,
      tenantId,
      linkExpireMinutes: BusinessConstants.DISTRIBUTION.DEFAULT_SHARE_LINK_EXPIRE_MINUTES,
      maxClickCount: BusinessConstants.DISTRIBUTION.DEFAULT_SHARE_MAX_CLICK_COUNT,
      maxBindCount: BusinessConstants.DISTRIBUTION.DEFAULT_SHARE_MAX_BIND_COUNT,
      maxOrderCount: BusinessConstants.DISTRIBUTION.DEFAULT_SHARE_MAX_ORDER_COUNT,
      bindingMode: DistShareBindingMode.BOTH,
      attributionMode: DistShareAttributionMode.LAST_TOUCH,
      attributionWindowMinutes: BusinessConstants.DISTRIBUTION.DEFAULT_ATTRIBUTION_WINDOW_MINUTES,
      enableCrossTenantBind: false,
      isActive: true,
      createTime: now,
      updateTime: now,
    };
  }

  private toPolicyVo(policy: Prisma.SysDistSharePolicyGetPayload<Record<string, never>>): SharePolicyVo {
    return {
      id: policy.id,
      tenantId: policy.tenantId,
      linkExpireMinutes: policy.linkExpireMinutes,
      maxClickCount: policy.maxClickCount,
      maxBindCount: policy.maxBindCount,
      maxOrderCount: policy.maxOrderCount,
      bindingMode: policy.bindingMode,
      attributionMode: policy.attributionMode,
      attributionWindowMinutes: policy.attributionWindowMinutes,
      enableCrossTenantBind: policy.enableCrossTenantBind,
      isActive: policy.isActive,
      createTime: policy.createTime.toISOString(),
      updateTime: policy.updateTime.toISOString(),
    };
  }
}
