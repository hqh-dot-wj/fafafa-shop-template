import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ListNotificationDto } from './dto/list-notification.dto';
import { Result } from 'src/common/response';
import { FormatDateFields } from 'src/common/utils';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { JwtAuthGuard } from 'src/module/admin/common/guards/auth.guard';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * 通知记录查询接口（AC-11）
 * 按租户分页查询
 */
@ApiTags('系统-通知记录')
@Controller('admin/notification')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('list')
  @ApiOperation({ summary: '通知记录列表' })
  @RequirePermission('system:notice:list')
  async list(@Query() query: ListNotificationDto) {
    const tenantId = TenantContext.getTenantId();
    const isSuper = TenantContext.isSuperTenant();

    const baseWhere: Prisma.SysNotificationLogWhereInput = {};
    if (!isSuper) baseWhere.tenantId = tenantId;
    if (query.channel) baseWhere.channel = query.channel;
    if (query.status) baseWhere.status = query.status;
    if (query.bizType) baseWhere.bizType = query.bizType;
    if (query.activityId) baseWhere.activityId = query.activityId;
    if (query.touchpointCode) baseWhere.touchpointCode = query.touchpointCode;
    if (query.touchpointKind) baseWhere.touchpointKind = query.touchpointKind;
    if (query.templateCode) baseWhere.template = query.templateCode;
    if (query.sceneCode) baseWhere.sceneCode = query.sceneCode;
    if (query.bizRefId) baseWhere.bizRefId = query.bizRefId;

    if (query.createTimeFrom || query.createTimeTo) {
      baseWhere.createTime = {
        ...(query.createTimeFrom ? { gte: new Date(query.createTimeFrom) } : {}),
        ...(query.createTimeTo ? { lte: new Date(query.createTimeTo) } : {}),
      };
    }

    const where = this.tenantHelper.readWhereForDelegate(
      'sysNotificationLog',
      baseWhere,
    ) as Prisma.SysNotificationLogWhereInput;

    const [list, total] = await this.prisma.$transaction([
      this.prisma.sysNotificationLog.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
      }),
      this.prisma.sysNotificationLog.count({
        where: this.tenantHelper.readWhereForDelegate(
          'sysNotificationLog',
          baseWhere,
        ) as Prisma.SysNotificationLogWhereInput,
      }),
    ]);

    return Result.page(FormatDateFields(list), total);
  }
}
