import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { MarketingSchemaService } from './schema.service';
import { MarketingJsonSchemaVo } from './vo/marketing-json-schema.vo';

@ApiTags('营销-Schema')
@Controller('admin/marketing/schema')
@ApiBearerAuth('Authorization')
export class MarketingSchemaController {
  constructor(private readonly service: MarketingSchemaService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('policy/:type')
  @Api({ summary: '获取营销策略动态表单 Schema', type: MarketingJsonSchemaVo })
  @RequirePermission('marketing:rule:schema:query')
  async getPolicySchema(@Param('type') type: string) {
    return Result.ok(this.service.getPolicySchema(type) as unknown as MarketingJsonSchemaVo);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('play/:code')
  @Api({ summary: '获取玩法规则动态表单 Schema', type: MarketingJsonSchemaVo })
  @RequirePermission('marketing:rule:schema:query')
  async getPlayRuleSchema(@Param('code') code: string) {
    const data = await this.service.getPlayRuleSchema(code);
    return Result.ok(data as unknown as MarketingJsonSchemaVo);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('scene-template/:templateCode')
  @Api({ summary: '获取场景模板动态表单 Schema', type: MarketingJsonSchemaVo })
  @RequirePermission('marketing:rule:schema:query')
  async getSceneTemplateSchema(@Param('templateCode') templateCode: string) {
    const data = await this.service.getSceneTemplateSchema(templateCode);
    return Result.ok(data as unknown as MarketingJsonSchemaVo);
  }
}
