import { Controller, Get, Post, Body, Put, Param, Delete, Res, Query } from '@nestjs/common';
import { User } from 'src/common/decorators/user.decorator';
import type { UserDto } from 'src/module/admin/system/user/user.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto, ListTenantDto, SyncTenantPackageDto, ShopSettingsDto } from './dto/index';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Response } from 'express';
import { Api } from 'src/common/decorators/api.decorator';
import { TenantVo, TenantListVo } from './vo/tenant.vo';
import { ShopSettingsVo } from './dto/shop-settings.dto';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';

@ApiTags('租户管理')
@Controller('system/tenant')
@ApiBearerAuth('Authorization')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Api({
    summary: '租户管理-创建',
    description: '创建新租户并创建租户管理员账号',
    body: CreateTenantDto,
  })
  @RequirePermission('system:tenant:add')
  @Operlog({ businessType: BusinessType.INSERT })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('/')
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.create(createTenantDto);
  }

  @Api({
    summary: '租户管理-列表',
    description: '分页查询租户列表',
    type: TenantListVo,
  })
  @RequirePermission('system:tenant:list')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('/list')
  findAll(@Query() query: ListTenantDto) {
    return this.tenantService.findAll(query);
  }

  @Api({
    summary: '租户管理-同步租户字典',
    description: '将超级管理员的字典数据同步到所有租户',
  })
  @RequirePermission('system:tenant:edit')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('/syncTenantDict')
  syncTenantDict() {
    return this.tenantService.syncTenantDict();
  }

  @Api({
    summary: '租户管理-同步租户套餐',
    description: '同步租户套餐菜单权限',
  })
  @RequirePermission('system:tenant:edit')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('/syncTenantPackage')
  syncTenantPackage(@Query() params: SyncTenantPackageDto) {
    return this.tenantService.syncTenantPackage(params);
  }

  @Api({
    summary: '租户管理-同步租户配置',
    description: '将超级管理员的配置同步到所有租户',
  })
  @RequirePermission('system:tenant:edit')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('/syncTenantConfig')
  syncTenantConfig() {
    return this.tenantService.syncTenantConfig();
  }

  @Api({
    summary: '店铺设置-详情',
    description: '读取本店（单实例 000000）品牌配置：店名、Logo、主题色、客服、协议',
    type: ShopSettingsVo,
  })
  @RequirePermission('system:tenant:query')
  @Get('/shop-settings')
  getShopSettings() {
    return this.tenantService.getShopSettings();
  }

  @Api({
    summary: '店铺设置-保存',
    description: '更新本店品牌配置（不含域名）',
    body: ShopSettingsDto,
  })
  @RequirePermission('system:tenant:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Put('/shop-settings')
  updateShopSettings(@Body() body: ShopSettingsDto) {
    return this.tenantService.updateShopSettings(body);
  }

  @Api({
    summary: '租户管理-详情',
    description: '根据ID获取租户详情',
    type: TenantVo,
    params: [{ name: 'id', description: '租户ID', type: 'number' }],
  })
  @RequirePermission('system:tenant:query')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(+id);
  }

  @Api({
    summary: '租户管理-更新',
    description: '修改租户信息',
    body: UpdateTenantDto,
  })
  @RequirePermission('system:tenant:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Put('/')
  update(@Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantService.update(updateTenantDto);
  }

  @Api({
    summary: '租户管理-删除',
    description: '批量删除租户',
    params: [{ name: 'ids', description: '租户ID列表，逗号分隔', type: 'string' }],
  })
  @RequirePermission('system:tenant:remove')
  @Operlog({ businessType: BusinessType.DELETE })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Delete('/:ids')
  remove(@Param('ids') ids: string) {
    const idArray = ids.split(',').map((id) => +id);
    return this.tenantService.remove(idArray);
  }

  @Api({
    summary: '租户管理-动态切换租户',
    description: '超级管理员切换到指定租户上下文',
  })
  @RequirePermission('system:tenant:dynamic')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('/dynamic/clear')
  clearDynamicTenant(@User() user: UserDto) {
    return this.tenantService.clearDynamicTenant(user.user);
  }

  @Api({
    summary: '租户管理-动态切换租户',
    description: '超级管理员切换到指定租户上下文',
  })
  @RequirePermission('system:tenant:dynamic')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('/dynamic/:tenantId')
  dynamicTenant(@Param('tenantId') tenantId: string, @User() user: UserDto) {
    return this.tenantService.dynamicTenant(tenantId, user.user);
  }

  @Api({
    summary: '租户管理-导出',
    description: '导出租户数据为Excel文件',
    type: TenantListVo,
  })
  @RequirePermission('system:tenant:export')
  @Operlog({ businessType: BusinessType.EXPORT })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('/export')
  exportData(@Res() res: Response, @Body() body: ListTenantDto) {
    return this.tenantService.export(res, body);
  }
}
