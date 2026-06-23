import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminLoginBySmsDto, AdminResetPasswordDto, SendAdminLoginCodeDto } from './index';

async function validationMessages(dtoClass: new () => object, input: Record<string, unknown>): Promise<string[]> {
  const instance = plainToInstance(dtoClass, input, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: false,
  });

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('admin auth DTO validation', () => {
  describe('invariants', () => {
    it.each([
      ['login code', SendAdminLoginCodeDto, { mobile: '13800138000' }],
      ['sms login', AdminLoginBySmsDto, { mobile: '13800138000', code: '123456' }],
      ['reset password', AdminResetPasswordDto, { mobile: '13800138000', code: '123456', newPassword: 'Strong123' }],
    ])('%s accepts the minimum valid payload', async (_label, dtoClass, payload) => {
      await expect(validationMessages(dtoClass, payload)).resolves.toEqual([]);
    });
  });

  describe('adversarial inputs', () => {
    it.each([
      ['empty mobile', { mobile: '' }],
      ['short mobile', { mobile: '123' }],
      ['non numeric mobile', { mobile: '13800138abc' }],
      ['extra field', { mobile: '13800138000', roleIds: [1] }],
    ])('send login code rejects %s', async (_label, payload) => {
      await expect(validationMessages(SendAdminLoginCodeDto, payload)).resolves.not.toEqual([]);
    });

    it('sms login rejects missing code even when mobile is valid', async () => {
      const messages = await validationMessages(AdminLoginBySmsDto, { mobile: '13800138000' });
      expect(messages).toContain('验证码不能为空');
    });

    it('reset password rejects weak passwords before service code runs', async () => {
      const messages = await validationMessages(AdminResetPasswordDto, {
        mobile: '13800138000',
        code: '123456',
        newPassword: '12345',
      });
      expect(messages.join(';')).toContain('密码必须包含大写字母');
    });
  });

  describe('boundary conditions', () => {
    it.each([
      ['tenant id omitted', { mobile: '13800138000' }],
      ['tenant id provided', { mobile: '13800138000', tenantId: '000000' }],
    ])('login code accepts %s', async (_label, payload) => {
      await expect(validationMessages(SendAdminLoginCodeDto, payload)).resolves.toEqual([]);
    });

    it('sms login rejects unknown fields under production ValidationPipe semantics', async () => {
      const messages = await validationMessages(AdminLoginBySmsDto, {
        mobile: '13800138000',
        code: '123456',
        permissions: ['*:*:*'],
      });
      expect(messages).toContain('property permissions should not exist');
    });
  });
});
