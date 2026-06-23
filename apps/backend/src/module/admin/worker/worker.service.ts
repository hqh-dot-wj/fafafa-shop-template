import { Injectable } from '@nestjs/common';
import {
  AuditStatus,
  Gender,
  MemberStatus,
  Prisma,
  SrvWorker,
  SrvWorkerApplication,
  SrvWorkerCert,
  SrvWorkerProfile,
  SrvWorkerSkill,
  WorkerApplicationStatus,
  WorkerSource,
  WorkerStatus,
} from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import type { AppPrismaTransactionClient } from 'src/prisma/prisma-tenant.types';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ApproveWorkerApplicationDto,
  CreateWorkerProfileDto,
  RejectWorkerApplicationDto,
  UpdateWorkerProfileDto,
  UpdateWorkerStatusDto,
  WorkerApplicationQueryDto,
  WorkerCertificateDto,
  WorkerProfileQueryDto,
} from './dto';
import { WorkerAddressVo, WorkerApplicationVo, WorkerCertificateVo, WorkerProfileVo } from './vo';

type WorkerWithRelations = SrvWorker & {
  profile: SrvWorkerProfile | null;
  certs: SrvWorkerCert[];
  skills: SrvWorkerSkill[];
};

type WorkerPayload = {
  tenantId: string;
  name: string;
  nickName?: string;
  phone: string;
  avatar?: string;
  gender: Gender;
  address?: Prisma.JsonValue;
  serviceCategoryIds: number[];
  skillTags: string[];
  serviceArea?: Prisma.JsonValue;
  status: WorkerStatus;
  isOnline: boolean;
  serviceRadius: number;
  experienceYears?: number;
  intro?: string;
  certificates: WorkerCertificateDto[];
  remark?: string;
  source: WorkerSource;
};

@Injectable()
export class WorkerService {
  constructor(private readonly prisma: PrismaService) {}

  async listProfiles(query: WorkerProfileQueryDto) {
    const where: Prisma.SrvWorkerWhereInput = this.applyTenantScope(
      {
        ...(query.status ? { status: query.status } : {}),
        ...(typeof query.isOnline === 'boolean' ? { isOnline: query.isOnline } : {}),
        ...(query.source ? { source: query.source } : {}),
        ...(query.phone ? { phone: { contains: query.phone } } : {}),
        ...(query.keyword
          ? {
              OR: [
                { name: { contains: query.keyword } },
                { nickName: { contains: query.keyword } },
                { phone: { contains: query.keyword } },
              ],
            }
          : {}),
        ...(query.serviceCategoryId ? { skills: { some: { categoryId: query.serviceCategoryId } } } : {}),
      },
      query.tenantId,
    );

    const [total, rows] = await Promise.all([
      this.prisma.srvWorker.count({ where }),
      this.prisma.srvWorker.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createTime: 'desc' },
        include: { profile: true, certs: true, skills: true },
      }),
    ]);

    const tenantMap = await this.getTenantMap(rows.map((item) => item.tenantId));
    const categoryMap = await this.getCategoryMap(rows.flatMap((item) => item.skills.map((skill) => skill.categoryId)));
    const list = rows.map((item) => this.toWorkerProfileVo(item, tenantMap, categoryMap));

    return Result.page(list, total, query.pageNum, query.pageSize);
  }

  async createProfile(dto: CreateWorkerProfileDto) {
    const tenantId = await this.resolveCreateTenantId(dto.basicInfo.tenantId);
    const payload = this.profileDtoToPayload(dto, tenantId, WorkerSource.BACKEND);
    this.validateWorkerPayload(payload);
    await this.ensurePhoneAvailable(payload.tenantId, payload.phone);

    const worker = await this.prisma.$transaction((tx) => this.createWorkerInTransaction(tx, payload));
    return Result.ok({ workerId: worker.workerId }, '创建工作者成功');
  }

  async getProfile(id: number) {
    const worker = await this.findVisibleWorker(id);
    const tenantMap = await this.getTenantMap([worker.tenantId]);
    const categoryMap = await this.getCategoryMap(worker.skills.map((skill) => skill.categoryId));
    return Result.ok(this.toWorkerProfileVo(worker, tenantMap, categoryMap));
  }

  async updateProfile(id: number, dto: UpdateWorkerProfileDto) {
    const worker = await this.findVisibleWorker(id);
    const payload = this.profileDtoToPayload(dto, worker.tenantId, worker.source);
    this.validateWorkerPayload(payload);
    await this.ensurePhoneAvailable(worker.tenantId, payload.phone, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.srvWorker.update({
        where: { workerId: id },
        data: {
          name: payload.name,
          nickName: payload.nickName,
          avatar: payload.avatar,
          phone: payload.phone,
          status: payload.status,
          isOnline: payload.isOnline,
          serviceRadius: payload.serviceRadius,
          serviceArea: this.toInputJson(payload.serviceArea),
          address: this.toInputJson(payload.address),
          tags: this.toInputJson(payload.skillTags),
          completionScore: this.calculateCompletionScore(payload),
          remark: payload.remark,
        },
      });
      await tx.srvWorkerProfile.upsert({
        where: { workerId: id },
        update: {
          gender: payload.gender,
          experienceYears: payload.experienceYears,
          intro: payload.intro,
        },
        create: {
          workerId: id,
          gender: payload.gender,
          experienceYears: payload.experienceYears,
          intro: payload.intro,
        },
      });
      await this.syncWorkerSkills(tx, id, payload.serviceCategoryIds);
      await this.syncWorkerCertificates(tx, id, payload.certificates);
    });

    return Result.ok(null, '更新工作者成功');
  }

  async updateProfileStatus(id: number, dto: UpdateWorkerStatusDto) {
    await this.findVisibleWorker(id);
    BusinessException.throwIf(
      !dto.status && typeof dto.isOnline !== 'boolean',
      '至少需要传入接单状态或在线状态',
      ResponseCode.PARAM_INVALID,
    );

    const data: Prisma.SrvWorkerUpdateInput = {};
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === WorkerStatus.DISABLED) {
        data.isOnline = false;
      }
    }
    if (typeof dto.isOnline === 'boolean') {
      data.isOnline = dto.isOnline;
    }
    if (dto.status === WorkerStatus.DISABLED) {
      data.isOnline = false;
    }

    await this.prisma.srvWorker.update({ where: { workerId: id }, data });
    return Result.ok(null, '更新工作者状态成功');
  }

  async listApplications(query: WorkerApplicationQueryDto) {
    const where: Prisma.SrvWorkerApplicationWhereInput = this.applyTenantScope(
      {
        ...(query.applicationStatus ? { applicationStatus: query.applicationStatus } : {}),
        ...(query.applicationSource ? { applicationSource: query.applicationSource } : {}),
        ...(query.phone ? { phone: { contains: query.phone } } : {}),
        ...(query.keyword
          ? {
              OR: [{ name: { contains: query.keyword } }, { phone: { contains: query.keyword } }],
            }
          : {}),
      },
      query.tenantId,
    );

    const [total, rows] = await Promise.all([
      this.prisma.srvWorkerApplication.count({ where }),
      this.prisma.srvWorkerApplication.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createTime: 'desc' },
      }),
    ]);

    const tenantMap = await this.getTenantMap(rows.map((item) => item.tenantId));
    const categoryMap = await this.getCategoryMap(rows.flatMap((item) => this.toNumberArray(item.serviceCategoryIds)));
    const list = rows.map((item) => this.toWorkerApplicationVo(item, tenantMap, categoryMap));

    return Result.page(list, total, query.pageNum, query.pageSize);
  }

  async getApplication(id: number) {
    const application = await this.findVisibleApplication(id);
    const tenantMap = await this.getTenantMap([application.tenantId]);
    const categoryMap = await this.getCategoryMap(this.toNumberArray(application.serviceCategoryIds));
    return Result.ok(this.toWorkerApplicationVo(application, tenantMap, categoryMap));
  }

  async approveApplication(id: number, dto: ApproveWorkerApplicationDto, reviewBy?: string) {
    const application = await this.findVisibleApplication(id);
    BusinessException.throwIf(
      application.applicationStatus !== WorkerApplicationStatus.PENDING,
      '只有待审核申请可以通过',
      ResponseCode.OPERATION_FAILED,
    );

    const payload = this.applicationToPayload(application);
    this.validateWorkerPayload(payload);
    await this.ensurePhoneAvailable(payload.tenantId, payload.phone);

    const worker = await this.prisma.$transaction(async (tx) => {
      const created = await this.createWorkerInTransaction(tx, payload);
      await tx.srvWorkerApplication.update({
        where: { applicationId: id },
        data: {
          workerId: created.workerId,
          applicationStatus: WorkerApplicationStatus.APPROVED,
          reviewBy: reviewBy || 'system',
          reviewTime: new Date(),
          reviewRemark: dto.reviewRemark,
        },
      });
      return created;
    });

    return Result.ok({ workerId: worker.workerId }, '审核通过，已创建正式工作者');
  }

  async rejectApplication(id: number, dto: RejectWorkerApplicationDto, reviewBy?: string) {
    const application = await this.findVisibleApplication(id);
    BusinessException.throwIf(
      application.applicationStatus !== WorkerApplicationStatus.PENDING,
      '只有待审核申请可以拒绝',
      ResponseCode.OPERATION_FAILED,
    );

    await this.prisma.srvWorkerApplication.update({
      where: { applicationId: id },
      data: {
        applicationStatus: WorkerApplicationStatus.REJECTED,
        reviewBy: reviewBy || 'system',
        reviewTime: new Date(),
        reviewRemark: dto.reviewRemark,
      },
    });

    return Result.ok(null, '已拒绝申请');
  }

  private async findVisibleWorker(workerId: number): Promise<WorkerWithRelations> {
    const worker = await this.prisma.srvWorker.findFirst({
      where: this.applyTenantScope({ workerId }),
      include: { profile: true, certs: true, skills: true },
    });
    BusinessException.throwIfNull(worker, '工作者不存在');
    return worker;
  }

  private async findVisibleApplication(applicationId: number): Promise<SrvWorkerApplication> {
    const application = await this.prisma.srvWorkerApplication.findFirst({
      where: this.applyTenantScope({ applicationId }),
    });
    BusinessException.throwIfNull(application, '工作者申请不存在');
    return application;
  }

  private applyTenantScope<T extends object>(where: T, requestedTenantId?: string): T & { tenantId?: string } {
    if (TenantContext.isSuperTenant()) {
      return requestedTenantId ? { ...where, tenantId: requestedTenantId } : (where as T & { tenantId?: string });
    }
    const tenantId = this.requireCurrentTenant();
    return { ...where, tenantId } as T;
  }

  private async resolveCreateTenantId(requestedTenantId?: string): Promise<string> {
    if (TenantContext.isSuperTenant()) {
      BusinessException.throwIf(
        !requestedTenantId,
        '超级管理员添加工作者时必须选择所属租户',
        ResponseCode.PARAM_INVALID,
      );
      BusinessException.throwIf(
        requestedTenantId === TenantContext.SUPER_TENANT_ID,
        '工作者必须归属具体租户',
        ResponseCode.PARAM_INVALID,
      );
      await this.ensureTenantExists(requestedTenantId);
      return requestedTenantId;
    }

    const tenantId = this.requireCurrentTenant();
    BusinessException.throwIf(
      !!requestedTenantId && requestedTenantId !== tenantId,
      '不能为其他租户添加工作者',
      ResponseCode.PERMISSION_DENIED,
    );
    await this.ensureTenantExists(tenantId);
    return tenantId;
  }

  private requireCurrentTenant(): string {
    const tenantId = TenantContext.getTenantId();
    BusinessException.throwIf(!tenantId, '缺少租户上下文', ResponseCode.TENANT_NOT_FOUND);
    BusinessException.throwIf(
      tenantId === TenantContext.SUPER_TENANT_ID,
      '超级管理员必须显式选择目标租户',
      ResponseCode.PARAM_INVALID,
    );
    return tenantId;
  }

  private async ensureTenantExists(tenantId: string) {
    const tenant = await this.prisma.sysTenant.findUnique({ where: { tenantId }, select: { tenantId: true } });
    BusinessException.throwIfNull(tenant, '所属租户不存在', ResponseCode.TENANT_NOT_FOUND);
  }

  private async ensurePhoneAvailable(tenantId: string, phone: string, excludeWorkerId?: number) {
    const worker = await this.prisma.srvWorker.findFirst({
      where: {
        tenantId,
        phone,
        ...(excludeWorkerId ? { workerId: { not: excludeWorkerId } } : {}),
      },
      select: { workerId: true },
    });
    BusinessException.throwIf(!!worker, '同租户内手机号已存在工作者资料', ResponseCode.DATA_ALREADY_EXISTS);
  }

  private profileDtoToPayload(dto: CreateWorkerProfileDto, tenantId: string, source: WorkerSource): WorkerPayload {
    const basicInfo = dto.basicInfo;
    const workInfo = dto.workInfo;
    const experienceInfo = dto.experienceInfo;

    return {
      tenantId,
      name: basicInfo.name.trim(),
      nickName: basicInfo.nickName?.trim(),
      phone: basicInfo.phone.trim(),
      avatar: basicInfo.avatar,
      gender: basicInfo.gender ?? Gender.UNKNOWN,
      address: basicInfo.address as Prisma.JsonValue | undefined,
      serviceCategoryIds: workInfo.serviceCategoryIds ?? [],
      skillTags: workInfo.skillTags ?? [],
      serviceArea: workInfo.serviceArea as Prisma.JsonValue | undefined,
      status: workInfo.status ?? WorkerStatus.RESTING,
      isOnline: workInfo.isOnline ?? false,
      serviceRadius: workInfo.serviceRadius ?? 5000,
      experienceYears: experienceInfo.experienceYears,
      intro: experienceInfo.intro,
      certificates: experienceInfo.certificates ?? [],
      remark: experienceInfo.remark ?? basicInfo.remark,
      source,
    };
  }

  private applicationToPayload(application: SrvWorkerApplication): WorkerPayload {
    return {
      tenantId: application.tenantId,
      name: application.name,
      nickName: application.nickName ?? undefined,
      phone: application.phone,
      avatar: application.avatar ?? undefined,
      gender: application.gender,
      address: application.address ?? undefined,
      serviceCategoryIds: this.toNumberArray(application.serviceCategoryIds),
      skillTags: this.toStringArray(application.skillTags),
      serviceArea: application.serviceArea ?? undefined,
      status: application.status,
      isOnline: application.isOnline,
      serviceRadius: application.serviceRadius ?? 5000,
      experienceYears: application.experienceYears ?? undefined,
      intro: application.intro ?? undefined,
      certificates: this.toCertificateDtos(application.certificates),
      remark: application.remark ?? undefined,
      source: WorkerSource.APPLICATION,
    };
  }

  private validateWorkerPayload(payload: WorkerPayload) {
    BusinessException.throwIf(!payload.name, '姓名不能为空', ResponseCode.PARAM_INVALID);
    BusinessException.throwIf(!payload.phone, '手机号不能为空', ResponseCode.PARAM_INVALID);
    BusinessException.throwIf(payload.serviceCategoryIds.length === 0, '服务类目不能为空', ResponseCode.PARAM_INVALID);
    BusinessException.throwIf(!payload.serviceArea, '服务地区不能为空', ResponseCode.PARAM_INVALID);
  }

  private async createWorkerInTransaction(tx: AppPrismaTransactionClient, payload: WorkerPayload): Promise<SrvWorker> {
    const member = await this.getOrCreateMember(tx, payload);
    const worker = await tx.srvWorker.create({
      data: {
        tenantId: payload.tenantId,
        memberId: member.memberId,
        name: payload.name,
        nickName: payload.nickName,
        avatar: payload.avatar,
        phone: payload.phone,
        status: payload.status,
        auditStatus: AuditStatus.APPROVED,
        isOnline: payload.isOnline,
        serviceRadius: payload.serviceRadius,
        serviceArea: this.toInputJson(payload.serviceArea),
        address: this.toInputJson(payload.address),
        source: payload.source,
        tags: this.toInputJson(payload.skillTags),
        completionScore: this.calculateCompletionScore(payload),
        remark: payload.remark,
      },
    });

    await tx.srvWorkerProfile.create({
      data: {
        workerId: worker.workerId,
        gender: payload.gender,
        experienceYears: payload.experienceYears,
        intro: payload.intro,
      },
    });
    await this.syncWorkerSkills(tx, worker.workerId, payload.serviceCategoryIds);
    await this.syncWorkerCertificates(tx, worker.workerId, payload.certificates);

    return worker;
  }

  private async getOrCreateMember(tx: AppPrismaTransactionClient, payload: WorkerPayload) {
    const member = await tx.umsMember.findUnique({ where: { mobile: payload.phone } });
    if (member) return member;

    return tx.umsMember.create({
      data: {
        tenantId: payload.tenantId,
        mobile: payload.phone,
        nickname: payload.nickName || payload.name,
        avatar: payload.avatar,
        status: MemberStatus.NORMAL,
      },
    });
  }

  private async syncWorkerSkills(tx: AppPrismaTransactionClient, workerId: number, categoryIds: number[]) {
    await tx.srvWorkerSkill.deleteMany({ where: { workerId } });
    if (categoryIds.length === 0) return;

    const uniqCategoryIds = [...new Set(categoryIds)];
    await tx.srvWorkerSkill.createMany({
      data: uniqCategoryIds.map((categoryId) => ({
        workerId,
        categoryId,
        skillName: String(categoryId),
      })),
      skipDuplicates: true,
    });
  }

  private async syncWorkerCertificates(
    tx: AppPrismaTransactionClient,
    workerId: number,
    certificates: WorkerCertificateDto[],
  ) {
    await tx.srvWorkerCert.deleteMany({ where: { workerId } });
    if (certificates.length === 0) return;

    await tx.srvWorkerCert.createMany({
      data: certificates.map((cert) => ({
        workerId,
        name: cert.name,
        certNo: cert.certNo,
        images: this.toInputJson(cert.images),
      })),
    });
  }

  private calculateCompletionScore(payload: WorkerPayload): number {
    let score = 0;
    if (payload.tenantId && payload.name && payload.phone) score += 30;
    if (payload.address) score += 10;
    if (payload.serviceCategoryIds.length > 0) score += 20;
    if (payload.serviceArea) score += 15;
    if (payload.skillTags.length > 0) score += 10;
    if (payload.experienceYears !== undefined || payload.intro) score += 10;
    if (payload.certificates.length > 0) score += 5;
    return Math.min(score, 100);
  }

  private async getTenantMap(tenantIds: string[]): Promise<Map<string, string>> {
    const uniqTenantIds = [...new Set(tenantIds.filter(Boolean))];
    const tenants = await this.prisma.sysTenant.findMany({
      where: { tenantId: { in: uniqTenantIds } },
      select: { tenantId: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((tenant) => [tenant.tenantId, tenant.companyName]));
    tenantMap.set(TenantContext.SUPER_TENANT_ID, '平台');
    return tenantMap;
  }

  private async getCategoryMap(categoryIds: number[]): Promise<Map<number, string>> {
    const uniqCategoryIds = [...new Set(categoryIds.filter((id) => Number.isInteger(id)))];
    if (uniqCategoryIds.length === 0) return new Map();

    const categories = await this.prisma.pmsCategory.findMany({
      where: { catId: { in: uniqCategoryIds } },
      select: { catId: true, name: true },
    });
    return new Map(categories.map((category) => [category.catId, category.name]));
  }

  private toWorkerProfileVo(
    worker: WorkerWithRelations,
    tenantMap: Map<string, string>,
    categoryMap: Map<number, string>,
  ): WorkerProfileVo {
    const serviceCategoryIds = worker.skills.map((skill) => skill.categoryId);
    return {
      workerId: worker.workerId,
      memberId: worker.memberId,
      tenantId: worker.tenantId,
      tenantName: tenantMap.get(worker.tenantId) || worker.tenantId,
      name: worker.name,
      nickName: worker.nickName ?? undefined,
      avatar: worker.avatar ?? undefined,
      phone: worker.phone,
      gender: worker.profile?.gender ?? Gender.UNKNOWN,
      address: this.toAddressVo(worker.address),
      serviceCategoryIds,
      serviceCategoryNames: serviceCategoryIds.map((id) => categoryMap.get(id) || String(id)),
      skillTags: this.toStringArray(worker.tags),
      serviceArea: this.toAddressVo(worker.serviceArea),
      status: worker.status,
      isOnline: worker.isOnline,
      serviceRadius: worker.serviceRadius,
      source: worker.source,
      completionScore: worker.completionScore,
      experienceYears: worker.profile?.experienceYears ?? undefined,
      intro: worker.profile?.intro ?? undefined,
      certificates: worker.certs.map((cert) => this.toCertificateVo(cert)),
      remark: worker.remark ?? undefined,
      createTime: worker.createTime,
      updateTime: worker.updateTime,
    };
  }

  private toWorkerApplicationVo(
    application: SrvWorkerApplication,
    tenantMap: Map<string, string>,
    categoryMap: Map<number, string>,
  ): WorkerApplicationVo {
    const serviceCategoryIds = this.toNumberArray(application.serviceCategoryIds);
    return {
      applicationId: application.applicationId,
      tenantId: application.tenantId,
      tenantName: tenantMap.get(application.tenantId) || application.tenantId,
      workerId: application.workerId ?? undefined,
      name: application.name,
      nickName: application.nickName ?? undefined,
      phone: application.phone,
      avatar: application.avatar ?? undefined,
      gender: application.gender,
      address: this.toAddressVo(application.address),
      serviceCategoryIds,
      serviceCategoryNames: serviceCategoryIds.map((id) => categoryMap.get(id) || String(id)),
      skillTags: this.toStringArray(application.skillTags),
      serviceArea: this.toAddressVo(application.serviceArea),
      status: application.status,
      isOnline: application.isOnline,
      serviceRadius: application.serviceRadius ?? undefined,
      experienceYears: application.experienceYears ?? undefined,
      intro: application.intro ?? undefined,
      certificates: this.toCertificateDtos(application.certificates).map((cert) => ({
        name: cert.name,
        certNo: cert.certNo,
        images: cert.images,
      })),
      remark: application.remark ?? undefined,
      applicationSource: application.applicationSource,
      applicationStatus: application.applicationStatus,
      reviewBy: application.reviewBy ?? undefined,
      reviewTime: application.reviewTime ?? undefined,
      reviewRemark: application.reviewRemark ?? undefined,
      createTime: application.createTime,
      updateTime: application.updateTime,
    };
  }

  private toCertificateVo(cert: SrvWorkerCert): WorkerCertificateVo {
    return {
      name: cert.name,
      certNo: cert.certNo ?? undefined,
      images: this.toStringArray(cert.images),
    };
  }

  private toAddressVo(value: Prisma.JsonValue | null | undefined): WorkerAddressVo | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const raw = value as Record<string, unknown>;
    return {
      provinceCode: this.readString(raw, 'provinceCode'),
      provinceName: this.readString(raw, 'provinceName'),
      cityCode: this.readString(raw, 'cityCode'),
      cityName: this.readString(raw, 'cityName'),
      districtCode: this.readString(raw, 'districtCode'),
      districtName: this.readString(raw, 'districtName'),
      addressDetail: this.readString(raw, 'addressDetail'),
      lat: this.readNumber(raw, 'lat'),
      lng: this.readNumber(raw, 'lng'),
      formattedAddress: this.readString(raw, 'formattedAddress'),
    };
  }

  private toCertificateDtos(value: Prisma.JsonValue | null | undefined): WorkerCertificateDto[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is Prisma.JsonObject => this.isJsonObject(item))
      .map((item) => ({
        name: this.readString(item, 'name') || '',
        certNo: this.readString(item, 'certNo'),
        images: this.toStringArray(item.images),
      }))
      .filter((item) => item.name);
  }

  private isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
      .map(String);
  }

  private toNumberArray(value: Prisma.JsonValue | null | undefined): number[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }

  private readString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private readNumber(record: Record<string, unknown>, key: string): number | undefined {
    const value = record[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }
}
