import { Controller, Get, Post, Put, Delete, Body, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { MessageService } from './message.service';
import { ListMessageDto, CreateMessageDto } from './dto/message.dto';
import { MessageVo } from './vo/message.vo';
import { User } from 'src/module/admin/system/user/user.decorator';

@ApiTags('系统消息')
@Controller('system/message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('list')
  @Api({ summary: '查询消息列表', type: MessageVo })
  async findAll(@Query() query: ListMessageDto, @User('userId') adminUserId?: number) {
    const tenantId = TenantContext.getTenantId();
    return await this.messageService.findAll(query, tenantId, adminUserId);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post()
  @ApiOperation({ summary: '发送消息 (测试用)' })
  async create(@Body() dto: CreateMessageDto) {
    return await this.messageService.create(dto);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Put(':id/read')
  @ApiOperation({ summary: '标记已读' })
  async read(@Param('id', ParseIntPipe) id: number) {
    return await this.messageService.read(id);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除消息' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return await this.messageService.delete(id);
  }
}
