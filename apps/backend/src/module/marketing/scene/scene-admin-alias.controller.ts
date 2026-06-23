import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { BusinessType } from 'src/common/constant/business.constant';
import { TenantContext } from 'src/common/tenant';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { ListSceneDto, SaveSceneDto } from './dto/scene.dto';
import { ScenePreviewQueryDto, ScenePreviewResultVo } from './dto/scene-preview.dto';
import { MarketingSceneService } from './scene.service';

/**
 * 历史后台场景 alias。
 * 正式管理接口在 /admin/marketing/scene；该 Controller 保留旧路径和后台商品预览，
 * 前端新增场景管理能力应优先接入 MarketingSceneController。
 */
@ApiTags('营销-场景管理')
@Controller('admin/scene')
@ApiBearerAuth('Authorization')
export class MarketingSceneAliasController {
  constructor(private readonly service: MarketingSceneService) {}

  @Get('list')
  @Api({ summary: '查询场景列表' })
  @RequirePermission('marketing:scene:list')
  async list(@Query() query: ListSceneDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.list(query));
    return Result.ok(data);
  }

  @Post()
  @Api({ summary: '新增场景' })
  @RequirePermission('marketing:scene:edit')
  @Operlog({ businessType: BusinessType.INSERT })
  async create(@Body() dto: SaveSceneDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () =>
      this.service.saveScene(dto, String(user.user?.userId ?? '')),
    );
    return Result.ok(data);
  }

  @Put(':sceneId')
  @Api({ summary: '更新场景' })
  @RequirePermission('marketing:scene:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  async update(@Param('sceneId') sceneId: string, @Body() dto: SaveSceneDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const payload: SaveSceneDto = { ...dto, id: sceneId };
    const data = await TenantContext.run({ tenantId }, () =>
      this.service.saveScene(payload, String(user.user?.userId ?? '')),
    );
    return Result.ok(data);
  }

  @Get(':sceneCode/preview-products')
  @Api({ summary: '后台场景商品预览', type: ScenePreviewResultVo })
  @RequirePermission('marketing:scene:list')
  async previewProducts(
    @Param('sceneCode') sceneCode: string,
    @Query() query: ScenePreviewQueryDto,
    @User() user: UserDto,
  ) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.previewProducts(sceneCode, query));
    return Result.ok(data);
  }
}
