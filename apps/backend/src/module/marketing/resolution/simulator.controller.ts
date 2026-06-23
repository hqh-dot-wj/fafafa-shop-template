import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { SimulatorService } from './simulator.service';
import { SimulateDto } from './dto/simulate.dto';

/**
 * 营销裁决模拟器
 * 对应 admin-web service/api/marketing/resolution.ts 的 simulate 接口。
 * 模拟请求用于运营排障和回放，不应被调用方当成真实活动命中结果写回业务状态。
 *
 * @tenantScope TenantScoped
 */
@ApiTags('营销-裁决模拟器')
@Controller('marketing/resolution/simulator')
@ApiBearerAuth('Authorization')
export class SimulatorController {
  constructor(private readonly service: SimulatorService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Post('simulate')
  @Api({ summary: '模拟裁决过程' })
  @RequirePermission('marketing:resolution:simulate')
  @Operlog({ businessType: BusinessType.OTHER })
  async simulate(@Body() dto: SimulateDto) {
    return await this.service.simulate(dto);
  }
}
