import { localStg } from '@/utils/storage';
import { request } from '../request';
import { resolveTenantIdOrThrow } from '../request/tenant';

/** Get tenant list */
export function fetchTenantList() {
  return request<Api.Auth.LoginTenant>({
    url: '/auth/tenant/list',
    method: 'get',
  });
}

/** Get image code */
export function fetchCaptchaCode() {
  return request<Api.Auth.CaptchaCode>({
    url: '/auth/code',
    method: 'get',
  });
}

/**
 * Login
 *
 * @param username User name
 * @param password Password
 */
export function fetchLogin(data: Api.Auth.PwdLoginForm) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/login',
    method: 'post',
    headers: {
      isToken: false,
      isEncrypt: true,
      repeatSubmit: false,
    },
    data,
  });
}

/** 刷新访问令牌 */
export function fetchRefreshToken(data: Api.Auth.RefreshTokenForm) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/refresh',
    method: 'post',
    headers: {
      isToken: false,
      repeatSubmit: false,
    },
    data,
  });
}

/** 管理员短信登录验证码 */
export function fetchSendAdminLoginCode(data: Pick<Api.Auth.SmsLoginForm, 'mobile' | 'tenantId'>) {
  const tenantId = resolveTenantIdOrThrow(data.tenantId, '发送登录验证码时');
  return request<null>({
    url: '/auth/send-login-code',
    method: 'post',
    headers: {
      isToken: false,
      repeatSubmit: false,
      'tenant-id': tenantId,
    },
    data: { mobile: data.mobile, tenantId },
  });
}

/** 管理员短信验证码登录 */
export function fetchLoginBySms(data: Api.Auth.SmsLoginForm) {
  const tenantId = resolveTenantIdOrThrow(data.tenantId, '短信登录时');
  return request<Api.Auth.LoginToken>({
    url: '/auth/login-by-sms',
    method: 'post',
    headers: {
      isToken: false,
      repeatSubmit: false,
      'tenant-id': tenantId,
    },
    data: {
      mobile: data.mobile,
      code: data.code,
      tenantId,
      clientId: data.clientId,
      grantType: data.grantType ?? 'sms',
    },
  });
}

/** 管理员忘记密码：发送短信 */
export function fetchSendAdminResetCode(data: Pick<Api.Auth.SmsLoginForm, 'mobile' | 'tenantId'>) {
  const tenantId = resolveTenantIdOrThrow(data.tenantId, '发送重置验证码时');
  return request<null>({
    url: '/auth/send-reset-code',
    method: 'post',
    headers: {
      isToken: false,
      repeatSubmit: false,
      'tenant-id': tenantId,
    },
    data: { mobile: data.mobile, tenantId },
  });
}

/** 管理员短信重置密码 */
export function fetchResetPasswordBySms(data: Api.Auth.AdminResetPasswordForm) {
  const tenantId = resolveTenantIdOrThrow(data.tenantId, '短信重置密码时');
  return request<null>({
    url: '/auth/reset-password',
    method: 'post',
    headers: {
      isToken: false,
      repeatSubmit: false,
      'tenant-id': tenantId,
    },
    data: {
      mobile: data.mobile,
      code: data.code,
      newPassword: data.newPassword,
      tenantId,
    },
  });
}

/** social login callback */
export function fetchSocialLoginCallback(data: Api.Auth.SocialLoginForm) {
  return request({
    url: '/auth/social/callback',
    method: 'post',
    data,
  });
}

/** 微信扫码/绑定回调占位（后端返回 NOT_IMPLEMENTED 时由拦截器提示） */
export function fetchWechatSocialCallback(data?: { code?: string; state?: string }) {
  const tenantId = resolveTenantIdOrThrow(localStg.get('tenantId'), '微信回调时');
  return request<null>({
    url: '/auth/social/wechat/callback',
    method: 'post',
    headers: {
      isToken: false,
      repeatSubmit: false,
      'tenant-id': tenantId,
    },
    data: data ?? {},
  });
}

/** Register（后端已拒绝公开注册，保留接口仅兼容旧调用） */
export function fetchRegister(data: Api.Auth.RegisterForm) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/register',
    method: 'post',
    headers: {
      isToken: false,
      isEncrypt: true,
      repeatSubmit: false,
    },
    data,
  });
}

/** Get user info */
export function fetchGetUserInfo() {
  return request<Api.Auth.UserInfo>({ url: '/system/user/getInfo' });
}

/** Logout */
export function fetchLogout() {
  if (import.meta.env.VITE_APP_SSE === 'Y') {
    request({
      url: '/resource/sse/close',
      method: 'get',
    });
  }
  return request({
    url: '/auth/logout',
    method: 'post',
  });
}
