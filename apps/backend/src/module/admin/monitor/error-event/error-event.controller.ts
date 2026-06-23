import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { ErrorEventService } from 'src/common/observability';
import { ListErrorEventDto, ListStepEventDto } from './dto/list-error-event.dto';
import { ErrorEventVo, StepEventVo } from './vo/error-event.vo';

@ApiTags('错误事件监控')
@Controller('monitor/error-event')
@ApiBearerAuth('Authorization')
export class ErrorEventController {
  constructor(private readonly errorEventService: ErrorEventService) {}

  @Get('/list')
  @Api({ summary: '错误事件列表', type: ErrorEventVo, isArray: true, isPager: true })
  @RequirePermission('monitor:error-event:list')
  findAll(@Query() query: ListErrorEventDto) {
    return this.errorEventService.listErrorEvents(query);
  }

  @Get('/steps')
  @Api({ summary: '步骤事件列表', type: StepEventVo, isArray: true, isPager: true })
  @RequirePermission('monitor:error-event:list')
  findSteps(@Query() query: ListStepEventDto) {
    return this.errorEventService.listStepEvents(query);
  }

  @Get(':errorId/steps')
  @Api({ summary: '错误关联步骤事件', type: StepEventVo, isArray: true, isPager: true })
  @RequirePermission('monitor:error-event:query')
  findStepsByError(@Param('errorId') errorId: string) {
    return this.errorEventService.listStepEvents({ pageNum: 1, pageSize: 50, errorId });
  }
}
