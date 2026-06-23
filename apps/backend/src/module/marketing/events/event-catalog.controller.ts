import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { EventCatalogQueryDto } from './dto/event-catalog-query.dto';
import { EventCatalogService } from './event-catalog.service';
import { EventCatalogItemVo, EventCatalogSummaryVo } from './vo/event-catalog.vo';

@ApiTags('营销-事件目录')
@Controller('admin/marketing/events')
@ApiBearerAuth('Authorization')
export class EventCatalogController {
  constructor(private readonly service: EventCatalogService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('catalog')
  @Api({ summary: '查询营销事件目录', type: EventCatalogItemVo, isArray: true })
  @RequirePermission('marketing:policy:list')
  list(@Query() query: EventCatalogQueryDto): Result<EventCatalogItemVo[]> {
    return Result.ok(this.service.list(query));
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   */
  @Get('catalog/summary')
  @Api({ summary: '查询营销事件目录汇总', type: EventCatalogSummaryVo })
  @RequirePermission('marketing:policy:list')
  summary(): Result<EventCatalogSummaryVo> {
    return Result.ok(this.service.summary());
  }
}
