import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NavigationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  findCategories() {
    return this.prisma.pmsCategory.findMany({
      orderBy: [{ level: 'asc' }, { sort: 'asc' }, { catId: 'asc' }],
      select: {
        catId: true,
        parentId: true,
        name: true,
        sort: true,
      },
    });
  }

  findScenes(tenantId: string, sceneStatuses?: string[]) {
    return this.prisma.mktScene.findMany({
      where: this.tenantHelper.readWhereForDelegate('mktScene', {
        tenantId,
        ...(sceneStatuses?.length ? { status: { in: sceneStatuses } } : {}),
      }) as Prisma.MktSceneWhereInput,
      orderBy: [{ updateTime: 'desc' }],
      select: {
        id: true,
        sceneCode: true,
        sceneName: true,
        sceneType: true,
        pageRoute: true,
        status: true,
      },
    });
  }

  createScene(data: Prisma.MktSceneCreateInput) {
    return this.prisma.mktScene.create({
      data,
      select: {
        id: true,
        sceneCode: true,
        sceneName: true,
        sceneType: true,
        pageRoute: true,
        status: true,
      },
    });
  }

  findSceneById(id: string, tenantId: string) {
    return this.prisma.mktScene.findFirst({
      where: this.tenantHelper.readWhereForDelegate('mktScene', {
        id,
        tenantId,
      }) as Prisma.MktSceneWhereInput,
      select: { id: true, sceneCode: true, sceneName: true, pageRoute: true, status: true, sceneType: true },
    });
  }

  updateScene(id: string, data: Prisma.MktSceneUpdateInput) {
    return this.prisma.mktScene.update({
      where: { id },
      data,
      select: {
        id: true,
        sceneCode: true,
        sceneName: true,
        sceneType: true,
        pageRoute: true,
        status: true,
      },
    });
  }

  findCategoryById(catId: number) {
    return this.prisma.pmsCategory.findUnique({
      where: { catId },
      select: { catId: true, level: true, parentId: true, sort: true, name: true },
    });
  }

  createCategory(data: Prisma.PmsCategoryCreateInput) {
    return this.prisma.pmsCategory.create({
      data,
      select: {
        catId: true,
        name: true,
        parentId: true,
        sort: true,
      },
    });
  }

  updateCategory(catId: number, data: Prisma.PmsCategoryUpdateInput) {
    return this.prisma.pmsCategory.update({
      where: { catId },
      data,
      select: {
        catId: true,
        name: true,
        parentId: true,
        sort: true,
      },
    });
  }
}
