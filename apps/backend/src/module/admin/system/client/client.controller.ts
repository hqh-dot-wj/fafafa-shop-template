import { Controller, Get, Post, Body, Put, Param, Delete, Res, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ClientService } from './client.service';
import {
  CreateClientDto,
  UpdateClientDto,
  ListClientDto,
  ChangeClientStatusDto,
} from './dto/index';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Api } from 'src/common/decorators/api.decorator';
import { ClientListVo } from './vo/client.vo';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { UserTool, UserToolType } from '../user/user.decorator';

/**
 * OAuth 客户端（sys_client）管理，平台级数据，不按租户隔离。
 *
 * @tenantScope PlatformOnly
 */
@ApiTags('客户端管理')
@Controller('system/client')
@ApiBearerAuth('Authorization')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Api({
    summary: '客户端管理-列表',
    description: '分页查询 OAuth 客户端',
    type: ClientListVo,
  })
  @RequirePermission('system:client:list')
  @Get('/list')
  findAll(@Query() query: ListClientDto) {
    return this.clientService.findAll(query);
  }

  @Api({
    summary: '客户端管理-创建',
    description: '新增客户端',
    body: CreateClientDto,
  })
  @RequirePermission('system:client:add')
  @Operlog({ businessType: BusinessType.INSERT })
  @Post('/')
  create(@Body() dto: CreateClientDto, @UserTool() { injectCreate }: UserToolType) {
    return this.clientService.create(injectCreate(dto));
  }

  @Api({
    summary: '客户端管理-更新',
    description: '修改客户端',
    body: UpdateClientDto,
  })
  @RequirePermission('system:client:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Put('/')
  update(@Body() dto: UpdateClientDto, @UserTool() { injectUpdate }: UserToolType) {
    return this.clientService.update(injectUpdate(dto));
  }

  @Api({
    summary: '客户端管理-修改状态',
    description: '按 clientId 更新启用/停用',
    body: ChangeClientStatusDto,
  })
  @RequirePermission('system:client:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Put('/changeStatus')
  changeStatus(@Body() dto: ChangeClientStatusDto, @UserTool() { injectUpdate }: UserToolType) {
    return this.clientService.changeStatus(injectUpdate(dto));
  }

  @Api({
    summary: '客户端管理-删除',
    description: '批量删除（软删），多个 ID 逗号分隔',
    params: [{ name: 'ids', description: '主键 ID，多个用逗号分隔' }],
  })
  @RequirePermission('system:client:remove')
  @Operlog({ businessType: BusinessType.DELETE })
  @Delete('/:ids')
  remove(@Param('ids') ids: string) {
    const idList = ids.split(',').map((id) => Number(id)).filter((n) => !Number.isNaN(n));
    return this.clientService.remove(idList);
  }

  @Api({
    summary: '客户端管理-导出',
    description: '导出为 xlsx',
    body: ListClientDto,
    produces: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  })
  @RequirePermission('system:client:export')
  @Operlog({ businessType: BusinessType.EXPORT })
  @Post('/export')
  async exportData(@Res() res: Response, @Body() body: ListClientDto): Promise<void> {
    return this.clientService.export(res, body);
  }
}
