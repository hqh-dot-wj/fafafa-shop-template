import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { TenantContext } from 'src/common/tenant';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { MarketingSceneService } from './scene.service';
import {
  CreateSceneFromTemplateDto,
  ListSceneDto,
  ListSceneTemplateDto,
  SaveSceneDto,
  SyncSceneFromTemplateDto,
} from './dto/scene.dto';
import { ListSceneModuleDto, SaveSceneModuleDto } from './dto/scene-module.dto';

/**
 * 营销场景管理
 * @tenantScope TenantScoped
 */
@ApiTags('营销-场景管理')
@Controller('admin/marketing/scene')
@ApiBearerAuth('Authorization')
export class MarketingSceneController {
  constructor(private readonly service: MarketingSceneService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('list')
  @Api({ summary: '查询场景列表' })
  @RequirePermission('marketing:scene:list')
  async list(@Query() query: ListSceneDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.list(query));
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('module/list')
  @Api({ summary: '查询场景模块列表' })
  @RequirePermission('marketing:scene:list')
  async listModules(@Query() query: ListSceneModuleDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.listModules(query));
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('template/list')
  @Api({ summary: '查询场景模板列表' })
  @RequirePermission('marketing:scene:list')
  async listTemplates(@Query() query: ListSceneTemplateDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.listTemplates(query));
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post()
  @Api({ summary: '新增/更新场景' })
  @RequirePermission('marketing:scene:edit')
  @Operlog({ businessType: BusinessType.INSERT })
  async saveScene(@Body() dto: SaveSceneDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () =>
      this.service.saveScene(dto, String(user.user?.userId ?? '')),
    );
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post('from-template')
  @Api({ summary: '从场景模板创建场景' })
  @RequirePermission('marketing:scene:edit')
  @Operlog({ businessType: BusinessType.INSERT })
  async createFromTemplate(@Body() dto: CreateSceneFromTemplateDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () =>
      this.service.createFromTemplate(dto, String(user.user?.userId ?? '')),
    );
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post(':sceneId/sync-template')
  @Api({ summary: '按字段同步场景模板配置' })
  @RequirePermission('marketing:scene:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  async syncFromTemplate(
    @Param('sceneId') sceneId: string,
    @Body() dto: SyncSceneFromTemplateDto,
    @User() user: UserDto,
  ) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () =>
      this.service.syncFromTemplate(sceneId, dto, String(user.user?.userId ?? '')),
    );
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post(':sceneCode/module')
  @Api({ summary: '新增/更新场景模块' })
  @RequirePermission('marketing:scene:edit')
  @Operlog({ businessType: BusinessType.INSERT })
  async saveModule(@Param('sceneCode') sceneCode: string, @Body() dto: SaveSceneModuleDto, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () =>
      this.service.saveModule(sceneCode, dto, String(user.user?.userId ?? '')),
    );
    return Result.ok(data);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post(':sceneCode/publish')
  @Api({ summary: '发布场景' })
  @RequirePermission('marketing:scene:publish')
  @Operlog({ businessType: BusinessType.UPDATE })
  async publish(@Param('sceneCode') sceneCode: string, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () =>
      this.service.publish(sceneCode, String(user.user?.userId ?? '')),
    );
    return Result.ok(data, '发布成功');
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get(':sceneCode/precheck')
  @Api({ summary: '发布前预检' })
  @RequirePermission('marketing:scene:publish')
  async precheck(@Param('sceneCode') sceneCode: string, @User() user: UserDto) {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const data = await TenantContext.run({ tenantId }, () => this.service.precheck(sceneCode));
    return Result.ok(data);
  }
}
