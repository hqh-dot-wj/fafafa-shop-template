import { Controller, Get, Post, Body, Put, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BrandService } from './brand.service';
import { CreateBrandDto, UpdateBrandDto, ListBrandDto } from './dto';
import { BrandVo } from './vo';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { Api } from 'src/common/decorators/api.decorator';

/**
 * 品牌管理控制器
 */
@ApiTags('品牌管理')
@ApiBearerAuth('Authorization')
@Controller('admin/pms/brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @ApiOperation({ summary: '查询品牌列表' })
  @Api({ summary: '查询品牌列表', type: BrandVo, isArray: true })
  @RequirePermission('pms:brand:list')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('list')
  async list(@Query() query: ListBrandDto) {
    return this.brandService.findAll(query);
  }

  @ApiOperation({ summary: '查询品牌详情' })
  @Api({ summary: '查询品牌详情', type: BrandVo })
  @RequirePermission('pms:brand:query')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.brandService.findOne(id);
  }

  @ApiOperation({ summary: '创建品牌' })
  @Api({ summary: '创建品牌', body: CreateBrandDto })
  @RequirePermission('pms:brand:create')
  @Operlog({ businessType: BusinessType.INSERT })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post()
  async create(@Body() dto: CreateBrandDto) {
    return this.brandService.create(dto);
  }

  @ApiOperation({ summary: '更新品牌' })
  @Api({ summary: '更新品牌', body: UpdateBrandDto })
  @RequirePermission('pms:brand:update')
  @Operlog({ businessType: BusinessType.UPDATE })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(id, dto);
  }

  @ApiOperation({ summary: '删除品牌' })
  @Api({ summary: '删除品牌' })
  @RequirePermission('pms:brand:delete')
  @Operlog({ businessType: BusinessType.DELETE })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.brandService.remove(id);
  }

  @ApiOperation({ summary: '批量删除品牌' })
  @Api({ summary: '批量删除品牌' })
  @RequirePermission('pms:brand:delete')
  @Operlog({ businessType: BusinessType.DELETE })
  @Delete('batch/:ids')
  async batchRemove(@Param('ids') ids: string) {
    const parsedIds = ids
      .split(',')
      .map(id => Number(id.trim()))
      .filter(id => Number.isFinite(id));
    return this.brandService.batchRemove(parsedIds);
  }
}
