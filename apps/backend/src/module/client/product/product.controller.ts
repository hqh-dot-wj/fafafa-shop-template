import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { ClientProductService } from './product.service';
import { ClientListProductDto } from './dto';
import { ClientProductVo, ClientProductDetailVo, ClientCategoryVo } from './vo';
import { CourseGroupLifecycleService } from 'src/module/marketing/course-group/services/lifecycle.service';

const ONE_MINUTE_MS = 60_000;
const parseRateLimit = (raw: string | undefined, fallback: number, min = 10, max = 5000): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
};

const CLIENT_PRODUCT_LIST_LIMIT = parseRateLimit(process.env.CLIENT_PRODUCT_LIST_RATE_LIMIT, 300);
const CLIENT_PRODUCT_DETAIL_LIMIT = parseRateLimit(process.env.CLIENT_PRODUCT_DETAIL_RATE_LIMIT, 500);
const CLIENT_PRODUCT_CATEGORY_LIMIT = parseRateLimit(process.env.CLIENT_PRODUCT_CATEGORY_RATE_LIMIT, 240);

@ApiTags('C端-商品模块')
@Controller('client/product')
export class ClientProductController {
  constructor(
    private readonly productService: ClientProductService,
    private readonly courseGroupLifecycleService: CourseGroupLifecycleService,
  ) {}

  /**
   * 获取商品列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '获取商品列表', type: ClientProductVo, isPager: true })
  @Throttle({ default: { limit: CLIENT_PRODUCT_LIST_LIMIT, ttl: ONE_MINUTE_MS } })
  @Get('list')
  findAll(@Query() query: ClientListProductDto) {
    return this.productService.findAll(query);
  }

  /**
   * 获取商品详情
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '获取商品详情', type: ClientProductDetailVo })
  @Throttle({ default: { limit: CLIENT_PRODUCT_DETAIL_LIMIT, ttl: ONE_MINUTE_MS } })
  @Get('detail/:id')
  findOne(
    @Param('id') id: string,
    @Query('activityContextKey') activityContextKey?: string,
  ): Promise<Result<ClientProductDetailVo>> {
    return this.productService.findOne(id, activityContextKey);
  }

  @Api({ summary: '获取商品拼课运行时摘要' })
  @Get(':productId/course-group-runtime')
  getCourseGroupRuntime(
    @Param('productId') productId: string,
    @Query('memberId') memberId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('activityContextKey') activityContextKey?: string,
  ) {
    return this.courseGroupLifecycleService.getProductRuntime({
      memberId: memberId ?? '',
      tenantId,
      productId,
      activityContextKey,
    });
  }

  /**
   * 获取商品分类树
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '获取商品分类树', type: ClientCategoryVo, isArray: true })
  @Throttle({ default: { limit: CLIENT_PRODUCT_CATEGORY_LIMIT, ttl: ONE_MINUTE_MS } })
  @Get('category/tree')
  findCategoryTree(): Promise<Result<ClientCategoryVo[]>> {
    return this.productService.findCategoryTree();
  }

  /**
   * 获取商品分类列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '获取商品分类列表', type: ClientCategoryVo, isArray: true })
  @Throttle({ default: { limit: CLIENT_PRODUCT_CATEGORY_LIMIT, ttl: ONE_MINUTE_MS } })
  @Get('category/list')
  findCategoryList(@Query('parentId') parentId?: number) {
    return this.productService.findCategoryList(parentId);
  }
}
