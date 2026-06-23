import { Controller, DefaultValuePipe, Get, Header, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { OptionalMemberAuthGuard } from 'src/module/client/common/guards/optional-member-auth.guard';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { ClientAggregateService } from './client-aggregate.service';

/**
 * 兼容入口：内部已转发到 SceneCode=HOME_FEATURED。
 * 新需求禁止继续在此处追加价格/佣金/活动特判。
 * @deprecated 请使用 /client/marketing/scene/:sceneCode/modules 统一出数接口
 */
/**
 * @tenantScope TenantScoped
 */
@ApiTags('C端-营销聚合')
@ApiBearerAuth()
@UseGuards(OptionalMemberAuthGuard)
@Controller('client/marketing/aggregate')
export class ClientAggregateController {
  constructor(private readonly aggregateService: ClientAggregateService) {}

  @Api({ summary: '获取营销聚合商品列表' })
  @Header('Deprecation', 'true')
  @Header('X-Deprecated-Endpoint', 'true')
  @Get('products')
  getProducts(
    @Member('memberId') memberId: string,
    @Query('pageNum', new DefaultValuePipe(1), ParseIntPipe) pageNum: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.aggregateService.getAggregateProductsViaScene(memberId, pageNum, pageSize);
  }
}
