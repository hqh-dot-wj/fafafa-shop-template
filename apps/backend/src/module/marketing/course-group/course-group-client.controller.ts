import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { Member } from 'src/module/client/common/decorators/member.decorator';
import { MemberAuthGuard } from 'src/module/client/common/guards/member-auth.guard';
import { OptionalMemberAuthGuard } from 'src/module/client/common/guards/optional-member-auth.guard';
import { Worker } from 'src/module/client/common/decorators/worker.decorator';
import { WorkerAuthGuard } from 'src/module/client/common/guards/worker-auth.guard';
import {
  CourseGroupClientJoinPreviewDto,
  CourseGroupClientJoinPreviewVo,
  CourseGroupClientOpenResultVo,
  CourseGroupClientOpenTeamDto,
  CourseGroupClientTeamDetailVo,
  CourseGroupClientTeamListVo,
  CourseGroupClientTeamMemberInspectVo,
} from './course-group-client.contract';
import { CourseGroupLifecycleService } from './services/lifecycle.service';
import { CourseGroupMemberService } from './services/member.service';
import { CourseGroupReadService } from './services/read.service';

/**
 * C 端拼课运行时入口，对应 miniapp-client/src/api/course-group.ts 与 course-group 页面。
 * 开团、代开、参团预检会触达订单/支付/补位/分佣边界，Controller 只接收客户端意图，判定集中在 service。
 */
@ApiTags('C端-拼课运行时')
@ApiBearerAuth()
@Controller('client/course-group')
export class CourseGroupClientController {
  constructor(
    private readonly lifecycleService: CourseGroupLifecycleService,
    private readonly memberService: CourseGroupMemberService,
    private readonly readService: CourseGroupReadService,
  ) {}

  @UseGuards(MemberAuthGuard)
  @Post('team/open')
  @Api({ summary: '用户开团', body: CourseGroupClientOpenTeamDto, type: CourseGroupClientOpenResultVo })
  openTeam(@Member('memberId') memberId: string, @Body() body: CourseGroupClientOpenTeamDto) {
    // 普通开团必须绑定当前会员，不能信任客户端传入的团长或支付字段。
    return this.lifecycleService.openTeam({
      memberId,
      tenantId: body.tenantId,
      productId: body.productId,
      skuId: body.skuId,
      activityContextKey: body.activityContextKey,
      classAddress: body.classAddress,
      classStartTime: body.classStartTime,
      classEndTime: body.classEndTime,
      isProxyOpen: false,
    });
  }

  @Post('team/proxy-open')
  @UseGuards(WorkerAuthGuard)
  @Api({ summary: '门店代开团', body: CourseGroupClientOpenTeamDto, type: CourseGroupClientOpenResultVo })
  proxyOpenTeam(@Worker('memberId') memberId: string, @Body() body: CourseGroupClientOpenTeamDto) {
    // 门店代开依赖 WorkerAuthGuard，前端 allowProxyOpen 只是展示开关，不是权限来源。
    return this.lifecycleService.openTeam({
      memberId,
      tenantId: body.tenantId,
      productId: body.productId,
      skuId: body.skuId,
      activityContextKey: body.activityContextKey,
      classAddress: body.classAddress,
      classStartTime: body.classStartTime,
      classEndTime: body.classEndTime,
      isProxyOpen: true,
    });
  }

  @UseGuards(OptionalMemberAuthGuard)
  @Get('product/:productId/teams')
  @Api({
    summary: '查询商品可参与拼课团列表',
    type: CourseGroupClientTeamListVo,
    params: [{ name: 'productId', description: '拼课商品 ID' }],
    queries: [
      { name: 'tenantId', description: '租户 ID', required: false },
      { name: 'activityContextKey', description: '活动上下文 key', required: false },
      { name: 'pageNum', description: '页码', type: 'number', required: false },
      { name: 'pageSize', description: '分页大小', type: 'number', required: false },
    ],
  })
  listProductTeams(
    @Param('productId') productId: string,
    @Member('memberId') memberId: string,
    @Query('tenantId') tenantId?: string,
    @Query('activityContextKey') activityContextKey?: string,
    @Query('pageNum') pageNum?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.readService.listProductTeams({
      memberId,
      tenantId,
      productId,
      activityContextKey,
      pageNum: pageNum ? Number(pageNum) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @UseGuards(OptionalMemberAuthGuard)
  @Get('team/:teamId')
  @Api({
    summary: '拼课团详情',
    type: CourseGroupClientTeamDetailVo,
    params: [{ name: 'teamId', description: '拼课团 ID' }],
    queries: [{ name: 'tenantId', description: '租户 ID', required: false }],
  })
  getTeamDetail(
    @Param('teamId') teamId: string,
    @Member('memberId') memberId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.readService.getTeamDetail({
      memberId,
      teamId,
      tenantId,
    });
  }

  @UseGuards(MemberAuthGuard)
  @Get('team/:teamId/member/:targetMemberId/inspect')
  @Api({
    summary: '团长查看成员补位身份',
    type: CourseGroupClientTeamMemberInspectVo,
    params: [
      { name: 'teamId', description: '拼课团 ID' },
      { name: 'targetMemberId', description: '待查看的成员 ID' },
    ],
    queries: [{ name: 'tenantId', description: '租户 ID', required: false }],
  })
  inspectTeamMember(
    @Param('teamId') teamId: string,
    @Param('targetMemberId') targetMemberId: string,
    @Member('memberId') memberId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.memberService.inspectClientTeamMember({
      memberId,
      tenantId,
      teamId,
      targetMemberId,
    });
  }

  @UseGuards(MemberAuthGuard)
  @Post('team/:teamId/join-preview')
  @Api({
    summary: '参团预检与价格预览',
    body: CourseGroupClientJoinPreviewDto,
    type: CourseGroupClientJoinPreviewVo,
    params: [{ name: 'teamId', description: '拼课团 ID' }],
  })
  getJoinPreview(
    @Param('teamId') teamId: string,
    @Member('memberId') memberId: string,
    @Body() body?: CourseGroupClientJoinPreviewDto,
  ) {
    // 参团预检是进入订单页前的最后一道拼课校验，需重新计算名额、门店和价格。
    return this.memberService.getJoinPreview({
      memberId,
      teamId,
      tenantId: body?.tenantId,
    });
  }
}
