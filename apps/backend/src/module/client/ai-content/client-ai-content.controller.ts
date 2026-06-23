import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { MemberAuthGuard } from 'src/module/client/common/guards/member-auth.guard';
import { AiContentService } from 'src/module/ai-content/ai-content.service';
import { GenerateContentDto } from 'src/module/ai-content/dto/generate-content.dto';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { normalizeClientPageQuery } from '../common/utils/pagination';

/** @tenantScope TenantScoped */
@ApiTags('C端-AI文案')
@ApiBearerAuth()
@Controller('client/ai-content')
@UseGuards(MemberAuthGuard)
export class ClientAiContentController {
  constructor(
    private readonly aiContentService: AiContentService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  @Get('platforms')
  @Api({ summary: '获取可用平台列表' })
  getPlatforms() {
    const tenantId = this.tenantHelper.getTenantId();
    return this.aiContentService.getAvailablePlatforms(tenantId);
  }

  @Post('generate')
  @Api({ summary: '生成文案', body: GenerateContentDto })
  generate(@Member('memberId') memberId: string, @Body() dto: GenerateContentDto) {
    const tenantId = this.tenantHelper.getTenantId();
    return this.aiContentService.generate(memberId, dto.platformCode, dto.userInput, tenantId);
  }

  @Get('history')
  @Api({ summary: '我的生成历史' })
  getHistory(
    @Member('memberId') memberId: string,
    @Query('pageNum') pageNum?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const page = normalizeClientPageQuery(pageNum, pageSize);
    return this.aiContentService.getHistory(memberId, page.pageNum, page.pageSize);
  }
}
