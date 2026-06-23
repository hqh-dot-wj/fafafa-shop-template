import { Controller, Get, Post, Body, Put, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto, ListCategoryDto } from './dto';
import { CategoryVo } from './vo';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { Api } from 'src/common/decorators/api.decorator';

/**
 * 分类管理控制器
 */
@ApiTags('分类管理')
@ApiBearerAuth('Authorization')
@Controller('admin/pms/category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiOperation({ summary: '获取分类树' })
  @Api({ summary: '获取分类树', type: CategoryVo, isArray: true })
  @RequirePermission('pms:category:list')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('tree')
  async getTree() {
    return this.categoryService.findTree();
  }

  @ApiOperation({ summary: '查询分类列表' })
  @Api({ summary: '查询分类列表', type: CategoryVo, isArray: true })
  @RequirePermission('pms:category:list')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('list')
  async list(@Query() query: ListCategoryDto) {
    return this.categoryService.findAll(query);
  }

  @ApiOperation({ summary: '查询分类详情' })
  @Api({ summary: '查询分类详情', type: CategoryVo })
  @RequirePermission('pms:category:query')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }

  @ApiOperation({ summary: '创建分类' })
  @Api({ summary: '创建分类', body: CreateCategoryDto })
  @RequirePermission('pms:category:create')
  @Operlog({ businessType: BusinessType.INSERT })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post()
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @ApiOperation({ summary: '更新分类' })
  @Api({ summary: '更新分类', body: UpdateCategoryDto })
  @RequirePermission('pms:category:update')
  @Operlog({ businessType: BusinessType.UPDATE })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @ApiOperation({ summary: '删除分类' })
  @Api({ summary: '删除分类' })
  @RequirePermission('pms:category:delete')
  @Operlog({ businessType: BusinessType.DELETE })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}
