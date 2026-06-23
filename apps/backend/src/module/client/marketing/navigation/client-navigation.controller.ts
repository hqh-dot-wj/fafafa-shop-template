import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { OptionalMemberAuthGuard } from 'src/module/client/common/guards/optional-member-auth.guard';
import { normalizeStoredMiniappRoutePathOrDefault } from 'src/module/marketing/common/miniapp-route.validator';
import { PrismaService } from 'src/prisma/prisma.service';

type CategoryNodeType = 'CATEGORY' | 'SCENE' | 'LINK';

type CategoryNode = {
  nodeType: CategoryNodeType;
  id: string;
  code: string;
  name: string;
  parentId?: string;
  children?: CategoryNode[];
  pagePath?: string;
};

@ApiTags('C端-导航树')
@ApiBearerAuth()
@UseGuards(OptionalMemberAuthGuard)
@Controller('client/navigation')
export class ClientNavigationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tree')
  async getTree() {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    const [categories, scenes] = await Promise.all([
      this.prisma.pmsCategory.findMany({
        orderBy: [{ level: 'asc' }, { sort: 'asc' }],
        select: {
          catId: true,
          name: true,
          parentId: true,
        },
      }),
      this.prisma.mktScene.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
        },
        orderBy: [{ sceneType: 'asc' }, { updateTime: 'desc' }],
        select: {
          id: true,
          sceneCode: true,
          sceneName: true,
          sceneType: true,
          pageRoute: true,
        },
      }),
    ]);

    const categoryNodes = new Map<string, CategoryNode>();
    categories.forEach((category) => {
      categoryNodes.set(String(category.catId), {
        nodeType: 'CATEGORY',
        id: `cat-${category.catId}`,
        code: String(category.catId),
        name: category.name,
        parentId: category.parentId != null ? `cat-${category.parentId}` : undefined,
        children: [],
      });
    });

    const roots: CategoryNode[] = [];
    categoryNodes.forEach((node) => {
      if (!node.parentId) {
        roots.push(node);
        return;
      }
      const parent = categoryNodes.get(node.parentId.replace('cat-', ''));
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sceneNodes: CategoryNode[] = scenes.map((scene) => {
      const nodeType: CategoryNodeType = scene.sceneType?.trim().toUpperCase() === 'LINK' ? 'LINK' : 'SCENE';
      return {
        nodeType,
        id: `${nodeType === 'LINK' ? 'link' : 'scene'}-${scene.id}`,
        code: scene.sceneCode,
        name: scene.sceneName,
        pagePath:
          nodeType === 'LINK'
            ? this.resolveLinkPagePath(scene.pageRoute)
            : this.resolveScenePagePath(scene.pageRoute, scene.sceneCode),
      };
    });

    roots.forEach((root) => {
      root.children = root.children ?? [];
      root.children.push(...sceneNodes);
    });

    return Result.ok({
      tenantId,
      nodes: roots,
    });
  }

  private resolveScenePagePath(pagePath: string | null | undefined, sceneCode: string): string {
    return normalizeStoredMiniappRoutePathOrDefault(
      pagePath,
      `/pages/product/list?sourceType=SCENE&sceneCode=${encodeURIComponent(sceneCode)}`,
    );
  }

  private resolveLinkPagePath(pagePath: string | null | undefined): string {
    return normalizeStoredMiniappRoutePathOrDefault(pagePath, '/pages/index/index');
  }
}
