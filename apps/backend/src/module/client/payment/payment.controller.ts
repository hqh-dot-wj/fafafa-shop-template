import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  Logger,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { PrepayDto, MockSuccessDto } from './dto/payment.dto';
import { Result } from 'src/common/response';
import { Member } from '../common/decorators/member.decorator';
import { MemberAuthGuard } from '../common/guards/member-auth.guard';

@ApiTags('C端-支付管理')
@Controller('client/payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 预下单
   *
   * @sloCategory payment
   * @sloLatency P99 < 200ms
   * @sloAvailability 99.99%
   */
  @Post('prepay')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '预下单' })
  async prepay(@Member('memberId') memberId: string, @Body() dto: PrepayDto) {
    const data = await this.paymentService.prepay(memberId, dto);
    return Result.ok(data);
  }

  /**
   * 模拟支付成功（测试）
   *
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('mock-success')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '模拟支付成功 (测试用)' })
  async mockSuccess(@Member('memberId') memberId: string, @Body() dto: MockSuccessDto) {
    const data = await this.paymentService.mockSuccess(memberId, dto.orderId);
    return Result.ok(data, '模拟支付成功');
  }

  /**
   * 支付回调（微信服务器调用，无需鉴权）
   * 幂等：同一 orderId 多次回调只处理一次
   *
   * @sloCategory payment
   * @sloLatency P99 < 200ms
   * @sloAvailability 99.99%
   */
  @Post('notify')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async notify(@Req() req: Request, @Headers() headers: Record<string, string>) {
    const body = this.getRawBody(req);

    if (!body) {
      this.logger.error('支付回调缺少原始报文，已拒绝处理');
      throw new HttpException({ code: 'FAIL', message: 'MISSING_RAW_BODY' }, HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.paymentService.handleCallback(headers, body);
      return { code: 'SUCCESS', message: 'OK', ...result };
    } catch (error) {
      const detail = error instanceof Error ? error.stack || error.message : String(error);
      this.logger.error('支付回调处理失败', detail);
      throw new HttpException({ code: 'FAIL', message: 'FAIL' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 退款结果回调（微信服务器调用，无需鉴权）
   * 幂等：同一 refundSn 多次回调只按 FinRefund 事实源终态收口一次
   */
  @Post('refund-notify')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async refundNotify(@Req() req: Request, @Headers() headers: Record<string, string>) {
    const body = this.getRawBody(req);

    if (!body) {
      this.logger.error('退款回调缺少原始报文，已拒绝处理');
      throw new HttpException({ code: 'FAIL', message: 'MISSING_RAW_BODY' }, HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.paymentService.handleRefundCallback(headers, body);
      return { code: 'SUCCESS', message: 'OK', ...result };
    } catch (error) {
      const detail = error instanceof Error ? error.stack || error.message : String(error);
      this.logger.error('退款回调处理失败', detail);
      throw new HttpException({ code: 'FAIL', message: 'FAIL' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private getRawBody(req: Request) {
    const rawBody = (req as Request & { rawBody?: Buffer | string }).rawBody;
    return typeof rawBody === 'string'
      ? rawBody
      : Buffer.isBuffer(rawBody)
        ? rawBody.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : null;
  }
}
