import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SoftDeleteRepository } from 'src/common/repository/base.repository';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { AiPlatformPrompt, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { ListPlatformPromptDto } from './dto/platform-prompt.dto';

@Injectable()
export class AiPlatformPromptRepository extends SoftDeleteRepository<
  AiPlatformPrompt,
  Prisma.AiPlatformPromptCreateInput,
  Prisma.AiPlatformPromptUpdateInput
> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'aiPlatformPrompt');
  }

  /**
   * 按条件分页查询平台 Prompt 配置
   *
   * @param query - 分页参数与筛选条件（platformCode / status）
   * @returns 分页结果
   */
  async search(query: ListPlatformPromptDto) {
    const where: Prisma.AiPlatformPromptWhereInput = {};
    if (query.platformCode) {
      where.platformCode = query.platformCode;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }
    return this.findPage({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      where,
      orderBy: 'sortOrder',
      order: 'asc',
    });
  }

  /**
   * 根据平台标识查询启用状态的 Prompt 配置
   *
   * @param platformCode - 平台标识
   * @param tenantId - 指定租户 ID；不传则使用当前请求租户 scope
   * @returns Prompt 配置或 null
   * @remarks
   * `applyTenantFilter` 为 `{ ...where, ...getTenantWhere() }`，在 where 里写 `tenantId` 会被当前请求租户覆盖。
   * 总部 `000000` 在 `getTenantWhere` 中视为超级租户而不加 `tenantId` 条件，也不能仅靠 `TenantContext.run({ tenantId: '000000' })`。
   * 显式查某租户时使用 `ignoreTenant: true` 并在 where 中带上 `tenantId`，避免合并覆盖且保证按租户命中。
   */
  async findByPlatformCode(platformCode: string, tenantId?: string): Promise<AiPlatformPrompt | null> {
    const innerWhere = { platformCode, status: 1 };
    if (tenantId === undefined || tenantId === '') {
      return this.findOne(innerWhere);
    }
    return TenantContext.run({ tenantId, ignoreTenant: true }, () => this.findOne({ ...innerWhere, tenantId }));
  }

  /**
   * 查询所有启用的平台配置，按排序字段升序
   *
   * @returns 启用状态的平台列表
   */
  async findEnabledPlatforms(): Promise<AiPlatformPrompt[]> {
    return this.findAll({
      where: { status: 1 },
      orderBy: 'sortOrder',
      order: 'asc',
    });
  }
}
