import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BusinessType } from 'src/common/constant/business.constant';
import { Api } from 'src/common/decorators/api.decorator';
import { User } from 'src/common/decorators/user.decorator';
import { Result } from 'src/common/response';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import {
  BizOperationActions,
  BizOperationTargetTypes,
} from 'src/module/common/operation-log/biz-operation-log.constants';
import { LogOperation } from 'src/module/common/operation-log/log-operation.decorator';
import {
  AssignServiceFulfillmentDto,
  DiagnoseMissingFulfillmentDto,
  ListServiceDispatchDto,
  ListServiceWorkerCandidatesDto,
  ReceiveProductFulfillmentDto,
  ShipProductFulfillmentDto,
  VerifyServiceFulfillmentDto,
} from './dto/fulfillment.dto';
import { FulfillmentService } from './fulfillment.service';
import { MissingFulfillmentOrderVo, OrderFulfillmentVo } from './vo/fulfillment.vo';
import { DispatchWorkerCandidateVo, StoreOrderListItemVo } from '../store/order/vo/store-order.vo';

// 履约菜单迁移期继续复用订单权限码，避免 seed/角色授权和旧路由同时切换造成权限断层。
const SERVICE_DISPATCH_PERMISSION = 'store:order:dispatch';
const SERVICE_VERIFY_PERMISSION = 'store:order:verify';

@ApiTags('Store-履约管理')
@Controller('store/fulfillment')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Get('order/:orderId')
  @Api({ summary: '查询订单履约详情', type: OrderFulfillmentVo })
  @RequirePermission('store:order:query')
  async getOrderFulfillment(@Param('orderId') orderId: string) {
    return Result.ok(await this.fulfillmentService.getOrderFulfillment(orderId));
  }

  @Get('diagnostics/missing')
  @Api({ summary: '诊断缺失履约单的历史订单', type: MissingFulfillmentOrderVo, isArray: true, isPager: true })
  @RequirePermission('store:order:query')
  async diagnoseMissingFulfillment(@Query() query: DiagnoseMissingFulfillmentDto) {
    return this.fulfillmentService.diagnoseMissingFulfillment(query);
  }

  @Get('service/dispatch/list')
  @Api({ summary: '服务履约待派单列表', type: StoreOrderListItemVo, isArray: true, isPager: true })
  @RequirePermission(SERVICE_DISPATCH_PERMISSION)
  async listServiceDispatch(@Query() query: ListServiceDispatchDto) {
    return this.fulfillmentService.listServiceDispatch(query);
  }

  @Get('service/worker-candidates')
  @Api({ summary: '服务履约可选技师列表', type: DispatchWorkerCandidateVo, isArray: true, isPager: true })
  @RequirePermission(SERVICE_DISPATCH_PERMISSION)
  async listServiceWorkerCandidates(@Query() query: ListServiceWorkerCandidatesDto) {
    return this.fulfillmentService.listServiceWorkerCandidates(query);
  }

  @Post('product/ship')
  @Api({ summary: '录入实物发货信息', body: ShipProductFulfillmentDto, type: OrderFulfillmentVo })
  @RequirePermission('store:order:list')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_PRODUCT_SHIP,
    targetType: BizOperationTargetTypes.ORDER,
    targetIdBodyKey: 'orderId',
    detailBodyKeys: ['carrierCode', 'carrierName', 'trackingNo', 'remark', 'items'],
  })
  async shipProduct(@Body() dto: ShipProductFulfillmentDto, @User('userId') userId: string) {
    return Result.ok(await this.fulfillmentService.shipProductForStore(dto, userId), '发货成功');
  }

  @Post('product/receive')
  @Api({ summary: '后台确认实物收货', body: ReceiveProductFulfillmentDto, type: OrderFulfillmentVo })
  @RequirePermission('store:order:list')
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_PRODUCT_RECEIVE,
    targetType: BizOperationTargetTypes.ORDER,
    targetIdBodyKey: 'orderId',
    detailBodyKeys: ['remark'],
  })
  async receiveProduct(@Body() dto: ReceiveProductFulfillmentDto, @User('userId') userId: string) {
    return Result.ok(
      await this.fulfillmentService.confirmProductReceiptForStore(dto.orderId, dto.remark, userId, dto.operationId),
      '确认收货成功',
    );
  }

  @Post('service/assign')
  @Api({ summary: '服务履约指派技师', body: AssignServiceFulfillmentDto, type: OrderFulfillmentVo })
  @RequirePermission(SERVICE_DISPATCH_PERMISSION)
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_REASSIGN_WORKER,
    targetType: BizOperationTargetTypes.ORDER,
    targetIdBodyKey: 'orderId',
    detailBodyKeys: ['workerId', 'remark'],
  })
  async assignService(@Body() dto: AssignServiceFulfillmentDto, @User('userId') userId: string) {
    return Result.ok(
      await this.fulfillmentService.assignServiceForStore(
        dto.orderId,
        dto.workerId,
        userId,
        dto.operationId,
        dto.remark,
      ),
      '改派成功',
    );
  }

  @Post('service/verify')
  @Api({ summary: '后台核销服务履约', body: VerifyServiceFulfillmentDto, type: OrderFulfillmentVo })
  @RequirePermission(SERVICE_VERIFY_PERMISSION)
  @Operlog({ businessType: BusinessType.UPDATE })
  @LogOperation({
    action: BizOperationActions.ORDER_VERIFY,
    targetType: BizOperationTargetTypes.ORDER,
    targetIdBodyKey: 'orderId',
    detailBodyKeys: ['remark'],
  })
  async verifyService(@Body() dto: VerifyServiceFulfillmentDto, @User('userId') userId: string) {
    return Result.ok(
      await this.fulfillmentService.verifyServiceForStore(dto.orderId, dto.remark, userId, dto.operationId),
      '核销成功',
    );
  }
}
