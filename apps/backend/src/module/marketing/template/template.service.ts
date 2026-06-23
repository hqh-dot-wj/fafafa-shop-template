import { Injectable } from '@nestjs/common';
import { PlayTemplate, Prisma } from '@prisma/client';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response/result';
import { CreatePlayTemplateDto, ListPlayTemplateDto, UpdatePlayTemplateDto } from './dto/template.dto';
import { PlayTemplateRepository } from './template.repository';

type PlayTemplateView = Pick<
  PlayTemplate,
  'id' | 'code' | 'name' | 'unitName' | 'ruleSchema' | 'uiComponentId' | 'createTime' | 'updateTime'
>;

type PlayTemplateCreatePayload = Pick<
  Prisma.PlayTemplateCreateInput,
  'code' | 'name' | 'unitName' | 'ruleSchema' | 'uiComponentId'
>;

type PlayTemplateUpdatePayload = Pick<
  Prisma.PlayTemplateUpdateInput,
  'name' | 'unitName' | 'ruleSchema' | 'uiComponentId'
>;

@Injectable()
export class PlayTemplateService {
  constructor(private readonly repo: PlayTemplateRepository) {}

  async findAll(query: ListPlayTemplateDto) {
    const { rows, total } = await this.repo.search(query);
    return Result.page(rows.map(row => this.toTemplateView(row)), total);
  }

  async findOne(id: string) {
    const template = await this.repo.findById(id);
    BusinessException.throwIfNull(template, '未找到指定的玩法模板');
    return Result.ok(this.toTemplateView(template));
  }

  @Transactional()
  async create(dto: CreatePlayTemplateDto) {
    const payload = await this.buildCreatePayload(dto as CreatePlayTemplateDto & Record<string, unknown>);
    const template = await this.repo.create(payload);
    return Result.ok(this.toTemplateView(template), '创建成功');
  }

  @Transactional()
  async update(id: string, dto: UpdatePlayTemplateDto) {
    const template = await this.repo.findById(id);
    BusinessException.throwIfNull(template, '待更新的模板不存在');

    const payload = this.buildUpdatePayload(dto as UpdatePlayTemplateDto & Record<string, unknown>);
    const updated = await this.repo.update(id, payload);
    return Result.ok(this.toTemplateView(updated), '更新成功');
  }

  async delete(id: string) {
    const template = await this.repo.findById(id);
    BusinessException.throwIfNull(template, '待删除的模板不存在');

    await this.repo.softDelete(id);
    return Result.ok(null, '删除成功');
  }

  private toTemplateView(template: PlayTemplate): PlayTemplateView {
    const { id, code, name, unitName, ruleSchema, uiComponentId, createTime, updateTime } = template;

    return {
      id,
      code,
      name,
      unitName,
      ruleSchema,
      uiComponentId,
      createTime,
      updateTime,
    };
  }

  private async buildCreatePayload(dto: CreatePlayTemplateDto & Record<string, unknown>): Promise<PlayTemplateCreatePayload> {
    return {
      code: await this.generateTemplateCode(),
      name: dto.name.trim(),
      unitName: dto.unitName.trim(),
      ruleSchema: dto.ruleSchema as Prisma.InputJsonValue,
      uiComponentId: this.normalizeOptionalString(dto.uiComponentId),
    };
  }

  private buildUpdatePayload(dto: UpdatePlayTemplateDto & Record<string, unknown>): PlayTemplateUpdatePayload {
    return {
      name: dto.name.trim(),
      unitName: dto.unitName.trim(),
      ruleSchema: dto.ruleSchema as Prisma.InputJsonValue,
      uiComponentId: this.normalizeOptionalString(dto.uiComponentId),
    };
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private async generateTemplateCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `PT_${Date.now().toString(36).toUpperCase()}_${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;
      const exists = await this.repo.findByCode(code);

      if (!exists) {
        return code;
      }
    }

    throw new BusinessException(500, '模板编码生成失败，请重试');
  }
}
