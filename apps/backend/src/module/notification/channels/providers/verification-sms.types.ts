/** 认证类短信发送参数（验证码）；scene 取值与 SmsVerificationScene 一致 */
export interface VerificationSmsPayload {
  phone: string;
  code: string;
  scene: string;
  tenantId: string;
  /** 模板变量「分钟」，与阿里云短信模板 ${min} 对齐；默认与 Redis 验证码 TTL 一致 */
  validMinutes?: number;
}

/** 通知类短信（纯文本） */
export interface PlainSmsPayload {
  phone: string;
  text: string;
  tenantId: string;
}
