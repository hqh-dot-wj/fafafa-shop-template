import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { PaginationHelper } from 'src/common/utils/pagination.helper';
import { BusinessException } from 'src/common/exceptions';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { FormatDateFields } from 'src/common/utils';
import { UserType } from 'src/module/admin/system/user/dto/user';
import type { LogOperationMeta } from './log-operation.meta';
import { BizOperationTargetTypes } from './biz-operation-log.constants';
import { ListMemberBizOperationLogDto, ListOrderBizOperationLogDto } from './dto/list-biz-operation-log.dto';
import { BizOperationLogVo } from './vo/biz-operation-log.vo';

function pickDetail(body: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (body[k] !== undefined) {
      out[k] = body[k];
    }
  }
  return out;
}

function stringifyDetail(detail: Record<string, unknown>): string {
  try {
    return JSON.stringify(detail).slice(0, 4000);
  } catch {
    return '{}';
  }
}

/**
 * 业务操作日志：关键业务动作可追溯
 */
@Injectable()
export class BizOperationLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 记录一条日志（租户来自 TenantContext）
   */
  async append(params: {
    operatorId: string;
    operatorName: string;
    action: string;
    targetType: string;
    targetId: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    BusinessException.throwIf(!tenantId, '租户上下文缺失');

    const detailStr =
      params.detail && Object.keys(params.detail).length > 0 ? stringifyDetail(params.detail) : null;

    await this.prisma.bizOperationLog.create({
      data: {
        tenantId,
        operatorId: params.operatorId.slice(0, 64),
        operatorName: (params.operatorName || 'unknown').slice(0, 64),
        action: params.action.slice(0, 64),
        targetType: params.targetType.slice(0, 32),
        targetId: params.targetId.slice(0, 64),
        detail: detailStr,
      },
    });
  }

  /**
   * 由 HTTP 请求与元数据组装并写入（供拦截器调用）
   */
  async recordFromHttp(meta: LogOperationMeta, req: Request): Promise<void> {
    const user = req.user as UserType | undefined;
    const operatorId = String(user?.userId ?? '');
    const operatorName = user?.userName ?? '';
    const body = (req.body ?? {}) as Record<string, unknown>;
    const params = (req.params ?? {}) as Record<string, string>;

    let targetId = '';
    const detail: Record<string, unknown> = {};

    if (meta.batchOrderIdsBodyKey) {
      const ids = body[meta.batchOrderIdsBodyKey] as string[] | undefined;
      if (Array.isArray(ids) && ids.length > 0) {
        targetId = ids[0]!;
        detail.orderIds = ids;
      } else {
        targetId = 'BATCH';
      }
    } else if (meta.targetIdBodyKey) {
      targetId = String(body[meta.targetIdBodyKey] ?? '');
    } else if (meta.targetIdParam) {
      targetId = params[meta.targetIdParam] ?? '';
    }

    if (!targetId) {
      return;
    }

    if (meta.detailBodyKeys?.length) {
      Object.assign(detail, pickDetail(body, meta.detailBodyKeys));
    }

    await this.append({
      operatorId,
      operatorName,
      action: meta.action,
      targetType: meta.targetType,
      targetId,
      detail: Object.keys(detail).length ? detail : undefined,
    });
  }

  /**
   * 分页查询订单相关操作日志
   */
  async listForOrder(query: ListOrderBizOperationLogDto) {
    return this.listByTarget(BizOperationTargetTypes.ORDER, query.orderId, query);
  }

  /**
   * 分页查询会员相关操作日志
   */
  async listForMember(query: ListMemberBizOperationLogDto) {
    return this.listByTarget(BizOperationTargetTypes.MEMBER, query.memberId, query);
  }

  private async listByTarget(
    targetType: string,
    targetId: string,
    query: ListOrderBizOperationLogDto | ListMemberBizOperationLogDto,
  ) {
    const { skip, take } = PaginationHelper.getPagination(query);

    const baseWhere = this.tenantHelper.readWhereForDelegate('bizOperationLog', {
      targetType,
      targetId,
    });

    const [rows, total] = await Promise.all([
      this.prisma.bizOperationLog.findMany({
        where: baseWhere,
        orderBy: { createTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.bizOperationLog.count({ where: baseWhere }),
    ]);

    const vos: BizOperationLogVo[] = rows.map((r) => {
      const formatted = FormatDateFields({
        id: r.id,
        operatorName: r.operatorName,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        detail: r.detail,
        createTime: r.createTime,
      });
      return formatted as unknown as BizOperationLogVo;
    });

    return Result.page(vos, total, query.pageNum, query.pageSize);
  }
}
