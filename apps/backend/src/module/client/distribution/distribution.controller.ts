import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { CurrentTenant } from 'src/common/tenant/tenant.decorator';
import { Member } from '../common/decorators/member.decorator';
import { MemberAuthGuard } from '../common/guards/member-auth.guard';
import { CreateShareTokenDto } from './dto/create-share-token.dto';
import { ResolveShareTokenDto } from './dto/resolve-share-token.dto';
import { TrackShareEventDto } from './dto/track-share-event.dto';
import { GenerateShareTokenQrcodeDto } from 'src/module/store/distribution/dto/generate-share-token-qrcode.dto';
import { ShareTokenService } from 'src/module/store/distribution/services/share-token.service';
import { ShareTokenQrcodeVo, ShareTokenVo } from 'src/module/store/distribution/vo/share-token.vo';
import {
  ListMyEvidenceDto,
  ListPendingRewardDto,
  SubmitQualificationApplicationDto,
} from 'src/module/store/distribution/qualification/dto/qualification.dto';
import { DistributionQualificationService } from 'src/module/store/distribution/qualification/qualification.service';
import {
  DistributionCapabilityVo,
  PendingRewardVo,
  QualificationApplicationVo,
  QualificationEvidenceVo,
} from 'src/module/store/distribution/qualification/vo/qualification.vo';

@ApiTags('C端-分销分享')
@Controller('client/distribution')
export class ClientDistributionController {
  constructor(
    private readonly shareTokenService: ShareTokenService,
    private readonly qualificationService: DistributionQualificationService,
  ) {}

  @UseGuards(MemberAuthGuard)
  @Post('share-token')
  @Api({ summary: '创建分销分享凭证', type: ShareTokenVo })
  async createShareToken(@Member('memberId') memberId: string, @Body() dto: CreateShareTokenDto) {
    return this.shareTokenService.createTokenForClient(memberId, dto);
  }

  @UseGuards(MemberAuthGuard)
  @Post('share-token/qrcode')
  @Api({ summary: '生成分销分享小程序码', type: ShareTokenQrcodeVo })
  async createShareTokenQrcode(
    @CurrentTenant() tenantId: string,
    @Member('memberId') memberId: string,
    @Body() dto: GenerateShareTokenQrcodeDto,
  ) {
    return this.shareTokenService.generateShareTokenQrcode(tenantId, dto, memberId);
  }

  @Get('share/resolve')
  @Api({ summary: '解析分销分享凭证' })
  async resolveShareToken(@Query() query: ResolveShareTokenDto) {
    return this.shareTokenService.resolveForClient(query.sid);
  }

  @UseGuards(MemberAuthGuard)
  @Post('share/event')
  @Api({ summary: '上报分销分享事件' })
  async trackShareEvent(
    @CurrentTenant() tenantId: string,
    @Member('memberId') memberId: string,
    @Body() dto: TrackShareEventDto,
  ) {
    return this.shareTokenService.trackClientEvent(tenantId, memberId, dto);
  }

  @UseGuards(MemberAuthGuard)
  @Get('capability')
  @Api({ summary: '查询我的分销资格能力', type: DistributionCapabilityVo })
  async getCapability(@CurrentTenant() tenantId: string, @Member('memberId') memberId: string) {
    return Result.ok(await this.qualificationService.getCapability(tenantId, memberId));
  }

  @UseGuards(MemberAuthGuard)
  @Get('evidence')
  @Api({ summary: '查询我的分销资格材料', type: QualificationEvidenceVo, isArray: true, isPager: true })
  async listMyEvidence(
    @CurrentTenant() tenantId: string,
    @Member('memberId') memberId: string,
    @Query() query: ListMyEvidenceDto,
  ) {
    return this.qualificationService.listMyEvidence(tenantId, memberId, query);
  }

  @UseGuards(MemberAuthGuard)
  @Get('application')
  @Api({ summary: '查询我的最近一次分销资格申请', type: QualificationApplicationVo })
  async getLatestApplication(@CurrentTenant() tenantId: string, @Member('memberId') memberId: string) {
    return this.qualificationService.getLatestApplication(tenantId, memberId);
  }

  @UseGuards(MemberAuthGuard)
  @Post('application')
  @Api({ summary: '提交分销资格申请', type: QualificationApplicationVo })
  async submitApplication(
    @CurrentTenant() tenantId: string,
    @Member('memberId') memberId: string,
    @Body() dto: SubmitQualificationApplicationDto,
  ) {
    return this.qualificationService.submitApplication(tenantId, memberId, dto);
  }

  @UseGuards(MemberAuthGuard)
  @Get('pending-rewards')
  @Api({ summary: '查询我的待激活分销收益', type: PendingRewardVo, isArray: true, isPager: true })
  async listMyPendingRewards(
    @CurrentTenant() tenantId: string,
    @Member('memberId') memberId: string,
    @Query() query: ListPendingRewardDto,
  ) {
    return this.qualificationService.listMyPendingRewards(tenantId, memberId, query);
  }
}
