import { Test, TestingModule } from '@nestjs/testing';
import {
  ReconciliationStatus,
  SettlementBillStatus,
  SettlementChannelType,
  SettlementExecutionStatus,
  SettlementReceiverType,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { WechatPayService } from 'src/module/payment/wechat-pay.service';
import { SettlementExecutionService } from './settlement-execution.service';

describe('SettlementExecutionService', () => {
  let service: SettlementExecutionService;

  const mockWechatPayService = {
    ensureProfitSharingReceiver: jest.fn(),
    createProfitSharingOrder: jest.fn(),
    queryProfitSharingOrder: jest.fn(),
  };

  const mockPrismaService = {
    sysSocialUser: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementExecutionService,
        {
          provide: WechatPayService,
          useValue: mockWechatPayService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SettlementExecutionService>(SettlementExecutionService);
    jest.clearAllMocks();
  });

  it('Given 微信分账结算单, When execute, Then 创建接收方并发起官方分账', async () => {
    mockWechatPayService.ensureProfitSharingReceiver.mockResolvedValue(undefined);
    mockWechatPayService.createProfitSharingOrder.mockResolvedValue({
      orderId: 'ps_order_001',
      status: SettlementExecutionStatus.PROCESSING,
      rawState: 'PROCESSING',
      responsePayload: {
        state: 'PROCESSING',
      },
    });

    const result = await service.execute({
      executeNo: 'STE-001',
      operator: 'finance-admin',
      channelType: SettlementChannelType.WECHAT_PROFITSHARING,
      bill: {
        id: 'bill-1',
        billNo: 'STL-001',
        orderId: 'order-1',
        tenantId: 'tenant-1',
        status: SettlementBillStatus.APPROVED,
        channelType: SettlementChannelType.WECHAT_PROFITSHARING,
        payRecord: {
          transactionId: '420000000001',
        },
        items: [
          {
            id: 'item-1',
            receiverType: SettlementReceiverType.MERCHANT,
            receiverId: '1900000109',
            receiverName: '测试门店',
            amount: 88,
            reason: '门店应收',
          },
        ],
      } as any,
    });

    expect(mockWechatPayService.ensureProfitSharingReceiver).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverType: SettlementReceiverType.MERCHANT,
        receiverAccount: '1900000109',
        receiverName: '测试门店',
      }),
    );
    expect(mockWechatPayService.createProfitSharingOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: '420000000001',
        outOrderNo: 'STE-001',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        executionStatus: SettlementExecutionStatus.PROCESSING,
        billStatus: SettlementBillStatus.EXECUTING,
        issueStatus: ReconciliationStatus.WAITING,
      }),
    );
  });

  it('Given 已发起的微信分账执行单, When query, Then 按微信状态映射结算状态', async () => {
    mockWechatPayService.queryProfitSharingOrder.mockResolvedValue({
      orderId: 'ps_order_001',
      status: SettlementExecutionStatus.SUCCESS,
      rawState: 'FINISHED',
      responsePayload: {
        state: 'FINISHED',
        receivers: [{ result: 'SUCCESS' }],
      },
    });

    const result = await service.query({
      execution: {
        id: 'exec-1',
        executeNo: 'STE-001',
        channelType: SettlementChannelType.WECHAT_PROFITSHARING,
      } as any,
      bill: {
        id: 'bill-1',
        billNo: 'STL-001',
        orderId: 'order-1',
        tenantId: 'tenant-1',
        payRecord: {
          transactionId: '420000000001',
        },
      } as any,
    });

    expect(mockWechatPayService.queryProfitSharingOrder).toHaveBeenCalledWith({
      transactionId: '420000000001',
      outOrderNo: 'STE-001',
    });
    expect(result).toEqual(
      expect.objectContaining({
        executionStatus: SettlementExecutionStatus.SUCCESS,
        billStatus: SettlementBillStatus.SUCCESS,
        issueStatus: ReconciliationStatus.MATCHED,
      }),
    );
  });
});
