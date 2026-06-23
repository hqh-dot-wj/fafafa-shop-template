import { Injectable } from '@nestjs/common';
import { CouponRefundCompensationStatus, Prisma } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { Result } from 'src/common/response/result';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';

export interface ListRefundCompensationsQuery {
  status?: string;
  memberId?: string;
  pageNum?: number | string;
  pageSize?: number | string;
}

export interface ResolveRefundCompensationDto {
  status?: 'RESOLVED' | 'CANCELLED';
  resolvedBy?: string;
  remark?: string;
}

@Injectable()
export class CouponRefundCompensationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListRefundCompensationsQuery = {}) {
    const pageNum = this.toPositiveInt(query.pageNum, 1);
    const pageSize = this.toPositiveInt(query.pageSize, 10);
    const where = this.buildTenantWhere();

    if (query.status) {
      BusinessException.throwIf(
        !Object.values(CouponRefundCompensationStatus).includes(query.status as CouponRefundCompensationStatus),
        '补偿状态不合法',
      );
      where.status = query.status as CouponRefundCompensationStatus;
    }

    if (query.memberId) {
      where.memberId = query.memberId;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mktCouponRefundCompensation.findMany({
        where,
        orderBy: [{ createTime: 'desc' }, { id: 'desc' }],
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.mktCouponRefundCompensation.count({ where }),
    ]);

    return Result.page(rows, total, pageNum, pageSize);
  }

  async resolve(id: string, dto: ResolveRefundCompensationDto = {}) {
    const where = this.buildTenantWhere({ id });
    const current = await this.prisma.mktCouponRefundCompensation.findFirst({ where });
    BusinessException.throwIfNull(current, '补偿记录不存在');

    const row = await this.prisma.mktCouponRefundCompensation.update({
      where: { id: current.id },
      data: {
        status: dto.status ?? CouponRefundCompensationStatus.RESOLVED,
        resolvedBy: dto.resolvedBy ?? 'system',
        resolvedTime: new Date(),
        resolveRemark: dto.remark,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    return Result.ok(row);
  }

  private buildTenantWhere(extra: Prisma.MktCouponRefundCompensationWhereInput = {}) {
    const where: Prisma.MktCouponRefundCompensationWhereInput = { ...extra };
    const tenantId = TenantContext.getTenantId();

    if (tenantId && tenantId !== TenantContext.SUPER_TENANT_ID && !TenantContext.isIgnoreTenant()) {
      where.tenantId = tenantId;
    }

    return where;
  }

  private toPositiveInt(value: number | string | undefined, fallback: number) {
    const parsed = Number(value ?? fallback);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
