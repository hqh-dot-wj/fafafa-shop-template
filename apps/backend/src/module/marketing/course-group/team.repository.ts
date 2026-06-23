import { Injectable } from '@nestjs/common';
import { DelFlag, PlayInstanceStatus, Prisma, PublishStatus } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  readCourseGroupTeamState,
  writeCourseGroupTeamState,
} from './services/team-projection.service';

export const COURSE_GROUP_CONFIG_SELECT = {
  id: true,
  tenantId: true,
  serviceId: true,
  templateCode: true,
  status: true,
  rules: true,
} satisfies Prisma.StorePlayConfigSelect;

export type CourseGroupConfigRecord = Prisma.StorePlayConfigGetPayload<{
  select: typeof COURSE_GROUP_CONFIG_SELECT;
}>;

export const COURSE_GROUP_INSTANCE_SELECT = {
  id: true,
  tenantId: true,
  memberId: true,
  configId: true,
  templateCode: true,
  orderItemId: true,
  status: true,
  instanceData: true,
  createTime: true,
  updateTime: true,
} satisfies Prisma.PlayInstanceSelect;

export type CourseGroupInstanceRecord = Prisma.PlayInstanceGetPayload<{
  select: typeof COURSE_GROUP_INSTANCE_SELECT;
}>;

@Injectable()
export class TeamRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async findConfigByProduct(tenantId: string, productId: string) {
    return this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        tenantId,
        serviceId: productId,
        templateCode: 'COURSE_GROUP_BUY',
        delFlag: DelFlag.NORMAL,
        status: PublishStatus.ON_SHELF,
      }) as Prisma.StorePlayConfigWhereInput,
      orderBy: [{ displayPriority: 'desc' }, { updateTime: 'desc' }],
      select: COURSE_GROUP_CONFIG_SELECT,
    });
  }

  async findConfigById(configId: string) {
    return this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: configId,
      }) as Prisma.StorePlayConfigWhereInput,
      select: COURSE_GROUP_CONFIG_SELECT,
    });
  }

  async listStoreConfigs(tenantId: string) {
    return this.prisma.storePlayConfig.findMany({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        tenantId,
        templateCode: 'COURSE_GROUP_BUY',
        delFlag: DelFlag.NORMAL,
      }) as Prisma.StorePlayConfigWhereInput,
      orderBy: { updateTime: 'desc' },
      select: COURSE_GROUP_CONFIG_SELECT,
    });
  }

  async listConfigsByIds(configIds: string[]) {
    if (configIds.length === 0) return [];
    return this.prisma.storePlayConfig.findMany({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: { in: configIds },
        delFlag: DelFlag.NORMAL,
      }) as Prisma.StorePlayConfigWhereInput,
      select: COURSE_GROUP_CONFIG_SELECT,
    });
  }

  async listInstancesByConfigIds(tenantId: string, configIds: string[]) {
    if (configIds.length === 0) return [];
    return this.prisma.playInstance.findMany({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        tenantId,
        templateCode: 'COURSE_GROUP_BUY',
        configId: { in: configIds },
        status: {
          in: [
            PlayInstanceStatus.PENDING_PAY,
            PlayInstanceStatus.PAID,
            PlayInstanceStatus.ACTIVE,
            PlayInstanceStatus.SUCCESS,
            PlayInstanceStatus.FAILED,
            PlayInstanceStatus.TIMEOUT,
            PlayInstanceStatus.REFUNDED,
          ],
        },
      }) as Prisma.PlayInstanceWhereInput,
      select: COURSE_GROUP_INSTANCE_SELECT,
      orderBy: { createTime: 'desc' },
    });
  }

  async findLeaderTeam(tenantId: string, teamId: string) {
    return this.prisma.playInstance.findFirst({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        id: teamId,
        tenantId,
        templateCode: 'COURSE_GROUP_BUY',
      }) as Prisma.PlayInstanceWhereInput,
      select: COURSE_GROUP_INSTANCE_SELECT,
    });
  }

  async findTeamMemberRecord(tenantId: string, memberRecordId: string, teamId: string) {
    return this.prisma.playInstance.findFirst({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        id: memberRecordId,
        tenantId,
        templateCode: 'COURSE_GROUP_BUY',
        instanceData: { path: ['parentId'], equals: teamId },
      }) as Prisma.PlayInstanceWhereInput,
      select: {
        id: true,
        status: true,
      },
    });
  }

  async updateTeamRuntimeState(
    leaderId: string,
    currentInstanceData: unknown,
    runtimeStatus: 'IN_CLASS' | 'FINISHED' | 'CLOSED',
    extraData?: Record<string, unknown>,
  ) {
    const record = this.toRecord(currentInstanceData);
    const runtimeUpdatedAt = new Date().toISOString();
    const courseGroupTeam = readCourseGroupTeamState(currentInstanceData);
    const nextCourseGroupTeam = {
      ...courseGroupTeam,
      facts: {
        ...courseGroupTeam.facts,
        audits: {
          ...courseGroupTeam.facts.audits,
          runtimeTransition: [
            ...courseGroupTeam.facts.audits.runtimeTransition,
            {
              runtimeStatus,
              createdAt: runtimeUpdatedAt,
            },
          ],
        },
      },
    };

    await this.prisma.playInstance.update({
      where: { id: leaderId },
      data: {
        instanceData: writeCourseGroupTeamState(
          {
            ...record,
            ...extraData,
            runtimeStatus,
            runtimeUpdatedAt,
          },
          nextCourseGroupTeam,
        ) as Prisma.InputJsonValue,
      },
    });
  }

  async loadProductsByIds(productIds: string[]) {
    const unique = [...new Set(productIds.filter(Boolean))];
    if (unique.length === 0) return [];
    return this.prisma.pmsProduct.findMany({
      where: {
        productId: { in: unique },
      },
      select: {
        productId: true,
        name: true,
        mainImages: true,
      },
    });
  }

  async loadStores(tenantIds: string[]) {
    const unique = [...new Set(tenantIds.filter(Boolean))];
    if (unique.length === 0) return [];
    return this.prisma.sysTenant.findMany({
      where: {
        tenantId: { in: unique },
      },
      select: {
        tenantId: true,
        companyName: true,
      },
    });
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }
}
