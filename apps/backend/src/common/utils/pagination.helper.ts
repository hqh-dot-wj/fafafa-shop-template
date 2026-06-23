import { Prisma } from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
}

export interface PaginationParams {
  pageNum?: number | string;
  pageSize?: number | string;
}

export interface PaginationQuery {
  skip: number;
  take: number;
  pageNum: number;
  pageSize: number;
}

interface PaginationDelegate<T, TFindManyArgs extends object, TCountArgs extends object> {
  findMany: (args: TFindManyArgs) => Prisma.PrismaPromise<T[]>;
  count: (args?: TCountArgs) => Prisma.PrismaPromise<number>;
}

/** 深分页限制：offset 超过此值会抛错，大表需用游标/时间分页 */
const MAX_OFFSET = 5000;

export class PaginationHelper {
  static getPagination(params: PaginationParams = {}): PaginationQuery {
    const pageSize = Number(params.pageSize ?? 10);
    const pageNum = Number(params.pageNum ?? 1);
    const take = pageSize > 0 ? pageSize : 10;
    const skip = take * (pageNum > 0 ? pageNum - 1 : 0);
    if (skip > MAX_OFFSET) {
      throw new Error(`分页深度超出限制(offset>${MAX_OFFSET})，请使用游标分页或时间范围筛选`);
    }
    return { skip, take, pageNum: pageNum > 0 ? pageNum : 1, pageSize: take };
  }

  static async paginate<T>(findMany: () => Promise<T[]>, count: () => Promise<number>): Promise<PaginatedResult<T>> {
    const [rows, total] = await Promise.all([findMany(), count()]);
    return { rows, total };
  }

  static async paginateWithTransaction<T, TFindManyArgs extends object, TCountArgs extends object>(
    prisma: Pick<PrismaService, '$transaction'>,
    delegate: PaginationDelegate<T, TFindManyArgs, TCountArgs>,
    findManyArgs: TFindManyArgs,
    countArgs?: TCountArgs,
  ): Promise<PaginatedResult<T>> {
    const [rows, total] = await prisma.$transaction([delegate.findMany(findManyArgs), delegate.count(countArgs)]);
    return { rows, total };
  }

  static buildDateRange(params?: { beginTime?: string; endTime?: string }): Prisma.DateTimeFilter | undefined {
    if (!params?.beginTime && !params?.endTime) return undefined;
    const filter: Prisma.DateTimeFilter = {};
    if (params.beginTime) filter.gte = new Date(params.beginTime);
    if (params.endTime) filter.lte = new Date(params.endTime);
    return filter;
  }

  /** 前后模糊 LIKE %value%，大表慎用，建议改用 startsWith 或全文索引 */
  static buildStringFilter(value?: string): Prisma.StringFilter | undefined {
    if (!value) return undefined;
    return { contains: value };
  }

  static buildInFilter<T>(values?: T[]): { in: T[] } | undefined {
    if (!values || values.length === 0) return undefined;
    return { in: values };
  }
}
