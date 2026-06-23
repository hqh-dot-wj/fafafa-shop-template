import { Injectable } from '@nestjs/common';
import { DelFlag } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode, Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClientShopBrandingVo } from './vo/shop-branding.vo';

@Injectable()
export class ClientShopService {
  constructor(private readonly prisma: PrismaService) {}

  /** 单实例模板：按当前租户上下文返回店铺品牌（/client/* 无头时兜底 000000） */
  async getBranding(): Promise<Result<ClientShopBrandingVo>> {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    const tenant = await this.prisma.sysTenant.findFirst({
      where: { tenantId, delFlag: DelFlag.NORMAL },
      select: {
        companyName: true,
        logoUrl: true,
        themeColor: true,
        contactUserName: true,
        contactPhone: true,
        userAgreement: true,
        privacyAgreement: true,
      },
    });

    if (!tenant) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '店铺信息不存在');
    }

    return Result.ok({
      companyName: tenant.companyName,
      logoUrl: tenant.logoUrl ?? undefined,
      themeColor: tenant.themeColor ?? undefined,
      contactUserName: tenant.contactUserName ?? undefined,
      contactPhone: tenant.contactPhone ?? undefined,
      userAgreement: tenant.userAgreement ?? undefined,
      privacyAgreement: tenant.privacyAgreement ?? undefined,
    });
  }
}
