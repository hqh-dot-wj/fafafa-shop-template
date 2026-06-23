import { Injectable, Logger } from '@nestjs/common';
import DysmsapiClient from '@alicloud/dysmsapi20170525';
import { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import { $OpenApiUtil } from '@alicloud/openapi-core';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response/response.interface';
import type { PlainSmsPayload, VerificationSmsPayload } from './verification-sms.types';

/** 运行时读取 env，避免模块加载早于 dotenv/Jest 注入导致模板号恒为空 */
function templateCodeForVerificationScene(scene: string): string | undefined {
  const map: Record<string, string | undefined> = {
    member_login: process.env.ALIYUN_SMS_TEMPLATE_MEMBER_LOGIN,
    member_reset_password: process.env.ALIYUN_SMS_TEMPLATE_MEMBER_RESET,
    admin_login: process.env.ALIYUN_SMS_TEMPLATE_ADMIN_LOGIN,
    admin_reset_password: process.env.ALIYUN_SMS_TEMPLATE_ADMIN_RESET,
  };
  return map[scene];
}

/**
 * 阿里云短信：使用 dysmsapi20170525 SDK 调用 SendSms。
 * 验证码模板变量：{ code, min }，与控制台模板 ${code}、${min} 对齐。
 * 通知模板变量：{ content }，需与 ALIYUN_SMS_TEMPLATE_NOTIFICATION 对应模板一致。
 */
@Injectable()
export class AliyunSmsProvider {
  private readonly logger = new Logger(AliyunSmsProvider.name);
  private client: DysmsapiClient | null = null;

  isReady(): boolean {
    const id = process.env.ALIYUN_SMS_ACCESS_KEY_ID?.trim();
    const secret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET?.trim();
    const sign = process.env.ALIYUN_SMS_SIGN_NAME?.trim();
    return Boolean(id && secret && sign);
  }

  private getClient(): DysmsapiClient {
    if (this.client) return this.client;
    const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID?.trim();
    const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET?.trim();
    BusinessException.throwIf(!accessKeyId || !accessKeySecret, '短信服务未正确配置', ResponseCode.SERVICE_UNAVAILABLE);
    const config = new $OpenApiUtil.Config({
      accessKeyId,
      accessKeySecret,
    });
    const endpoint = process.env.ALIYUN_SMS_ENDPOINT?.trim();
    if (endpoint) {
      config.endpoint = endpoint;
    }
    const regionId = process.env.ALIYUN_SMS_REGION_ID?.trim();
    if (regionId) {
      config.regionId = regionId;
    }
    this.client = new DysmsapiClient(config);
    return this.client;
  }

  private async dispatchSendSms(params: {
    phoneNumbers: string;
    templateCode: string;
    templateParam: string;
    context: string;
  }): Promise<void> {
    const signName = process.env.ALIYUN_SMS_SIGN_NAME?.trim();
    BusinessException.throwIf(!signName, '短信签名未配置', ResponseCode.SERVICE_UNAVAILABLE);

    const request = new SendSmsRequest({
      phoneNumbers: params.phoneNumbers,
      signName,
      templateCode: params.templateCode,
      templateParam: params.templateParam,
    });

    let response;
    try {
      response = await this.getClient().sendSms(request);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Aliyun SMS] 请求异常 ${msg} context=${params.context}`);
      throw new BusinessException(ResponseCode.SERVICE_UNAVAILABLE, `短信服务异常：${msg}`);
    }

    const body = response.body;
    const code = body?.code;
    if (code !== 'OK') {
      const aliyunMsg = body?.message ?? 'unknown';
      const requestId = body?.requestId ?? '';
      this.logger.warn(
        `[Aliyun SMS] 发送失败 code=${code} message=${aliyunMsg} requestId=${requestId} context=${params.context}`,
      );
      throw new BusinessException(ResponseCode.SERVICE_UNAVAILABLE, `短信发送失败：${aliyunMsg}`);
    }

    this.logger.log(
      `[Aliyun SMS] 已发送 bizId=${body?.bizId ?? ''} requestId=${body?.requestId ?? ''} ${params.context}`,
    );
  }

  async sendVerificationCode(payload: VerificationSmsPayload): Promise<void> {
    BusinessException.throwIf(!this.isReady(), '短信服务未正确配置', ResponseCode.SERVICE_UNAVAILABLE);
    const templateCode = templateCodeForVerificationScene(payload.scene);
    BusinessException.throwIf(!templateCode?.trim(), '短信模板未配置', ResponseCode.NOT_IMPLEMENTED);
    const min = String(payload.validMinutes ?? 5);
    const templateParam = JSON.stringify({ code: payload.code, min });
    await this.dispatchSendSms({
      phoneNumbers: payload.phone,
      templateCode: templateCode.trim(),
      templateParam,
      context: `scene=${payload.scene} phone=${payload.phone}`,
    });
  }

  async sendPlainText(payload: PlainSmsPayload): Promise<void> {
    BusinessException.throwIf(!this.isReady(), '短信服务未正确配置', ResponseCode.SERVICE_UNAVAILABLE);
    const templateCode = process.env.ALIYUN_SMS_TEMPLATE_NOTIFICATION?.trim();
    BusinessException.throwIf(!templateCode, '通知类短信模板未配置', ResponseCode.NOT_IMPLEMENTED);
    const text = payload.text.length > 500 ? `${payload.text.slice(0, 497)}...` : payload.text;
    const templateParam = JSON.stringify({ content: text });
    await this.dispatchSendSms({
      phoneNumbers: payload.phone,
      templateCode,
      templateParam,
      context: `notification phone=${payload.phone}`,
    });
  }
}
