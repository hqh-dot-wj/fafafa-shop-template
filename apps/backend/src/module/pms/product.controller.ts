import { Body, Controller, Get, Post, Put, Patch, Query, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PmsProductService } from './product.service';
import { CreateProductDto, UpdateProductDto, UpdateProductStatusDto, ListProductDto, SaveProductStepDto } from './dto';
import { ProductVo } from './vo';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { Api } from 'src/common/decorators/api.decorator';

/**
 * 商品管理控制器
 */
@ApiTags('商品管理')
@ApiBearerAuth('Authorization')
@Controller('admin/pms/product')
export class PmsProductController {
  constructor(private readonly pmsProductService: PmsProductService) {}

  /**
   * 查询商品列表
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @ApiOperation({ summary: '查询商品列表' })
  @Api({ summary: '查询商品列表', type: ProductVo, isArray: true })
  @RequirePermission('pms:product:list')
  @Get('list')
  async list(@Query() query: ListProductDto) {
    return this.pmsProductService.findAll(query);
  }

  /**
   * 查询商品详情
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @ApiOperation({ summary: '查询商品详情' })
  @Api({ summary: '查询商品详情', type: ProductVo })
  @RequirePermission('pms:product:query')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.pmsProductService.findOne(id);
  }

  /**
   * 创建商品
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @ApiOperation({ summary: '创建商品' })
  @Api({ summary: '创建商品', body: CreateProductDto })
  @RequirePermission('pms:product:create')
  @Operlog({ businessType: BusinessType.INSERT })
  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.pmsProductService.create(dto);
  }

  @ApiOperation({ summary: '商品分步保存（草稿）' })
  @Api({ summary: '商品分步保存（草稿）', body: SaveProductStepDto })
  @RequirePermission('pms:product:update')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Post('step-save')
  async saveStep(@Body() dto: SaveProductStepDto) {
    return this.pmsProductService.saveDraftStep(dto);
  }

  /**
   * 更新商品
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @ApiOperation({ summary: '更新商品' })
  @Api({ summary: '更新商品', body: UpdateProductDto })
  @RequirePermission('pms:product:update')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.pmsProductService.update(id, dto);
  }

  /**
   * 删除商品
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @ApiOperation({ summary: '删除商品' })
  @Api({ summary: '删除商品' })
  @RequirePermission('pms:product:delete')
  @Operlog({ businessType: BusinessType.DELETE })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.pmsProductService.remove(id);
  }

  @ApiOperation({ summary: '批量删除商品' })
  @Api({ summary: '批量删除商品' })
  @RequirePermission('pms:product:delete')
  @Operlog({ businessType: BusinessType.DELETE })
  @Delete('batch/:ids')
  async batchRemove(@Param('ids') ids: string) {
    const parsedIds = ids
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);
    return this.pmsProductService.batchRemove(parsedIds);
  }

  /**
   * 更新商品发布状态
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @ApiOperation({ summary: '更新商品发布状态' })
  @Api({ summary: '更新商品发布状态', body: UpdateProductStatusDto })
  @RequirePermission('pms:product:update')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateProductStatusDto) {
    return this.pmsProductService.updateStatus(id, dto);
  }

  @ApiOperation({ summary: '商品上架前置校验' })
  @Api({ summary: '商品上架前置校验' })
  @RequirePermission('pms:product:query')
  @Post(':id/precheck')
  async precheck(@Param('id') id: string) {
    return this.pmsProductService.precheck(id);
  }
}
