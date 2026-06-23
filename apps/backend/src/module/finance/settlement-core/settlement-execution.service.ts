import { Injectable } from '@nestjs/common';
import {
  ReconciliationStatus,
  SettlementBillStatus,
  SettlementChannelType,
  SettlementExecutionStatus,
  SettlementReceiverType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { PrismaService } from 'src/prisma/prisma.service';
import { WechatPayService } from 'src/module/payment/wechat-pay.service';

type SettlementBillLike = {
  id: string;
  billNo: string;
  orderId: string;
  tenantId: string;
  channelType: SettlementChannelType;
  payRecord?: { transactionId?: string | null } | null;
  items?: Array<{
    id: string;
    receiverType: SettlementReceiverType;
    receiverId: string;
    receiverName?: string | null;
    amount: Decimal | string;
    reason?: string | null;
  }>;
};

type SettlementExecutionLike = {
  id: string;
  executeNo: string;
  channelType: SettlementChannelType;
  requestPayload?: any;
};

export interface SettlementExecutionResult {
  executionStatus: SettlementExecutionStatus;
  billStatus: SettlementBillStatus;
  issueStatus: ReconciliationStatus;
  externalNo?: string | null;
  stage: string;
  message: string;
  requestPayload?: Record<string, any> | null;
  responsePayload?: Record<string, any> | null;
  failureReason?: string | null;
}

@Injectable()
export class SettlementExecutionService {
  constructor(
    private readonly wechatPayService: WechatPayService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    executeNo: string;
    operator: string;
    channelType: SettlementChannelType;
    bill: SettlementBillLike;
  }): Promise<SettlementExecutionResult> {
    switch (input.channelType) {
      case SettlementChannelType.WECHAT_PROFITSHARING:
        return this.executeWechatProfitsharing(input);
      case SettlementChannelType.WECHAT_TRANSFER:
        return this.executeWechatTransfer(input);
      case SettlementChannelType.BANK_TRANSFER:
      case SettlementChannelType.OFFLINE_TRANSFER:
        return {
          executionStatus: SettlementExecutionStatus.PROCESSING,
          billStatus: SettlementBillStatus.EXECUTING,
          issueStatus: ReconciliationStatus.WAITING,
          stage: 'MANUAL_PENDING',
          message: '人工结算待回单确认',
          requestPayload: {
            operator: input.operator,
            mode: 'manual',
          },
          responsePayload: null,
        };
      default:
        throw new BusinessException(400, '不支持的结算通道');
    }
  }

  async query(input: {
    execution: SettlementExecutionLike;
    bill: SettlementBillLike;
  }): Promise<SettlementExecutionResult> {
    switch (input.execution.channelType) {
      case SettlementChannelType.WECHAT_PROFITSHARING:
        return this.queryWechatProfitsharing(input);
      case SettlementChannelType.WECHAT_TRANSFER:
        return this.queryWechatTransfer(input);
      case SettlementChannelType.BANK_TRANSFER:
      case SettlementChannelType.OFFLINE_TRANSFER:
        return {
          executionStatus: SettlementExecutionStatus.PROCESSING,
          billStatus: SettlementBillStatus.EXECUTING,
          issueStatus: ReconciliationStatus.WAITING,
          stage: 'MANUAL_PENDING',
          message: '人工结算等待财务确认',
        };
      default:
        throw new BusinessException(400, '不支持的结算通道');
    }
  }

  private async executeWechatProfitsharing(input: {
    executeNo: string;
    channelType: SettlementChannelType;
    bill: SettlementBillLike;
  }): Promise<SettlementExecutionResult> {
    const transactionId = input.bill.payRecord?.transactionId;
    BusinessException.throwIf(!transactionId, '微信分账缺少支付流水号');
    BusinessException.throwIf(!input.bill.items?.length, '微信分账缺少结算明细');

    for (const item of input.bill.items) {
      await this.wechatPayService.ensureProfitSharingReceiver({
        receiverType: item.receiverType,
        receiverAccount: item.receiverId,
        receiverName: item.receiverName,
      });
    }

    const result = await this.wechatPayService.createProfitSharingOrder({
      transactionId,
      outOrderNo: input.executeNo,
      receivers: input.bill.items.map((item) => ({
        receiverType: item.receiverType,
        receiverAccount: item.receiverId,
        receiverName: item.receiverName,
        amount: new Decimal(item.amount).toFixed(2),
        description: item.reason ?? '订单分账',
      })),
      unfreezeUnsplit: true,
    });

    return this.buildChannelResult({
      externalNo: result.orderId,
      channelStatus: result.status,
      requestPayload: {
        transactionId,
        outOrderNo: input.executeNo,
      },
      responsePayload: result.responsePayload,
      successMessage: '微信分账已完成',
      processingMessage: '微信分账已受理，等待异步处理',
      failureMessage: '微信分账失败',
    });
  }

  private async queryWechatProfitsharing(input: {
    execution: SettlementExecutionLike;
    bill: SettlementBillLike;
  }): Promise<SettlementExecutionResult> {
    const transactionId = input.bill.payRecord?.transactionId;
    BusinessException.throwIf(!transactionId, '微信分账查询缺少支付流水号');

    const result = await this.wechatPayService.queryProfitSharingOrder({
      transactionId,
      outOrderNo: input.execution.executeNo,
    });

    return this.buildChannelResult({
      externalNo: result.orderId,
      channelStatus: result.status,
      responsePayload: result.responsePayload,
      successMessage: '微信分账已完成',
      processingMessage: '微信分账处理中',
      failureMessage: '微信分账确认失败',
    });
  }

  private async executeWechatTransfer(input: {
    executeNo: string;
    channelType: SettlementChannelType;
    bill: SettlementBillLike;
  }): Promise<SettlementExecutionResult> {
    BusinessException.throwIf(!input.bill.items?.length, '微信提现缺少结算明细');

    const transferTargets = [];
    for (const item of input.bill.items) {
      const openId = await this.resolveMemberOpenId(item);
      transferTargets.push({
        ...item,
        openId,
      });
    }

    const amount = transferTargets.reduce((sum, item) => sum.add(new Decimal(item.amount)), new Decimal(0));
    const result = await this.wechatPayService.transferToWallet({
      outBatchNo: input.executeNo.slice(0, 32),
      outDetailNo: `${input.executeNo.slice(0, 24)}D1`.slice(0, 32),
      openId: transferTargets[0].openId,
      amount,
      description: '订单结算',
      realName: transferTargets[0].receiverName ?? undefined,
    });

    return {
      executionStatus: SettlementExecutionStatus.PROCESSING,
      billStatus: SettlementBillStatus.EXECUTING,
      issueStatus: ReconciliationStatus.WAITING,
      externalNo: result.batchId ?? `${result.outBatchNo}:${result.outDetailNo}`,
      stage: 'WECHAT_TRANSFER_ACCEPTED',
      message: '微信提现已受理，等待明细结果',
      requestPayload: {
        outBatchNo: result.outBatchNo,
        outDetailNo: result.outDetailNo,
      },
      responsePayload: result.responsePayload,
    };
  }

  private async queryWechatTransfer(input: { execution: SettlementExecutionLike }): Promise<SettlementExecutionResult> {
    const outBatchNo = input.execution.requestPayload?.outBatchNo as string | undefined;
    const outDetailNo = input.execution.requestPayload?.outDetailNo as string | undefined;
    BusinessException.throwIf(!outBatchNo || !outDetailNo, '微信提现查询缺少批次信息');

    const result = await this.wechatPayService.queryTransferDetail({
      outBatchNo,
      outDetailNo,
    });

    return this.buildChannelResult({
      externalNo: `${outBatchNo}:${outDetailNo}`,
      channelStatus: result.status,
      responsePayload: result.responsePayload,
      failureReason: result.failReason,
      successMessage: '微信提现已完成',
      processingMessage: '微信提现处理中',
      failureMessage: '微信提现失败',
    });
  }

  private async resolveMemberOpenId(item: SettlementBillLike['items'][number]) {
    if (item.receiverType !== SettlementReceiverType.MEMBER) {
      throw new BusinessException(400, '微信提现仅支持会员接收方');
    }

    const social = await this.prisma.sysSocialUser.findFirst({
      where: {
        memberId: item.receiverId,
      },
      orderBy: {
        socialId: 'asc',
      },
    });

    BusinessException.throwIf(!social?.openid, '未找到会员微信 OpenID，无法发起微信提现');
    return social.openid;
  }

  private buildChannelResult(input: {
    externalNo?: string | null;
    channelStatus: 'SUCCESS' | 'PROCESSING' | 'FAILED';
    requestPayload?: Record<string, any> | null;
    responsePayload?: Record<string, any> | null;
    failureReason?: string | null;
    successMessage: string;
    processingMessage: string;
    failureMessage: string;
  }): SettlementExecutionResult {
    if (input.channelStatus === 'SUCCESS') {
      return {
        executionStatus: SettlementExecutionStatus.SUCCESS,
        billStatus: SettlementBillStatus.SUCCESS,
        issueStatus: ReconciliationStatus.MATCHED,
        externalNo: input.externalNo,
        stage: 'CHANNEL_SUCCESS',
        message: input.successMessage,
        requestPayload: input.requestPayload,
        responsePayload: input.responsePayload,
      };
    }

    if (input.channelStatus === 'FAILED') {
      return {
        executionStatus: SettlementExecutionStatus.FAILED,
        billStatus: SettlementBillStatus.FAILED,
        issueStatus: ReconciliationStatus.UNMATCHED,
        externalNo: input.externalNo,
        stage: 'CHANNEL_FAILED',
        message: input.failureMessage,
        requestPayload: input.requestPayload,
        responsePayload: input.responsePayload,
        failureReason: input.failureReason ?? input.failureMessage,
      };
    }

    return {
      executionStatus: SettlementExecutionStatus.PROCESSING,
      billStatus: SettlementBillStatus.EXECUTING,
      issueStatus: ReconciliationStatus.WAITING,
      externalNo: input.externalNo,
      stage: 'CHANNEL_PROCESSING',
      message: input.processingMessage,
      requestPayload: input.requestPayload,
      responsePayload: input.responsePayload,
    };
  }
}
