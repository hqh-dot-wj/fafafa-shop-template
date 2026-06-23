import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PlayInstanceModule } from '../instance/instance.module';
import { CourseGroupAdminController } from './course-group-admin.controller';
import { CourseGroupClientController } from './course-group-client.controller';
import { CourseGroupStoreController } from './course-group-store.controller';
import { MemberRepository } from './member.repository';
import { ProxyOpenRepository } from './proxy-open.repository';
import { TeamRepository } from './team.repository';
import { CommissionService } from './services/commission.service';
import { FailureResolutionService } from './services/failure-resolution.service';
import { CourseGroupLifecycleService } from './services/lifecycle.service';
import { CourseGroupMemberService } from './services/member.service';
import { CourseGroupReadService } from './services/read.service';
import { CourseGroupRefundService } from './services/refund.service';
import { TeamCourseRuntimeService } from './services/team-course-runtime.service';
import { TeamStateService } from './services/team-state.service';
import { VirtualFillService } from './services/virtual-fill.service';
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PlayInstanceModule),
    // 运行时延迟解析，打破拼团与玩法模块的静态循环依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 动态模块需延迟加载
    forwardRef(() => require('../play/play.module').MarketingPlayModule),
  ],
  controllers: [CourseGroupAdminController, CourseGroupClientController, CourseGroupStoreController],
  providers: [
    CourseGroupLifecycleService,
    CourseGroupMemberService,
    CourseGroupReadService,
    CourseGroupRefundService,
    VirtualFillService,
    TeamRepository,
    MemberRepository,
    ProxyOpenRepository,
    TeamStateService,
    TeamCourseRuntimeService,
    CommissionService,
    FailureResolutionService,
  ],
  exports: [
    CourseGroupLifecycleService,
    CourseGroupMemberService,
    CourseGroupReadService,
    CourseGroupRefundService,
    VirtualFillService,
  ],
})
export class CourseGroupModule {}
