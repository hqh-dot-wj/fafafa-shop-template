/**
 * SSE 推送的站内信信封（与 admin-web `utils/sse` 解析约定一致）
 *
 * @description v1：通知处理器在 IN_APP 发送成功后推送，前端 JSON.parse 后按 kind 分发
 */
export const IN_APP_SSE_KIND = 'in_app_message' as const;

export interface InAppSsePayloadV1 {
  v: 1;
  kind: typeof IN_APP_SSE_KIND;
  messageId: number;
  title?: string;
  content: string;
  type: string;
  tenantId: string;
}
