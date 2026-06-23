import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  normalizeMiniappRoutePathOrDefault,
  normalizeStoredMiniappRoutePathOrDefault,
} from '../common/miniapp-route.validator';
import { NavigationRepository } from './navigation.repository';

export type NavigationNodeType = 'CATEGORY' | 'SCENE' | 'LINK';

export type NavigationNode = {
  nodeType: NavigationNodeType;
  nodeId: string;
  code: string;
  name: string;
  parentNodeId?: string;
  pagePath?: string;
  status?: string;
  sort?: number;
  children?: NavigationNode[];
};

type BuildTreeOptions = {
  sceneStatuses?: string[];
};

type SaveNodePayload = {
  tenantId?: string;
  nodeType?: NavigationNodeType;
  code?: string;
  name?: string;
  parentNodeId?: string;
  pagePath?: string;
  status?: string;
  sort?: number;
  sceneType?: string;
  channelScope?: string[];
};

type SortPayload = {
  tenantId?: string;
  sort?: number;
  parentNodeId?: string;
};

@Injectable()
export class NavigationService {
  private readonly repository: NavigationRepository;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    repository?: NavigationRepository,
  ) {
    this.repository = repository ?? new NavigationRepository(prisma, tenantHelper);
  }

  async getClientTree(tenantId?: string) {
    const resolvedTenantId = this.resolveTenantId(tenantId);
    const tree = await this.buildTree(resolvedTenantId, { sceneStatuses: ['ACTIVE'] });
    return Result.ok({
      tenantId: resolvedTenantId,
      nodes: tree,
    });
  }

  async getAdminTree(tenantId?: string) {
    const resolvedTenantId = this.resolveTenantId(tenantId);
    const tree = await this.buildTree(resolvedTenantId);
    return Result.ok({
      tenantId: resolvedTenantId,
      nodes: tree,
    });
  }

  async createNode(payload: SaveNodePayload) {
    const tenantId = this.resolveTenantId(payload.tenantId);
    const nodeType = payload.nodeType ?? 'SCENE';
    if (nodeType === 'CATEGORY') {
      const createdCategory = await this.createCategoryNode(payload);
      return Result.ok(createdCategory, '导航节点创建成功');
    }

    const sceneName = payload.name?.trim();
    BusinessException.throwIf(!sceneName, '场景名称不能为空');

    const isLinkNode = nodeType === 'LINK';
    const sceneCode =
      payload.code?.trim() || (isLinkNode ? this.generateLinkCode(sceneName) : this.generateSceneCode(sceneName));
    const createdScene = await this.repository.createScene({
      tenantId,
      sceneCode,
      sceneName,
      sceneType: isLinkNode ? 'LINK' : payload.sceneType?.trim() || 'MARKETING',
      channelScope: (payload.channelScope ?? ['MINIAPP']) as Prisma.InputJsonValue,
      pageRoute: isLinkNode
        ? this.resolveLinkPagePath(payload.pagePath)
        : this.resolveScenePagePath(payload.pagePath, sceneCode),
      defaultCardTemplateCode: null,
      defaultResolverPolicyCode: null,
      status: payload.status?.trim() || 'DRAFT',
    });

    const createdNodeType = this.resolveSceneNodeType(createdScene.sceneType, nodeType);
    return Result.ok(
      {
        nodeType: createdNodeType,
        nodeId: `${this.getNodeIdPrefix(createdNodeType)}-${createdScene.id}`,
        code: createdScene.sceneCode,
        name: createdScene.sceneName,
        pagePath:
          createdNodeType === 'LINK'
            ? this.resolveLinkPagePath(createdScene.pageRoute)
            : this.resolveScenePagePath(createdScene.pageRoute, createdScene.sceneCode),
        status: createdScene.status,
      },
      '导航节点创建成功',
    );
  }

  async updateNode(nodeId: string, payload: SaveNodePayload) {
    const tenantId = this.resolveTenantId(payload.tenantId);
    const { nodeType, pureId } = this.parseNodeId(nodeId, payload.nodeType);
    if (nodeType === 'CATEGORY') {
      const updatedCategory = await this.updateCategoryNode(pureId, payload);
      return Result.ok(updatedCategory, '导航节点更新成功');
    }

    const existing = await this.repository.findSceneById(pureId, tenantId);
    BusinessException.throwIfNull(existing, '导航节点不存在');

    const targetNodeType = this.resolveSceneNodeType(existing!.sceneType, nodeType);
    const nextSceneCode = payload.code?.trim() || existing!.sceneCode;
    const nextSceneType =
      targetNodeType === 'LINK'
        ? 'LINK'
        : payload.sceneType?.trim() ||
          (existing!.sceneType.trim().toUpperCase() === 'LINK' ? 'MARKETING' : existing!.sceneType);
    const nextPageRoute =
      targetNodeType === 'LINK'
        ? this.resolveLinkPagePath(payload.pagePath, existing!.pageRoute)
        : this.resolveScenePagePath(payload.pagePath, nextSceneCode, existing!.pageRoute);

    const updated = await this.repository.updateScene(pureId, {
      sceneCode: nextSceneCode,
      sceneName: payload.name?.trim() || existing!.sceneName,
      sceneType: nextSceneType,
      pageRoute: nextPageRoute,
      ...(payload.status ? { status: payload.status.trim() } : {}),
    });

    const updatedNodeType = this.resolveSceneNodeType(updated.sceneType, targetNodeType);
    return Result.ok(
      {
        nodeType: updatedNodeType,
        nodeId: `${this.getNodeIdPrefix(updatedNodeType)}-${updated.id}`,
        code: updated.sceneCode,
        name: updated.sceneName,
        pagePath:
          updatedNodeType === 'LINK'
            ? this.resolveLinkPagePath(updated.pageRoute)
            : this.resolveScenePagePath(updated.pageRoute, updated.sceneCode),
        status: updated.status,
      },
      '导航节点更新成功',
    );
  }

  async sortNode(nodeId: string, payload: SortPayload) {
    const { nodeType, pureId } = this.parseNodeId(nodeId, undefined);
    if (nodeType === 'CATEGORY') {
      const sort = Number.isFinite(payload.sort) ? Math.trunc(payload.sort as number) : 0;
      const data: Prisma.PmsCategoryUpdateInput = {
        sort,
      };
      if (payload.parentNodeId !== undefined) {
        const parentId = this.parseCategoryParentId(payload.parentNodeId);
        data.parent = parentId == null ? { disconnect: true } : { connect: { catId: parentId } };
      }
      const updated = await this.repository.updateCategory(Number(pureId), data);
      return Result.ok({
        nodeId: `cat-${updated.catId}`,
        nodeType: 'CATEGORY',
        sort: updated.sort,
        parentNodeId: updated.parentId != null ? `cat-${updated.parentId}` : undefined,
      });
    }

    const sceneNodeType = nodeType === 'LINK' ? 'LINK' : 'SCENE';
    // mktScene has no dedicated sort field; keep contract and return accepted.
    return Result.ok({
      nodeId,
      nodeType: sceneNodeType,
      accepted: true,
      message:
        sceneNodeType === 'LINK'
          ? '当前 LINK 节点不支持持久化排序字段，已保留排序接口契约'
          : '当前场景节点不支持持久化排序字段，已保留排序接口契约',
    });
  }

  private async buildTree(tenantId: string, options?: BuildTreeOptions): Promise<NavigationNode[]> {
    const sceneStatuses = options?.sceneStatuses?.filter(Boolean);
    const [categories, scenes] = await Promise.all([
      this.repository.findCategories(),
      this.repository.findScenes(tenantId, sceneStatuses),
    ]);

    const categoryMap = new Map<number, NavigationNode>();
    for (const category of categories) {
      categoryMap.set(category.catId, {
        nodeType: 'CATEGORY',
        nodeId: `cat-${category.catId}`,
        code: String(category.catId),
        name: category.name,
        parentNodeId: category.parentId != null ? `cat-${category.parentId}` : undefined,
        sort: category.sort,
        children: [],
      });
    }

    const roots: NavigationNode[] = [];
    for (const category of categories) {
      const current = categoryMap.get(category.catId)!;
      if (category.parentId == null) {
        roots.push(current);
        continue;
      }
      const parent = categoryMap.get(category.parentId);
      if (!parent) {
        roots.push(current);
        continue;
      }
      parent.children = parent.children ?? [];
      parent.children.push(current);
    }

    const visibleScenes = sceneStatuses?.length
      ? scenes.filter((scene) => scene.status != null && sceneStatuses.includes(scene.status))
      : scenes;

    const sceneNodes: NavigationNode[] = visibleScenes.map((scene) => {
      const sceneNodeType = this.resolveSceneNodeType(scene.sceneType);
      return {
        nodeType: sceneNodeType,
        nodeId: `${this.getNodeIdPrefix(sceneNodeType)}-${scene.id}`,
        code: scene.sceneCode,
        name: scene.sceneName,
        pagePath:
          sceneNodeType === 'LINK'
            ? this.resolveStoredLinkPagePath(scene.pageRoute)
            : this.resolveStoredScenePagePath(scene.pageRoute, scene.sceneCode),
        status: scene.status,
      };
    });

    const attachTarget = roots.length > 0 ? roots[0] : undefined;
    if (attachTarget) {
      attachTarget.children = attachTarget.children ?? [];
      attachTarget.children.push(...sceneNodes);
    } else {
      roots.push(...sceneNodes);
    }
    return roots;
  }

  private async createCategoryNode(payload: SaveNodePayload) {
    const name = payload.name?.trim();
    BusinessException.throwIf(!name, '分类名称不能为空');

    const parentId = this.parseCategoryParentId(payload.parentNodeId);
    let level = 1;
    if (parentId != null) {
      const parent = await this.prisma.pmsCategory.findUnique({
        where: { catId: parentId },
        select: { level: true },
      });
      BusinessException.throwIfNull(parent, '父级分类不存在');
      level = Math.max(1, parent!.level + 1);
    }

    const created = await this.prisma.pmsCategory.create({
      data: {
        name,
        parentId,
        level,
        sort: Number.isFinite(payload.sort) ? Math.trunc(payload.sort as number) : 0,
      },
      select: {
        catId: true,
        name: true,
        parentId: true,
        sort: true,
      },
    });

    return {
      nodeType: 'CATEGORY' as const,
      nodeId: `cat-${created.catId}`,
      code: String(created.catId),
      name: created.name,
      parentNodeId: created.parentId != null ? `cat-${created.parentId}` : undefined,
      sort: created.sort,
    };
  }

  private async updateCategoryNode(catIdRaw: string, payload: SaveNodePayload) {
    const catId = Number(catIdRaw);
    BusinessException.throwIf(!Number.isFinite(catId), '分类节点ID非法');
    const data: Prisma.PmsCategoryUpdateInput = {};
    if (payload.name?.trim()) {
      data.name = payload.name.trim();
    }
    if (payload.parentNodeId !== undefined) {
      const parentId = this.parseCategoryParentId(payload.parentNodeId);
      data.parent = parentId == null ? { disconnect: true } : { connect: { catId: parentId } };
    }
    if (payload.sort !== undefined && Number.isFinite(payload.sort)) {
      data.sort = Math.trunc(payload.sort);
    }
    const updated = await this.prisma.pmsCategory.update({
      where: { catId },
      data,
      select: {
        catId: true,
        name: true,
        parentId: true,
        sort: true,
      },
    });
    return {
      nodeType: 'CATEGORY' as const,
      nodeId: `cat-${updated.catId}`,
      code: String(updated.catId),
      name: updated.name,
      parentNodeId: updated.parentId != null ? `cat-${updated.parentId}` : undefined,
      sort: updated.sort,
    };
  }

  private parseNodeId(
    nodeId: string,
    fallbackType?: NavigationNodeType,
  ): { nodeType: NavigationNodeType; pureId: string } {
    if (nodeId.startsWith('cat-')) {
      return { nodeType: 'CATEGORY', pureId: nodeId.slice(4) };
    }
    if (nodeId.startsWith('scene-')) {
      return { nodeType: 'SCENE', pureId: nodeId.slice(6) };
    }
    if (nodeId.startsWith('link-')) {
      return { nodeType: 'LINK', pureId: nodeId.slice(5) };
    }
    return {
      nodeType: fallbackType ?? 'SCENE',
      pureId: nodeId,
    };
  }

  private parseCategoryParentId(parentNodeId?: string): number | null {
    if (!parentNodeId || parentNodeId.trim() === '') {
      return null;
    }
    const normalized = parentNodeId.startsWith('cat-') ? parentNodeId.slice(4) : parentNodeId;
    const parsed = Number(normalized);
    BusinessException.throwIf(!Number.isFinite(parsed), '父级节点非法');
    return parsed;
  }

  private resolveScenePagePath(
    pagePath: string | null | undefined,
    sceneCode: string,
    fallbackPath?: string | null,
  ): string {
    return normalizeMiniappRoutePathOrDefault(
      pagePath ?? fallbackPath,
      `/pages/product/list?sourceType=SCENE&sceneCode=${encodeURIComponent(sceneCode)}`,
    );
  }

  private resolveLinkPagePath(pagePath: string | null | undefined, fallbackPath?: string | null): string {
    return normalizeMiniappRoutePathOrDefault(pagePath ?? fallbackPath, '/pages/index/index');
  }

  private resolveStoredScenePagePath(pagePath: string | null | undefined, sceneCode: string): string {
    return normalizeStoredMiniappRoutePathOrDefault(
      pagePath,
      `/pages/product/list?sourceType=SCENE&sceneCode=${encodeURIComponent(sceneCode)}`,
    );
  }

  private resolveStoredLinkPagePath(pagePath: string | null | undefined): string {
    return normalizeStoredMiniappRoutePathOrDefault(pagePath, '/pages/index/index');
  }

  private generateSceneCode(name: string): string {
    const base = name
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '')
      .toUpperCase();
    const suffix = Date.now().toString(36).toUpperCase();
    return `${base || 'SCENE'}_${suffix}`;
  }

  private generateLinkCode(name: string): string {
    const base = name
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '')
      .toUpperCase();
    const suffix = Date.now().toString(36).toUpperCase();
    return `LINK_${base || 'NODE'}_${suffix}`;
  }

  private resolveSceneNodeType(
    sceneType: string | undefined | null,
    preferredType?: NavigationNodeType,
  ): Exclude<NavigationNodeType, 'CATEGORY'> {
    if (preferredType === 'LINK' || preferredType === 'SCENE') {
      return preferredType;
    }
    return sceneType?.trim().toUpperCase() === 'LINK' ? 'LINK' : 'SCENE';
  }

  private getNodeIdPrefix(nodeType: Exclude<NavigationNodeType, 'CATEGORY'>): 'scene' | 'link' {
    return nodeType === 'LINK' ? 'link' : 'scene';
  }

  private resolveTenantId(inputTenantId?: string): string {
    return inputTenantId || TenantContext.getTenantId() || TenantContext.SUPER_TENANT_ID;
  }
}
