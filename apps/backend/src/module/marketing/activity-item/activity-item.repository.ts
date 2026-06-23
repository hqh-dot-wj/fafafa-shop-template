import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityRepository } from '../activity/activity.repository';

const ACTIVITY_ITEMS_KEY = 'activityItems';

@Injectable()
export class ActivityItemRepository {
  constructor(private readonly activityRepo: ActivityRepository) {}

  async findActivityById(activityId: string) {
    return this.activityRepo.findById(activityId);
  }

  async saveActivityItems(
    activityId: string,
    currentRules: Record<string, unknown>,
    items: unknown[],
    operatorId: string,
  ) {
    const nextRules = {
      ...currentRules,
      [ACTIVITY_ITEMS_KEY]: items,
    };

    await this.activityRepo.update(activityId, {
      rules: nextRules as Prisma.InputJsonValue,
      updatedBy: operatorId,
    });
  }
}
