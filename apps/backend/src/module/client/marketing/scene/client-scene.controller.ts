import { Controller, Get, Headers, Logger, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MktCampaignStatus } from '@prisma/client';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { OptionalMemberAuthGuard } from 'src/module/client/common/guards/optional-member-auth.guard';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { ClientSceneService } from './client-scene.service';
import { UserMarketingContext } from 'src/module/marketing/resolution/dto/user-marketing-context.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClientSceneViewVo } from './vo/client-scene.vo';

/**
 * C 端场景出数入口，对应 miniapp-client/src/api/marketing.ts 与 useSceneMarketing。
 * clientVersion/platform/appBuild/deviceHashDigest 只用于灰度解释和排障，设备字段必须是摘要而非原始标识。
 *
 * @tenantScope TenantScoped
 * @sloCategory client
 * @sloLatency P99 < 500ms
 */
@ApiTags('C端-营销场景')
@ApiBearerAuth()
@UseGuards(OptionalMemberAuthGuard)
@Controller('client/marketing/scene')
export class ClientSceneController {
  private readonly logger = new Logger(ClientSceneController.name);

  constructor(
    private readonly service: ClientSceneService,
    private readonly prisma: PrismaService,
  ) {}

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':sceneCode/modules')
  @Api({
    summary: '获取场景模块列表',
    type: ClientSceneViewVo,
    queries: [
      { name: 'channel', description: '请求渠道', enum: ['MINIAPP', 'H5', 'ADMIN_PREVIEW'], required: false },
      { name: 'moduleLimit', description: '最多返回模块数', type: 'number', required: false },
      { name: 'productLimit', description: '每个模块最多返回商品数', type: 'number', required: false },
      { name: 'clientVersion', description: '客户端版本，用于出数解释', required: false },
      { name: 'platform', description: '客户端平台，用于出数解释', required: false },
      { name: 'appBuild', description: '客户端构建号，用于出数解释', required: false },
      { name: 'deviceHashDigest', description: '设备摘要，用于差异排查；不得上传原始设备标识', required: false },
    ],
    headers: [
      { name: 'x-client-version', description: '客户端版本', required: false },
      { name: 'x-client-platform', description: '客户端平台', required: false },
      { name: 'x-app-build', description: '客户端构建号', required: false },
      { name: 'x-device-hash-digest', description: '设备摘要；不得上传原始设备标识', required: false },
    ],
  })
  async getSceneModules(
    @Param('sceneCode') sceneCode: string,
    @Query('channel') channel: string,
    @Member('memberId') memberId: string,
    @Query('moduleLimit') moduleLimitRaw?: string,
    @Query('productLimit') productLimitRaw?: string,
    @Query('clientVersion') clientVersionRaw?: string,
    @Query('platform') platformRaw?: string,
    @Query('appBuild') appBuildRaw?: string,
    @Query('deviceHashDigest') deviceHashDigestRaw?: string,
    @Headers('x-client-version') clientVersionHeader?: string,
    @Headers('x-client-platform') platformHeader?: string,
    @Headers('x-app-build') appBuildHeader?: string,
    @Headers('x-device-hash-digest') deviceHashDigestHeader?: string,
  ) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    const validChannels: UserMarketingContext['channel'][] = ['MINIAPP', 'H5', 'ADMIN_PREVIEW'];
    const safeChannel = validChannels.includes(channel as UserMarketingContext['channel'])
      ? (channel as UserMarketingContext['channel'])
      : 'MINIAPP';
    const moduleLimit = this.parsePositiveInt(moduleLimitRaw, 1, 20);
    const productLimit = this.parsePositiveInt(productLimitRaw, 1, 50);
    return TenantContext.run({ tenantId }, async () => {
      const ctx = await this.buildUserContext({
        tenantId,
        memberId: memberId ?? '',
        channel: safeChannel,
        clientVersion: this.pickOptionalString(clientVersionRaw, clientVersionHeader),
        platform: this.pickOptionalString(platformRaw, platformHeader),
        appBuild: this.pickOptionalString(appBuildRaw, appBuildHeader),
        deviceHashDigest: this.pickOptionalString(deviceHashDigestRaw, deviceHashDigestHeader),
      });
      const data = await this.service.getSceneModules(sceneCode, ctx, { moduleLimit, productLimit });
      this.logger.log(
        `[client.scene.modules] tenant=${tenantId} scene=${sceneCode} releaseNo=${data.releaseNo} ` +
          `modules=${data.modules.length} member=${memberId ?? '-'} channel=${safeChannel} ` +
          `source=${data.source} traceId=${data.traceId}`,
      );
      return Result.ok(data);
    });
  }

  private parsePositiveInt(rawValue: string | undefined, min: number, max: number): number | undefined {
    if (!rawValue) return undefined;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
  }

  private pickOptionalString(...values: Array<string | undefined>): string | undefined {
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
    return undefined;
  }

  private async buildUserContext(input: {
    tenantId: string;
    memberId: string;
    channel: UserMarketingContext['channel'];
    clientVersion?: string;
    platform?: string;
    appBuild?: string;
    deviceHashDigest?: string;
  }): Promise<UserMarketingContext> {
    // 用户上下文只聚合当前出数需要的轻量画像，避免场景接口在高频访问时扩展成完整会员聚合查询。
    const ctx: UserMarketingContext = {
      tenantId: input.tenantId,
      memberId: input.memberId,
      channel: input.channel,
      now: new Date(),
      isNewcomer: false,
    };
    if (input.clientVersion) ctx.clientVersion = input.clientVersion;
    if (input.platform) ctx.platform = input.platform;
    if (input.appBuild) ctx.appBuild = input.appBuild;
    if (input.deviceHashDigest) ctx.deviceHashDigest = input.deviceHashDigest;
    if (!input.memberId) {
      return ctx;
    }

    const [member, newcomerActivity] = await Promise.all([
      this.prisma.umsMember.findUnique({
        where: { memberId: input.memberId },
        select: { levelId: true },
      }),
      this.prisma.mktCampaign.findFirst({
        where: {
          tenantId: input.tenantId,
          type: 'NEWCOMER_EXCLUSIVE',
          status: MktCampaignStatus.PUBLISHED,
        },
        select: { id: true },
      }),
    ]);

    if (member) {
      ctx.memberLevel = String(member.levelId);
    }

    if (!newcomerActivity) {
      return ctx;
    }

    const participation = await this.prisma.mktCampaignParticipation.findFirst({
      where: {
        campaignId: newcomerActivity.id,
        memberId: input.memberId,
      },
      select: { id: true },
    });
    ctx.isNewcomer = !participation;
    return ctx;
  }
}
