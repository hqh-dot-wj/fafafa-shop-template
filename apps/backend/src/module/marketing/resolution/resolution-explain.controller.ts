import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response';
import { ResponseCode } from 'src/common/response/response.interface';
import { TenantContext } from 'src/common/tenant';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { ResolutionExplainService } from './services/resolution-explain.service';

/**
 * 营销裁决决策解释
 * 对应 admin-web service/api/marketing/resolution.ts 的解释面板。
 * 解释结果面向运营排障，只说明过滤与命中原因，不替代真实裁决服务。
 *
 * @tenantScope TenantScoped
 */
@ApiTags('营销-裁决诊断')
@Controller('marketing/resolution/explain')
@ApiBearerAuth('Authorization')
export class ResolutionExplainController {
  constructor(private readonly explainService: ResolutionExplainService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 500ms
   */
  @Get()
  @Api({
    summary: '查询单次裁决决策解释（运营诊断：为什么这个活动没有展示）',
    queries: [
      { name: 'traceId', description: '裁决 traceId', required: true },
      { name: 'productId', description: '商品ID', required: true },
    ],
  })
  @RequirePermission('marketing:scene:list')
  async getExplain(@Query('traceId') traceId: string, @Query('productId') productId: string, @User() user: UserDto) {
    const trimmedTraceId = traceId?.trim() ?? '';
    const trimmedProductId = productId?.trim() ?? '';
    if (!trimmedTraceId) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, 'traceId不能为空');
    }
    if (!trimmedProductId) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, 'productId不能为空');
    }

    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const snapshot = await TenantContext.run({ tenantId }, () =>
      this.explainService.query({
        tenantId,
        traceId: trimmedTraceId,
        productId: trimmedProductId,
      }),
    );
    return Result.ok(snapshot);
  }
}
