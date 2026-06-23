/**
 * 部署补种：平台首页 Tab 场景 + H5 密码联调会员。
 * 与 seed-pipeline 中 includePlatformMarketingScenes / includeH5DemoMember 对齐，可幂等重复执行。
 */
import { PrismaClient } from '@prisma/client';

import { seedDefaultModules } from './06-marketing-scenes/modules';
import { seedDefaultPolicies } from './06-marketing-scenes/policies';
import { seedDefaultReleases } from './06-marketing-scenes/releases';
import { seedSceneTemplates } from './06-marketing-scenes/scene-templates';
import { seedDefaultScenes } from './06-marketing-scenes/scenes';
import { seedH5DemoPasswordMember } from './h5-demo-password-member';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('[Deploy-Supplement] 平台首页 Tab 场景...');
  await seedDefaultPolicies(prisma);
  await seedSceneTemplates(prisma);
  await seedDefaultScenes(prisma);
  await seedDefaultModules(prisma);
  await seedDefaultReleases(prisma);

  console.log('[Deploy-Supplement] H5 密码联调会员...');
  await seedH5DemoPasswordMember(prisma);

  console.log('[Deploy-Supplement] 完成。');
}

main()
  .catch((error) => {
    console.error('[Deploy-Supplement] 失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
