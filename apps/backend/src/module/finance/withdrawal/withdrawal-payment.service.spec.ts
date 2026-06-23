import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { WithdrawalPaymentService } from './withdrawal-payment.service';
import { Decimal } from '@prisma/client/runtime/library';
import { WithdrawalStatus } from '@prisma/client';
import { WechatPayService } from 'src/module/payment/wechat-pay.service';

describe('WithdrawalPaymentService', () => {
  let service: WithdrawalPaymentService;

  const mockWechatPayService = {
    transferToWallet: jest.fn(),
    queryTransferDetail: jest.fn(),
  };

  const mockPrismaService = {
    sysSocialUser: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalPaymentService,
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

    service = module.get<WithdrawalPaymentService>(WithdrawalPaymentService);
    jest.clearAllMocks();
  });

  describe('transfer', () => {
    it('Given 微信零钱提现, When transfer, Then 调用微信转账并返回批次明细号', async () => {
      mockPrismaService.sysSocialUser.findFirst.mockResolvedValue({
        openid: 'openid_001',
      });
      mockWechatPayService.transferToWallet.mockImplementation(
        ({ outBatchNo, outDetailNo }: { outBatchNo: string; outDetailNo: string }) => ({
          outBatchNo,
          outDetailNo,
          batchId: 'wx_batch_001',
        }),
      );

      const withdrawal = {
        id: 'w1',
        tenantId: 't1',
        memberId: 'm1',
        amount: new Decimal(50),
        fee: new Decimal(0),
        actualAmount: new Decimal(49),
        method: 'WECHAT_WALLET',
        realName: '测试用户',
        status: WithdrawalStatus.PENDING,
        retryCount: 0,
        auditTime: new Date(),
        auditBy: 'admin1',
        auditRemark: null,
        paymentNo: null,
        failReason: null,
        createTime: new Date(),
        updateTime: new Date(),
      } as any;

      const result = await service.transfer(withdrawal);

      expect(mockPrismaService.sysSocialUser.findFirst).toHaveBeenCalledWith({
        where: {
          memberId: 'm1',
        },
        orderBy: {
          socialId: 'asc',
        },
      });
      expect(mockWechatPayService.transferToWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          outBatchNo: 'WD_BAT_w1',
          outDetailNo: 'WD_DTL_w1',
          openId: 'openid_001',
          amount: expect.any(Decimal),
          description: '用户提现',
          realName: '测试用户',
        }),
      );
      expect(result.paymentNo).toBe('WD_BAT_w1:WD_DTL_w1');
    });

    it('Given 已预占 paymentNo, When transfer, Then 使用预占批次明细号调用微信', async () => {
      mockPrismaService.sysSocialUser.findFirst.mockResolvedValue({
        openid: 'openid_001',
      });
      mockWechatPayService.transferToWallet.mockImplementation(
        ({ outBatchNo, outDetailNo }: { outBatchNo: string; outDetailNo: string }) => ({
          outBatchNo,
          outDetailNo,
          batchId: 'wx_batch_001',
        }),
      );

      const withdrawal = {
        id: 'w1',
        tenantId: 't1',
        memberId: 'm1',
        amount: new Decimal(50),
        fee: new Decimal(0),
        actualAmount: new Decimal(49),
        method: 'WECHAT_WALLET',
        realName: '测试用户',
        paymentNo: 'PRE_BATCH:PRE_DETAIL',
        status: WithdrawalStatus.PROCESSING,
      } as any;

      const result = await service.transfer(withdrawal);

      expect(mockWechatPayService.transferToWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          outBatchNo: 'PRE_BATCH',
          outDetailNo: 'PRE_DETAIL',
        }),
      );
      expect(result.paymentNo).toBe('PRE_BATCH:PRE_DETAIL');
    });

    it('Given 银行卡提现, When transfer, Then 返回人工打款回单号且不调用微信通道', async () => {
      const withdrawal = {
        id: 'w2',
        tenantId: 't1',
        memberId: 'm1',
        amount: new Decimal(88),
        actualAmount: new Decimal(88),
        method: 'BANK_CARD',
        status: WithdrawalStatus.PENDING,
      } as any;

      const result = await service.transfer(withdrawal);

      expect(mockWechatPayService.transferToWallet).not.toHaveBeenCalled();
      expect(result.paymentNo).toMatch(/^BANK_MANUAL_/);
    });
  });

  describe('queryStatus', () => {
    it('Given 微信提现流水号, When queryStatus, Then 返回微信明细状态', async () => {
      mockWechatPayService.queryTransferDetail.mockResolvedValue({
        status: 'SUCCESS',
        rawStatus: 'SUCCESS',
        finishTime: new Date('2026-04-23T12:00:00+08:00'),
      });

      const result = await (service as any).queryStatus('BATCH001:DETAIL001');

      expect(mockWechatPayService.queryTransferDetail).toHaveBeenCalledWith({
        outBatchNo: 'BATCH001',
        outDetailNo: 'DETAIL001',
      });
      expect(result).toEqual(
        expect.objectContaining({
          status: 'SUCCESS',
          rawStatus: 'SUCCESS',
        }),
      );
    });

    it('Given 人工银行卡回单号, When queryStatus, Then 直接返回成功', async () => {
      const result = await (service as any).queryStatus('BANK_MANUAL_w2');

      expect(result).toEqual(
        expect.objectContaining({
          status: 'SUCCESS',
          rawStatus: 'MANUAL_CONFIRMED',
        }),
      );
      expect(mockWechatPayService.queryTransferDetail).not.toHaveBeenCalled();
    });
  });
});
