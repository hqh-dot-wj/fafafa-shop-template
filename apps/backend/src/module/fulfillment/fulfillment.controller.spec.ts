import 'reflect-metadata';
import { BusinessType } from 'src/common/constant/business.constant';
import { StoreOrderController } from 'src/module/store/order/store-order.controller';
import { BizOperationActions } from 'src/module/common/operation-log/biz-operation-log.constants';
import { LOG_OPERATION_META_KEY } from 'src/module/common/operation-log/log-operation.meta';
import { FulfillmentController } from './fulfillment.controller';

describe('FulfillmentController audit metadata', () => {
  function operlogOf(controller: { prototype: object }, method: string) {
    return Reflect.getMetadata('operlog', controller.prototype[method as keyof typeof controller.prototype]);
  }

  function bizActionOf(controller: { prototype: object }, method: string) {
    return Reflect.getMetadata(LOG_OPERATION_META_KEY, controller.prototype[method as keyof typeof controller.prototype])
      ?.action;
  }

  it('marks fulfillment write endpoints with system and business operation logs', () => {
    expect(operlogOf(FulfillmentController, 'shipProduct')).toMatchObject({ businessType: BusinessType.UPDATE });
    expect(bizActionOf(FulfillmentController, 'shipProduct')).toBe(BizOperationActions.ORDER_PRODUCT_SHIP);

    expect(operlogOf(FulfillmentController, 'receiveProduct')).toMatchObject({ businessType: BusinessType.UPDATE });
    expect(bizActionOf(FulfillmentController, 'receiveProduct')).toBe(BizOperationActions.ORDER_PRODUCT_RECEIVE);

    expect(operlogOf(FulfillmentController, 'assignService')).toMatchObject({ businessType: BusinessType.UPDATE });
    expect(bizActionOf(FulfillmentController, 'assignService')).toBe(BizOperationActions.ORDER_REASSIGN_WORKER);

    expect(operlogOf(FulfillmentController, 'verifyService')).toMatchObject({ businessType: BusinessType.UPDATE });
    expect(bizActionOf(FulfillmentController, 'verifyService')).toBe(BizOperationActions.ORDER_VERIFY);
  });

  it('keeps legacy order verify endpoint in the system operation log', () => {
    expect(operlogOf(StoreOrderController, 'verifyService')).toMatchObject({ businessType: BusinessType.UPDATE });
    expect(bizActionOf(StoreOrderController, 'verifyService')).toBe(BizOperationActions.ORDER_VERIFY);
  });
});
