import { PrismaClient } from '@prisma/client';

import { runHunanDemoSeedPipeline } from './hunan-demo-pipeline';

const prisma = new PrismaClient();

async function main() {
  console.log('开始执行湖南完整演示种子（统一管道）...');
  // 与本地 seed-pipeline 对齐：首页 Tab 场景码 + H5 密码联调账号
  await runHunanDemoSeedPipeline(prisma, {
    includePlatformMarketingScenes: true,
    includeH5DemoMember: true,
  });
}

main()
  .catch((error) => {
    console.error('执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
