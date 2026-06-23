import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { OptionalMemberAuthGuard } from 'src/module/client/common/guards/optional-member-auth.guard';
import type { UserMarketingContext } from 'src/module/marketing/resolution/dto/user-marketing-context.dto';
import { ClientSceneService } from './client-scene.service';

@ApiTags('C端-场景商品视图')
@ApiBearerAuth()
@UseGuards(OptionalMemberAuthGuard)
@Controller('client/scene')
export class ClientSceneProductsController {
  constructor(private readonly service: ClientSceneService) {}

  @Get(':sceneCode/products')
  @Api({ summary: '按场景查询商品卡列表' })
  async getSceneProducts(
    @Param('sceneCode') sceneCode: string,
    @Member('memberId') memberId: string,
    @Query('channel') channel?: string,
    @Query('pageNum') pageNumRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    const pageNum = Math.max(1, Number(pageNumRaw ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(50, Number(pageSizeRaw ?? 20) || 20));
    const safeChannel: UserMarketingContext['channel'] =
      channel === 'H5' || channel === 'ADMIN_PREVIEW' ? channel : 'MINIAPP';

    const modules = await this.service.getSceneModules(
      sceneCode,
      {
        tenantId,
        memberId: memberId ?? '',
        channel: safeChannel,
        now: new Date(),
        isNewcomer: false,
      },
      { productLimit: pageSize },
    );

    const cards = modules.modules.flatMap((module) => {
      return module.products.map((product) => {
        const record = product as Record<string, unknown>;
        const primaryOffer =
          record.primaryOffer && typeof record.primaryOffer === 'object'
            ? (record.primaryOffer as Record<string, unknown>)
            : {};
        const productId = String(record.productId ?? '');
        return {
          sceneCode,
          moduleCode: module.moduleCode,
          moduleName: module.moduleName,
          productId,
          productName: String(record.productName ?? record.name ?? '商品'),
          productImg: String(record.productImg ?? record.coverImage ?? ''),
          activityContextKey: String(primaryOffer.activityContextKey ?? ''),
          activityType: String(primaryOffer.activityType ?? ''),
          activityConfigId: String(primaryOffer.configId ?? ''),
          displayPrice: Number(primaryOffer.displayPrice ?? 0),
          originalPrice: Number(primaryOffer.originalPrice ?? 0),
          status: String(primaryOffer.statusSummary ?? 'ON_SHELF'),
        };
      });
    });

    const start = (pageNum - 1) * pageSize;
    const rows = cards.slice(start, start + pageSize);
    return Result.ok({
      rows,
      total: cards.length,
      pageNum,
      pageSize,
      sceneCode,
      releaseNo: modules.releaseNo,
    });
  }
}
