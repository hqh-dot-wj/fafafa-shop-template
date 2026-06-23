import { PrismaClient } from '@prisma/client';

const HOMEPAGE_SCENE_CODES = ['HOME_FEATURED', 'HOME_BEST_PICKS', 'HOME_GUESS_LIKES', 'HOME_MEMBER_ZONE'];

async function publishSceneRelease(prisma: PrismaClient, tenantId: string, sceneCode: string): Promise<boolean> {
  const sceneWithModules = await prisma.mktScene.findUnique({
    where: { tenantId_sceneCode: { tenantId, sceneCode } },
    include: { modules: { orderBy: { displayOrder: 'asc' } } },
  });

  if (!sceneWithModules) {
    console.log(`  ⚠ ${sceneCode} 场景不存在，跳过发布`);
    return false;
  }

  const releaseSnapshot = {
    sceneCode: sceneWithModules.sceneCode,
    sceneName: sceneWithModules.sceneName,
    sceneType: sceneWithModules.sceneType,
    channelScope: sceneWithModules.channelScope,
    pageRoute: sceneWithModules.pageRoute,
    modules: sceneWithModules.modules.map((m) => ({
      moduleCode: m.moduleCode,
      moduleName: m.moduleName,
      moduleType: m.moduleType,
      displayOrder: m.displayOrder,
      limitSize: m.limitSize,
      sourcePolicyCode: m.sourcePolicyCode,
      resolverPolicyCode: m.resolverPolicyCode,
      sortPolicyCode: m.sortPolicyCode,
      audiencePolicyCode: m.audiencePolicyCode,
      cardTemplateCode: m.cardTemplateCode,
      uiConfig: m.uiConfig,
    })),
  };

  await prisma.mktSceneRelease.upsert({
    where: { tenantId_sceneCode_releaseNo: { tenantId, sceneCode, releaseNo: 1 } },
    update: { releaseSnapshot },
    create: {
      tenantId,
      sceneCode,
      releaseNo: 1,
      releaseStatus: 'PUBLISHED',
      releaseSnapshot,
      publishedBy: 'system',
      publishedAt: new Date(),
    },
  });
  return true;
}

export async function seedDefaultReleases(prisma: PrismaClient) {
  const tenantId = '000000';
  let publishedCount = 0;

  for (const sceneCode of HOMEPAGE_SCENE_CODES) {
    const ok = await publishSceneRelease(prisma, tenantId, sceneCode);
    if (ok) publishedCount++;
  }

  console.log(`  ✓ 默认场景发布版本已创建（${publishedCount}/${HOMEPAGE_SCENE_CODES.length} 个场景含模块快照）`);
}
