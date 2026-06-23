import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListTenantDto, SyncTenantPackageDto } from './tenant/dto';
import { AuthUserSelectAllDto, ChangeRoleStatusDto, ListRoleDto } from './role/dto';
import { ChangeUserStatusDto, ListUserDto, ResetPwdDto, UpdateAuthRoleQueryDto } from './user/dto';

async function validationMessages<T extends object>(
  dtoClass: new () => T,
  input: Record<string, unknown>,
): Promise<string[]> {
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

describe('admin system DTO validation', () => {
  describe('invariants', () => {
    it.each([
      ['role list pagination', ListRoleDto, { pageNum: '1', pageSize: '100' }],
      ['user list pagination', ListUserDto, { pageNum: '1', pageSize: '100' }],
      ['tenant list pagination', ListTenantDto, { pageNum: '1', pageSize: '100' }],
      ['role status change', ChangeRoleStatusDto, { roleId: 2, status: '0' }],
      ['user status change', ChangeUserStatusDto, { userId: 2, status: '1' }],
      ['reset password', ResetPwdDto, { userId: 2, password: 'Strong123' }],
    ])('%s accepts a valid payload', async (_label, dtoClass, payload) => {
      await expect(validationMessages(dtoClass, payload)).resolves.toEqual([]);
    });
  });

  describe('adversarial inputs', () => {
    it.each([
      ['role list extra field', ListRoleDto, { pageNum: '1', pageSize: '10', permissions: ['*:*:*'] }],
      ['user list invalid status', ListUserDto, { status: 'DELETED' }],
      ['tenant list invalid date', ListTenantDto, { beginTime: 'not-a-date' }],
      ['auth role non numeric user id', UpdateAuthRoleQueryDto, { userId: 'abc', roleIds: '1,2' }],
      ['sync tenant package missing tenant', SyncTenantPackageDto, { packageId: 1 }],
    ])('%s is rejected', async (_label, dtoClass, payload) => {
      await expect(validationMessages(dtoClass, payload)).resolves.not.toEqual([]);
    });

    it('role grant DTO rejects a non numeric role id before service authorization runs', async () => {
      const messages = await validationMessages(AuthUserSelectAllDto, {
        roleId: 'not-a-number',
        userIds: '1,2',
      });
      expect(messages.join(';')).toContain('roleId must be a number');
    });
  });

  describe('boundary conditions', () => {
    it.each([
      ['pageNum zero', ListRoleDto, { pageNum: '0', pageSize: '10' }],
      ['pageNum negative', ListUserDto, { pageNum: '-1', pageSize: '10' }],
      ['pageSize zero', ListTenantDto, { pageNum: '1', pageSize: '0' }],
      ['pageSize above maximum', ListTenantDto, { pageNum: '1', pageSize: '101' }],
    ])('%s is rejected by shared pagination rules', async (_label, dtoClass, payload) => {
      await expect(validationMessages(dtoClass, payload)).resolves.not.toEqual([]);
    });

    it('status shortcuts are transformed before enum validation', async () => {
      await expect(validationMessages(ChangeRoleStatusDto, { roleId: 1, status: '0' })).resolves.toEqual([]);
      await expect(validationMessages(ChangeUserStatusDto, { userId: 1, status: '1' })).resolves.toEqual([]);
    });
  });
});
