import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { getErrorMessage } from 'src/common/utils/error';
import { ResponseCode, Result } from 'src/common/response';
import { Api } from 'src/common/decorators/api.decorator';
import { CourseGroupBuyService } from './course-group-buy.service';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { PlayExistsVo, PlayFeaturesVo, PlayMetadataVo, toPlayMetadataVo } from './vo/play-metadata.vo';
import { PlayDispatcher } from './play.dispatcher';

/**
 * 玩法查询控制器
 *
 * @description
 * 提供营销玩法的元数据查询接口,供前端动态生成表单和展示玩法列表。
 *
 * 核心功能:
 * 1. 获取所有可用玩法列表
 * 2. 获取指定玩法的详细元数据
 */
@ApiTags('营销-玩法管理')
@Controller('admin/marketing/play')
@ApiBearerAuth('Authorization')
export class PlayController {
  constructor(
    private readonly playDispatcher: PlayDispatcher,
    private readonly courseGroupBuyService: CourseGroupBuyService,
  ) {}

  /**
   * 获取所有可用玩法列表
   *
   * @description
   * 返回系统中所有已注册的营销玩法元数据。
   * 前端可以基于此接口动态生成玩法选择器。
   *
   * @returns 所有玩法的元数据数组
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   *
   * @example
   * GET /api/admin/marketing/play/types
   *
   * Response:
   * {
   *   "code": 200,
   *   "message": "success",
   *   "data": [
   *     {
   *       "code": "COURSE_GROUP_BUY",
   *       "name": "拼班课程",
   *       "hasInstance": true,
   *       "hasState": true,
   *       "canFail": true,
   *       "canParallel": true,
   *       "defaultStockMode": "LAZY_CHECK",
   *       "description": "用户发起或参与拼班课程，人数达到要求后开班"
   *     },
   *     // ... 其他玩法
   *   ]
   * }
   */
  @Get('types')
  @Api({ summary: '获取所有可用玩法列表', type: PlayMetadataVo, isArray: true })
  @RequirePermission('marketing:play:type:list')
  async getAllPlayTypes() {
    return Result.ok(this.playDispatcher.getAllPlayTypes().map(toPlayMetadataVo));
  }

  /**
   * 获取指定玩法的元数据
   *
   * @description
   * 根据玩法代码获取该玩法的详细元数据。
   * 前端可以基于此接口动态生成规则配置表单。
   *
   * @param code 玩法代码
   * @returns 玩法元数据
   * @throws {BusinessException} 如果玩法不存在
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   *
   * @example
   * GET /api/admin/marketing/play/types/COURSE_GROUP_BUY
   *
   * Response:
   * {
   *   "code": 200,
   *   "message": "success",
   *   "data": {
   *     "code": "COURSE_GROUP_BUY",
   *     "name": "拼班课程",
   *     "hasInstance": true,
   *     "hasState": true,
   *     "canFail": true,
   *     "canParallel": true,
   *     "defaultStockMode": "LAZY_CHECK",
   *     "description": "用户发起或参与拼班课程，人数达到要求后开班",
   *     "ruleSchema": { ... }
   *   }
   * }
   */
  @Get('types/:code')
  @Api({ summary: '获取指定玩法的元数据', type: PlayMetadataVo })
  @RequirePermission('marketing:play:type:query')
  async getPlayType(@Param('code') code: string) {
    try {
      return Result.ok(toPlayMetadataVo(this.playDispatcher.getMetadata(code)));
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `获取玩法元数据失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 检查玩法是否存在
   *
   * @description
   * 检查指定的玩法代码是否已注册。
   *
   * @param code 玩法代码
   * @returns 是否存在
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   *
   * @example
   * GET /api/marketing/play/types/COURSE_GROUP_BUY/exists
   *
   * Response:
   * {
   *   "code": 200,
   *   "message": "success",
   *   "data": {
   *     "exists": true,
   *     "code": "COURSE_GROUP_BUY"
   *   }
   * }
   */
  @Get('types/:code/exists')
  @Api({ summary: '检查玩法是否存在', type: PlayExistsVo })
  @RequirePermission('marketing:play:type:query')
  async checkPlayExists(@Param('code') code: string) {
    const exists = this.playDispatcher.hasHandler(code);
    return Result.ok({ exists, code });
  }

  /**
   * 获取玩法特性信息
   *
   * @description
   * 获取指定玩法的特性信息（是否有实例、是否可失败等）。
   * 用于前端根据玩法特性动态调整 UI 和业务逻辑。
   *
   * @param code 玩法代码
   * @returns 玩法特性信息
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   *
   * @example
   * GET /api/marketing/play/types/COURSE_GROUP_BUY/features
   *
   * Response:
   * {
   *   "code": 200,
   *   "message": "success",
   *   "data": {
   *     "code": "COURSE_GROUP_BUY",
   *     "hasInstance": true,
   *     "hasState": true,
   *     "canFail": true,
   *     "canParallel": true
   *   }
   * }
   */
  @Get('types/:code/features')
  @Api({ summary: '获取玩法特性信息', type: PlayFeaturesVo })
  @RequirePermission('marketing:play:type:query')
  async getPlayFeatures(@Param('code') code: string) {
    try {
      return Result.ok({
        code,
        hasInstance: this.playDispatcher.hasInstance(code),
        hasState: this.playDispatcher.hasState(code),
        canFail: this.playDispatcher.canFail(code),
        canParallel: this.playDispatcher.canParallel(code),
      });
    } catch (error) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `获取玩法特性失败: ${getErrorMessage(error)}`);
    }
  }

  // ==================== 课程拼团扩展接口 ====================

  /**
   * 获取课程排课信息
   *
   * @description
   * 获取指定课程实例的排课计划。
   *
   * @param instanceId 实例ID
   * @returns 排课列表
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   *
   * @example
   * GET /api/marketing/play/course/:instanceId/schedules
   */
  @Get('course/:instanceId/schedules')
  @Api({ summary: '获取课程排课信息' })
  @RequirePermission('marketing:play:course:query')
  async getCourseSchedules(@Param('instanceId') instanceId: string) {
    try {
      return Result.ok(await this.courseGroupBuyService.getSchedules(instanceId));
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `获取排课信息失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 获取课程考勤信息
   *
   * @description
   * 获取指定课程实例的考勤记录。
   *
   * @param instanceId 实例ID
   * @returns 考勤列表
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   *
   * @example
   * GET /api/marketing/play/course/:instanceId/attendances
   */
  @Get('course/:instanceId/attendances')
  @Api({ summary: '获取课程考勤信息' })
  @RequirePermission('marketing:play:course:query')
  async getCourseAttendances(@Param('instanceId') instanceId: string) {
    try {
      return Result.ok(await this.courseGroupBuyService.getAttendances(instanceId));
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `获取考勤信息失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 标记学员出勤
   *
   * @description
   * 标记指定学员在指定日期的出勤情况。
   *
   * @param instanceId 实例ID
   * @param body 出勤信息
   * @returns 考勤记录
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   *
   * @example
   * POST /api/marketing/play/course/:instanceId/attendance
   * Body: { "memberId": "xxx", "date": "2024-01-01", "remark": "准时到达" }
   */
  @Post('course/:instanceId/attendance')
  @Api({ summary: '标记学员出勤' })
  @RequirePermission('marketing:play:course:attendance')
  @Operlog({ businessType: BusinessType.UPDATE })
  async markAttendance(
    @Param('instanceId') instanceId: string,
    @Body() body: { memberId: string; date: string; remark?: string },
  ) {
    try {
      const date = new Date(body.date);
      return Result.ok(await this.courseGroupBuyService.markAttendance(instanceId, body.memberId, date, body.remark));
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `标记出勤失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 获取学员出勤率
   *
   * @description
   * 获取指定学员的出勤率统计。
   *
   * @param instanceId 实例ID
   * @param memberId 学员ID
   * @returns 出勤率统计
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   *
   * @example
   * GET /api/marketing/play/course/:instanceId/attendance-rate?memberId=xxx
   */
  @Get('course/:instanceId/attendance-rate')
  @Api({ summary: '获取学员出勤率' })
  @RequirePermission('marketing:play:course:query')
  async getAttendanceRate(@Param('instanceId') instanceId: string, @Query('memberId') memberId: string) {
    try {
      if (!memberId) {
        throw new BusinessException(ResponseCode.PARAM_INVALID, '学员ID不能为空');
      }
      return Result.ok(await this.courseGroupBuyService.getAttendanceRate(instanceId, memberId));
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `获取出勤率失败: ${getErrorMessage(error)}`);
    }
  }
}
