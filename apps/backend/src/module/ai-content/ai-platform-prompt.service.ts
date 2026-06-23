import { Injectable } from '@nestjs/common';
import { AiPlatformPrompt } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AiPlatformPromptRepository } from './ai-platform-prompt.repository';
import {
  CreatePlatformPromptDto,
  ListPlatformPromptDto,
  UpdatePlatformPromptDto,
  UpdateStatusDto,
} from './dto/platform-prompt.dto';
import { Result } from 'src/common/response/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { FormatDateFields } from 'src/common/utils';

type AiPlatformPromptWithTenantName = AiPlatformPrompt & { tenantName: string };

@Injectable()
export class AiPlatformPromptService {
  constructor(
    private readonly repo: AiPlatformPromptRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 为 Prompt 行批量补充租户展示名（sys_tenant.companyName，缺失时回退为 tenantId）
   *
   * @param rows - 数据库行
   * @returns 附带 tenantName 的行
   */
  private async enrichRowsWithTenantNames(rows: AiPlatformPrompt[]): Promise<AiPlatformPromptWithTenantName[]> {
    if (rows.length === 0) {
      return [];
    }
    const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
    const tenants = await this.prisma.sysTenant.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { tenantId: true, companyName: true },
    });
    const nameById = new Map(tenants.map((t) => [t.tenantId, t.companyName]));
    return rows.map((row) => ({
      ...row,
      tenantName: nameById.get(row.tenantId) ?? row.tenantId,
    }));
  }

  /**
   * 分页查询平台 Prompt 配置
   *
   * @param query - 分页参数与筛选条件
   * @returns 分页列表
   */
  async findAll(query: ListPlatformPromptDto) {
    const result = await this.repo.search(query);
    const rows = await this.enrichRowsWithTenantNames(result.rows);
    return Result.page(FormatDateFields(rows), result.total);
  }

  /**
   * 根据 ID 查询 Prompt 配置详情
   *
   * @param id - 配置 ID
   * @returns 配置详情
   * @throws BusinessException 当配置不存在时
   */
  async findOne(id: string) {
    const prompt = await this.repo.findById(id);
    BusinessException.throwIfNull(prompt, 'Prompt 配置不存在');
    const [withTenantName] = await this.enrichRowsWithTenantNames([prompt]);
    return Result.ok(FormatDateFields(withTenantName));
  }

  /**
   * 新增平台 Prompt 配置，同一租户下同平台标识唯一
   *
   * @param dto - 创建参数
   * @param tenantId - 当前租户 ID
   * @returns 创建后的配置
   * @throws BusinessException 当同平台 Prompt 已存在时
   */
  async create(dto: CreatePlatformPromptDto, tenantId: string) {
    const existing = await this.repo.findByPlatformCode(dto.platformCode, tenantId);
    BusinessException.throwIf(!!existing, `平台 ${dto.platformCode} 的 Prompt 已存在`);
    const prompt = await this.repo.create({ ...dto, tenantId });
    const [withTenantName] = await this.enrichRowsWithTenantNames([prompt]);
    return Result.ok(FormatDateFields(withTenantName), '创建成功');
  }

  /**
   * 更新平台 Prompt 配置
   *
   * @param id - 配置 ID
   * @param dto - 更新参数
   * @returns 更新后的配置
   * @throws BusinessException 当配置不存在时
   */
  async update(id: string, dto: UpdatePlatformPromptDto) {
    const prompt = await this.repo.findById(id);
    BusinessException.throwIfNull(prompt, 'Prompt 配置不存在');
    const updated = await this.repo.update(id, dto);
    const [withTenantName] = await this.enrichRowsWithTenantNames([updated]);
    return Result.ok(FormatDateFields(withTenantName), '更新成功');
  }

  /**
   * 软删除平台 Prompt 配置
   *
   * @param id - 配置 ID
   * @returns 操作结果
   * @throws BusinessException 当配置不存在时
   */
  async remove(id: string) {
    const prompt = await this.repo.findById(id);
    BusinessException.throwIfNull(prompt, 'Prompt 配置不存在');
    await this.repo.softDelete(id);
    return Result.ok(null, '删除成功');
  }

  /**
   * 更新平台 Prompt 配置启用/停用状态
   *
   * @param id - 配置 ID
   * @param dto - 包含目标状态的 DTO
   * @returns 操作结果
   * @throws BusinessException 当配置不存在时
   */
  async updateStatus(id: string, dto: UpdateStatusDto) {
    const prompt = await this.repo.findById(id);
    BusinessException.throwIfNull(prompt, 'Prompt 配置不存在');
    await this.repo.update(id, { status: dto.status });
    return Result.ok(null, '状态更新成功');
  }
}
