import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { AiPlatformPromptService } from './ai-platform-prompt.service';
import {
  CreatePlatformPromptDto,
  ListPlatformPromptDto,
  UpdatePlatformPromptDto,
  UpdateStatusDto,
} from './dto/platform-prompt.dto';
import { TenantHelper } from 'src/common/tenant/tenant.helper';

/**
 * AI 平台 Prompt 管理，对应 admin-web service/api/marketing/ai-prompt.ts。
 * 页面归在营销菜单，但后端能力属于 ai-content；新增字段时需同步前端本地类型或生成契约。
 *
 * @tenantScope TenantScoped
 */
@ApiTags('AI-Prompt管理')
@Controller('ai-platform-prompt')
@ApiBearerAuth('Authorization')
export class AiPlatformPromptController {
  constructor(
    private readonly service: AiPlatformPromptService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  @Get('list')
  @RequirePermission('marketing:aiPrompt:list')
  @Api({ summary: 'Prompt-列表' })
  findAll(@Query() query: ListPlatformPromptDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermission('marketing:aiPrompt:list')
  @Api({ summary: 'Prompt-详情' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('marketing:aiPrompt:list')
  @Api({ summary: 'Prompt-新增', body: CreatePlatformPromptDto })
  create(@Body() dto: CreatePlatformPromptDto) {
    const tenantId = this.tenantHelper.getTenantId();
    return this.service.create(dto, tenantId);
  }

  @Put(':id/status')
  @RequirePermission('marketing:aiPrompt:list')
  @Api({ summary: 'Prompt-启用/停用', body: UpdateStatusDto })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Put(':id')
  @RequirePermission('marketing:aiPrompt:list')
  @Api({ summary: 'Prompt-编辑', body: UpdatePlatformPromptDto })
  update(@Param('id') id: string, @Body() dto: UpdatePlatformPromptDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('marketing:aiPrompt:list')
  @Api({ summary: 'Prompt-删除' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
