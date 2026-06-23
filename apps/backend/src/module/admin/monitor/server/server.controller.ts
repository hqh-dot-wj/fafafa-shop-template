import { Controller, Get } from '@nestjs/common';
import { ServerService } from './server.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { ServerInfoVo } from 'src/module/admin/monitor/vo/monitor.vo';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';

@ApiTags('系统监控-服务监控')
@ApiBearerAuth('Authorization')
@Controller('monitor/server')
export class ServerController {
  constructor(private readonly serverService: ServerService) {}

  @Api({
    summary: '服务器信息',
    description: '获取服务器CPU、内存、系统等监控信息',
    type: ServerInfoVo,
  })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('monitor:server:list')
  @Get()
  getInfo() {
    return this.serverService.getInfo();
  }
}
