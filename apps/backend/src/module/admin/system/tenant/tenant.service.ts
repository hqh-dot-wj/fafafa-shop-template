import { Injectable, HttpException, HttpStatus, Logger, Inject, forwardRef } from '@nestjs/common';
import {
  Prisma,
  SettlementChannelType,
  SettlementProfileStatus,
  SettlementReceiverType,
  type SysDept,
  type SysRole,
  type SysTenant,
  type SysTenantPackage,
  type SysUser,
} from '@prisma/client';
import { Result, ResponseCode } from 'src/common/response';
import { DataScopeEnum, DelFlagEnum, StatusEnum } from 'src/common/enum/index';
import { SYS_USER_TYPE } from 'src/common/constant/index';
import { BusinessException } from 'src/common/exceptions';
import { ExportTable } from 'src/common/utils/export';
import { FormatDateFields, GenerateUUID } from 'src/common/utils/index';
import { Response } from 'express';
import { CreateTenantDto, UpdateTenantDto, ListTenantDto, SyncTenantPackageDto, ShopSettingsDto } from './dto/index';
import { PrismaService } from 'src/prisma/prisma.service';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { getErrorMessage } from 'src/common/utils/error';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { CacheEnum } from 'src/common/enum/cache.enum';
import { hash } from 'bcryptjs';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { StepTraceService, attachErrorContext } from 'src/common/observability';

import { StationService } from 'src/module/lbs/station/station.service';
import { UserAuthService } from '../user/services/user-auth.service';
import { UserType } from '../user/dto/user';
import { parsePackageMenuIds, syncTenantAdminRoleMenus, syncTenantMenusFromPackage } from './tenant-package-sync';

const SYSTEM_OPERATOR = 'system';
const TENANT_ADMIN_ROLE_KEY = 'tenant_admin';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly stationService: StationService,
    private readonly tenantHelper: TenantHelper,
    private readonly stepTrace: StepTraceService,
    @Inject(forwardRef(() => UserAuthService))
    private readonly userAuthService: UserAuthService,
  ) {}

  /**
   * 创建租户
   */
  @IgnoreTenant()
  @Transactional()
  async create(createTenantDto: CreateTenantDto) {
    let tenantId = createTenantDto.tenantId;

    try {
      tenantId = await this.stepTrace.run(
        {
          module: 'system-tenant',
          operationCode: 'tenant.create',
          stepCode: 'tenant.create.allocateTenantId',
          stepName: '生成租户编号',
          safeMessage: '创建租户失败：租户编号生成失败',
          metadata: { providedTenantId: createTenantDto.tenantId, companyName: createTenantDto.companyName },
        },
        async () => {
          if (tenantId) {
            return tenantId;
          }
          const lastTenant = await this.prisma.sysTenant.findFirst({
            where: { tenantId: { not: TenantContext.SUPER_TENANT_ID } },
            orderBy: { id: 'desc' },
          });
          const lastId = lastTenant?.tenantId ? parseInt(lastTenant.tenantId) : 100000;
          return String(lastId + 1).padStart(6, '0');
        },
      );

      const baseStep = {
        module: 'system-tenant',
        operationCode: 'tenant.create',
        tenantId,
        metadata: { tenantId, companyName: createTenantDto.companyName },
      };

      await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.create.validateUnique',
          stepName: '校验租户唯一性',
          safeMessage: '创建租户失败：租户编号或企业名称已存在',
        },
        async () => {
          const existTenant = await this.prisma.sysTenant.findUnique({
            where: { tenantId },
          });
          if (existTenant) {
            throw new BusinessException(ResponseCode.BAD_REQUEST, '租户ID已存在');
          }

          const existCompany = await this.prisma.sysTenant.findFirst({
            where: { companyName: createTenantDto.companyName, delFlag: DelFlagEnum.NORMAL },
          });
          if (existCompany) {
            throw new BusinessException(ResponseCode.BAD_REQUEST, '企业名称已存在');
          }
        },
      );

      const hashedPassword = await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.create.hashPassword',
          stepName: '加密租户管理员密码',
          safeMessage: '创建租户失败：管理员密码处理失败',
        },
        async () => hash(createTenantDto.password, 10),
      );

      await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.create.createTenant',
          stepName: '创建租户主记录',
          safeMessage: '创建租户失败：租户主记录写入失败',
        },
        async () =>
          this.prisma.sysTenant.create({
            data: {
              tenantId,
              contactUserName: createTenantDto.contactUserName,
              contactPhone: createTenantDto.contactPhone,
              companyName: createTenantDto.companyName,
              licenseNumber: createTenantDto.licenseNumber,
              address: createTenantDto.address,
              intro: createTenantDto.intro,
              domain: createTenantDto.domain,
              packageId: createTenantDto.packageId,
              expireTime: createTenantDto.expireTime,
              accountCount: createTenantDto.accountCount ?? -1,
              status: (createTenantDto.status as StatusEnum) ?? StatusEnum.NORMAL,
              remark: createTenantDto.remark,
              delFlag: DelFlagEnum.NORMAL,
              regionCode: createTenantDto.regionCode,
              isDirect: createTenantDto.isDirect,
            },
          }),
      );

      await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.create.createSettlementProfile',
          stepName: '创建租户结算配置',
          safeMessage: '创建租户失败：结算配置写入失败',
        },
        async () =>
          this.prisma.finTenantSettlementProfile.create({
            data: {
              tenantId,
              enabled: createTenantDto.settlementEnabled ?? false,
              defaultChannel: createTenantDto.settlementChannel ?? SettlementChannelType.OFFLINE_TRANSFER,
              receiverType: createTenantDto.settlementReceiverType ?? SettlementReceiverType.TENANT,
              receiverAccount: createTenantDto.settlementReceiverAccount,
              receiverName: createTenantDto.settlementReceiverName,
              bankName: createTenantDto.settlementBankName,
              bankAccountNo: createTenantDto.settlementBankAccountNo,
              needManualReview: createTenantDto.settlementNeedManualReview ?? true,
              status:
                createTenantDto.settlementStatus ??
                (createTenantDto.settlementEnabled ? SettlementProfileStatus.ACTIVE : SettlementProfileStatus.DRAFT),
              remark: createTenantDto.settlementRemark,
            },
          }),
      );

      await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.create.createAdminUser',
          stepName: '创建租户管理员账号',
          safeMessage: '创建租户失败：管理员账号写入失败',
          metadata: { tenantId, username: createTenantDto.username },
        },
        async () =>
          this.prisma.sysUser.create({
            data: {
              tenantId,
              userName: createTenantDto.username,
              nickName: '租户管理员',
              userType: SYS_USER_TYPE.SYS,
              password: hashedPassword,
              status: StatusEnum.NORMAL,
              delFlag: DelFlagEnum.NORMAL,
            },
          }),
      );

      if (createTenantDto.address || createTenantDto.latitude) {
        await this.stepTrace.run(
          {
            ...baseStep,
            stepCode: 'tenant.create.createGeo',
            stepName: '创建租户地理配置',
            safeMessage: '创建租户失败：地理配置写入失败',
          },
          async () =>
            this.prisma.sysTenantGeo.create({
              data: {
                tenantId,
                address: createTenantDto.address,
                latitude: createTenantDto.latitude,
                longitude: createTenantDto.longitude,
                serviceRadius: createTenantDto.serviceRadius,
                geoFence: createTenantDto.fence as Prisma.InputJsonValue,
              },
            }),
        );
      }

      if (createTenantDto.address || createTenantDto.fence || (createTenantDto.latitude && createTenantDto.longitude)) {
        await this.stepTrace.run(
          {
            ...baseStep,
            stepCode: 'tenant.create.syncMainStation',
            stepName: '同步租户主站点',
            safeMessage: '创建租户失败：主站点同步失败',
          },
          async () => {
            this.logger.log(`Syncing main station for tenant ${tenantId}`);
            await this.stationService.upsertMainStation(tenantId, {
              address: createTenantDto.address,
              latitude: createTenantDto.latitude,
              longitude: createTenantDto.longitude,
              fence: createTenantDto.fence,
              regionCode: createTenantDto.regionCode,
            });
          },
        );
      }

      return Result.ok();
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.logger.error('创建租户失败', error);
      const wrapped = new HttpException('创建租户失败', HttpStatus.INTERNAL_SERVER_ERROR, { cause: error });
      attachErrorContext(wrapped, {
        module: 'system-tenant',
        operationCode: 'tenant.create',
        stepCode: 'tenant.create.finalize',
        stepName: '创建租户',
        tenantId,
        safeMessage: '创建租户失败',
        technicalMessage: getErrorMessage(error),
      });
      throw wrapped;
    }
  }

  /**
   * 分页查询租户列表
   */
  @IgnoreTenant()
  async findAll(query: ListTenantDto) {
    const where: Prisma.SysTenantWhereInput = {
      delFlag: DelFlagEnum.NORMAL,
    };

    if (query.tenantId) {
      where.tenantId = {
        contains: query.tenantId,
      };
    }

    if (query.contactUserName) {
      where.contactUserName = {
        contains: query.contactUserName,
      };
    }

    if (query.contactPhone) {
      where.contactPhone = {
        contains: query.contactPhone,
      };
    }

    if (query.companyName) {
      where.companyName = {
        contains: query.companyName,
      };
    }

    if (query.status) {
      where.status = query.status as Prisma.SysTenantWhereInput['status'];
    }

    if (query.beginTime && query.endTime) {
      where.createTime = {
        gte: new Date(query.beginTime),
        lte: new Date(query.endTime),
      };
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.sysTenant.findMany({
        where,
        include: {
          settlementProfile: true,
        },
        skip: query.skip,
        take: query.take,
        orderBy: { createTime: 'desc' },
      }),
      this.prisma.sysTenant.count({ where }),
    ]);

    // 优化：使用单次查询获取所有套餐名称，避免 N+1 问题
    const packageIds = list.map((item) => item.packageId).filter(Boolean);
    const packages =
      packageIds.length > 0
        ? await this.prisma.sysTenantPackage.findMany({
            where: { packageId: { in: packageIds } },
            select: { packageId: true, packageName: true },
          })
        : [];

    const packageMap = new Map(packages.map((pkg) => [pkg.packageId, pkg.packageName]));

    // 优化：获取所有区域名称（最多显示到市或区）
    const regionCodes = list.map((item) => item.regionCode).filter(Boolean) as string[];
    const regions =
      regionCodes.length > 0
        ? await this.prisma.sysRegion.findMany({
            where: { code: { in: regionCodes } },
            select: { code: true, name: true, parentId: true, level: true },
          })
        : [];

    // 获取父级区域名称（用于拼接 "市-区" 格式）
    const parentIds = regions.map((r) => r.parentId).filter(Boolean) as string[];
    const parentRegions =
      parentIds.length > 0
        ? await this.prisma.sysRegion.findMany({
            where: { code: { in: parentIds } },
            select: { code: true, name: true },
          })
        : [];
    const parentMap = new Map(parentRegions.map((r) => [r.code, r.name]));

    // 构建区域显示名称 Map
    const regionMap = new Map(
      regions.map((r) => {
        // level 3 是区县，显示 "市-区" 格式；level 2 是市，直接显示市名
        if (r.level === 3 && r.parentId) {
          const parentName = parentMap.get(r.parentId) || '';
          return [r.code, parentName ? `${parentName}-${r.name}` : r.name];
        }
        return [r.code, r.name];
      }),
    );

    const listWithExtra = list.map((item) => ({
      ...item,
      // Convert Prisma Status enum (NORMAL/STOP) to frontend code ("0"/"1")
      status: item.status === 'NORMAL' ? '0' : '1',
      packageName: item.packageId ? packageMap.get(item.packageId) || '' : '',
      regionName: item.regionCode ? regionMap.get(item.regionCode) || item.regionCode : '',
      settlementEnabled: item.settlementProfile?.enabled ?? false,
      settlementChannel: item.settlementProfile?.defaultChannel ?? null,
      settlementReceiverType: item.settlementProfile?.receiverType ?? null,
      settlementReceiverAccount: item.settlementProfile?.receiverAccount ?? null,
      settlementReceiverName: item.settlementProfile?.receiverName ?? null,
      settlementBankName: item.settlementProfile?.bankName ?? null,
      settlementBankAccountNo: item.settlementProfile?.bankAccountNo ?? null,
      settlementNeedManualReview: item.settlementProfile?.needManualReview ?? true,
      settlementStatus: item.settlementProfile?.status ?? null,
      settlementRemark: item.settlementProfile?.remark ?? null,
    }));

    return Result.ok({
      rows: FormatDateFields(listWithExtra),
      total,
    });
  }

  /**
   * 根据ID查询租户详情
   */
  @IgnoreTenant()
  async findOne(id: number) {
    const tenant = await this.prisma.sysTenant.findUnique({
      where: { id },
      include: {
        settlementProfile: true,
      },
    });

    if (!tenant) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '租户不存在');
    }

    return Result.ok({
      ...tenant,
      settlementEnabled: tenant.settlementProfile?.enabled ?? false,
      settlementChannel: tenant.settlementProfile?.defaultChannel ?? null,
      settlementReceiverType: tenant.settlementProfile?.receiverType ?? null,
      settlementReceiverAccount: tenant.settlementProfile?.receiverAccount ?? null,
      settlementReceiverName: tenant.settlementProfile?.receiverName ?? null,
      settlementBankName: tenant.settlementProfile?.bankName ?? null,
      settlementBankAccountNo: tenant.settlementProfile?.bankAccountNo ?? null,
      settlementNeedManualReview: tenant.settlementProfile?.needManualReview ?? true,
      settlementStatus: tenant.settlementProfile?.status ?? null,
      settlementRemark: tenant.settlementProfile?.remark ?? null,
    });
  }

  /** 单实例模板：读取本店（000000）品牌配置 */
  @IgnoreTenant()
  async getShopSettings() {
    const tenant = await this.prisma.sysTenant.findFirst({
      where: { tenantId: TenantContext.SUPER_TENANT_ID, delFlag: DelFlagEnum.NORMAL },
    });
    if (!tenant) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '店铺信息不存在，请先完成初始化');
    }
    return Result.ok({
      id: tenant.id,
      tenantId: tenant.tenantId,
      companyName: tenant.companyName,
      logoUrl: tenant.logoUrl ?? '',
      themeColor: tenant.themeColor ?? '',
      contactUserName: tenant.contactUserName ?? '',
      contactPhone: tenant.contactPhone ?? '',
      userAgreement: tenant.userAgreement ?? '',
      privacyAgreement: tenant.privacyAgreement ?? '',
    });
  }

  /** 单实例模板：更新本店品牌（不含域名，域名由 fafafa 平台管理） */
  @IgnoreTenant()
  async updateShopSettings(dto: ShopSettingsDto) {
    const tenant = await this.prisma.sysTenant.findFirst({
      where: { tenantId: TenantContext.SUPER_TENANT_ID, delFlag: DelFlagEnum.NORMAL },
    });
    if (!tenant) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '店铺信息不存在，请先完成初始化');
    }
    await this.prisma.sysTenant.update({
      where: { id: tenant.id },
      data: {
        companyName: dto.companyName,
        logoUrl: dto.logoUrl || null,
        themeColor: dto.themeColor || null,
        contactUserName: dto.contactUserName || null,
        contactPhone: dto.contactPhone || null,
        userAgreement: dto.userAgreement || null,
        privacyAgreement: dto.privacyAgreement || null,
      },
    });
    return Result.ok(true);
  }

  /**
   * 更新租户
   */
  @IgnoreTenant()
  async update(updateTenantDto: UpdateTenantDto) {
    const { id, ...updateData } = updateTenantDto;

    // 检查租户是否存在
    const existTenant = await this.prisma.sysTenant.findUnique({
      where: { id },
    });

    if (!existTenant) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '租户不存在');
    }

    // 如果修改了企业名称，检查是否与其他租户重复
    if (updateData.companyName && updateData.companyName !== existTenant.companyName) {
      const duplicateName = await this.prisma.sysTenant.findFirst({
        where: {
          companyName: updateData.companyName,
          id: { not: id },
          delFlag: DelFlagEnum.NORMAL,
        },
      });

      if (duplicateName) {
        throw new BusinessException(ResponseCode.BAD_REQUEST, '企业名称已存在');
      }
    }

    const {
      contactUserName,
      contactPhone,
      companyName,
      licenseNumber,
      address,
      intro,
      domain,
      remark,
      packageId,
      expireTime,
      accountCount,
      regionCode,
      isDirect,
      status,
    } = updateData;

    await this.prisma.sysTenant.update({
      where: { id },
      data: {
        contactUserName,
        contactPhone,
        companyName,
        licenseNumber,
        address,
        intro,
        domain,
        remark,
        packageId,
        expireTime,
        accountCount,
        regionCode,
        isDirect,
        status: status as StatusEnum,
      },
    });

    await this.prisma.finTenantSettlementProfile.upsert({
      where: { tenantId: existTenant.tenantId },
      create: {
        tenantId: existTenant.tenantId,
        enabled: updateTenantDto.settlementEnabled ?? false,
        defaultChannel: updateTenantDto.settlementChannel ?? SettlementChannelType.OFFLINE_TRANSFER,
        receiverType: updateTenantDto.settlementReceiverType ?? SettlementReceiverType.TENANT,
        receiverAccount: updateTenantDto.settlementReceiverAccount,
        receiverName: updateTenantDto.settlementReceiverName,
        bankName: updateTenantDto.settlementBankName,
        bankAccountNo: updateTenantDto.settlementBankAccountNo,
        needManualReview: updateTenantDto.settlementNeedManualReview ?? true,
        status:
          updateTenantDto.settlementStatus ??
          (updateTenantDto.settlementEnabled ? SettlementProfileStatus.ACTIVE : SettlementProfileStatus.DRAFT),
        remark: updateTenantDto.settlementRemark,
      },
      update: {
        enabled: updateTenantDto.settlementEnabled,
        defaultChannel: updateTenantDto.settlementChannel,
        receiverType: updateTenantDto.settlementReceiverType,
        receiverAccount: updateTenantDto.settlementReceiverAccount,
        receiverName: updateTenantDto.settlementReceiverName,
        bankName: updateTenantDto.settlementBankName,
        bankAccountNo: updateTenantDto.settlementBankAccountNo,
        needManualReview: updateTenantDto.settlementNeedManualReview,
        status:
          updateTenantDto.settlementStatus ??
          (updateTenantDto.settlementEnabled === undefined
            ? undefined
            : updateTenantDto.settlementEnabled
              ? SettlementProfileStatus.ACTIVE
              : SettlementProfileStatus.DRAFT),
        remark: updateTenantDto.settlementRemark,
      },
    });

    // [新增] 同步更新 O2O 地理配置
    const o2oFields = ['address', 'latitude', 'longitude', 'serviceRadius', 'fence', 'regionCode'];
    const hasO2OUpdate = o2oFields.some((field) => Object.prototype.hasOwnProperty.call(updateData, field));

    if (hasO2OUpdate) {
      const tenantId = existTenant.tenantId;

      // 1. Upsert SysTenantGeo
      const geoData = {
        address: updateData.address,
        latitude: updateData.latitude,
        longitude: updateData.longitude,
        serviceRadius: updateData.serviceRadius,
        geoFence: updateData.fence as Prisma.InputJsonValue,
      };

      // Remove undefined fields
      Object.keys(geoData).forEach((key) => {
        const k = key as keyof typeof geoData;
        if (geoData[k] === undefined) delete geoData[k];
      });

      const existGeo = await this.prisma.sysTenantGeo.findFirst({
        where: this.tenantHelper.readWhereForDelegate('sysTenantGeo', { tenantId }) as Prisma.SysTenantGeoWhereInput,
      });
      if (existGeo) {
        await this.prisma.sysTenantGeo.update({
          where: { tenantId },
          data: geoData,
        });
      } else {
        await this.prisma.sysTenantGeo.create({
          data: {
            tenantId,
            ...geoData,
          },
        });
      }

      // 2. Sync to SysStation
      await this.stationService.upsertMainStation(tenantId, {
        address: updateData.address,
        latitude: updateData.latitude,
        longitude: updateData.longitude,
        fence: updateData.fence,
        regionCode: updateData.regionCode,
      });
    }

    return Result.ok();
  }

  /**
   * 批量删除租户
   */
  @IgnoreTenant()
  async remove(ids: number[]) {
    await this.prisma.sysTenant.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        delFlag: DelFlagEnum.DELETE,
      },
    });

    return Result.ok();
  }

  /**
   * 同步租户字典
   */
  @IgnoreTenant()
  @Transactional()
  async syncTenantDict() {
    this.logger.log('开始同步租户字典');

    try {
      // 获取所有非超管租户
      const tenants = await this.prisma.sysTenant.findMany({
        where: {
          status: StatusEnum.NORMAL,
          delFlag: DelFlagEnum.NORMAL,
          tenantId: { not: TenantContext.SUPER_TENANT_ID },
        },
        select: { tenantId: true, companyName: true },
      });

      this.logger.log(`找到 ${tenants.length} 个租户需要同步字典`);

      // 获取超级管理员租户的字典类型
      const dictTypes = await this.prisma.sysDictType.findMany({
        where: this.tenantHelper.readWhereForDelegate('sysDictType', {
          tenantId: TenantContext.SUPER_TENANT_ID,
          delFlag: DelFlagEnum.NORMAL,
        }) as Prisma.SysDictTypeWhereInput,
      });

      this.logger.log(`找到 ${dictTypes.length} 个字典类型需要同步`);

      let syncedCount = 0;
      let skippedCount = 0;

      // 为每个租户同步字典类型
      for (const tenant of tenants) {
        this.logger.log(`正在为租户 ${tenant.companyName}(${tenant.tenantId}) 同步字典`);

        for (const dictType of dictTypes) {
          // 检查该租户是否已有此字典类型
          const exist = await this.prisma.sysDictType.findFirst({
            where: this.tenantHelper.readWhereForDelegate('sysDictType', {
              tenantId: tenant.tenantId,
              dictType: dictType.dictType,
            }) as Prisma.SysDictTypeWhereInput,
          });

          if (!exist) {
            // 创建字典类型
            await this.prisma.sysDictType.create({
              data: {
                tenantId: tenant.tenantId,
                dictName: dictType.dictName,
                dictType: dictType.dictType,
                status: dictType.status,
                remark: dictType.remark,
                delFlag: DelFlagEnum.NORMAL,
                createBy: 'system',
                updateBy: 'system',
              },
            });

            // 获取该字典类型下的所有字典数据
            const dictDatas = await this.prisma.sysDictData.findMany({
              where: this.tenantHelper.readWhereForDelegate('sysDictData', {
                tenantId: TenantContext.SUPER_TENANT_ID,
                dictType: dictType.dictType,
                delFlag: DelFlagEnum.NORMAL,
              }) as Prisma.SysDictDataWhereInput,
            });

            // 为该租户创建字典数据（使用 createMany 跳过已存在的记录）
            if (dictDatas.length > 0) {
              try {
                await this.prisma.sysDictData.createMany({
                  data: dictDatas.map((dictData) => ({
                    tenantId: tenant.tenantId,
                    dictSort: dictData.dictSort,
                    dictLabel: dictData.dictLabel,
                    dictValue: dictData.dictValue,
                    dictType: dictData.dictType,
                    cssClass: dictData.cssClass,
                    listClass: dictData.listClass,
                    isDefault: dictData.isDefault,
                    status: dictData.status,
                    remark: dictData.remark,
                    delFlag: DelFlagEnum.NORMAL,
                    createBy: 'system',
                    updateBy: 'system',
                  })),
                  skipDuplicates: true, // 跳过重复记录
                });
              } catch (dataError) {
                this.logger.warn(`为租户 ${tenant.tenantId} 同步字典数据时出错: ${getErrorMessage(dataError)}`);
              }
            }

            syncedCount++;
          } else {
            skippedCount++;
          }
        }
      }

      this.logger.log(`字典同步完成: 新增 ${syncedCount} 个，跳过 ${skippedCount} 个`);

      return Result.ok({
        message: `同步完成`,
        detail: {
          tenants: tenants.length,
          synced: syncedCount,
          skipped: skippedCount,
        },
      });
    } catch (error) {
      this.logger.error('同步租户字典失败:', error);
      throw new HttpException(`同步租户字典失败: ${getErrorMessage(error)}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 同步租户套餐
   */
  @IgnoreTenant()
  @Transactional()
  async syncTenantPackage(params: SyncTenantPackageDto) {
    const tenantId = params.tenantId?.trim() || '';
    const packageId = Number(params.packageId);
    const baseStep = {
      module: 'system-tenant',
      operationCode: 'tenant.syncPackage',
      tenantId,
      metadata: { tenantId, packageId },
    };

    try {
      await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.validateInput',
          stepName: '校验租户套餐同步参数',
          safeMessage: '同步租户套餐失败：参数不合法',
        },
        async () => {
          if (!tenantId || tenantId === TenantContext.SUPER_TENANT_ID) {
            throw new BusinessException(ResponseCode.BAD_REQUEST, '租户ID不合法');
          }

          if (!Number.isInteger(packageId) || packageId <= 0) {
            throw new BusinessException(ResponseCode.BAD_REQUEST, '租户套餐ID不合法');
          }
        },
      );

      const tenant = await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.loadTenant',
          stepName: '查询租户信息',
          safeMessage: '同步租户套餐失败：租户不存在或查询失败',
        },
        async () => {
          const found = await this.prisma.sysTenant.findUnique({
            where: { tenantId },
          });
          if (!found) {
            throw new BusinessException(ResponseCode.NOT_FOUND, '租户不存在');
          }
          return found;
        },
      );

      const tenantPackage = await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.loadPackage',
          stepName: '查询租户套餐',
          safeMessage: '同步租户套餐失败：套餐不存在或查询失败',
        },
        async () => {
          const found = await this.prisma.sysTenantPackage.findFirst({
            where: {
              packageId,
              status: StatusEnum.NORMAL,
              delFlag: DelFlagEnum.NORMAL,
            },
          });
          if (!found) {
            throw new BusinessException(ResponseCode.NOT_FOUND, '租户套餐不存在');
          }
          return found;
        },
      );

      await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.updateTenantPackage',
          stepName: '更新租户套餐编号',
          safeMessage: '同步租户套餐失败：租户套餐更新失败',
        },
        async () =>
          this.prisma.sysTenant.update({
            where: { tenantId },
            data: { packageId },
          }),
      );

      const platformMenuIds = parsePackageMenuIds(tenantPackage.menuIds);
      const tenantMenuIds = await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.syncMenus',
          stepName: '同步套餐菜单',
          safeMessage: '同步租户套餐失败：菜单同步失败',
          metadata: { tenantId, packageId, platformMenuCount: platformMenuIds.length },
        },
        async () =>
          syncTenantMenusFromPackage(this.prisma, tenantId, platformMenuIds, {
            operator: SYSTEM_OPERATOR,
            onWarn: (message) => this.logger.warn(message),
          }),
      );
      const rootDept = await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.ensureRootDept',
          stepName: '维护租户根部门',
          safeMessage: '同步租户套餐失败：根部门维护失败',
        },
        async () => this.ensureTenantRootDept(tenant),
      );
      const adminUser = await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.ensureAdminUser',
          stepName: '维护租户管理员',
          safeMessage: '同步租户套餐失败：管理员维护失败',
          metadata: { tenantId, rootDeptId: rootDept.deptId },
        },
        async () => this.ensureTenantAdminUser(tenant, rootDept.deptId),
      );
      const adminRole = await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.ensureAdminRole',
          stepName: '维护租户管理员角色',
          safeMessage: '同步租户套餐失败：管理员角色维护失败',
          metadata: { tenantId, packageId },
        },
        async () => this.ensureTenantAdminRole(tenantId, tenantPackage),
      );

      await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.bindRoleMenus',
          stepName: '绑定管理员角色菜单',
          safeMessage: '同步租户套餐失败：角色菜单绑定失败',
          metadata: { tenantId, roleId: adminRole.roleId, menuCount: tenantMenuIds.length },
        },
        async () => syncTenantAdminRoleMenus(this.prisma, adminRole.roleId, tenantMenuIds),
      );
      await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.bindAdminRole',
          stepName: '绑定管理员角色',
          safeMessage: '同步租户套餐失败：管理员角色绑定失败',
          metadata: { tenantId, userId: adminUser.userId, roleId: adminRole.roleId },
        },
        async () => this.bindTenantAdminRole(adminUser.userId, adminRole.roleId),
      );
      await this.stepTrace.run(
        {
          ...baseStep,
          stepCode: 'tenant.syncPackage.clearAdminCache',
          stepName: '清理租户管理员缓存',
          safeMessage: '同步租户套餐失败：缓存清理失败',
          metadata: { tenantId, userId: adminUser.userId },
        },
        async () => this.clearTenantAdminCaches(tenantId, adminUser.userId),
      );

      return Result.ok();
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.logger.error('同步租户套餐失败', error);
      const wrapped = new HttpException('同步租户套餐失败', HttpStatus.INTERNAL_SERVER_ERROR, { cause: error });
      attachErrorContext(wrapped, {
        module: 'system-tenant',
        operationCode: 'tenant.syncPackage',
        stepCode: 'tenant.syncPackage.finalize',
        stepName: '同步租户套餐',
        tenantId,
        safeMessage: '同步租户套餐失败',
        technicalMessage: getErrorMessage(error),
      });
      throw wrapped;
    }
  }

  private async ensureTenantRootDept(tenant: SysTenant): Promise<SysDept> {
    const existingDept = await this.prisma.sysDept.findFirst({
      where: {
        tenantId: tenant.tenantId,
        parentId: 0,
        delFlag: DelFlagEnum.NORMAL,
      },
      orderBy: { deptId: 'asc' },
    });

    if (existingDept) {
      return existingDept;
    }

    return await this.prisma.sysDept.create({
      data: {
        tenantId: tenant.tenantId,
        parentId: 0,
        ancestors: '0',
        deptName: this.truncateText(tenant.companyName, 30),
        orderNum: 0,
        leader: this.truncateText(tenant.contactUserName ?? '', 20),
        phone: this.truncateText(tenant.contactPhone ?? '', 11),
        email: '',
        status: StatusEnum.NORMAL,
        delFlag: DelFlagEnum.NORMAL,
        createBy: SYSTEM_OPERATOR,
        updateBy: SYSTEM_OPERATOR,
        remark: '租户套餐同步自动创建的根部门',
      },
    });
  }

  private async ensureTenantAdminUser(tenant: SysTenant, deptId: number): Promise<SysUser> {
    const adminUser = await this.prisma.sysUser.findFirst({
      where: {
        tenantId: tenant.tenantId,
        userType: SYS_USER_TYPE.SYS,
        delFlag: DelFlagEnum.NORMAL,
      },
      orderBy: { createTime: 'asc' },
    });

    if (!adminUser) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '租户管理员不存在');
    }

    const nickName = this.truncateText(tenant.contactUserName || adminUser.nickName || '租户管理员', 30);
    const phonenumber = this.truncateText(tenant.contactPhone ?? '', 11);

    return await this.prisma.sysUser.update({
      where: { userId: adminUser.userId },
      data: {
        deptId,
        nickName,
        phonenumber,
        updateBy: SYSTEM_OPERATOR,
      },
    });
  }

  private async ensureTenantAdminRole(tenantId: string, tenantPackage: SysTenantPackage): Promise<SysRole> {
    const roleName = this.resolveTenantAdminRoleName(tenantPackage.packageName);
    const existingRole = await this.prisma.sysRole.findFirst({
      where: {
        tenantId,
        roleKey: TENANT_ADMIN_ROLE_KEY,
        delFlag: DelFlagEnum.NORMAL,
      },
      orderBy: { roleId: 'asc' },
    });

    const roleData = {
      roleName,
      roleSort: 1,
      dataScope: DataScopeEnum.DATA_SCOPE_ALL,
      menuCheckStrictly: tenantPackage.menuCheckStrictly,
      deptCheckStrictly: false,
      status: StatusEnum.NORMAL,
      updateBy: SYSTEM_OPERATOR,
      remark: '租户套餐同步自动维护的管理员角色',
    };

    if (existingRole) {
      return await this.prisma.sysRole.update({
        where: { roleId: existingRole.roleId },
        data: roleData,
      });
    }

    return await this.prisma.sysRole.create({
      data: {
        tenantId,
        roleKey: TENANT_ADMIN_ROLE_KEY,
        createBy: SYSTEM_OPERATOR,
        delFlag: DelFlagEnum.NORMAL,
        ...roleData,
      },
    });
  }

  private async bindTenantAdminRole(userId: number, roleId: number): Promise<void> {
    await this.prisma.sysUserRole.createMany({
      data: [{ userId, roleId }],
      skipDuplicates: true,
    });
  }

  private async clearTenantAdminCaches(tenantId: string, userId: number): Promise<void> {
    await this.redisService.del([
      `${CacheEnum.SYS_MENU_KEY}${tenantId}:user:${userId}`,
      `${CacheEnum.SYS_USER_KEY}${tenantId}:${userId}`,
      `${CacheEnum.SYS_USER_KEY}${tenantId}:permissions:${userId}`,
    ]);
  }

  private resolveTenantAdminRoleName(packageName: string): string {
    return this.truncateText(packageName.includes('城市代理') ? '城市代理管理员' : '租户管理员', 30);
  }

  private truncateText(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  /**
   * 同步租户参数配置
   */
  @IgnoreTenant()
  async syncTenantConfig() {
    this.logger.log('开始同步租户参数配置');

    try {
      // 获取所有非超管租户
      const tenants = await this.prisma.sysTenant.findMany({
        where: {
          status: StatusEnum.NORMAL,
          delFlag: DelFlagEnum.NORMAL,
          tenantId: { not: TenantContext.SUPER_TENANT_ID },
        },
        select: { tenantId: true, companyName: true },
      });

      this.logger.log(`找到 ${tenants.length} 个租户需要同步配置`);

      // 获取超级管理员租户的配置
      const configs = await this.prisma.sysConfig.findMany({
        where: this.tenantHelper.readWhereForDelegate('sysConfig', {
          tenantId: TenantContext.SUPER_TENANT_ID,
          delFlag: DelFlagEnum.NORMAL,
        }) as Prisma.SysConfigWhereInput,
      });

      this.logger.log(`找到 ${configs.length} 个配置项需要同步`);

      let syncedCount = 0;
      const skippedCount = 0;

      // 为每个租户同步配置（使用批量操作）
      for (const tenant of tenants) {
        this.logger.log(`正在为租户 ${tenant.companyName}(${tenant.tenantId}) 同步配置`);

        // 批量创建配置（跳过已存在的）
        try {
          const result = await this.prisma.sysConfig.createMany({
            data: configs.map((config) => ({
              tenantId: tenant.tenantId,
              configName: config.configName,
              configKey: config.configKey,
              configValue: config.configValue,
              configType: config.configType,
              remark: config.remark,
              delFlag: DelFlagEnum.NORMAL,
              createBy: 'system',
              updateBy: 'system',
            })),
            skipDuplicates: true,
          });

          syncedCount += result.count;
        } catch (configError) {
          this.logger.warn(`为租户 ${tenant.tenantId} 同步配置时出错: ${getErrorMessage(configError)}`);
        }

        // 清除租户配置缓存
        await this.redisService.del(`${CacheEnum.SYS_CONFIG_KEY}${tenant.tenantId}`);
      }

      this.logger.log(`配置同步完成: 新增 ${syncedCount} 个，跳过 ${skippedCount} 个`);

      return Result.ok({
        message: '同步完成',
        detail: {
          tenants: tenants.length,
          synced: syncedCount,
          skipped: skippedCount,
        },
      });
    } catch (error) {
      this.logger.error('同步租户配置失败:', error);
      throw new HttpException(`同步租户配置失败: ${getErrorMessage(error)}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 导出租户数据
   */
  @IgnoreTenant()
  async export(res: Response, body: ListTenantDto) {
    delete body.pageNum;
    delete body.pageSize;
    const list = await this.findAll(body);
    const options = {
      sheetName: '租户数据',
      data: list.data.rows,
      header: [
        { title: '租户编号', dataIndex: 'tenantId' },
        { title: '企业名称', dataIndex: 'companyName' },
        { title: '联系人', dataIndex: 'contactUserName' },
        { title: '联系电话', dataIndex: 'contactPhone' },
        { title: '统一社会信用代码', dataIndex: 'licenseNumber' },
        { title: '地址', dataIndex: 'address' },
        { title: '套餐名称', dataIndex: 'packageName' },
        { title: '过期时间', dataIndex: 'expireTime' },
        { title: '账号数量', dataIndex: 'accountCount' },
        { title: '状态', dataIndex: 'status' },
        { title: '创建时间', dataIndex: 'createTime' },
      ],
    };
    return await ExportTable(options, res);
  }
  /**
   * 动态切换租户
   */
  @IgnoreTenant()
  async dynamicTenant(tenantId: string, user: UserType['user']) {
    if (user.userId !== 1) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '只有超级管理员才能切换租户');
    }

    const tenant = await this.prisma.sysTenant.findFirst({
      where: { tenantId },
    });

    if (!tenant) {
      throw new BusinessException(ResponseCode.NOT_FOUND, '租户不存在');
    }

    return this.switchTenantContext(user, tenantId);
  }

  @IgnoreTenant()
  async clearDynamicTenant(user: UserType['user']) {
    if (user.userId !== 1) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '只有超级管理员才能切换租户');
    }
    // Switch back to default tenant 000000
    return this.switchTenantContext(user, TenantContext.SUPER_TENANT_ID);
  }

  private async switchTenantContext(user: UserType['user'], targetTenantId: string) {
    const uuid = GenerateUUID();

    // Explicitly cast to UserType['user'] to avoid implicit any errors
    const newUserObj = {
      ...user,
      tenantId: targetTenantId,
      deptId: null,
      dept: null,
      roles: [],
      posts: [],
    } as unknown as UserType['user'];

    const redisUser: Partial<UserType> = {
      userId: user.userId,
      userName: user.userName,
      deptId: 0, // Use 0 or appropriate number for null deptId
      token: uuid,
      user: newUserObj,
      roles: ['admin'],
      permissions: ['*:*:*'],
    };

    await this.userAuthService.updateRedisToken(uuid, redisUser);

    const token = this.userAuthService.createToken({ uuid, userId: user.userId });

    return Result.ok(token);
  }
}
