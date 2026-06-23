import { Controller, Get, Post, Put, Delete, Body, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { DistributionService } from './distribution.service';
import { DashboardService } from './services/dashboard.service';
import { LevelService } from './services/level.service';
import { ApplicationService } from './services/application.service';
import { UpdateDistConfigDto } from './dto/update-dist-config.dto';
import { CommissionPreviewDto, CommissionPreviewVo } from './dto/commission-preview.dto';
import { ListConfigLogsDto } from './dto/list-config-logs.dto';
import { GetDashboardDto } from './dto/get-dashboard.dto';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { ListLevelDto } from './dto/list-level.dto';
import { StoreUpdateMemberLevelDto } from './dto/update-member-level.dto';
import { ListMemberLevelLogDto } from './dto/list-member-level-log.dto';
import { ListApplicationDto } from './dto/list-application.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { BatchReviewDto } from './dto/batch-review.dto';
import { UpdateReviewConfigDto } from './dto/update-review-config.dto';
import { UpdateSharePolicyDto } from './dto/update-share-policy.dto';
import { CreateShareTokenDto } from './dto/create-share-token.dto';
import { GenerateShareTokenQrcodeDto } from './dto/generate-share-token-qrcode.dto';
import { ListShareTokenLogDto } from './dto/list-share-token-log.dto';
import { DistConfigVo, DistConfigLogVo } from './vo/dist-config.vo';
import { DashboardVo } from './vo/dashboard.vo';
import { LevelVo, MemberLevelLogVo } from './vo/level.vo';
import { LevelCheckVo } from './vo/level-check.vo';
import { ApplicationVo, ReviewConfigVo } from './vo/application.vo';
import { SharePolicyVo } from './vo/share-policy.vo';
import { ShareTokenLogVo } from './vo/share-token-log.vo';
import { ShareTokenQrcodeVo, ShareTokenVo } from './vo/share-token.vo';
import { CurrentTenant } from 'src/common/tenant/tenant.decorator';
import { ClientInfo, ClientInfoDto } from 'src/common/decorators/common.decorator';
import { Result } from 'src/common/response';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { SharePolicyService } from './services/share-policy.service';
import { ShareTokenService } from './services/share-token.service';

/**
 * 权限码为唯一事实源；种子菜单 `perms` 须与本 Controller 字符串一致。
 * 前缀 store:distribution，子域：config / commission / product / dashboard / level / member-level / application。
 */
@ApiTags('分销规则配置')
@Controller('store/distribution')
export class DistributionController {
  constructor(
    private readonly distributionService: DistributionService,
    private readonly dashboardService: DashboardService,
    private readonly levelService: LevelService,
    private readonly applicationService: ApplicationService,
    private readonly sharePolicyService: SharePolicyService,
    private readonly shareTokenService: ShareTokenService,
  ) {}

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:config:query')
  @Get('config')
  @Api({ summary: '获取分销规则配置', type: DistConfigVo })
  async getConfig(@CurrentTenant() tenantId: string) {
    return this.distributionService.getConfig(tenantId);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:config:edit')
  @Post('config')
  @Api({ summary: '更新分销规则配置' })
  async updateConfig(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateDistConfigDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.distributionService.updateConfig(tenantId, dto, clientInfo.userName || 'system');
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:config:query')
  @Get('config/logs')
  @Api({ summary: '获取分销规则变更历史', type: DistConfigLogVo, isArray: true })
  async getConfigLogs(@CurrentTenant() tenantId: string, @Query() query: ListConfigLogsDto) {
    return this.distributionService.getConfigLogs(tenantId, query);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:commission:preview')
  @Post('commission/preview')
  @Api({ summary: '佣金预估 (前端提示用)', type: CommissionPreviewVo })
  async getCommissionPreview(@Body() dto: CommissionPreviewDto) {
    return this.distributionService.getCommissionPreview(dto);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:share:policy:query')
  @Get('share-policy')
  @Api({ summary: '获取分销分享策略', type: SharePolicyVo })
  async getSharePolicy(@CurrentTenant() tenantId: string) {
    return this.sharePolicyService.getPolicy(tenantId);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:share:policy:edit')
  @Post('share-policy')
  @Api({ summary: '更新分销分享策略', type: SharePolicyVo })
  async updateSharePolicy(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateSharePolicyDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.sharePolicyService.updatePolicy(tenantId, dto, clientInfo.userName || 'system');
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:share:token:create')
  @Post('share-token')
  @Api({ summary: '生成分销分享凭证', type: ShareTokenVo })
  async createShareToken(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateShareTokenDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.shareTokenService.createTokenForAdmin(tenantId, dto, clientInfo.userName || 'system');
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:share:token:create')
  @Post('share-token/qrcode')
  @Api({ summary: '生成分销分享小程序码', type: ShareTokenQrcodeVo })
  async createShareTokenQrcode(
    @CurrentTenant() tenantId: string,
    @Body() dto: GenerateShareTokenQrcodeDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.shareTokenService.generateShareTokenQrcode(tenantId, dto, clientInfo.userName || 'system');
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:share:token:query')
  @Get('share-token/logs')
  @Api({ summary: '查询分销分享事件日志', type: ShareTokenLogVo, isArray: true })
  async getShareTokenLogs(@CurrentTenant() tenantId: string, @Query() query: ListShareTokenLogDto) {
    return this.shareTokenService.listTokenLogs(tenantId, query);
  }

  // ==================== 分销数据看板 ====================

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:dashboard:query')
  @Get('dashboard')
  @Api({ summary: '获取分销数据看板', type: DashboardVo })
  async getDashboard(@CurrentTenant() tenantId: string, @Query() query: GetDashboardDto) {
    return this.dashboardService.getDashboard(tenantId, query);
  }

  // ==================== 分销员等级体系 ====================

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:level:create')
  @Post('level')
  @Api({ summary: '创建等级配置', type: LevelVo })
  async createLevel(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateLevelDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    const vo = await this.levelService.create(tenantId, dto, clientInfo.userName || 'system');
    return Result.ok(vo);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:level:update')
  @Put('level/:id')
  @Api({ summary: '更新等级配置', type: LevelVo })
  async updateLevel(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLevelDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    const vo = await this.levelService.update(tenantId, id, dto, clientInfo.userName || 'system');
    return Result.ok(vo);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:level:delete')
  @Delete('level/:id')
  @Api({ summary: '删除等级配置' })
  async deleteLevel(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseIntPipe) id: number,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    await this.levelService.delete(tenantId, id, clientInfo.userName || 'system');
    return Result.ok(null, '删除成功');
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:level:list')
  @Get('level/list')
  @Api({ summary: '查询等级列表', type: LevelVo, isArray: true })
  async getLevelList(@CurrentTenant() tenantId: string, @Query() query: ListLevelDto) {
    const levels = await this.levelService.findAll(tenantId, query);
    return Result.ok({ rows: levels, total: levels.length });
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:level:query')
  @Get('level/:id')
  @Api({ summary: '查询等级详情', type: LevelVo })
  async getLevel(@CurrentTenant() tenantId: string, @Param('id', ParseIntPipe) id: number) {
    const vo = await this.levelService.findOne(tenantId, id);
    return Result.ok(vo);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:member-level:edit')
  @Post('member-level')
  @Api({ summary: '手动调整会员等级' })
  async updateMemberLevel(
    @CurrentTenant() tenantId: string,
    @Body() dto: StoreUpdateMemberLevelDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    await this.levelService.updateMemberLevel(tenantId, dto, clientInfo.userName || 'system');
    return Result.ok(null, '等级已调整');
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:member-level:query')
  @Get('member-level/logs')
  @Api({ summary: '查询会员等级变更日志', type: MemberLevelLogVo, isArray: true })
  async getMemberLevelLogs(@CurrentTenant() tenantId: string, @Query() query: ListMemberLevelLogDto) {
    const page = await this.levelService.getMemberLevelLogs(tenantId, query);
    return Result.ok(page);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:member-level:query')
  @Get('level/check/:memberId')
  @Api({ summary: '检查会员升级条件', type: LevelCheckVo })
  async checkLevelUpgrade(@CurrentTenant() tenantId: string, @Param('memberId') memberId: string) {
    const vo = await this.levelService.checkUpgradeEligibility(tenantId, memberId);
    return Result.ok(vo);
  }

  // ==================== 分销员申请/审核 ====================

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:application:list')
  @Get('application/list')
  @Api({ summary: '查询申请列表（管理端）', type: ApplicationVo, isArray: true })
  async listApplications(@CurrentTenant() tenantId: string, @Query() query: ListApplicationDto) {
    return this.applicationService.listApplications(tenantId, query);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:application:review')
  @Post('application/:id/review')
  @Api({ summary: '审核申请（管理端）' })
  async reviewApplication(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewApplicationDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.applicationService.reviewApplication(tenantId, id, dto, clientInfo.userName || 'system');
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:application:review')
  @Post('application/batch-review')
  @Api({ summary: '批量审核（管理端）' })
  async batchReview(
    @CurrentTenant() tenantId: string,
    @Body() dto: BatchReviewDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.applicationService.batchReview(tenantId, dto, clientInfo.userName || 'system');
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:application:config:query')
  @Get('application/config')
  @Api({ summary: '获取审核配置（管理端）', type: ReviewConfigVo })
  async getReviewConfig(@CurrentTenant() tenantId: string) {
    return this.applicationService.getReviewConfig(tenantId);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @RequirePermission('store:distribution:application:config:edit')
  @Put('application/config')
  @Api({ summary: '更新审核配置（管理端）' })
  async updateReviewConfig(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateReviewConfigDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.applicationService.updateReviewConfig(tenantId, dto, clientInfo.userName || 'system');
  }
}
