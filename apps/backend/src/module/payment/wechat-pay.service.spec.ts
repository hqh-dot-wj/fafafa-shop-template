import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WechatPayService } from './wechat-pay.service';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { RefundStatus, PaymentOrderStatus } from './interfaces/payment-provider.interface';

describe('WechatPayService', () => {
  let service: WechatPayService;

  const mockWxPayClient = {
    transactions_jsapi: jest.fn(),
    query: jest.fn(),
    refunds: jest.fn(),
    find_refunds: jest.fn(),
    sha256WithRsa: jest.fn(() => 'signed_payload'),
    verifySign: jest.fn(),
    decipher_gcm: jest.fn(),
  };

  const mockConfig: Record<string, string | boolean> = {
    WECHAT_PAY_APP_ID: 'wx1234567890abcdef',
    WECHAT_PAY_MCH_ID: '1234567890',
    WECHAT_PAY_API_KEY: 'test_api_key',
    WECHAT_PAY_API_V3_KEY: 'test_api_v3_key',
    WECHAT_PAY_SERIAL_NO: 'test_serial_no',
    WECHAT_PAY_PRIVATE_KEY_PATH: '/path/to/private_key.pem',
    WECHAT_PAY_NOTIFY_URL: 'https://example.com/api/client/payment/notify',
    WECHAT_PAY_REFUND_NOTIFY_URL: 'https://example.com/api/client/payment/refund-notify',
    WECHAT_PAY_SANDBOX: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WechatPayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => mockConfig[key] || defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<WechatPayService>(WechatPayService);
    (service as any).wxpay = mockWxPayClient;

    mockWxPayClient.transactions_jsapi.mockReset();
    mockWxPayClient.query.mockReset();
    mockWxPayClient.refunds.mockReset();
    mockWxPayClient.find_refunds.mockReset();
    mockWxPayClient.sha256WithRsa.mockClear();
    mockWxPayClient.verifySign.mockReset();
    mockWxPayClient.decipher_gcm.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    it('should create payment order successfully with sdk and profit sharing flag', async () => {
      mockWxPayClient.transactions_jsapi.mockResolvedValue({
        status: 200,
        data: {
          prepay_id: 'prepay_real_001',
        },
      });

      const params = {
        orderSn: 'ORDER123456',
        amount: '100.00',
        description: 'Test Order',
        openId: 'oTest123456',
        profitSharing: true,
      };

      const result = await service.createOrder(params);

      expect(mockWxPayClient.transactions_jsapi).toHaveBeenCalledWith(
        expect.objectContaining({
          out_trade_no: 'ORDER123456',
          description: 'Test Order',
          profit_sharing: true,
          payer: {
            openid: 'oTest123456',
          },
          amount: expect.objectContaining({
            total: 10000,
            currency: 'CNY',
          }),
        }),
      );
      expect(result.prepayId).toBe('prepay_real_001');
      expect(result.paymentParams).toBeDefined();
      expect(result.paymentParams.timeStamp).toBeDefined();
      expect(result.paymentParams.nonceStr).toBeDefined();
      expect(result.paymentParams.package).toBe('prepay_id=prepay_real_001');
      expect(result.paymentParams.signType).toBe('RSA');
      expect(result.paymentParams.paySign).toBe('signed_payload');
      expect(mockWxPayClient.sha256WithRsa).toHaveBeenCalled();
    });

    it('should wrap sdk failure as external service error', async () => {
      mockWxPayClient.transactions_jsapi.mockRejectedValue(new Error('network timeout'));

      await expect(
        service.createOrder({
          orderSn: 'ORDER123456',
          amount: '100.00',
          description: 'Test Order',
          openId: 'oTest123456',
        }),
      ).rejects.toMatchObject({
        errorCode: ResponseCode.EXTERNAL_SERVICE_ERROR,
      });
    });

    it('should reject fractional-cent amount before calling sdk', async () => {
      await expect(
        service.createOrder({
          orderSn: 'ORDER123456',
          amount: '19.901',
          description: 'Test Order',
          openId: 'oTest123456',
        }),
      ).rejects.toMatchObject({
        errorCode: ResponseCode.BUSINESS_ERROR,
      });
      expect(mockWxPayClient.transactions_jsapi).not.toHaveBeenCalled();
    });

    it('should reject number amount before calling sdk', async () => {
      await expect(
        service.createOrder({
          orderSn: 'ORDER123456',
          amount: 19.9 as any,
          description: 'Test Order',
          openId: 'oTest123456',
        }),
      ).rejects.toMatchObject({
        errorCode: ResponseCode.BUSINESS_ERROR,
      });
      expect(mockWxPayClient.transactions_jsapi).not.toHaveBeenCalled();
    });
  });

  describe('queryOrder', () => {
    it('should query order status successfully from sdk response', async () => {
      mockWxPayClient.query.mockResolvedValue({
        status: 200,
        data: {
          out_trade_no: 'ORDER123456',
          transaction_id: '4200000000001',
          trade_state: 'SUCCESS',
          amount: {
            total: 10000,
          },
          success_time: '2026-04-23T10:00:00+08:00',
        },
      });

      const orderSn = 'ORDER123456';

      const result = await service.queryOrder(orderSn);

      expect(mockWxPayClient.query).toHaveBeenCalledWith({
        out_trade_no: orderSn,
      });
      expect(result.orderSn).toBe(orderSn);
      expect(result.transactionId).toBe('4200000000001');
      expect(result.status).toBe(PaymentOrderStatus.PAID);
      expect(result.amount).toBe(10000);
      expect(result.payTime).toBeInstanceOf(Date);
    });

    it('should wrap sdk failure as external service error', async () => {
      mockWxPayClient.query.mockRejectedValue(new Error('wechat unavailable'));

      await expect(service.queryOrder('ORDER123456')).rejects.toMatchObject({
        errorCode: ResponseCode.EXTERNAL_SERVICE_ERROR,
      });
    });
  });

  describe('refund', () => {
    it('should process refund successfully', async () => {
      mockWxPayClient.refunds.mockResolvedValue({
        refund_id: '503000000001',
        status: 'SUCCESS',
        amount: {
          refund: 5000,
          payer_refund: 5000,
          settlement_refund: 4988,
          refund_fee: 12,
        },
      });

      const params = {
        orderSn: 'ORDER123456',
        refundSn: 'REFUND123456',
        refundAmount: '50.00',
        totalAmount: '100.00',
        reason: 'Test Refund',
      };

      const result = await service.refund(params);

      expect(result.refundSn).toBe(params.refundSn);
      expect(result.refundId).toBe('503000000001');
      expect(result.status).toBe(RefundStatus.SUCCESS);
      expect(result.amount).toBe(5000); // 50.00 元 = 5000 分
      expect(result.payerRefundAmount).toBe(5000);
      expect(result.settlementRefundAmount).toBe(4988);
      expect(result.refundFeeAmount).toBe(12);
      expect(mockWxPayClient.refunds).toHaveBeenCalledWith(
        expect.objectContaining({
          out_trade_no: params.orderSn,
          out_refund_no: params.refundSn,
          notify_url: 'https://example.com/api/client/payment/refund-notify',
          amount: {
            refund: 5000,
            total: 10000,
            currency: 'CNY',
          },
          reason: params.reason,
        }),
      );
    });

    it('should throw error when refund amount is zero', async () => {
      const params = {
        orderSn: 'ORDER123456',
        refundSn: 'REFUND123456',
        refundAmount: '0',
        totalAmount: '100.00',
      };

      await expect(service.refund(params)).rejects.toThrow(BusinessException);
    });

    it('should throw error when refund amount exceeds total amount', async () => {
      const params = {
        orderSn: 'ORDER123456',
        refundSn: 'REFUND123456',
        refundAmount: '150.00',
        totalAmount: '100.00',
      };

      await expect(service.refund(params)).rejects.toThrow(BusinessException);
    });

    it('should reject fractional-cent refund amount before calling sdk', async () => {
      await expect(
        service.refund({
          orderSn: 'ORDER123456',
          refundSn: 'REFUND123456',
          refundAmount: '0.001',
          totalAmount: '100.00',
        }),
      ).rejects.toMatchObject({
        errorCode: ResponseCode.BUSINESS_ERROR,
      });
      expect(mockWxPayClient.refunds).not.toHaveBeenCalled();
    });

    it('should handle partial refund', async () => {
      mockWxPayClient.refunds.mockResolvedValue({
        refund_id: '503000000002',
        status: 'PROCESSING',
        amount: {
          refund: 3050,
        },
      });

      const params = {
        orderSn: 'ORDER123456',
        refundSn: 'REFUND123456',
        refundAmount: '30.50',
        totalAmount: '100.00',
        reason: 'Partial Refund',
      };

      const result = await service.refund(params);

      expect(result.refundSn).toBe(params.refundSn);
      expect(result.status).toBe(RefundStatus.PROCESSING);
      expect(result.amount).toBe(3050); // 30.50 元 = 3050 分
    });

    it('Given 微信查询返回 CLOSE, When queryRefund, Then 映射为 CLOSED 而不是 PROCESSING', async () => {
      const refundSn = 'REFUND123456';
      mockWxPayClient.find_refunds.mockResolvedValue({
        data: {
          out_refund_no: refundSn,
          refund_id: '503000000003',
          status: 'CLOSE',
          amount: {
            refund: 5000,
          },
        },
      });

      const result = await service.queryRefund(refundSn);

      expect(result.status).toBe(RefundStatus.CLOSED);
    });
  });

  describe('parsePaymentCallback', () => {
    const headers = {
      'Wechatpay-Timestamp': '1713852000',
      'Wechatpay-Nonce': 'nonce-001',
      'Wechatpay-Serial': 'serial-001',
      'Wechatpay-Signature': 'signature-001',
    };

    const body = JSON.stringify({
      resource: {
        ciphertext: 'cipher-text',
        associated_data: 'associated-data',
        nonce: 'resource-nonce',
      },
    });

    it('should verify signature and decrypt payment callback', async () => {
      mockWxPayClient.verifySign.mockResolvedValue(true);
      mockWxPayClient.decipher_gcm.mockReturnValue({
        out_trade_no: 'ORDER123456',
        transaction_id: '4200000000001',
        amount: {
          total: 10000,
        },
      });

      const result = await service.parsePaymentCallback(headers, body);

      expect(mockWxPayClient.verifySign).toHaveBeenCalledWith({
        timestamp: '1713852000',
        nonce: 'nonce-001',
        body,
        serial: 'serial-001',
        signature: 'signature-001',
        apiSecret: 'test_api_v3_key',
      });
      expect(mockWxPayClient.decipher_gcm).toHaveBeenCalledWith(
        'cipher-text',
        'associated-data',
        'resource-nonce',
        'test_api_v3_key',
      );
      expect(result).toEqual({
        orderSn: 'ORDER123456',
        transactionId: '4200000000001',
        payAmount: 100,
        rawPayload: {
          out_trade_no: 'ORDER123456',
          transaction_id: '4200000000001',
          amount: {
            total: 10000,
          },
        },
      });
    });

    it('should reject callback with incomplete headers', async () => {
      await expect(service.parsePaymentCallback({}, body)).rejects.toThrow(BusinessException);
      expect(mockWxPayClient.verifySign).not.toHaveBeenCalled();
    });

    it('should reject callback when signature verification fails', async () => {
      mockWxPayClient.verifySign.mockResolvedValue(false);

      await expect(service.parsePaymentCallback(headers, body)).rejects.toThrow(BusinessException);
      expect(mockWxPayClient.decipher_gcm).not.toHaveBeenCalled();
    });

    it('should reject callback without encrypted resource', async () => {
      mockWxPayClient.verifySign.mockResolvedValue(true);

      await expect(service.parsePaymentCallback(headers, '{}')).rejects.toThrow(BusinessException);
      expect(mockWxPayClient.decipher_gcm).not.toHaveBeenCalled();
    });
  });

  describe('parseRefundCallback', () => {
    const headers = {
      'Wechatpay-Timestamp': '1713852000',
      'Wechatpay-Nonce': 'nonce-001',
      'Wechatpay-Serial': 'serial-001',
      'Wechatpay-Signature': 'signature-001',
    };

    const body = JSON.stringify({
      resource: {
        ciphertext: 'refund-cipher-text',
        associated_data: 'refund-associated-data',
        nonce: 'refund-resource-nonce',
      },
    });

    it('Given 微信退款回调 SUCCESS, When parseRefundCallback, Then 验签解密并返回商户退款单号与分金额', async () => {
      mockWxPayClient.verifySign.mockResolvedValue(true);
      mockWxPayClient.decipher_gcm.mockReturnValue({
        out_refund_no: 'REFUND_ORDER123_FULL',
        refund_id: '503000000001',
        refund_status: 'SUCCESS',
        success_time: '2026-05-18T10:00:00+08:00',
        amount: {
          refund: 1990,
          payer_refund: 1990,
          settlement_refund: 1988,
          refund_fee: 2,
          discount_refund: 0,
        },
      });

      const result = await service.parseRefundCallback(headers, body);

      expect(mockWxPayClient.verifySign).toHaveBeenCalledWith({
        timestamp: '1713852000',
        nonce: 'nonce-001',
        body,
        serial: 'serial-001',
        signature: 'signature-001',
        apiSecret: 'test_api_v3_key',
      });
      expect(mockWxPayClient.decipher_gcm).toHaveBeenCalledWith(
        'refund-cipher-text',
        'refund-associated-data',
        'refund-resource-nonce',
        'test_api_v3_key',
      );
      expect(result).toMatchObject({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: '503000000001',
        status: RefundStatus.SUCCESS,
        amount: 1990,
        payerRefundAmount: 1990,
        settlementRefundAmount: 1988,
        refundFeeAmount: 2,
        discountRefundAmount: 0,
      });
      expect(result.successTime).toBeInstanceOf(Date);
    });

    it('Given 微信退款回调状态为 ABNORMAL, When parseRefundCallback, Then 不映射为成功', async () => {
      mockWxPayClient.verifySign.mockResolvedValue(true);
      mockWxPayClient.decipher_gcm.mockReturnValue({
        out_refund_no: 'REFUND_ORDER123_FULL',
        refund_id: '503000000001',
        refund_status: 'ABNORMAL',
        amount: {
          payer_refund: 1990,
        },
      });

      const result = await service.parseRefundCallback(headers, body);

      expect(result.status).toBe(RefundStatus.ABNORMAL);
      expect(result.amount).toBe(1990);
    });

    it('Given 退款回调缺少商户退款单号, When parseRefundCallback, Then 拒绝处理', async () => {
      mockWxPayClient.verifySign.mockResolvedValue(true);
      mockWxPayClient.decipher_gcm.mockReturnValue({
        refund_status: 'SUCCESS',
        amount: {
          refund: 1990,
        },
      });

      await expect(service.parseRefundCallback(headers, body)).rejects.toThrow(BusinessException);
    });
  });

  describe('queryRefund', () => {
    it('should query refund status successfully from sdk response', async () => {
      mockWxPayClient.find_refunds.mockResolvedValue({
        status: 200,
        data: {
          out_refund_no: 'REFUND123456',
          refund_id: '503000000001',
          status: 'SUCCESS',
          success_time: '2026-04-23T10:00:00+08:00',
          amount: {
            refund: 5000,
            payer_refund: 5000,
            settlement_refund: 4988,
            refund_fee: 12,
          },
        },
      });

      const refundSn = 'REFUND123456';

      const result = await service.queryRefund(refundSn);

      expect(mockWxPayClient.find_refunds).toHaveBeenCalledWith(refundSn);
      expect(result.refundSn).toBe(refundSn);
      expect(result.refundId).toBe('503000000001');
      expect(result.status).toBe(RefundStatus.SUCCESS);
      expect(result.amount).toBe(5000);
      expect(result.payerRefundAmount).toBe(5000);
      expect(result.settlementRefundAmount).toBe(4988);
      expect(result.refundFeeAmount).toBe(12);
      expect(result.successTime).toBeInstanceOf(Date);
    });

    it('should wrap sdk failure as external service error', async () => {
      mockWxPayClient.find_refunds.mockRejectedValue(new Error('wechat unavailable'));

      await expect(service.queryRefund('REFUND123456')).rejects.toMatchObject({
        errorCode: ResponseCode.EXTERNAL_SERVICE_ERROR,
      });
    });
  });

  describe('config validation', () => {
    it('should skip sdk init when required config is missing', async () => {
      const invalidConfig: Record<string, string | boolean> = { ...mockConfig, WECHAT_PAY_APP_ID: '' };

      const module = await Test.createTestingModule({
        providers: [
          WechatPayService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: unknown) => invalidConfig[key] || defaultValue),
            },
          },
        ],
      }).compile();

      const testService = module.get<WechatPayService>(WechatPayService);
      await expect(testService.onModuleInit()).resolves.toBeUndefined();
      expect((testService as any).wxpay).toBeNull();
    });
  });

  describe('sandbox integration boundary', () => {
    it('keeps real Wechat Pay sandbox calls out of unit tests', () => {
      expect(mockConfig.WECHAT_PAY_SANDBOX).toBe(false);
      expect(mockWxPayClient.transactions_jsapi).not.toHaveBeenCalledWith(expect.objectContaining({ sandbox: true }));
    });
  });
});
