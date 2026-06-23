import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { ClientInfo, ClientInfoDto } from 'src/common/decorators/common.decorator';
import { Result } from 'src/common/response';
import { CurrentTenant } from 'src/common/tenant/tenant.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import {
  ListDistributionRelationDto,
  ListDistributorProfileDto,
  ListEvidenceDto,
  ListPendingRewardDto,
  ListQualificationApplicationDto,
  ListQualificationRuleDto,
  ListServicePolicyDto,
  ReviewQualificationApplicationDto,
  UpdateProfileStatusDto,
  UpsertQualificationRuleDto,
  UpsertServicePolicyDto,
} from './dto/qualification.dto';
import { DistributionQualificationService } from './qualification.service';
import {
  DistributionCapabilityVo,
  DistributionRelationVo,
  DistributorProfileVo,
  PendingRewardVo,
  QualificationApplicationVo,
  QualificationEvidenceVo,
  QualificationRuleVo,
  QualificationServicePolicyVo,
} from './vo/qualification.vo';

@ApiTags('分销资格治理')
@Controller('store/distribution/qualification')
export class DistributionQualificationController {
  constructor(private readonly qualificationService: DistributionQualificationService) {}

  @RequirePermission('store:distribution:config:query')
  @Get('capability')
  @Api({ summary: '查询会员分销资格能力', type: DistributionCapabilityVo })
  async getCapability(@CurrentTenant() tenantId: string, @Query('memberId') memberId: string) {
    const capability = await this.qualificationService.getCapability(tenantId, memberId);
    return Result.ok(capability);
  }

  @RequirePermission('store:distribution:config:query')
  @Get('service-policies')
  @Api({ summary: '查询服务分销策略', type: QualificationServicePolicyVo, isArray: true, isPager: true })
  async listServicePolicies(@CurrentTenant() tenantId: string, @Query() query: ListServicePolicyDto) {
    return this.qualificationService.listServicePolicies(tenantId, query);
  }

  @RequirePermission('store:distribution:config:edit')
  @Post('service-policies')
  @Api({ summary: '保存服务分销策略', type: QualificationServicePolicyVo })
  async createServicePolicy(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpsertServicePolicyDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.qualificationService.createServicePolicy(tenantId, dto, clientInfo.userName || 'system');
  }

  @RequirePermission('store:distribution:config:edit')
  @Put('service-policies/:id')
  @Api({ summary: '更新服务分销策略', type: QualificationServicePolicyVo })
  async updateServicePolicy(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertServicePolicyDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.qualificationService.updateServicePolicy(tenantId, id, dto, clientInfo.userName || 'system');
  }

  @RequirePermission('store:distribution:config:query')
  @Get('rules')
  @Api({ summary: '查询分销资格规则', type: QualificationRuleVo, isArray: true, isPager: true })
  async listRules(@CurrentTenant() tenantId: string, @Query() query: ListQualificationRuleDto) {
    return this.qualificationService.listRules(tenantId, query);
  }

  @RequirePermission('store:distribution:config:edit')
  @Post('rules')
  @Api({ summary: '保存分销资格规则', type: QualificationRuleVo })
  async createRule(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpsertQualificationRuleDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.qualificationService.createRule(tenantId, dto, clientInfo.userName || 'system');
  }

  @RequirePermission('store:distribution:config:edit')
  @Put('rules/:id')
  @Api({ summary: '更新分销资格规则', type: QualificationRuleVo })
  async updateRule(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertQualificationRuleDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.qualificationService.updateRule(tenantId, id, dto, clientInfo.userName || 'system');
  }

  @RequirePermission('store:distribution:application:list')
  @Get('evidence')
  @Api({ summary: '查询分销资格材料', type: QualificationEvidenceVo, isArray: true, isPager: true })
  async listEvidence(@CurrentTenant() tenantId: string, @Query() query: ListEvidenceDto) {
    return this.qualificationService.listEvidence(tenantId, query);
  }

  @RequirePermission('store:distribution:application:list')
  @Get('applications')
  @Api({ summary: '查询分销资格申请', type: QualificationApplicationVo, isArray: true, isPager: true })
  async listApplications(@CurrentTenant() tenantId: string, @Query() query: ListQualificationApplicationDto) {
    return this.qualificationService.listApplications(tenantId, query);
  }

  @RequirePermission('store:distribution:application:review')
  @Post('applications/:id/review')
  @Api({ summary: '审核分销资格申请', type: QualificationApplicationVo })
  async reviewApplication(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ReviewQualificationApplicationDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.qualificationService.reviewApplication(tenantId, id, dto, clientInfo.userName || 'system');
  }

  @RequirePermission('store:distribution:member-level:query')
  @Get('profiles')
  @Api({ summary: '查询分销资格档案', type: DistributorProfileVo, isArray: true, isPager: true })
  async listProfiles(@CurrentTenant() tenantId: string, @Query() query: ListDistributorProfileDto) {
    return this.qualificationService.listProfiles(tenantId, query);
  }

  @RequirePermission('store:distribution:member-level:edit')
  @Post('profiles/:id/freeze')
  @Api({ summary: '冻结分销资格档案', type: DistributorProfileVo })
  async freezeProfile(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProfileStatusDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.qualificationService.freezeProfile(tenantId, id, dto, clientInfo.userName || 'system');
  }

  @RequirePermission('store:distribution:member-level:edit')
  @Post('profiles/:id/revoke')
  @Api({ summary: '撤销分销资格档案', type: DistributorProfileVo })
  async revokeProfile(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProfileStatusDto,
    @ClientInfo() clientInfo: ClientInfoDto,
  ) {
    return this.qualificationService.revokeProfile(tenantId, id, dto, clientInfo.userName || 'system');
  }

  @RequirePermission('store:distribution:member-level:query')
  @Get('relations')
  @Api({ summary: '查询分销团队关系', type: DistributionRelationVo, isArray: true, isPager: true })
  async listRelations(@CurrentTenant() tenantId: string, @Query() query: ListDistributionRelationDto) {
    return this.qualificationService.listRelations(tenantId, query);
  }

  @RequirePermission('store:distribution:commission:query')
  @Get('pending-rewards')
  @Api({ summary: '查询普通用户待激活收益', type: PendingRewardVo, isArray: true, isPager: true })
  async listPendingRewards(@CurrentTenant() tenantId: string, @Query() query: ListPendingRewardDto) {
    return this.qualificationService.listPendingRewards(tenantId, query);
  }
}
