import * as bcrypt from 'bcryptjs';

/** 与 AuthService.passwordLogin（bcryptjs）一致的会员密码哈希 */
export function hashMemberPassword(plain: string): string {
  return bcrypt.hashSync(plain, bcrypt.genSaltSync(10));
}

/** 演示/联调默认明文密码 */
export const DEMO_MEMBER_PLAIN_PASSWORD = '123456';
