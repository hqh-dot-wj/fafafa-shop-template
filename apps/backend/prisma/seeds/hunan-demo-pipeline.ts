/**
 * 湖南完整演示种子统一入口（bootstrap / prisma:seed 共用）。
 */
import type { PrismaClient } from '@prisma/client';

import { runPlatformBootstrap } from './00-platform';
import { seedAttrTemplates } from './01-hq-foundation/attr-templates';
import { seedBrands } from './01-hq-foundation/brands';
import { seedCategories } from './01-hq-foundation/categories';
import { seedPlayDefinitions } from './01-hq-foundation/play-definitions';
import { seedPlayTemplates } from './01-hq-foundation/play-templates';
import { seedDefaultModules } from './06-marketing-scenes/modules';
import { seedDefaultPolicies } from './06-marketing-scenes/policies';
import { seedDefaultReleases } from './06-marketing-scenes/releases';
import { seedSceneTemplates } from './06-marketing-scenes/scene-templates';
import { seedDefaultScenes } from './06-marketing-scenes/scenes';
import { seedH5DemoPasswordMember } from './h5-demo-password-member';
import { seedHunanFullScenario } from './hunan-full';
import { runHunanPlatformOverrides } from './seed-hunan-platform-overrides';
import { resetPostgresSequences } from './utils/reset-postgres-sequences';

export type HunanDemoPipelineOptions = {
  /** 写入平台默认营销场景/策略（seed-pipeline 开启，日常 pnpm seed 可关闭） */
  includePlatformMarketingScenes?: boolean;
  /** 写入 H5 密码联调会员 18570467732 */
  includeH5DemoMember?: boolean;
  /** 写入 ACC_* 营销验收半成品（剧本 1/4/6/7） */
  includeAcceptanceProfile?: boolean;
};

export async function runHunanDemoSeedPipeline(
  prisma: PrismaClient,
  options: HunanDemoPipelineOptions = {},
): Promise<void> {
  const {
    includePlatformMarketingScenes = false,
    includeH5DemoMember = false,
    includeAcceptanceProfile = process.env.SEED_ACCEPTANCE_PROFILE === 'true',
  } = options;

  console.log('[Hunan-Demo] 平台 bootstrap...');
  await runPlatformBootstrap(prisma);

  console.log('[Hunan-Demo] 湖南总平台覆盖...');
  await runHunanPlatformOverrides(prisma);

  console.log('[Hunan-Demo] 总部商品依赖...');
  await seedCategories(prisma);
  await seedBrands(prisma);
  await seedAttrTemplates(prisma);
  await seedPlayDefinitions(prisma);
  await seedPlayTemplates(prisma);

  if (includePlatformMarketingScenes) {
    console.log('[Hunan-Demo] 平台默认营销场景...');
    await seedDefaultPolicies(prisma);
    await seedSceneTemplates(prisma);
    await seedDefaultScenes(prisma);
    await seedDefaultModules(prisma);
    await seedDefaultReleases(prisma);
  }

  if (includeH5DemoMember) {
    await seedH5DemoPasswordMember(prisma);
  }

  await resetPostgresSequences(prisma);

  console.log('[Hunan-Demo] 湖南完整演示集...');
  await seedHunanFullScenario(prisma);

  if (includeAcceptanceProfile) {
    const { seedAcceptanceProfile } = await import('./acceptance');
    await seedAcceptanceProfile(prisma);
  }

  await resetPostgresSequences(prisma);
  console.log('[Hunan-Demo] 演示种子完成。');
}
