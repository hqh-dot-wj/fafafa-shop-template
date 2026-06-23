import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { OptionalMemberAuthGuard } from 'src/module/client/common/guards/optional-member-auth.guard';
import { ProductActivityViewService } from './product-activity-view.service';

@ApiTags('C端-活动商品读模型')
@ApiBearerAuth()
@UseGuards(OptionalMemberAuthGuard)
@Controller('client/product-activity-view')
export class ProductActivityViewController {
  constructor(private readonly service: ProductActivityViewService) {}

  @Get('scene/:sceneCode/products')
  @Api({ summary: '按场景获取活动商品读模型' })
  getSceneProducts(
    @Param('sceneCode') sceneCode: string,
    @Member('memberId') memberId: string,
    @Query('channel') channel?: string,
    @Query('pageNum') pageNum?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getSceneProducts({
      sceneCode,
      memberId,
      channel: channel as never,
      pageNum: pageNum ? Number(pageNum) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('category/:categoryId/products')
  @Api({ summary: '按分类获取活动商品读模型' })
  getCategoryProducts(
    @Param('categoryId') categoryId: string,
    @Member('memberId') memberId: string,
    @Query('pageNum') pageNum?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getCategoryProducts({
      categoryId: Number(categoryId),
      memberId,
      pageNum: pageNum ? Number(pageNum) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('recommend/products')
  @Api({ summary: '获取推荐活动商品读模型' })
  getRecommendProducts(
    @Member('memberId') memberId: string,
    @Query('onlyHot') onlyHotRaw?: string,
    @Query('pageNum') pageNum?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getRecommendProducts({
      memberId,
      onlyHot:
        onlyHotRaw == null
          ? undefined
          : onlyHotRaw === '1' || onlyHotRaw.toLowerCase() === 'true'
            ? true
            : onlyHotRaw === '0' || onlyHotRaw.toLowerCase() === 'false'
              ? false
              : undefined,
      pageNum: pageNum ? Number(pageNum) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('product/:productId/runtime')
  @Api({ summary: '获取商品活动运行时摘要' })
  getProductRuntimeView(
    @Param('productId') productId: string,
    @Member('memberId') memberId: string,
    @Query('activityContextKey') activityContextKey?: string,
  ) {
    return this.service.getProductRuntimeView({
      productId,
      memberId,
      activityContextKey,
    });
  }

  @Get('product/:productId/marketing-view')
  @Api({ summary: '获取商品统一营销视图（C端，不含诊断数据）' })
  getProductMarketingView(
    @Param('productId') productId: string,
    @Member('memberId') memberId: string,
    @Query('traceId') traceId?: string,
    @Query('activityContextKey') activityContextKey?: string,
  ) {
    return this.service.getProductMarketingView({
      productId,
      memberId,
      traceId,
      activityContextKey,
      includeExplain: false,
    });
  }
}
