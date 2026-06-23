import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response';
import { ResponseCode } from 'src/common/response/response.interface';
import { TenantContext } from 'src/common/tenant';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { ResolutionDiagnosticService } from './resolution-diagnostic.service';
import { ResolutionTraceDiagnosticVo } from './vo/resolution-diagnostic.vo';

/**
 * 营销裁决诊断
 * 对应 admin-web service/api/marketing/resolution.ts 的 trace diagnostic 接口。
 * traceId 必须先归一化再查询，避免空 trace 误扫租户内诊断快照。
 *
 * @tenantScope TenantScoped
 */
@ApiTags('营销-裁决诊断')
@Controller('marketing/resolution/diagnostics')
@ApiBearerAuth('Authorization')
export class ResolutionDiagnosticController {
  constructor(private readonly diagnosticService: ResolutionDiagnosticService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('trace')
  @Api({
    summary: '按 traceId 查询裁决诊断快照',
    type: ResolutionTraceDiagnosticVo,
    queries: [
      { name: 'traceId', description: 'Trace ID', required: true },
      { name: 'days', description: '回看天数，1-7，默认 7', required: false, type: 'number' },
    ],
  })
  @RequirePermission('marketing:scene:list')
  async getTraceDiagnostic(
    @Query('traceId') traceId: string,
    @Query('days') daysRaw: string | undefined,
    @User() user: UserDto,
  ): Promise<Result<ResolutionTraceDiagnosticVo>> {
    const tenantId = user.user?.tenantId || TenantContext.SUPER_TENANT_ID;
    const traceIdValue = this.parseTraceId(traceId);
    const days = this.parseDays(daysRaw);
    const data = await TenantContext.run({ tenantId }, () =>
      this.diagnosticService.getTraceDiagnostic({
        tenantId,
        traceId: traceIdValue,
        days,
      }),
    );
    return Result.ok(data);
  }

  private parseTraceId(raw: string | undefined): string {
    const traceId = raw?.trim() ?? '';
    if (!traceId) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, 'traceId不能为空');
    }
    return traceId;
  }

  private parseDays(raw: string | undefined): number | undefined {
    if (!raw) return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(7, Math.max(1, Math.trunc(parsed)));
  }
}
