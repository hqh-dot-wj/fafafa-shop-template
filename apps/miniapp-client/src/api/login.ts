import type {
  IAuthLoginRes,
  ICheckLoginRes,
  IDoubleTokenRes,
  IPasswordLoginParams,
  IRegisterMobileParams,
  IResetPasswordParams,
  ISetPasswordParams,
  ISmsLoginParams,
  IUpdateInfo,
  IUpdatePassword,
  IUserInfoRes,
  IWxRegisterParams,
} from './types/login';
import { http } from '@/http/http';

export function getUserInfo() {
  return http.get<IUserInfoRes>('/client/user/info');
}

export function logout() {
  return http.get<void>('/client/auth/logout');
}

export function updateInfo(data: IUpdateInfo) {
  return http.post('/client/user/updateInfo', data);
}

export function updateUserPassword(data: IUpdatePassword) {
  return http.post('/client/user/updatePassword', data);
}

export function refreshToken(rt: string) {
  return http.post<IDoubleTokenRes>('/client/auth/refresh', { refresh_token: rt });
}

// ========== 微信小程序认证 ==========

export function getWxCode() {
  return new Promise<UniApp.LoginRes>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => resolve(res),
      fail: (err) => reject(err),
    });
  });
}

export function wxCheckLogin(data: { code: string }) {
  return http.post<ICheckLoginRes>('/client/auth/check-login', data);
}

export function mobileLogin(data: IRegisterMobileParams) {
  return http.post<IAuthLoginRes>('/client/auth/register-mobile', data);
}

export function wxRegister(data: IWxRegisterParams) {
  return http.post<IAuthLoginRes>('/client/auth/register', data);
}

export function bindPhone(data: { phoneCode: string }) {
  return http.post<{ userInfo: IUserInfoRes }>('/client/auth/bind-phone', data);
}

// ========== H5 会员短信/密码认证 ==========

export function sendLoginCode(data: { mobile: string; tenantId?: string }) {
  return http.post<null>('/client/auth/send-login-code', data);
}

export function loginOrRegisterBySms(data: ISmsLoginParams) {
  return http.post<IAuthLoginRes>('/client/auth/login-or-register-by-sms', data);
}

export function passwordLogin(data: IPasswordLoginParams) {
  return http.post<IAuthLoginRes>('/client/auth/password-login', data);
}

export function sendResetCode(data: { mobile: string; tenantId?: string }) {
  return http.post<null>('/client/auth/send-reset-code', data);
}

export function resetPassword(data: IResetPasswordParams) {
  return http.post<null>('/client/auth/reset-password', data);
}

export function setPassword(data: ISetPasswordParams) {
  return http.post<null>('/client/auth/set-password', data);
}
