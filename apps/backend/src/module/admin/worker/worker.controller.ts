import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User } from 'src/module/admin/system/user/user.decorator';
import {
  ApproveWorkerApplicationDto,
  CreateWorkerProfileDto,
  RejectWorkerApplicationDto,
  UpdateWorkerProfileDto,
  UpdateWorkerStatusDto,
  WorkerApplicationQueryDto,
  WorkerProfileQueryDto,
} from './dto';
import { WorkerApplicationVo, WorkerProfileVo } from './vo';
import { WorkerService } from './worker.service';

@ApiTags('工作者管理')
@Controller('admin/worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Api({ summary: '工作者资料列表', type: WorkerProfileVo, isArray: true, isPager: true })
  @RequirePermission('store:worker:profile:list')
  @Get('profiles')
  listProfiles(@Query() query: WorkerProfileQueryDto) {
    return this.workerService.listProfiles(query);
  }

  @Api({ summary: '后台新增正式工作者', body: CreateWorkerProfileDto })
  @RequirePermission('store:worker:profile:add')
  @Operlog({ businessType: BusinessType.INSERT })
  @Post('profiles')
  createProfile(@Body() dto: CreateWorkerProfileDto) {
    return this.workerService.createProfile(dto);
  }

  @Api({ summary: '工作者资料详情', type: WorkerProfileVo, params: [{ name: 'id', type: 'number' }] })
  @RequirePermission('store:worker:profile:query')
  @Get('profiles/:id')
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.workerService.getProfile(id);
  }

  @Api({ summary: '编辑工作者资料', body: UpdateWorkerProfileDto, params: [{ name: 'id', type: 'number' }] })
  @RequirePermission('store:worker:profile:edit')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Patch('profiles/:id')
  updateProfile(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWorkerProfileDto) {
    return this.workerService.updateProfile(id, dto);
  }

  @Api({ summary: '调整工作者接单/在线状态', body: UpdateWorkerStatusDto, params: [{ name: 'id', type: 'number' }] })
  @RequirePermission('store:worker:profile:status')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Post('profiles/:id/status')
  updateProfileStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWorkerStatusDto) {
    return this.workerService.updateProfileStatus(id, dto);
  }

  @Api({ summary: '工作者申请列表', type: WorkerApplicationVo, isArray: true, isPager: true })
  @RequirePermission('store:worker:application:list')
  @Get('applications')
  listApplications(@Query() query: WorkerApplicationQueryDto) {
    return this.workerService.listApplications(query);
  }

  @Api({ summary: '工作者申请详情', type: WorkerApplicationVo, params: [{ name: 'id', type: 'number' }] })
  @RequirePermission('store:worker:application:query')
  @Get('applications/:id')
  getApplication(@Param('id', ParseIntPipe) id: number) {
    return this.workerService.getApplication(id);
  }

  @Api({
    summary: '审核通过工作者申请',
    body: ApproveWorkerApplicationDto,
    params: [{ name: 'id', type: 'number' }],
  })
  @RequirePermission('store:worker:application:review')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Post('applications/:id/approve')
  approveApplication(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveWorkerApplicationDto,
    @User('user.userName') userName?: string,
  ) {
    return this.workerService.approveApplication(id, dto, userName);
  }

  @Api({
    summary: '拒绝工作者申请',
    body: RejectWorkerApplicationDto,
    params: [{ name: 'id', type: 'number' }],
  })
  @RequirePermission('store:worker:application:review')
  @Operlog({ businessType: BusinessType.UPDATE })
  @Post('applications/:id/reject')
  rejectApplication(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectWorkerApplicationDto,
    @User('user.userName') userName?: string,
  ) {
    return this.workerService.rejectApplication(id, dto, userName);
  }
}
