import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { DelFlagEnum } from 'src/common/enum/index';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaginatedData } from '../response/response.interface';
import { TenantContext } from '../tenant/tenant.context';
import { PrismaDelegate, FindOptions as CommonFindOptions } from 'src/common/types';

/**
 * 分页查询选项
 */
export interface PaginationOptions {
  pageNum?: number;
  pageSize?: number;
}

/**
 * 排序选项
 */
export interface SortOptions {
  orderBy?: string;
  order?: 'asc' | 'desc';
}

/**
 * 查询选项
 */
export interface QueryOptions extends PaginationOptions, SortOptions {
  /** 查询条件 */
  where?: Record<string, unknown>;
  /** 关联查询 */
  include?: Record<string, boolean | object>;
  /** 字段选择 */
  select?: Record<string, boolean>;
}

/**
 * 基础仓储抽象类
 *
 * @description 提供通用的 CRUD 操作封装，减少 Service 层的样板代码
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserRepository extends BaseRepository<SysUser, Prisma.SysUserDelegate> {
 *   constructor(prisma: PrismaService) {
 *     super(prisma, 'sysUser');
 *   }
 * }
 * ```
 */
export abstract class BaseRepository<
  T,
  CreateInput = Partial<T>,
  UpdateInput = Partial<T>,
  D extends PrismaDelegate = PrismaDelegate,
> {
  protected readonly logger = new Logger(BaseRepository.name);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly cls: ClsService,
    protected readonly modelName: keyof PrismaClient,
    protected readonly primaryKeyName: string = 'id',
    protected readonly tenantFieldName: string = 'tenantId',
  ) {}

  /**
   * 委托对象按调用时动态解析，确保在事务上下文中使用 TransactionClient。
   */
  protected get delegate(): D {
    const client = this.client as PrismaClient & Record<string, D>;
    return client[String(this.modelName)];
  }

  /**
   * 根据主键查询单条记录
   */
  async findById(
    id: number | string | bigint,
    options?: { include?: Record<string, boolean | object>; select?: Record<string, boolean> },
  ): Promise<T | null> {
    return this.delegate.findUnique({
      where: { [this.getPrimaryKeyName()]: id },
      ...options,
    });
  }

  /**
   * 根据条件查询单条记录
   */
  async findOne(
    where: object,
    options?: { include?: Record<string, boolean | object>; select?: Record<string, boolean> },
  ): Promise<T | null> {
    const delegateWithFindFirst = this.delegate as D & {
      findFirst: (args: Record<string, unknown>) => Promise<T | null>;
    };
    return delegateWithFindFirst.findFirst({
      where: this.scopeReadWhere(where),
      ...options,
    });
  }

  /**
   * 查询所有记录
   */
  async findAll(options?: Omit<QueryOptions, 'pageNum' | 'pageSize'>): Promise<T[]> {
    const { where, include, select, orderBy, order } = options || {};

    return this.delegate.findMany({
      where: this.scopeReadWhere(where),
      include,
      select,
      orderBy: orderBy ? { [orderBy]: order || 'asc' } : undefined,
    });
  }

  /**
   * 条件 findMany（与 findAll 一致合并当前租户 scope，含审计）
   */
  async findMany(args?: Record<string, unknown>): Promise<T[]> {
    const input = args ?? {};
    const where = this.scopeReadWhere((input.where ?? {}) as object);
    return this.delegate.findMany({
      ...input,
      where,
    });
  }

  /**
   * 分页查询
   */
  async findPage(options: QueryOptions): Promise<IPaginatedData<T>> {
    const { pageNum = 1, pageSize = 10, where, include, select, orderBy, order } = options;
    const skip = (pageNum - 1) * pageSize;
    const tenantRefinedWhere = this.scopeReadWhere(where);

    const [rows, total] = await Promise.all([
      this.delegate.findMany({
        where: tenantRefinedWhere,
        include,
        select,
        orderBy: orderBy ? { [orderBy]: order || 'asc' } : undefined,
        skip,
        take: pageSize,
      }),
      this.delegate.count({ where: tenantRefinedWhere }),
    ]);

    return {
      rows,
      total,
      pageNum,
      pageSize,
      pages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 创建记录
   */
  async create(
    data: object,
    options?: { include?: Record<string, boolean | object>; select?: Record<string, boolean> },
  ): Promise<T> {
    return this.delegate.create({
      data,
      ...options,
    });
  }

  /**
   * 批量创建
   */
  async createMany(data: object[]): Promise<{ count: number }> {
    if (!this.delegate.createMany) {
      throw new Error('createMany not supported for this model');
    }
    return this.delegate.createMany({
      data,
      skipDuplicates: true,
    });
  }

  /**
   * 更新记录
   */
  async update(
    id: number | string | bigint,
    data: object,
    options?: { include?: Record<string, boolean | object>; select?: Record<string, boolean> },
  ): Promise<T> {
    return this.delegate.update({
      where: { [this.getPrimaryKeyName()]: id },
      data,
      ...options,
    });
  }

  /**
   * 根据条件更新
   */
  async updateMany(where: object, data: object): Promise<{ count: number }> {
    if (!this.delegate.updateMany) {
      throw new Error('updateMany not supported for this model');
    }
    return this.delegate.updateMany({
      where,
      data,
    });
  }

  /**
   * 删除记录
   */
  async delete(id: number | string | bigint): Promise<T> {
    return this.delegate.delete({
      where: { [this.getPrimaryKeyName()]: id },
    });
  }

  /**
   * 批量删除
   */
  async deleteMany(where: object): Promise<{ count: number }> {
    if (!this.delegate.deleteMany) {
      throw new Error('deleteMany not supported for this model');
    }
    return this.delegate.deleteMany({ where });
  }

  /**
   * 根据主键批量删除
   */

  async deleteByIds(ids: (number | string | bigint)[]): Promise<{ count: number }> {
    return this.deleteMany({
      [this.getPrimaryKeyName()]: { in: ids },
    });
  }

  /**
   * 统计记录数（合并当前租户 scope，含审计）
   */
  async count(where?: object): Promise<number> {
    return this.delegate.count({ where: this.scopeReadWhere(where) });
  }

  /**
   * 检查是否存在
   */
  async exists(where: object): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * 根据主键检查是否存在
   */
  async existsById(id: number | string | bigint): Promise<boolean> {
    return this.exists({ [this.getPrimaryKeyName()]: id } as Partial<T>);
  }

  /**
   * 软删除（设置 delFlag）
   */

  async softDelete(id: number | string | bigint): Promise<T> {
    return this.update(id, { delFlag: DelFlagEnum.DELETE });
  }

  /**
   * 批量软删除
   */
  async softDeleteBatch(ids: (number | string | bigint)[]): Promise<number> {
    const result = await this.updateMany({ [this.getPrimaryKeyName()]: { in: ids } }, { delFlag: DelFlagEnum.DELETE });
    return result.count;
  }

  /**
   * 获取主键字段名（子类可覆盖）
   */
  protected getPrimaryKeyName(): string {
    return this.primaryKeyName;
  }

  /**
   * 获取 Prisma 原始客户端（用于复杂查询）
   * 如果在事务上下文中，返回事务客户端
   */
  protected get client(): PrismaService | Prisma.TransactionClient {
    const tx = this.cls.get<Prisma.TransactionClient>('PRISMA_TX');
    if (tx) {
      return tx;
    }
    return this.prisma;
  }

  /**
   * 获取自动租户过滤条件
   *
   * FAFAFA-PIVOT-PHASE2-2026-06：移除"超级租户短路"分支。
   *
   * 历史语义：当 tenantId === SUPER_TENANT_ID('000000') 时返回 {} 表示跨租户查看。
   * 新语义（单实例单租户模板模式）：
   *   - 单部署对应单客户独立实例，租户上下文兜底为 '000000'
   *   - BaseRepository 统一走 tenantId 过滤，不再有"超级租户跨租户"语义
   *   - 仅保留 IgnoreTenant 装饰器（用于偶尔的跨上下文聚合）与 tenantId 缺失兜底
   *   - 业务代码中 isSuperTenant() 使用点（如 finance/wallet/commission 的 `isSuper ? {} : { tenantId }`）
   *     在单租户兜底下行为等价（全表数据 tenantId='000000'），不在本 Phase 治理范围
   */
  protected getTenantWhere(): Record<string, unknown> {
    if (!this.tenantFieldName) {
      return {};
    }

    const tenantId = TenantContext.getTenantId() || this.cls.get('tenantId');
    const isIgnore = TenantContext.isIgnoreTenant() || false;

    if (isIgnore || !tenantId) {
      return {};
    }

    return { [this.tenantFieldName]: tenantId };
  }

  /**
   * 子类通过 delegate 直接 findMany/findFirst/count 等读库时，将原始 where 经此方法合并（与 {@link findMany} / {@link count} 一致，含审计）。
   */
  protected scopeReadWhere(where?: object): Record<string, unknown> {
    return this.applyTenantFilter(where);
  }

  /**
   * 合并查询条件，增加租户隔离
   */
  protected applyTenantFilter(where?: object): Record<string, unknown> {
    const tenantWhere = this.getTenantWhere();
    const whereObj = (where ?? {}) as Record<string, unknown>;

    // 记录审计日志
    this.recordAuditLog(whereObj, tenantWhere);

    if (Object.keys(tenantWhere).length === 0) {
      return whereObj;
    }
    return { ...whereObj, ...tenantWhere };
  }

  /**
   * 记录审计日志
   */
  private recordAuditLog(where: object | undefined, tenantWhere: Record<string, unknown>): void {
    try {
      const auditData = this.cls.get<Record<string, unknown>>('AUDIT_DATA');
      if (!auditData) {
        return; // 无审计上下文,跳过
      }

      const tenantId = TenantContext.getTenantId();
      const isSuperTenant = TenantContext.isSuperTenant();
      const isIgnoreTenant = TenantContext.isIgnoreTenant();

      // 检测跨租户访问
      const whereObj = where as Record<string, unknown> | undefined;
      const accessTenantId = whereObj?.[this.tenantFieldName] || tenantWhere[this.tenantFieldName];
      const isCrossTenant = !!(tenantId && accessTenantId && tenantId !== accessTenantId && !isSuperTenant);

      // 构建审计日志数据
      const auditLog = {
        ...auditData,
        accessTenantId: accessTenantId || tenantId,
        action: 'data_access',
        modelName: String(this.modelName),
        operation: 'query',
        isCrossTenant,
        duration: this.cls.get('AUDIT_DURATION'),
        status: this.cls.get('AUDIT_STATUS') || 'pending',
        errorMessage: this.cls.get('AUDIT_ERROR'),
      };

      // 异步推送到审计队列 (避免阻塞主流程)
      setImmediate(() => {
        const auditService = this.cls.get<{ recordAccess: (log: Record<string, unknown>) => void }>('AUDIT_SERVICE');

        if (!auditService) {
          this.logger.warn(
            `[Audit] AUDIT_SERVICE missing; skip access log. model=${String(this.modelName)} tenant=${String(accessTenantId || tenantId || '')}`,
          );
          return;
        }

        try {
          auditService.recordAccess(auditLog);
        } catch (error) {
          this.logger.error(
            `[Audit] Failed to record access log. model=${String(this.modelName)} tenant=${String(accessTenantId || tenantId || '')}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      });
    } catch (error) {
      // 审计日志记录失败不应影响业务，但必须留下可观测信号。
      this.logger.error(
        `[Audit] Failed to schedule access log. model=${String(this.modelName)}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

/**
 * 带软删除的仓储基类
 *
 * @description 自动在查询条件中添加 delFlag = '0' 过滤
 */
export abstract class SoftDeleteRepository<
  T,
  CreateInput = Partial<T>,
  UpdateInput = Partial<T>,
  D extends PrismaDelegate = PrismaDelegate,
> extends BaseRepository<T, CreateInput, UpdateInput, D> {
  /**
   * 获取默认的查询条件（排除已删除）
   */
  protected getDefaultWhere(): Record<string, unknown> {
    return { delFlag: DelFlagEnum.NORMAL };
  }

  /**
   * 合并默认查询条件
   */
  protected mergeWhere(where?: object): Record<string, unknown> {
    return { ...this.getDefaultWhere(), ...where };
  }

  protected scopeReadWhere(where?: object): Record<string, unknown> {
    return this.applyTenantFilter(this.mergeWhere(where));
  }

  async findOne(
    where: object,
    options?: { include?: Record<string, boolean | object>; select?: Record<string, boolean> },
  ): Promise<T | null> {
    return super.findOne(this.mergeWhere(where), options);
  }

  async findAll(options?: Omit<QueryOptions, 'pageNum' | 'pageSize'>): Promise<T[]> {
    return super.findAll({
      ...options,
      where: this.mergeWhere(options?.where),
    });
  }

  async findPage(options: QueryOptions): Promise<IPaginatedData<T>> {
    return super.findPage({
      ...options,
      where: this.mergeWhere(options.where),
    });
  }

  async findMany(args?: Record<string, unknown>): Promise<T[]> {
    return super.findMany({
      ...args,
      where: this.mergeWhere((args as { where?: Record<string, unknown> })?.where),
    });
  }

  async count(where?: object): Promise<number> {
    return super.count(this.mergeWhere(where));
  }

  async exists(where: object): Promise<boolean> {
    return super.exists(this.mergeWhere(where));
  }
}
