import { Controller, DefaultValuePipe, Get, Header, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { OptionalMemberAuthGuard } from 'src/module/client/common/guards/optional-member-auth.guard';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { ClientZoneService } from './client-zone.service';

/**
 * 兼容入口：内部已转发到统一场景接口。
 * 迁移完成后删除独立 zone 出数逻辑。
 * @deprecated 请使用 /client/marketing/scene/:sceneCode/modules 统一出数接口
 */
/**
 * @tenantScope TenantScoped
 */
@ApiTags('C端-营销专区')
@ApiBearerAuth()
@UseGuards(OptionalMemberAuthGuard)
@Controller('client/marketing/zones')
export class ClientZoneController {
  constructor(private readonly zoneService: ClientZoneService) {}

  @Api({ summary: '获取专区商品列表' })
  @Header('Deprecation', 'true')
  @Header('X-Deprecated-Endpoint', 'true')
  @Get(':activityType/products')
  getProducts(
    @Param('activityType') activityType: string,
    @Member('memberId') memberId: string,
    @Query('pageNum', new DefaultValuePipe(1), ParseIntPipe) pageNum: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.zoneService.getZoneProductsViaScene(activityType, memberId, pageNum, pageSize);
  }
}
