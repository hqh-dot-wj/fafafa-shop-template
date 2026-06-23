import { Prisma, PrismaClient } from '@prisma/client';

import { HUNAN_FULL_MARKETING_BLUEPRINT } from '../hunan-full/catalog-marketing';
import { assertHunanFullSeedScope, hunanFullAt, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function seedHunanScenes(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanScenes');
  console.log('[06-Scenes] 湖南完整演示场景投放...');

  for (const policy of HUNAN_FULL_MARKETING_BLUEPRINT.policies) {
    await prisma.mktPolicy.upsert({
      where: {
        tenantId_policyCode: {
          tenantId: HUNAN_FULL_TENANT_ID,
          policyCode: policy.policyCode,
        },
      },
      update: {
        policyName: policy.policyName,
        policyType: policy.policyType,
        config: asJson(policy.config),
        status: policy.status,
      },
      create: {
        tenantId: HUNAN_FULL_TENANT_ID,
        policyCode: policy.policyCode,
        policyName: policy.policyName,
        policyType: policy.policyType,
        config: asJson(policy.config),
        status: policy.status,
      },
    });
  }

  for (const scene of HUNAN_FULL_MARKETING_BLUEPRINT.scenes) {
    await prisma.mktScene.upsert({
      where: {
        tenantId_sceneCode: {
          tenantId: HUNAN_FULL_TENANT_ID,
          sceneCode: scene.sceneCode,
        },
      },
      update: {
        sceneName: scene.sceneName,
        sceneType: scene.sceneType,
        channelScope: scene.channelScope,
        pageRoute: scene.pageRoute,
        defaultCardTemplateCode: scene.defaultCardTemplateCode,
        defaultResolverPolicyCode: scene.defaultResolverPolicyCode,
        placementConfig: scene.placementConfig == null ? undefined : asJson(scene.placementConfig),
        status: scene.status,
        startAt: hunanFullAt(-15),
        endAt: hunanFullAt(90),
      },
      create: {
        tenantId: HUNAN_FULL_TENANT_ID,
        sceneCode: scene.sceneCode,
        sceneName: scene.sceneName,
        sceneType: scene.sceneType,
        channelScope: scene.channelScope,
        pageRoute: scene.pageRoute,
        defaultCardTemplateCode: scene.defaultCardTemplateCode,
        defaultResolverPolicyCode: scene.defaultResolverPolicyCode,
        placementConfig: scene.placementConfig == null ? undefined : asJson(scene.placementConfig),
        status: scene.status,
        startAt: hunanFullAt(-15),
        endAt: hunanFullAt(90),
      },
    });
  }

  for (const module of HUNAN_FULL_MARKETING_BLUEPRINT.sceneModules) {
    await prisma.mktSceneModule.upsert({
      where: {
        tenantId_moduleCode: {
          tenantId: HUNAN_FULL_TENANT_ID,
          moduleCode: module.moduleCode,
        },
      },
      update: {
        sceneCode: module.sceneCode,
        moduleName: module.moduleName,
        moduleType: module.moduleType,
        title: module.title,
        subTitle: module.subTitle,
        displayOrder: module.displayOrder,
        limitSize: module.limitSize,
        sourcePolicyCode: module.sourcePolicyCode,
        resolverPolicyCode: module.resolverPolicyCode,
        sortPolicyCode: module.sortPolicyCode ?? null,
        audiencePolicyCode: module.audiencePolicyCode ?? null,
        cardTemplateCode: module.cardTemplateCode,
        attributionPolicyCode: module.attributionPolicyCode ?? null,
        uiConfig: module.uiConfig == null ? null : asJson(module.uiConfig),
        status: module.status,
        startAt: hunanFullAt(-7),
        endAt: hunanFullAt(90),
      },
      create: {
        tenantId: HUNAN_FULL_TENANT_ID,
        sceneCode: module.sceneCode,
        moduleCode: module.moduleCode,
        moduleName: module.moduleName,
        moduleType: module.moduleType,
        title: module.title,
        subTitle: module.subTitle,
        displayOrder: module.displayOrder,
        limitSize: module.limitSize,
        sourcePolicyCode: module.sourcePolicyCode,
        resolverPolicyCode: module.resolverPolicyCode,
        sortPolicyCode: module.sortPolicyCode ?? null,
        audiencePolicyCode: module.audiencePolicyCode ?? null,
        cardTemplateCode: module.cardTemplateCode,
        attributionPolicyCode: module.attributionPolicyCode ?? null,
        uiConfig: module.uiConfig == null ? null : asJson(module.uiConfig),
        status: module.status,
        startAt: hunanFullAt(-7),
        endAt: hunanFullAt(90),
      },
    });
  }

  for (const scene of HUNAN_FULL_MARKETING_BLUEPRINT.scenes) {
    const modules = HUNAN_FULL_MARKETING_BLUEPRINT.sceneModules
      .filter(module => module.sceneCode === scene.sceneCode)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map(module => ({
        moduleCode: module.moduleCode,
        moduleName: module.moduleName,
        moduleType: module.moduleType,
        title: module.title,
        subTitle: module.subTitle,
        displayOrder: module.displayOrder,
        limitSize: module.limitSize,
        sourcePolicyCode: module.sourcePolicyCode,
        resolverPolicyCode: module.resolverPolicyCode,
        sortPolicyCode: module.sortPolicyCode ?? null,
        audiencePolicyCode: module.audiencePolicyCode ?? null,
        cardTemplateCode: module.cardTemplateCode,
        attributionPolicyCode: module.attributionPolicyCode ?? null,
        uiConfig: module.uiConfig ?? null,
      }));

    const releaseSnapshot = asJson({
      sceneCode: scene.sceneCode,
      sceneName: scene.sceneName,
      sceneType: scene.sceneType,
      channelScope: scene.channelScope,
      pageRoute: scene.pageRoute,
      modules,
    });

    await prisma.mktSceneRelease.upsert({
      where: {
        tenantId_sceneCode_releaseNo: {
          tenantId: HUNAN_FULL_TENANT_ID,
          sceneCode: scene.sceneCode,
          releaseNo: 1,
        },
      },
      update: {
        releaseStatus: 'PUBLISHED',
        releaseSnapshot,
        publishedBy: 'hf_marketing_ops',
        publishedAt: hunanFullAt(-1, 20, 0),
      },
      create: {
        tenantId: HUNAN_FULL_TENANT_ID,
        sceneCode: scene.sceneCode,
        releaseNo: 1,
        releaseStatus: 'PUBLISHED',
        releaseSnapshot,
        publishedBy: 'hf_marketing_ops',
        publishedAt: hunanFullAt(-1, 20, 0),
      },
    });
  }

  console.log(`  ✓ ${HUNAN_FULL_MARKETING_BLUEPRINT.policies.length} 条策略、${HUNAN_FULL_MARKETING_BLUEPRINT.scenes.length} 个场景与 ${HUNAN_FULL_MARKETING_BLUEPRINT.sceneModules.length} 个模块`);
}
