import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantContext } from 'src/common/tenant';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ListSceneDto, SaveSceneDto } from './dto/scene.dto';
import { ListSceneModuleDto, SaveSceneModuleDto } from './dto/scene-module.dto';

/**
 * NOTE: createdBy / updatedBy columns are not yet in the schema.
 * The operatorId parameter is accepted for API compatibility but not persisted until Task N adds audit columns.
 */
@Injectable()
export class MarketingSceneRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get tenantId() {
    return TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
  }

  async searchScenes(query: ListSceneDto) {
    const where = {
      tenantId: this.tenantId,
      ...(query.sceneCode && { sceneCode: query.sceneCode }),
      ...(query.status && { status: query.status }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.mktScene.findMany({
        where,
        orderBy: query.getOrderBy('createTime') ?? { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.mktScene.count({ where }),
    ]);
    return { rows, total };
  }

  async createScene(dto: SaveSceneDto, _operatorId: string) {
    return this.prisma.mktScene.create({
      data: { ...dto, tenantId: this.tenantId },
    });
  }

  async updateScene(id: string, dto: Partial<SaveSceneDto>, _operatorId: string) {
    const { id: _id, ...rest } = dto as SaveSceneDto & { id?: string };
    const existing = await this.prisma.mktScene.findFirst({ where: { id, tenantId: this.tenantId } });
    BusinessException.throwIfNull(existing, '场景不存在');
    return this.prisma.mktScene.update({ where: { id }, data: rest });
  }

  async ensureSceneExists(sceneCode: string) {
    const scene = await this.prisma.mktScene.findUnique({
      where: { tenantId_sceneCode: { tenantId: this.tenantId, sceneCode } },
    });
    BusinessException.throwIfNull(scene, '场景不存在');
    return scene;
  }

  async searchSceneModules(query: ListSceneModuleDto) {
    const where = {
      tenantId: this.tenantId,
      ...(query.sceneCode && { sceneCode: query.sceneCode }),
      ...(query.moduleCode && { moduleCode: query.moduleCode }),
      ...(query.status && { status: query.status }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.mktSceneModule.findMany({
        where,
        orderBy: query.getOrderBy('displayOrder') ?? [{ sceneCode: 'asc' }, { displayOrder: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.mktSceneModule.count({ where }),
    ]);
    return { rows, total };
  }

  async createSceneModule(dto: SaveSceneModuleDto & { sceneCode: string }, _operatorId: string) {
    return this.prisma.mktSceneModule.create({
      data: { ...dto, tenantId: this.tenantId },
    });
  }

  async updateSceneModule(id: string, dto: Partial<SaveSceneModuleDto & { sceneCode: string }>, _operatorId: string) {
    const { id: _id, sceneCode, ...rest } = dto as SaveSceneModuleDto & { sceneCode: string; id?: string };
    const existing = await this.prisma.mktSceneModule.findFirst({ where: { id, tenantId: this.tenantId } });
    BusinessException.throwIfNull(existing, '场景模块不存在');
    BusinessException.throwIf(
      existing.sceneCode !== sceneCode,
      '模块不属于该场景，无法修改',
    );
    return this.prisma.mktSceneModule.update({ where: { id }, data: rest });
  }

  async findSceneGraph(sceneCode: string) {
    return this.prisma.mktScene.findUnique({
      where: { tenantId_sceneCode: { tenantId: this.tenantId, sceneCode } },
      include: {
        modules: {
          where: { status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  async findPoliciesByCodes(policyCodes: string[]) {
    const uniqueCodes = [...new Set(policyCodes.filter(Boolean))];
    if (uniqueCodes.length === 0) {
      return [];
    }
    return this.prisma.mktPolicy.findMany({
      where: {
        tenantId: this.tenantId,
        policyCode: { in: uniqueCodes },
      },
      select: {
        policyCode: true,
        policyType: true,
        status: true,
      },
    });
  }

  async nextReleaseNo(sceneCode: string): Promise<number> {
    const latest = await this.prisma.mktSceneRelease.findFirst({
      where: { tenantId: this.tenantId, sceneCode },
      orderBy: { releaseNo: 'desc' },
    });
    return (latest?.releaseNo ?? 0) + 1;
  }

  async createRelease(data: {
    sceneCode: string;
    releaseNo: number;
    releaseStatus: string;
    releaseSnapshot: object;
    publishedBy: string;
  }) {
    return this.prisma.mktSceneRelease.create({
      data: { ...data, tenantId: this.tenantId, publishedAt: new Date() },
    });
  }
}
