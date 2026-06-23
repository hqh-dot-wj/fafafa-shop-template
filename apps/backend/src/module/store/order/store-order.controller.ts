import { Controller, Get, Post, Body, Query, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User } from 'src/common/decorators/user.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { StoreOrderService } from './store-order.service';
import {
  ListStoreOrderDto,
  ListDispatchWorkerCandidatesDto,
  ReassignWorkerDto,
  VerifyServiceDto,
  RefundOrderDto,
  PartialRefundOrderDto,
  BatchVerifyDto,
  BatchRefundDto,
  BatchUpdateOrderRemarkDto,
  BatchTransitionOrderStatusDto,
} from './dto/store-order.dto';
import { DispatchWorkerCandidateVo, StoreOrderDetailVo, StoreOrderListItemVo } from './vo/store-order.vo';
import { BizOperationLogService } from 'src/module/common/operation-log/biz-operation-log.service';
import { ListOrderBizOperationLogDto } from 'src/module/common/operation-log/dto/list-biz-operation-log.dto';
import { BizOperationLogVo } from 'src/module/common/operation-log/vo/biz-operation-log.vo';
import { LogOperation } from 'src/module/common/operation-log/log-operation.decorator';
import { BizOperationActions, BizOperationTargetTypes } from 'src/module/common/operation-log/biz-operation-log.constants';
import { BatchOperationResult } from '../common/dto/batch-operation-result.dto';

/**
 * Store端订单管理控制器
 */
@ApiTags('Store-订单管理')
@Controller('store/order')
export class StoreOrderController {
  constructor(
    private readonly storeOrderService: StoreOrderService,
    private readonly bizOperationLogService: BizOperationLogService,
  ) {}

  /**
   * 查询订单列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('list')
  @Api({ summary: '查询订单列表', type: StoreOrderListItemVo, isArray: true, isPager: true })
  @RequirePermission('store:order:list')
  async findAll(@Query() query: ListStoreOrderDto) {
    return await this.storeOrderService.findAll(query);
  }

  /**
   * 订单业务操作日志（退款、核销、改派等）
   */
  @Get('operation-logs')
  @Api({ summary: '订单业务操作日志', type: BizOperationLogVo, isArray: true, isPager: true })
  @RequirePermission('store:order:query')
  async listOperationLogs(@Query() query: ListOrderBizOperationLogDto) {
    return this.bizOperationLogService.listForOrder(query);
  }

  /**
   * 查询订单详情
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('detail/:id')
  @Api({ summary: '查询订单详情', type: StoreOrderDetailVo })
  @RequirePermission('store:order:query')
  async findOne(@Param('id') id: string) {
    // 默认允许查看佣金
    const canViewCommission = true;
    return await this.storeOrderService.findOne(id, canViewCommission);
  }

  /**
   * 获取待派单列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('dispatch/list')
  @Api({ summary: '获取待派单列表', type: StoreOrderListItemVo, isArray: true, isPager: true })
  @RequirePermission('store:order:dispatch')
  async getDispatchList(@Query() query: ListStoreOrderDto) {
    return await this.storeOrderService.getDispatchList(query);
  }

  /**
   * 派单/改派：技师候选列表（可搜索）
   */
  @Get('dispatch/worker-candidates')
  @Api({ summary: '派单可选技师列表', type: DispatchWorkerCandidateVo, isArray: true, isPager: true })
  @RequirePermission('store:order:dispatch')
  async listDispatchWorkerCandidates(@Query() query: ListDispatchWorkerCandidatesDto) {
    return await this.storeOrderService.listDispatchWorkerCandidates(query);
  }

  /**
   * 改派技师
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post('reassign')
  @Api({ summary: '改派技师' })
  @RequirePermission('store:order:dispatch')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_REASSIGN_WORKER,
    targetType: BizOperationTargetTypes.ORDER,
    targetIdBodyKey: 'orderId',
    detailBodyKeys: ['newWorkerId'],
  })
  async reassignWorker(@Body() dto: ReassignWorkerDto, @User('userId') userId: string) {
    return await this.storeOrderService.reassignWorker(dto, userId);
  }

  /**
   * 强制核销
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post('verify')
  @Api({ summary: '强制核销' })
  @RequirePermission('store:order:verify')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_VERIFY,
    targetType: BizOperationTargetTypes.ORDER,
    targetIdBodyKey: 'orderId',
    detailBodyKeys: ['remark'],
  })
  async verifyService(@Body() dto: VerifyServiceDto, @User('userId') userId: string) {
    return await this.storeOrderService.verifyService(dto, userId);
  }

  /**
   * 订单退款
   *
   * @sloCategory payment
   * @sloLatency P99 < 200ms
   * @sloAvailability 99.99%
   */
  @Post('refund')
  @Api({ summary: '订单退款' })
  @RequirePermission('store:order:refund')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_REFUND,
    targetType: BizOperationTargetTypes.ORDER,
    targetIdBodyKey: 'orderId',
    detailBodyKeys: ['remark'],
  })
  async refundOrder(@Body() dto: RefundOrderDto, @User('userId') userId: string) {
    return await this.storeOrderService.refundOrder(dto.orderId, dto.remark || '', userId);
  }

  /**
   * 部分退款
   *
   * @sloCategory payment
   * @sloLatency P99 < 200ms
   * @sloAvailability 99.99%
   */
  @Post('refund/partial')
  @Api({ summary: '部分退款' })
  @RequirePermission('store:order:refund')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_PARTIAL_REFUND,
    targetType: BizOperationTargetTypes.ORDER,
    targetIdBodyKey: 'orderId',
    detailBodyKeys: ['items', 'remark'],
  })
  async partialRefundOrder(@Body() dto: PartialRefundOrderDto, @User('userId') userId: string) {
    return await this.storeOrderService.partialRefundOrder(dto, userId);
  }

  /**
   * 导出订单数据
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('export')
  @Api({ summary: '导出订单数据' })
  @RequirePermission('store:order:export')
  async exportOrders(@Query() query: ListStoreOrderDto, @Res() res: Response) {
    return await this.storeOrderService.exportOrders(query, res);
  }

  /**
   * 批量核销
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post('batch/verify')
  @Api({ summary: '批量核销', type: BatchOperationResult })
  @RequirePermission('store:order:verify')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_BATCH_VERIFY,
    targetType: BizOperationTargetTypes.ORDER,
    batchOrderIdsBodyKey: 'orderIds',
    detailBodyKeys: ['remark'],
  })
  async batchVerify(@Body() dto: BatchVerifyDto, @User('userId') userId: string) {
    return await this.storeOrderService.batchVerify(dto, userId);
  }

  /**
   * 批量状态流转（实物：发货 / 确认收货）
   */
  @Post('batch/status')
  @Api({ summary: '批量状态流转（实物订单）', type: BatchOperationResult })
  @RequirePermission('store:order:list')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_BATCH_STATUS_TRANSITION,
    targetType: BizOperationTargetTypes.ORDER,
    batchOrderIdsBodyKey: 'orderIds',
    detailBodyKeys: ['target', 'remark'],
  })
  async batchTransitionOrderStatus(@Body() dto: BatchTransitionOrderStatusDto, @User('userId') userId: string) {
    return await this.storeOrderService.batchTransitionOrderStatus(dto, userId);
  }

  /**
   * 查询订单项活动审计
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get(':id/activity-audit')
  @Api({ summary: '查询订单项活动审计' })
  @RequirePermission('store:order:query')
  async getActivityAudit(@Param('id') id: string) {
    return await this.storeOrderService.getActivityAudit(id);
  }

  /**
   * 批量退款
   *
   * @sloCategory payment
   * @sloLatency P99 < 200ms
   * @sloAvailability 99.99%
   */
  @Post('batch/refund')
  @Api({ summary: '批量退款', type: BatchOperationResult })
  @RequirePermission('store:order:refund')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_BATCH_REFUND,
    targetType: BizOperationTargetTypes.ORDER,
    batchOrderIdsBodyKey: 'orderIds',
    detailBodyKeys: ['remark'],
  })
  async batchRefund(@Body() dto: BatchRefundDto, @User('userId') userId: string) {
    return await this.storeOrderService.batchRefund(dto, userId);
  }

  /**
   * 批量更新订单备注
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('batch/remark')
  @Api({ summary: '批量更新订单备注', type: BatchOperationResult })
  @RequirePermission('store:order:list')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_BATCH_REMARK,
    targetType: BizOperationTargetTypes.ORDER,
    batchOrderIdsBodyKey: 'orderIds',
    detailBodyKeys: ['remark', 'append'],
  })
  async batchUpdateRemark(@Body() dto: BatchUpdateOrderRemarkDto) {
    return await this.storeOrderService.batchUpdateRemark(dto);
  }
}
