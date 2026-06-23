import { PrismaClient } from '@prisma/client';

import {
  ACC_PRODUCT_PLAIN_ID,
  publishAcceptanceScene,
  seedAcceptancePlainProduct,
  upsertScene,
  upsertSceneModule,
  upsertSourcePolicy,
} from './shared';

/** 剧本 1：场景启用但未发布 */
export async function seedScenario01Unpublished(prisma: PrismaClient): Promise<void> {
  const sceneCode = 'ACC_SCENE_UNPUBLISHED';
  await upsertSourcePolicy(prisma, 'ACC_SOURCE_UNPUBLISHED', '验收-未发布场景源', [ACC_PRODUCT_PLAIN_ID]);
  await upsertScene(prisma, sceneCode, '验收-未发布场景');
  await upsertSceneModule(prisma, sceneCode, 'ACC_MOD_LIST', '商品列表', 'ACC_SOURCE_UNPUBLISHED');
  await prisma.mktSceneRelease.deleteMany({
    where: { tenantId: '000000', sceneCode },
  });
}

/** 剧本 4：有商品、无门店玩法 */
export async function seedScenario04NoPlay(prisma: PrismaClient): Promise<void> {
  await seedAcceptancePlainProduct(prisma);
  const sceneCode = 'ACC_SCENE_NO_PLAY';
  await upsertSourcePolicy(prisma, 'ACC_SOURCE_NO_PLAY', '验收-无玩法商品源', [ACC_PRODUCT_PLAIN_ID]);
  await upsertScene(prisma, sceneCode, '验收-无玩法场景');
  await upsertSceneModule(prisma, sceneCode, 'ACC_MOD_LIST', '商品列表', 'ACC_SOURCE_NO_PLAY');
  await publishAcceptanceScene(prisma, sceneCode);
}

/** 剧本 6：秒杀完整态 */
export async function seedScenario06Flash(prisma: PrismaClient): Promise<void> {
  const sceneCode = 'ACC_SCENE_FLASH_OK';
  await upsertSourcePolicy(prisma, 'ACC_SOURCE_FLASH', '验收-秒杀商品源', ['hf-instant-coconut-water-001']);
  await upsertScene(prisma, sceneCode, '验收-秒杀场景');
  await upsertSceneModule(prisma, sceneCode, 'ACC_MOD_FLASH', '秒杀列表', 'ACC_SOURCE_FLASH', {
    featuredCount: 3,
  });
  await publishAcceptanceScene(prisma, sceneCode);
}

/** 剧本 7：拼课场景 + 固定团 */
export async function seedScenario07CourseGroup(prisma: PrismaClient): Promise<void> {
  const sceneCode = 'ACC_SCENE_COURSE_OK';
  await upsertSourcePolicy(prisma, 'ACC_SOURCE_COURSE', '验收-拼课商品源', ['hf-service-art-001']);
  await upsertScene(prisma, sceneCode, '验收-拼课场景');
  await upsertSceneModule(prisma, sceneCode, 'ACC_MOD_COURSE', '拼课列表', 'ACC_SOURCE_COURSE', {
    featuredCount: 2,
  });
  await publishAcceptanceScene(prisma, sceneCode);
}
