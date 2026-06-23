/**
 * Api.Order - 来自 @libs/common-types
 */
import type {
  StoreOrderDetailVo,
  StoreOrderItemVo,
  StoreOrderListItemVo,
  StoreOrderSearchParams,
} from '@libs/common-types';

declare global {
  namespace Api {
    namespace Order {
      type SearchParams = StoreOrderSearchParams;

      type OrderStatus =
        | 'PENDING_PAY'
        | 'PAID'
        | 'PENDING_SERVICE'
        | 'PENDING_DELIVERY'
        | 'SHIPPED'
        | 'COMPLETED'
        | 'CANCELLED'
        | 'REFUNDED';

      type OrderType = 'PRODUCT' | 'SERVICE';

      type OrderItem = StoreOrderListItemVo;

      type ListResult = Api.Common.PaginatingQueryRecord<OrderItem>;

      type OrderProductItem = StoreOrderItemVo;

      type CustomerInfo = NonNullable<StoreOrderDetailVo['customer']>;

      type WorkerInfo = NonNullable<StoreOrderDetailVo['worker']>;

      type CommissionInfo = NonNullable<StoreOrderDetailVo['commissions']>[number];

      type DetailResult = StoreOrderDetailVo;

      type OperationLogListResult = Api.Common.PaginatingQueryRecord<Api.Common.BizOperationLogItem>;

      interface OrderOperationLogParams extends Api.Common.PaginatingCommonParams {
        orderId: string;
      }

      /** 订单批量操作统一回执（核销、退款、备注等） */
      type BatchOperationResult = import('@libs/common-types').BatchOperationResult;

      /** 派单/改派可选技师 */
      interface DispatchWorkerCandidate {
        workerId: number;
        name: string;
        nickName: string | null;
        phone: string;
        status: string;
        auditStatus: string;
        isOnline: boolean;
      }

      type DispatchWorkerCandidateListResult = Api.Common.PaginatingQueryRecord<DispatchWorkerCandidate>;

      type DispatchWorkerCandidateParams = Api.Common.PaginatingCommonParams & {
        keyword?: string;
      };
    }
  }
}

export {};
