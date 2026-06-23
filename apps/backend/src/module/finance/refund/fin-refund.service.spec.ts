import { FinRefundEventType, FinRefundStatus, FinRefundType } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { RefundStatus } from 'src/module/payment/interfaces/payment-provider.interface';
import { FinRefundService } from './fin-refund.service';

describe('FinRefundService', () => {
  const prisma = {
    finRefund: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    finRefundEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: FinRefundService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    service = new FinRefundService(prisma as any);
  });

  it('Given 新退款请求, When createRequested, Then 创建 FinRefund 并追加 REQUEST 事件', async () => {
    prisma.finRefund.findUnique.mockResolvedValue(null);
    prisma.finRefund.create.mockImplementation(async (args) => ({ id: 'refund-1', ...args.data }));

    const result = await service.createRequested({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      orderSn: 'ORDER001',
      refundSn: 'REFUND_ORDER001_FULL',
      refundType: FinRefundType.FULL,
      requestedAmount: '19.90',
      payerTotalAmount: '19.90',
      settlementTotalAmount: '19.90',
      reason: '订单退款',
      operator: 'admin',
    });

    expect(result.status).toBe(FinRefundStatus.CREATED);
    expect(prisma.finRefund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refundSn: 'REFUND_ORDER001_FULL',
          requestedAmount: expect.objectContaining({ toFixed: expect.any(Function) }),
          events: {
            create: expect.objectContaining({
              eventType: FinRefundEventType.REQUEST,
              toStatus: FinRefundStatus.CREATED,
              operator: 'admin',
            }),
          },
        }),
      }),
    );
  });

  it('Given 微信同步返回 PROCESSING, When recordGatewayResult, Then 只推进退款事实源不触发业务成功语义', async () => {
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.CREATED,
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({ id: 'refund-1', ...args.data }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    const result = await service.recordGatewayResult({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: RefundStatus.PROCESSING,
      amount: 1990,
      operator: 'admin',
    });

    expect(result.status).toBe(FinRefundStatus.PROCESSING);
    expect(service.isSuccess(result)).toBe(false);
    expect(prisma.finRefundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: FinRefundEventType.SYNC_RESPONSE,
          fromStatus: FinRefundStatus.CREATED,
          toStatus: FinRefundStatus.PROCESSING,
        }),
      }),
    );
  });

  it('Given 微信返回 CLOSE, When recordGatewayResult, Then 记录为 CLOSED 终态', async () => {
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.PROCESSING,
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({ id: 'refund-1', ...args.data }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    const result = await service.recordGatewayResult({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: 'CLOSE',
      amount: 1990,
    });

    expect(result.status).toBe(FinRefundStatus.CLOSED);
    expect(service.isFailureTerminal(result)).toBe(true);
  });

  it('Given 微信退款回调 SUCCESS, When recordNotifyResult, Then 追加 NOTIFY 事件并写入成功时间', async () => {
    const successTime = new Date('2026-05-18T10:00:00.000Z');
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.PROCESSING,
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({ id: 'refund-1', ...args.data }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    const result = await service.recordNotifyResult({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: RefundStatus.SUCCESS,
      amount: 1990,
      successTime,
      operator: 'payment-refund-callback',
    });

    expect(result.status).toBe(FinRefundStatus.SUCCESS);
    expect(result.successTime).toBe(successTime);
    expect(prisma.finRefundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: FinRefundEventType.NOTIFY,
          fromStatus: FinRefundStatus.PROCESSING,
          toStatus: FinRefundStatus.SUCCESS,
        }),
      }),
    );
  });

  it('Given 微信退款回调包含付款方与结算口径, When recordNotifyResult, Then 分别写入金额字段', async () => {
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.PROCESSING,
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({ id: 'refund-1', ...args.data }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    await service.recordNotifyResult({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: RefundStatus.SUCCESS,
      amount: 1990,
      payerRefundAmount: 1990,
      settlementRefundAmount: 1988,
      refundFeeAmount: 2,
      discountRefundAmount: 0,
      operator: 'payment-refund-callback',
    });

    const data = prisma.finRefund.update.mock.calls[0][0].data;
    expect(data.payerRefundAmount.toFixed(2)).toBe('19.90');
    expect(data.settlementRefundAmount.toFixed(2)).toBe('19.88');
    expect(data.refundFeeAmount.toFixed(2)).toBe('0.02');
    expect(data.discountRefundAmount.toFixed(2)).toBe('0.00');
    expect(prisma.finRefundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            payerRefundAmountFen: 1990,
            settlementRefundAmountFen: 1988,
            refundFeeAmountFen: 2,
            discountRefundAmountFen: 0,
          }),
        }),
      }),
    );
  });

  it('Given 退款查询接口异常, When recordQueryFailure, Then 记录 QUERY 事件并递增查询次数', async () => {
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.PROCESSING,
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.PROCESSING,
      retryCount: 3,
      ...args.data,
      retryCount: 3,
    }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    const result = await service.recordQueryFailure({
      refundSn: 'REFUND_ORDER001_FULL',
      failReason: 'wechat unavailable',
      operator: 'payment.refundReconcileJob',
    });

    expect(result.status).toBe(FinRefundStatus.PROCESSING);
    expect(prisma.finRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failReason: 'wechat unavailable',
          retryCount: { increment: 1 },
          lastQueryTime: expect.any(Date),
        }),
      }),
    );
    expect(prisma.finRefundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: FinRefundEventType.QUERY,
          fromStatus: FinRefundStatus.PROCESSING,
          toStatus: FinRefundStatus.PROCESSING,
        }),
      }),
    );
  });

  it('Given 退款申请外呼异常, When recordGatewayFailure, Then 记录 SYNC_RESPONSE 事件并保留当前状态', async () => {
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'AUTO_REFUND_ORDER001_CANCELLED',
      status: FinRefundStatus.CREATED,
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({
      id: 'refund-1',
      refundSn: 'AUTO_REFUND_ORDER001_CANCELLED',
      status: FinRefundStatus.CREATED,
      retryCount: 1,
      ...args.data,
      retryCount: 1,
    }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    const result = await service.recordGatewayFailure({
      refundSn: 'AUTO_REFUND_ORDER001_CANCELLED',
      failReason: 'network timeout',
      operator: 'payment-callback',
    });

    expect(result.status).toBe(FinRefundStatus.CREATED);
    expect(prisma.finRefundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: FinRefundEventType.SYNC_RESPONSE,
          fromStatus: FinRefundStatus.CREATED,
          toStatus: FinRefundStatus.CREATED,
        }),
      }),
    );
  });

  it('Given 退款超过处理窗口, When markManualReviewRequired, Then 标记 ABNORMAL 并追加 MANUAL 事件', async () => {
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.PROCESSING,
      retryCount: 1152,
      lastQueryTime: new Date('2026-05-18T10:00:00.000Z'),
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      ...args.data,
    }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    const result = await service.markManualReviewRequired({
      refundSn: 'REFUND_ORDER001_FULL',
      reason: '退款查询超过处理窗口仍未进入终态',
      operator: 'payment.refundReconcileJob',
    });

    expect(result.status).toBe(FinRefundStatus.ABNORMAL);
    expect(prisma.finRefundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: FinRefundEventType.MANUAL,
          fromStatus: FinRefundStatus.PROCESSING,
          toStatus: FinRefundStatus.ABNORMAL,
        }),
      }),
    );
  });

  it('Given 本地人工异常后收到微信 SUCCESS, When recordNotifyResult, Then 允许覆盖为 SUCCESS', async () => {
    const successTime = new Date('2026-05-18T10:00:00.000Z');
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.ABNORMAL,
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({ id: 'refund-1', ...args.data }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    const result = await service.recordNotifyResult({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: RefundStatus.SUCCESS,
      amount: 1990,
      successTime,
      operator: 'payment-refund-callback',
    });

    expect(result.status).toBe(FinRefundStatus.SUCCESS);
    expect(prisma.finRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: FinRefundStatus.SUCCESS,
          successTime,
        }),
      }),
    );
  });

  it('Given 待查询退款单, When findPendingForQuery, Then 只查 CREATED/PROCESSING', async () => {
    prisma.finRefund.findMany.mockResolvedValue([]);

    await service.findPendingForQuery(20);

    expect(prisma.finRefund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: [FinRefundStatus.CREATED, FinRefundStatus.PROCESSING],
          },
        },
        take: 20,
      }),
    );
  });

  it('Given SUCCESS 但未收口退款单, When findSuccessUnfinalized, Then 只查成功且 finalizedAt 为空', async () => {
    prisma.finRefund.findMany.mockResolvedValue([]);

    await service.findSuccessUnfinalized(20);

    expect(prisma.finRefund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: FinRefundStatus.SUCCESS,
          finalizedAt: null,
        },
        take: 20,
      }),
    );
  });

  it('Given 退款单号, When findByRefundSn, Then 通过唯一键读取退款事实源', async () => {
    prisma.finRefund.findUnique.mockResolvedValue(null);

    await service.findByRefundSn('AUTO_REFUND_ORDER001_CANCELLED');

    expect(prisma.finRefund.findUnique).toHaveBeenCalledWith({
      where: { refundSn: 'AUTO_REFUND_ORDER001_CANCELLED' },
    });
  });

  // 规格（#6.1 退款金额解析兜底）
  //   I1: ∀ 渠道侧金额字段缺失（input.amount === undefined）, Then DB 对应金额字段不写入（保留原值）
  //   I2: I1 不影响状态机推进——status 仍按 input.status 更新
  it('Given 渠道侧 amount 字段缺失(undefined), When recordNotifyResult, Then 不覆盖已落库的金额字段', async () => {
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.PROCESSING,
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({ id: 'refund-1', ...args.data }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    await service.recordNotifyResult({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: RefundStatus.SUCCESS,
      amount: undefined,
      payerRefundAmount: undefined,
      settlementRefundAmount: undefined,
      refundFeeAmount: undefined,
      discountRefundAmount: undefined,
      netAmount: undefined,
      operator: 'payment-refund-callback',
    });

    const data = prisma.finRefund.update.mock.calls[0][0].data;
    // 关键：传给 Prisma 的金额字段必须是 undefined，Prisma 收到 undefined 不写入字段。
    // 这样防御了 #6.1：adapter 兜底返回 0 导致 fenToYuan(0)=0.00 清零已落库金额。
    expect(data.payerRefundAmount).toBeUndefined();
    expect(data.settlementRefundAmount).toBeUndefined();
    expect(data.refundFeeAmount).toBeUndefined();
    expect(data.discountRefundAmount).toBeUndefined();
    // 状态仍按 input.status 推进
    expect(data.status).toBe(FinRefundStatus.SUCCESS);
  });

  // 规格（#bug_003）：amount / payerRefund / settlementRefund 是三个不同概念（差一个手续费），
  //   不能用 amount fallback payer/settlement，否则只填 amount 的调用方会把 gross 写到 payer/settlement 列。
  it('Given amount 有但 payerRefund/settlementRefund 缺, When recordGatewayResult, Then 不 fallback 到 amount', async () => {
    prisma.finRefund.findUnique.mockResolvedValue({
      id: 'refund-1',
      refundSn: 'REFUND_ORDER001_FULL',
      status: FinRefundStatus.PROCESSING,
    });
    prisma.finRefund.update.mockImplementation(async (args) => ({ id: 'refund-1', ...args.data }));
    prisma.finRefundEvent.create.mockResolvedValue({ id: 'event-1' });

    await service.recordGatewayResult({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: RefundStatus.SUCCESS,
      amount: 1990, // gross 19.90
      payerRefundAmount: undefined,
      settlementRefundAmount: undefined,
      netAmount: undefined,
      operator: 'payment-refund-callback',
    });

    const data = prisma.finRefund.update.mock.calls[0][0].data;
    // 关键：payer / settlement 在缺失时不应再 fallback 到 amount 折算的元值，否则与 gross 概念混淆
    expect(data.payerRefundAmount).toBeUndefined();
    expect(data.settlementRefundAmount).toBeUndefined();
    expect(data.status).toBe(FinRefundStatus.SUCCESS);
  });

  it('Given 未知退款状态, When recordGatewayResult, Then 拒绝写入错误状态', async () => {
    await expect(
      service.recordGatewayResult({
        refundSn: 'REFUND_ORDER001_FULL',
        status: 'SURPRISE',
      }),
    ).rejects.toThrow(BusinessException);

    expect(prisma.finRefund.update).not.toHaveBeenCalled();
    expect(prisma.finRefundEvent.create).not.toHaveBeenCalled();
  });
});
