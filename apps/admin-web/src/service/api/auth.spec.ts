// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchCaptchaCode,
  fetchGetUserInfo,
  fetchLogin,
  fetchLoginBySms,
  fetchLogout,
  fetchRefreshToken,
  fetchRegister,
  fetchResetPasswordBySms,
  fetchSendAdminLoginCode,
  fetchSendAdminResetCode,
  fetchSocialLoginCallback,
  fetchTenantList,
  fetchWechatSocialCallback,
} from './auth';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

vi.mock('@/utils/storage', () => ({
  localStg: {
    get: vi.fn(() => '000000'),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('Auth API', () => {
  it('fetchTenantList should GET /auth/tenant/list', async () => {
    const res = await fetchTenantList();
    expect(res.data).toMatchObject({ url: '/auth/tenant/list', method: 'get' });
  });

  it('fetchCaptchaCode should GET /auth/code', async () => {
    const res = await fetchCaptchaCode();
    expect(res.data).toMatchObject({ url: '/auth/code', method: 'get' });
  });

  it('fetchLogin should POST /auth/login with isEncrypt header', async () => {
    const form: Api.Auth.PwdLoginForm = { username: 'admin', password: '123456', tenantId: 't1' };
    const res = await fetchLogin(form);
    expect(res.data).toMatchObject({
      url: '/auth/login',
      method: 'post',
      headers: expect.objectContaining({ isEncrypt: true, isToken: false }),
      data: form,
    });
  });

  it('fetchRefreshToken should POST /auth/refresh without encrypt', async () => {
    const res = await fetchRefreshToken({ refreshToken: 'rt1' });
    expect(res.data).toMatchObject({
      url: '/auth/refresh',
      method: 'post',
      headers: expect.objectContaining({ isToken: false }),
      data: { refreshToken: 'rt1' },
    });
  });

  it('fetchSendAdminLoginCode should POST /auth/send-login-code with tenant-id header', async () => {
    const res = await fetchSendAdminLoginCode({ mobile: '13800138000', tenantId: 't1' });
    expect(res.data).toMatchObject({
      url: '/auth/send-login-code',
      method: 'post',
      headers: expect.objectContaining({ 'tenant-id': 't1', isToken: false }),
      data: { mobile: '13800138000', tenantId: 't1' },
    });
  });

  it('fetchLoginBySms should POST /auth/login-by-sms', async () => {
    const form: Api.Auth.SmsLoginForm = {
      mobile: '13800138000',
      code: '123456',
      tenantId: 't1',
      clientId: 'pc',
    };
    const res = await fetchLoginBySms(form);
    expect(res.data).toMatchObject({
      url: '/auth/login-by-sms',
      method: 'post',
      headers: expect.objectContaining({ 'tenant-id': 't1' }),
      data: expect.objectContaining({
        mobile: '13800138000',
        code: '123456',
        tenantId: 't1',
        clientId: 'pc',
        grantType: 'sms',
      }),
    });
  });

  it('fetchSendAdminResetCode should POST /auth/send-reset-code', async () => {
    const res = await fetchSendAdminResetCode({ mobile: '13800138000', tenantId: '000000' });
    expect(res.data).toMatchObject({
      url: '/auth/send-reset-code',
      method: 'post',
      headers: expect.objectContaining({ 'tenant-id': '000000' }),
    });
  });

  it('fetchResetPasswordBySms should POST /auth/reset-password', async () => {
    const body: Api.Auth.AdminResetPasswordForm = {
      mobile: '13800138000',
      code: '123456',
      newPassword: 'Str0ng!1',
      tenantId: 't1',
    };
    const res = await fetchResetPasswordBySms(body);
    expect(res.data).toMatchObject({
      url: '/auth/reset-password',
      method: 'post',
      data: {
        mobile: '13800138000',
        code: '123456',
        newPassword: 'Str0ng!1',
        tenantId: 't1',
      },
    });
  });

  it('fetchSocialLoginCallback should POST /auth/social/callback', async () => {
    const form: Api.Auth.SocialLoginForm = { source: 'wechat', socialCode: 'code123', socialState: 'state' };
    const res = await fetchSocialLoginCallback(form);
    expect(res.data).toMatchObject({ url: '/auth/social/callback', method: 'post', data: form });
  });

  it('fetchWechatSocialCallback should POST /auth/social/wechat/callback', async () => {
    const res = await fetchWechatSocialCallback({ code: 'c' });
    expect(res.data).toMatchObject({
      url: '/auth/social/wechat/callback',
      method: 'post',
      headers: expect.objectContaining({ 'tenant-id': '000000' }),
      data: { code: 'c' },
    });
  });

  it('fetchRegister should POST /auth/register with isEncrypt header', async () => {
    const form: Api.Auth.RegisterForm = { username: 'user1', password: 'pass', tenantId: 't1' };
    const res = await fetchRegister(form);
    expect(res.data).toMatchObject({
      url: '/auth/register',
      method: 'post',
      headers: expect.objectContaining({ isEncrypt: true }),
      data: form,
    });
  });

  it('fetchGetUserInfo should GET /system/user/getInfo', async () => {
    const res = await fetchGetUserInfo();
    expect(res.data).toMatchObject({ url: '/system/user/getInfo' });
  });

  it('fetchLogout should POST /auth/logout', async () => {
    const res = await fetchLogout();
    expect(res.data).toMatchObject({ url: '/auth/logout', method: 'post' });
  });
});
