import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { MarketingProtocolDefinitionVo } from './dto/protocol-definition.vo';
import { MarketingProtocolService } from './protocol.service';

/**
 * 营销协议定义只读接口，对应 admin-web service/api/marketing/protocol.ts。
 * 该接口给前端编排页提供稳定协议元信息，不承载活动实例或规则保存。
 */
@ApiTags('营销-协议')
@ApiBearerAuth('Authorization')
@Controller('marketing/protocol')
export class MarketingProtocolController {
  constructor(private readonly protocolService: MarketingProtocolService) {}

  @Get('definition')
  @Api({ summary: '获取营销协议定义', type: MarketingProtocolDefinitionVo })
  async getDefinition(): Promise<Result<MarketingProtocolDefinitionVo>> {
    return Result.ok(this.protocolService.getDefinition());
  }
}
