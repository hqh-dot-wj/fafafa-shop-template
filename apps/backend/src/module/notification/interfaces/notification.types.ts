/** 通知渠道类型 */
export type NotificationChannel = 'IN_APP' | 'SMS' | 'WECHAT_TEMPLATE' | 'APP_PUSH';

/** 通知消息体 */
export interface NotificationMessage {
  title?: string;
  content: string;
  template?: string;
  templateVersion?: string;
  params?: Record<string, string>;
  tenantId: string;
}

/** 发送结果 */
export interface SendResult {
  success: boolean;
  error?: string;
  /** 站内信落库后的主键（仅 IN_APP 等写入类渠道可能返回） */
  messageId?: number;
  /** 三方渠道返回的消息ID（短信/微信模板/推送等） */
  providerMessageId?: string;
}
