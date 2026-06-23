import { Injectable, Logger } from '@nestjs/common';
import { FinWithdrawal } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { WechatPayService } from 'src/module/payment/wechat-pay.service';
import { BusinessException } from 'src/common/exceptions';

type WithdrawalChannelStatus = 'PROCESSING' | 'SUCCESS' | 'FAILED';
type WithdrawalPaymentIdentity = Pick<FinWithdrawal, 'id' | 'method' | 'paymentNo'>;

@Injectable()
export class WithdrawalPaymentService {
  private readonly logger = new Logger(WithdrawalPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatPayService: WechatPayService,
  ) {}

  /**
   * 执行外部打款
   * - 微信零钱：调用微信商家转账
   * - 银行卡：当前作为人工出款回单登记
   */
  async transfer(withdrawal: FinWithdrawal): Promise<{ paymentNo: string; channelStatus: WithdrawalChannelStatus }> {
    const paymentNo = this.buildPaymentNo(withdrawal);

    if (withdrawal.method === 'WECHAT_WALLET') {
      const social = await this.prisma.sysSocialUser.findFirst({
        where: {
          memberId: withdrawal.memberId,
        },
        orderBy: {
          socialId: 'asc',
        },
      });

      BusinessException.throwIf(!social?.openid, '未找到用户微信 OpenID，无法发起微信零钱打款');

      const { outBatchNo, outDetailNo } = this.parseWechatPaymentNo(paymentNo);
      const amount = (withdrawal.actualAmount ?? withdrawal.amount) as Decimal;

      const result = await this.wechatPayService.transferToWallet({
        outBatchNo,
        outDetailNo,
        openId: social.openid,
        amount,
        description: '用户提现',
        realName: withdrawal.realName ?? undefined,
      });

      this.logger.log(`提现微信打款已受理: ${withdrawal.id}, batch=${result.outBatchNo}, detail=${result.outDetailNo}`);

      return {
        paymentNo,
        channelStatus: 'PROCESSING',
      };
    }

    this.logger.log(`提现银行卡打款按人工回单处理: ${withdrawal.id}, paymentNo=${paymentNo}`);
    return {
      paymentNo,
      channelStatus: 'SUCCESS',
    };
  }

  buildPaymentNo(withdrawal: WithdrawalPaymentIdentity) {
    if (withdrawal.paymentNo) {
      return withdrawal.paymentNo;
    }

    if (withdrawal.method === 'WECHAT_WALLET') {
      return `${this.buildOutBatchNo(withdrawal.id)}:${this.buildOutDetailNo(withdrawal.id)}`;
    }

    return `BANK_MANUAL_${withdrawal.id}`;
  }

  async queryStatus(
    paymentNo: string,
  ): Promise<{ status: WithdrawalChannelStatus; rawStatus: string; finishTime?: Date; failReason?: string | null }> {
    if (paymentNo.startsWith('BANK_MANUAL_')) {
      return {
        status: 'SUCCESS',
        rawStatus: 'MANUAL_CONFIRMED',
      };
    }

    const { outBatchNo, outDetailNo } = this.parseWechatPaymentNo(paymentNo);

    return this.wechatPayService.queryTransferDetail({
      outBatchNo,
      outDetailNo,
    });
  }

  private buildOutBatchNo(withdrawalId: string) {
    return `WD_BAT_${withdrawalId.replace(/[^0-9A-Za-z]/g, '').slice(0, 20)}`.slice(0, 32);
  }

  private buildOutDetailNo(withdrawalId: string) {
    return `WD_DTL_${withdrawalId.replace(/[^0-9A-Za-z]/g, '').slice(0, 20)}`.slice(0, 32);
  }

  private parseWechatPaymentNo(paymentNo: string) {
    const [outBatchNo, outDetailNo, extra] = paymentNo.split(':');
    BusinessException.throwIf(!outBatchNo || !outDetailNo || !!extra, '提现支付流水号格式不正确');
    return { outBatchNo, outDetailNo };
  }
}
