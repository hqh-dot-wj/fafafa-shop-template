import { PrismaClient } from '@prisma/client';

import { seedAcceptanceCourseGroupTeams } from './course-group-teams';
import {
  seedScenario01Unpublished,
  seedScenario04NoPlay,
  seedScenario06Flash,
  seedScenario07CourseGroup,
} from './scenarios';
import { assertAcceptancePrerequisites, patchArtCourseGroupSkuPrices } from './shared';

export async function seedAcceptanceProfile(prisma: PrismaClient): Promise<void> {
  console.log('[Acceptance] 营销验收种子 profile...');
  await assertAcceptancePrerequisites(prisma);
  await patchArtCourseGroupSkuPrices(prisma);

  await seedScenario01Unpublished(prisma);
  await seedScenario04NoPlay(prisma);
  await seedScenario06Flash(prisma);
  await seedScenario07CourseGroup(prisma);
  await seedAcceptanceCourseGroupTeams(prisma);

  console.log('[Acceptance] 完成（剧本 1/4/6/7 + 拼课验收团）');
}
