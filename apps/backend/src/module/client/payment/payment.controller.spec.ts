import { HttpException, HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Request } from 'express';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  const paymentService = {
    handleCallback: jest.fn(),
    handleRefundCallback: jest.fn(),
  };

  let controller: PaymentController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PaymentController(paymentService as unknown as PaymentService);
  });

  describe('refundNotify', () => {
    it('Given 微信退款回调处理成功, When refundNotify, Then HTTP 显式返回 200 SUCCESS', async () => {
      paymentService.handleRefundCallback.mockResolvedValue({ status: 'SUCCESS' });
      const req = { rawBody: 'raw-refund-body' } as Request & { rawBody: string };

      const result = await controller.refundNotify(req, { 'wechatpay-signature': 'signed' });

      expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.refundNotify)).toBe(HttpStatus.OK);
      expect(paymentService.handleRefundCallback).toHaveBeenCalledWith(
        { 'wechatpay-signature': 'signed' },
        'raw-refund-body',
      );
      expect(result).toEqual({ code: 'SUCCESS', message: 'OK', status: 'SUCCESS' });
    });

    it('Given 微信退款回调处理失败, When refundNotify, Then 抛出非 2xx 让微信重试', async () => {
      paymentService.handleRefundCallback.mockRejectedValue(new Error('finalizer unavailable'));
      const req = { rawBody: 'raw-refund-body' } as Request & { rawBody: string };

      await expect(controller.refundNotify(req, {})).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('Given 缺少原始报文, When refundNotify, Then 抛出 400 且不执行业务处理', async () => {
      const req = { body: { encrypted: true } } as Request;

      await expect(controller.refundNotify(req, {})).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(paymentService.handleRefundCallback).not.toHaveBeenCalled();
    });
  });

  describe('notify', () => {
    it('Given 支付回调处理失败, When notify, Then 抛出非 2xx 让微信重试', async () => {
      paymentService.handleCallback.mockRejectedValue(new Error('event bus unavailable'));
      const req = { rawBody: 'raw-payment-body' } as Request & { rawBody: string };

      await expect(controller.notify(req, {})).rejects.toBeInstanceOf(HttpException);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.notify)).toBe(HttpStatus.OK);
    });
  });
});
