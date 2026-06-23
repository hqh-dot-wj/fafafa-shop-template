/**
 * 短信验证码业务场景（与 Redis Key、阿里云模板配置对齐）
 */
export enum SmsVerificationScene {
  MEMBER_LOGIN = 'member_login',
  MEMBER_RESET_PASSWORD = 'member_reset_password',
  ADMIN_LOGIN = 'admin_login',
  ADMIN_RESET_PASSWORD = 'admin_reset_password',
}
