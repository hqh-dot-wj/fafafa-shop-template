import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { TenantContext } from 'src/common/tenant';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { EntitlementService } from './entitlement.service';
import { CompileEntitlementDto } from './dto/compile-entitlement.dto';
import { EntitlementDefinitionVo } from './vo/entitlement-definition.vo';
import { EntitlementCompileVo } from './vo/entitlement-compile.vo';
import { EntitlementPoolPageVo, EntitlementPoolVo } from './vo/entitlement-pool.vo';
import { ListEntitlementPoolDto } from './dto/list-entitlement-pool.dto';
import { CreateEntitlementPoolDto } from './dto/create-entitlement-pool.dto';
import { UpdateEntitlementPoolDto } from './dto/update-entitlement-pool.dto';

/**
 * 权益池编排入口，对应 admin-web service/api/marketing/entitlement.ts。
 * 写入和编译动作必须在当前后台用户租户上下文中执行，不能信任前端自行传入 tenantId。
 */
@ApiTags('营销-权益池编排')
@ApiBearerAuth('Authorization')
@Controller('admin/marketing/entitlement')
export class EntitlementController {
  constructor(private readonly service: EntitlementService) {}

  @Get('definition')
  @Api({ summary: '获取权益池真相源定义', type: EntitlementDefinitionVo })
  async getDefinition(): Promise<Result<EntitlementDefinitionVo>> {
    return Result.ok(this.service.getDefinition());
  }

  @Get('pools')
  @Api({ summary: '权益池分页列表', type: EntitlementPoolPageVo })
  @RequirePermission('marketing:entitlement:list')
  async listPools(@Query() query: ListEntitlementPoolDto): Promise<Result<EntitlementPoolPageVo>> {
    const data = await this.service.listPools(query);
    return Result.ok(data);
  }

  @Post('pools')
  @Api({ summary: '创建权益池', type: EntitlementPoolVo })
  @RequirePermission('marketing:entitlement:edit')
  async createPool(@Body() body: CreateEntitlementPoolDto, @User() user: UserDto): Promise<Result<EntitlementPoolVo>> {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    return TenantContext.run({ tenantId }, async () => {
      const data = await this.service.createPool(body, String(user.user.userId));
      return Result.ok(data);
    });
  }

  @Patch('pools/:poolId')
  @Api({ summary: '更新权益池', type: EntitlementPoolVo })
  @RequirePermission('marketing:entitlement:edit')
  async updatePool(
    @Param('poolId') poolId: string,
    @Body() body: UpdateEntitlementPoolDto,
    @User() user: UserDto,
  ): Promise<Result<EntitlementPoolVo>> {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    return TenantContext.run({ tenantId }, async () => {
      const data = await this.service.updatePool(poolId, body, String(user.user.userId));
      return Result.ok(data);
    });
  }

  @Delete('pools/:poolId')
  @Api({ summary: '删除权益池' })
  @RequirePermission('marketing:entitlement:remove')
  async removePool(@Param('poolId') poolId: string, @User() user: UserDto): Promise<Result<null>> {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    return TenantContext.run({ tenantId }, async () => {
      await this.service.removePool(poolId);
      return Result.ok(null);
    });
  }

  @Post('compile')
  @Api({ summary: '权益池统一编译', type: EntitlementCompileVo })
  @RequirePermission('marketing:entitlement:compile')
  async compile(@Body() body: CompileEntitlementDto, @User() user: UserDto): Promise<Result<EntitlementCompileVo>> {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;

    return TenantContext.run({ tenantId }, async () => {
      const data = await this.service.compile(body);
      return Result.ok(data);
    });
  }
}
