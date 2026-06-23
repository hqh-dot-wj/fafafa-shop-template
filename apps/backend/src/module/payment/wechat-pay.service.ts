import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import { readFile } from 'fs/promises';
import Wechatpay from 'wechatpay-node-v3';
import { toFen as moneyToFen } from '@libs/common-utils';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { getErrorMessage } from 'src/common/utils/error';
import { WechatPayConfig } from './config/wechat-pay.config';
import {
  IPaymentProvider,
  CreatePaymentOrderParams,
  CreatePaymentOrderResult,
  QueryPaymentOrderResult,
  RefundParams,
  RefundResult,
  QueryRefundResult,
  PaymentOrderStatus,
  RefundStatus,
} from './interfaces/payment-provider.interface';

/**
 * 微信支付服务
 *
 * @description 封装微信支付 SDK 初始化、JSAPI 下单、查询、退款与回调验签。
 * 主动外呼的 SDK / 网络异常统一转换为业务异常，避免裸 500 暴露到调用方。
 *
 * 参考文档：
 * - JSAPI 下单：https://pay.weixin.qq.com/docs/merchant/apis/jsapi-payment/direct-jsons/jsapi-prepay.html
 * - 申请退款：https://pay.weixin.qq.com/docs/merchant/apis/jsapi-payment/refund/create.html
 * - 退款结果通知：https://pay.weixin.qq.com/docs/merchant/apis/jsapi-payment/refund/refund-notice.html
 * - Node.js SDK：https://github.com/TheNorthMemory/wechatpay-node-v3
 */
@Injectable()
export class WechatPayService implements IPaymentProvider, OnModuleInit {
  private readonly logger = new Logger(WechatPayService.name);
  private readonly config: WechatPayConfig;
  private wxpay: InstanceType<typeof Wechatpay> | null = null;
  private wxPublicKeyCache: { publicKey: Buffer; serialNo: string } | null = null;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    // 配置验证移到 onModuleInit，避免测试时因配置缺失而失败
  }

  /**
   * 模块初始化时初始化微信支付 SDK
   */
  async onModuleInit() {
    if (!this.hasRequiredConfig()) {
      this.logger.warn('微信支付配置未完整提供，运行期将跳过 SDK 初始化并在实际调用时提示');
      return;
    }

    try {
      await this.initWxPay();
    } catch (error) {
      this.logger.error(`微信支付 SDK 初始化失败: ${getErrorMessage(error)}`);
      // 不抛出异常，允许服务启动，避免开发环境因未联通微信而无法启动
    }
  }

  /**
   * 加载配置
   */
  private loadConfig(): WechatPayConfig {
    return {
      appId: this.configService.get<string>('WECHAT_PAY_APP_ID', ''),
      mchId: this.configService.get<string>('WECHAT_PAY_MCH_ID', ''),
      apiKey: this.configService.get<string>('WECHAT_PAY_API_KEY', ''),
      apiV3Key: this.configService.get<string>('WECHAT_PAY_API_V3_KEY', ''),
      serialNo: this.configService.get<string>('WECHAT_PAY_SERIAL_NO', ''),
      privateKeyPath: this.configService.get<string>('WECHAT_PAY_PRIVATE_KEY_PATH', ''),
      notifyUrl: this.configService.get<string>('WECHAT_PAY_NOTIFY_URL', ''),
      refundNotifyUrl: this.configService.get<string>('WECHAT_PAY_REFUND_NOTIFY_URL', ''),
      sandbox: this.configService.get<boolean>('WECHAT_PAY_SANDBOX', false),
    };
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    BusinessException.throwIf(!this.config.appId, '微信支付 AppId 未配置', ResponseCode.EXTERNAL_SERVICE_ERROR);
    BusinessException.throwIf(!this.config.mchId, '微信支付商户号未配置', ResponseCode.EXTERNAL_SERVICE_ERROR);
    BusinessException.throwIf(!this.config.apiV3Key, '微信支付 API v3 密钥未配置', ResponseCode.EXTERNAL_SERVICE_ERROR);
    BusinessException.throwIf(!this.config.serialNo, '微信支付证书序列号未配置', ResponseCode.EXTERNAL_SERVICE_ERROR);
    BusinessException.throwIf(
      !this.config.privateKeyPath,
      '微信支付私钥路径未配置',
      ResponseCode.EXTERNAL_SERVICE_ERROR,
    );
    BusinessException.throwIf(!this.config.notifyUrl, '微信支付回调 URL 未配置', ResponseCode.EXTERNAL_SERVICE_ERROR);
    BusinessException.throwIf(
      !this.config.refundNotifyUrl,
      '微信退款回调 URL 未配置',
      ResponseCode.EXTERNAL_SERVICE_ERROR,
    );

    this.logger.log(`微信支付配置加载成功 [商户号: ${this.config.mchId}, 沙箱: ${this.config.sandbox}]`);
  }

  private hasRequiredConfig(): boolean {
    return !!(
      this.config.appId &&
      this.config.mchId &&
      this.config.apiV3Key &&
      this.config.serialNo &&
      this.config.privateKeyPath &&
      this.config.notifyUrl &&
      this.config.refundNotifyUrl
    );
  }

  /**
   * 初始化微信支付 SDK
   */
  private async initWxPay(): Promise<void> {
    try {
      // 读取商户私钥（转换为 Buffer）
      const privateKey = await readFile(this.config.privateKeyPath);

      // 初始化 SDK（publicKey 可选，SDK 会自动从微信获取平台证书）
      this.wxpay = new Wechatpay({
        appid: this.config.appId,
        mchid: this.config.mchId,
        serial_no: this.config.serialNo,
        privateKey: privateKey,
        key: this.config.apiV3Key,
        publicKey: Buffer.from(''), // 可选，SDK 会自动获取微信平台证书
      }) as any;

      this.logger.log('微信支付 SDK 初始化成功');
    } catch (error) {
      this.logger.error(`微信支付 SDK 初始化失败: ${getErrorMessage(error)}`);
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `微信支付 SDK 初始化失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 获取可用 SDK 客户端（按需懒加载）
   */
  private async getWxPayClient() {
    if (this.wxpay) {
      return this.wxpay;
    }

    BusinessException.throwIf(
      !this.hasRequiredConfig(),
      '微信支付配置未完成，无法调用真实支付通道',
      ResponseCode.EXTERNAL_SERVICE_ERROR,
    );

    this.validateConfig();
    await this.initWxPay();

    BusinessException.throwIf(!this.wxpay, '微信支付 SDK 未初始化，请检查配置', ResponseCode.BUSINESS_ERROR);
    return this.wxpay;
  }

  /**
   * 创建支付订单
   *
   */
  async createOrder(params: CreatePaymentOrderParams): Promise<CreatePaymentOrderResult> {
    this.logger.log(`创建支付订单: ${params.orderSn}, 金额: ${params.amount}`);

    const wxpayClient = await this.getWxPayClient();
    return this.withWechatPayOperation('预下单', async () => {
      const result = (await wxpayClient.transactions_jsapi({
        appid: this.config.appId,
        mchid: this.config.mchId,
        description: params.description,
        out_trade_no: params.orderSn,
        notify_url: this.config.notifyUrl,
        attach: params.attach,
        amount: {
          total: this.convertToFen(params.amount),
          currency: 'CNY',
        },
        payer: {
          openid: params.openId,
        },
        profit_sharing: params.profitSharing ?? false,
      } as any)) as any;

      const prepayId = result?.data?.prepay_id as string | undefined;
      BusinessException.throwIf(!prepayId, '微信预下单未返回 prepay_id', ResponseCode.EXTERNAL_SERVICE_ERROR);

      const nonceStr = randomBytes(16).toString('hex');
      const timeStamp = Math.floor(Date.now() / 1000).toString();
      const packageValue = `prepay_id=${prepayId}`;
      const paySign = wxpayClient.sha256WithRsa(`${this.config.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`);

      return {
        prepayId,
        paymentParams: {
          timeStamp,
          nonceStr,
          package: packageValue,
          signType: 'RSA',
          paySign,
        },
      };
    });
  }

  /**
   * 查询订单状态
   *
   */
  async queryOrder(orderSn: string): Promise<QueryPaymentOrderResult> {
    this.logger.log(`查询订单状态: ${orderSn}`);

    const wxpayClient = await this.getWxPayClient();
    return this.withWechatPayOperation('查询订单', async () => {
      const result = (await wxpayClient.query({
        out_trade_no: orderSn,
      })) as any;
      const data = result?.data;

      return {
        orderSn: (data?.out_trade_no as string) || orderSn,
        transactionId: (data?.transaction_id as string) || '',
        status: this.mapPaymentOrderStatus(data?.trade_state as string),
        amount: Number(data?.amount?.total ?? 0),
        payTime: data?.success_time ? new Date(data.success_time as string) : undefined,
      };
    });
  }

  /**
   * 申请退款
   */
  async refund(params: RefundParams): Promise<RefundResult> {
    this.logger.log(`申请退款: ${params.refundSn}, 金额: ${params.refundAmount}`);

    // 参数验证
    const refundAmount = new Decimal(params.refundAmount);
    const totalAmount = new Decimal(params.totalAmount);

    BusinessException.throwIf(refundAmount.lte(0), '退款金额必须大于 0', ResponseCode.BUSINESS_ERROR);

    BusinessException.throwIf(refundAmount.gt(totalAmount), '退款金额不能大于订单金额', ResponseCode.BUSINESS_ERROR);

    const wxpayClient = await this.getWxPayClient();

    const result = await this.withWechatPayOperation('退款', async () => {
      const result = (await wxpayClient.refunds({
        out_trade_no: params.orderSn,
        out_refund_no: params.refundSn,
        notify_url: this.config.refundNotifyUrl,
        amount: {
          refund: this.convertToFen(params.refundAmount),
          total: this.convertToFen(params.totalAmount),
          currency: 'CNY',
        },
        reason: params.reason || '订单退款',
      })) as any;

      return result;
    });

    this.logger.log(`微信退款成功: ${params.refundSn}, 微信退款单号: ${result.refund_id}`);

    return {
      refundSn: params.refundSn,
      refundId: result.refund_id as string,
      status: this.mapRefundStatus(result.status as string),
      amount: result.amount.refund as number,
      ...this.extractRefundAmountBreakdown(result as RefundAmountPayload),
      rawPayload: result as Record<string, unknown>,
    };
  }

  /**
   * 映射微信退款状态到系统状态
   */
  private mapRefundStatus(wxStatus: string): RefundStatus {
    const statusMap: Record<string, RefundStatus> = {
      SUCCESS: RefundStatus.SUCCESS,
      CLOSED: RefundStatus.CLOSED,
      CLOSE: RefundStatus.CLOSED,
      PROCESSING: RefundStatus.PROCESSING,
      ABNORMAL: RefundStatus.ABNORMAL,
    };

    const status = statusMap[wxStatus];
    BusinessException.throwIf(!status, `未知微信退款状态: ${wxStatus}`, ResponseCode.EXTERNAL_SERVICE_ERROR);
    return status;
  }

  private mapPaymentOrderStatus(wxStatus: string): PaymentOrderStatus {
    const statusMap: Record<string, PaymentOrderStatus> = {
      SUCCESS: PaymentOrderStatus.PAID,
      NOTPAY: PaymentOrderStatus.UNPAID,
      CLOSED: PaymentOrderStatus.CLOSED,
      REFUND: PaymentOrderStatus.REFUNDED,
      PAYERROR: PaymentOrderStatus.CLOSED,
    };

    return statusMap[wxStatus] || PaymentOrderStatus.UNPAID;
  }

  /**
   * 查询退款状态
   *
   */
  async queryRefund(refundSn: string): Promise<QueryRefundResult> {
    this.logger.log(`查询退款状态: ${refundSn}`);

    const wxpayClient = await this.getWxPayClient();
    return this.withWechatPayOperation('查询退款', async () => {
      const result = (await wxpayClient.find_refunds(refundSn)) as any;
      const data = result?.data;

      return {
        refundSn: (data?.out_refund_no as string) || refundSn,
        refundId: (data?.refund_id as string) || '',
        status: this.mapRefundStatus(data?.status as string),
        amount: Number(data?.amount?.refund ?? 0),
        ...this.extractRefundAmountBreakdown(data as RefundAmountPayload),
        successTime: data?.success_time ? new Date(data.success_time as string) : undefined,
        rawPayload: data as Record<string, unknown>,
      };
    });
  }

  private async withWechatPayOperation<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }

      this.logger.error(`微信支付${operation}失败: ${getErrorMessage(error)}`);
      throw new BusinessException(ResponseCode.EXTERNAL_SERVICE_ERROR, `微信支付${operation}失败，请稍后重试`);
    }
  }

  async parsePaymentCallback(headers: Record<string, string>, body: string) {
    const wxpayClient = await this.getWxPayClient();
    const normalizedHeaders = this.normalizeHeaders(headers);
    const timestamp = normalizedHeaders['wechatpay-timestamp'];
    const nonce = normalizedHeaders['wechatpay-nonce'];
    const serial = normalizedHeaders['wechatpay-serial'];
    const signature = normalizedHeaders['wechatpay-signature'];

    BusinessException.throwIf(
      !timestamp || !nonce || !serial || !signature,
      '支付回调头信息不完整',
      ResponseCode.BUSINESS_ERROR,
    );

    const verified = await wxpayClient.verifySign({
      timestamp,
      nonce,
      body,
      serial,
      signature,
      apiSecret: this.config.apiV3Key,
    });

    BusinessException.throwIf(!verified, '支付回调验签失败', ResponseCode.BUSINESS_ERROR);

    const rawBody = JSON.parse(body) as {
      resource?: {
        ciphertext: string;
        associated_data: string;
        nonce: string;
      };
    };
    BusinessException.throwIf(!rawBody.resource, '支付回调缺少 resource', ResponseCode.BUSINESS_ERROR);

    const payload = wxpayClient.decipher_gcm<{
      out_trade_no: string;
      transaction_id: string;
      amount?: { total?: number };
    }>(rawBody.resource.ciphertext, rawBody.resource.associated_data, rawBody.resource.nonce, this.config.apiV3Key);

    return {
      orderSn: payload.out_trade_no,
      transactionId: payload.transaction_id,
      payAmount: Number(payload.amount?.total ?? 0) / 100,
      rawPayload: payload,
    };
  }

  async parseRefundCallback(headers: Record<string, string>, body: string) {
    const wxpayClient = await this.getWxPayClient();
    const normalizedHeaders = this.normalizeHeaders(headers);
    const timestamp = normalizedHeaders['wechatpay-timestamp'];
    const nonce = normalizedHeaders['wechatpay-nonce'];
    const serial = normalizedHeaders['wechatpay-serial'];
    const signature = normalizedHeaders['wechatpay-signature'];

    BusinessException.throwIf(
      !timestamp || !nonce || !serial || !signature,
      '退款回调头信息不完整',
      ResponseCode.BUSINESS_ERROR,
    );

    const verified = await wxpayClient.verifySign({
      timestamp,
      nonce,
      body,
      serial,
      signature,
      apiSecret: this.config.apiV3Key,
    });

    BusinessException.throwIf(!verified, '退款回调验签失败', ResponseCode.BUSINESS_ERROR);

    const rawBody = JSON.parse(body) as {
      resource?: {
        ciphertext: string;
        associated_data: string;
        nonce: string;
      };
    };
    BusinessException.throwIf(!rawBody.resource, '退款回调缺少 resource', ResponseCode.BUSINESS_ERROR);

    const payload = wxpayClient.decipher_gcm<{
      out_refund_no?: string;
      refund_id?: string;
      refund_status?: string;
      status?: string;
      success_time?: string;
      amount?: {
        refund?: number;
        payer_refund?: number;
        settlement_refund?: number;
        refund_fee?: number;
        discount_refund?: number;
        net_amount?: number;
      };
      refund_fee?: number;
      settlement_refund_fee?: number;
      discount_refund?: number;
      net_amount?: number;
    }>(rawBody.resource.ciphertext, rawBody.resource.associated_data, rawBody.resource.nonce, this.config.apiV3Key);

    const refundSn = payload.out_refund_no;
    const status = payload.refund_status ?? payload.status;
    BusinessException.throwIf(!refundSn || !status, '退款回调数据缺失', ResponseCode.PARAM_INVALID);

    return {
      refundSn,
      refundId: payload.refund_id ?? '',
      status: this.mapRefundStatus(status),
      amount: this.extractRefundAmount(payload),
      ...this.extractRefundAmountBreakdown(payload),
      successTime: payload.success_time ? new Date(payload.success_time) : undefined,
      rawPayload: payload as Record<string, unknown>,
    };
  }

  async ensureProfitSharingReceiver(params: {
    receiverType: string;
    receiverAccount: string;
    receiverName?: string | null;
  }) {
    const wxpayClient = await this.getWxPayClient();
    const mappedType = this.mapProfitSharingReceiverType(params.receiverType);
    const relationType = this.mapProfitSharingRelationType(params.receiverType);
    const { encryptedName, serialNo } = await this.prepareEncryptedSensitiveValue(params.receiverName ?? undefined);

    try {
      await wxpayClient.profitsharing_receivers_add({
        appid: mappedType === 'PERSONAL_OPENID' ? this.config.appId : undefined,
        type: mappedType,
        account: params.receiverAccount,
        name: encryptedName,
        relation_type: relationType,
        wx_serial_no: serialNo,
      } as any);
    } catch (error) {
      const message = getErrorMessage(error);
      if (
        message.includes('已存在') ||
        message.includes('already exists') ||
        message.includes('ACCOUNT_ALREADY_EXISTS') ||
        message.includes('RECEIVER_ALREADY_EXISTS')
      ) {
        this.logger.warn(`分账接收方已存在，跳过重复添加: ${params.receiverAccount}`);
        return;
      }

      throw error;
    }
  }

  async createProfitSharingOrder(params: {
    transactionId: string;
    outOrderNo: string;
    receivers: Array<{
      receiverType: string;
      receiverAccount: string;
      receiverName?: string | null;
      amount: Decimal | string;
      description: string;
    }>;
    unfreezeUnsplit?: boolean;
  }) {
    const wxpayClient = await this.getWxPayClient();
    const hasPersonalReceiver = params.receivers.some((receiver) =>
      ['MEMBER', 'PERSONAL_OPENID'].includes(receiver.receiverType),
    );

    const receivers = [];
    for (const receiver of params.receivers) {
      const { encryptedName, serialNo } = await this.prepareEncryptedSensitiveValue(receiver.receiverName ?? undefined);
      receivers.push({
        type: this.mapProfitSharingReceiverType(receiver.receiverType),
        account: receiver.receiverAccount,
        name: encryptedName,
        amount: this.convertToFen(receiver.amount),
        description: receiver.description,
        wxSerialNo: serialNo,
      });
    }

    const serialNo = receivers.find((item) => !!item.wxSerialNo)?.wxSerialNo;
    const result = (await wxpayClient.create_profitsharing_orders({
      appid: hasPersonalReceiver ? this.config.appId : undefined,
      transaction_id: params.transactionId,
      out_order_no: params.outOrderNo,
      receivers: receivers.map(({ wxSerialNo: _wxSerialNo, ...receiver }) => receiver),
      unfreeze_unsplit: params.unfreezeUnsplit ?? true,
      wx_serial_no: serialNo,
    } as any)) as any;

    const data = result?.data ?? {};
    return {
      orderId: (data.order_id as string) || null,
      status: this.mapProfitSharingExecutionStatus(
        data.state as string,
        data.receivers as Array<Record<string, string>> | undefined,
      ),
      rawState: (data.state as string) || 'PROCESSING',
      responsePayload: data,
    };
  }

  async queryProfitSharingOrder(params: { transactionId: string; outOrderNo: string }) {
    const wxpayClient = await this.getWxPayClient();
    const result = (await wxpayClient.query_profitsharing_orders(params.transactionId, params.outOrderNo)) as any;
    const data = result?.data ?? {};

    return {
      orderId: (data.order_id as string) || null,
      status: this.mapProfitSharingExecutionStatus(
        data.state as string,
        data.receivers as Array<Record<string, string>> | undefined,
      ),
      rawState: (data.state as string) || 'PROCESSING',
      responsePayload: data,
    };
  }

  async transferToWallet(params: {
    outBatchNo: string;
    outDetailNo: string;
    openId: string;
    amount: Decimal | string;
    description: string;
    realName?: string;
  }) {
    const wxpayClient = await this.getWxPayClient();
    const { encryptedName, serialNo } = await this.prepareEncryptedSensitiveValue(params.realName);
    const result = (await wxpayClient.batches_transfer({
      appid: this.config.appId,
      out_batch_no: params.outBatchNo,
      batch_name: '用户提现',
      batch_remark: params.description,
      total_amount: this.convertToFen(params.amount),
      total_num: 1,
      transfer_detail_list: [
        {
          out_detail_no: params.outDetailNo,
          transfer_amount: this.convertToFen(params.amount),
          transfer_remark: params.description,
          openid: params.openId,
          user_name: encryptedName,
        },
      ],
      wx_serial_no: serialNo,
    } as any)) as any;

    return {
      outBatchNo: params.outBatchNo,
      outDetailNo: params.outDetailNo,
      batchId: result?.data?.batch_id as string,
      createTime: result?.data?.create_time ? new Date(result.data.create_time as string) : undefined,
      responsePayload: result?.data ?? null,
    };
  }

  async queryTransferDetail(params: { outBatchNo: string; outDetailNo: string }) {
    const wxpayClient = await this.getWxPayClient();
    const result = (await wxpayClient.query_batches_transfer_detail({
      out_batch_no: params.outBatchNo,
      out_detail_no: params.outDetailNo,
    })) as any;
    const data = result?.data ?? {};

    return {
      status: this.mapTransferExecutionStatus(data.detail_status as string),
      rawStatus: (data.detail_status as string) || 'PROCESSING',
      finishTime: data.update_time ? new Date(data.update_time as string) : undefined,
      failReason: (data.fail_reason as string) || null,
      responsePayload: data,
    };
  }

  /**
   * 转换金额为分（微信支付要求传整数分）
   *
   * 微信金额入参只能是整数分；这里在支付适配层阻断小数分，避免渠道受理失败后被上层误判为业务退款成功。
   */
  private extractRefundAmount(payload: RefundAmountPayload): number | undefined {
    // 仅在真正的"退款金额"字段中找 fallback；refund_fee/settlement_refund_fee 是"手续费"概念，
    // 不能作为退款金额的 fallback（否则缺 amount.refund 时会把手续费当退款额写入金额列）。
    // 全部缺失时返回 undefined（而非兜底 0），避免下游 fenToYuan(0) 把已落库金额清零。
    const raw = payload.amount?.refund ?? payload.amount?.payer_refund ?? payload.amount?.settlement_refund;
    if (raw == null) {
      return undefined;
    }
    const num = Number(raw);
    return Number.isFinite(num) ? num : undefined;
  }

  private extractRefundAmountBreakdown(payload: RefundAmountPayload) {
    const payerRefundAmount = this.readFen(payload.amount?.payer_refund ?? payload.amount?.refund);
    const refundFeeAmount = this.readFen(
      payload.amount?.refund_fee ?? payload.refund_fee ?? payload.settlement_refund_fee,
    );
    const settlementRefundAmount = this.readFen(payload.amount?.settlement_refund);
    const discountRefundAmount = this.readFen(payload.amount?.discount_refund ?? payload.discount_refund);
    const explicitNetAmount = this.readFen(payload.amount?.net_amount ?? payload.net_amount);
    const netAmount =
      explicitNetAmount ??
      settlementRefundAmount ??
      (payerRefundAmount == null ? undefined : payerRefundAmount - (refundFeeAmount ?? 0));

    return {
      // 字段缺失统一保留 undefined（与 payerRefundAmount/settlementRefundAmount 对称），
      // 避免兜底 0 经 fenToYuan(0)=0.00 清零已落库的 fee/discount。
      payerRefundAmount,
      settlementRefundAmount,
      refundFeeAmount,
      discountRefundAmount,
      netAmount,
    };
  }

  private readFen(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private convertToFen(amount: Decimal | string): number {
    BusinessException.throwIf(
      typeof amount === 'number',
      '微信金额入参禁止使用 number，请传 Decimal 或 string',
      ResponseCode.BUSINESS_ERROR,
    );

    try {
      return moneyToFen(amount);
    } catch (error) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `金额不能转换为整数分: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 转换金额为元
   */
  private convertToYuan(fen: number): string {
    return new Decimal(fen).div(100).toFixed(2);
  }

  private normalizeHeaders(headers: Record<string, string>) {
    return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key.toLowerCase()] = value;
      return acc;
    }, {});
  }

  private mapProfitSharingReceiverType(receiverType: string): 'MERCHANT_ID' | 'PERSONAL_OPENID' {
    if (['MEMBER', 'PERSONAL_OPENID'].includes(receiverType)) {
      return 'PERSONAL_OPENID';
    }

    return 'MERCHANT_ID';
  }

  private mapProfitSharingRelationType(receiverType: string) {
    if (['MEMBER', 'PERSONAL_OPENID'].includes(receiverType)) {
      return 'DISTRIBUTOR';
    }

    if (receiverType === 'TENANT') {
      return 'STORE';
    }

    return 'PARTNER';
  }

  private mapProfitSharingExecutionStatus(
    state: string,
    receivers?: Array<Record<string, string>>,
  ): ChannelExecutionStatus {
    if (state === 'FINISHED') {
      const receiverResults = receivers?.map((receiver) => receiver.result) ?? [];
      if (receiverResults.some((result) => result === 'CLOSED')) {
        return 'FAILED';
      }

      if (receiverResults.some((result) => ['PROCESSING', 'PENDING'].includes(result))) {
        return 'PROCESSING';
      }

      return 'SUCCESS';
    }

    if (state === 'CLOSED') {
      return 'FAILED';
    }

    return 'PROCESSING';
  }

  private mapTransferExecutionStatus(detailStatus: string): ChannelExecutionStatus {
    if (detailStatus === 'SUCCESS') {
      return 'SUCCESS';
    }

    if (['FAIL', 'REFUND'].includes(detailStatus)) {
      return 'FAILED';
    }

    return 'PROCESSING';
  }

  private async prepareEncryptedSensitiveValue(value?: string) {
    if (!value) {
      return {
        encryptedName: undefined,
        serialNo: undefined,
      };
    }

    const wxpayClient = await this.getWxPayClient();
    const publicKey = await this.getWechatPublicKey();

    return {
      encryptedName: wxpayClient.publicEncrypt(value, publicKey.publicKey),
      serialNo: publicKey.serialNo,
    };
  }

  private async getWechatPublicKey() {
    if (this.wxPublicKeyCache) {
      return this.wxPublicKeyCache;
    }

    const wxpayClient = await this.getWxPayClient();
    const certificates = (await wxpayClient.get_certificates(this.config.apiV3Key)) as Array<{
      serial_no: string;
      publicKey: string;
    }>;
    const latestCertificate = certificates[0];
    BusinessException.throwIf(
      !latestCertificate?.publicKey || !latestCertificate?.serial_no,
      '未获取到微信支付公钥，无法加密敏感字段',
      ResponseCode.EXTERNAL_SERVICE_ERROR,
    );

    this.wxPublicKeyCache = {
      publicKey: Buffer.from(latestCertificate.publicKey),
      serialNo: latestCertificate.serial_no,
    };

    return this.wxPublicKeyCache;
  }
}

type ChannelExecutionStatus = 'PROCESSING' | 'SUCCESS' | 'FAILED';

type RefundAmountPayload = {
  amount?: {
    refund?: number;
    payer_refund?: number;
    settlement_refund?: number;
    refund_fee?: number;
    discount_refund?: number;
    net_amount?: number;
  };
  refund_fee?: number;
  settlement_refund_fee?: number;
  discount_refund?: number;
  net_amount?: number;
};
